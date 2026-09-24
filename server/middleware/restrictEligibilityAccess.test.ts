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

  it.each(['pilot-check', 'is-eligible', 'setup'] as const)(
    'sends %s back to eligibility-check when the form has not been answered',
    async page => {
      const req = buildReq({ tierBand: 'C', onSupervisionPackage: true })
      const res = buildRes()
      const next = jest.fn()

      await restrictEligibilityAccess(page)(req, res, next)

      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
      expect(next).not.toHaveBeenCalled()
    },
  )

  it('sends an empty selection back to eligibility-check too', async () => {
    const req = buildReq({
      tierBand: 'DG',
      onSupervisionPackage: true,
      eligibility: [],
      discussion: ['optional', 'canStop', 'notEnforceable', 'moreTime'],
    })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('setup')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
    expect(next).not.toHaveBeenCalled()
  })

  it('redirects to not-eligible for a Tier A/B pilot-check GET when the stored answers already disqualify the person', async () => {
    const req = buildReq({ tierBand: 'AB', onSupervisionPackage: true, eligibility: ['recalled'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('pilot-check')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  // The ESUP answer is recorded on the eligibility submission rather than fetched again here, so a
  // case ruled out by it must stay ruled out on every later page.
  it('redirects to not-eligible when the recorded ESUP answer says no supervision package', async () => {
    const req = buildReq({ tierBand: 'C', onSupervisionPackage: false, eligibility: ['none'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('pilot-check')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  // A blanket disqualifier like the missing package, so it rules the person out whatever band they
  // are in and whatever the recorded selections say.
  it.each(['AB', 'C', 'DG'] as const)(
    'redirects to not-eligible when the recorded ESUP answer says a %s person is in the final third',
    async tierBand => {
      const req = buildReq({ tierBand, onSupervisionPackage: true, inFinalThird: true, eligibility: ['none'] })
      const res = buildRes()
      const next = jest.fn()

      await restrictEligibilityAccess('pilot-check')(req, res, next)

      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      expect(next).not.toHaveBeenCalled()
    },
  )

  // Early engagement only disqualifies alongside the accredited programme box, so the guard has to
  // re-derive it from both the ESUP answer and the recorded selection rather than either alone.
  it('redirects to not-eligible for a Tier A/B programme case recorded as in early engagement', async () => {
    const req = buildReq({
      tierBand: 'AB',
      onSupervisionPackage: true,
      inEarlyEngagement: true,
      eligibility: ['accreditedProgramme'],
    })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  // Off the programme branch it has no bearing, so the pilot route is still the one to follow.
  it('lets a Tier A/B case recorded as in early engagement reach pilot-check without a programme', async () => {
    const req = buildReq({ tierBand: 'AB', onSupervisionPackage: true, inEarlyEngagement: true, eligibility: ['none'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('pilot-check')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('lets a Tier C pilot cohort case reach pilot-check', async () => {
    const req = buildReq({ tierBand: 'C', onSupervisionPackage: true, eligibility: ['none'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('pilot-check')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('blocks is-eligible for a Tier C pilot cohort case that has not answered pilot-check', async () => {
    const req = buildReq({ tierBand: 'C', onSupervisionPackage: true, eligibility: ['none'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/pilot-check`)
    expect(next).not.toHaveBeenCalled()
  })

  it('blocks is-eligible (even with a stray pilotCheck answer already in session) when the eligibility answers alone are disqualifying', async () => {
    const req = buildReq({ tierBand: 'AB', onSupervisionPackage: true, eligibility: ['recalled'], pilotCheck: 'true' })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  it('blocks is-eligible when pilot-check was answered "no"', async () => {
    const req = buildReq({ tierBand: 'C', onSupervisionPackage: true, eligibility: ['none'], pilotCheck: 'false' })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  it('allows is-eligible once pilot-check was answered "yes"', async () => {
    const req = buildReq({ tierBand: 'C', onSupervisionPackage: true, eligibility: ['none'], pilotCheck: 'true' })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('allows is-eligible directly for Tier D-G, which has no pilot question', async () => {
    const req = buildReq({ tierBand: 'DG', onSupervisionPackage: true, eligibility: ['none'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('allows is-eligible directly for the Tier A/B accredited-programme cohort', async () => {
    const req = buildReq({ tierBand: 'AB', onSupervisionPackage: true, eligibility: ['accreditedProgramme'] })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('is-eligible')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  // date-frequency, accredited-programme-approval and rationale all guard with 'setup': the id is
  // stored on every eligibility submission, so without this a not-eligible case could deep-link
  // into the rest of the wizard and complete a setup it was ruled out of.
  const discussion = ['optional', 'canStop', 'notEnforceable', 'moreTime']

  it('keeps a not-eligible case out of the setup pages', async () => {
    const req = buildReq({ tierBand: 'AB', onSupervisionPackage: true, eligibility: ['recalled'], discussion })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('setup')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  it('keeps a Tier C case that has not answered the pilot question out of the setup pages', async () => {
    const req = buildReq({ tierBand: 'C', onSupervisionPackage: true, eligibility: ['none'], discussion })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('setup')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/pilot-check`)
    expect(next).not.toHaveBeenCalled()
  })

  it('keeps a Tier C case outside the pilot cohort out of the setup pages', async () => {
    const req = buildReq({
      tierBand: 'C',
      onSupervisionPackage: true,
      eligibility: ['none'],
      pilotCheck: 'false',
      discussion,
    })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('setup')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  it.each([
    ['no discussion answers at all', undefined],
    ['a part-ticked set', ['optional', 'canStop']],
    ['"I have not done all of these"', ['notAll']],
  ])('sends an eligible case back to is-eligible with %s', async (_, answers) => {
    const req = buildReq({ tierBand: 'DG', onSupervisionPackage: true, eligibility: ['none'], discussion: answers })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('setup')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/is-eligible`)
    expect(next).not.toHaveBeenCalled()
  })

  it.each([
    ['Tier D-G', { tierBand: 'DG', onSupervisionPackage: true, eligibility: ['none'] }],
    [
      'the Tier A/B accredited-programme cohort',
      { tierBand: 'AB', onSupervisionPackage: true, eligibility: ['accreditedProgramme'] },
    ],
    ['the pilot cohort', { tierBand: 'C', onSupervisionPackage: true, eligibility: ['none'], pilotCheck: 'true' }],
  ])('allows the setup pages for %s once the discussion is confirmed', async (_, checkins) => {
    const req = buildReq({ discussion, ...checkins })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('setup')(req, res, next)

    expect(next).toHaveBeenCalledTimes(1)
    expect(res.redirect).not.toHaveBeenCalled()
  })

  it('sends the accredited-programme cohort back when only the shared points are ticked', async () => {
    const req = buildReq({
      tierBand: 'AB',
      onSupervisionPackage: true,
      eligibility: ['accreditedProgramme'],
      accreditedProgramme: true,
      discussion,
    })
    const res = buildRes()
    const next = jest.fn()

    await restrictEligibilityAccess('setup')(req, res, next)

    expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/is-eligible`)
    expect(next).not.toHaveBeenCalled()
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
