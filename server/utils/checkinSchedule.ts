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
