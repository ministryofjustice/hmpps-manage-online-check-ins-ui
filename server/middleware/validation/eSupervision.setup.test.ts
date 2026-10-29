import httpMocks from 'node-mocks-http'
import validate from './eSupervision'

// The validation spec reaches the bespoke question helpers, which import the ESM-only uuid package.
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20'),
}))

const crn = 'X000001'
const id = '11111111-1111-4111-8111-111111111111'

describe('setup validation re-render', () => {
  it('preserves contact details and picks the right view when contact-preference fails', () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/case/${crn}/appointments/${id}/check-in/contact-preference`,
      params: { crn, id },
      query: {},
      body: {
        change: 'main',
        checkInMobile: '07700900000',
        checkInEmail: 'bob@example.com',
        [`[esupervision][${crn}][${id}][checkins][checkInMobile]`]: '07700900000',
        [`[esupervision][${crn}][${id}][checkins][checkInEmail]`]: 'bob@example.com',
      },
      session: { data: {} },
    })
    const res: any = { locals: {}, render: jest.fn() }
    const next = jest.fn()
    validate(req, res, next)

    expect(next).not.toHaveBeenCalled()
    const [view, locals] = res.render.mock.calls[0]
    expect(view).toBe('pages/check-in/contact-preference')
    expect(locals.checkInMobile).toBe('07700900000')
    expect(locals.checkInEmail).toBe('bob@example.com')
    expect(Object.keys(locals.errorMessages)).toContain(`esupervision-${crn}-${id}-checkins-preferredComs`)
  })

  // The template builds its Back link from this flag; without it an ad-hoc setup would be sent to
  // the date page it never visited.
  it.each([
    ['AD_HOC', true],
    ['WEEKLY', false],
  ])('tells contact-preference whether the setup is ad-hoc (%s) when it fails', (interval, isAdHoc) => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/case/${crn}/appointments/${id}/check-in/contact-preference`,
      params: { crn, id },
      query: {},
      body: { change: 'main' },
      session: { data: { esupervision: { [crn]: { [id]: { checkins: { interval } } } } } },
    })
    const res: any = { locals: {}, render: jest.fn() }
    validate(req, res, jest.fn())

    const [view, locals] = res.render.mock.calls[0]
    expect(view).toBe('pages/check-in/contact-preference')
    expect(locals.isAdHoc).toBe(isAdHoc)
  })

  it('preserves checkInMinDate when check-in-date fails', () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/case/${crn}/appointments/${id}/check-in/check-in-date`,
      params: { crn, id },
      query: {},
      body: { checkInMinDate: '1/8/2026' },
      session: { data: {} },
    })
    const res: any = { locals: {}, render: jest.fn() }
    validate(req, res, jest.fn())
    const [view, locals] = res.render.mock.calls[0]
    expect(view).toBe('pages/check-in/check-in-date')
    expect(locals.checkInMinDate).toBe('1/8/2026')
  })

  it('lets a valid rationale through', () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/case/${crn}/appointments/${id}/check-in/rationale`,
      params: { crn, id },
      query: {},
      body: { esupervision: { [crn]: { [id]: { checkins: { rationale: 'Stable and low risk' } } } } },
      session: { data: {} },
    })
    const res: any = { locals: {}, render: jest.fn() }
    const next = jest.fn()
    validate(req, res, next)
    expect(next).toHaveBeenCalled()
    expect(res.render).not.toHaveBeenCalled()
  })

  it.each([
    ['setup', `/case/${crn}/appointments/${id}/check-in/rationale`, 'checkins'],
    ['reactivation', `/case/${crn}/appointments/check-in/manage/${id}/restart-rationale`, 'restartCheckin'],
  ] as const)('rejects whitespace-only rationale for %s', (journey, url, sessionKey) => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url,
      params: { crn, id },
      query: {},
      body: { esupervision: { [crn]: { [id]: { [sessionKey]: { rationale: '   ' } } } } },
      session: { data: { esupervision: { [crn]: { [id]: { [sessionKey]: { accreditedProgramme: true } } } } } },
    })
    const res: any = {
      locals: {
        tierScore: 'A',
        ...(journey === 'reactivation' && { checkInEligibilityJourney: 'reactivation' }),
      },
      render: jest.fn(),
    }
    const next = jest.fn()

    validate(req, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.render).toHaveBeenCalledWith(
      'pages/check-in/rationale',
      expect.objectContaining({
        errorMessages: expect.objectContaining({
          [`esupervision-${crn}-${id}-${sessionKey}-rationale`]: expect.any(String),
        }),
      }),
    )
  })

  it('validates restart eligibility under restartCheckin and re-renders the shared eligibility view', () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/case/${crn}/appointments/check-in/manage/${id}/restart-eligibility-check`,
      params: { crn, id },
      query: {},
      body: { esupervision: { [crn]: { [id]: { restartCheckin: {} } } } },
      session: { data: {} },
    })
    const res: any = {
      locals: { tierScore: 'A', checkInEligibilityJourney: 'reactivation' },
      render: jest.fn(),
    }
    validate(req, res, jest.fn())

    const [view, locals] = res.render.mock.calls[0]
    expect(view).toBe('pages/check-in/eligibility/eligibility-check')
    expect(locals.eligibilitySessionKey).toBe('restartCheckin')
    expect(locals.eligibilityUrlPrefix).toBe(`/case/${crn}/appointments/check-in/manage/${id}/restart-`)
    expect(Object.keys(locals.errorMessages)).toContain(`esupervision-${crn}-${id}-restartCheckin-eligibility`)
  })

  it.each([
    ['Tier A/B accredited-programme', 'A', { accreditedProgramme: true }, 'accredited-programme-is-eligible'],
    ['Tier D-G', 'D', {}, 'is-eligible'],
  ])('supplies the setup eligibility URL prefix when %s is re-rendered', (_description, tierScore, answers, view) => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/case/${crn}/appointments/${id}/check-in/is-eligible`,
      params: { crn, id },
      query: {},
      body: { esupervision: { [crn]: { [id]: { checkins: {} } } } },
      session: { data: { esupervision: { [crn]: { [id]: { checkins: answers } } } } },
    })
    const res: any = { locals: { tierScore }, render: jest.fn() }
    validate(req, res, jest.fn())

    const [renderedView, locals] = res.render.mock.calls[0]
    expect(renderedView).toContain(view)
    expect(locals.eligibilityUrlPrefix).toBe(`/case/${crn}/appointments/${id}/check-in/`)
  })
})
