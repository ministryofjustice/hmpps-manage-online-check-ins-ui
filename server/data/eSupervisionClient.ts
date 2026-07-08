import config from '../config'

import {
  CheckinScheduleResponse,
  DeactivateOffenderRequest,
  ESupervisionCheckIn,
  OffenderByCRNResponse,
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
}
