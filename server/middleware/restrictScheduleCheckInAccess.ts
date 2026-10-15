import { Route } from '../@types'
import getDataValue from '../utils/getDataValue'
import { isTodayOrLater, isValidDate, isValidDateFormat } from '../utils/validationUtils'

const isValidScheduleCheckInDate = (date: unknown): date is string =>
  typeof date === 'string' && isValidDateFormat([date]) && isValidDate([date]) && isTodayOrLater([date])

const restrictScheduleCheckInAccess = ({ requireDate = false }: { requireDate?: boolean } = {}): Route<
  Promise<void>
> => {
  return async (req, res, next) => {
    const { crn, id } = req.params as Record<string, string>
    const manageUrl = `/case/${crn}/appointments/check-in/manage/${id}`

    if (res.locals.offenderCheckinsByCRNResponse?.mode !== 'AD_HOC') {
      return res.redirect(manageUrl)
    }

    if (requireDate) {
      const date = getDataValue(req.session?.data, ['esupervision', crn, id, 'scheduleCheckIn', 'date'])
      if (!isValidScheduleCheckInDate(date)) {
        return res.redirect(`${manageUrl}/schedule-check-in`)
      }
    }

    return next()
  }
}

export default restrictScheduleCheckInAccess
