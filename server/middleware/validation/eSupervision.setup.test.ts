import httpMocks from 'node-mocks-http'
import validate from './eSupervision'

// The validation spec reaches the bespoke question helpers, which import the ESM-only uuid package.
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20'),
}))

const crn = 'X000001'
const id = '11111111-1111-4111-8111-111111111111'

describe('setup validation re-render', () => {
  describe('manage sentence validation', () => {
    const overview = `/case/${crn}/appointments/check-in/manage/${id}`
    const events = [
      { number: 1, sentence: { expectedEndDate: '2027-01-01' } },
      { number: 2, sentence: { expectedEndDate: '2028-01-01' } },
    ]

    it.each([false, undefined])('redirects without validating or continuing when the flag is %s', enabled => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: `${overview}/sentence`,
        params: { crn, id },
        body: { esupervision: { [crn]: { [id]: { manageCheckin: { currentEvent: '2' } } } } },
        session: { data: {} },
      })
      const res: any = {
        locals: {
          flags: { enableSentenceSelection: enabled },
          offenderCheckinsByCRNResponse: { status: 'VERIFIED', details: { events } },
        },
        render: jest.fn(),
        redirect: jest.fn(),
      }
      const next = jest.fn()

      validate(req, res, next)

      expect(res.redirect).toHaveBeenCalledWith(overview)
      expect(res.render).not.toHaveBeenCalled()
      expect(next).not.toHaveBeenCalled()
    })

    it.each([undefined, '999', ['1', '2']])('re-renders an invalid sentence choice: %j', currentEvent => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: `${overview}/sentence`,
        params: { crn, id },
        body: { esupervision: { [crn]: { [id]: { manageCheckin: { currentEvent } } } } },
        session: { data: {} },
      })
      const res: any = {
        locals: {
          flags: { enableSentenceSelection: true },
          offenderCheckinsByCRNResponse: { status: 'VERIFIED', details: { events } },
        },
        render: jest.fn(),
      }
      const next = jest.fn()

      validate(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/sentence-selection',
        expect.objectContaining({
          events: [events[1], events[0]],
          eligibilitySessionKey: 'manageCheckin',
          backLink: overview,
          buttonText: 'Save changes',
          formAnchorLink: overview,
          formAnchorText: 'Cancel',
          errorMessages: {
            [`esupervision-${crn}-${id}-manageCheckin-currentEvent`]:
              'Select which sentence you want to add online check ins to',
          },
        }),
      )
    })

    it.each([0, 1])('blocks submission when only %s eligible events remain', eventCount => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: `${overview}/sentence`,
        params: { crn, id },
        body: { esupervision: { [crn]: { [id]: { manageCheckin: { currentEvent: '1' } } } } },
        session: { data: {} },
      })
      const res: any = {
        locals: {
          flags: { enableSentenceSelection: true },
          offenderCheckinsByCRNResponse: {
            status: 'VERIFIED',
            details: { events: events.slice(0, eventCount) },
          },
        },
        render: jest.fn(),
        redirect: jest.fn(),
      }
      const next = jest.fn()

      validate(req, res, next)

      expect(res.redirect).toHaveBeenCalledWith(overview)
      expect(next).not.toHaveBeenCalled()
      expect(res.render).not.toHaveBeenCalled()
    })

    it('passes a choice that belongs to the freshly loaded event list', () => {
      const req = httpMocks.createRequest({
        method: 'POST',
        url: `${overview}/sentence`,
        params: { crn, id },
        body: { esupervision: { [crn]: { [id]: { manageCheckin: { currentEvent: '2' } } } } },
        session: { data: {} },
      })
      const res: any = {
        locals: {
          flags: { enableSentenceSelection: true },
          offenderCheckinsByCRNResponse: { status: 'VERIFIED', details: { events } },
        },
        render: jest.fn(),
      }
      const next = jest.fn()

      validate(req, res, next)

      expect(next).toHaveBeenCalled()
      expect(res.render).not.toHaveBeenCalled()
    })
  })

  describe.each(['setup', 'reactivation'] as const)('%s frequency errors', journey => {
    it.each([
      { eventCount: 2, cya: false, expectedPage: 'sentence-selection' },
      { eventCount: 2, cya: true, expectedPage: 'summary' },
      { eventCount: 1, cya: false, expectedPage: 'rationale' },
    ])('preserves Back to $expectedPage with $eventCount events and cya=$cya', ({ eventCount, cya, expectedPage }) => {
      const isSetup = journey === 'setup'
      const group = isSetup ? 'checkins' : 'restartCheckin'
      const prefix = isSetup
        ? `/case/${crn}/appointments/${id}/check-in/`
        : `/case/${crn}/appointments/check-in/manage/${id}/restart-`
      const req = httpMocks.createRequest({
        method: 'POST',
        url: `${prefix}${isSetup ? 'check-in-frequency' : 'checkin'}`,
        params: { crn, id },
        query: cya ? { cya: 'true' } : {},
        body: { esupervision: { [crn]: { [id]: { [group]: {} } } } },
        session: {
          data: {
            esupervision: {
              [crn]: {
                [id]: {
                  [group]: {
                    accreditedProgramme: true,
                    events: Array.from({ length: eventCount }, (_event, index) => ({ number: index + 1 })),
                  },
                },
              },
            },
          },
        },
      })
      const res: any = {
        locals: { checkInEligibilityJourney: journey, flags: { enableSentenceSelection: true } },
        render: jest.fn(),
      }
      const next = jest.fn()

      validate(req, res, next)

      expect(next).not.toHaveBeenCalled()
      expect(res.render).toHaveBeenCalledWith(
        isSetup ? 'pages/check-in/check-in-frequency' : 'pages/check-in/manage/restart-checkin-frequency',
        expect.objectContaining({
          backLink: `${prefix}${expectedPage === 'summary' && isSetup ? 'checkin-summary' : expectedPage}`,
        }),
      )
    })
  })

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
