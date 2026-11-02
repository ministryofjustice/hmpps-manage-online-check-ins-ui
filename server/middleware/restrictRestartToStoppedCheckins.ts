import { Request, NextFunction } from 'express'
import { AppResponse } from '../models/Locals'

// Assumes getCheckinOffenderDetails has already populated res.locals.offenderCheckinsByCRNResponse.
// Only stopped check ins can be restarted, so once they are running again (e.g. Back from the
// confirmation page) the restart pages send the practitioner to the manage page instead.
const restrictRestartToStoppedCheckins = (req: Request, res: AppResponse, next: NextFunction): void => {
  const { crn, id } = req.params as Record<string, string>
  if (res.locals.offenderCheckinsByCRNResponse?.status !== 'INACTIVE') {
    res.redirect(`/case/${crn}/appointments/check-in/manage/${id}`)
    return
  }
  next()
}

export default restrictRestartToStoppedCheckins
