import httpMocks from 'node-mocks-http'
import type { Response } from 'express'
import { ArnsComponents } from '@ministryofjustice/hmpps-arns-frontend-components-lib'
import { getPersonalDetails } from './getPersonalDetails'
import ESupervisionClient from '../data/eSupervisionClient'
import { HmppsAuthClient } from '../data'

jest.mock('../data/eSupervisionClient')
jest.mock('../config', () => {
  const actual = jest.requireActual('../config')
  return { __esModule: true, default: { ...actual.default, production: true } }
})

const crn = 'X778160'

const hmppsAuthClient = {
  getSystemClientToken: jest.fn().mockResolvedValue('a-system-token'),
} as unknown as HmppsAuthClient

const arnsComponents = { getRiskData: jest.fn().mockResolvedValue({}) } as unknown as ArnsComponents

const offenderDetails = { details: { name: { forename: 'Ann', surname: 'Smith' } } }

const buildReq = () =>
  httpMocks.createRequest({
    params: { crn },
    session: {
      data: { personalDetails: { [crn]: { offenderDetails, headerDetails: { tierScore: 'G' } } } },
    },
  })

const buildRes = () => ({ locals: { user: { username: 'a-user', token: 'a-token' } } }) as unknown as Response

describe('getPersonalDetails', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.mocked(ESupervisionClient).mockImplementation(
      () =>
        ({
          getOffenderByCRN: jest.fn().mockResolvedValue(offenderDetails),
          getOffenderHeaderByCRN: jest.fn().mockResolvedValue({ tierScore: 'NOT_SUPERVISED' }),
        }) as unknown as ESupervisionClient,
    )
  })

  it('uses the session cache by default', async () => {
    const req = buildReq()
    const res = buildRes()

    await getPersonalDetails(hmppsAuthClient, arnsComponents)(req, res, jest.fn())

    expect(res.locals.tierScore).toBe('G')
  })

  it('re-fetches and re-caches the header when asked to refresh', async () => {
    const req = buildReq()
    const res = buildRes()
    const next = jest.fn()

    await getPersonalDetails(hmppsAuthClient, arnsComponents, { refresh: true })(req, res, next)

    expect(res.locals.tierScore).toBe('NOT_SUPERVISED')
    expect(req.session.data.personalDetails[crn].headerDetails.tierScore).toBe('NOT_SUPERVISED')
    expect(next).toHaveBeenCalledTimes(1)
  })
})
