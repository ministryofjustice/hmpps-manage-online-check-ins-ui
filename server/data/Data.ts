import { ESupervisionSession } from '../models/Esupervision'
import { Errors } from './model/Errors'

export interface Data {
  errors?: Errors
  esupervision?: {
    [crn: string]: {
      [id: string]: ESupervisionSession
    }
  }
}
