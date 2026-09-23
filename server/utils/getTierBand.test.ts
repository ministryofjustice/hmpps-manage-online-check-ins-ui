import getTierBand from './getTierBand'

describe('utils/getTierBand', () => {
  it('should map tiers A and B to the AB band', () => {
    expect(getTierBand('A1')).toEqual('AB')
    expect(getTierBand('B2')).toEqual('AB')
  })
  it('should map tier C to its own band', () => {
    expect(getTierBand('C3')).toEqual('C')
  })
  it('should map tiers D to G to the DG band', () => {
    expect(getTierBand('D1')).toEqual('DG')
    expect(getTierBand('E2')).toEqual('DG')
    expect(getTierBand('F3')).toEqual('DG')
    expect(getTierBand('G0')).toEqual('DG')
  })
  it('should ignore case and surrounding whitespace', () => {
    expect(getTierBand('b1')).toEqual('AB')
    expect(getTierBand(' c2 ')).toEqual('C')
  })
  // The API says 'MISSING' outright when a person has no tier assigned, which rules them out with a
  // reason the practitioner can act on rather than being an error.
  it('should pass a missing tier through as its own status', () => {
    expect(getTierBand('MISSING')).toEqual('MISSING')
    expect(getTierBand(' missing ')).toEqual('MISSING')
  })
  // getPersonalDetails coerces an absent score to '', so a person with no tier arrives either way.
  it('should treat an absent score as a missing tier too', () => {
    expect(getTierBand('')).toEqual('MISSING')
    expect(getTierBand('   ')).toEqual('MISSING')
    expect(getTierBand(undefined)).toEqual('MISSING')
  })
  // 'NOT_SUPERVISED' says the person is no longer on probation, which rules them out outright rather
  // than being a tier the rules could be applied to.
  it('should pass a person who is not supervised through as its own status', () => {
    expect(getTierBand('NOT_SUPERVISED')).toEqual('NOT_SUPERVISED')
    expect(getTierBand(' not_supervised ')).toEqual('NOT_SUPERVISED')
  })
  it('should return null when a tier is present but cannot be read', () => {
    expect(getTierBand('Z1')).toBeNull()
    // The statuses are read whole, so a tier that merely starts with one of their letters is not
    // mistaken for them - and neither M nor N is a band.
    expect(getTierBand('M1')).toBeNull()
    expect(getTierBand('N1')).toBeNull()
  })
})
