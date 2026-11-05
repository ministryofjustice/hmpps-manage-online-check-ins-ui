import httpMocks from 'node-mocks-http'
import type { Response } from 'express'
import { ArnsComponents } from '@ministryofjustice/hmpps-arns-frontend-components-lib'
import { getPersonalDetails } from './getPersonalDetails'
import ESupervisionClient from '../data/eSupervisionClient'
import { HmppsAuthClient } from '../data'
import type { NdeliusEvent } from '../data/model/personalDetails'

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

const offenderDetails = {
  details: {
    name: { forename: 'Ann', surname: 'Smith' },
    dateOfBirth: '1980-01-01',
    mobile: '07700900000',
    email: 'ann@example.com',
  },
}

const buildReq = () =>
  httpMocks.createRequest({
    params: { crn },
    session: {
      data: { personalDetails: { [crn]: { offenderDetails, headerDetails: { tierScore: 'G' } } } },
    },
  })

const buildRes = (flags: Record<string, boolean> = { enableSentenceSelection: true }) =>
  ({ locals: { user: { username: 'a-user', token: 'a-token' }, flags } }) as unknown as Response

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

  it('exposes fresh setup events from the single personal-details lookup', async () => {
    const events: NdeliusEvent[] = [{ number: 1, mainOffence: { code: '001', description: 'Offence' }, sentence: null }]
    const getPersonalDetailsSpy = jest.fn().mockResolvedValue({
      name: { forename: 'Ann', surname: 'Smith' },
      events,
    })
    jest.mocked(ESupervisionClient).mockImplementation(
      () =>
        ({
          getOffenderByCRN: jest.fn().mockResolvedValue(null),
          getOffenderHeaderByCRN: jest.fn().mockResolvedValue({ tierScore: 'G' }),
          getPersonalDetails: getPersonalDetailsSpy,
        }) as unknown as ESupervisionClient,
    )
    const req = buildReq()
    req.session.data.personalDetails[crn].offenderDetails = null
    const res = buildRes()

    await getPersonalDetails(hmppsAuthClient, arnsComponents, { refreshEvents: true })(req, res, jest.fn())

    expect(res.locals.sentenceEvents).toEqual(events)
    expect(getPersonalDetailsSpy).toHaveBeenCalledTimes(1)
    expect(hmppsAuthClient.getSystemClientToken).toHaveBeenCalledTimes(1)
  })

  it('refreshes events without invalidating the cached header', async () => {
    const events: NdeliusEvent[] = [{ number: 2, mainOffence: { code: '002', description: 'Offence' }, sentence: null }]
    const getOffenderByCRNSpy = jest.fn()
    const getPersonalDetailsSpy = jest.fn().mockResolvedValue({
      name: { forename: 'Different', surname: 'Name' },
      dateOfBirth: '1990-02-02',
      mobile: '07700900111',
      email: 'different@example.com',
      events,
    })
    jest.mocked(ESupervisionClient).mockImplementation(
      () =>
        ({
          getOffenderByCRN: getOffenderByCRNSpy,
          getPersonalDetails: getPersonalDetailsSpy,
        }) as unknown as ESupervisionClient,
    )
    const req = buildReq()
    const res = buildRes()

    await getPersonalDetails(hmppsAuthClient, arnsComponents, { refreshEvents: true })(req, res, jest.fn())

    expect(res.locals.sentenceEvents).toEqual(events)
    expect(res.locals.tierScore).toBe('G')
    expect(res.locals.headerPersonName).toEqual(offenderDetails.details.name)
    expect(res.locals.case).toMatchObject({
      name: offenderDetails.details.name,
      dateOfBirth: offenderDetails.details.dateOfBirth,
      mobileNumber: offenderDetails.details.mobile,
      email: offenderDetails.details.email,
    })
    expect(getPersonalDetailsSpy).toHaveBeenCalledTimes(1)
    expect(getOffenderByCRNSpy).not.toHaveBeenCalled()
  })

  it.each([{}, { enableSentenceSelection: false }])(
    'does not refresh events when the flag is disabled or missing: %j',
    async flags => {
      const getPersonalDetailsSpy = jest.fn().mockRejectedValue(new Error('This endpoint must not be called'))
      jest
        .mocked(ESupervisionClient)
        .mockImplementation(() => ({ getPersonalDetails: getPersonalDetailsSpy }) as unknown as ESupervisionClient)
      const req = buildReq()
      const res = buildRes(flags)
      const next = jest.fn()

      await getPersonalDetails(hmppsAuthClient, arnsComponents, { refreshEvents: true })(req, res, next)

      expect(getPersonalDetailsSpy).not.toHaveBeenCalled()
      expect(next).toHaveBeenCalledTimes(1)
      expect(res.locals.headerPersonName).toEqual(offenderDetails.details.name)
    },
  )
})
