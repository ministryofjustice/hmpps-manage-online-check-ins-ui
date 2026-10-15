import httpMocks from 'node-mocks-http'
import validate from './eSupervision'

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

  it('validates restart eligibility under restartCheckin and re-renders the shared eligibility view', () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/case/${crn}/appointments/check-in/manage/${id}/restart-eligibility-check`,
      params: { crn, id },
      query: {},
      body: { esupervision: { [crn]: { [id]: { restartCheckin: {} } } } },
      session: { data: {} },
    })
    const res: any = { locals: { tierScore: 'A' }, render: jest.fn() }
    validate(req, res, jest.fn())

    const [view, locals] = res.render.mock.calls[0]
    expect(view).toBe('pages/check-in/eligibility/eligibility-check')
    expect(locals.sessionKey).toBe('restartCheckin')
    expect(locals.flowPathPrefix).toBe(`/case/${crn}/appointments/check-in/manage/${id}/restart-`)
    expect(Object.keys(locals.errorMessages)).toContain(`esupervision-${crn}-${id}-restartCheckin-eligibility`)
  })
})
