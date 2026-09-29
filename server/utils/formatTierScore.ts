import isBlank from './isBlank'

// A tier score is a single character from A-G, which is shown as-is. Anything else is a tier
// status such as 'MISSING' or 'NOT_SUPERVISED', which reads better in sentence case with the
// underscores replaced, e.g. 'Not supervised'. A blank score means no tier has been assigned yet.
const tierCodeRegex = /^[A-G]$/i

const formatTierScore = (tierScore?: string | null): string => {
  if (typeof tierScore !== 'string' || isBlank(tierScore)) return 'Missing'
  const score = tierScore.trim()
  if (tierCodeRegex.test(score)) return score.toUpperCase()
  const words = score.replace(/_+/g, ' ').replace(/\s+/g, ' ').toLowerCase()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export default formatTierScore
