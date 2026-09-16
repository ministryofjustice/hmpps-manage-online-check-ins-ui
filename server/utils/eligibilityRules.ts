// The eligibility rules that route a practitioner through the setup wizard's opening pages.
// Kept free of Express so the decision table can be tested directly, and shared with the
// validation middleware, which needs the same template map when re-rendering with errors.
import { TierBand } from './getTierBand'

// The eligibility check asks the practitioner about the person's circumstances; these are the
// answers it can come back with. Four of them rule the person out whatever their tier.
export type EligibilitySelection =
  | 'supervisionPackage'
  | 'recalled'
  | 'finalThird'
  | 'deviceRestriction'
  | 'accreditedProgramme'
  | 'youthSentence'
  | 'earlyEngagement'

// not-eligible.njk renders "This is because <forename> <reason>.", so each disqualifier
// supplies the clause that completes that sentence.
//
// A supervision package is the one box that has to be ticked; the rest rule the person out by
// being ticked. Checked in this order, so the reason shown is the first that applies.
// Exported so not-eligible can recognise this reason: it is the one disqualifier where offering to
// re-run the eligibility check is no help, since a supervision package is a hard requirement.
export const requiresSupervisionPackage = 'is not on a supervision package'

const disqualifyingSelections: { selection: EligibilitySelection; reason: string }[] = [
  { selection: 'recalled', reason: 'has been recalled to prison' },
  { selection: 'finalThird', reason: 'is in the final third of their sentence' },
  {
    selection: 'deviceRestriction',
    reason: 'has restrictions that mean they cannot use a device or the internet',
  },
]

const pilotReasons: Record<'AB' | 'C', string> = {
  AB: 'is in Tier A/B and you do not have one or more people on your caseload who started using online check ins before 1 October 2026',
  C: 'is in Tier C and you do not have one or more people on your caseload who started using online check ins before 1 October 2026',
}

export type EligibilityTarget = 'not-eligible' | 'pilot-check' | 'is-eligible'

export interface EligibilityOutcome {
  target: EligibilityTarget
  reason?: string
  // Only the Tier A/B accredited-programme cohort goes through approval and rationale.
  accreditedProgramme?: boolean
}

// The rules the eligibility-check post applies, kept free of Express so they can be tested
// against the decision table directly.
export function nextAfterEligibilityCheck(band: TierBand, selections: string[]): EligibilityOutcome {
  // Nobody is eligible without a supervision package, whatever their tier.
  if (!selections.includes('supervisionPackage')) {
    return { target: 'not-eligible', reason: requiresSupervisionPackage }
  }
  const disqualifier = disqualifyingSelections.find(({ selection }) => selections.includes(selection))
  if (disqualifier) {
    return { target: 'not-eligible', reason: disqualifier.reason }
  }
  // Tier A/B only qualify on an accredited programme, or through the pilot cohort; early
  // engagement and youth sentences take the accredited-programme route away.
  if (band === 'AB') {
    const onProgramme =
      selections.includes('accreditedProgramme') &&
      !selections.includes('earlyEngagement') &&
      !selections.includes('youthSentence')
    if (onProgramme) {
      return { target: 'is-eligible', accreditedProgramme: true }
    }
  }
  // Tiers D-G are eligible outright; A/B and C still need the pilot cohort question.
  return band === 'DG' ? { target: 'is-eligible', accreditedProgramme: false } : { target: 'pilot-check' }
}

// pilot-check is the last gate for Tiers A/B and C - only the pilot cohort can be signed up.
export function nextAfterPilotCheck(band: 'AB' | 'C', pilotCheck: string): EligibilityOutcome {
  return pilotCheck === 'true'
    ? { target: 'is-eligible', accreditedProgramme: false }
    : { target: 'not-eligible', reason: pilotReasons[band] }
}

// One route per page with the band picking the template, so the URLs stay tier-agnostic.
// Paths are relative to pages/check-in/ and carry no extension, matching how the validation
// middleware builds its render target.
export const eligibilityViews: Record<TierBand, Record<string, string>> = {
  AB: {
    'eligibility-check': 'eligibility/tiers-a-b/eligibility-check',
    'pilot-check': 'eligibility/tiers-a-b/pilot-check',
    'is-eligible': 'eligibility/tiers-a-b/pilot-is-eligible',
    'accredited-programme-is-eligible': 'eligibility/tiers-a-b/accredited-programme-is-eligible',
  },
  C: {
    'eligibility-check': 'eligibility/tier-c/eligibility-check',
    'pilot-check': 'eligibility/tier-c/pilot-check',
    'is-eligible': 'eligibility/tier-c/pilot-is-eligible',
  },
  DG: {
    'eligibility-check': 'eligibility/tiers-d-g/eligibility-check',
    'is-eligible': 'eligibility/tiers-d-g/is-eligible',
  },
}

// The discussion checkboxes are all-or-nothing: a part-filled set means the conversation with
// the person hasn't happened yet, which is guidance rather than a validation error.
const discussionPoints = ['optional', 'canStop', 'notEnforceable', 'moreTime']

export function hasCompletedDiscussion(discussion: unknown): boolean {
  const selections = Array.isArray(discussion) ? discussion : [discussion]
  return discussionPoints.every(point => selections.includes(point))
}

// Checkbox groups arrive as a string when one box is ticked and an array when several are.
export const toSelections = (value: unknown): string[] => {
  if (value === undefined || value === null) {
    return []
  }
  return (Array.isArray(value) ? value : [value]).map(String)
}
