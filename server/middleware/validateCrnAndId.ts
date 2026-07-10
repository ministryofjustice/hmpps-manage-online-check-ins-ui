import { Request, Response, NextFunction } from 'express'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import renderError from './renderError'

const validateCrnAndId = (req: Request, res: Response, next: NextFunction): void => {
  const { crn, id } = req.params as Record<string, string>
  if (!isValidCrn(crn) || !isValidUUID(id)) {
    renderError(404)(req, res)
    return
  }
  next()
}

export default validateCrnAndId
