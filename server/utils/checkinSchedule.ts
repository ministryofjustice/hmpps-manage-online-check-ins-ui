import { DateTime } from 'luxon'
import { CheckInterval, CheckinMode } from '../data/model/esupervision'

// The frequency radios offer ad-hoc as one more interval, but the API models it as a check-in mode
// with no interval at all - it rejects AD_HOC as an interval, and rejects any interval sent alongside
// the AD_HOC mode. These translate between the two at the API boundary.
export type CheckinFrequency = CheckInterval | 'AD_HOC'

// The mode is always sent, even for a standard interval: without it the API validates the interval
// against the person's current mode, so moving someone from ad-hoc back to an interval would fail.
export const toApiSchedule = (frequency: CheckinFrequency): { mode: CheckinMode; checkinInterval?: CheckInterval } =>
  frequency === 'AD_HOC' ? { mode: 'AD_HOC' } : { mode: 'SCHEDULED', checkinInterval: frequency }

export const fromApiSchedule = (
  schedule?: { mode?: CheckinMode; checkinInterval?: CheckInterval | null } | null,
): CheckinFrequency | undefined => (schedule?.mode === 'AD_HOC' ? 'AD_HOC' : (schedule?.checkinInterval ?? undefined))

const intervalDays: Record<CheckInterval, number> = { WEEKLY: 7, TWO_WEEKS: 14, FOUR_WEEKS: 28, EIGHT_WEEKS: 56 }

// The next day a scheduled person's check in falls on, as an ISO date. The API runs the schedule
// from firstCheckin and repeats it every interval, so this is the first repeat on or after notBefore,
// which defaults to today. Undefined when there is no usable date or interval to repeat.
export const nextScheduledDay = (
  firstCheckin?: string | null,
  interval?: CheckInterval | null,
  notBefore: DateTime = DateTime.now(),
): string | undefined => {
  const start = DateTime.fromISO(firstCheckin ?? '').startOf('day')
  const days = interval ? intervalDays[interval] : undefined
  if (!start.isValid || !days) return undefined
  const from = notBefore.startOf('day')
  if (start >= from) return start.toISODate()
  // Rounded so a clock change between the two dates cannot push the day count past a whole number.
  const elapsedDays = Math.round(from.diff(start, 'days').days)
  return start.plus({ days: Math.ceil(elapsedDays / days) * days }).toISODate()
}
