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

  it('preserves checkInMinDate when date-frequency fails', () => {
    const req = httpMocks.createRequest({
      method: 'POST',
      url: `/case/${crn}/appointments/${id}/check-in/date-frequency`,
      params: { crn, id },
      query: {},
      body: { checkInMinDate: '1/8/2026' },
      session: { data: {} },
    })
    const res: any = { locals: {}, render: jest.fn() }
    validate(req, res, jest.fn())
    const [view, locals] = res.render.mock.calls[0]
    expect(view).toBe('pages/check-in/date-frequency')
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
})
