import type { Express } from 'express'
import request from 'supertest'
import { appWithAllRoutes, user } from './testutils/appSetup'
import AuditService from '../services/auditService'
import HmppsAuditClient from '../data/hmppsAuditClient'
import EsupervisionService from '../services/esupervisionService'
import { EsupervisionApiClient } from '../data'

jest.mock('../services/auditService')
jest.mock('../services/esupervisionService')

const auditService = new AuditService({} as HmppsAuditClient) as jest.Mocked<AuditService>
const esupervisionService = new EsupervisionService({} as EsupervisionApiClient) as jest.Mocked<EsupervisionService>

let app: Express

beforeEach(() => {
  app = appWithAllRoutes({
    services: {
      auditService,
      esupervisionService,
    },
    userSupplier: () => user,
  })
})

afterEach(() => {
  jest.resetAllMocks()
})

describe('GET /', () => {
  it('should render the index page', () => {
    return request(app)
      .get('/')
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(res.text).toContain('This site is under construction...')
      })
  })
})

describe('GET /case/:crn/appointments/:checkinId/check-in/review/identity', () => {
  const crn = 'X885938'
  const checkinId = 'e75d0bb3-637c-4833-8fc2-6cee85f4adc6'

  it('should render the review identity page with check-in details', () => {
    esupervisionService.getCheckIn.mockResolvedValue({
      uuid: checkinId,
      autoIdCheck: 'MATCH',
      manualIdCheck: 'NO_MATCH',
      livenessResult: 'LIVE',
      personalDetails: {
        name: { forename: 'Joe', surname: 'Bloggs' },
      },
    } as never)

    return request(app)
      .get(`/case/${crn}/appointments/${checkinId}/check-in/review/identity`)
      .expect('Content-Type', /html/)
      .expect(200)
      .expect(res => {
        expect(esupervisionService.getCheckIn).toHaveBeenCalledWith(checkinId, true)
        expect(res.text).toContain('Identity')
        expect(res.text).toContain('Joe Bloggs')
      })
  })
})
