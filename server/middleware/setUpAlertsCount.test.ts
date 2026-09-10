import express from 'express'
import request from 'supertest'
import HmppsAuthClient from '../data/hmppsAuthClient'
import ESupervisionClient from '../data/eSupervisionClient'
import setUpAlertsCount from './setUpAlertsCount'
import logger from '../../logger'

jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

jest.mock('../data/eSupervisionClient')

jest.mock('../data/hmppsAuthClient', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getSystemClientToken: jest.fn().mockImplementation(() => Promise.resolve('token-1')),
    }
  })
})

const mockGetPractitionerAlerts = jest.spyOn(ESupervisionClient.prototype, 'getPractitionerAlerts')

const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>

const buildApp = () => {
  const app = express()
  app.use((_req, res, next) => {
    res.locals.user = { username: 'JOE_BLOGGS' } as any
    next()
  })
  app.use(setUpAlertsCount(hmppsAuthClient))
  app.get('/', (_req, res) => res.json({ alertsCount: res.locals.alertsCount }))
  app.post('/', (_req, res) => res.json({ alertsCount: res.locals.alertsCount }))
  return app
}

describe('setUpAlertsCount', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('attaches the alerts count to res.locals when the count is greater than 0', async () => {
    mockGetPractitionerAlerts.mockResolvedValue({ count: 3 })

    const response = await request(buildApp()).get('/')

    expect(mockGetPractitionerAlerts).toHaveBeenCalledWith('JOE_BLOGGS')
    expect(response.body.alertsCount).toEqual(3)
  })

  it('sets alertsCount to 0 when there are no alerts', async () => {
    mockGetPractitionerAlerts.mockResolvedValue({ count: 0 })

    const response = await request(buildApp()).get('/')

    expect(response.body.alertsCount).toEqual(0)
  })

  it('sets alertsCount to null and logs a warning if the API call fails', async () => {
    mockGetPractitionerAlerts.mockRejectedValue(new Error('API Error'))

    const response = await request(buildApp()).get('/')

    expect(response.body.alertsCount).toBeNull()
    expect(logger.warn).toHaveBeenCalled()
  })
})
