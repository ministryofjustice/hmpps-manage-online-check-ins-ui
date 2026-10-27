import { randomUUID } from 'crypto'
import { DateTime } from 'luxon'
import { Request, Response } from 'express'

import { v4 as uuidv4 } from 'uuid'

import {
  CheckinScheduleRequest,
  DeactivateOffenderRequest,
  ESupervisionCheckIn,
  ESupervisionNote,
  ESupervisionReview,
  OffenderByCRNResponse,
  ReactivateOffenderRequest,
  ScheduleAdHocCheckinRequest,
  SupervisionPackageStatus,
} from '../data/model/esupervision'
import { PersonalDetailsUpdateRequest, ProbationPractitioner } from '../data/model/personalDetails'
import renderError from '../middleware/renderError'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import ESupervisionClient from '../data/eSupervisionClient'
import HmppsAuthClient from '../data/hmppsAuthClient'
import { Controller } from '../@types'
import { CheckinUserDetails } from '../models/Esupervision'
import config from '../config'
import { handleQuotes } from '../utils/handleQuotes'
import getCheckinOffenderDetails from '../middleware/getCheckinOffenderDetails'
import { postCheckInDetails } from '../middleware/postCheckInDetails'
import { postCheckinInComplete } from '../middleware/postCheckinComplete'
import logger from '../../logger'
import { dateWithYear, dateToLongDate } from '../utils/dateWithYear'
import { dayOfWeek } from '../utils/dayOfWeek'
import parseQuestionTemplate from '../utils/parseQuestionTemplate'
import safeBackUrl from '../utils/safeBackUrl'
import sendAuditMessage, { SubjectType } from '../middleware/sendAuditMessage'
import { CheckinFrequency, fromApiSchedule, nextScheduledDay, toApiSchedule } from '../utils/checkinSchedule'
import getTierBand, { MISSING_TIER, NOT_SUPERVISED_TIER, TierBand, TierStatus } from '../utils/getTierBand'
import {
  eligibilityViews,
  hasCompletedDiscussion,
  missingTierReason,
  nextAfterEligibilityCheck,
  nextAfterPilotCheck,
  notSupervisedReason,
  provisionalTierReason,
  toSelections,
} from '../utils/eligibilityRules'

const checkinIntervals: { id: string; label: string }[] = [
  { id: 'WEEKLY', label: 'Every week' },
  { id: 'TWO_WEEKS', label: 'Every 2 weeks' },
  { id: 'FOUR_WEEKS', label: 'Every 4 weeks' },
  { id: 'EIGHT_WEEKS', label: 'Every 8 weeks' },
  { id: 'AD_HOC', label: "I'll schedule them one at a time" },
]

// getPersonalDetails middleware already fetches practitioner details when the new header flag is
// on, so reuse res.locals.practitioner instead of making the same request again here.
const getAllocationPractitioner = async (
  hmppsAuthClient: HmppsAuthClient,
  res: Response,
  crn: string,
): Promise<ProbationPractitioner | null> => {
  if (res.locals.flags?.newDesignPopHeader) {
    return (res.locals.practitioner as ProbationPractitioner | null) ?? null
  }
  const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
  const eSupervisionClient = new ESupervisionClient(token)
  return eSupervisionClient.getProbationPractitioner(crn)
}

// moj date-picker minDate workaround (https://github.com/ministryofjustice/moj-frontend/issues/923)
const getMinDate = (daysAhead = 0): string => {
  const day = DateTime.now().plus({ days: daysAhead })
  return day.day > 9 ? day.toFormat('dd/M/yyyy') : day.toFormat('d/M/yyyy')
}

// A check-your-answers page reached with a scheduled interval but no date can only mean the
// practitioner changed an ad-hoc answer to an interval and then backed out of the date page: an
// interval chosen first always collects its date before the summary is reachable. Their original
// answer is restored, so the summary shows the answers that will actually be submitted.
const revertAbandonedIntervalChange = (req: Request, crn: string, id: string, group: 'checkins' | 'restartCheckin') => {
  const interval = getDataValue(req.session.data, ['esupervision', crn, id, group, 'interval'])
  const date = getDataValue(req.session.data, ['esupervision', crn, id, group, 'date'])
  if (interval && interval !== 'AD_HOC' && !date) {
    setDataValue(req.session.data, ['esupervision', crn, id, group, 'interval'], 'AD_HOC')
    return 'AD_HOC'
  }
  return interval
}

// Submits a change of check-in settings from the manage flow. Shared by the frequency page, which
// submits every change except a move from ad-hoc to a scheduled interval, and the date page, which
// collects the first check-in date that move needs before submitting.
const submitCheckinSettings = async (
  hmppsAuthClient: HmppsAuthClient,
  req: Request,
  res: Response,
  frequency: CheckinFrequency,
  firstCheckin?: string,
) => {
  const { crn, id } = req.params as Record<string, string>
  req.session.data = req.session.data || {}
  const { data } = req.session
  const body: CheckinScheduleRequest = {
    checkinSchedule: {
      requestedBy: res.locals.user.username,
      // An ad-hoc person has no schedule: the practitioner books their check ins one at a time.
      ...(frequency === 'AD_HOC' ? {} : { firstCheckin }),
      ...toApiSchedule(frequency),
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

// The next day a person's saved schedule falls on, for when nothing is booked. A scheduled person's
// saved first date is where their schedule started, which may be long past: the schedule repeats
// from it every interval, so their next check in is its first repeat after today. Today itself is
// skipped: with nothing upcoming, a check in due today has already been dealt with. An ad-hoc
// person has no schedule, only bookings, so their saved date is never a next check in.
const nextDayOfSavedSchedule = (record?: OffenderByCRNResponse | null): string | undefined => {
  if (fromApiSchedule(record) === 'AD_HOC') return undefined
  return nextScheduledDay(record?.firstCheckin, record?.checkinInterval, DateTime.now().plus({ days: 1 }))
}

// The date a scheduled person's next check in falls on, which a change of interval keeps: the API
// treats firstCheckin as the date the (new) schedule runs from, and rejects a date in the past.
// Taken from the upcoming check in, else worked out from the saved schedule, the same way the
// manage card shows it. Returns undefined only when the record has no usable schedule, so the
// caller can ask for a date.
const nextScheduledCheckinDate = async (
  hmppsAuthClient: HmppsAuthClient,
  res: Response,
  crn: string,
): Promise<string | undefined> => {
  try {
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const upcoming = await new ESupervisionClient(token).getUpcomingCheckinQuestions(crn)
    // The upcoming check in may carry a time; the update API takes a date only. One due today is
    // active, and is kept: the new schedule runs from it.
    const upcomingDate = DateTime.fromISO(upcoming?.expectedCheckinDate ?? '')
    if (upcomingDate.isValid && upcomingDate.startOf('day') >= DateTime.now().startOf('day')) {
      return upcomingDate.toISODate()
    }
  } catch (error: any) {
    // The API answers 404 when no check in is booked, which is a normal state to fall back from.
    // Anything else is an outage: guessing the schedule from the saved date could move the person's
    // check ins, so let the error page show instead.
    const status = error?.status || error?.response?.status
    if (status !== 404) {
      logger.error(`Failed to fetch the upcoming check in for CRN ${crn}:`, error)
      throw error
    }
    logger.info(`No upcoming check in found for CRN ${crn}; working from the saved schedule instead`)
  }
  return nextDayOfSavedSchedule(res.locals.offenderCheckinsByCRNResponse)
}

// An ad-hoc person's booking, if any. Booking again is how a booked check in is moved, but once it
// is active (due today) the API refuses any change, so the schedule page has nothing to offer.
type AdHocBooking = { state: 'none' } | { state: 'active' } | { state: 'booked'; date: string }
const adHocBooking = async (hmppsAuthClient: HmppsAuthClient, res: Response, crn: string): Promise<AdHocBooking> => {
  const date = await nextScheduledCheckinDate(hmppsAuthClient, res, crn)
  if (!date) return { state: 'none' }
  const isStillToCome = DateTime.fromISO(date).startOf('day') > DateTime.now().startOf('day')
  return isStillToCome ? { state: 'booked', date } : { state: 'active' }
}

// Records why the person is not eligible for not-eligible.njk to render, keyed the same way the
// eligibility rules record theirs.
function setNotEligibleReason(req: Request, crn: string, id: string, reason: string): void {
  req.session.data = req.session.data || {}
  setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'notEligibleReason'], reason)
  setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'notEligibleReasonBullets'], [])
  setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'additionalTierInformation'], false)
}

// The tier statuses that are not bands at all, each ruling the person out on its own. A missing tier
// is what the header returns as an empty score too, since getPersonalDetails coerces 404s and 500s
// to one.
const tierStatusReasons: Record<typeof MISSING_TIER | typeof NOT_SUPERVISED_TIER, string> = {
  [MISSING_TIER]: missingTierReason,
  [NOT_SUPERVISED_TIER]: notSupervisedReason,
}

// Every eligibility rule keys off the tier, so each page needs a band before it can do anything.
// This resolves one or answers the request itself, returning null once it has, so every outcome is
// handled the same way everywhere. The statuses above are facts about the person, so they are ruled
// out with a reason the practitioner can act on, as is a tier the header reports as provisional; a
// score we cannot read at all is unexpected data, and guessing a band would apply the wrong rules,
// so that stays a 500.
function requireBand(req: Request, res: Response, crn: string, id: string): TierBand | null {
  const status: TierStatus | null = getTierBand(res.locals.tierScore as string)
  const ruleOut = (reason: string): null => {
    setNotEligibleReason(req, crn, id, reason)
    res.redirect(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    return null
  }
  if (status === MISSING_TIER || status === NOT_SUPERVISED_TIER) {
    return ruleOut(tierStatusReasons[status])
  }
  // Checked after the statuses above, which are the more basic facts: a person who is no longer
  // supervised, or has no score at all, has no tier for this flag to qualify. A provisional score is
  // otherwise readable, so this still comes ahead of the unreadable-score error below.
  if (res.locals.tierProvisional === true) {
    return ruleOut(provisionalTierReason)
  }
  if (!status) {
    renderError(500)(req, res)
    return null
  }
  return status
}

// The three facts the ESUP supervision-package call supplies, in place of the checkboxes that used to
// ask the practitioner for them. getSupervisionPackageStatus leaves res.locals null on a 404, and an
// older API build may not send every field, so each is read as a definite boolean - an unknown fact
// must not read as true and rule a person out.
function getSupervisionPackageStatus(res: Response): SupervisionPackageStatus {
  const status = res.locals.supervisionPackageStatus
  return {
    onSupervisionPackage: Boolean(status?.onSupervisionPackage),
    inFinalThird: Boolean(status?.inFinalThird),
    inEarlyEngagement: Boolean(status?.inEarlyEngagement),
  }
}

// Stored beside checkins because it comes from ESUP, not the submitted wizard form. The access guard
// re-derives the outcome from it on later pages, where the response is no longer on res.locals.
function storeSupervisionPackageStatus(req: Request, crn: string, id: string, status: SupervisionPackageStatus): void {
  setDataValue(req.session.data, ['esupervision', crn, id, 'supervisionPackageStatus'], status)
}

export function systemIdCheckPass(checkIn: ESupervisionCheckIn): boolean {
  if (checkIn.livenessEnabled) {
    return checkIn.livenessResult === 'LIVE' && checkIn.autoIdCheck === 'MATCH'
  }
  return checkIn.autoIdCheck === 'MATCH'
}

const normalizeQuestionPlaceholder = (input: string, suffix: string): string => {
  const trimmedInput = input.trim()
  const trimmedSuffix = suffix.trim()
  if (trimmedSuffix && trimmedInput.endsWith(trimmedSuffix)) {
    return trimmedInput.slice(0, -trimmedSuffix.length).trimEnd()
  }
  return trimmedInput.endsWith('?') && trimmedSuffix.endsWith('?') ? trimmedInput.slice(0, -1).trimEnd() : trimmedInput
}

const buildQuestionText = (prefix: string, input: string, suffix: string) => {
  const normalizedInput = normalizeQuestionPlaceholder(input, suffix)
  return `${prefix}${normalizedInput}${suffix}`.replace(/\s+/g, ' ').trim()
}

type CheckInRouteName =
  | 'getStartSetup'
  | 'getEligibilityPage'
  | 'postEligibilityPage'
  | 'getInstructionsPage'
  | 'postInstructionsPage'
  | 'getPilotCheckPage'
  | 'postPilotCheckPage'
  | 'getIsEligiblePage'
  | 'postIsEligiblePage'
  | 'getNotEligiblePage'
  | 'postNotEligiblePage'
  | 'getDiscussBeforeSignupPage'
  | 'postDiscussBeforeSignupPage'
  | 'getAccreditedProgrammeApprovalPage'
  | 'postAccreditedProgrammeApprovalPage'
  | 'getRationalePage'
  | 'postRationalePage'
  | 'getFrequencyPage'
  | 'postFrequencyPage'
  | 'getDatePage'
  | 'postDatePage'
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
  | 'getSettingsFrequencyPage'
  | 'postSettingsFrequencyPage'
  | 'getSettingsDatePage'
  | 'postSettingsDatePage'
  | 'getManageContactPage'
  | 'postManageContactPage'
  | 'getManageEditContactPage'
  | 'postManageEditContactPage'
  | 'getRestartCheckinPage'
  | 'postRestartCheckinPage'
  | 'getRestartCheckinDatePage'
  | 'postRestartCheckinDatePage'
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
  | 'getScheduleCheckInDate'
  | 'postScheduleCheckInDate'
  | 'getScheduleCheckInAddQuestions'
  | 'postScheduleCheckInAddQuestions'
  | 'getScheduleCheckInQuestionsList'
  | 'postScheduleCheckInQuestionsList'
  | 'getScheduleCheckInEditQuestion'
  | 'postScheduleCheckInEditQuestion'
  | 'getScheduleCheckInSelectQuestion'
  | 'getScheduleCheckInDeleteQuestion'
  | 'getScheduleCheckInPreviewFeeling'
  | 'getScheduleCheckInPreviewSupport'

const checkInsController: Controller<readonly CheckInRouteName[], void> = {
  // The setup flow keys its session data on a uuid minted here, before the person exists in
  // eSupervision. That uuid becomes the offender_setup uuid on completion. The start time is
  // recorded here too, so the API can measure how long the whole setup journey takes. It sits
  // beside `checkins`, not in it: restrictPageAccess treats any `checkins` data as answers given.
  getStartSetup: () => {
    return async (req, res) => {
      const { crn } = req.params as Record<string, string>
      if (!isValidCrn(crn)) {
        return renderError(404)(req, res)
      }
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_START_SETUP', crn, SubjectType.CRN)
      // The wizard opens on the eligibility check. The instructions page and its route are kept
      // for now in case the guidance is wanted back, but nothing routes into or out of it.
      const id = randomUUID()
      req.session.data = req.session.data || {}
      setDataValue(req.session.data, ['esupervision', crn, id, 'setupStartedAt'], new Date().toISOString())
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
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
      const band = requireBand(req, res, crn, id)
      if (!band) {
        return undefined
      }
      const practitioner = await getAllocationPractitioner(hmppsAuthClient, res, crn)
      if (practitioner?.unallocated) {
        return res.redirect(`/case/${crn}/appointments`)
      }
      req.session.data = req.session.data || {}
      setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'tierBand'], band)

      const status = getSupervisionPackageStatus(res)
      storeSupervisionPackageStatus(req, crn, id, status)

      // Not being on a supervision package and being in the final third are both blanket failures on
      // every branch, so no box on the form below could change the outcome - the person is ruled out
      // without being asked. Early engagement is not settled here: it only applies on the Tier A/B
      // accredited-programme branch, which is one of the answers the form is about to collect.
      //
      // The reason comes from the rules rather than being picked here, so the GET and the POST cannot
      // disagree on the wording or on which fact is reported when both apply.
      if (!status.onSupervisionPackage || status.inFinalThird) {
        const { reason, bullets, additionalTierInformation } = nextAfterEligibilityCheck(
          band,
          status,
          [],
          res.locals.tierScore as string,
        )
        setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'notEligibleReason'], reason)
        setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'notEligibleReasonBullets'], bullets ?? [])
        setDataValue(
          req.session.data,
          ['esupervision', crn, id, 'checkins', 'additionalTierInformation'],
          Boolean(additionalTierInformation),
        )
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      }

      return res.render(`pages/check-in/${eligibilityViews[band]['eligibility-check']}.njk`, {
        crn,
        id,
        back,
        // The shared eligibility-check template renders the Tier A/B-only checkboxes off this.
        tierBand: band,
        tierScore: res.locals.tierScore,
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
      const band = requireBand(req, res, crn, id)
      if (!band) {
        return undefined
      }
      req.session.data = req.session.data || {}
      const { data } = req.session
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'id'], id)
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'tierBand'], band)

      const selections = toSelections(req.body?.esupervision?.[crn]?.[id]?.checkins?.eligibility)
      // Supplied by getSupervisionPackageStatus, which replaced the boxes these used to read.
      const status = getSupervisionPackageStatus(res)
      storeSupervisionPackageStatus(req, crn, id, status)
      const { target, reason, bullets, accreditedProgramme, additionalTierInformation } = nextAfterEligibilityCheck(
        band,
        status,
        selections,
        res.locals.tierScore as string,
      )
      // The rationale step and the summary both key off this, so record it either way.
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'accreditedProgramme'], Boolean(accreditedProgramme))
      // Going back and unticking accredited programme after already completing approval and/or
      // rationale must not leave those answers behind - postCheckInDetails sends rationale
      // unconditionally, so a stale value here would submit for a route the case is no longer on.
      if (!accreditedProgramme) {
        setDataValue(data, ['esupervision', crn, id, 'checkins', 'accreditedProgrammeApproval'], undefined)
        setDataValue(data, ['esupervision', crn, id, 'checkins', 'rationale'], undefined)
      }
      // Keyed off the target rather than the reason: the clause is deliberately empty where the
      // facts are listed as bullets instead, and would otherwise be skipped as falsy.
      if (target === 'not-eligible') {
        setDataValue(data, ['esupervision', crn, id, 'checkins', 'notEligibleReason'], reason)
        setDataValue(data, ['esupervision', crn, id, 'checkins', 'notEligibleReasonBullets'], bullets ?? [])
        setDataValue(
          data,
          ['esupervision', crn, id, 'checkins', 'additionalTierInformation'],
          Boolean(additionalTierInformation),
        )
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/${target}`)
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
      const band = requireBand(req, res, crn, id)
      if (!band) {
        return undefined
      }
      const practitioner = await getAllocationPractitioner(hmppsAuthClient, res, crn)
      if (practitioner?.unallocated) {
        return res.redirect(`/case/${crn}/appointments`)
      }
      return res.render('pages/check-in/instructions.njk', {
        crn,
        id,
        back,
        guidanceUrl: config.guidance.link,
        data: req.session.data,
        // Tier A/B is the only band where the accredited-programme guidance can apply.
        accreditedProgramme: band === 'AB',
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
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
    }
  },

  getPilotCheckPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_CHECK_IN_ELIGIBILITY', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const band = requireBand(req, res, crn, id)
      if (!band) {
        return undefined
      }
      // Tiers D-G have no pilot question - there is nothing to render for them here.
      if (band === 'DG') {
        return renderError(500)(req, res)
      }
      return res.render(`pages/check-in/${eligibilityViews[band]['pilot-check']}.njk`, {
        crn,
        id,
        back,
        tierScore: res.locals.tierScore,
        data: req.session.data,
      })
    }
  },

  postPilotCheckPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const band = requireBand(req, res, crn, id)
      if (!band) {
        return undefined
      }
      if (band === 'DG') {
        return renderError(500)(req, res)
      }
      req.session.data = req.session.data || {}
      const pilotCheck = String(req.body?.esupervision?.[crn]?.[id]?.checkins?.pilotCheck ?? '')
      const { target, reason, bullets, additionalTierInformation } = nextAfterPilotCheck(
        band,
        pilotCheck,
        res.locals.tierScore as string,
      )
      if (target === 'not-eligible') {
        setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'notEligibleReason'], reason)
        setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'notEligibleReasonBullets'], bullets ?? [])
        setDataValue(
          req.session.data,
          ['esupervision', crn, id, 'checkins', 'additionalTierInformation'],
          Boolean(additionalTierInformation),
        )
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/${target}`)
    }
  },

  getIsEligiblePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ELIGIBLE_TO_USE_CHECK_IN', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const band = requireBand(req, res, crn, id)
      if (!band) {
        return undefined
      }
      // A/B splits again here: the accredited-programme cohort gets its own page, with its own
      // explanation of why the person is eligible and for how long.
      const accreditedProgramme = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'checkins',
        'accreditedProgramme',
      ])
      const page = band === 'AB' && accreditedProgramme ? 'accredited-programme-is-eligible' : 'is-eligible'
      return res.render(`pages/check-in/${eligibilityViews[band][page]}.njk`, {
        crn,
        id,
        back,
        tierScore: res.locals.tierScore,
        guidanceUrl: config.guidance.link,
        data: req.session.data,
      })
    }
  },

  postIsEligiblePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      req.session.data = req.session.data || {}
      const { data } = req.session
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'id'], id)

      const accreditedProgramme = getDataValue(data, ['esupervision', crn, id, 'checkins', 'accreditedProgramme'])
      const discussion = toSelections(req.body?.esupervision?.[crn]?.[id]?.checkins?.discussion)
      setDataValue(data, ['esupervision', crn, id, 'checkins', 'discussion'], discussion)
      if (!hasCompletedDiscussion(discussion, { accreditedProgramme: Boolean(accreditedProgramme) })) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/discuss-before-signup`)
      }
      // Approval and rationale only apply to the accredited-programme cohort.
      const next = accreditedProgramme ? 'accredited-programme-approval' : 'check-in-frequency'
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/${next}`)
    }
  },

  getNotEligiblePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_NOT_ELIGIBLE_TO_USE_CHECK_IN', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const checkins = ['esupervision', crn, id, 'checkins']
      const supervisionPackageStatus = ['esupervision', crn, id, 'supervisionPackageStatus']
      // Both come from the ESUP call rather than an answer, so the page offers no way back to the
      // eligibility check - see the back link in not-eligible.njk.
      const noSupervisionPackage =
        getDataValue(req.session.data, [...supervisionPackageStatus, 'onSupervisionPackage']) === false
      const inFinalThird = getDataValue(req.session.data, [...supervisionPackageStatus, 'inFinalThird']) === true
      const tierStatus = getTierBand(res.locals.tierScore as string)
      return res.render('pages/check-in/eligibility/not-eligible.njk', {
        crn,
        id,
        back,
        reason: getDataValue(req.session.data, [...checkins, 'notEligibleReason']),
        // Listed beneath the reason when more than one fact ruled the person out.
        reasonBullets: getDataValue(req.session.data, [...checkins, 'notEligibleReasonBullets']),
        additionalTierInformation: getDataValue(req.session.data, [...checkins, 'additionalTierInformation']),
        guidanceUrl: config.guidance.link,
        missingTier: tierStatus === MISSING_TIER,
        notSupervised: tierStatus === NOT_SUPERVISED_TIER,
        provisionalTier: res.locals.tierProvisional === true,
        noSupervisionPackage,
        inFinalThird,
      })
    }
  },

  postNotEligiblePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.redirect(`/case/${crn}`)
    }
  },

  getDiscussBeforeSignupPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_CHECK_IN_ELIGIBILITY', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.render('pages/check-in/eligibility/discuss-before-signup.njk', {
        crn,
        id,
        back,
        guidanceUrl: config.guidance.link,
      })
    }
  },

  postDiscussBeforeSignupPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.redirect(`/case/${crn}`)
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
      const accreditedProgramme = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'checkins',
        'accreditedProgramme',
      ])
      // Rationale only applies to the accredited-programme cohort; everyone else skips it.
      if (!accreditedProgramme) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/check-in-frequency`)
      }
      const backLink = cya
        ? `/case/${crn}/appointments/${id}/check-in/checkin-summary`
        : `/case/${crn}/appointments/${id}/check-in/accredited-programme-approval`
      return res.render('pages/check-in/rationale.njk', {
        crn,
        id,
        backLink,
        accreditedProgramme,
      })
    }
  },

  postRationalePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/check-in-frequency`)
    }
  },

  getFrequencyPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SETUP_ONLINE_CHECK_INS', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const cya = req.query.cya === 'true'
      const accreditedProgramme = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'checkins',
        'accreditedProgramme',
      ])
      let backLink: string
      if (cya) {
        backLink = `/case/${crn}/appointments/${id}/check-in/checkin-summary`
      } else {
        // Only the accredited-programme cohort passes through rationale on the way here.
        backLink = accreditedProgramme
          ? `/case/${crn}/appointments/${id}/check-in/rationale`
          : `/case/${crn}/appointments/${id}/check-in/is-eligible`
      }
      return res.render('pages/check-in/check-in-frequency.njk', {
        crn,
        id,
        cya,
        backLink,
      })
    }
  },

  postFrequencyPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const cya = req.query.cya === 'true'
      const interval = getDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'interval'])
      if (interval === 'AD_HOC') {
        // An ad-hoc setup schedules no first check in, so there is no date to collect - clear any
        // left over from switching away from a standard interval during a check-your-answers edit.
        setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'date'], undefined)
        return res.redirect(
          cya
            ? `/case/${crn}/appointments/${id}/check-in/checkin-summary`
            : `/case/${crn}/appointments/${id}/check-in/contact-preference`,
        )
      }
      // A check-your-answers edit returns to the summary with the date already on file. Only when
      // switching from ad-hoc (which has no date) to a standard interval is a date still needed.
      const date = getDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'date'])
      if (cya && date) {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/checkin-summary`)
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/check-in-date${cya ? '?cya=true' : ''}`)
    }
  },

  getDatePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SETUP_ONLINE_CHECK_INS', crn, SubjectType.CRN)
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const cya = req.query.cya === 'true'
      const interval = getDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'interval'])
      if (interval === 'AD_HOC') {
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/check-in-frequency${cya ? '?cya=true' : ''}`)
      }
      // During a check-your-answers edit, no saved date means the frequency was just switched from
      // ad-hoc, so Back retraces to the frequency page (keeping cya) rather than the summary.
      const date = getDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'date'])
      let backLink = `/case/${crn}/appointments/${id}/check-in/check-in-frequency`
      if (cya) {
        backLink = date
          ? `/case/${crn}/appointments/${id}/check-in/checkin-summary`
          : `/case/${crn}/appointments/${id}/check-in/check-in-frequency?cya=true`
      }
      return res.render('pages/check-in/check-in-date.njk', {
        crn,
        id,
        cya,
        backLink,
        checkInMinDate: getMinDate(),
      })
    }
  },

  postDatePage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      if (!isValidCrn(crn) || !isValidUUID(id)) {
        return renderError(404)(req, res)
      }
      const cya = req.query.cya === 'true'
      const interval = getDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'interval'])
      if (interval === 'AD_HOC') {
        // A date page left open in another tab and submitted after ad-hoc was chosen: drop the date
        // it just stored, as getDatePage would never have shown the form.
        setDataValue(req.session.data, ['esupervision', crn, id, 'checkins', 'date'], undefined)
        return res.redirect(`/case/${crn}/appointments/${id}/check-in/check-in-frequency${cya ? '?cya=true' : ''}`)
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
      const isAdHoc = getDataValue(data, ['esupervision', crn, id, 'checkins', 'interval']) === 'AD_HOC'

      return res.render('pages/check-in/contact-preference.njk', {
        crn,
        id,
        checkInMobile,
        checkInEmail,
        cya,
        isAdHoc,
      })
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
      const interval = revertAbandonedIntervalChange(req, crn, id, 'checkins')
      const userDetails: CheckinUserDetails = {
        ...savedUserDetails,
        uuid: id,
        interval: checkinIntervals.find(option => option.id === interval)?.label,
        isAdHoc: interval === 'AD_HOC',
        preferredComs: savedUserDetails?.preferredComs === 'EMAIL' ? 'Email' : 'Text message',
        photoUploadOption:
          savedUserDetails?.photoUploadOption === 'TAKE_A_PIC' ? 'Take a photo using this device' : 'Upload a photo',
      }
      return res.render('pages/check-in/checkin-summary.njk', {
        crn,
        id,
        userDetails,
      })
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
      const hasCheckinDate = Boolean(savedUserDetails?.date)
      const userDetails: CheckinUserDetails = {
        ...savedUserDetails,
        uuid: activeId,
        interval: checkinIntervals.find(option => option.id === savedUserDetails?.interval)?.label,
        isAdHoc: savedUserDetails?.interval === 'AD_HOC',
        displayCommsOption:
          savedUserDetails?.preferredComs === 'EMAIL'
            ? savedUserDetails?.checkInEmail
            : savedUserDetails?.checkInMobile,
        displayDay: hasCheckinDate
          ? dayOfWeek(DateTime.fromFormat(savedUserDetails.date, 'd/M/yyyy').toFormat('yyyy-MM-dd'))
          : undefined,
      }
      const isFutureCheckinDate =
        hasCheckinDate &&
        DateTime.fromFormat(savedUserDetails.date, 'd/M/yyyy').startOf('day') > DateTime.now().startOf('day')

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
      // The settings card shows the upcoming check in or, for a scheduled person with none booked
      // yet, the next day their saved schedule falls on after today. That date can only be moved
      // while the check in is still to come: once it is active (due today) or past there is nothing
      // to move, and the API refuses the change.
      const nextCheckinDate = upcomingCheckin?.expectedCheckinDate ?? nextDayOfSavedSchedule(checkinRes)
      const nextCheckinDay = DateTime.fromISO(nextCheckinDate ?? '')
      const canChangeDate =
        showChange && nextCheckinDay.isValid && nextCheckinDay.startOf('day') > DateTime.now().startOf('day')
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
        const nextCheckinLongDate = dateWithYear(rawCheckinDate)
        successMessageHtml = `
          <strong>You have added additional questions to ${forename}’s next online check in</strong>
          <br>
          Additional questions will only apply to their next check in${nextCheckinLongDate ? ` on ${nextCheckinLongDate}` : ''}
        `
        setDataValue(req.session.data, ['esupervision', crn, id, 'questionsAdded'], undefined)
      }

      // An ad-hoc check in is booked from the schedule page, and moved by booking it again.
      const adHocBanners = [
        ['scheduleCheckInCreated', 'created for'],
        ['scheduleCheckInMoved', 'moved to'],
      ] as const
      adHocBanners.forEach(([flag, verb]) => {
        const bookedDate = getDataValue(req.session.data, ['esupervision', crn, id, flag])
        if (!bookedDate) return
        res.locals.success = true
        const forename = checkinRes?.details?.name?.forename || 'the person'
        const adHocDate = dateToLongDate(bookedDate)
        successMessageHtml = `
          <strong>Single online check in for ${forename} has been ${verb} ${adHocDate}</strong>
          <br>
          ${forename} will get a notification with a link to complete their online check in on ${adHocDate}.
        `
        setDataValue(req.session.data, ['esupervision', crn, id, flag], undefined)
      })

      return res.render('pages/check-in/manage/manage-checkin.njk', {
        crn,
        // the /manage route has no :id param; the check-in id is the offender uuid
        id: checkinRes?.uuid ?? id,
        case: checkinRes?.details,
        email: checkinRes?.details?.email ?? '',
        mobile: checkinRes?.details?.mobile ?? '',
        offenderCheckinsByCRNResponse: checkinRes,
        // Ad-hoc is a mode with no interval at the API; the page shows it as one more frequency.
        checkinFrequency: fromApiSchedule(checkinRes),
        showChange,
        nextCheckinDate,
        canChangeDate,
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
        return res.redirect(
          `/case/${crn}/appointments/${id}/check-in/update${back ? `?back=${encodeURIComponent(back as string)}` : ''}`,
        )
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
        return res.redirect(safeBackUrl(back) ?? `/case/${crn}/appointments/${id}/check-in/review/identity`)
      }

      if (checkIn.status !== 'SUBMITTED') {
        return res.redirect(
          `/case/${crn}/appointments/${id}/check-in/update${back ? `?back=${encodeURIComponent(back as string)}` : ''}`,
        )
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
        return res.redirect(
          `/case/${crn}/appointments/${id}/check-in/view-expired${back ? `?back=${encodeURIComponent(back as string)}` : ''}`,
        )
      }
      if (checkIn.status !== 'EXPIRED') {
        return res.redirect(
          `/case/${crn}/appointments/${id}/check-in/update${back ? `?back=${encodeURIComponent(back as string)}` : ''}`,
        )
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
      // Use the matched route pattern, not req.path, which may vary in case or trailing slash
      const page = String(req.route?.path ?? '').endsWith('/view-expired') ? 'view-expired' : 'view'
      const back = safeBackUrl(req.query.back)
      const url = `/case/${crn}/appointments/${id}/check-in/${page}${back ? `?back=${encodeURIComponent(back)}` : ''}`

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
        return res.redirect(
          `/case/${crn}/appointments/${id}/check-in/update${back ? `?back=${encodeURIComponent(back as string)}` : ''}`,
        )
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
          `/case/${crn}/appointments/${id}/check-in/${statusMap[checkIn.status]}${back ? `?back=${encodeURIComponent(back as string)}` : ''}`,
        )
      }
      return renderError(404)(req, res)
    }
  },

  getSettingsFrequencyPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_CHECK_IN_SETTINGS', crn, SubjectType.CRN)

      req.session.data = req.session.data || {}
      const checkinRes = res.locals?.offenderCheckinsByCRNResponse
      const interval = fromApiSchedule(checkinRes)
      // An ad-hoc person's firstCheckin is their last booked ad-hoc check in, which may already have
      // passed. It is not a start date for a new schedule, so leave the date page empty for them.
      const date = interval === 'AD_HOC' ? undefined : checkinRes?.firstCheckin
      setDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin'], { date, interval })
      return res.render('pages/check-in/manage/checkin-settings-frequency.njk', {
        crn,
        id,
        case: checkinRes?.details,
      })
    }
  },

  postSettingsFrequencyPage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const frequency: CheckinFrequency = getDataValue(req.session.data, [
        'esupervision',
        crn,
        id,
        'manageCheckin',
        'interval',
      ])
      const currentFrequency = fromApiSchedule(res.locals.offenderCheckinsByCRNResponse)

      // Nothing to save when the frequency is unchanged. Submitting anyway would rewrite the
      // schedule (re-basing its first check in on the next due date), record a fresh update
      // against the practitioner, and show a "settings saved" banner for a change that never
      // happened.
      if (frequency === currentFrequency) {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}`)
      }
      // Only a move from ad-hoc to a scheduled interval needs a date: the person has no schedule to
      // carry forward, so the practitioner picks when the new one starts.
      if (currentFrequency === 'AD_HOC' && frequency !== 'AD_HOC') {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/settings-date`)
      }
      if (frequency === 'AD_HOC') {
        return submitCheckinSettings(hmppsAuthClient, req, res, frequency)
      }
      const firstCheckin = await nextScheduledCheckinDate(hmppsAuthClient, res, crn)
      if (!firstCheckin) {
        // Should not happen for a scheduled person, whose record always carries a date and interval.
        // Without one the API would reject the update, so ask for a date rather than fail silently.
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/settings-date`)
      }
      return submitCheckinSettings(hmppsAuthClient, req, res, frequency, firstCheckin)
    }
  },

  getSettingsDatePage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_CHECK_IN_SETTINGS', crn, SubjectType.CRN)
      req.session.data = req.session.data || {}
      const checkinRes = res.locals?.offenderCheckinsByCRNResponse
      const currentFrequency = fromApiSchedule(checkinRes)
      const managePage = `/case/${crn}/appointments/check-in/manage/${id}`
      let backLink = `${managePage}/settings`
      if (currentFrequency && currentFrequency !== 'AD_HOC') {
        // A scheduled person gets here from the manage card to move their next check in, keeping
        // their interval. Seed it from the record so the submit has one, and pre-fill the date they
        // are moving in the form's d/M/yyyy, so the picker shows it and resubmitting unchanged is valid.
        const nextCheckin = await nextScheduledCheckinDate(hmppsAuthClient, res, crn)
        setDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin'], {
          interval: currentFrequency,
          date: nextCheckin ? DateTime.fromISO(nextCheckin).toFormat('d/M/yyyy') : undefined,
        })
        backLink = managePage
      } else {
        // An ad-hoc person only gets here from the frequency page, which seeds the interval they
        // chose. A deep link or an expired session has nothing to submit - send them back to choose
        // one. An ad-hoc choice has no date to collect either.
        const interval = getDataValue(req.session.data, ['esupervision', crn, id, 'manageCheckin', 'interval'])
        if (!interval || interval === 'AD_HOC') {
          return res.redirect(backLink)
        }
      }
      const checkInMinDate = getMinDate()
      return res.render('pages/check-in/manage/checkin-settings-date.njk', {
        crn,
        id,
        case: checkinRes?.details,
        checkInMinDate,
        backLink,
      })
    }
  },

  postSettingsDatePage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const date = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'date'])
      const frequency: CheckinFrequency = getDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'interval'])
      if (!frequency) {
        // See getSettingsDatePage: without an interval the API would be sent SCHEDULED with no interval.
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/settings`)
      }
      // date is entered as d/M/yyyy; the API expects yyyy/M/dd
      const parsedFirstCheckin = DateTime.fromFormat(date ?? '', 'd/M/yyyy')
      const firstCheckin = parsedFirstCheckin.isValid ? parsedFirstCheckin.toFormat('yyyy/M/dd') : date
      return submitCheckinSettings(hmppsAuthClient, req, res, frequency, firstCheckin)
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

      const defaultsLoaded = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'id'])
      if (!defaultsLoaded) {
        const offenderSettings = res.locals.offenderCheckinsByCRNResponse

        setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'id'], id)
        setDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'interval'], fromApiSchedule(offenderSettings))
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
      return res.render('pages/check-in/manage/restart-checkin-frequency.njk', {
        crn,
        id,
        case: personalDetails,
        cya,
      })
    }
  },

  postRestartCheckinPage: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const cya = req.query?.cya === 'true'
      const interval = getDataValue(req.session.data, ['esupervision', crn, id, 'restartCheckin', 'interval'])
      if (interval === 'AD_HOC') {
        // As in the setup journey, an ad-hoc restart schedules no first check in, so there is no date
        // to collect - clear any left over from switching away from a standard interval.
        setDataValue(req.session.data, ['esupervision', crn, id, 'restartCheckin', 'date'], undefined)
        return res.redirect(
          cya
            ? `/case/${crn}/appointments/check-in/manage/${id}/restart-summary`
            : `/case/${crn}/appointments/check-in/manage/${id}/restart-contact`,
        )
      }
      // A check-your-answers edit returns to the summary with the date already on file. Only when
      // switching from ad-hoc (which has no date) to a standard interval is a date still needed.
      const date = getDataValue(req.session.data, ['esupervision', crn, id, 'restartCheckin', 'date'])
      if (cya && date) {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-summary`)
      }
      return res.redirect(
        `/case/${crn}/appointments/check-in/manage/${id}/restart-checkin-date${cya ? '?cya=true' : ''}`,
      )
    }
  },

  getRestartCheckinDatePage: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_WHEN_TO_COMPLETE_ONLINE_CHECK_IN',
        crn,
        SubjectType.CRN,
      )
      const cya = req.query.cya === 'true'
      const interval = getDataValue(req.session.data, ['esupervision', crn, id, 'restartCheckin', 'interval'])
      // No date to collect for ad-hoc, and nothing to date without an interval (deep link or expired
      // session) - either way the frequency page is the right place to be.
      if (!interval || interval === 'AD_HOC') {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-checkin${cya ? '?cya=true' : ''}`)
      }
      const checkInMinDate = getMinDate()
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupervisionClient = new ESupervisionClient(token)
      const personalDetails = await eSupervisionClient.getPersonalDetails(crn)

      if (!personalDetails) {
        return renderError(404)(req, res)
      }
      // During a check-your-answers edit, no saved date means the frequency was just switched from
      // ad-hoc, so Back retraces to the frequency page (keeping cya) rather than the summary.
      const date = getDataValue(req.session.data, ['esupervision', crn, id, 'restartCheckin', 'date'])
      let backLink = `/case/${crn}/appointments/check-in/manage/${id}/restart-checkin`
      if (cya) {
        backLink = date
          ? `/case/${crn}/appointments/check-in/manage/${id}/restart-summary`
          : `/case/${crn}/appointments/check-in/manage/${id}/restart-checkin?cya=true`
      }
      return res.render('pages/check-in/manage/restart-checkin-date.njk', {
        crn,
        id,
        checkInMinDate,
        case: personalDetails,
        cya,
        backLink,
      })
    }
  },

  postRestartCheckinDatePage: () => {
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
      // The page's Back goes to the frequency page for an ad-hoc restart, which has no date page.
      const isAdHoc = getDataValue(data, ['esupervision', crn, id, 'restartCheckin', 'interval']) === 'AD_HOC'
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
        isAdHoc,
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

      const interval = revertAbandonedIntervalChange(req, crn, id, 'restartCheckin')
      const userDetails = {
        ...restartDetails,
        interval: checkinIntervals.find(i => i.id === interval)?.label,
        isAdHoc: interval === 'AD_HOC',
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
      // A scheduled restart needs both an interval and a date; without them the API would be sent a
      // schedule with no interval, so send the practitioner back to supply them.
      const incomplete = !restartDetails?.interval || (restartDetails.interval !== 'AD_HOC' && !restartDetails.date)
      if (incomplete) return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/restart-checkin`)

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
            // An ad-hoc restart schedules no first check in; the practitioner books them one at a time.
            ...(restartDetails.interval === 'AD_HOC' ? {} : { firstCheckin: formattedDate }),
            ...toApiSchedule(restartDetails.interval),
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

      const hasCheckinDate = Boolean(savedDetails.date)
      const userDetails = {
        ...savedDetails,
        interval: checkinIntervals.find(option => option.id === savedDetails.interval)?.label,
        isAdHoc: savedDetails.interval === 'AD_HOC',
        displayCommsOption:
          savedDetails.preferredComs === 'EMAIL' ? savedDetails.checkInEmail : savedDetails.checkInMobile,
        displayDay: hasCheckinDate
          ? dayOfWeek(DateTime.fromFormat(savedDetails.date, 'd/M/yyyy').toFormat('yyyy-MM-dd'))
          : undefined,
      }
      // Questions close at 23:59 the day before a check in, so a restart dated today has none to add.
      const isFutureCheckinDate =
        hasCheckinDate &&
        DateTime.fromFormat(savedDetails.date, 'd/M/yyyy').startOf('day') > DateTime.now().startOf('day')
      setDataValue(data, ['esupervision', crn, id, 'restartCheckin'], undefined)
      return res.render('pages/check-in/manage/restart-confirmation.njk', {
        crn,
        id,
        case: caseData,
        userDetails,
        isFutureCheckinDate,
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
            fullText: buildQuestionText(templateData.prefix, inputValue, templateData.suffix),
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
        const templateData =
          typeof originalTemplate?.template === 'string' ? parseQuestionTemplate(availableTemplates, templateId) : null

        return {
          id: templateId,
          params: {
            placeholders: {
              [originalTemplate?.responseSpec?.placeholders?.[0] || 'text']: normalizeQuestionPlaceholder(
                inputValue as string,
                templateData?.suffix || '',
              ),
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

  getScheduleCheckInDate: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_DATE', crn, SubjectType.CRN)
      const offenderDetails = res.locals.offenderCheckinsByCRNResponse
      if (!offenderDetails) {
        return renderError(404)(req, res)
      }
      req.session.data = req.session.data || {}
      const scheduleCheckIn = ['esupervision', crn, id, 'scheduleCheckIn']
      const booking = await adHocBooking(hmppsAuthClient, res, crn)
      if (booking.state === 'active') {
        // Today's check in is under way: it cannot be moved, and nothing can be booked over it.
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}`)
      }
      // Record the booking being moved, if any, so the validator can insist on a date after today:
      // a check in moved to today would become active at once. Start the picker on the date being
      // moved, in the form's d/M/yyyy, replacing anything an earlier visit left in the session.
      const bookedDate = booking.state === 'booked' ? booking.date : undefined
      setDataValue(req.session.data, [...scheduleCheckIn, 'bookedDate'], bookedDate)
      if (bookedDate) {
        setDataValue(req.session.data, [...scheduleCheckIn, 'date'], DateTime.fromISO(bookedDate).toFormat('d/M/yyyy'))
      }
      const checkInMinDate = bookedDate ? getMinDate(1) : getMinDate()
      return res.render('pages/check-in/schedule-check-in/date.njk', {
        crn,
        id,
        case: offenderDetails.details,
        checkInMinDate,
        data: req.session.data,
      })
    }
  },

  postScheduleCheckInDate: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data || {}
      const { data } = req.session
      const managePage = `/case/${crn}/appointments/check-in/manage/${id}`
      // A new booking goes on to choose questions. Moving a check in that is already booked only
      // changes its date: the API keeps the questions assigned to it, so save straight away.
      const booking = await adHocBooking(hmppsAuthClient, res, crn)
      if (booking.state === 'active') {
        return res.redirect(managePage)
      }
      if (booking.state === 'none') {
        return res.redirect(`${managePage}/schedule-check-in/questions/add`)
      }
      // The validator applied the move's stricter date rule from the booking recorded when the page
      // was shown. The booking is checked again here, so if the two disagree (another tab, a session
      // from before the page was opened) the error is shown here instead of a silent redirect.
      const scheduleCheckIn = ['esupervision', crn, id, 'scheduleCheckIn']
      const date = getDataValue(data, [...scheduleCheckIn, 'date'])
      const parsedDate = DateTime.fromFormat(date ?? '', 'd/M/yyyy')
      let dateError: string | undefined
      if (!parsedDate.isValid) {
        dateError = 'Enter a date in the correct format, for example 17/5/2024'
      } else if (parsedDate.startOf('day') <= DateTime.now().startOf('day')) {
        dateError = 'The next online check in date must be in the future'
      }
      if (dateError) {
        setDataValue(data, [...scheduleCheckIn, 'bookedDate'], booking.date)
        const errorMessages = { [`esupervision-${crn}-${id}-scheduleCheckIn-date`]: dateError }
        res.locals.errorMessages = errorMessages
        return res.render('pages/check-in/schedule-check-in/date.njk', {
          errorMessages,
          crn,
          id,
          case: res.locals.offenderCheckinsByCRNResponse?.details,
          checkInMinDate: getMinDate(1),
          data,
        })
      }
      const { username } = res.locals.user
      try {
        const token = await hmppsAuthClient.getSystemClientToken(username)
        const eSupClient = new ESupervisionClient(token)
        await eSupClient.postScheduleAdHocCheckin(crn, { requestedBy: username, firstCheckin: parsedDate.toISODate() })
        setDataValue(data, ['esupervision', crn, id, 'scheduleCheckIn'], undefined)
        setDataValue(data, ['esupervision', crn, id, 'scheduleCheckInMoved'], date)
        return res.redirect(managePage)
      } catch (error: any) {
        logger.error(`Failed to move the ad hoc check-in for CRN ${crn}:`, error)
        return renderError(error?.status || 500)(req, res)
      }
    }
  },

  getScheduleCheckInAddQuestions: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_ADD_QUESTIONS', crn, SubjectType.CRN)
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const offenderDetails = res.locals.offenderCheckinsByCRNResponse
      if (!offenderDetails) {
        return renderError(404)(req, res)
      }

      req.session.data = req.session.data ?? {}
      const { data } = req.session

      let availableTemplates =
        getDataValue(data, ['esupervision', crn, id, 'scheduleCheckIn', 'availableTemplates']) || []
      if (availableTemplates.length === 0) {
        const eSupClient = new ESupervisionClient(token)
        const templatesList = await eSupClient.getQuestionsTemplates('en-GB')
        availableTemplates = templatesList.templates.filter(
          (t: any) => t.policy$hmpps_esupervision_api === 'CUSTOMISABLE',
        )
        setDataValue(data, ['esupervision', crn, id, 'scheduleCheckIn', 'availableTemplates'], availableTemplates)
      }

      let questionTemplateAndInputs = getDataValue(data, [
        'esupervision',
        crn,
        id,
        'scheduleCheckIn',
        'questionTemplateAndInputs',
      ])
      // Questions added before a switch to ad-hoc stay assigned and go out with the next booking,
      // so show them here for the practitioner to keep, change or remove.
      if (!questionTemplateAndInputs) {
        questionTemplateAndInputs = {}
        try {
          const response = await new ESupervisionClient(token).getUpcomingCheckinQuestionItems(crn, 'en-GB')
          const items = response?.upcoming?.items || []
          items.forEach((item: any) => {
            if (availableTemplates.some((t: any) => String(t.id) === String(item.template.id))) {
              const inputValue = Object.values(item.params?.placeholders || {})[0] || ''
              questionTemplateAndInputs[`${item.template.id}-${uuidv4()}`] = inputValue
            }
          })
        } catch (error: any) {
          const status = error?.status || error?.response?.status
          const isInactiveOffender = status === 422 && error?.data?.developerMessage === 'Offender status is INACTIVE'
          if (status === 404 || isInactiveOffender) {
            logger.info(`No saved questions found for CRN ${crn}.`)
          } else {
            logger.error(`Failed to fetch saved questions for CRN ${crn}:`, error)
            return renderError(status || 500)(req, res)
          }
        }
        setDataValue(
          data,
          ['esupervision', crn, id, 'scheduleCheckIn', 'questionTemplateAndInputs'],
          questionTemplateAndInputs,
        )
        setDataValue(
          data,
          ['esupervision', crn, id, 'scheduleCheckIn', 'hasSavedQuestions'],
          Object.keys(questionTemplateAndInputs).length > 0,
        )
      }

      const addedQuestions = Object.entries(questionTemplateAndInputs)
        .map(([qId, inputValue]) => {
          if (!inputValue || typeof inputValue !== 'string' || inputValue.trim() === '') return null
          const templateId = parseInt(qId.split('-')[0], 10)
          const templateData = parseQuestionTemplate(availableTemplates, templateId)
          if (!templateData) return null
          return {
            id: qId,
            fullText: buildQuestionText(templateData.prefix, inputValue, templateData.suffix),
          }
        })
        .filter(q => q !== null)

      const expectedCheckinDate = getDataValue(data, ['esupervision', crn, id, 'scheduleCheckIn', 'date'])

      return res.render('pages/check-in/schedule-check-in/add-questions.njk', {
        crn,
        id,
        back,
        case: offenderDetails.details,
        addedQuestions,
        expectedCheckinDate,
        data,
      })
    }
  },

  postScheduleCheckInAddQuestions: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      req.session.data = req.session.data ?? {}
      const { data } = req.session
      const scheduleCheckIn = getDataValue(data, ['esupervision', crn, id, 'scheduleCheckIn']) || {}
      const { date } = scheduleCheckIn
      const parsedDate = DateTime.fromFormat(date ?? '', 'd/M/yyyy')
      const firstCheckin = parsedDate.isValid ? parsedDate.toISODate() : null

      if (!firstCheckin) {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in`)
      }

      const availableTemplates = scheduleCheckIn.availableTemplates || []
      const questionTemplateAndInputs = scheduleCheckIn.questionTemplateAndInputs || {}
      const formattedQuestions = Object.entries(questionTemplateAndInputs).flatMap(([draftId, inputValue]) => {
        if (typeof inputValue !== 'string' || inputValue.trim() === '') return []
        const templateId = parseInt(draftId.split('-')[0], 10)
        const originalTemplate = availableTemplates.find((template: any) => String(template.id) === String(templateId))
        if (!originalTemplate) return []
        const templateData =
          typeof originalTemplate.template === 'string' ? parseQuestionTemplate(availableTemplates, templateId) : null

        return [
          {
            id: templateId,
            params: {
              placeholders: {
                [originalTemplate.responseSpec?.placeholders?.[0] || 'text']: normalizeQuestionPlaceholder(
                  inputValue,
                  templateData?.suffix || '',
                ),
              },
              responseFormat: originalTemplate.responseFormat || 'TEXT',
            },
          },
        ]
      })
      const { username } = res.locals.user
      const request: ScheduleAdHocCheckinRequest = {
        requestedBy: username,
        firstCheckin,
        ...(formattedQuestions.length > 0 && {
          questions: {
            questions: formattedQuestions,
            language: 'en-GB',
            author: username,
          },
        }),
      }

      try {
        const token = await hmppsAuthClient.getSystemClientToken(username)
        const eSupClient = new ESupervisionClient(token)
        // Booking without questions keeps any still assigned, so clear those the practitioner removed.
        if (formattedQuestions.length === 0 && scheduleCheckIn.hasSavedQuestions) {
          await eSupClient.deleteAssignedQuestionsFromCheckIn(crn)
        }
        await eSupClient.postScheduleAdHocCheckin(crn, request)
        setDataValue(data, ['esupervision', crn, id, 'scheduleCheckIn'], undefined)
        setDataValue(data, ['esupervision', crn, id, 'scheduleCheckInCreated'], date)
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}`)
      } catch (error: any) {
        logger.error(`Failed to schedule ad hoc check-in for CRN ${crn}:`, error)
        return renderError(error?.status || 500)(req, res)
      }
    }
  },

  getScheduleCheckInQuestionsList: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_LIST_QUESTIONS', crn, SubjectType.CRN)
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const eSupClient = new ESupervisionClient(token)
      const offenderDetails = res.locals.offenderCheckinsByCRNResponse
      if (!offenderDetails) {
        return renderError(404)(req, res)
      }

      req.session.data = req.session.data ?? {}
      const { data } = req.session

      const templatesList = await eSupClient.getQuestionsTemplates('en-GB')
      const availableTemplates = templatesList.templates.filter(
        (t: any) => t.policy$hmpps_esupervision_api === 'CUSTOMISABLE',
      )
      setDataValue(data, ['esupervision', crn, id, 'scheduleCheckIn', 'availableTemplates'], availableTemplates)

      const questionTemplateAndInputs =
        getDataValue(data, ['esupervision', crn, id, 'scheduleCheckIn', 'questionTemplateAndInputs']) || {}
      if (Object.keys(questionTemplateAndInputs).length >= 3) {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/add`)
      }

      const displayTemplates = availableTemplates.map((q: any) => {
        const start = q.template.indexOf('{{')
        const end = q.template.indexOf('}}', start)
        let displayTemplate = q.template
        if (start !== -1 && end !== -1) {
          displayTemplate = `${q.template.substring(0, start)}[insert text]${q.template.substring(end + 2)}`
        }
        return { ...q, displayTemplate }
      })

      return res.render('pages/check-in/schedule-check-in/list-questions.njk', {
        crn,
        id,
        back,
        case: offenderDetails.details,
        templatesList: { templates: displayTemplates },
        data,
      })
    }
  },

  postScheduleCheckInQuestionsList: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/add`)
    }
  },

  getScheduleCheckInEditQuestion: hmppsAuthClient => {
    return async (req, res) => {
      const { crn, id, questionId } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_EDIT_QUESTION', crn, SubjectType.CRN)
      const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
      const offenderDetails = res.locals.offenderCheckinsByCRNResponse
      if (!offenderDetails) {
        return renderError(404)(req, res)
      }

      let availableTemplates =
        getDataValue(req.session.data, ['esupervision', crn, id, 'scheduleCheckIn', 'availableTemplates']) || []
      if (availableTemplates.length === 0) {
        const eSupClient = new ESupervisionClient(token)
        const templatesList = await eSupClient.getQuestionsTemplates('en-GB')
        availableTemplates = templatesList.templates.filter(
          (t: any) => t.policy$hmpps_esupervision_api === 'CUSTOMISABLE',
        )
        setDataValue(
          req.session.data,
          ['esupervision', crn, id, 'scheduleCheckIn', 'availableTemplates'],
          availableTemplates,
        )
      }

      const templateId = questionId.split('-')[0]
      const questionForView = parseQuestionTemplate(availableTemplates, templateId)
      if (!questionForView) return renderError(404)(req, res)

      return res.render('pages/check-in/schedule-check-in/edit-question.njk', {
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

  postScheduleCheckInEditQuestion: () => {
    return async (req, res) => {
      const { crn, id, questionId } = req.params as Record<string, string>
      req.session.data = req.session.data ?? {}
      const { data } = req.session

      const inputValue = req.body?.esupervision?.[crn]?.[id]?.scheduleCheckIn?.draftQuestionInput

      if (inputValue && inputValue.trim() !== '') {
        setDataValue(
          data,
          ['esupervision', crn, id, 'scheduleCheckIn', 'questionTemplateAndInputs', questionId],
          inputValue.trim(),
        )
        if (data.esupervision?.[crn]?.[id]?.scheduleCheckIn?.draftQuestionInput !== undefined) {
          delete data.esupervision[crn][id].scheduleCheckIn.draftQuestionInput
        }
      }

      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/add`)
    }
  },

  getScheduleCheckInSelectQuestion: () => {
    return async (req, res) => {
      const { crn, id, templateId } = req.params as Record<string, string>
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_SELECT_QUESTION',
        crn,
        SubjectType.CRN,
      )
      const questionTemplateAndInputs =
        getDataValue(req.session.data, ['esupervision', crn, id, 'scheduleCheckIn', 'questionTemplateAndInputs']) || {}

      if (Object.keys(questionTemplateAndInputs).length >= 3) {
        return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/add`)
      }

      const draftId = `${templateId}-${uuidv4()}`
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/${draftId}/edit`)
    }
  },

  getScheduleCheckInDeleteQuestion: () => {
    return async (req, res) => {
      const { crn, id, questionId } = req.params as Record<string, string>
      req.session.data = req.session.data ?? {}
      const { data } = req.session
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_DELETE_QUESTION',
        crn,
        SubjectType.CRN,
      )
      if (data.esupervision?.[crn]?.[id]?.scheduleCheckIn?.questionTemplateAndInputs?.[questionId]) {
        delete data.esupervision[crn][id].scheduleCheckIn.questionTemplateAndInputs[questionId]
      }
      return res.redirect(`/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/add`)
    }
  },

  getScheduleCheckInPreviewFeeling: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_PREVIEW_FEELING_QUESTIONS',
        crn,
        SubjectType.CRN,
      )
      return res.render('pages/check-in/schedule-check-in/preview/feeling.njk', {
        crn,
        id,
        back,
        data: req.session.data,
      })
    }
  },

  getScheduleCheckInPreviewSupport: () => {
    return async (req, res) => {
      const { crn, id } = req.params as Record<string, string>
      const { back } = req.query
      await sendAuditMessage(
        res,
        'VIEW_MANAGE_ONLINE_CHECK_INS_SCHEDULE_CHECK_IN_PREVIEW_SUPPORT_QUESTIONS',
        crn,
        SubjectType.CRN,
      )
      return res.render('pages/check-in/schedule-check-in/preview/support.njk', {
        crn,
        id,
        back,
        data: req.session.data,
      })
    }
  },
}

export default checkInsController
