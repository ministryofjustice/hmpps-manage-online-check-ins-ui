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
  data: {
    esupervision: { [crn]: { [id]: { checkins: { eligibility: [], discussion: [], pilotCheck: 'true' } } } },
    features: {},
  },
  tierScore: 'B1',
  reason: 'is not on a supervision package',
  preferredComs: 'PHONE',
  contactPreference: 'mobile number',
  contactValue: '07700900000',
  hasContactDetails: true,
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
  'eligibility/not-eligible',
  'eligibility/discuss-before-signup',
  // Shared across bands - see eligibilityViews in utils/eligibilityRules for which band gets what.
  'eligibility/eligibility-check',
  'eligibility/pilot-check',
  'eligibility/pilot-is-eligible',
  'eligibility/tiers-a-b/accredited-programme-is-eligible',
  'eligibility/tiers-d-g/is-eligible',
  'rationale',
  'accredited-programme-approval',
  'date-frequency',
  'contact-preference',
  'confirm-contact-preference',
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

  it('has balanced div tags', async () => {
    const html = await render(view, base)
    const opened = html.match(/<div[\s>]/g) ?? []
    const closed = html.match(/<\/div>/g) ?? []
    expect(closed.length).toBe(opened.length)
  })

  it('renders with an error summary', async () => {
    const html = await render(view, {
      ...base,
      errorMessages: { [`esupervision-${crn}-${id}-checkins-eligibility`]: 'Select if any of these apply' },
    })
    expect(html.length).toBeGreaterThan(0)
  })
})

// One eligibility-check template serves every band, rendering the three Tier A/B-only questions
// off `tierBand`. Asserting on the checkbox values keeps the bands from drifting into each other.
describe('eligibility/eligibility-check', () => {
  const valuesIn = (html: string): string[] =>
    [...html.matchAll(/name="esupervision\[[^"]+\]\[checkins\]\[eligibility\]" type="checkbox" value="([^"]+)"/g)].map(
      match => match[1],
    )

  // Every band ends with the exclusive "None of these apply".
  const allTiers = ['recalled', 'finalThird', 'deviceRestriction', 'none']

  it('asks tiers A and B about the accredited programme, youth sentences and early engagement', async () => {
    const html = await render('eligibility/eligibility-check', { ...base, tierBand: 'AB' })
    expect(valuesIn(html)).toEqual([
      'accreditedProgramme',
      'recalled',
      'finalThird',
      'deviceRestriction',
      'youthSentence',
      'earlyEngagement',
      'none',
    ])
  })

  it.each(['C', 'DG'])('asks tier %s only the questions every tier gets', async band => {
    const html = await render('eligibility/eligibility-check', { ...base, tierBand: band })
    expect(valuesIn(html)).toEqual(allTiers)
  })

  it.each(['AB', 'C', 'DG'])('makes "none of these apply" exclusive for tier %s', async band => {
    const html = await render('eligibility/eligibility-check', { ...base, tierBand: band })
    expect(html).toContain('data-behaviour="exclusive"')
  })
})

// not-eligible renders one reason as a sentence and several as a bullet list, so both shapes are
// exercised - the list case would otherwise never be rendered by these smoke tests.
describe('eligibility/not-eligible', () => {
  it('lists the reasons when more than one ruled the person out', async () => {
    const html = await render('eligibility/not-eligible', {
      ...base,
      reason: '',
      reasonBullets: ['has been recalled to prison', 'is in the final third of their sentence'],
    })
    expect(html).toContain('This is because Bob:')
    expect(html).toContain('<li>has been recalled to prison</li>')
    expect(html).toContain('<li>is in the final third of their sentence</li>')
  })

  it('reads a single reason as one sentence', async () => {
    const html = await render('eligibility/not-eligible', { ...base, reason: 'has been recalled to prison' })
    expect(html).toContain('This is because Bob has been recalled to prison.')
    expect(html).not.toContain('reasonBullets')
  })

  // The offer is made whatever the reason - see getNotEligiblePage.
  it('always offers to check eligibility again', async () => {
    const html = await render('eligibility/not-eligible', { ...base, reason: 'is not on a supervision package' })
    expect(html).toContain('you can go back and check eligibility again')
  })
})
