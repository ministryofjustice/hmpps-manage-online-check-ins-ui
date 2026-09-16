// Eligibility rules are grouped into three tier bands, each with its own set of questions.
// The tier score from the offender header endpoint looks like 'B1' - only the letter matters.
export type TierBand = 'AB' | 'C' | 'DG'

const bandsByLetter: Record<string, TierBand> = {
  A: 'AB',
  B: 'AB',
  C: 'C',
  D: 'DG',
  E: 'DG',
  F: 'DG',
  G: 'DG',
}

// Returns null when the tier cannot be determined - the header endpoint tolerates 404s and 500s
// by falling back to an empty score, and defaulting to a band would apply the wrong rules.
const getTierBand = (tierScore?: string): TierBand | null => {
  return bandsByLetter[tierScore?.trim().charAt(0).toUpperCase()] ?? null
}

export default getTierBand
