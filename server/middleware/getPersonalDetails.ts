import { Route } from '../@types'
import { HmppsAuthClient } from '../data'
import ESupervisionClient from '../data/eSupervisionClient'

const getPersonalDetails = (hmppsAuthClient: HmppsAuthClient): Route<Promise<void>> => {
  return async (req, res, next) => {
    const { crn } = req.params as Record<string, string>
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const eSupervisionClient = new ESupervisionClient(token)
    res.locals.case = await eSupervisionClient.getPersonalDetails(crn)
    return next()
  }
}

export default getPersonalDetails
