import { RiskData } from '@ministryofjustice/hmpps-arns-frontend-components-lib'
import { ESupervisionSession } from '../models/Esupervision'
import { Errors } from '../models/Errors'
import { OffenderByCRNResponse, OffenderHeaderDetails } from './model/esupervision'
import { PersonalDetails } from './model/personalDetails'

export interface CachedPersonalDetails {
  offenderDetails: Partial<OffenderByCRNResponse> | null
  headerDetails: OffenderHeaderDetails | null
  riskData: RiskData
  overview?: PersonalDetails
}

export interface Data {
  errors?: Errors
  esupervision?: {
    [crn: string]: {
      [id: string]: ESupervisionSession
    }
  }
  personalDetails?: {
    [crn: string]: CachedPersonalDetails
  }
}
