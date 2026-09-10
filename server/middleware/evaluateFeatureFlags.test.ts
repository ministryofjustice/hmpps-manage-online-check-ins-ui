import httpMocks from 'node-mocks-http'
import type { Response } from 'express'
import evaluateFeatureFlags from './evaluateFeatureFlags'
import FeatureFlagService from '../services/featureFlagService'

jest.mock('../services/featureFlagService')

describe('evaluateFeatureFlags', () => {
  const req = httpMocks.createRequest({ params: { crn: 'X778160' } })
  const nextSpy = jest.fn()

  const resFor = () =>
    ({
      locals: {},
    }) as unknown as Response

  afterEach(() => {
    jest.clearAllMocks()
  })

  it('evaluates each given boolean flag and stores the results under their flag key', async () => {
    const featureFlagService = new FeatureFlagService() as jest.Mocked<FeatureFlagService>
    featureFlagService.evaluateBoolean.mockImplementation(async flagKey => flagKey === 'flag-one')
    const res = resFor()

    await evaluateFeatureFlags(featureFlagService, [
      { key: 'flag-one', type: 'boolean' },
      { key: 'flag-two', type: 'boolean' },
    ])(req, res, nextSpy)

    expect(featureFlagService.evaluateBoolean).toHaveBeenCalledWith('flag-one', 'global')
    expect(featureFlagService.evaluateBoolean).toHaveBeenCalledWith('flag-two', 'global')
    expect(res.locals.flags['flag-one']).toBe(true)
    expect(res.locals.flags['flag-two']).toBe(false)
    expect(nextSpy).toHaveBeenCalled()
  })

  it('evaluates variant flags via evaluateVariant and stores the matched variant key', async () => {
    const featureFlagService = new FeatureFlagService() as jest.Mocked<FeatureFlagService>
    featureFlagService.evaluateVariant.mockResolvedValue('v2')
    const res = resFor()

    await evaluateFeatureFlags(featureFlagService, [{ key: 'template-version', type: 'variant' }])(req, res, nextSpy)

    expect(featureFlagService.evaluateVariant).toHaveBeenCalledWith('template-version', 'global')
    expect(featureFlagService.evaluateBoolean).not.toHaveBeenCalled()
    expect(res.locals.flags['template-version']).toBe('v2')
    expect(nextSpy).toHaveBeenCalled()
  })

  it('defaults to the configured feature flags when none are given', async () => {
    const featureFlagService = new FeatureFlagService() as jest.Mocked<FeatureFlagService>
    featureFlagService.evaluateBoolean.mockResolvedValue(true)
    const res = resFor()

    await evaluateFeatureFlags(featureFlagService)(req, res, nextSpy)

    expect(featureFlagService.evaluateBoolean).toHaveBeenCalledWith('eligibilityFeatureToggle', 'global')
    expect(res.locals.flags.eligibilityFeatureToggle).toBe(true)
    expect(nextSpy).toHaveBeenCalled()
  })
})
