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

// One eligibility-check template serves every band, rendering the two Tier A/B-only questions
// off `tierBand`. Asserting on the checkbox values keeps the bands from drifting into each other.
describe('eligibility/eligibility-check', () => {
  const valuesIn = (html: string): string[] =>
    [...html.matchAll(/name="esupervision\[[^"]+\]\[checkins\]\[eligibility\]" type="checkbox" value="([^"]+)"/g)].map(
      match => match[1],
    )

  // Every band ends with the exclusive "None of these apply".
  const allTiers = ['recalled', 'deviceRestriction', 'none']

  it('asks tiers A and B about the accredited programme and youth sentences', async () => {
    const html = await render('eligibility/eligibility-check', { ...base, tierBand: 'AB' })
    expect(valuesIn(html)).toEqual(['accreditedProgramme', 'recalled', 'deviceRestriction', 'youthSentence', 'none'])
  })

  it.each(['C', 'DG'])('asks tier %s only the questions every tier gets', async band => {
    const html = await render('eligibility/eligibility-check', { ...base, tierBand: band })
    expect(valuesIn(html)).toEqual(allTiers)
  })

  // The supervision package, the final third and early engagement all come from the ESUP
  // supervision-package call now, so the practitioner is not asked about any of them.
  it.each(['AB', 'C', 'DG'])('does not ask tier %s about anything the ESUP call answers', async band => {
    const html = await render('eligibility/eligibility-check', { ...base, tierBand: band })
    expect(valuesIn(html)).not.toContain('supervisionPackage')
    expect(valuesIn(html)).not.toContain('finalThird')
    expect(valuesIn(html)).not.toContain('earlyEngagement')
  })

  it.each(['AB', 'C', 'DG'])('makes "none of these apply" exclusive for tier %s', async band => {
    const html = await render('eligibility/eligibility-check', { ...base, tierBand: band })
    expect(html).toContain('data-behaviour="exclusive"')
  })
})

// The three is-eligible pages share their discussion checkboxes, and only the accredited-programme
// one adds the point about check ins ending with the programme.
describe('the is-eligible discussion checkboxes', () => {
  const valuesIn = (html: string): string[] =>
    [...html.matchAll(/name="esupervision\[[^"]+\]\[checkins\]\[discussion\]" type="checkbox" value="([^"]+)"/g)].map(
      match => match[1],
    )

  const sharedPoints = ['optional', 'canStop', 'notEnforceable', 'moreTime']

  it('adds the programme-only point for the accredited-programme cohort', async () => {
    const html = await render('eligibility/tiers-a-b/accredited-programme-is-eligible', base)
    expect(valuesIn(html)).toEqual([...sharedPoints, 'programmeOnly', 'notAll'])
    expect(html).toContain('They can only use online check ins while they are on an accredited programme')
  })

  it.each(['eligibility/pilot-is-eligible', 'eligibility/tiers-d-g/is-eligible'])(
    'asks %s only the shared points',
    async view => {
      expect(valuesIn(await render(view, base))).toEqual([...sharedPoints, 'notAll'])
    },
  )

  // The boxes are ticked from the stored answers via the macro's `values`, so a practitioner sent
  // back here does not lose what they had already confirmed.
  it('ticks the points already stored in the session', async () => {
    const html = await render('eligibility/tiers-a-b/accredited-programme-is-eligible', {
      ...base,
      data: {
        esupervision: { [crn]: { [id]: { checkins: { discussion: ['canStop', 'programmeOnly'] } } } },
        features: {},
      },
    })
    const checked = [...html.matchAll(/value="([^"]+)" checked/g)].map(match => match[1])
    expect(checked).toEqual(['canStop', 'programmeOnly'])
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

  // The reason came from an answer given there, so going back is a real way to revisit it.
  it('links back to the eligibility check for a reason the practitioner answered', async () => {
    const html = await render('eligibility/not-eligible', { ...base, reason: 'has been recalled to prison' })
    expect(html).toContain(`href="/case/${crn}/appointments/${id}/check-in/eligibility-check"`)
  })

  // A missing Tier is about the record rather than the person, so it reads "they" and explains how a
  // Tier comes to be assigned, in place of the named sentence the other reasons complete.
  it('words a missing tier impersonally and says how a Tier is assigned', async () => {
    const html = await render('eligibility/not-eligible', {
      ...base,
      reason: 'has not been assigned a Tier yet',
      missingTier: true,
    })
    expect(html).toContain('This is because they have not been assigned a Tier yet.')
    expect(html).toContain('once their risk scores have been completed and the system has calculated their Tier')
    expect(html).toContain('You can come back and check eligibility again')
    expect(html).not.toContain('This is because Bob')
  })

  // The eligibility check would rule the person out again the moment it loaded, looping straight
  // back here, so the back link leads to the case overview instead.
  it('links a missing tier back to the case overview rather than the eligibility check', async () => {
    const html = await render('eligibility/not-eligible', {
      ...base,
      reason: 'has not been assigned a Tier yet',
      missingTier: true,
    })
    expect(html).toContain(`href="/case/${crn}"`)
    expect(html).not.toContain('check-in/eligibility-check')
  })

  // A provisional Tier is about the record too, and says the score will be replaced by a final Tier
  // rather than assigned for the first time - so it gets its own wording.
  it('words a provisional tier impersonally and says a final Tier will follow', async () => {
    const html = await render('eligibility/not-eligible', {
      ...base,
      reason: 'is in a provisional Tier',
      provisionalTier: true,
    })
    expect(html).toContain('This is because they are currently in a provisional Tier.')
    expect(html).toContain('once their risk scores have been completed and the system has calculated their final Tier')
    expect(html).toContain('You can come back and check eligibility again')
    expect(html).not.toContain('This is because Bob')
  })

  it('links a provisional tier back to the case overview rather than the eligibility check', async () => {
    const html = await render('eligibility/not-eligible', {
      ...base,
      reason: 'is in a provisional Tier',
      provisionalTier: true,
    })
    expect(html).toContain(`href="/case/${crn}"`)
    expect(html).not.toContain('check-in/eligibility-check')
  })

  // The controller checks a missing tier first - with no score there is no Tier to call provisional -
  // so the template must not show both paragraphs if both flags somehow arrive.
  it('prefers the missing tier wording when a tier is both missing and flagged provisional', async () => {
    const html = await render('eligibility/not-eligible', {
      ...base,
      reason: 'has not been assigned a Tier yet',
      missingTier: true,
      provisionalTier: true,
    })
    expect(html).toContain('This is because they have not been assigned a Tier yet.')
    expect(html).not.toContain('provisional Tier')
  })

  // Not being supervised is the one reason that cannot clear, so it lists what might explain it
  // instead of inviting the practitioner to check eligibility again.
  it('lists what might explain a person no longer being supervised', async () => {
    const html = await render('eligibility/not-eligible', {
      ...base,
      reason: 'is not currently being supervised',
      notSupervised: true,
    })
    expect(html).toContain('This is because they are not currently being supervised')
    expect(html).toContain('This could be because they have:')
    expect(html).toContain('<li>passed away</li>')
    expect(html).toContain('<li>been recalled to prison</li>')
    expect(html).toContain('<li>have finished their probation</li>')
    expect(html).not.toContain('This is because Bob')
    expect(html).not.toContain('check eligibility again')
  })

  it('links a person no longer supervised back to the case overview, and offers it as the button', async () => {
    const html = await render('eligibility/not-eligible', {
      ...base,
      reason: 'is not currently being supervised',
      notSupervised: true,
    })
    expect(html).toContain(`href="/case/${crn}"`)
    expect(html).not.toContain('check-in/eligibility-check')
    expect(html).toContain("Go to Bob's overview")
  })

  // Both come from the ESUP supervision-package call and rule the person out before the check even
  // renders, so going back there would be redirected straight to this page again.
  it.each([
    ['no supervision package', { noSupervisionPackage: true }, 'is not on a supervision package'],
    ['the final third', { inFinalThird: true }, 'is in the final third of their sentence'],
  ])('links %s back to the case overview rather than the eligibility check', async (_name, flag, reason) => {
    const html = await render('eligibility/not-eligible', { ...base, reason, ...flag })
    expect(html).toContain(`This is because Bob ${reason}.`)
    expect(html).toContain(`href="/case/${crn}"`)
    expect(html).not.toContain('check-in/eligibility-check')
  })

  // Early engagement only rules a person out alongside the accredited programme box, so unticking it
  // is a real way to revisit the outcome - unlike the two above.
  it('links early engagement back to the eligibility check', async () => {
    const html = await render('eligibility/not-eligible', {
      ...base,
      reason: 'is in Tier A and on an accredited programme, but they are in early engagement',
    })
    expect(html).toContain(`href="/case/${crn}/appointments/${id}/check-in/eligibility-check"`)
  })
})
