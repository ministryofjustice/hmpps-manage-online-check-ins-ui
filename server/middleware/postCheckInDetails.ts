import { DateTime } from 'luxon'
import { HmppsAuthClient } from '../data'
import { Route } from '../@types'
import ESupervisionClient from '../data/eSupervisionClient'
import { OffenderInfo, OffenderSetup, UploadLocationResponse } from '../data/model/esupervision'
import { ProbationPractitioner } from '../data/model/personalDetails'
import { eligibilityAnswersFromSelections } from '../utils/eligibilityRules'
import logger from '../../logger'
import { toApiSchedule } from '../utils/checkinSchedule'

export const postCheckInDetails = (
  hmppsAuthClient: HmppsAuthClient,
): Route<Promise<{ setup: OffenderSetup; uploadLocation: UploadLocationResponse }>> => {
  return async (req, res) => {
    const { crn, id } = req.params as Record<string, string>
    // The browser sends a base64-encoded SHA-256 digest (see assets/js/photo.js sha256Base64).
    // S3 enforces the matching x-amz-checksum-sha256 on the PUT, so we only guard presence here.
    const contentSha256 = typeof req.body?.contentSha256 === 'string' ? req.body.contentSha256.trim() : ''
    if (!contentSha256) {
      logger.error('Checkin Registration rejected: missing contentSha256')
      throw Object.assign(new Error('contentSha256 is required'), {
        data: { status: 400, userMessage: 'contentSha256 is required' },
      })
    }
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const eSupervisionClient = new ESupervisionClient(token)
    const savedUserDetails = req.session.data?.esupervision?.[crn]?.[id]?.checkins

    // The date is captured as d/M/yyyy but the API expects yyyy/M/dd.
    const parsedFirstCheckin = DateTime.fromFormat(savedUserDetails?.date ?? '', 'd/M/yyyy')
    const firstCheckinDate = parsedFirstCheckin.isValid
      ? parsedFirstCheckin.toFormat('yyyy/M/dd')
      : savedUserDetails?.date

    // Setup records the practitioner the person is allocated to - never the signed-in user in their
    // place. Without one who can sign in, the person can't be set up: the same reason the ESUP API's
    // eligibility rules give (IS_PRACTITIONER_ASSIGNED), shown on the page.
    const pp: ProbationPractitioner | null = await eSupervisionClient.getProbationPractitioner(crn)
    const practitionerId = pp && !pp.unallocated ? pp.username?.trim() : undefined
    if (!practitionerId) {
      logger.warn(`Checkin Registration rejected for crn ${crn}: no allocated practitioner who can sign in`)
      const name = res.locals.case?.name
      const person = name ? `${name.forename} ${name.surname}` : 'The person'
      throw Object.assign(new Error('No allocated practitioner'), {
        data: {
          status: 422,
          userMessage: `${person} must have probation practitioner assigned to them before they can be set up to use online check ins`,
        },
      })
    }
    const data: OffenderInfo = {
      setupUuid: id,
      ...(res.locals.flags?.enableSentenceSelection === true ? { currentEvent: savedUserDetails.currentEvent } : {}),
      practitionerId,
      crn,
      // An ad-hoc setup schedules no first check in. The date is normally cleared when ad-hoc is
      // chosen, but a stale date-page submission can put one back, so decide here from the mode.
      ...(savedUserDetails.interval === 'AD_HOC' ? {} : { firstCheckin: firstCheckinDate }),
      ...toApiSchedule(savedUserDetails.interval),
      // Recorded by getStartSetup. Left unset if the session lost it, rather than defaulting to now,
      // which would record a setup time of zero.
      startedAt: req.session.data?.esupervision?.[crn]?.[id]?.setupStartedAt,
      contactPreference: savedUserDetails.preferredComs,
      rationale: savedUserDetails.rationale,
      eligibilityAnswers: eligibilityAnswersFromSelections(savedUserDetails?.eligibility, savedUserDetails?.tierBand),
    }
    logger.info('Checkin Registration started')
    try {
      const setup: OffenderSetup = await eSupervisionClient.postOffenderSetup(data)
      // Setup just created the offender/practitioner records, so any personal-details cache
      // entry for this CRN (from a pre-setup 404) is now stale - drop it so getPersonalDetails
      // re-fetches fresh data on the next page (confirmation, manage, etc).
      delete req.session.data?.personalDetails?.[crn]
      const uploadLocation: UploadLocationResponse = await eSupervisionClient.getProfilePhotoUploadLocation(
        setup,
        'image/jpeg',
        contentSha256,
      )
      return { setup, uploadLocation }
    } catch (error) {
      const statusCode = error?.data?.status || 500
      logger.error(`locationInfo statusCode : ${statusCode}`)
      // Re-throw so the caller can surface the failure to the browser.
      throw error
    }
  }
}
