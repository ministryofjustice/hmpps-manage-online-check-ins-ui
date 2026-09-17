import httpMocks from 'node-mocks-http'
import type { Response } from 'express'
import { getSupervisionPackageStatus } from './getSupervisionPackageStatus'
import ESupervisionClient from '../data/eSupervisionClient'
import { HmppsAuthClient } from '../data'

jest.mock('../data/eSupervisionClient')

const crn = 'X778160'
const id = '19a88188-6013-43a7-bb4d-6e338516818f'

const hmppsAuthClient = {
  getSystemClientToken: jest.fn().mockResolvedValue('a-system-token'),
} as unknown as HmppsAuthClient

const buildRes = () => ({ locals: { user: { username: 'a-user' } } }) as unknown as Response

describe('getSupervisionPackageStatus', () => {
  beforeEach(() => jest.clearAllMocks())

  it('puts the ESUP answer on res.locals for the eligibility rules to read', async () => {
    const getStatus = jest.fn().mockResolvedValue({ onSupervisionPackage: true })
    jest
      .mocked(ESupervisionClient)
      .mockImplementation(() => ({ getSupervisionPackageStatus: getStatus }) as unknown as ESupervisionClient)
    const req = httpMocks.createRequest({ params: { crn, id } })
    const res = buildRes()
    const next = jest.fn()

    await getSupervisionPackageStatus(hmppsAuthClient)(req, res, next)

    // The client is constructed per-request with a system token, the same as getPersonalDetails.
    expect(hmppsAuthClient.getSystemClientToken).toHaveBeenCalledWith('a-user')
    expect(ESupervisionClient).toHaveBeenCalledWith('a-system-token')
    expect(getStatus).toHaveBeenCalledWith(crn)
    expect(res.locals.supervisionPackageStatus).toEqual({ onSupervisionPackage: true })
    expect(next).toHaveBeenCalledTimes(1)
  })

  // Nothing here decides eligibility, so a "no" is passed straight through rather than short-
  // circuiting - postEligibilityPage is where it turns into a not-eligible outcome.
  it('passes a negative answer through and still continues', async () => {
    jest.mocked(ESupervisionClient).mockImplementation(
      () =>
        ({
          getSupervisionPackageStatus: jest.fn().mockResolvedValue({ onSupervisionPackage: false }),
        }) as unknown as ESupervisionClient,
    )
    const req = httpMocks.createRequest({ params: { crn, id } })
    const res = buildRes()
    const next = jest.fn()

    await getSupervisionPackageStatus(hmppsAuthClient)(req, res, next)

    expect(res.locals.supervisionPackageStatus).toEqual({ onSupervisionPackage: false })
    expect(next).toHaveBeenCalledTimes(1)
  })
})
