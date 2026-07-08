import nunjucksSetup from './nunjucksSetup'
import { appWithAllRoutes } from '../routes/testutils/appSetup'
import { ApplicationInfo } from '../applicationInfo'
import type { Services } from '../services'
import logger from '../../logger'

jest.mock('../../logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
}))

jest.mock('../config', () => ({
  ...jest.requireActual('../config'),
  __esModule: true,
  default: {
    ...jest.requireActual('../config').default,
    environmentName: 'PRE-PRODUCTION',
    apis: {
      hmppsAuth: {
        url: 'http://mock-url',
        externalUrl: 'http://mock-url',
        timeout: {
          response: 1000,
          deadline: 1000,
        },
        agent: {},
        apiClientId: 'id',
        apiClientSecret: 'secret',
        systemClientId: 'id',
        systemClientSecret: 'secret',
      },
      eSupervisionApi: {
        url: 'http://mock-esupervision-api',
        timeout: {
          response: 1000,
          deadline: 1000,
        },
        agent: {},
      },
    },
  },
}))

const mockHmppsAuthClient = {
  getSystemClientToken: jest.fn().mockResolvedValue('mock-system-token'),
}

const mockAuditService = {
  sendAuditMessage: jest.fn(),
}

const mockEsupervisionService = {
  getOffenderByCrn: jest.fn(),
  postDeactivateOffender: jest.fn(),
}

const mockAppInfo: ApplicationInfo = {
  applicationName: '',
  version: '',
  buildNumber: '',
  gitRef: '',
  gitShortHash: '#gitShortHash',
  productId: '',
  branchName: '',
}

const mockServices: Services = {
  applicationInfo: mockAppInfo,
  hmppsAuthClient: mockHmppsAuthClient,
  auditService: mockAuditService,
  esupervisionService: mockEsupervisionService,
} as unknown as Services

const app = appWithAllRoutes({ services: mockServices })

describe('utils/nunjucksSetup', () => {
  afterEach(() => {
    jest.clearAllMocks()
    delete process.env.NODE_ENV
  })

  it('should set the app.locals.environmentNameColour to the correct value', () => {
    nunjucksSetup(app)

    expect(app.locals.environmentNameColour).toEqual('govuk-tag--green')
  })

  it('falls back to the undecorated object when decorateFormAttributes is called without request context', () => {
    nunjucksSetup(app)

    const njkEnv = app.get('nunjucksEnv')

    const html = njkEnv.renderString(
      `
      {% set cfg = { value: 'original-value' } | decorateFormAttributes(['esupervision', 'CRN1', 'ID1', 'manageCheckin', 'stopCheckinReason']) %}
      {{ cfg.value }}
    `,
      {},
    )

    expect(html.trim()).toEqual('original-value')
    expect(logger.warn).toHaveBeenCalledWith('decorateFormAttributes called without request context')
  })
})
