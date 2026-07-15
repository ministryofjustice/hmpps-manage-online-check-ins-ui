import config from '../config'

import {
  CheckinScheduleRequest,
  CheckinScheduleResponse,
  DeactivateOffenderRequest,
  ESupervisionCheckIn,
  ESupervisionNote,
  ESupervisionReview,
  EsupervisionUpcomingQuestionsResponse,
  OffenderByCRNResponse,
  OffenderInfo,
  OffenderSetup,
  OffenderSetupCompleteResponse,
  ReactivateOffenderRequest,
  UploadLocationResponse,
} from './model/esupervision'
import RestClient from './restClient'

export default class ESupervisionClient extends RestClient {
  constructor(token: string) {
    super('HMPPS E-Supervision API', config.apis.eSupervisionApi, token)
  }

  async postOffenderSetup(body: OffenderInfo): Promise<OffenderSetup> {
    return this.post({
      data: body,
      path: `/v2/offender_setup`,
      errorMessage: 'Failed to post offender checkin details',
    })
  }

  async getProfilePhotoUploadLocation(
    offenderSetup: OffenderSetup,
    photoContentType: string,
    contentSha256Base64: string,
  ): Promise<UploadLocationResponse> {
    return this.post({
      path: `/v2/offender_setup/${offenderSetup.uuid}/upload_location`,
      query: { 'content-type': photoContentType },
      headers: { 'Content-Type': 'application/json' },
      data: { sha256: contentSha256Base64 },
      errorMessage: 'Failed to fetch check-in upload location',
    })
  }

  async postOffenderSetupComplete(setupId: string): Promise<OffenderSetupCompleteResponse> {
    return this.post({
      path: `/v2/offender_setup/${setupId}/complete`,
      errorMessage: 'Failed to complete offender checkin registration',
    })
  }

  async getOffenderCheckIn(uuid: string, personalDetails: boolean = true): Promise<ESupervisionCheckIn> {
    return this.get({
      path: `/v2/offender_checkins/${uuid}?include-personal-details=${personalDetails}`,
    })
  }

  async getOffenderByCRN(crn: string): Promise<OffenderByCRNResponse | null> {
    return this.get({ path: `/v2/offenders/crn/${crn}?include-personal-details=true`, handle404: true })
  }

  async postDeactivateOffender(
    uuid: string,
    deactivateOffenderRequest: DeactivateOffenderRequest,
  ): Promise<CheckinScheduleResponse> {
    return this.post({
      path: `/v2/offenders/${uuid}/deactivate`,
      data: deactivateOffenderRequest,
    })
  }

  async postOffenderCheckInReview(uuid: string, review: ESupervisionReview): Promise<ESupervisionCheckIn> {
    return this.post({
      path: `/v2/offender_checkins/${uuid}/review`,
      data: review,
    })
  }

  async postOffenderCheckInStarted(uuid: string, practitioner: string): Promise<ESupervisionCheckIn> {
    return this.post({
      path: `/v2/offender_checkins/${uuid}/review-started`,
      data: { practitionerId: practitioner },
    })
  }

  async postOffenderCheckInNote(uuid: string, notes: ESupervisionNote): Promise<void> {
    return this.post({
      path: `/v2/offender_checkins/${uuid}/annotate`,
      data: notes,
    })
  }

  // POST /v2/offenders/{uuid}/update_details — update check-in schedule (date/interval) or contact preference
  async postUpdateOffenderDetails(
    uuid: string,
    checkinScheduleRequest: CheckinScheduleRequest,
  ): Promise<CheckinScheduleResponse> {
    return this.post({
      path: `/v2/offenders/${uuid}/update_details`,
      data: checkinScheduleRequest,
    })
  }

  // POST /v2/offenders/{uuid}/reactivate — restart stopped check-ins
  async postReactivateOffender(
    uuid: string,
    reactivateOffenderRequest: ReactivateOffenderRequest,
  ): Promise<CheckinScheduleResponse> {
    return this.post({
      path: `/v2/offenders/${uuid}/reactivate`,
      data: reactivateOffenderRequest,
    })
  }

  // GET /v2/questions/upcoming/{crn}/offender-questions (use in the manage check in page)
  async getUpcomingCheckinQuestions(
    crn: string,
    language: string = 'en-GB',
  ): Promise<EsupervisionUpcomingQuestionsResponse> {
    return this.get({
      path: `/v2/questions/upcoming/${crn}/offender-questions?language=${language}`,
    })
  }
}
