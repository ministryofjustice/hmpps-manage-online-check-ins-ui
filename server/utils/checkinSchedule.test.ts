import { fromApiSchedule, toApiSchedule } from './checkinSchedule'

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
})
