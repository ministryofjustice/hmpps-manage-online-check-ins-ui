import config from '../config'

import {
  CheckinScheduleRequest,
  CheckinScheduleResponse,
  DeactivateOffenderRequest,
  EsupervisionAssignQuestionsRequest,
  EsupervisionAssignQuestionsResponse,
  ESupervisionCheckIn,
  ESupervisionNote,
  EsupervisionQuestionTemplatesResponse,
  ESupervisionReview,
  EsupervisionUpcomingQuestionsResponse,
  OffenderInfo,
  OffenderSetup,
  OffenderSetupCompleteResponse,
  ReactivateOffenderRequest,
  UploadLocationResponse,
  EsupervisionUpcomingQuestionItemsResponse,
  OffenderByCRNResponse,
  OffenderHeaderDetails,
} from './model/esupervision'
import { PersonalDetails, PersonalDetailsUpdateRequest, ProbationPractitioner } from './model/personalDetails'
import RestClient from './restClient'

// Temporary responses when config.stubPersonalDetails is true while PI API changes are in progress
const stubbedPersonalDetails = (crn: string): PersonalDetails => ({
  crn,
  name: { forename: 'Dave', surname: 'Tiger' },
  dateOfBirth: '1979-08-18',
  mobileNumber: '07700900000',
  telephoneNumber: '0123456999',
  email: 'address1@example.com',
})

const stubbedProbationPractitioner = (): ProbationPractitioner => ({
  code: 'N99TST1',
  name: { forename: 'Test', surname: 'Practitioner' },
  unallocated: false,
  username: 'TestPractitioner',
  email: 'test.practitioner@example.com',
})

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

  async getOffenderHeaderByCRN(crn: string): Promise<OffenderHeaderDetails | null> {
    return this.get({ path: `/v2/offenders/header/${crn}`, handle404: true })
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

  // POST /v2/offenders/{uuid}/update_details — update check-in date or contact preference
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

  // GET /v2/questions/templates (use in the list questions page)
  async getQuestionsTemplates(language: string = 'en-GB'): Promise<EsupervisionQuestionTemplatesResponse> {
    return this.get({
      path: `/v2/questions/templates?language=${language}`,
    })
  }

  // PUT /v2/questions/assignment (use to assign questions to next check in)
  async putAssignQuestionsToCheckIn(
    crn: string,
    assignQuestionsRequest: EsupervisionAssignQuestionsRequest,
  ): Promise<EsupervisionAssignQuestionsResponse> {
    return this.put({
      path: `/v2/questions/assignment?crn=${crn}`,
      data: assignQuestionsRequest,
    })
  }

  // GET /v2/questions/upcoming/{crn}/question-items (use in the add/edit questions pages)
  async getUpcomingCheckinQuestionItems(
    crn: string,
    language: string = 'en-GB',
  ): Promise<EsupervisionUpcomingQuestionItemsResponse> {
    return this.get({
      path: `/v2/questions/upcoming/${crn}/question-items?language=${language}`,
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

  // DELETE /v2/questions/upcoming/{crn}/question-items (use in the add questions pages if all existing questions are removed and submitted as empty)
  async deleteAssignedQuestionsFromCheckIn(crn: string): Promise<{ message: string }> {
    return this.delete({
      path: `/v2/questions/assignment?crn=${crn}`,
    })
  }

  // GET /v2/offenders/crn/{crn}/personal-details — name and contact details for a PoP.
  // Used by the setup flow before an offender record exists, so it cannot come from getOffenderByCRN.
  async getPersonalDetails(crn: string): Promise<PersonalDetails | null> {
    if (config.stubPersonalDetails) {
      return stubbedPersonalDetails(crn)
    }
    return this.get({ path: `/v2/offenders/crn/${crn}/personal-details`, handle404: true })
  }

  // GET /v2/offenders/crn/{crn}/probation-practitioner — supplies the practitioner id and the
  // unallocated flag that allows/denies entry to the setup flow.
  async getProbationPractitioner(crn: string): Promise<ProbationPractitioner> {
    if (config.stubPersonalDetails) {
      return stubbedProbationPractitioner()
    }
    return this.get({ path: `/v2/offenders/crn/${crn}/probation-practitioner` })
  }

  // POST /v2/offenders/crn/{crn}/contact — writes an edited email/mobile back to the PoP case record.
  async updatePersonalDetailsContact(crn: string, body: PersonalDetailsUpdateRequest): Promise<PersonalDetails | null> {
    if (config.stubPersonalDetails) {
      const stub = stubbedPersonalDetails(crn)
      return {
        ...stub,
        email: body.emailAddress ?? stub.email,
        mobileNumber: body.mobileNumber ?? stub.mobileNumber,
      }
    }
    return this.post({
      data: body,
      path: `/v2/offenders/crn/${crn}/contact`,
      handle404: false,
      handle500: false,
    })
  }
}
