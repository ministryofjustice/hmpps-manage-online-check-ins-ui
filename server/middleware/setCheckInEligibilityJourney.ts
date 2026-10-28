import { Route } from '../@types'
import { CheckInEligibilityJourney } from '../utils/checkInEligibilityContext'

const setCheckInEligibilityJourney = (journey: CheckInEligibilityJourney): Route<void> => {
  return (_req, res, next) => {
    res.locals.checkInEligibilityJourney = journey
    return next?.()
  }
}

export default setCheckInEligibilityJourney
