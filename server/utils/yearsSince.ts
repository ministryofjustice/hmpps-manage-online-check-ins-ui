import { DateTime } from 'luxon'
import isBlank from './isBlank'

const yearsSince = (datetimeString: string): string | null => {
  if (!datetimeString || isBlank(datetimeString)) return null
  return DateTime.now().diff(DateTime.fromISO(datetimeString), ['years', 'months']).years.toString()
}
export default yearsSince
