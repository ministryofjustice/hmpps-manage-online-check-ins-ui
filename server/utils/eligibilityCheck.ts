// The eligibility journey when the `useEligibilityEndpoint` flag is on: the ESUP API applies the
// eligibility rules and this module turns its answer into the page to go to. Kept free of Express,
// like eligibilityRules, so it can be tested directly.
import { EligibilityAnswers, EligibilityCheckOutcome, EligibilityCheckResponse } from '../data/model/esupervision'
import type { EligibilityTarget } from './eligibilityRules'

// Whether the request's evaluated feature flags turn the API-backed journey on.
export const useEligibilityEndpoint = (locals: Record<string, unknown>): boolean =>
  (locals.flags as Record<string, unknown> | undefined)?.useEligibilityEndpoint === true

// What the eligibility pages store in session from the API's answer. `answers` are the ones the
// check was made with - null for the check made before the practitioner has answered anything - so
// the access guard can tell when the stored outcome no longer matches what was submitted.
export interface StoredEligibilityCheck {
  outcome: EligibilityCheckOutcome
  message: string | null
  ruleCode: string | null
  answers: EligibilityAnswers | null
}

export const toStoredEligibilityCheck = (
  response: EligibilityCheckResponse,
  answers: EligibilityAnswers | null,
): StoredEligibilityCheck => ({
  outcome: response.outcome,
  message: response.message ?? null,
  ruleCode: response.ruleCode ?? null,
  answers,
})

// The Tier A/B accredited-programme route is the one that runs all the way to the early engagement
// rule, which makes the person eligible when they are not in early engagement. Every other eligible
// outcome is decided by an earlier rule: Tiers D-G, or the pilot.
export const ACCREDITED_PROGRAMME_RULE = 'IN_EARLY_ENGAGEMENT'

export const isAccreditedProgrammeRoute = (check?: Pick<StoredEligibilityCheck, 'outcome' | 'ruleCode'> | null) =>
  check?.outcome === 'ELIGIBLE' && check.ruleCode === ACCREDITED_PROGRAMME_RULE

// Where an answered check leads. UNKNOWN once the answers are in means the API asked for something
// this journey doesn't collect, so it has no page - the caller treats it as an error.
export const targetForEligibilityCheck = (
  check?: Pick<StoredEligibilityCheck, 'outcome'> | null,
): EligibilityTarget | null => {
  switch (check?.outcome) {
    case 'ELIGIBLE':
      return 'is-eligible'
    case 'INELIGIBLE':
      return 'not-eligible'
    default:
      return null
  }
}

export const sameEligibilityAnswers = (a?: EligibilityAnswers | null, b?: EligibilityAnswers | null): boolean =>
  Boolean(a) &&
  Boolean(b) &&
  a.accreditedProgramme === b.accreditedProgramme &&
  a.deviceRestriction === b.deviceRestriction &&
  a.youthSentence === b.youthSentence

// Rules decided from records alone. Going back to the eligibility check can't change them - it would
// rule the person out again as soon as it loaded - so the not-eligible page offers the overview instead.
const RECORD_RULES = new Set([
  'HAS_ACTIVE_EVENT',
  'IS_CONTACT_SUSPENDED',
  'ON_SUPERVISION_PACKAGE',
  'IS_RECALLED',
  'IS_TIER_MISSING',
  'IS_TIER_PROVISIONAL',
  'IN_FINAL_THIRD',
  'IS_PRACTITIONER_ASSIGNED',
])

// Rules that rule out by Tier, which the not-eligible page follows with how the Tier rules and the
// pilot work - including the Tier A/B accredited-programme exclusions, as the UI's own rules did.
const TIER_RULES = new Set(['IS_TIER_C', 'ON_ACCREDITED_PROGRAMME', 'ON_YOUTH_SENTENCE', 'IN_EARLY_ENGAGEMENT'])

export interface NotEligibleDisplay {
  // The tier statuses and no active sentence keep their own wording on not-eligible.njk
  missingTier: boolean
  provisionalTier: boolean
  notSupervised: boolean
  returnToOverviewPage: boolean
  additionalTierInformation: boolean
}

export const notEligibleDisplay = (ruleCode?: string | null): NotEligibleDisplay => ({
  missingTier: ruleCode === 'IS_TIER_MISSING',
  provisionalTier: ruleCode === 'IS_TIER_PROVISIONAL',
  notSupervised: ruleCode === 'HAS_ACTIVE_EVENT',
  returnToOverviewPage: RECORD_RULES.has(ruleCode ?? ''),
  additionalTierInformation: TIER_RULES.has(ruleCode ?? ''),
})
