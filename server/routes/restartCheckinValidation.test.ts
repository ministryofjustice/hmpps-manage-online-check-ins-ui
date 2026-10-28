import request from 'supertest'
import { appWithAllRoutes } from './testutils/appSetup'
import ESupervisionClient from '../data/eSupervisionClient'
import type { Services } from '../services'

// The restart frequency and date pages read the saved date from the session to decide where
// Continue and Back go during a check-your-answers edit. These tests drive the real route chain
// so that a date the validator rejects is proven never to reach the session.

jest.mock('../../logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }))
jest.mock('@ministryofjustice/hmpps-audit-client', () => ({
  auditService: { sendAuditMessage: jest.fn().mockResolvedValue(undefined) },
}))
jest.mock('../data/eSupervisionClient')
// These tests start past the restart eligibility check, which has its own tests.
jest.mock(
  '../middleware/restrictEligibilityAccess',
  () => () => (_req: unknown, _res: unknown, next: () => void) => next(),
)
jest.mock('../middleware/restrictPageAccess', () => ({
  ...jest.requireActual('../middleware/restrictPageAccess'),
  __esModule: true,
  default: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}))
// uuid ships ESM only, which ts-jest does not transform.
jest.mock('uuid', () => ({ v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20') }))

const crn = 'X778160'
const id = '3fa85f64-5717-4562-b3fc-2c963f66afa7'
const manage = `/case/${crn}/appointments/check-in/manage/${id}`
const dateField = `esupervision[${crn}][${id}][restartCheckin][date]`
const intervalField = `esupervision[${crn}][${id}][restartCheckin][interval]`

const offender = {
  uuid: id,
  crn,
  status: 'INACTIVE',
  checkinInterval: 'WEEKLY',
  contactPreference: 'PHONE',
  details: { name: { forename: 'Joe', surname: 'Bloggs' }, mobile: '07700900000', email: 'joe@example.com' },
}

const dateInputValueOf = (html: string) => {
  const input = html.match(/<input[^>]*moj-js-datepicker-input[^>]*>/)?.[0] ?? ''
  return input.match(/value="([^"]*)"/)?.[1] ?? ''
}

const backLinkOf = (html: string) => {
  const anchor = html.match(/<a[^>]*govuk-back-link[^>]*>/)?.[0] ?? ''
  return anchor.match(/href="([^"]+)"/)?.[1]
}

describe('restart journey validates before storing', () => {
  let agent: ReturnType<typeof request.agent>

  beforeEach(() => {
    jest.spyOn(ESupervisionClient.prototype, 'getOffenderByCRN').mockResolvedValue(offender as any)
    jest.spyOn(ESupervisionClient.prototype, 'getOffenderHeaderByCRN').mockResolvedValue(null)
    jest.spyOn(ESupervisionClient.prototype, 'getPersonalDetails').mockResolvedValue({
      crn,
      name: offender.details.name,
      mobile: offender.details.mobile,
      email: offender.details.email,
    } as any)
    const services = {
      hmppsAuthClient: { getSystemClientToken: jest.fn().mockResolvedValue('token') },
      arnsComponents: { getRiskData: jest.fn().mockResolvedValue({}) },
    } as unknown as Services
    agent = request.agent(appWithAllRoutes({ services }))
  })

  afterEach(() => jest.restoreAllMocks())

  // Mirrors a change-your-answers edit from ad-hoc to a standard interval: no date is on file yet.
  const switchToWeekly = () =>
    agent
      .post(`${manage}/restart-checkin?cya=true`)
      .type('form')
      .send({ [intervalField]: 'WEEKLY' })

  it('does not let a rejected date skip the date page when the frequency is re-submitted', async () => {
    await switchToWeekly().expect(302).expect('Location', `${manage}/restart-checkin-date?cya=true`)

    const rejected = await agent
      .post(`${manage}/restart-checkin-date?cya=true`)
      .type('form')
      .send({ [dateField]: '31/2/2030' })
      .expect(200)
    expect(rejected.text).toContain('Enter a date in the correct format')
    expect(dateInputValueOf(rejected.text)).toBe('31/2/2030')

    // Had 31/2/2030 been stored, the frequency page would now return straight to the summary.
    await switchToWeekly().expect(302).expect('Location', `${manage}/restart-checkin-date?cya=true`)
  })

  it('keeps Back on the frequency page when an invalid date is rejected and none was saved', async () => {
    await switchToWeekly()
    const rejected = await agent
      .post(`${manage}/restart-checkin-date?cya=true`)
      .type('form')
      .send({ [dateField]: 'not-a-date' })
      .expect(200)
    expect(backLinkOf(rejected.text)).toBe(`${manage}/restart-checkin?cya=true`)
    expect(dateInputValueOf(rejected.text)).toBe('not-a-date')
  })

  it('keeps Back on the summary when a saved date is replaced with an empty one', async () => {
    await switchToWeekly()
    await agent
      .post(`${manage}/restart-checkin-date?cya=true`)
      .type('form')
      .send({ [dateField]: '1/1/2030' })
      .expect(302)
      .expect('Location', `${manage}/restart-summary?cya=true`)

    const rejected = await agent
      .post(`${manage}/restart-checkin-date?cya=true`)
      .type('form')
      .send({ [dateField]: '' })
      .expect(200)
    expect(backLinkOf(rejected.text)).toBe(`${manage}/restart-summary`)
    // The field shows the empty submission, not the saved 1/1/2030, so Continue cannot re-submit it unnoticed.
    expect(dateInputValueOf(rejected.text)).toBe('')
  })
})
