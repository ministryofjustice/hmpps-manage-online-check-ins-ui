import { Route } from '../@types'
import { HmppsAuthClient } from '../data'
import ESupervisionClient from '../data/eSupervisionClient'
import renderError from './renderError'

const getPersonalDetails = (hmppsAuthClient: HmppsAuthClient): Route<Promise<void>> => {
  return async (req, res, next) => {
    const { crn } = req.params as Record<string, string>
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const eSupervisionClient = new ESupervisionClient(token)
    res.locals.case = await eSupervisionClient.getPersonalDetails(crn)

    if (!res.locals.case) {
      return renderError(404)(req, res)
    }

    return next()
  }
}

export default getPersonalDetails
