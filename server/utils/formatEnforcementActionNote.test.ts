import { formatEnforcementActionNote } from './formatEnforcementActionNote'

const enforcementAction = 'Enforcement Action: First Warning Letter Sent'

const mockNote = (note = '') => `fdsfdsfs\n15/06/2026 15:27'\n${note}`

describe('utils/formatEnforcementActionNote', () => {
  it('should return the string if no value', () => {
    expect(formatEnforcementActionNote('')).toEqual('')
  })
  it('should not format the note if not an enforcement action', () => {
    const note = mockNote('Latest Update: Some Notes')
    expect(formatEnforcementActionNote(note)).toEqual(note)
  })
  it('should format the note if is an enforcement action', () => {
    const note = mockNote(enforcementAction)
    const expectedNote = `${mockNote()}<span class="govuk-!-font-weight-bold">Enforcement action:</span> first warning letter sent`
    expect(formatEnforcementActionNote(note)).toEqual(expectedNote)
  })
  it('should preserve colons in the enforcement action value', () => {
    const note = mockNote('Enforcement Action: Contact attempted at 15:30')
    const expectedNote = `${mockNote()}<span class="govuk-!-font-weight-bold">Enforcement action:</span> contact attempted at 15:30`
    expect(formatEnforcementActionNote(note)).toEqual(expectedNote)
  })
  it('should escape HTML in note content to prevent XSS', () => {
    expect(formatEnforcementActionNote('<script>alert(1)</script>')).toEqual('&lt;script&gt;alert(1)&lt;/script&gt;')
  })
  it('should escape HTML in an enforcement action value', () => {
    const note = 'Enforcement Action: <img src=x onerror=alert(1)>'
    const expectedNote =
      '<span class="govuk-!-font-weight-bold">Enforcement action:</span> &lt;img src=x onerror=alert(1)&gt;'
    expect(formatEnforcementActionNote(note)).toEqual(expectedNote)
  })
})
