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
  'check-in-frequency',
  'sentence-selection',
  'check-in-date',
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
  'manage/checkin-settings-frequency',
  'manage/checkin-settings-date',
  'manage/restart-checkin-summary',
  'manage/restart-checkin-date',
  'questions/add-questions',
  'questions/list-questions',
]

const render = (view: string, locals: Record<string, unknown>): Promise<string> =>
  new Promise((resolve, reject) => {
    app.render(`pages/check-in/${view}.njk`, locals, (err: Error, html: string) => (err ? reject(err) : resolve(html)))
  })

const cancelLinkOf = (html: string) =>
  html.match(/<a[^>]*data-qa="formAnchorLink"[^>]*>/)?.[0].match(/href="([^"]+)"/)?.[1]

describe('sentence selection and summaries', () => {
  const events = [
    {
      number: 1,
      mainOffence: { description: 'Theft' },
      sentence: { description: 'Community order', expectedEndDate: '2028-01-02', length: 12, lengthUnit: 'months' },
    },
    { number: 2, mainOffence: { description: 'Burglary' }, sentence: null },
  ]

  it('renders only the sentence description, end-date hint, and saved selection', async () => {
    const html = await render('sentence-selection', {
      ...base,
      events,
      currentEvent: 1,
      eligibilitySessionKey: 'checkins',
    })
    expect(html).toContain('Community order')
    expect(html).toContain('2 January 2028')
    expect(html).toContain('Not available')
    expect(html).not.toContain('Theft')
    expect(html).not.toContain('12 months')
    expect(html).not.toContain('Sentence end date:')
    expect(html).toMatch(/value="1"[^>]*checked/)
  })

  it.each([
    ['checkin-summary', `/case/${crn}/appointments/${id}/check-in/sentence-selection?cya=true`],
    [
      'manage/restart-checkin-summary',
      `/case/${crn}/appointments/check-in/manage/${id}/restart-sentence-selection?cya=true`,
    ],
  ])('shows the chosen sentence and change link on %s', async (view, changeUrl) => {
    const html = await render(view, {
      ...base,
      userDetails: { ...(base.userDetails as object), events, currentEvent: 1 },
    })
    expect(html).toContain('Theft - Community order (12 months)')
    expect(html).toContain('Sentence end date: 2 January 2028')
    expect(html).toContain(`href="${changeUrl}"`)
    expect(html).not.toContain('Burglary')
  })

  it('shows the sole sentence without a change link', async () => {
    const html = await render('checkin-summary', {
      ...base,
      userDetails: { ...(base.userDetails as object), events: [events[0]], currentEvent: 1 },
    })
    expect(html).toContain('Theft - Community order (12 months)')
    expect(html).not.toContain('data-qa="sentenceAction"')
  })
})

describe('check-in-date', () => {
  const setupPage = `/case/${crn}/appointments/${id}/check-in`

  it('offers no cancel link on the first pass', async () => {
    const html = await render('check-in-date', { ...base, backLink: `${setupPage}/check-in-frequency` })
    expect(cancelLinkOf(html)).toBeUndefined()
  })

  // The summary restores the ad-hoc answer this date would have replaced.
  it('cancels back to the summary during a check-your-answers edit', async () => {
    const html = await render('check-in-date', {
      ...base,
      cya: true,
      backLink: `${setupPage}/check-in-frequency?cya=true`,
    })
    expect(cancelLinkOf(html)).toBe(`${setupPage}/checkin-summary`)
  })
})

describe('manage/restart-checkin-date', () => {
  const managePage = `/case/${crn}/appointments/check-in/manage/${id}`

  it('cancels the whole restart on the first pass', async () => {
    const html = await render('manage/restart-checkin-date', { ...base, backLink: `${managePage}/restart-checkin` })
    expect(cancelLinkOf(html)).toBe(managePage)
  })

  // The summary restores the ad-hoc answer this date would have replaced.
  it('cancels back to the summary during a check-your-answers edit', async () => {
    const html = await render('manage/restart-checkin-date', {
      ...base,
      cya: true,
      backLink: `${managePage}/restart-checkin?cya=true`,
    })
    expect(cancelLinkOf(html)).toBe(`${managePage}/restart-summary`)
  })
})

describe('questions/list-questions', () => {
  const templatesList = {
    templates: [{ id: 3, displayTemplate: 'How has [insert text] been going recently?', example: 'unpaid work' }],
  }
  const inputId = `esupervision-${crn}-${id}-manageQuestions-bespokeQuestionInput`

  it('offers a write-your-own form that posts back to the page', async () => {
    const html = await render('questions/list-questions', { ...base, templatesList })

    expect(html).toContain('What do you want to ask Bob?')
    expect(html).toContain(`name="esupervision[${crn}][${id}][manageQuestions][bespokeQuestionInput]"`)
    // The writing guidance is passed to govukDetails as a call block, which the macro renders
    expect(html).toMatch(/govuk-details__text">\s*<p class="govuk-body"><strong>You should:<\/strong><\/p>/)
    expect(html).toContain('<form method="post" autocomplete="off" action="/current">')
    expect(html).toContain('data-qa="submit-btn"')
    expect(html).not.toContain('govuk-error-summary')
  })

  it('shows the error summary and field error when nothing was written', async () => {
    const html = await render('questions/list-questions', {
      ...base,
      templatesList,
      errorMessages: { [inputId]: 'Enter what you want to ask the person' },
    })

    expect(html).toMatch(/<title>\s*Error: Choose a question to add or write your own/)
    expect(html).toContain('govuk-error-summary')
    expect(html).toContain(`href="#${inputId}"`)
    expect(html).toContain('govuk-input--error')
    expect(html.match(/Enter what you want to ask the person/g)).toHaveLength(2)
  })
})

describe('questions/edit-question', () => {
  it('shows the whole bespoke question with a visible label', async () => {
    const html = await render('questions/edit-question', {
      ...base,
      isBespoke: true,
      questionId: 'bespoke-f47ac10b-58cc-4372-a567-0e02b2c3d479',
      question: null,
      data: {
        esupervision: {
          [crn]: {
            [id]: {
              manageQuestions: {
                questionTemplateAndInputs: {
                  'bespoke-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'Have you managed to speak to your landlord?',
                },
              },
            },
          },
        },
      },
    })

    expect(html).toMatch(/<title>\s*Write your own question/)
    expect(html).toContain('What do you want to ask Bob?')
    expect(html).toContain('value="Have you managed to speak to your landlord?"')
    expect(html).not.toContain('[insert text]')
    expect(html).not.toContain('For example')
  })
})

describe('questions/add-questions', () => {
  it('posts question deletion with a CSRF token', async () => {
    const html = await render('questions/add-questions', {
      ...base,
      addedQuestions: [{ id: '1-question', fullText: 'How is work?' }],
      expectedCheckinDate: '2026-08-01',
    })
    const deletePath = `/case/${crn}/appointments/check-in/manage/${id}/questions/1-question/delete`

    expect(html).toContain(
      `<form method="post" action="${deletePath}"><input type="hidden" name="_csrf" value="token">`,
    )
    expect(html).toContain('<div class="app-table-actions">')
    expect(html).toContain('<strong>1 August 2026</strong>')
  })

  it('links to the question list while fewer than 3 questions are added', async () => {
    const html = await render('questions/add-questions', {
      ...base,
      addedQuestions: [],
      expectedCheckinDate: '2026-08-01',
    })

    expect(html).toContain(`href="/case/${crn}/appointments/check-in/manage/${id}/questions/list"`)
    expect(html).not.toContain('data-qa="custom-questions-table"')
  })

  it('disables the add button once 3 questions are added', async () => {
    const addedQuestions = ['1', '2', '3'].map(n => ({ id: `${n}-question`, fullText: `Question ${n}?` }))
    const html = await render('questions/add-questions', { ...base, addedQuestions, expectedCheckinDate: '2026-08-01' })

    expect(html).not.toContain(`href="/case/${crn}/appointments/check-in/manage/${id}/questions/list"`)
    expect(html).toMatch(/<button[^>]*\sdisabled\s[^>]*data-qa="add-question-btn"/)
    expect(html).toContain('data-qa="custom-questions-table"')
  })
})

describe('schedule-check-in/list-questions', () => {
  const templatesList = {
    templates: [{ id: 3, displayTemplate: 'How has [insert text] been going recently?', example: 'unpaid work' }],
  }
  const inputId = `esupervision-${crn}-${id}-scheduleCheckIn-bespokeQuestionInput`
  const addPage = `/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/add`

  it('offers a write-your-own form under the ad hoc session group', async () => {
    const html = await render('schedule-check-in/list-questions', { ...base, templatesList })

    expect(html).toContain('What do you want to ask Bob?')
    expect(html).toContain(`name="esupervision[${crn}][${id}][scheduleCheckIn][bespokeQuestionInput]"`)
    expect(html).toMatch(/govuk-details__text">\s*<p class="govuk-body"><strong>You should:<\/strong><\/p>/)
    expect(html).toContain('<form method="post" autocomplete="off" action="/current">')
    expect(html).toContain('data-qa="submit-btn"')
    expect(html).toContain(`href="${addPage}" data-qa="cancel-link"`)
    expect(html).toContain(
      `href="/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/3/select"`,
    )
    expect(html).not.toContain('govuk-error-summary')
  })

  it('shows the error summary and field error when nothing was written', async () => {
    const html = await render('schedule-check-in/list-questions', {
      ...base,
      templatesList,
      errorMessages: { [inputId]: 'Enter what you want to ask the person' },
    })

    expect(html).toMatch(/<title>\s*Error: Add questions to the person/)
    expect(html).toContain('govuk-error-summary')
    expect(html).toContain(`href="#${inputId}"`)
    expect(html).toContain('govuk-input--error')
    expect(html.match(/Enter what you want to ask the person/g)).toHaveLength(2)
  })
})

describe('schedule-check-in/edit-question', () => {
  it('shows the whole bespoke question with a visible label', async () => {
    const html = await render('schedule-check-in/edit-question', {
      ...base,
      isBespoke: true,
      questionId: 'bespoke-f47ac10b-58cc-4372-a567-0e02b2c3d479',
      question: null,
      data: {
        esupervision: {
          [crn]: {
            [id]: {
              scheduleCheckIn: {
                questionTemplateAndInputs: {
                  'bespoke-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'Have you managed to speak to your landlord?',
                },
              },
            },
          },
        },
      },
    })

    expect(html).toMatch(/<title>\s*Write your own question/)
    expect(html).toContain('What do you want to ask Bob?')
    expect(html).toContain(`name="esupervision[${crn}][${id}][scheduleCheckIn][draftQuestionInput]"`)
    expect(html).toContain('value="Have you managed to speak to your landlord?"')
    expect(html).not.toContain('[insert text]')
  })
})

describe('schedule-check-in/add-questions', () => {
  it('posts question deletion with a CSRF token', async () => {
    const html = await render('schedule-check-in/add-questions', {
      ...base,
      addedQuestions: [{ id: '1-question', fullText: 'How is work?' }],
      expectedCheckinDate: '1/8/2026',
    })
    const deletePath = `/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/1-question/delete`

    expect(html).toContain(
      `<form method="post" action="${deletePath}"><input type="hidden" name="_csrf" value="token">`,
    )
    expect(html).toContain('<div class="app-table-actions">')
    expect(html).toContain('<strong>1 August 2026</strong>')
  })

  it('links to the question list while fewer than 3 questions are added', async () => {
    const html = await render('schedule-check-in/add-questions', {
      ...base,
      addedQuestions: [],
      expectedCheckinDate: '1/8/2026',
    })

    expect(html).toContain(`href="/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/list"`)
    expect(html).not.toContain('data-qa="custom-questions-table"')
  })

  it('disables the add button once 3 questions are added', async () => {
    const addedQuestions = ['1', '2', '3'].map(n => ({ id: `${n}-question`, fullText: `Question ${n}?` }))
    const html = await render('schedule-check-in/add-questions', {
      ...base,
      addedQuestions,
      expectedCheckinDate: '1/8/2026',
    })

    expect(html).not.toContain(
      `href="/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in/questions/list"`,
    )
    expect(html).toMatch(/<button[^>]*\sdisabled\s[^>]*data-qa="add-question-btn"/)
    expect(html).toContain('data-qa="custom-questions-table"')
  })
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

describe('shared eligibility templates in reactivation', () => {
  const eligibilityUrlPrefix = `/case/${crn}/appointments/check-in/manage/${id}/restart-`
  const restartBase = {
    ...base,
    eligibilitySessionKey: 'restartCheckin',
    eligibilityUrlPrefix,
    data: {
      esupervision: {
        [crn]: {
          [id]: { restartCheckin: { eligibility: ['none'], pilotCheck: 'true', discussion: [] as string[] } },
        },
      },
      features: {},
    },
  }

  it('posts eligibility, pilot, discussion, approval, and rationale under restartCheckin', async () => {
    const eligibility = await render('eligibility/eligibility-check', restartBase)
    const pilot = await render('eligibility/pilot-check', restartBase)
    const isEligible = await render('eligibility/pilot-is-eligible', restartBase)
    const approval = await render('accredited-programme-approval', restartBase)
    const rationale = await render('rationale', { ...restartBase, accreditedProgramme: true })

    expect(eligibility).toContain(`[${id}][restartCheckin][eligibility]`)
    expect(pilot).toContain(`[${id}][restartCheckin][pilotCheck]`)
    expect(isEligible).toContain(`[${id}][restartCheckin][discussion]`)
    expect(approval).toContain(`[${id}][restartCheckin][accreditedProgrammeApproval]`)
    expect(rationale).toContain('Why is the person suitable to use online check ins?')
  })

  it('keeps the pilot eligible back link in the reactivation journey', async () => {
    const html = await render('eligibility/pilot-is-eligible', restartBase)
    expect(html).toContain(`href="${eligibilityUrlPrefix}pilot-check"`)
  })

  it('returns answer-based exclusions to the restart eligibility check', async () => {
    const html = await render('eligibility/not-eligible', {
      ...restartBase,
      reason: 'has been recalled to prison',
    })
    expect(html).toContain(`href="${eligibilityUrlPrefix}eligibility-check"`)
  })

  it('keeps record-based exclusions linked to the case overview', async () => {
    const html = await render('eligibility/not-eligible', { ...restartBase, missingTier: true })
    expect(html).toContain(`href="/case/${crn}"`)
    expect(html).not.toContain('restart-eligibility-check')
  })

  it('returns the discussion gate to the restart eligible page', async () => {
    const html = await render('eligibility/discuss-before-signup', restartBase)
    expect(html).toContain(`href="${eligibilityUrlPrefix}is-eligible"`)
  })
})

describe.each([
  ['questions/edit-question', 'manageQuestions'],
  ['schedule-check-in/edit-question', 'scheduleCheckIn'],
])('%s', (view, group) => {
  const questionId = '1-question'
  const fieldId = `esupervision-${crn}-${id}-${group}-draftQuestionInput`
  const renderWithSavedAnswer = (body?: Record<string, unknown>) =>
    render(view, {
      ...base,
      question: { prefix: 'How has ', suffix: '?', questionExamples: ['Example one', 'Example two'] },
      questionId,
      ...(body ? { body } : {}),
      data: {
        esupervision: {
          [crn]: {
            [id]: { [group]: { questionTemplateAndInputs: { [questionId]: 'previous answer' } } },
          },
        },
      },
    })

  it('keeps a submitted blank answer blank instead of restoring the saved answer', async () => {
    const html = await renderWithSavedAnswer({
      esupervision: { [crn]: { [id]: { [group]: { draftQuestionInput: '' } } } },
    })

    expect(html).toMatch(new RegExp(`id="${fieldId}"[^>]*value=""`))
  })

  it('uses the saved answer when the page is rendered without a submission', async () => {
    const html = await renderWithSavedAnswer()

    expect(html).toMatch(new RegExp(`id="${fieldId}"[^>]*value="previous answer"`))
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

  it('explains that the accredited-programme cohort can reduce in-person appointments to monthly', async () => {
    const html = await render('eligibility/tiers-a-b/accredited-programme-is-eligible', base)
    const pageTitle = 'The person is eligible to use online check ins to reduce in person appointments to monthly'
    const title = 'Bob is eligible to use online check ins to reduce in person appointments to monthly'

    expect(html).toMatch(new RegExp(`<title>\\s*${pageTitle} -`))
    expect(html).toMatch(new RegExp(`<h2[^>]*data-qa="pageHeading">\\s*${title}`))
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

  // Ruled out by Tier alone, so the page explains the Tier A to C rules and the pilot instead.
  it.each([
    [
      'a Tier A/B programme exclusion',
      { reason: 'is in Tier A and on an accredited programme, but they are in early engagement' },
    ],
    [
      'a Tier A/B person outside the pilot',
      {
        reason: 'is in Tier A and',
        reasonBullets: [
          'not on an accredited programme',
          'you have no people who were signed up to use online check ins before 1 October 2026',
        ],
      },
    ],
    [
      'a Tier C person outside the pilot',
      {
        reason:
          'is in Tier C and you do not have people on your caseload who started using online check ins before 1 October 2026',
      },
    ],
  ])('explains the Tier A to C rules and the pilot for %s', async (_name, outcome) => {
    const html = await render('eligibility/not-eligible', { ...base, ...outcome, additionalTierInformation: true })
    expect(html).toContain(
      'Tiers A to C are not eligible to use online check ins unless they fall into specific categories.',
    )
    expect(html).toContain('We’ll be running this pilot until March 2027')
    expect(html).toContain(
      'If you think this is wrong, you can go back and perform the eligibility check again. <a class="govuk-link" href="https://example.com/practitioner-guidance" target="_blank" rel="noreferrer noopener">Find out more about eligibility in our guidance (opens in new tab).</a>',
    )
    expect(html).toContain(
      '<a class="govuk-link" href="mailto:checkinwithprobation@justice.gov.uk">checkinwithprobation@justice.gov.uk (opens in email app)</a> for support.',
    )
    expect(html).not.toContain('If you think this information is wrong')
  })

  it('leaves the Tier A to C explanation off other reasons', async () => {
    const html = await render('eligibility/not-eligible', { ...base, reason: 'has been recalled to prison' })
    expect(html).not.toContain('Tiers A to C')
    expect(html).toContain('If you think this information is wrong')
  })
})

// An ad-hoc setup schedules no first check in, so there is no date to show or change.
describe('the manage settings pages', () => {
  it('does not leak template syntax into the frequency page', async () => {
    const html = await render('manage/checkin-settings-frequency', base)
    expect(html).not.toMatch(/^\s*}/m)
    expect(html).toContain('How often would you like Bob to check in?')
  })

  it('titles the date page after its heading', async () => {
    const html = await render('manage/checkin-settings-date', base)
    expect(html).toMatch(/<title>\s*When would you like the person to complete their next online check in\? - /)
  })

  // The validator re-renders with the minimum date read back from the posted body, so the page
  // has to carry it on a hidden input as the setup and restart date pages do.
  it('carries the minimum date on a hidden input so an error re-render keeps it', async () => {
    const html = await render('manage/checkin-settings-date', base)
    expect(html).toContain('<input type="hidden" name="checkInMinDate" value="1/8/2026">')
    expect(html).toContain('For example, 17/5/2024. They will get a notification')
  })

  it('titles the date page error state after its heading', async () => {
    const html = await render('manage/checkin-settings-date', {
      ...base,
      errorMessages: { [`esupervision-${crn}-${id}-manageCheckin-date`]: 'Enter a date' },
    })
    expect(html).toMatch(/<title>\s*Error: When would you like the person/)
  })
})

describe('a reactivation summary', () => {
  it.each([
    ['Email', 'Email address', 'bob@example.com', 'checkInEmailAction', 'checkInMobileAction'],
    ['Text message', 'Mobile number', '07700900000', 'checkInMobileAction', 'checkInEmailAction'],
  ])('shows only the selected %s contact detail', async (preferredComs, label, value, selectedAction, otherAction) => {
    const html = await render('manage/restart-checkin-summary', {
      ...base,
      userDetails: { ...(base.userDetails as Record<string, unknown>), preferredComs },
    })

    expect(html).toContain(label)
    expect(html).toContain(value)
    expect(html).toContain('How does Bob want us to send a link to the service?')
    expect(html).toContain(`data-qa="preferredComsAction"`)
    expect(html).toContain(`data-qa="${selectedAction}"`)
    expect(html).not.toContain(`data-qa="${otherAction}"`)
  })

  it('shows the rationale for the accredited-programme cohort', async () => {
    const html = await render('manage/restart-checkin-summary', {
      ...base,
      userDetails: {
        ...(base.userDetails as Record<string, unknown>),
        accreditedProgramme: true,
        rationale: 'Stable and low risk',
      },
    })
    expect(html).toContain('Why is Bob suitable to use online check ins?')
    expect(html).toContain('Stable and low risk')
    expect(html).toContain('data-qa="rationaleAction"')
  })
})

describe('a scheduled setup confirmation', () => {
  it('offers to add questions when the first check in is in the future', async () => {
    const html = await render('confirmation', base)
    expect(html).toContain('data-qa="add-additional-questions"')
  })

  // Questions close at 23:59 the day before, so a first check in today has nothing to add to.
  it('hides the questions link when the first check in is today', async () => {
    const html = await render('confirmation', { ...base, isFutureCheckinDate: false })
    expect(html).not.toContain('data-qa="add-additional-questions"')
    expect(html).toContain('data-qa="submit-btn"')
  })
})

describe('a scheduled restart confirmation', () => {
  it('offers to add questions when the next check in is in the future', async () => {
    const html = await render('manage/restart-confirmation', base)
    expect(html).toContain('data-qa="add-additional-questions"')
  })

  // Questions close at 23:59 the day before, so a restart dated today has nothing to add to.
  it('hides the questions link when the next check in is today', async () => {
    const html = await render('manage/restart-confirmation', { ...base, isFutureCheckinDate: false })
    expect(html).not.toContain('data-qa="add-additional-questions"')
    expect(html).toContain('data-qa="submit-btn"')
  })

  // The case list and overview live in Manage People on Probation, not this service.
  it('sends both finishing links to Manage People on Probation', async () => {
    const mpop = 'https://mpop.example.com'
    const html = await render('manage/restart-confirmation', { ...base, managePeopleOnProbationUrl: mpop })
    expect(html).toContain(`href="${mpop}/case/" data-qa="returnToAllCases"`)
    expect(html).toContain(`href="${mpop}/case/${crn}" class="govuk-button" data-qa="submit-btn"`)
  })
})

describe('the manage page settings card', () => {
  const managePage = `/case/${crn}/appointments/check-in/manage/${id}`
  const scheduled = {
    ...base,
    offenderCheckinsByCRNResponse: {
      status: 'VERIFIED',
      firstCheckin: '2026-08-01',
      checkinInterval: 'WEEKLY',
      contactPreference: 'EMAIL',
    },
    checkinFrequency: 'WEEKLY',
    nextCheckinDate: '2026-10-20',
    showChange: true,
    canChangeDate: true,
    email: 'bob@example.com',
    mobile: '07700900000',
  }

  it.each([
    ['SCHEDULED', false],
    ['AD_HOC', true],
  ])('shows the scheduling button for mode %s: %s', async (mode, visible) => {
    const html = await render('manage/manage-checkin', {
      ...scheduled,
      offenderCheckinsByCRNResponse: { ...scheduled.offenderCheckinsByCRNResponse, mode },
    })

    expect(html.includes('data-qa="schedule-check-in-btn"')).toBe(visible)
  })

  it('shows an unbooked ad-hoc check in without a settings date or stale questions', async () => {
    const html = await render('manage/manage-checkin', {
      ...scheduled,
      offenderCheckinsByCRNResponse: { ...scheduled.offenderCheckinsByCRNResponse, mode: 'AD_HOC' },
      checkinFrequency: 'AD_HOC',
      nextCheckinDate: undefined,
      upcomingCheckin: { questions: [{ question: 'Stale question' }] },
    })

    expect(html).toContain('data-qa="schedule-check-in-btn"')
    expect(html).toContain('data-qa="checkinQuestionsCard"')
    expect(html).toContain('No online check in scheduled')
    expect(html).toContain("I'll schedule them one at a time")
    expect(html).not.toContain('data-qa="nextCheckinDueLabel"')
    expect(html).not.toContain('Stale question')
    expect(html).not.toContain('Change questions')
  })

  it.each(['AD_HOC', 'SCHEDULED'])('shows the upcoming date and questions for a booked %s check in', async mode => {
    const html = await render('manage/manage-checkin', {
      ...scheduled,
      offenderCheckinsByCRNResponse: { ...scheduled.offenderCheckinsByCRNResponse, mode },
      checkinFrequency: mode === 'AD_HOC' ? 'AD_HOC' : 'WEEKLY',
      upcomingCheckin: {
        expectedCheckinDate: '2026-10-20',
        questions: [{ question: 'How is work?' }],
      },
      canEditQuestions: true,
    })

    expect(html).not.toContain('data-qa="schedule-check-in-btn"')
    expect(html).toContain('data-qa="nextCheckinDueLabel"')
    expect(html).toContain('How is work?')
    expect(html).toContain('Change questions')
    expect(html).not.toContain('No online check in scheduled')
    if (mode === 'AD_HOC') expect(html).toContain("I'll schedule them one at a time")
  })

  // The saved first date is where the schedule started; the controller supplies the day it next falls on.
  it('shows the next check in day the controller supplies, not the saved first date', async () => {
    const html = await render('manage/manage-checkin', scheduled)
    expect(html).toContain('20 October 2026')
    expect(html).not.toContain('1 August 2026')
  })

  it('lets a scheduled person change their next check in date and their frequency', async () => {
    const html = await render('manage/manage-checkin', scheduled)
    // govukSummaryList leaves whitespace between the href and the data attributes.
    expect(html).toMatch(new RegExp(`href="${managePage}/settings-date"\\s+data-qa="changeDateAction"`))
    expect(html).toMatch(new RegExp(`href="${managePage}/settings"\\s+data-qa="changeFrequencyAction"`))
  })

  // An ad-hoc person with nothing booked has no next check in to move: they book one instead.
  it('offers only the frequency change to an ad-hoc person with nothing booked', async () => {
    const html = await render('manage/manage-checkin', {
      ...scheduled,
      offenderCheckinsByCRNResponse: { ...scheduled.offenderCheckinsByCRNResponse, firstCheckin: null, mode: 'AD_HOC' },
      checkinFrequency: 'AD_HOC',
      nextCheckinDate: undefined,
    })
    expect(html).not.toContain('data-qa="nextCheckinDueLabel"')
    expect(html).not.toContain('data-qa="changeDateAction"')
    expect(html).toContain('data-qa="changeFrequencyAction"')
  })

  // A booked ad-hoc check in is moved by booking it again, so its change link goes to that journey.
  it('lets an ad-hoc person move a booked check in from the schedule page', async () => {
    const html = await render('manage/manage-checkin', {
      ...scheduled,
      offenderCheckinsByCRNResponse: { ...scheduled.offenderCheckinsByCRNResponse, firstCheckin: null, mode: 'AD_HOC' },
      checkinFrequency: 'AD_HOC',
      upcomingCheckin: { expectedCheckinDate: '2026-10-20', questions: [] },
    })
    expect(html).toMatch(new RegExp(`href="${managePage}/schedule-check-in"\\s+data-qa="changeDateAction"`))
    expect(html).not.toMatch(new RegExp(`href="${managePage}/settings-date"`))
    expect(html).toContain('data-qa="changeFrequencyAction"')
  })

  // The controller withholds canChangeDate once the check in is active (due today) or past.
  it('keeps the date but drops its change link once the check in is active', async () => {
    const html = await render('manage/manage-checkin', {
      ...scheduled,
      canChangeDate: false,
      upcomingCheckin: { expectedCheckinDate: '2026-10-16', questions: [] },
    })
    expect(html).toContain('data-qa="nextCheckinDueLabel"')
    expect(html).not.toContain('data-qa="changeDateAction"')
    expect(html).toContain('data-qa="changeFrequencyAction"')
  })

  it('offers no changes once check ins are stopped', async () => {
    const html = await render('manage/manage-checkin', {
      ...scheduled,
      offenderCheckinsByCRNResponse: { ...scheduled.offenderCheckinsByCRNResponse, status: 'INACTIVE' },
      showChange: false,
      canChangeDate: false,
    })
    expect(html).not.toContain('data-qa="changeDateAction"')
    expect(html).not.toContain('data-qa="changeFrequencyAction"')
  })
})

describe('the settings date page back link', () => {
  it('goes wherever the controller says, for both Back and Cancel', async () => {
    const html = await render('manage/checkin-settings-date', { ...base, backLink: '/somewhere' })
    expect(html.match(/href="\/somewhere"/g)).toHaveLength(2)
  })
})

describe('an ad-hoc setup', () => {
  const adHoc = {
    ...base,
    userDetails: {
      ...(base.userDetails as object),
      date: undefined as string,
      displayDay: undefined as string,
      interval: "I'll schedule them one at a time",
      isAdHoc: true,
    },
    isFutureCheckinDate: false,
  }

  it('leaves the check-in date off the summary', async () => {
    const html = await render('checkin-summary', adHoc)
    expect(html).not.toContain('check-in/check-in-date')
    expect(html).toContain(`/case/${crn}/appointments/${id}/check-in/check-in-frequency?cya=true`)
  })

  it('shows the date on the summary once for a standard interval', async () => {
    const html = await render('checkin-summary', base)
    expect(html.match(/data-qa="dateAction"/g)).toHaveLength(1)
    expect(html).toContain(`/case/${crn}/appointments/${id}/check-in/check-in-date?cya=true`)
  })

  // An ad-hoc setup has no first check-in date, so this explanation cannot hang off one.
  it('always explains how ad-hoc scheduling works', async () => {
    const html = await render('confirmation', adHoc)
    expect(html).toContain('Schedule an online check in</h3>')
    expect(html).toContain('You can only schedule one online check in at a time.')
  })

  // The ad-hoc confirmation shows no schedule at all: the practitioner books check ins one at a time.
  it('offers to schedule a check in instead of showing a start date', async () => {
    const html = await render('confirmation', adHoc)
    expect(html).not.toMatch(/Starting/)
    expect(html).not.toContain('I&#39;ll schedule them one at a time')
    expect(html).toContain(`href="/case/${crn}/appointments/check-in/manage/${id}/schedule-check-in"`)
    expect(html).toContain('Schedule a check in')
  })
})
