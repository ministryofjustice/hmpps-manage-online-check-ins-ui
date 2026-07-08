import type { Response } from 'express'
import { Errors } from './Errors'
import { OffenderByCRNResponse } from '../data/model/esupervision'

export interface LocalsUser {
  userId?: string
  username?: string
  firstName?: string
  surname?: string
  email?: string
  roles?: string[]
  name?: string
  displayName?: string
  token?: string
  authSource?: string
}

export interface AppLocals extends Record<string, unknown> {
  errorMessages?: Record<string, string>
  warningMessages?: Record<string, string>
  user?: LocalsUser

  applicationName?: string
  environmentName?: string
  environmentNameColour?: string
  asset_path?: string

  csrfToken?: string
  cspNonce?: string
  errors?: Errors

  title?: string
  status?: number
  stack?: boolean | number | string
  version?: string
  backLink?: string

  uploadError?: string
  renderPath?: string
  offenderByCRNResponse?: OffenderByCRNResponse
}

export type AppResponse = Response<unknown, AppLocals>
