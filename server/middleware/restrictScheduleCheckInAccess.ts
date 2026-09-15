import { Route } from '../@types'
import getDataValue from '../utils/getDataValue'

// Guards the ad hoc ("schedule check-in") journey, which is session-only and feature-flagged.
//
// Two things to stop:
//   1. Access at all while enableAdHocCheckIns is off - every route in the journey bounces back
//      to the check-in's manage page, so the feature is unreachable rather than half-visible.
//   2. Deep-linking into the questions pages before a date has been chosen. The date is the first
//      step and the questions pages read it from session, so without it they render a blank date
//      and the created check-in would have nothing to schedule against.
//
// Runs ahead of validate.eSuperVision, which would otherwise render the ad hoc views itself
// when a submission fails validation - regardless of the flag.
const restrictScheduleCheckInAccess = ({ requireDate = false }: { requireDate?: boolean } = {}): Route<
  Promise<void>
> => {
  return async (req, res, next) => {
    const { crn, id } = req.params as Record<string, string>
    const manageUrl = `/case/${crn}/appointments/check-in/manage/${id}`

    if (!res.locals.flags?.enableAdHocCheckIns) {
      return res.redirect(manageUrl)
    }

    if (requireDate) {
      const date = getDataValue(req.session?.data, ['esupervision', crn, id, 'scheduleCheckIn', 'date'])
      if (!date) {
        return res.redirect(`${manageUrl}/schedule-check-in`)
      }
    }

    return next()
  }
}

export default restrictScheduleCheckInAccess
