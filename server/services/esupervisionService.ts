import EsupervisionApiClient from '../data/eSupervisionClients'
import { TemporaryOffenderResponse } from '../data/model/esupervision'

export default class EsupervisionService {
  constructor(private readonly esupervisionApiClient: EsupervisionApiClient) {}

  getOffenderByCrn(crn: string): Promise<TemporaryOffenderResponse> {
    return this.esupervisionApiClient.getOffenderByCrn(crn)
  }
}
