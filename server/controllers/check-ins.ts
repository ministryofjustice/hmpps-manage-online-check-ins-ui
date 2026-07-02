import {
  DeactivateOffenderRequest,
  OffenderCheckinsByCRNResponse,
  ESupervisionCheckIn, ESupervisionReview,
} from '../data/model/esupervision'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import renderError from '../middleware/renderError'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'
import ESupervisionClient from '../data/eSupervisionClients'
import { Controller } from '../@types'
import config from '../config'

function systemIdCheckPass(checkIn: ESupervisionCheckIn): boolean {
  if (checkIn.livenessEnabled) {
    return checkIn.livenessResult === 'LIVE' && checkIn.autoIdCheck === 'MATCH'
  }
  return checkIn.autoIdCheck === 'MATCH'
}

const routes = [
  'getManageCheckinPage',
  'postManageStopCheckin',
  'getStopCheckinPage',
  'getReviewIdentityCheckIn',
  'postReviewIdentityCheckIn',
  'getReviewNotesCheckIn',
  'postReviewCheckIn',
  'getReviewExpiredCheckIn',
] as const

// const offenderDetails = (crn: string, offender: TemporaryOffenderResponse['offender']) => [
//   {
//     label: 'CRN',
//     value: offender.crn ?? crn,
//   },
//   {
//     label: 'Status',
//     value: offender.status,
//   },
//   {
//     label: 'First check in',
//     value: offender.firstCheckin,
//   },
//   {
//     label: 'Check in interval',
//     value: offender.checkinInterval,
//   },
//   {
//     label: 'Contact preference',
//     value: offender.contactPreference,
//   },
// ]

const handleQuotes = (value?: string): string => value?.replace(/"/g, '\\"') ?? ''

const checkInsController: Controller<typeof routes, void> = {
  // getViewCase:
  //   ({ esupervisionService }: Pick<Services, 'esupervisionService'>): RequestHandler =>
  //   async (req, res) => {
  //     const { crn } = req.params as Record<string, string>

  //     const offenderResponse = await esupervisionService.getOffenderByCrn(crn)

  //     const { offender, tierCalculation, risksWidget, riskData, headerTierLink } = offenderResponse

  //     return res.render('pages/viewCase', {
  //       title: 'Appointments',

  //       popHeader: true,

  //       headerCRN: offender.crn ?? crn,
  //       headerDob: offender.dateOfBirth ?? '1980-01-01',
  //       headerPersonName: {
  //         forename: offender.forename ?? 'Joe',
  //         surname: offender.surname ?? 'Bloggs',
  //       },

  //       headerTierLink,
  //       tierCalculation,
  //       risksWidget,
  //       riskData,

  //       offenderDetails: offenderDetails(crn, offender),
  //     })
  //   },

  getManageCheckinPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn } = req.params as Record<string, string>
      const offenderCheckinsByCRNResponse = res.locals.offenderCheckinsByCRNResponse as OffenderCheckinsByCRNResponse

      return res.render('pages/check-in/index.njk', {
        crn,
        id: offenderCheckinsByCRNResponse.uuid,
        offenderCheckinsByCRNResponse,
      })
    }
  },
  getStopCheckinPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      // await sendAuditMessage(res, 'VIEW_MAS_MANAGE_STOP_CHECK_IN', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.render('pages/check-in/manage/stop-checkin.njk', {
        crn,
        id,
        case: {
          name: {
            forename: 'the person',
          },
        },
      })
    }
  },

  postManageStopCheckin: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }

      const reasonData = getDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin', 'stopCheckinReason'])

      let isSensitive = false
      const sensitiveData = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'manageCheckin',
        'stopCheckinSensitive',
      ])
      isSensitive = sensitiveData === 'true'

      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupervisionClient = new ESupervisionClient(token)

      const body: DeactivateOffenderRequest = {
        requestedBy: res.locals.user.username,
        reason: handleQuotes(reasonData),
        sensitive: isSensitive,
      }
      res.locals.offenderCheckinsByCRNResponse = await eSupervisionClient.postDeactivateOffender(id, body)
      setDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin'], null)
      return res.redirect(`/case/${crn}/appointments/check-in/manage`)
    }
  },

  getReviewIdentityCheckIn: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const { back } = req.query
      const { checkIn } = res.locals
      if (checkIn.status !== 'SUBMITTED') {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/update${back ? `?back=${back}` : ''}`)
      }
      // await sendAuditMessage(res, 'VIEW_MAS_REVIEW_CHECK_IN_AND_CONFIRM_IDENTITY', crn, SubjectType.CRN)
      return res.render('pages/check-in/review/identity.njk', {
        crn,
        id,
        back,
        checkIn,
        systemIdCheckPass: systemIdCheckPass(checkIn),
      })
    }
  },

  postReviewIdentityCheckIn: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const url = encodeURIComponent(req.url)
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/review/notes?back=${url}`)
    }
  },

  getReviewNotesCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { checkIn } = res.locals
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const { back } = req.query
      const { data } = req.session
      const checkInSession = getDataValue(data, ['esupervision', crn, id, 'checkins'])
      if (checkInSession?.manualIdCheck === undefined) {
        return res.redirect(back ? (back as string) : `/case/${crn}/appointments/${id}/check-in/review/identity`)
      }

      if (checkIn.status !== 'SUBMITTED') {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/update${back ? `?back=${back}` : ''}`)
      }
      // await sendAuditMessage(res, 'VIEW_MAS_ONLINE_CHECK_IN_REVIEW_SUBMITTED', crn, SubjectType.CRN)
      return res.render('pages/check-in/review/notes.njk', { crn, id, back, checkIn })
    }
  },

  postReviewCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const url = encodeURIComponent(req.url)
      const { data } = req.session
      const checkIn = getDataValue(data, ['esupervision', crn, id, 'checkins'])
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const practitionerUsername = res.locals.user.username
      let risk: boolean = null
      if (checkIn?.riskManagementFeedback) {
        risk = checkIn.riskManagementFeedback === 'yes'
      }
      const reviewNotes = checkIn?.notes
      const review: ESupervisionReview = {
        reviewedBy: practitionerUsername,
        manualIdCheck: checkIn?.manualIdCheck,
        missedCheckinComment: checkIn?.missedCheckinComment,
        notes: reviewNotes,
        riskManagementFeedback: risk,
        sensitive: checkIn?.sensitiveContact === 'true',
      }
      const eSupervisionClient = new ESupervisionClient(token)
      await eSupervisionClient.postOffenderCheckInReview(id, review)
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'sensitiveContact'], null)
      return res.redirect(`${config.mpop}/case/${crn}/activity-log`)
    }
  },

  getReviewExpiredCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const { back } = req.query
      const { checkIn } = res.locals
      if (checkIn.status === 'EXPIRED' && checkIn.reviewedAt) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/view-expired${back ? `?back=${back}` : ''}`)
      }
      if (checkIn.status !== 'EXPIRED') {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/update${back ? `?back=${back}` : ''}`)
      }
      // await sendAuditMessage(res, 'VIEW_MAS_ONLINE_CHECK_IN_MISSED', crn, SubjectType.CRN)
      return res.render('pages/check-in/review/expired.njk', { crn, id, back, checkIn })
    }
  },
}

export default checkInsController
