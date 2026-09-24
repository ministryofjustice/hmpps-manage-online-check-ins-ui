// The eligibility rules that route a practitioner through the setup wizard's opening pages.
// Kept free of Express so the decision table can be tested directly, and shared with the
// validation middleware, which needs the same template map when re-rendering with errors.
import { TierBand } from './getTierBand'

// The eligibility check asks the practitioner about the person's circumstances; these are the
// answers it can come back with. Three of them rule the person out whatever their tier. 'none' is
// the exclusive "None of these apply" box, which asserts that no box below applies - so it carries
// no weight of its own, and a forged submission pairing it with a disqualifier is still ruled out
// by that disqualifier.
export type EligibilitySelection =
  'recalled' | 'finalThird' | 'deviceRestriction' | 'accreditedProgramme' | 'youthSentence' | 'earlyEngagement' | 'none'

// not-eligible.njk renders "This is because <forename> <reason>.", so each disqualifier
// supplies the clause that completes that sentence. Where more than one fact rules the person out
// at once the clause ends in a colon and the facts are listed as `bullets` beneath it.
//
// The supervision package comes from the ESUP API rather than a checkbox; the boxes that remain
// all rule the person out by being ticked.
export const requiresSupervisionPackage = 'is not on a supervision package'

// The three that rule a person out whatever their tier and whichever route they took. They are
// checked ahead of the branch-specific reasons, since they are the more specific fact about the
// person, and every one that applies is reported - hence full clauses, listed under no stem at all
// ("This is because Joe:") when more than one is ticked.
const disqualifyingSelections: { selection: EligibilitySelection; clause: string }[] = [
  { selection: 'recalled', clause: 'has been recalled to prison' },
  { selection: 'finalThird', clause: 'is in the final third of their sentence' },
  {
    selection: 'deviceRestriction',
    clause: 'has restrictions that mean they cannot use a device or the internet',
  },
]

// Tier A/B accredited-programme exclusions. These matter only on that branch - off it a youth
// sentence or early engagement has no bearing on eligibility at all.
const programmeExclusions: { selection: EligibilitySelection; clause: string }[] = [
  { selection: 'youthSentence', clause: 'on a youth sentence' },
  { selection: 'earlyEngagement', clause: 'in early engagement' },
]

// The bands are our own grouping, not Tiers anyone is assigned, so every reason that names a Tier
// names the person's actual score - the same score the is-eligible pages render. The band is only a
// fallback for callers that have no score to hand; see tierLabel below.
const tierBandLabels: Record<TierBand, string> = { AB: 'A/B', C: 'C', DG: 'D-G' }

const tierLabel = (band: TierBand, tierScore?: string): string => tierScore?.trim() || tierBandLabels[band]

const programmeExclusionStem = (tier: string) => `is in Tier ${tier} and on an accredited programme, but they are`

// Tier A/B outside the pilot cohort are told both of the things that ruled them out; Tier C only
// has the one, so it reads as a single sentence.
const pilotReasons = (band: 'AB' | 'C', tier: string): EligibilityReason =>
  band === 'AB'
    ? {
        reason: `is in Tier ${tier} and`,
        bullets: [
          'not on an accredited programme',
          'you have no people who were signed up to use online check ins before 1 October 2026',
        ],
      }
    : {
        reason: `is in Tier ${tier} and you do not have one or more people on your caseload who started using online check ins before 1 October 2026`,
      }

export type EligibilityTarget = 'not-eligible' | 'pilot-check' | 'is-eligible'

// Every rule below keys off the tier band, so a person with no tier cannot be assessed at all - the
// missing tier is itself the reason they are ruled out. See MISSING_TIER in getTierBand for why that
// is treated as a fact about the record rather than an error.
//
// Unlike the reasons below, not-eligible.njk does not complete "This is because <forename> …" with
// this one - a missing tier is about the record rather than the person, so the page words it as
// "they" and follows it with how a Tier comes to be assigned. This is what gets recorded in session,
// keeping the shape the same as every other reason.
export const missingTierReason = 'has not been assigned a Tier yet'

// A provisional tier is the same kind of fact as a missing one: the score the header reports is not
// the person's final Tier, so the rules have nothing they can be applied to yet. It is worded
// impersonally by not-eligible.njk for the same reason, and clears once the risk scores are done -
// hence the same invitation to come back and check again.
export const provisionalTierReason = 'is in a provisional Tier'

// 'NOT_SUPERVISED' says the person is no longer on probation, so there is nothing to set check ins
// up for - a disqualification on its own, like a missing tier. Unlike the other two tier statuses
// this one cannot clear, so the page offers reasons it might apply rather than inviting the
// practitioner to check again.
export const notSupervisedReason = 'is not currently being supervised'

// The clause that completes "This is because <forename> …", with the facts to list beneath it when
// several apply at once.
interface EligibilityReason {
  reason: string
  bullets?: string[]
}

export interface EligibilityOutcome extends Partial<EligibilityReason> {
  target: EligibilityTarget
  // Only the Tier A/B accredited-programme cohort goes through approval and rationale.
  accreditedProgramme?: boolean
}

// A single fact reads inline, so it is joined onto the stem; several are listed beneath it, leaving
// the stem to introduce them. not-eligible.njk punctuates either shape. The shared disqualifiers
// are whole clauses in themselves and pass no stem, giving "This is because Joe:" over the list.
const asReason = (stem: string, clauses: string[]): EligibilityReason =>
  clauses.length > 1 ? { reason: stem, bullets: clauses } : { reason: `${stem} ${clauses[0]}`.trim() }

// Every disqualifier that applies, so a person who is both recalled and in the final third is told
// both rather than only the first.
const disqualifiersIn = (selections: string[]): EligibilityReason | undefined => {
  const clauses = disqualifyingSelections
    .filter(({ selection }) => selections.includes(selection))
    .map(({ clause }) => clause)
  return clauses.length ? asReason('', clauses) : undefined
}

// The rules the eligibility-check post applies, kept free of Express so they can be tested
// against the decision table directly.
export function nextAfterEligibilityCheck(
  band: TierBand,
  onSupervisionPackage: boolean,
  selections: string[],
  tierScore?: string,
): EligibilityOutcome {
  // Nobody is eligible without a supervision package, whatever their tier. This is the only thing
  // that can rule a person out before their answers are looked at, since the ESUP API decides it
  // rather than the practitioner.
  //
  // "None of these apply" needs no handling of its own: every remaining box rules the person out by
  // being ticked, so ticking none of them leaves nothing to find below. It used to rule the person
  // out because the supervision package was one of the boxes it denied.
  if (!onSupervisionPackage) {
    return { target: 'not-eligible', reason: requiresSupervisionPackage }
  }
  // These rule the person out on every branch, so there is no point asking anything further -
  // including the pilot question, whose answer cannot change the outcome.
  const disqualifier = disqualifiersIn(selections)
  if (disqualifier) {
    return { target: 'not-eligible', ...disqualifier }
  }
  // Tiers A/B split on the accredited programme, where a youth sentence or early engagement rules
  // the person out. Off that branch neither matters, so they are not looked at.
  if (band === 'AB' && selections.includes('accreditedProgramme')) {
    const exclusions = programmeExclusions.filter(({ selection }) => selections.includes(selection))
    if (exclusions.length) {
      return {
        target: 'not-eligible',
        ...asReason(
          programmeExclusionStem(tierLabel(band, tierScore)),
          exclusions.map(({ clause }) => clause),
        ),
      }
    }
    return { target: 'is-eligible', accreditedProgramme: true }
  }
  // Tiers D-G are eligible on the supervision package alone, with no pilot question to answer;
  // A/B without a programme and all of Tier C qualify only through the pilot cohort.
  return band === 'DG' ? { target: 'is-eligible', accreditedProgramme: false } : { target: 'pilot-check' }
}

// pilot-check is the last gate for Tiers A/B and C - only the pilot cohort can be signed up. Anyone
// reaching it has already cleared the disqualifiers, so the cohort is all that is left to decide.
export function nextAfterPilotCheck(band: 'AB' | 'C', pilotCheck: string, tierScore?: string): EligibilityOutcome {
  return pilotCheck === 'true'
    ? { target: 'is-eligible', accreditedProgramme: false }
    : { target: 'not-eligible', ...pilotReasons(band, tierLabel(band, tierScore)) }
}

// One route per page with the band picking the template, so the URLs stay tier-agnostic.
// Paths are relative to pages/check-in/ and carry no extension, matching how the validation
// middleware builds its render target.
//
// Where two bands are asked the same thing they share a template rather than holding a copy each:
// eligibility-check varies only by the Tier A/B checkboxes, which it renders off `tierBand`, and
// A/B and C get the same pilot pages. Only the pages whose wording is band-specific sit in a
// per-band subfolder.
export const eligibilityViews: Record<TierBand, Record<string, string>> = {
  AB: {
    'eligibility-check': 'eligibility/eligibility-check',
    'pilot-check': 'eligibility/pilot-check',
    'is-eligible': 'eligibility/pilot-is-eligible',
    'accredited-programme-is-eligible': 'eligibility/tiers-a-b/accredited-programme-is-eligible',
  },
  C: {
    'eligibility-check': 'eligibility/eligibility-check',
    'pilot-check': 'eligibility/pilot-check',
    'is-eligible': 'eligibility/pilot-is-eligible',
  },
  DG: {
    'eligibility-check': 'eligibility/eligibility-check',
    'is-eligible': 'eligibility/tiers-d-g/is-eligible',
  },
}

// The discussion checkboxes are all-or-nothing: a part-filled set means the conversation with
// the person hasn't happened yet, which is guidance rather than a validation error. "I have not
// done all of these" says the same thing outright - leaving the group untouched is neither, and
// is caught by validation instead.
const discussionPoints = ['optional', 'canStop', 'notEnforceable', 'moreTime']

// The accredited-programme cohort is only eligible for as long as the programme lasts, so that limit
// is a fifth point to discuss - shown to them alone, so required of them alone.
const programmeOnlyPoints = [...discussionPoints, 'programmeOnly']

export function hasCompletedDiscussion(discussion: unknown, { accreditedProgramme = false } = {}): boolean {
  const selections = Array.isArray(discussion) ? discussion : [discussion]
  // Exclusive in the browser only, so a submission carrying both cannot be trusted.
  if (selections.includes('notAll')) {
    return false
  }
  const required = accreditedProgramme ? programmeOnlyPoints : discussionPoints
  return required.every(point => selections.includes(point))
}

// Checkbox groups arrive as a string when one box is ticked and an array when several are.
export const toSelections = (value: unknown): string[] => {
  if (value === undefined || value === null) {
    return []
  }
  return (Array.isArray(value) ? value : [value]).map(String)
}
