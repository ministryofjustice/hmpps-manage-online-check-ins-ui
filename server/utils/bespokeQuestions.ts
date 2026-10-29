import { v4 as uuidv4 } from 'uuid'

// A question the practitioner wrote themselves. Template questions are kept in session under a
// `<templateId>-<uuid>` key holding the placeholder text; a bespoke question has no template, so
// its key carries this prefix instead and its value is the whole question.
export const BESPOKE_DRAFT_PREFIX = 'bespoke-'

export const isBespokeDraftId = (draftId: string): boolean => draftId.startsWith(BESPOKE_DRAFT_PREFIX)

export const newBespokeDraftId = (): string => `${BESPOKE_DRAFT_PREFIX}${uuidv4()}`

// Tidies what was typed and makes sure it reads as a question.
export const ensureQuestionMark = (text: string): string => {
  const trimmed = (text ?? '').replace(/\s+/g, ' ').trim()
  if (!trimmed) return ''
  return trimmed.endsWith('?') ? trimmed : `${trimmed}?`
}

// Validator for the length limit: a bespoke question is stored as ensureQuestionMark() leaves it,
// which may add a trailing '?', so the limit applies to that text rather than what was typed.
export const bespokeQuestionCharsOrLess = (args: any[]): boolean => ensureQuestionMark(args[1]).length <= args[0]

// A template the API returns that is not one of the offered SYSTEM templates and has nothing to
// fill in is a bespoke question saved earlier, authored by a practitioner.
export const isBespokeTemplate = (template: {
  policy?: string
  responseSpec?: { placeholders?: unknown }
}): boolean => {
  const placeholders = template?.responseSpec?.placeholders
  return template?.policy === 'CUSTOMISABLE' && (!Array.isArray(placeholders) || placeholders.length === 0)
}
