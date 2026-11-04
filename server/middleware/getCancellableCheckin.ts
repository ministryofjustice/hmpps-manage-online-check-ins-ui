import { Route } from '../@types'
import { HmppsAuthClient } from '../data'
import ESupervisionClient from '../data/eSupervisionClient'
import logger from '../../logger'

// Finds the check-in a practitioner could cancel for the person and puts it on
// res.locals.cancellableCheckin (null when there is none). The upcoming-questions response, which
// the overview already reads for the next check-in's date and questions, carries the uuid of that
// check-in once it exists (SCHEDULED, or CREATED once the invite is sent). Anyone who can see the
// overview can cancel it: the lookup is by CRN, not by practitioner.
//
// The response is kept on res.locals.upcomingCheckin so the overview page need not fetch it again.
//
// Assumes getCheckinOffenderDetails has already populated res.locals.offenderCheckinsByCRNResponse.
const getCancellableCheckin = (hmppsAuthClient: HmppsAuthClient): Route<Promise<void>> => {
  return async (req, res, next) => {
    const { crn } = req.params as Record<string, string>
    const offender = res.locals.offenderCheckinsByCRNResponse
    res.locals.cancellableCheckin = null
    if (offender?.status !== 'VERIFIED') {
      return next()
    }
    const token = await hmppsAuthClient.getSystemClientToken(res.locals.user.username)
    const eSupervisionClient = new ESupervisionClient(token)
    try {
      res.locals.upcomingCheckin = (await eSupervisionClient.getUpcomingCheckinQuestions(crn)) ?? null
    } catch {
      // The API answers 4xx when the person has nothing upcoming, which is a normal state.
      logger.info(`No upcoming check in questions found for CRN ${crn}`)
      res.locals.upcomingCheckin = null
    }
    const upcoming = res.locals.upcomingCheckin
    if (upcoming?.checkinUuid) {
      res.locals.cancellableCheckin = { uuid: upcoming.checkinUuid }
    }
    return next()
  }
}

export default getCancellableCheckin
