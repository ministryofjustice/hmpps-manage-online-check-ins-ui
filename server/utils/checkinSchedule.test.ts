import { DateTime } from 'luxon'
import { fromApiSchedule, nextScheduledDay, toApiSchedule } from './checkinSchedule'

describe('utils/checkinSchedule', () => {
  describe('toApiSchedule', () => {
    it('should send ad-hoc as the mode with no interval', () => {
      expect(toApiSchedule('AD_HOC')).toEqual({ mode: 'AD_HOC' })
    })
    it('should send a standard interval with the scheduled mode', () => {
      expect(toApiSchedule('TWO_WEEKS')).toEqual({ mode: 'SCHEDULED', checkinInterval: 'TWO_WEEKS' })
    })
  })

  describe('fromApiSchedule', () => {
    it('should return ad-hoc when the API reports the ad-hoc mode', () => {
      expect(fromApiSchedule({ mode: 'AD_HOC', checkinInterval: null })).toEqual('AD_HOC')
    })
    it('should return the interval for the scheduled mode', () => {
      expect(fromApiSchedule({ mode: 'SCHEDULED', checkinInterval: 'WEEKLY' })).toEqual('WEEKLY')
    })
    it('should return the interval when the API sends no mode', () => {
      expect(fromApiSchedule({ checkinInterval: 'FOUR_WEEKS' })).toEqual('FOUR_WEEKS')
    })
    it('should return undefined when there is no offender record', () => {
      expect(fromApiSchedule(null)).toBeUndefined()
    })
  })

  describe('nextScheduledDay', () => {
    const today = DateTime.fromISO('2026-10-16')

    it('should keep a first check in that is today or later', () => {
      expect(nextScheduledDay('2026-10-16', 'WEEKLY', today)).toEqual('2026-10-16')
      expect(nextScheduledDay('2026-11-03', 'WEEKLY', today)).toEqual('2026-11-03')
    })
    it('should repeat a past first check in every interval until it reaches today or later', () => {
      expect(nextScheduledDay('2026-09-01', 'WEEKLY', today)).toEqual('2026-10-20')
      expect(nextScheduledDay('2026-09-01', 'FOUR_WEEKS', today)).toEqual('2026-10-27')
    })
    it('should land on today when today is a check in day', () => {
      expect(nextScheduledDay('2026-10-02', 'TWO_WEEKS', today)).toEqual('2026-10-16')
    })
    it('should count whole days across a clock change', () => {
      // British Summer Time ended on 25 October 2026.
      expect(nextScheduledDay('2026-10-19', 'WEEKLY', DateTime.fromISO('2026-11-02'))).toEqual('2026-11-02')
    })
    it('should return undefined without a usable date or interval', () => {
      expect(nextScheduledDay(null, 'WEEKLY', today)).toBeUndefined()
      expect(nextScheduledDay('not a date', 'WEEKLY', today)).toBeUndefined()
      expect(nextScheduledDay('2026-09-01', null, today)).toBeUndefined()
    })
  })
})
