import { AuthenticationClient, RestClient, asSystem } from '@ministryofjustice/hmpps-rest-client'
import config from '../config'
import logger from '../../logger'
import { TemporaryOffenderResponse } from './model/esupervision'

export default class EsupervisionApiClient extends RestClient {
  constructor(authenticationClient: AuthenticationClient) {
    super('eSupervision API', config.apis.esupervisionApi, logger, authenticationClient)
  }

  async getOffenderByCrn(crn: string): Promise<TemporaryOffenderResponse> {
    const offender = await this.get<TemporaryOffenderResponse>(
      {
        path: `/v2/offenders/crn/${crn}`,
      },
      asSystem(),
    )
    return {
      // actually comes from the endpoint
      offender,

      // mock data
      tierCalculation: {
        tierScore: 'A3',
      },

      risksWidget: {
        overallRisk: 'VERY_HIGH',
      },

      riskData: {
        assessments: [
          {
            combinedSeriousReoffendingPredictor: {
              band: 'HIGH',
              score: 78,
            },
            rsr: {
              band: 'MEDIUM',
              score: 6.8,
            },
          },
        ],
      },

      headerTierLink: `/case/${crn}/tier`,
    }
  }
}
