import { DateTime } from 'luxon'
import {
  CheckinScheduleRequest,
  DeactivateOffenderRequest,
  ESupervisionCheckIn,
  ESupervisionNote,
  ESupervisionReview,
  OffenderByCRNResponse,
  ReactivateOffenderRequest,
} from '../data/model/esupervision'
import renderError from '../middleware/renderError'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'
import ESupervisionClient from '../data/eSupervisionClient'
import { Controller } from '../@types'
import config from '../config'
import { handleQuotes } from '../utils/handleQuotes'
import getCheckinOffenderDetails from '../middleware/getCheckinOffenderDetails'
import logger from '../../logger'
import { dateWithYear } from '../utils/dateWithYear'
import { dayOfWeek } from '../utils/dayOfWeek'

const checkinIntervals: { id: string; label: string }[] = [
  { id: 'WEEKLY', label: 'Every week' },
  { id: 'TWO_WEEKS', label: 'Every 2 weeks' },
  { id: 'FOUR_WEEKS', label: 'Every 4 weeks' },
  { id: 'EIGHT_WEEKS', label: 'Every 8 weeks' },
]

// moj date-picker minDate workaround (https://github.com/ministryofjustice/moj-frontend/issues/923)
const getMinDate = (): string => {
  const today = new Date()
  return today.getDate() > 9
    ? DateTime.fromJSDate(today).toFormat('dd/M/yyyy')
    : DateTime.fromJSDate(today).toFormat('d/M/yyyy')
}

export function systemIdCheckPass(checkIn: ESupervisionCheckIn): boolean {
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
  'getUpdateCheckIn',
  'getViewCheckIn',
  'postViewCheckIn',
  'getViewExpiredCheckIn',
  'getManageCheckinDatePage',
  'postManageCheckinDatePage',
  'getManageContactPage',
  'postManageContactPage',
  'getManageEditContactPage',
  'postManageEditContactPage',
  'getRestartCheckinPage',
  'postRestartCheckinPage',
  'getRestartContactPage',
  'postRestartContactPage',
  'getRestartEditContactPage',
  'postRestartEditContactPage',
  'getRestartSummaryPage',
  'postRestartSummaryPage',
  'getRestartConfirmation',
] as const

const checkInsController: Controller<typeof routes, void> = {
  getManageCheckinPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      // await sendAuditMessage(res, 'VIEW_MAS_MANAGE_CHECK_IN', crn, SubjectType.CRN)
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)

      req.session.data = req.session.data || {}
      const { data } = req.session

      await getCheckinOffenderDetails(hmppsAuthClient)(req, res, () => {})
      const checkinRes = res.locals?.offenderByCRNResponse
      const eSupClient = new ESupervisionClient(token)
      let upcomingCheckin = null
      try {
        const response = await eSupClient.getUpcomingCheckinQuestions(crn)
        upcomingCheckin = response || null
      } catch (error) {
        logger.info(`No upcoming check in questions found for CRN ${crn}`)
      }
      // questions can be edited until 23:59 the day before a check in is sent out
      const today = new Date().setHours(0, 0, 0, 0)
      const checkinDate = upcomingCheckin?.expectedCheckinDate
        ? new Date(upcomingCheckin.expectedCheckinDate).setHours(0, 0, 0, 0)
        : null
      const canEditQuestions = checkinDate ? today < checkinDate : false
      const showChange = checkinRes?.status === 'VERIFIED'
      setDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin', 'preferredComs'], undefined)
      const settingsUpdated = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'settingsUpdated'])
      if (settingsUpdated) {
        res.locals.success = true
        delete req.session?.data?.esupervision?.[crn]?.[id]?.manageCheckin?.settingsUpdated
      }
      const questionsAdded = getDataValue(req.session.data, ['esupervision', crn, id, 'questionsAdded'])

      let successMessageHtml: string | undefined

      if (questionsAdded) {
        res.locals.success = true
        const forename = 'the person'
        const rawCheckinDate = upcomingCheckin?.expectedCheckinDate
        const nextCheckinDate = dateWithYear(rawCheckinDate)
        successMessageHtml = `
          <strong>You have added additional questions to ${forename}’s next online check in</strong>
          <br>
          Additional questions will only apply to their next check in${nextCheckinDate ? ` on ${nextCheckinDate}` : ''}
        `
        setDataValue(req.session.data, ['esupervision', crn, id, 'questionsAdded'], undefined)
      }
      return res.render('pages/check-in/manage/manage-checkin.njk', {
        crn,
        // the /manage route has no :id param; the check-in id is the offender uuid
        id: checkinRes?.uuid ?? id,
        case: checkinRes?.details,
        email: checkinRes?.email ?? '',
        mobile: checkinRes?.mobile ?? '',
        offenderCheckinsByCRNResponse: checkinRes,
        showChange,
        upcomingCheckin,
        canEditQuestions,
        successMessageHtml,
      })
    }
  },
  getStopCheckinPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      // await sendAuditMessage(res, 'VIEW_MAS_MANAGE_STOP_CHECK_IN', crn, SubjectType.CRN)
      const offenderDetails = res.locals.offenderByCRNResponse
      const mpopBaseUrl = config.managePeopleOnProbation.link.replace(/\/$/, '')
      const redirectUrl = `${mpopBaseUrl}/case/${crn}`
      if (offenderDetails.status !== 'VERIFIED') {
        return res.redirect(303, redirectUrl)
      }
      return res.render('pages/check-in/manage/stop-checkin.njk', {
        crn: offenderDetails.crn,
        id: offenderDetails.uuid,
        case: offenderDetails.details,
      })
    }
  },

  postManageStopCheckin: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>

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
        reason: handleQuotes(reasonData ?? ''),
        sensitive: isSensitive,
      }
      res.locals.offenderByCRNResponse = await eSupervisionClient.postDeactivateOffender(id, body)
      setDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin'], null)
      const mpopBaseUrl = config.managePeopleOnProbation.link.replace(/\/$/, '')
      const redirectUrl = `${mpopBaseUrl}/case/${crn}`
      return res.redirect(303, redirectUrl)
    }
  },

  getReviewIdentityCheckIn: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
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
      const url = encodeURIComponent(req.url)
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/review/notes?back=${url}`)
    }
  },

  getReviewNotesCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { checkIn } = res.locals
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
      return res.redirect(`${config.managePeopleOnProbation.link}/case/${crn}/activity-log`)
    }
  },

  getReviewExpiredCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
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

  getViewCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query

      const { checkIn } = res.locals

      if (checkIn.status !== 'REVIEWED') {
        return res.render('pages/check-in/update.njk', {
          crn,
          id,
          back,
          checkIn,
          systemIdCheckPass: systemIdCheckPass(checkIn),
        })
      }
      return res.render('pages/check-in/view.njk', {
        crn,
        id,
        back,
        checkIn,
        systemIdCheckPass: systemIdCheckPass(checkIn),
      })
    }
  },

  postViewCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      const { url } = req

      const { data } = req.session
      const checkIn = getDataValue(data, ['esupervision', crn, id, 'checkins'])

      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)

      const practitionerUsername = res.locals.user.username

      const eSupervisionClient = new ESupervisionClient(token)
      const notes: ESupervisionNote = {
        updatedBy: practitionerUsername,
        notes: checkIn?.note,
        sensitive: checkIn?.sensitiveContact === 'true',
      }
      await eSupervisionClient.postOffenderCheckInNote(id, notes)

      setDataValue(data, ['esupervision', crn, id, 'checkins', 'note'], null)
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'sensitiveContact'], null)
      return res.redirect(url)
    }
  },

  getViewExpiredCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      // await sendAuditMessage(res, 'VIEW_MAS_CHECK_IN_MISSED_AND_REVIEWED', crn, SubjectType.CRN)
      const { back } = req.query
      const { checkIn } = res.locals

      if (checkIn.status !== 'EXPIRED' || !checkIn.reviewedAt) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/update${back ? `?back=${back}` : ''}`)
      }
      return res.render('pages/check-in/view-expired.njk', { crn, id, back, checkIn })
    }
  },

  getUpdateCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      const { checkIn } = res.locals
      const statusMap: Record<string, string> = {
        REVIEWED: 'view',
        SUBMITTED: 'review/identity',
        EXPIRED: 'review/expired',
      }
      if (checkIn.status === 'SUBMITTED' || checkIn.status === 'EXPIRED') {
        const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
        const practitionerId = res.locals.user.username
        const eSupervisionClient = new ESupervisionClient(token)
        await eSupervisionClient.postOffenderCheckInStarted(id, practitionerId)
      }
      if (Object.keys(statusMap).includes(checkIn.status)) {
        return res.redirect(
          `/case/${crn}/appointments/${id}/check-in/${statusMap[checkIn.status]}${back ? `?back=${back}` : ''}`,
        )
      }
      return renderError(404)(req, res)
    }
  },

  getManageCheckinDatePage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const checkInMinDate = getMinDate()
      await getCheckinOffenderDetails(hmppsAuthClient)(req, res, () => {})
      const checkinRes = res.locals?.offenderByCRNResponse
      const date = checkinRes?.firstCheckin
      const interval = checkinRes?.checkinInterval
      setDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin'], { date, interval })
      return res.render('pages/check-in/manage/checkin-settings.njk', {
        crn,
        id,
        case: checkinRes?.details,
        checkInMinDate,
        date,
        interval,
      })
    }
  },

  postManageCheckinDatePage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const previousDate = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'date'])
      const previousInterval = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'interval'])
      // date is entered as d/M/yyyy; the API expects yyyy/M/dd
      const parsedFirstCheckin = DateTime.fromFormat(previousDate ?? '', 'd/M/yyyy')
      const formattedDate = parsedFirstCheckin.isValid ? parsedFirstCheckin.toFormat('yyyy/M/dd') : previousDate
      const body: CheckinScheduleRequest = {
        checkinSchedule: {
          requestedBy: res.locals.user.username,
          firstCheckin: formattedDate,
          checkinInterval: previousInterval,
        },
      }
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupClient = new ESupervisionClient(token)
      const response = await eSupClient.postUpdateOffenderDetails(id, body)
      if (response?.crn) {
        res.locals.success = true
        setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'settingsUpdated'], true)
      }
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}`)
    }
  },

  getManageContactPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const checkInMobile = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInMobile'])
      const checkInEmail = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInEmail'])
      const contactUpdated = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'contactUpdated'])
      if (contactUpdated) {
        res.locals.success = true
        delete req.session?.data?.esupervision?.[crn]?.[id]?.manageCheckin?.contactUpdated
      }
      await getCheckinOffenderDetails(hmppsAuthClient)(req, res, () => {})
      const checkinRes = res.locals?.offenderByCRNResponse
      const isPrefComsSet = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'preferredComs'])
      if (isPrefComsSet === undefined) {
        setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'preferredComs'], checkinRes?.contactPreference)
      }
      return res.render('pages/check-in/manage/manage-contact.njk', {
        crn,
        id,
        case: checkinRes?.details,
        checkInMobile,
        checkInEmail,
      })
    }
  },

  postManageContactPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { change } = req.body
      const { data } = req.session
      const checkInMobile = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInMobile'])
      const checkInEmail = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInEmail'])
      setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'editCheckInMobile'], checkInMobile)
      setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'editCheckInEmail'], checkInEmail)
      let redirectUrl = `/case/${crn}/appointments/check-in/manage/${id}/edit-contact?change=${change}`
      if (change === 'main') {
        const body: CheckinScheduleRequest = {
          contactPreference: {
            requestedBy: res.locals.user.username,
            contactPreference: getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'preferredComs']),
          },
        }
        const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
        const eSupClient = new ESupervisionClient(token)
        const response = await eSupClient.postUpdateOffenderDetails(id, body)
        if (response?.crn) {
          res.locals.success = true
          setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'settingsUpdated'], true)
        }
        redirectUrl = `/case/${crn}/appointments/check-in/manage/${id}`
        setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'preferredComs'], undefined)
      }
      return res.redirect(redirectUrl)
    }
  },

  getManageEditContactPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const { change } = req.query
      const contactUpdated = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'contactUpdated'])
      if (contactUpdated) {
        res.locals.success = true
        delete req.session?.data?.esupervision?.[crn]?.[id]?.manageCheckin?.contactUpdated
      }
      const checkInMobile = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'editCheckInMobile'])
      const checkInEmail = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'editCheckInEmail'])
      await getCheckinOffenderDetails(hmppsAuthClient)(req, res, () => {})
      return res.render('pages/check-in/manage/manage-edit-contact.njk', {
        crn,
        id,
        case: res.locals?.offenderByCRNResponse?.details,
        change,
        checkInMobile,
        checkInEmail,
      })
    }
  },

  // No MAS personal-details API in this service; the edited contact is persisted to session only.
  postManageEditContactPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const { previousMobile, previousEmail } = req.body
      const editCheckInEmail = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'editCheckInEmail'])
      const editCheckInMobile = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'editCheckInMobile'])
      if (previousMobile?.trim() !== editCheckInMobile?.trim() || previousEmail !== editCheckInEmail) {
        setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'contactUpdated'], true)
        setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInMobile'], editCheckInMobile?.trim())
        setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInEmail'], editCheckInEmail)
      }
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/contact`)
    }
  },

  getRestartCheckinPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const cya = req.query.cya === 'true'
      const checkInMinDate = getMinDate()
      await getCheckinOffenderDetails(hmppsAuthClient)(req, res, () => {})
      const offenderSettings = res.locals?.offenderByCRNResponse
      const defaultsLoaded = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'id'])
      if (!defaultsLoaded) {
        setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'id'], id)
        setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'interval'], offenderSettings?.checkinInterval)
        setDataValue(
          data,
          ['esupervision', crn, id, 'restartCheckin', 'preferredComs'],
          offenderSettings?.contactPreference,
        )
      }
      return res.render('pages/check-in/manage/restart-date-frequency.njk', {
        crn,
        id,
        checkInMinDate,
        case: offenderSettings?.details,
        cya,
      })
    }
  },

  postRestartCheckinPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (req.query?.cya === 'true') {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-summary?cya=true`)
      }
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-contact`)
    }
  },

  getRestartContactPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const { cya } = req.query
      await getCheckinOffenderDetails(hmppsAuthClient)(req, res, () => {})
      const offender = res.locals?.offenderByCRNResponse
      const checkInMobile = offender?.mobile
      const checkInEmail = offender?.email
      const preferredComs = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'preferredComs'])
      setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInMobile'], checkInMobile)
      setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInEmail'], checkInEmail)
      const contactUpdated = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'contactUpdated'])
      if (contactUpdated) {
        res.locals.success = true
        delete req.session?.data?.esupervision?.[crn]?.[id]?.restartCheckin?.contactUpdated
      }
      return res.render('pages/check-in/manage/restart-contact-preference.njk', {
        crn,
        id,
        checkInMobile,
        checkInEmail,
        preferredComs,
        case: offender?.details,
        cya,
      })
    }
  },

  postRestartContactPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { change } = req.body
      const url =
        change === 'main'
          ? `/case/${crn}/appointments/check-in/manage/${id}/restart-summary`
          : `/case/${crn}/appointments/check-in/manage/${id}/restart-edit-contact?change=${change}`
      return res.redirect(url)
    }
  },

  getRestartEditContactPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const { change, cya } = req.query
      const contactUpdated = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'contactUpdated'])
      if (contactUpdated) {
        res.locals.success = true
        delete req.session?.data?.esupervision?.[crn]?.[id]?.restartCheckin?.contactUpdated
      }
      const checkInMobile = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInMobile'])
      const checkInEmail = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInEmail'])
      await getCheckinOffenderDetails(hmppsAuthClient)(req, res, () => {})
      return res.render('pages/check-in/manage/restart-edit-contact.njk', {
        crn,
        id,
        case: res.locals?.offenderByCRNResponse?.details,
        change,
        cya,
        checkInMobile,
        checkInEmail,
      })
    }
  },

  postRestartEditContactPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const { previousMobile, previousEmail } = req.body
      const editCheckInEmail = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInEmail'])
      const editCheckInMobile = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInMobile'])
      if (previousMobile?.trim() !== editCheckInMobile?.trim() || previousEmail !== editCheckInEmail) {
        setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'contactUpdated'], true)
        setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInMobile'], editCheckInMobile?.trim())
        setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInEmail'], editCheckInEmail)
      }
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-contact`)
    }
  },

  getRestartSummaryPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const restartDetails = getDataValue(data, ['esupervision', crn, id, 'restartCheckin']) || {}
      await getCheckinOffenderDetails(hmppsAuthClient)(req, res, () => {})
      const offender = res.locals?.offenderByCRNResponse
      const userDetails = {
        ...restartDetails,
        interval: checkinIntervals.find(i => i.id === restartDetails.interval)?.label,
        preferredComs: restartDetails.preferredComs === 'EMAIL' ? 'Email' : 'Text message',
        checkInMobile: restartDetails.checkInMobile || offender?.mobile || 'No mobile number',
        checkInEmail: restartDetails.checkInEmail || offender?.email || 'No email address',
      }
      return res.render('pages/check-in/manage/restart-checkin-summary.njk', {
        crn,
        id,
        userDetails,
        case: offender?.details,
      })
    }
  },

  postRestartSummaryPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const restartDetails = getDataValue(data, ['esupervision', crn, id, 'restartCheckin'])
      if (!restartDetails) return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-checkin`)
      try {
        const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
        const eSupervisionClient = new ESupervisionClient(token)
        const parsedDate = DateTime.fromFormat(restartDetails.date ?? '', 'd/M/yyyy')
        const formattedDate = parsedDate.isValid ? parsedDate.toISODate() : restartDetails.date
        const body: ReactivateOffenderRequest = {
          requestedBy: res.locals.user.username,
          reason: restartDetails.reason || 'Reactivated via UI',
          checkinSchedule: {
            requestedBy: res.locals.user.username,
            firstCheckin: formattedDate,
            checkinInterval: restartDetails.interval,
          },
          contactPreference: {
            requestedBy: res.locals.user.username,
            contactPreference: restartDetails.preferredComs,
          },
        }
        await eSupervisionClient.postReactivateOffender(id, body)
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-confirmation`)
      } catch (e) {
        logger.error(`Reactivate failed: ${e.message}`)
        return renderError(500)(req, res)
      }
    }
  },

  getRestartConfirmation: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const savedDetails = getDataValue(data, ['esupervision', crn, id, 'restartCheckin'])
      if (!savedDetails) {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}`)
      }
      await getCheckinOffenderDetails(hmppsAuthClient)(req, res, () => {})
      const offender = res.locals?.offenderByCRNResponse
      const userDetails = {
        ...savedDetails,
        interval: checkinIntervals.find(option => option.id === savedDetails.interval)?.label,
        displayCommsOption:
          savedDetails.preferredComs === 'EMAIL' ? savedDetails.checkInEmail : savedDetails.checkInMobile,
        displayDay: dayOfWeek(DateTime.fromFormat(savedDetails.date ?? '', 'd/M/yyyy').toFormat('yyyy-MM-dd')),
      }
      setDataValue(data, ['esupervision', crn, id, 'restartCheckin'], undefined)
      return res.render('pages/check-in/manage/restart-confirmation.njk', {
        crn,
        id,
        case: offender?.details,
        userDetails,
      })
    }
  },
}

export default checkInsController
