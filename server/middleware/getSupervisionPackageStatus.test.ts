import httpMocks from 'node-mocks-http'
import type { Response } from 'express'
import { getSupervisionPackageStatus } from './getSupervisionPackageStatus'
import ESupervisionClient from '../data/eSupervisionClient'
import { HmppsAuthClient } from '../data'
import { SupervisionPackageStatus } from '../data/model/esupervision'

jest.mock('../data/eSupervisionClient')

const crn = 'X778160'
const id = '19a88188-6013-43a7-bb4d-6e338516818f'

const hmppsAuthClient = {
  getSystemClientToken: jest.fn().mockResolvedValue('a-system-token'),
} as unknown as HmppsAuthClient

const buildRes = () => ({ locals: { user: { username: 'a-user' } } }) as unknown as Response

// The three facts the supervision-package call answers, for a person nothing is wrong with.
const ON_PACKAGE: SupervisionPackageStatus = {
  onSupervisionPackage: true,
  inFinalThird: false,
  inEarlyEngagement: false,
}

describe('getSupervisionPackageStatus', () => {
  beforeEach(() => jest.clearAllMocks())

  it('puts the ESUP answers on res.locals for the eligibility rules to read', async () => {
    const getStatus = jest.fn().mockResolvedValue(ON_PACKAGE)
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
    expect(res.locals.supervisionPackageStatus).toEqual(ON_PACKAGE)
    expect(next).toHaveBeenCalledTimes(1)
  })

  // Nothing here decides eligibility, so a disqualifying answer is passed straight through rather
  // than short-circuiting - the controller and the rules turn these into a not-eligible outcome.
  it.each([
    ['no supervision package', { ...ON_PACKAGE, onSupervisionPackage: false }],
    ['the final third', { ...ON_PACKAGE, inFinalThird: true }],
    ['early engagement', { ...ON_PACKAGE, inEarlyEngagement: true }],
  ])('passes %s through and still continues', async (_, status) => {
    jest.mocked(ESupervisionClient).mockImplementation(
      () =>
        ({
          getSupervisionPackageStatus: jest.fn().mockResolvedValue(status),
        }) as unknown as ESupervisionClient,
    )
    const req = httpMocks.createRequest({ params: { crn, id } })
    const res = buildRes()
    const next = jest.fn()

    await getSupervisionPackageStatus(hmppsAuthClient)(req, res, next)

    expect(res.locals.supervisionPackageStatus).toEqual(status)
    expect(next).toHaveBeenCalledTimes(1)
  })
})
