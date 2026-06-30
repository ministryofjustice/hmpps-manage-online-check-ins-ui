import EsupervisionApiClient from '../data/eSupervisionClients'
import { ESupervisionCheckIn, TemporaryOffenderResponse } from '../data/model/esupervision'

export default class EsupervisionService {
  constructor(private readonly esupervisionApiClient: EsupervisionApiClient) {}

  getOffenderByCrn(crn: string): Promise<TemporaryOffenderResponse> {
    return this.esupervisionApiClient.getOffenderByCrn(crn)
  }

  getCheckIn(uuid: string, includePersonalDetails = true): Promise<ESupervisionCheckIn> {
    return this.esupervisionApiClient.getCheckIn(uuid, includePersonalDetails)
  }
}
