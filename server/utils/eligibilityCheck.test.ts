import {
  isAccreditedProgrammeRoute,
  notEligibleDisplay,
  sameEligibilityAnswers,
  targetForEligibilityCheck,
  toStoredEligibilityCheck,
} from './eligibilityCheck'

const answers = { accreditedProgramme: true, deviceRestriction: false, youthSentence: false }

describe('utils/eligibilityCheck', () => {
  it('stores the response with the answers it was made with', () => {
    expect(toStoredEligibilityCheck({ outcome: 'UNKNOWN', message: 'Maybe' }, null)).toEqual({
      outcome: 'UNKNOWN',
      message: 'Maybe',
      ruleCode: null,
      answers: null,
    })
  })

  it.each([
    ['ELIGIBLE', 'is-eligible'],
    ['INELIGIBLE', 'not-eligible'],
    ['UNKNOWN', null],
  ] as const)('sends %s to %s', (outcome, target) => {
    expect(targetForEligibilityCheck({ outcome })).toBe(target)
  })

  it('has no target without a check', () => {
    expect(targetForEligibilityCheck(undefined)).toBeNull()
  })

  it('takes only an eligible outcome decided by early engagement as the accredited programme route', () => {
    expect(isAccreditedProgrammeRoute({ outcome: 'ELIGIBLE', ruleCode: 'IN_EARLY_ENGAGEMENT' })).toBe(true)
    expect(isAccreditedProgrammeRoute({ outcome: 'INELIGIBLE', ruleCode: 'IN_EARLY_ENGAGEMENT' })).toBe(false)
    expect(isAccreditedProgrammeRoute({ outcome: 'ELIGIBLE', ruleCode: 'IS_TIER_D_TO_G' })).toBe(false)
    expect(isAccreditedProgrammeRoute({ outcome: 'ELIGIBLE', ruleCode: 'PRACTITIONER_HAS_PILOT_CASE' })).toBe(false)
  })

  it('compares answers field by field, and never matches a missing set', () => {
    expect(sameEligibilityAnswers(answers, { ...answers })).toBe(true)
    expect(sameEligibilityAnswers(answers, { ...answers, youthSentence: true })).toBe(false)
    expect(sameEligibilityAnswers(null, answers)).toBe(false)
    expect(sameEligibilityAnswers(answers, undefined)).toBe(false)
  })

  it.each([
    ['IS_TIER_MISSING', { missingTier: true, returnToOverviewPage: true }],
    ['IS_TIER_PROVISIONAL', { provisionalTier: true, returnToOverviewPage: true }],
    ['HAS_ACTIVE_EVENT', { notSupervised: true, returnToOverviewPage: true }],
    ['ON_SUPERVISION_PACKAGE', { returnToOverviewPage: true }],
    ['IS_RECALLED', { returnToOverviewPage: true }],
    ['IS_TIER_C', { additionalTierInformation: true }],
    ['ON_ACCREDITED_PROGRAMME', { additionalTierInformation: true }],
    ['ON_YOUTH_SENTENCE', { additionalTierInformation: true }],
    ['IN_EARLY_ENGAGEMENT', { additionalTierInformation: true }],
    ['HAS_DEVICE_RESTRICTION', {}],
  ])('shows %s on the not-eligible page', (ruleCode, expected) => {
    expect(notEligibleDisplay(ruleCode)).toEqual({
      missingTier: false,
      provisionalTier: false,
      notSupervised: false,
      returnToOverviewPage: false,
      additionalTierInformation: false,
      ...expected,
    })
  })
})
