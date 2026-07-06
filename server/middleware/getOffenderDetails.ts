import { Route } from '../@types/Route.type'
import { HmppsAuthClient } from '../data'
import ESupervisionClient from '../data/eSupervisionClients'

const getOffenderDetails = (hmppsAuthClient: HmppsAuthClient): Route<Promise<void>> => {
  return async (req, res, next) => {
    const { crn } = req.params as Record<string, string>
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const eSupervisionClient = new ESupervisionClient(token)
    res.locals.offenderCheckinsByCRNResponse = await eSupervisionClient.getOffenderByCRN(crn)
    next()
  }
}
export default getOffenderDetails
