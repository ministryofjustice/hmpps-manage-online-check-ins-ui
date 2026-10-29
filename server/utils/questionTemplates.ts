import { v4 as uuidv4 } from 'uuid'
import { ensureQuestionMark, isBespokeTemplate, newBespokeDraftId } from './bespokeQuestions'

interface TemplateWithPolicy {
  policy?: string
}

// Only the API's CUSTOMISABLE templates are offered to practitioners as a starting point.
export const isCustomisableTemplate = (template: TemplateWithPolicy): boolean => template?.policy === 'CUSTOMISABLE'

export const customisableTemplates = <T extends TemplateWithPolicy>(templates: T[]): T[] =>
  (templates ?? []).filter(isCustomisableTemplate)

// Fills a template's `{{placeholder}}` slots with the answers saved against a question.
export const resolveTemplateText = (template: string, placeholders: Record<string, string> = {}): string =>
  (template ?? '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key: string) => placeholders[key] ?? '')

export interface SavedQuestionItem {
  template: {
    id: number | string
    template: string
    policy?: string
    responseSpec?: { placeholders?: unknown }
  }
  params?: { placeholders?: Record<string, string> }
}

// Turns the questions already assigned to a check in into the session drafts the add page edits.
//
// A question built from a template still on offer keeps its template id and the placeholder text,
// so it is edited through its template. A bespoke question is carried as its whole text. A question
// whose template has since been retired is no longer offered by the API and cannot be re-assigned by
// id, so it is carried as a bespoke question of its resolved text: the practitioner keeps the
// question as the person last saw it, can edit or remove it, and saving re-sends it as their own.
export const savedQuestionsToDrafts = (
  items: SavedQuestionItem[],
  availableTemplates: { id: number | string }[],
): Record<string, string> => {
  const drafts: Record<string, string> = {}
  ;(items ?? []).forEach(item => {
    const placeholders = item.params?.placeholders ?? {}
    const isOffered = (availableTemplates ?? []).some(t => String(t.id) === String(item.template.id))
    if (isOffered) {
      drafts[`${item.template.id}-${uuidv4()}`] = Object.values(placeholders)[0] || ''
    } else if (isBespokeTemplate(item.template)) {
      drafts[newBespokeDraftId()] = item.template.template
    } else if (isCustomisableTemplate(item.template)) {
      drafts[newBespokeDraftId()] = ensureQuestionMark(resolveTemplateText(item.template.template, placeholders))
    }
  })
  return drafts
}
