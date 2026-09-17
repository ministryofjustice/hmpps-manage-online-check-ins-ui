import httpMocks from 'node-mocks-http'
import type { Response } from 'express'
import restrictEligibilityAccess from './restrictEligibilityAccess'

const crn = 'X778160'
const id = '19a88188-6013-43a7-bb4d-6e338516818f'

const buildReq = (checkins: Record<string, unknown> | undefined) =>
  httpMocks.createRequest({
    params: { crn, id },
    session: {
      data: checkins ? { esupervision: { [crn]: { [id]: { checkins } } } } : {},
    },
  })

const buildRes = () =>
  ({
    redirect: jest.fn(),
    status: jest.fn().mockReturnThis(),
    render: jest.fn(),
    locals: {},
  }) as unknown as Response

describe('restrictEligibilityAccess', () => {
  it('redirects to eligibility-check when nothing has been answered yet', async () => {
    const req = buildReq(undefined)
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('pilot-check')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
    expect(next).not.toHaveBeenCalled()
  })

  it('redirects to not-eligible for a Tier A/B pilot-check GET when the stored answers already disqualify the person', async () => {
    const req = buildReq({ tierBand: 'AB', eligibility: ['recalled'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('pilot-check')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  it('lets a Tier C pilot cohort case reach pilot-check', async () => {
    const req = buildReq({ tierBand: 'C', eligibility: ['supervisionPackage'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('pilot-check')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('blocks is-eligible for a Tier C pilot cohort case that has not answered pilot-check', async () => {
    const req = buildReq({ tierBand: 'C', eligibility: ['supervisionPackage'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/pilot-check`)
    expect(next).not.toHaveBeenCalled()
  })

  it('blocks is-eligible (even with a stray pilotCheck answer already in session) when the eligibility answers alone are disqualifying', async () => {
    const req = buildReq({ tierBand: 'AB', eligibility: ['recalled'], pilotCheck: 'true' })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  it('blocks is-eligible when pilot-check was answered "no"', async () => {
    const req = buildReq({ tierBand: 'C', eligibility: ['supervisionPackage'], pilotCheck: 'false' })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  it('allows is-eligible once pilot-check was answered "yes"', async () => {
    const req = buildReq({ tierBand: 'C', eligibility: ['supervisionPackage'], pilotCheck: 'true' })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('allows is-eligible directly for Tier D-G, which has no pilot question', async () => {
    const req = buildReq({ tierBand: 'DG', eligibility: ['supervisionPackage'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('allows is-eligible directly for the Tier A/B accredited-programme cohort', async () => {
    const req = buildReq({ tierBand: 'AB', eligibility: ['supervisionPackage', 'accreditedProgramme'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('returns a 404 for an invalid crn or id', async () => {
    const req = httpMocks.createRequest({ params: { crn: 'not-a-crn', id }, session: { data: {} } })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.redirect).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(404)
  })
})
