import { toSentenceCase } from './toSentenceCase'

const escapeHtml = (value: string): string => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export const formatEnforcementActionNote = (str: string): string => {
  if (!str) return ''
  const lines = str.split('\n')
  return lines
    .map(line => {
      if (line.includes('Enforcement Action:')) {
        const [label, ...rest] = line.split(':')
        const value = rest.join(':')
        return `<span class="govuk-!-font-weight-bold">${escapeHtml(toSentenceCase(label))}:</span> ${escapeHtml(value.toLowerCase().trim())}`
      }
      return escapeHtml(line)
    })
    .join('\n')
}
