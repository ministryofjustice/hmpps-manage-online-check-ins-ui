import { Route } from '../@types'
import { HmppsAuthClient } from '../data'
import ESupervisionClient from '../data/eSupervisionClient'

const getCheckinOffenderDetails = (hmppsAuthClient: HmppsAuthClient): Route<Promise<void>> => {
  return async (req, res, next) => {
    const { crn } = req.params as Record<string, string>
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const eSupervisionClient = new ESupervisionClient(token)
    res.locals.offenderByCRNResponse = await eSupervisionClient.getOffenderByCRN(crn)
    return next()
  }
}
export default getCheckinOffenderDetails
