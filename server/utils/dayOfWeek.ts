import { DateTime } from 'luxon'
import isBlank from './isBlank'

export const dayOfWeek = (datetimeString: string): string | null => {
  if (!datetimeString || isBlank(datetimeString)) return null
  return DateTime.fromISO(datetimeString).toFormat('cccc')
}

export default dayOfWeek
