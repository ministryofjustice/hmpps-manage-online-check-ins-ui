import config from '../config'

import {
  CheckinScheduleResponse,
  DeactivateOffenderRequest,
  ESupervisionCheckIn,
  ESupervisionNote,
  ESupervisionReview,
  OffenderCheckinsByCRNResponse,
} from './model/esupervision'
import RestClient from './restClient'

export default class ESupervisionClient extends RestClient {
  constructor(token: string) {
    super('HMPPS E-Supervision API', config.apis.eSupervisionApi, token)
  }

  async getOffenderCheckIn(uuid: string, personalDetails: boolean = true): Promise<ESupervisionCheckIn> {
    return this.get({
      path: `/v2/offender_checkins/${uuid}?include-personal-details=${personalDetails}`,
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

  async getOffenderCheckinsByCRN(crn: string): Promise<OffenderCheckinsByCRNResponse | null> {
    return this.get({ path: `/v2/offenders/crn/${crn}`, handle404: true })
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
}
