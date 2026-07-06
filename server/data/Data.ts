import { ESupervisionSession } from '../models/Esupervision'
import { Errors } from '../models/Errors'

export interface Data {
  errors?: Errors
  esupervision?: {
    [crn: string]: {
      [id: string]: ESupervisionSession
    }
  }
}
