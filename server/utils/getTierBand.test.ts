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
  it('should return null when the tier cannot be determined', () => {
    expect(getTierBand('')).toBeNull()
    expect(getTierBand(undefined)).toBeNull()
    expect(getTierBand('Z1')).toBeNull()
  })
})
