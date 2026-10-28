import { NextFunction, Request, Response } from 'express'
import safeBackUrl from '../utils/safeBackUrl'

// `back` is used as a redirect target and rendered into back-link hrefs throughout the service, so drop
// it here if it points off-site (open redirect) or uses a script scheme (XSS via href).
// Express 5 re-parses req.query on every access, so the property itself has to be replaced.
const sanitiseBackParam = (req: Request, _res: Response, next: NextFunction): void => {
  const { back, ...rest } = req.query
  if (back !== undefined && !safeBackUrl(back)) {
    Object.defineProperty(req, 'query', { value: rest, configurable: true, enumerable: true, writable: true })
  }
  next()
}

export default sanitiseBackParam
