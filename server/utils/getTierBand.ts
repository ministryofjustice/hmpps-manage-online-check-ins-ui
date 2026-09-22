// Eligibility rules are grouped into three tier bands, each with its own set of questions.
// The tier score from the offender header endpoint looks like 'B1' - only the letter matters.
export type TierBand = 'AB' | 'C' | 'DG'

// The header endpoint reports a person with no tier assigned as the score 'MISSING' rather than by
// omitting it. That is a fact about the person rather than a fault of ours, and every eligibility
// rule keys off the tier, so there is nothing left to ask - it is passed through as its own status
// so the practitioner can be told the Tier status is missing instead of being shown an error page.
export const MISSING_TIER = 'MISSING'
export type TierStatus = TierBand | typeof MISSING_TIER

const bandsByLetter: Record<string, TierBand> = {
  A: 'AB',
  B: 'AB',
  C: 'C',
  D: 'DG',
  E: 'DG',
  F: 'DG',
  G: 'DG',
}

// 'MISSING' is matched whole, unlike the bands, which are read from the leading letter alone -
// otherwise its M would just look like an unrecognised tier. An absent score counts as missing too:
// getPersonalDetails coerces one to '', so a person with no tier reaches us by either route and
// means the same thing to the practitioner. Only a score that is present but unreadable is null -
// unexpected data we will not guess at, since defaulting to a band would apply the wrong rules.
const getTierBand = (tierScore?: string): TierStatus | null => {
  const score = tierScore?.trim().toUpperCase()
  if (!score || score === MISSING_TIER) {
    return MISSING_TIER
  }
  return bandsByLetter[score.charAt(0)] ?? null
}

export default getTierBand
