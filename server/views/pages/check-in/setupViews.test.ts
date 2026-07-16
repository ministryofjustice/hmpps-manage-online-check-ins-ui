// Guards the check-in setup templates against missing macro imports, filters and globals,
// which typechecking cannot catch and which otherwise only surface as a 500 in the browser.
import express from 'express'
import nunjucksSetup from '../../../utils/nunjucksSetup'

const crn = 'X000001'
const id = '11111111-1111-4111-8111-111111111111'

const app = express()
nunjucksSetup(app)

const base: Record<string, unknown> = {
  crn,
  id,
  case: { name: { forename: 'Bob', surname: 'Smith' }, mobileNumber: '07700900000', email: 'bob@example.com' },
  guidanceUrl: 'https://example.com',
  csrfToken: 'token',
  paths: { current: '/current' },
  data: { esupervision: { [crn]: { [id]: { checkins: { eligibility: [] } } } }, features: {} },
  userDetails: {
    date: '1/8/2026',
    interval: 'Every week',
    preferredComs: 'EMAIL',
    checkInMobile: '07700900000',
    checkInEmail: 'bob@example.com',
    photoUploadOption: 'Upload a photo',
    rationale: 'Stable and low risk',
    displayCommsOption: 'bob@example.com',
    displayDay: 'Saturday',
  },
  checkInMinDate: '1/8/2026',
  checkInMobile: '07700900000',
  checkInEmail: 'bob@example.com',
  isFutureCheckinDate: true,
  activeId: id,
  setupId: id,
}

const views = [
  'eligibility-check',
  'eligibility-full',
  'eligibility-supplementary',
  'eligibility-denied',
  'rationale',
  'spo-approval',
  'date-frequency',
  'contact-preference',
  'edit-contact-preference',
  'photo-options',
  'take-a-photo',
  'upload-a-photo',
  'photo-rules',
  'checkin-summary',
  'confirmation',
  'instructions',
]

const render = (view: string, locals: Record<string, unknown>): Promise<string> =>
  new Promise((resolve, reject) => {
    app.render(`pages/check-in/${view}.njk`, locals, (err: Error, html: string) => (err ? reject(err) : resolve(html)))
  })

describe.each(views)('%s', view => {
  it('renders', async () => {
    const html = await render(view, base)
    expect(html.length).toBeGreaterThan(0)
  })

  it('renders with an error summary', async () => {
    const html = await render(view, {
      ...base,
      errorMessages: { [`esupervision-${crn}-${id}-checkins-eligibility`]: 'Select if any of these apply' },
    })
    expect(html.length).toBeGreaterThan(0)
  })
})
