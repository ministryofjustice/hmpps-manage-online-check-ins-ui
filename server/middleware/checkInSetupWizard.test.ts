import httpMocks from 'node-mocks-http'
import autoStoreSessionData from './autoStoreSessionData'
import restrictPageAccess from './restrictPageAccess'

const crn = 'Y021754'
const id = 'dad89a83-3029-488a-ac24-ac2d0cf2e16c'

// Walk the wizard the way a browser does: each POST stores its page, then the next GET's
// restrictPageAccess must let us through rather than bounce us to eligibility-check.
it('walks eligibility -> rationale -> date-frequency -> contact -> photo -> summary', async () => {
  const session: any = { data: {} }
  const post = async (body: any, extra: any = {}) => {
    const req = httpMocks.createRequest({ params: { crn, id }, session, body, query: {}, ...extra })
    await autoStoreSessionData(null)(req, httpMocks.createResponse(), jest.fn())
    session.data = req.session.data
  }
  const checkAccess = async (requiredValues: string[]) => {
    const req = httpMocks.createRequest({ params: { crn, id }, session, query: {} })
    const res = { redirect: jest.fn(), render: jest.fn(), locals: {} } as never
    const next = jest.fn()
    await restrictPageAccess({ requiredValues })(req, res, next)
    const { redirect } = res as unknown as { redirect: jest.Mock }
    return next.mock.calls.length ? 'ALLOWED' : `BOUNCED -> ${redirect.mock.calls[0]?.[0]}`
  }
  const ck = (v: any) => ({ esupervision: { [crn]: { [id]: { checkins: v } } } })

  await post(ck({ eligibility: ['eligibility-none'] }))
  session.data.esupervision[crn][id].checkins.id = id // set by postFullEligibilityPage
  await post(ck({ eligibilityChoice: 'REPLACE_F2F' }))
  await post(ck({ eligibilitySPOApproval: 'spo-approval' }))
  expect(await checkAccess(['id'])).toBe('ALLOWED') // rationale page

  await post(ck({ rationale: 'Stable and low risk' }))
  expect(await checkAccess(['id'])).toBe('ALLOWED') // date-frequency  <- the reported bug

  await post(ck({ date: '1/8/2026', interval: 'WEEKLY' }))
  expect(await checkAccess(['date', 'interval'])).toBe('ALLOWED') // contact-preference

  await post(ck({ preferredComs: 'EMAIL', checkInEmail: 'a@b.com' }))
  expect(await checkAccess(['preferredComs'])).toBe('ALLOWED') // photo-options

  await post(ck({ photoUploadOption: 'TAKE_A_PIC' }))
  expect(await checkAccess(['photoUploadOption'])).toBe('ALLOWED') // photo-rules / summary

  // everything the summary + registration payload needs survived the whole walk
  expect(session.data.esupervision[crn][id].checkins).toEqual({
    id,
    eligibility: ['eligibility-none'],
    eligibilityChoice: 'REPLACE_F2F',
    eligibilitySPOApproval: 'spo-approval',
    rationale: 'Stable and low risk',
    date: '1/8/2026',
    interval: 'WEEKLY',
    preferredComs: 'EMAIL',
    checkInEmail: 'a@b.com',
    photoUploadOption: 'TAKE_A_PIC',
  })
})
