import { Route } from '../@types'
import { HmppsAuthClient } from '../data'
import ESupervisionClient from '../data/eSupervisionClient'

// Fetches whether the person is on a supervision package before eligibility-check renders or
// is posted, so the eligibility rules can trust this fact instead of a manual checkbox.
export const getSupervisionPackageStatus = (hmppsAuthClient: HmppsAuthClient): Route<Promise<void>> => {
  return async (req, res, next) => {
    const { crn } = req.params as Record<string, string>
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const eSupervisionClient = new ESupervisionClient(token)

    res.locals.supervisionPackageStatus = await eSupervisionClient.getSupervisionPackageStatus(crn)

    return next()
  }
}
