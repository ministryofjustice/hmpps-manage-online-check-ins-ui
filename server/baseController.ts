import { Request, Response, NextFunction } from 'express'
import makePageTitle from './utils/makePageTitle'

const baseController = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const url = req.url.split('/').filter(dir => dir)
    res.locals.home = url.length === 0
    res.locals.cases = url[0] === 'case'
    res.locals.makePageTitle = makePageTitle
    return next()
  }
}

export default baseController
