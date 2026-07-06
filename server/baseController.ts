import { Request, Response, NextFunction } from 'express'

const baseController = () => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const url = req.url.split('/').filter(dir => dir)
    res.locals.home = url.length === 0
    res.locals.cases = url[0] === 'case'
    return next()
  }
}

export default baseController
