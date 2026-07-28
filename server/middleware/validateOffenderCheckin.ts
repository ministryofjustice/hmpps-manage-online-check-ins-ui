import { Request, NextFunction } from 'express'
import { AppResponse } from '../models/Locals'
import renderError from './renderError'

// Assumes getCheckinOffenderDetails has already populated res.locals.offenderCheckinsByCRNResponse.
// The offender is fetched by CRN and carries its own uuid; the manage routes' :id param is that
// same uuid. If it's missing (CRN not found) or doesn't match, the crn and id aren't associated
// with each other, so treat the page as not found rather than rendering another offender's data.
const validateOffenderCheckin = (req: Request, res: AppResponse, next: NextFunction): void => {
  const { id } = req.params as Record<string, string>
  const offender = res.locals.offenderCheckinsByCRNResponse
  if (!offender || offender.uuid !== id) {
    renderError(404)(req, res)
    return
  }
  next()
}

export default validateOffenderCheckin
