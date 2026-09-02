import { randomUUID } from 'crypto'
import { DateTime } from 'luxon'

import { v4 as uuidv4 } from 'uuid'

import {
  CheckinScheduleRequest,
  DeactivateOffenderRequest,
  ESupervisionCheckIn,
  ESupervisionNote,
  ESupervisionReview,
  ReactivateOffenderRequest,
} from '../data/model/esupervision'
import { PersonalDetailsUpdateRequest } from '../data/model/personalDetails'
import renderError from '../middleware/renderError'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import ESupervisionClient from '../data/eSupervisionClient'
import { Controller } from '../@types'
import { CheckinUserDetails } from '../models/Esupervision'
import config from '../config'
import { handleQuotes } from '../utils/handleQuotes'
import getCheckinOffenderDetails from '../middleware/getCheckinOffenderDetails'
import { postCheckInDetails } from '../middleware/postCheckInDetails'
import { postCheckinInComplete } from '../middleware/postCheckinComplete'
import logger from '../../logger'
import { dateWithYear } from '../utils/dateWithYear'
import { dayOfWeek } from '../utils/dayOfWeek'
import parseQuestionTemplate from '../utils/parseQuestionTemplate'
import sendAuditMessage, { SubjectType } from '../middleware/sendAuditMessage'
import { getOffenderEligibility } from '../data/mockAccreditedProgramme'

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

type CheckInRouteName =
  | 'getStartSetup'
  | 'getEligibilityPage'
  | 'postEligibilityPage'
  | 'getInstructionsPage'
  | 'postInstructionsPage'
  | 'getEligibilityDeniedPage'
  | 'postEligibilityDeniedPage'
  | 'getFullEligibilityPage'
  | 'postFullEligibilityPage'
  | 'getSupplementaryEligibilityPage'
  | 'postSupplementaryEligibilityPage'
  | 'getSPOApprovalPage'
  | 'postSPOApprovalPage'
  | 'getAccreditedProgrammeApprovalPage'
  | 'postAccreditedProgrammeApprovalPage'
  | 'getRationalePage'
  | 'postRationalePage'
  | 'getDateFrequencyPage'
  | 'postDateFrequencyPage'
  | 'getContactPreferencePage'
  | 'postContactPreferencePage'
  | 'getConfirmContactPreferencePage'
  | 'postConfirmContactPreferencePage'
  | 'getEditContactPrePage'
  | 'postEditContactPrePage'
  | 'getPhotoOptionsPage'
  | 'postPhotoOptionsPage'
  | 'getTakePhotoPage'
  | 'postTakeAPhotoPage'
  | 'getUploadPhotoPage'
  | 'postUploadaPhotoPage'
  | 'getPhotoRulesPage'
  | 'postPhotoRulesPage'
  | 'getCheckinSummaryPage'
  | 'postCheckinSummaryPage'
  | 'postConfirmEnd'
  | 'getConfirmationPage'
  | 'getManageCheckinPage'
  | 'postManageStopCheckin'
  | 'getStopCheckinPage'
  | 'getReviewIdentityCheckIn'
  | 'postReviewIdentityCheckIn'
  | 'getReviewNotesCheckIn'
  | 'postReviewCheckIn'
  | 'getReviewExpiredCheckIn'
  | 'getUpdateCheckIn'
  | 'getViewCheckIn'
  | 'postViewCheckIn'
  | 'getViewExpiredCheckIn'
  | 'getManageCheckinDatePage'
  | 'postManageCheckinDatePage'
  | 'getManageContactPage'
  | 'postManageContactPage'
  | 'getManageEditContactPage'
  | 'postManageEditContactPage'
  | 'getRestartCheckinPage'
  | 'postRestartCheckinPage'
  | 'getRestartContactPage'
  | 'postRestartContactPage'
  | 'getRestartEditContactPage'
  | 'postRestartEditContactPage'
  | 'getRestartSummaryPage'
  | 'postRestartSummaryPage'
  | 'getRestartConfirmation'
  | 'getStartQuestionsPage'
  | 'postStartQuestionsPage'
  | 'getAddQuestionsPage'
  | 'postAddQuestionsPage'
  | 'getPreviewFeelingPage'
  | 'getPreviewSupportPage'
  | 'getQuestionsListPage'
  | 'postQuestionsListPage'
  | 'getEditQuestionPage'
  | 'postEditQuestionPage'
  | 'getSelectQuestionPage'
  | 'getDeleteQuestion'

const checkInsController: Controller<readonly CheckInRouteName[], void> = {
  // The setup flow keys its session data on a uuid minted here, before the person exists in
  // eSupervision. That uuid becomes the offender_setup uuid on completion.
  getStartSetup: () => {
    return async (req, res) => {
      const { crn } = req.params as Record<string, string>
      if (!isValidCrn(crn)) {
        return renderError(404)(req, res)
      }
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_START_SETUP', crn, SubjectType.CRN)
      const nextStep = config.eligibilityCheckV2Enabled ? 'instructions' : 'eligibility-check'
      return res.redirect(`/case/${crn}/appointments/${randomUUID()}/check-in/${nextStep}`)
    }
  },

  getEligibilityPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_CHECK_IN_ELIGIBILITY', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupervisionClient = new ESupervisionClient(token)
      const practitioner = await eSupervisionClient.getProbationPractitioner(crn)
      if (practitioner?.unallocated) {
        return res.redirect(`/case/${crn}/appointments`)
      }
      return res.render('pages/check-in/eligibility-check.njk', {
        crn,
        id,
        back,
        guidanceUrl: config.guidance.link,
        data: req.session.data,
      })
    }
  },

  postEligibilityPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const eligibility = req.body?.esupervision?.[crn]?.[id]?.checkins?.eligibility
      const selections = Array.isArray(eligibility) ? eligibility : [eligibility]

      // The Intensive Supervision Court pilot rules the person out entirely.
      if (selections.includes('eligibility-9')) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/denied-eligibility`)
      }
      if (selections.includes('eligibility-none')) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/full-eligibility`)
      }
      // Any other criterion means check-ins can only supplement face-to-face contact.
      if (eligibility && eligibility.length > 0) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/supplementary-eligibility`)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
    }
  },

  getInstructionsPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_CHECK_IN_ELIGIBILITY', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupervisionClient = new ESupervisionClient(token)
      const practitioner = await eSupervisionClient.getProbationPractitioner(crn)
      if (practitioner?.unallocated) {
        return res.redirect(`/case/${crn}/appointments`)
      }
      const { accreditedProgramme, tierA, tierB } = await getOffenderEligibility(crn)
      return res.render('pages/check-in/instructions.njk', {
        crn,
        id,
        back,
        guidanceUrl: config.guidance.link,
        data: req.session.data,
        accreditedProgramme,
        tierA,
        tierB,
      })
    }
  },

  postInstructionsPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      req.session.data = req.session.data || {}
      setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'id'], id)
      const { accreditedProgramme } = await getOffenderEligibility(crn)
      setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'accreditedProgramme'], accreditedProgramme)
      if (accreditedProgramme) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/accredited-programme-approval`)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/rationale`)
    }
  },

  getEligibilityDeniedPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_NOT_ELIGIBLE_TO_USE_CHECK_IN', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.render('pages/check-in/eligibility-denied.njk', { crn, id, back })
    }
  },

  postEligibilityDeniedPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.redirect(`/case/${crn}`)
    }
  },

  getFullEligibilityPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ELIGIBLE_TO_USE_CHECK_IN', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.render('pages/check-in/eligibility-full.njk', { crn, id, back, data: req.session.data })
    }
  },

  postFullEligibilityPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      req.session.data = req.session.data || {}
      const { data } = req.session
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'id'], id)
      const eligibilityChoice = getDataValue(data, ['esupervision', crn, id, 'checkins', 'eligibilityChoice'])

      // Replacing face-to-face contact needs SPO sign-off first; supplementing it does not.
      if (eligibilityChoice === 'REPLACE_F2F') {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/spo-approval`)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/rationale`)
    }
  },

  getSupplementaryEligibilityPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_ELIGIBLE_TO_USE_CHECK_IN_AS_EXISTING_F2F_CONTACT',
        crn,
        SubjectType.CRN,
      )
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.render('pages/check-in/eligibility-supplementary.njk', { crn, id, back })
    }
  },

  postSupplementaryEligibilityPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      req.session.data = req.session.data || {}
      const { data } = req.session
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'id'], id)
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'eligibilityChoice'], 'SUPPLEMENT_F2F')
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/rationale`)
    }
  },

  getSPOApprovalPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SPO_APPROVAL_TO_USE_CHECK_INS', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const answer = getDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'eligibilitySPOApproval'])
      const isApproved = answer === 'spo-approval' || (Array.isArray(answer) && answer.includes('spo-approval'))
      return res.render('pages/check-in/spo-approval.njk', { crn, id, back, isApproved })
    }
  },

  postSPOApprovalPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      req.session.data = req.session.data || {}
      const approval = req.body?.esupervision?.[crn]?.[id]?.checkins?.eligibilitySPOApproval
      if (approval) {
        setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'eligibilitySPOApproval'], approval)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/rationale`)
    }
  },

  getAccreditedProgrammeApprovalPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_ACCREDITED_PROGRAMME_APPROVAL_TO_USE_CHECK_INS',
        crn,
        SubjectType.CRN,
      )
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const answer = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'checkins',
        'accreditedProgrammeApproval',
      ])
      const isApproved =
        answer === 'accredited-programme-approval' ||
        (Array.isArray(answer) && answer.includes('accredited-programme-approval'))
      return res.render('pages/check-in/accredited-programme-approval.njk', { crn, id, back, isApproved })
    }
  },

  postAccreditedProgrammeApprovalPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      req.session.data = req.session.data || {}
      const approval = req.body?.esupervision?.[crn]?.[id]?.checkins?.accreditedProgrammeApproval
      if (approval) {
        setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'accreditedProgrammeApproval'], approval)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/rationale`)
    }
  },

  getRationalePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_RATIONALE_TO_USE_CHECK_INS', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const cya = req.query.cya === 'true'
      const eligibility = getDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'eligibility']) || []
      const eligibilityArray = Array.isArray(eligibility) ? eligibility : [eligibility]
      const eligibilityChoice = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'checkins',
        'eligibilityChoice',
      ])

      const accreditedProgramme = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'checkins',
        'accreditedProgramme',
      ])

      // Back needs to retrace whichever eligibility branch got the user here.
      let backLink: string
      if (cya) {
        backLink = `/case/${crn}/appointments/${id}/check-in/checkin-summary`
      } else if (config.eligibilityCheckV2Enabled) {
        backLink = accreditedProgramme
          ? `/case/${crn}/appointments/${id}/check-in/accredited-programme-approval`
          : `/case/${crn}/appointments/${id}/check-in/instructions`
      } else if (eligibilityChoice === 'REPLACE_F2F') {
        backLink = `/case/${crn}/appointments/${id}/check-in/spo-approval`
      } else if (eligibilityArray.includes('eligibility-none')) {
        backLink = `/case/${crn}/appointments/${id}/check-in/full-eligibility`
      } else {
        backLink = `/case/${crn}/appointments/${id}/check-in/supplementary-eligibility`
      }
      return res.render('pages/check-in/rationale.njk', { crn, id, backLink })
    }
  },

  postRationalePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/date-frequency`)
    }
  },

  getDateFrequencyPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SETUP_ONLINE_CHECK_INS', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const cya = req.query.cya === 'true'
      const backLink = cya
        ? `/case/${crn}/appointments/${id}/check-in/checkin-summary`
        : `/case/${crn}/appointments/${id}/check-in/rationale`
      return res.render('pages/check-in/date-frequency.njk', {
        crn,
        id,
        cya,
        backLink,
        checkInMinDate: getMinDate(),
      })
    }
  },

  postDateFrequencyPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/contact-preference`)
    }
  },

  getContactPreferencePage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_CONTACT_PREFERENCES', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      if (req?.session?.errorMessages) {
        res.locals.errorMessages = req.session.errorMessages
        delete req.session.errorMessages
      }
      req.session.data = req.session.data || {}
      const { data } = req.session
      const { cya } = req.query
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupervisionClient = new ESupervisionClient(token)
      const personalDetails = await eSupervisionClient.getPersonalDetails(crn)
      const checkInMobile = personalDetails?.mobile
      const checkInEmail = personalDetails?.email
      // Seed the edit page from the record so it can render without another API call.
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'editCheckInMobile'], checkInMobile)
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'editCheckInEmail'], checkInEmail)

      return res.render('pages/check-in/contact-preference.njk', { crn, id, checkInMobile, checkInEmail, cya })
    }
  },

  postContactPreferencePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>

      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }

      req.session.data = req.session.data || {}
      const { data } = req.session

      const preferredComs = getDataValue(data, ['esupervision', crn, id, 'checkins', 'preferredComs'])
      const checkInMobile = getDataValue(data, ['esupervision', crn, id, 'checkins', 'checkInMobile'])
      const checkInEmail = getDataValue(data, ['esupervision', crn, id, 'checkins', 'checkInEmail'])

      const cya = req.query?.cya === 'true'

      const selectedContactValue = preferredComs === 'PHONE' ? checkInMobile : checkInEmail

      if (!selectedContactValue?.trim()) {
        const change = preferredComs === 'PHONE' ? 'mobile' : 'email'

        return res.redirect(
          `/case/${crn}/appointments/${id}/check-in/edit-contact-preference?change=${change}${cya ? '&cya=true' : ''}`,
        )
      }

      return res.redirect(
        `/case/${crn}/appointments/${id}/check-in/confirm-contact-preference${cya ? '?cya=true' : ''}`,
      )
    }
  },

  getConfirmContactPreferencePage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_CONFIRM_CONTACT_PREFERENCES',
        crn,
        SubjectType.CRN,
      )
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }

      if (req?.session?.errorMessages) {
        res.locals.errorMessages = req.session.errorMessages
        delete req.session.errorMessages
      }

      req.session.data = req.session.data || {}
      const { data } = req.session
      const { cya } = req.query

      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)

      const eSupervisionClient = new ESupervisionClient(token)
      const personalDetails = await eSupervisionClient.getPersonalDetails(crn)

      const checkInMobile = personalDetails?.mobile
      const checkInEmail = personalDetails?.email

      const preferredComs = getDataValue(data, ['esupervision', crn, id, 'checkins', 'preferredComs'])

      const isPhone = preferredComs === 'PHONE'
      const contactPreference = isPhone ? 'mobile number' : 'email address'
      const contactValue = isPhone ? checkInMobile : checkInEmail

      setDataValue(data, ['esupervision', crn, id, 'checkins', 'editCheckInMobile'], checkInMobile)

      setDataValue(data, ['esupervision', crn, id, 'checkins', 'editCheckInEmail'], checkInEmail)

      return res.render('pages/check-in/confirm-contact-preference.njk', {
        crn,
        id,
        checkInMobile,
        checkInEmail,
        preferredComs,
        contactPreference,
        contactValue,
        cya,
      })
    }
  },
  postConfirmContactPreferencePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>

      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }

      req.session.data = req.session.data || {}
      const { data } = req.session

      const checkinsPath = ['esupervision', crn, id, 'checkins']

      const preferredComs = getDataValue(data, [...checkinsPath, 'preferredComs'])
      const confirmPreferredComs = getDataValue(data, [...checkinsPath, 'confirmPreferredComs'])

      const cya = req.query?.cya === 'true'
      const cyaQuery = cya ? '&cya=true' : ''

      if (confirmPreferredComs === 'NO') {
        const change = preferredComs === 'PHONE' ? 'mobile' : 'email'

        return res.redirect(
          `/case/${crn}/appointments/${id}/check-in/edit-contact-preference?change=${change}${cyaQuery}`,
        )
      }

      if (cya) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/checkin-summary`)
      }

      return res.redirect(`/case/${crn}/appointments/${id}/check-in/photo-options`)
    }
  },

  getEditContactPrePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { change, cya } = req.query
      await sendAuditMessage(res, 'EDIT_MANAGE_ONLINE_CHECK_INS_CHECK_IN_CONTACT_PREFERENCE', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      req.session.data = req.session.data || {}
      const { data } = req.session

      const preferredComs = getDataValue(data, ['esupervision', crn, id, 'checkins', 'preferredComs'])
      const contactPreference = preferredComs === 'PHONE' ? 'mobile number' : 'email address'
      const editField = preferredComs === 'PHONE' ? 'editCheckInMobile' : 'editCheckInEmail'
      const existingContactValue = getDataValue(data, ['esupervision', crn, id, 'checkins', editField])
      const hasContactDetails = Boolean(existingContactValue?.trim())
      const previousMobile = getDataValue(data, ['esupervision', crn, id, 'checkins', 'editCheckInMobile'])
      const previousEmail = getDataValue(data, ['esupervision', crn, id, 'checkins', 'editCheckInEmail'])

      const urlBase = `/case/${crn}/appointments/${id}/check-in`
      // Going back to checkin-summary only makes sense once there's a value on file for the
      // newly-selected preference - otherwise checkin-summary's own "can't finish setup without
      // a value" guard immediately bounces back here, making Back look like it does nothing.
      let backLink: string
      if (cya === 'true') {
        backLink = hasContactDetails ? `${urlBase}/checkin-summary` : `${urlBase}/contact-preference?cya=true`
      } else {
        backLink = hasContactDetails ? `${urlBase}/confirm-contact-preference` : `${urlBase}/contact-preference`
      }

      return res.render('pages/check-in/edit-contact-preference.njk', {
        crn,
        id,
        change,
        cya,
        preferredComs,
        contactPreference,
        hasContactDetails,
        previousMobile,
        previousEmail,
        backLink,
      })
    }
  },

  postEditContactPrePage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      req.session.data = req.session.data || {}
      const { data } = req.session
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupervisionClient = new ESupervisionClient(token)
      const practitionerId = res.locals.user.username
      const editCheckInEmail = getDataValue(data, ['esupervision', crn, id, 'checkins', 'editCheckInEmail'])
      const editCheckInMobile = getDataValue(data, ['esupervision', crn, id, 'checkins', 'editCheckInMobile'])
      const nextEmail = editCheckInEmail?.trim()
      const nextMobile = editCheckInMobile?.trim()
      // Carries the value as it was when the page loaded, untouched by autoStoreSessionData, so
      // this reflects what the user actually changed rather than a second, possibly differently
      // formatted, live fetch of the record.
      const { previousMobile, previousEmail } = req.body as { previousMobile?: string; previousEmail?: string }

      const cya = req.query?.cya === 'true'
      const hasChanged =
        (previousMobile?.trim() ?? '') !== (nextMobile ?? '') || (previousEmail?.trim() ?? '') !== (nextEmail ?? '')

      if (hasChanged) {
        const body: PersonalDetailsUpdateRequest = {
          practitionerId,
          email: nextEmail,
          mobile: nextMobile,
        }
        const personalDetails = await eSupervisionClient.updatePersonalDetailsContact(crn, body)
        if (personalDetails?.crn) {
          // checkin-summary reads checkInMobile/checkInEmail directly, and this redirect no
          // longer loops back through contact-preference's GET, which used to be what kept them
          // in sync with the record.
          setDataValue(data, ['esupervision', crn, id, 'checkins', 'checkInMobile'], personalDetails.mobile)
          setDataValue(data, ['esupervision', crn, id, 'checkins', 'checkInEmail'], personalDetails.email)
        }
      }
      // Saving the edit is itself a confirmation that the new value is correct, so the
      // journey can move straight on to photo, whether or not there was a confirm step.
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'confirmPreferredComs'], 'YES')
      if (cya) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/checkin-summary`)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/photo-options`)
    }
  },

  postManageEditContactPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      req.session.data = req.session.data || {}
      const { data } = req.session
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupervisionClient = new ESupervisionClient(token)
      const practitionerId = res.locals.user.username
      const editCheckInEmail = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'editCheckInEmail'])
      const editCheckInMobile = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'editCheckInMobile'])
      const { previousMobile, previousEmail } = req.body as { previousMobile?: string; previousEmail?: string }

      const nextMobile = typeof editCheckInMobile === 'string' ? editCheckInMobile.trim() : undefined
      const nextEmail = typeof editCheckInEmail === 'string' ? editCheckInEmail.trim() : undefined

      if (
        (previousMobile?.trim() ?? '') === (nextMobile ?? '') &&
        (previousEmail?.trim() ?? '') === (nextEmail ?? '')
      ) {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/contact`)
      }

      const body: PersonalDetailsUpdateRequest = {
        practitionerId,
        email: nextEmail,
        mobile: nextMobile,
      }

      const response = await eSupervisionClient.updatePersonalDetailsContact(crn, body)
      if (response?.crn) {
        setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'contactUpdated'], true)
        setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInMobile'], response.mobile)
        setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInEmail'], response.email)
      }
      const redirectUrl = `/case/${crn}/appointments/check-in/manage/${id}/contact`
      return res.redirect(redirectUrl)
    }
  },

  getPhotoOptionsPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_PHOTO_OPTIONS', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const cya = req.query.cya === 'true'
      return res.render('pages/check-in/photo-options.njk', { crn, id, cya })
    }
  },

  postPhotoOptionsPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const photoUploadOption = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'checkins',
        'photoUploadOption',
      ])
      const redirectTo = photoUploadOption === 'TAKE_A_PIC' ? 'take-a-photo' : 'upload-a-photo'
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/${redirectTo}`)
    }
  },

  getTakePhotoPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_TAKE_A_PHOTO', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const cya = req.query.cya === 'true'
      return res.render('pages/check-in/take-a-photo.njk', { crn, id, cya })
    }
  },

  postTakeAPhotoPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { userPhotoUpload } = req.body
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/photo-rules?photoUpload=${userPhotoUpload}`)
    }
  },

  getUploadPhotoPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_UPLOAD_PHOTO', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const cya = req.query.cya === 'true'
      return res.render('pages/check-in/upload-a-photo.njk', { crn, id, cya })
    }
  },

  postUploadaPhotoPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/photo-rules`)
    }
  },

  getPhotoRulesPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_PHOTO_RULES', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const { photoUpload } = req.query
      return res.render('pages/check-in/photo-rules.njk', { crn, id, photoUpload })
    }
  },

  postPhotoRulesPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/checkin-summary`)
    }
  },

  getCheckinSummaryPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_SUMMARY', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const savedUserDetails = getDataValue(req.session.data, ['esupervision', crn, id, 'checkins'])
      // Setup already completed (e.g. the browser back button was used from the confirmation
      // page) - send them to the check-in overview instead of re-showing stale answers.
      if (savedUserDetails?.completed) {
        return res.redirect(
          savedUserDetails.activeId
            ? `/case/${crn}/appointments/check-in/manage/${savedUserDetails.activeId}`
            : `/case/${crn}/appointments/check-in/manage`,
        )
      }
      // A "change" link into edit-contact-preference can be abandoned with the back link
      // before a missing mobile/email is actually entered - re-check here so setup can't be
      // confirmed with no way to reach the person on their chosen contact method.
      if (savedUserDetails?.preferredComs) {
        const selectedContactValue =
          savedUserDetails.preferredComs === 'PHONE' ? savedUserDetails?.checkInMobile : savedUserDetails?.checkInEmail
        if (!selectedContactValue?.trim()) {
          const change = savedUserDetails.preferredComs === 'PHONE' ? 'mobile' : 'email'
          return res.redirect(
            `/case/${crn}/appointments/${id}/check-in/edit-contact-preference?change=${change}&cya=true`,
          )
        }
      }
      const userDetails: CheckinUserDetails = {
        ...savedUserDetails,
        uuid: id,
        interval: checkinIntervals.find(option => option.id === savedUserDetails?.interval)?.label,
        preferredComs: savedUserDetails?.preferredComs === 'EMAIL' ? 'Email' : 'Text message',
        photoUploadOption:
          savedUserDetails?.photoUploadOption === 'TAKE_A_PIC' ? 'Take a photo using this device' : 'Upload a photo',
      }
      return res.render('pages/check-in/checkin-summary.njk', { crn, id, userDetails })
    }
  },

  // Called by assets/js/photo.js, not a form post: registers the setup and hands back a
  // presigned S3 location so the browser can PUT the photo before confirming.
  postCheckinSummaryPage: hmppsAuthClient => {
    return async (req, res) => {
      try {
        const { setup, uploadLocation } = await postCheckInDetails(hmppsAuthClient)(req, res)
        res.json({ status: 'SUCCESS', message: 'Registration complete', setup, uploadLocation })
        logger.info('Check-in registration successful')
      } catch (e) {
        const statusCode = e?.data?.status || 500
        res.status(statusCode).json({ status: 'ERROR', message: e?.data?.userMessage || e?.message || 'Unknown error' })
      }
    }
  },

  // Completes registration, then redirects to the GET confirmation page so a browser back
  // navigation re-fetches rather than re-triggering the completion side effect
  postConfirmEnd: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      await postCheckinInComplete(hmppsAuthClient)(req, res)
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/confirm-end`)
    }
  },

  getConfirmationPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_CONFIRMATION', crn, SubjectType.CRN)
      const savedUserDetails = getDataValue(req.session.data, ['esupervision', crn, id, 'checkins'])
      await getCheckinOffenderDetails(hmppsAuthClient)(req, res, () => {})
      // Completing setup creates the offender record, so the uuid to manage them by is
      // only available once the check-in registration has gone through.
      const activeId = res.locals?.offenderCheckinsByCRNResponse?.uuid
      const userDetails: CheckinUserDetails = {
        ...savedUserDetails,
        uuid: activeId,
        interval: checkinIntervals.find(option => option.id === savedUserDetails?.interval)?.label,
        displayCommsOption:
          savedUserDetails?.preferredComs === 'EMAIL'
            ? savedUserDetails?.checkInEmail
            : savedUserDetails?.checkInMobile,
        displayDay: dayOfWeek(DateTime.fromFormat(savedUserDetails?.date, 'd/M/yyyy').toFormat('yyyy-MM-dd')),
      }
      const checkInDate = DateTime.fromFormat(savedUserDetails?.date, 'd/M/yyyy').startOf('day')
      const isFutureCheckinDate = checkInDate > DateTime.now().startOf('day')

      // Flag the setup as completed so a browser back navigation to checkin-summary redirects
      // to the check-in overview instead of re-showing the now-stale check-your-answers page.
      setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'completed'], true)
      setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'activeId'], activeId)

      return res.render('pages/check-in/confirmation.njk', { crn, id, activeId, userDetails, isFutureCheckinDate })
    }
  },

  getManageCheckinPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_CHECK_IN', crn, SubjectType.CRN)
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)

      const checkinRes = res.locals?.offenderCheckinsByCRNResponse
      if (!checkinRes) {
        return renderError(404)(req, res)
      }

      req.session.data = req.session.data || {}
      const { data } = req.session

      const eSupClient = new ESupervisionClient(token)
      let upcomingCheckin = null
      try {
        const response = await eSupClient.getUpcomingCheckinQuestions(crn)
        upcomingCheckin = response || null
      } catch {
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
        const forename = checkinRes?.details?.name?.forename || 'the person'
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
        email: checkinRes?.details?.email ?? '',
        mobile: checkinRes?.details?.mobile ?? '',
        offenderCheckinsByCRNResponse: checkinRes,
        showChange,
        upcomingCheckin,
        canEditQuestions,
        successMessageHtml,
      })
    }
  },
  getStopCheckinPage: () => {
    return async (req, res) => {
      const { crn } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_STOP_CHECK_IN', crn, SubjectType.CRN)
      const offenderDetails = res.locals.offenderCheckinsByCRNResponse
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
      res.locals.offenderCheckinsByCRNResponse = await eSupervisionClient.postDeactivateOffender(id, body)
      setDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin'], null)

      return res.redirect(303, `/case/${crn}/appointments/check-in/manage/${id}`)
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
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_REVIEW_CHECK_IN_AND_CONFIRM_IDENTITY',
        crn,
        SubjectType.CRN,
      )
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

  getReviewNotesCheckIn: () => {
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
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ONLINE_CHECK_IN_REVIEW_SUBMITTED', crn, SubjectType.CRN)
      return res.render('pages/check-in/review/notes.njk', { crn, id, back, checkIn })
    }
  },

  postReviewCheckIn: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
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
        reviewStartedAt: checkIn?.reviewStartedAt,
        manualIdCheck: checkIn?.manualIdCheck,
        missedCheckinComment: checkIn?.missedCheckinComment,
        notes: reviewNotes,
        riskManagementFeedback: risk,
        sensitive: checkIn?.sensitiveContact === 'true',
      }
      const eSupervisionClient = new ESupervisionClient(token)
      await eSupervisionClient.postOffenderCheckInReview(id, review)
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'sensitiveContact'], null)
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'reviewStartedAt'], null)
      return res.redirect(`${config.managePeopleOnProbation.link}/case/${crn}/activity-log`)
    }
  },

  getReviewExpiredCheckIn: () => {
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
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ONLINE_CHECK_IN_MISSED', crn, SubjectType.CRN)
      return res.render('pages/check-in/review/expired.njk', { crn, id, back, checkIn })
    }
  },

  getViewCheckIn: () => {
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

  getViewExpiredCheckIn: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_MISSED_AND_REVIEWED', crn, SubjectType.CRN)
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
        req.session.data = req.session.data || {}
        const reviewStartedAt = new Date().toISOString()
        setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'reviewStartedAt'], reviewStartedAt)
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

  getManageCheckinDatePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_CHECK_IN_SETTINGS', crn, SubjectType.CRN)

      req.session.data = req.session.data || {}
      const checkInMinDate = getMinDate()
      const checkinRes = res.locals?.offenderCheckinsByCRNResponse
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

  getStartQuestionsPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      const offenderDetails = res.locals.offenderCheckinsByCRNResponse
      if (!offenderDetails) {
        return renderError(404)(req, res)
      }
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ADD_CHECK_IN_QUESTIONS_START', crn, SubjectType.CRN)
      return res.render('pages/check-in/questions/instructions.njk', {
        crn,
        back,
        id,
        data: req.session.data,
        case: offenderDetails.details,
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

  getManageContactPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_CHECK_IN_CONTACT', crn, SubjectType.CRN)
      req.session.data = req.session.data || {}
      const { data } = req.session
      const checkinRes = res.locals?.offenderCheckinsByCRNResponse
      const checkInMobile =
        getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInMobile']) ?? checkinRes?.details?.mobile
      const checkInEmail =
        getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInEmail']) ?? checkinRes?.details?.email
      const contactUpdated = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'contactUpdated'])
      if (contactUpdated) {
        res.locals.success = true
        delete req.session?.data?.esupervision?.[crn]?.[id]?.manageCheckin?.contactUpdated
      }
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
      const checkinRes = res.locals?.offenderCheckinsByCRNResponse
      const checkInMobile =
        getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInMobile']) ?? checkinRes?.details?.mobile
      const checkInEmail =
        getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'checkInEmail']) ?? checkinRes?.details?.email
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

  getManageEditContactPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'EDIT_MANAGE_ONLINE_CHECK_INS_MANAGE_CHECK_IN_CONTACT', crn, SubjectType.CRN)
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
      return res.render('pages/check-in/manage/manage-edit-contact.njk', {
        crn,
        id,
        case: res.locals?.offenderCheckinsByCRNResponse?.details,
        change,
        checkInMobile,
        checkInEmail,
      })
    }
  },

  getRestartCheckinPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_WHEN_TO_COMPLETE_ONLINE_CHECK_IN',
        crn,
        SubjectType.CRN,
      )
      req.session.data = req.session.data || {}
      const { data } = req.session
      const cya = req.query.cya === 'true'
      const checkInMinDate = getMinDate()

      const defaultsLoaded = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'id'])
      if (!defaultsLoaded) {
        const offenderSettings = res.locals.offenderCheckinsByCRNResponse

        setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'id'], id)
        setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'interval'], offenderSettings.checkinInterval)
        setDataValue(
          data,
          ['esupervision', crn, id, 'restartCheckin', 'preferredComs'],
          offenderSettings.contactPreference,
        )
      }

      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupervisionClient = new ESupervisionClient(token)
      const personalDetails = await eSupervisionClient.getPersonalDetails(crn)

      if (!personalDetails) {
        return renderError(404)(req, res)
      }
      return res.render('pages/check-in/manage/restart-date-frequency.njk', {
        crn,
        id,
        checkInMinDate,
        case: personalDetails,
        cya,
      })
    }
  },

  postRestartCheckinPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const cyaQuery = req.query?.cya === 'true' ? '?cya=true' : ''
      if (req.query?.cya === 'true') {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-summary${cyaQuery}`)
      }
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-contact`)
    }
  },

  getRestartContactPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_RESTART_ONLINE_CHECK_IN', crn, SubjectType.CRN)
      if (req?.session?.errorMessages) {
        res.locals.errorMessages = req.session.errorMessages
        delete req?.session?.errorMessages
      }
      req.session.data = req.session.data || {}
      const { data } = req.session
      const { cya } = req.query
      // The restart flow only runs for an offender that already exists, so its live contact
      // details (kept up to date by updatePersonalDetailsContact) come from the full offender
      // record already fetched by getCheckinOffenderDetails - the personal-details endpoint is
      // for the pre-setup flow and doesn't reflect edits made after registration.
      const offenderDetails = res.locals.offenderCheckinsByCRNResponse?.details
      const checkInMobile = offenderDetails?.mobile ?? ''
      const checkInEmail = offenderDetails?.email ?? ''

      const preferredComs = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'preferredComs'])
      // if page not submitted, required to save in session for change link /edit page to avoid API call.
      setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInMobile'], checkInMobile)
      setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInEmail'], checkInEmail)

      // To show success message on edit contact preference page
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
        case: offenderDetails,
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

  getRestartEditContactPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'EDIT_MANAGE_ONLINE_CHECK_INS_MANAGE_RESTART_ONLINE_CHECK_IN', crn, SubjectType.CRN)
      req.session.data = req.session.data || {}
      const { change, cya } = req.query
      // To show success message on edit contact preference page
      const contactUpdated = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'restartCheckin',
        'contactUpdated',
      ])
      if (contactUpdated) {
        res.locals.success = true
        delete req.session?.data?.esupervision?.[crn]?.[id]?.restartCheckin?.contactUpdated
      }
      const checkInMobile = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'restartCheckin',
        'editCheckInMobile',
      ])
      const checkInEmail = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'restartCheckin',
        'editCheckInEmail',
      ])
      return res.render('pages/check-in/manage/restart-edit-contact.njk', {
        crn,
        id,
        case: res.locals?.offenderCheckinsByCRNResponse?.details,
        change,
        cya,
        checkInMobile,
        checkInEmail,
      })
    }
  },

  postRestartEditContactPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const { previousMobile, previousEmail } = req.body
      const editCheckInEmail = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInEmail'])
      const editCheckInMobile = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'editCheckInMobile'])
      if (previousMobile?.trim() !== editCheckInMobile?.trim() || previousEmail !== editCheckInEmail) {
        const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
        const eSupervisionClient = new ESupervisionClient(token)
        const practitionerId = res.locals.user.username
        const body: PersonalDetailsUpdateRequest = {
          practitionerId,
          email: editCheckInEmail,
          mobile: editCheckInMobile?.trim(),
        }
        const personalDetails = await eSupervisionClient.updatePersonalDetailsContact(crn, body)
        // If personal details overview exists in session cache, update it with latest values
        if (req.session.data?.personalDetails?.[crn]?.overview) {
          req.session.data.personalDetails[crn].overview = personalDetails
        }
        // Save to show success message on contact preferences page
        if (personalDetails?.crn) {
          setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'contactUpdated'], true)
          setDataValue(
            req.session.data,
            ['esupervision', crn, id, 'restartCheckin', 'editCheckInMobile'],
            editCheckInMobile?.trim(),
          )
          setDataValue(
            req.session.data,
            ['esupervision', crn, id, 'restartCheckin', 'editCheckInEmail'],
            editCheckInEmail,
          )
          // checkInMobile/checkInEmail (read by the restart summary and confirmation pages) are
          // separate from editCheckInMobile/editCheckInEmail and must be kept in sync here too.
          setDataValue(
            req.session.data,
            ['esupervision', crn, id, 'restartCheckin', 'checkInMobile'],
            editCheckInMobile?.trim(),
          )
          setDataValue(req.session.data, ['esupervision', crn, id, 'restartCheckin', 'checkInEmail'], editCheckInEmail)
        }
      }
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-contact`)
    }
  },

  getRestartSummaryPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_RESTART_ONLINE_CHECK_IN_SUMMARY',
        crn,
        SubjectType.CRN,
      )
      const { data } = req.session
      const restartDetails = getDataValue(data, ['esupervision', crn, id, 'restartCheckin'])
      if (!restartDetails) return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-checkin`)
      // See getRestartContactPage: use the live offender record already fetched by
      // getCheckinOffenderDetails rather than the pre-setup personal-details endpoint.
      const caseData = res.locals.offenderCheckinsByCRNResponse?.details

      const userDetails = {
        ...restartDetails,
        interval: checkinIntervals.find(i => i.id === restartDetails.interval)?.label,
        preferredComs: restartDetails.preferredComs === 'EMAIL' ? 'Email' : 'Text message',
        checkInMobile: restartDetails.checkInMobile || caseData?.mobile || 'No mobile number',
        checkInEmail: restartDetails.checkInEmail || caseData?.email || 'No email address',
      }
      return res.render('pages/check-in/manage/restart-checkin-summary.njk', {
        crn,
        id,
        userDetails,
        case: caseData,
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

  getRestartConfirmation: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_RESTART_ONLINE_CHECK_IN_CONFIRMATION',
        crn,
        SubjectType.CRN,
      )
      req.session.data = req.session.data || {}
      const { data } = req.session

      const savedDetails = getDataValue(data, ['esupervision', crn, id, 'restartCheckin'])

      if (!savedDetails) {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}`)
      }

      // See getRestartContactPage: use the live offender record already fetched by
      // getCheckinOffenderDetails rather than the pre-setup personal-details endpoint.
      const caseData = res.locals.offenderCheckinsByCRNResponse?.details

      const userDetails = {
        ...savedDetails,
        interval: checkinIntervals.find(option => option.id === savedDetails.interval)?.label,
        displayCommsOption:
          savedDetails.preferredComs === 'EMAIL' ? savedDetails.checkInEmail : savedDetails.checkInMobile,
        displayDay: dayOfWeek(DateTime.fromFormat(savedDetails.date, 'd/M/yyyy').toFormat('yyyy-MM-dd')),
      }
      setDataValue(data, ['esupervision', crn, id, 'restartCheckin'], undefined)
      return res.render('pages/check-in/manage/restart-confirmation.njk', {
        crn,
        id,
        case: caseData,
        userDetails,
      })
    }
  },

  postStartQuestionsPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
    }
  },

  getAddQuestionsPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_ADD_QUESTIONS', crn, SubjectType.CRN)
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const offenderDetails = res.locals.offenderCheckinsByCRNResponse

      if (!offenderDetails) {
        return renderError(404)(req, res)
      }

      req.session.data = req.session.data ?? {}
      const { data } = req.session

      let availableTemplates =
        getDataValue(data, ['esupervision', crn, id, 'manageQuestions', 'availableTemplates']) || []
      if (availableTemplates.length === 0) {
        const eSupClient = new ESupervisionClient(token)
        const templatesList = await eSupClient.getQuestionsTemplates('en-GB')
        const customisableTemplates = templatesList.templates.filter(
          (t: any) => t.policy$hmpps_esupervision_api === 'CUSTOMISABLE',
        )
        availableTemplates = customisableTemplates
        setDataValue(data, ['esupervision', crn, id, 'manageQuestions', 'availableTemplates'], availableTemplates)
      }

      let questionTemplateAndInputs = getDataValue(data, [
        'esupervision',
        crn,
        id,
        'manageQuestions',
        'questionTemplateAndInputs',
      ])
      let expectedCheckinDate = getDataValue(data, ['esupervision', crn, id, 'manageQuestions', 'expectedCheckinDate'])
      // Fetch current check in questions if they have already been submitted
      if (!questionTemplateAndInputs) {
        questionTemplateAndInputs = {}
        try {
          const eSupClient = new ESupervisionClient(token)
          const response = await eSupClient.getUpcomingCheckinQuestionItems(crn, 'en-GB')
          expectedCheckinDate = response?.upcoming?.expectedCheckinDate
          const items = response?.upcoming?.items || []

          items.forEach((item: any) => {
            const isCustomisable = availableTemplates.some((t: any) => String(t.id) === String(item.template.id))
            if (isCustomisable) {
              const draftId = `${item.template.id}-${uuidv4()}`
              const inputValue = Object.values(item.params?.placeholders || {})[0] || ''
              questionTemplateAndInputs[draftId] = inputValue
            }
          })
        } catch (error: any) {
          const status = error?.status || error?.response?.status
          const isInactiveOffender = status === 422 && error?.data?.developerMessage === 'Offender status is INACTIVE'
          if (status === 404 || isInactiveOffender) {
            logger.info(`No upcoming questions found for CRN ${crn}.`)
          } else {
            logger.error(`Failed to fetch upcoming questions for CRN ${crn}:`, error)
            return renderError(status || 500)(req, res)
          }
        }
        setDataValue(
          data,
          ['esupervision', crn, id, 'manageQuestions', 'questionTemplateAndInputs'],
          questionTemplateAndInputs,
        )
        setDataValue(data, ['esupervision', crn, id, 'manageQuestions', 'expectedCheckinDate'], expectedCheckinDate)
      }

      const addedQuestions = Object.entries(questionTemplateAndInputs)
        .map(([qId, inputValue]) => {
          if (!inputValue || typeof inputValue !== 'string' || inputValue.trim() === '') return null
          const templateId = parseInt(qId.split('-')[0], 10)

          const templateData = parseQuestionTemplate(availableTemplates, templateId)

          if (!templateData) return null

          return {
            id: qId,
            fullText: `${templateData.prefix}${inputValue}${templateData.suffix}`.replace(/\s+/g, ' ').trim(),
          }
        })
        .filter(q => q !== null)

      return res.render('pages/check-in/questions/add-questions.njk', {
        crn,
        id,
        back,
        case: offenderDetails.details,
        addedQuestions,
        data,
        expectedCheckinDate,
      })
    }
  },

  postAddQuestionsPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const manageQuestionsSession = getDataValue(req.session.data, ['esupervision', crn, id, 'manageQuestions']) || {}
      const questionTemplateAndInputs = manageQuestionsSession.questionTemplateAndInputs || {}
      const availableTemplates = manageQuestionsSession.availableTemplates || []
      const formattedQuestions = Object.entries(questionTemplateAndInputs).map(([draftId, inputValue]) => {
        const templateId = parseInt(draftId.split('-')[0], 10)
        const originalTemplate = availableTemplates.find((t: any) => String(t.id) === String(templateId))

        return {
          id: templateId,
          params: {
            placeholders: {
              [originalTemplate?.responseSpec?.placeholders?.[0] || 'text']: inputValue as string,
            },
            responseFormat: originalTemplate?.responseFormat || 'TEXT',
          },
        }
      })

      try {
        const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
        const eSupClient = new ESupervisionClient(token)

        if (formattedQuestions.length === 0) {
          await eSupClient.deleteAssignedQuestionsFromCheckIn(crn)
          setDataValue(req.session.data, ['esupervision', crn, id, 'questionsAdded'], false)
        } else {
          await eSupClient.putAssignQuestionsToCheckIn(crn, {
            questions: formattedQuestions,
            language: 'en-GB',
            author: res.locals.user.username,
          })
          setDataValue(req.session.data, ['esupervision', crn, id, 'questionsAdded'], true)
        }

        setDataValue(req.session.data, ['esupervision', crn, id, 'manageQuestions'], undefined)
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}`)
      } catch (error: any) {
        logger.error(`Failed to assign/delete questions for CRN ${crn}:`, error)
        return renderError(error?.status || 500)(req, res)
      }
    }
  },

  getPreviewFeelingPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_PREVIEW_FEELING_CHECK_IN_QUESTIONS',
        crn,
        SubjectType.CRN,
      )
      return res.render('pages/check-in/questions/preview/feeling.njk', {
        crn,
        back,
        id,
        data: req.session.data,
      })
    }
  },
  getPreviewSupportPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_PREVIEW_SUPPORT_CHECK_IN_QUESTIONS',
        crn,
        SubjectType.CRN,
      )
      return res.render('pages/check-in/questions/preview/support.njk', {
        crn,
        back,
        id,
        data: req.session.data,
      })
    }
  },

  getQuestionsListPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_LIST_CHECK_IN_LIST_QUESTIONS', crn, SubjectType.CRN)
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupClient = new ESupervisionClient(token)

      const offenderDetails = res.locals.offenderCheckinsByCRNResponse

      if (!offenderDetails) {
        return renderError(404)(req, res)
      }

      const templatesList = await eSupClient.getQuestionsTemplates('en-GB')
      const customisableTemplates = templatesList.templates.filter(
        (t: any) => t.policy$hmpps_esupervision_api === 'CUSTOMISABLE',
      )
      const availableTemplates = customisableTemplates

      setDataValue(
        req.session.data,
        ['esupervision', crn, id, 'manageQuestions', 'availableTemplates'],
        availableTemplates,
      )
      // redirect if questions >= 3
      const questionTemplateAndInputs =
        getDataValue(req.session.data, ['esupervision', crn, id, 'manageQuestions', 'questionTemplateAndInputs']) || {}
      if (Object.keys(questionTemplateAndInputs).length >= 3) {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      }
      // replace curly braces placeholder with [insert text] for presentation
      const displayTemplates = templatesList.templates.map((q: any) => {
        const start = q.template.indexOf('{{')
        const end = q.template.indexOf('}}', start)

        let displayTemplate = q.template
        if (start !== -1 && end !== -1) {
          displayTemplate = `${q.template.substring(0, start)}[insert text]${q.template.substring(end + 2)}`
        }

        return {
          ...q,
          displayTemplate,
        }
      })
      return res.render('pages/check-in/questions/list-questions.njk', {
        crn,
        id,
        back,
        case: offenderDetails.details,
        templatesList: { templates: displayTemplates },
        data: req.session.data,
      })
    }
  },

  postQuestionsListPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
    }
  },

  getEditQuestionPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id, questionId } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ADD_CHECK_IN_QUESTIONS_EDIT', crn, SubjectType.CRN)
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const offenderDetails = res.locals.offenderCheckinsByCRNResponse

      if (!offenderDetails) {
        return renderError(404)(req, res)
      }

      let availableTemplates =
        getDataValue(req.session.data, ['esupervision', crn, id, 'manageQuestions', 'availableTemplates']) || []

      if (availableTemplates.length === 0) {
        const eSupClient = new ESupervisionClient(token)
        const templatesList = await eSupClient.getQuestionsTemplates('en-GB')
        const customisableTemplates = templatesList.templates.filter(
          (t: any) => t.policy$hmpps_esupervision_api === 'CUSTOMISABLE',
        )
        availableTemplates = customisableTemplates
        setDataValue(
          req.session.data,
          ['esupervision', crn, id, 'manageQuestions', 'availableTemplates'],
          availableTemplates,
        )
      }

      const templateId = questionId.split('-')[0]
      const questionForView = parseQuestionTemplate(availableTemplates, templateId)

      if (!questionForView) return renderError(404)(req, res)

      return res.render('pages/check-in/questions/edit-question.njk', {
        crn,
        id,
        questionId,
        back,
        case: offenderDetails.details,
        question: questionForView,
        data: req.session.data,
      })
    }
  },

  postEditQuestionPage: () => {
    return async (req, res) => {
      const { crn, id, questionId } = req.params as Record<string, string>
      req.session.data = req.session.data ?? {}
      const { data } = req.session

      const inputValue = req.body?.esupervision?.[crn]?.[id]?.manageQuestions?.draftQuestionInput

      if (inputValue && inputValue.trim() !== '') {
        setDataValue(
          data,
          ['esupervision', crn, id, 'manageQuestions', 'questionTemplateAndInputs', questionId],
          inputValue.trim(),
        )

        if (data.esupervision?.[crn]?.[id]?.manageQuestions?.draftQuestionInput !== undefined) {
          delete data.esupervision[crn][id].manageQuestions.draftQuestionInput
        }
      }

      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
    }
  },

  getSelectQuestionPage: () => {
    return async (req, res) => {
      const { crn, id, templateId } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ADD_CHECK_IN_QUESTIONS_SELECT', crn, SubjectType.CRN)
      const questionTemplateAndInputs =
        getDataValue(req.session.data, ['esupervision', crn, id, 'manageQuestions', 'questionTemplateAndInputs']) || {}

      if (Object.keys(questionTemplateAndInputs).length >= 3) {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      }

      const draftId = `${templateId}-${uuidv4()}`
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/questions/${draftId}/edit`)
    }
  },

  getDeleteQuestion: () => {
    return async (req, res) => {
      const { crn, id, questionId } = req.params as Record<string, string>
      req.session.data = req.session.data ?? {}
      const { data } = req.session
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ADD_CHECK_IN_QUESTIONS_DELETE', crn, SubjectType.CRN)
      if (data.esupervision?.[crn]?.[id]?.manageQuestions?.questionTemplateAndInputs?.[questionId]) {
        delete data.esupervision[crn][id].manageQuestions.questionTemplateAndInputs[questionId]
      }

      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
    }
  },
}

export default checkInsController
