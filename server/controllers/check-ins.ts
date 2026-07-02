import {
  DeactivateOffenderRequest,
  OffenderCheckinsByCRNResponse,
  ESupervisionCheckIn,
} from '../data/model/esupervision'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import renderError from '../middleware/renderError'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'
import ESupervisionClient from '../data/eSupervisionClients'
import { Controller } from '../@types'

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

  getReviewIdentityCheckIn: hmppsAuthClient => {
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

  postReviewIdentityCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const url = encodeURIComponent(req.url)
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/review/notes?back=${url}`)
    }
  },
}

export default checkInsController
