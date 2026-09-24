import formatTierScore from './formatTierScore'

describe('utils/formatTierScore', () => {
  it('should convert a tier status to sentence case with spaces', () => {
    expect(formatTierScore('NOT_SUPERVISED')).toEqual('Not supervised')
    expect(formatTierScore('MISSING')).toEqual('Missing')
  })

  it('should collapse repeated underscores and surrounding whitespace', () => {
    expect(formatTierScore('  NOT__SUPERVISED  ')).toEqual('Not supervised')
  })

  it('should leave a tier code unchanged', () => {
    expect(formatTierScore('A')).toEqual('A')
    expect(formatTierScore('g')).toEqual('G')
  })

  it('should sentence-case anything that is not a single letter', () => {
    expect(formatTierScore('AB')).toEqual('Ab')
    expect(formatTierScore('NOT_A_TIER')).toEqual('Not a tier')
  })

  it('should upper-case a lower-case tier code', () => {
    expect(formatTierScore('c')).toEqual('C')
  })

  it('should return Missing for blank input', () => {
    expect(formatTierScore('')).toEqual('Missing')
    expect(formatTierScore('   ')).toEqual('Missing')
    expect(formatTierScore(null)).toEqual('Missing')
    expect(formatTierScore(undefined)).toEqual('Missing')
  })
})
