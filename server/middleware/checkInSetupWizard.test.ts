import httpMocks from 'node-mocks-http'
import autoStoreSessionData from './autoStoreSessionData'
import restrictPageAccess, { dateUnlessAdHoc, RequiredValue } from './restrictPageAccess'

const crn = 'Y021754'
const id = 'dad89a83-3029-488a-ac24-ac2d0cf2e16c'

const checkPageAccess = async (
  requiredValues: RequiredValue[],
  data: Record<string, unknown>,
  eligibilityJourney: 'setup' | 'reactivation' = 'setup',
) => {
  const req = httpMocks.createRequest({ params: { crn, id }, session: { data }, query: {} })
  const res = {
    redirect: jest.fn(),
    render: jest.fn(),
    locals: { checkInEligibilityJourney: eligibilityJourney },
  } as never
  const next = jest.fn()
  await restrictPageAccess({ requiredValues })(req, res, next)
  const { redirect } = res as unknown as { redirect: jest.Mock }
  return next.mock.calls.length ? 'ALLOWED' : `BOUNCED -> ${redirect.mock.calls[0]?.[0]}`
}

// Walk the wizard the way a browser does: each POST stores its page, then the next GET's
// restrictPageAccess must let us through rather than bounce us to eligibility-check.
it('walks eligibility -> rationale -> check-in-frequency -> check-in-date -> contact -> photo -> summary', async () => {
  const session: any = { data: {} }
  const post = async (body: any, extra: any = {}) => {
    const req = httpMocks.createRequest({ params: { crn, id }, session, body, query: {}, ...extra })
    await autoStoreSessionData(null)(req, httpMocks.createResponse(), jest.fn())
    session.data = req.session.data
  }
  const checkAccess = (requiredValues: RequiredValue[]) => checkPageAccess(requiredValues, session.data)
  const ck = (v: any) => ({ esupervision: { [crn]: { [id]: { checkins: v } } } })

  await post(ck({ eligibility: ['eligibility-none'] }))
  session.data.esupervision[crn][id].checkins.id = id // set by postFullEligibilityPage
  await post(ck({ eligibilitySPOApproval: 'spo-approval' }))
  expect(await checkAccess(['id'])).toBe('ALLOWED') // rationale page

  await post(ck({ rationale: 'Stable and low risk' }))
  expect(await checkAccess(['id'])).toBe('ALLOWED') // check-in-frequency  <- the reported bug

  await post(ck({ interval: 'WEEKLY' }))
  expect(await checkAccess(['interval'])).toBe('ALLOWED') // check-in-date

  // contact-preference: a standard interval must not get past the date page by URL
  expect(await checkAccess(['interval', dateUnlessAdHoc])).toBe(
    `BOUNCED -> /case/${crn}/appointments/${id}/check-in/eligibility-check`,
  )
  await post(ck({ date: '1/8/2026' }))
  expect(await checkAccess(['interval', dateUnlessAdHoc])).toBe('ALLOWED') // contact-preference

  await post(ck({ preferredComs: 'EMAIL', checkInEmail: 'a@b.com' }))
  expect(await checkAccess(['preferredComs'])).toBe('ALLOWED') // photo-options

  await post(ck({ photoUploadOption: 'TAKE_A_PIC' }))
  expect(await checkAccess(['photoUploadOption'])).toBe('ALLOWED') // photo-rules / summary

  // everything the summary + registration payload needs survived the whole walk
  expect(session.data.esupervision[crn][id].checkins).toEqual({
    id,
    eligibility: ['eligibility-none'],
    eligibilitySPOApproval: 'spo-approval',
    rationale: 'Stable and low risk',
    date: '1/8/2026',
    interval: 'WEEKLY',
    preferredComs: 'EMAIL',
    checkInEmail: 'a@b.com',
    photoUploadOption: 'TAKE_A_PIC',
  })
})

// An ad-hoc setup skips the date page, so the contact pages must not demand a date for it.
it('lets an ad-hoc setup reach contact-preference without a date', async () => {
  const session: any = {
    data: { esupervision: { [crn]: { [id]: { checkins: { id, interval: 'AD_HOC' } } } } },
  }
  const req = httpMocks.createRequest({ params: { crn, id }, session, query: {} })
  const res = { redirect: jest.fn(), render: jest.fn(), locals: {} } as never
  const next = jest.fn()
  await restrictPageAccess({ requiredValues: ['interval', dateUnlessAdHoc] })(req, res, next)
  expect(next).toHaveBeenCalled()
})

it('redirects a restart with no session state to its eligibility check', async () => {
  expect(await checkPageAccess(['id'], {}, 'reactivation')).toBe(
    `BOUNCED -> /case/${crn}/appointments/check-in/manage/${id}/restart-eligibility-check`,
  )
})

it('requires a date before a scheduled restart reaches contact details', async () => {
  const data = {
    esupervision: { [crn]: { [id]: { restartCheckin: { id, interval: 'WEEKLY' } } } },
  }

  expect(await checkPageAccess(['interval', dateUnlessAdHoc], data, 'reactivation')).toBe(
    `BOUNCED -> /case/${crn}/appointments/check-in/manage/${id}/restart-eligibility-check`,
  )
})

it('lets an ad-hoc restart reach contact details without a date', async () => {
  const data = {
    esupervision: { [crn]: { [id]: { restartCheckin: { id, interval: 'AD_HOC' } } } },
  }

  expect(await checkPageAccess(['interval', dateUnlessAdHoc], data, 'reactivation')).toBe('ALLOWED')
})
