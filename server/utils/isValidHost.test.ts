import { isValidHost } from './isValidHost'
import config from '../config'

describe('utils/isValidHost', () => {
  it('returns true for the eSupervision API url', () => {
    expect(isValidHost(config.apis.eSupervisionApi.url)).toBe(true)
  })
  it('returns true for the HMPPS Auth url', () => {
    expect(isValidHost(config.apis.hmppsAuth.url)).toBe(true)
  })
  it('returns true for the token verification API url', () => {
    expect(isValidHost(config.apis.tokenVerification.url)).toBe(true)
  })
  it('returns false for a host that is not configured', () => {
    expect(isValidHost('https://invalid.example.com')).toBe(false)
  })
})
