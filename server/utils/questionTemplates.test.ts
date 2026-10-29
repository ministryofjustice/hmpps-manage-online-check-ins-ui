import {
  customisableTemplates,
  isCustomisableTemplate,
  resolveTemplateText,
  savedQuestionsToDrafts,
} from './questionTemplates'

jest.mock('uuid', () => ({ v4: jest.fn(() => 'uuid') }))

describe('isCustomisableTemplate / customisableTemplates', () => {
  it('keeps only templates whose policy is CUSTOMISABLE', () => {
    const templates = [{ id: 1, policy: 'CUSTOMISABLE' }, { id: 2, policy: 'STANDARD' }, { id: 3 }]
    expect(isCustomisableTemplate(templates[0])).toBe(true)
    expect(isCustomisableTemplate(templates[1])).toBe(false)
    expect(customisableTemplates(templates)).toEqual([{ id: 1, policy: 'CUSTOMISABLE' }])
    expect(customisableTemplates(undefined as never)).toEqual([])
  })
})

describe('resolveTemplateText', () => {
  it('fills each placeholder from the saved params', () => {
    expect(resolveTemplateText('How has {{thing}} been going at {{ place }}?', { thing: 'work', place: 'home' })).toBe(
      'How has work been going at home?',
    )
  })

  it('blanks a placeholder that has no saved value', () => {
    expect(resolveTemplateText('How has {{thing}} been?', {})).toBe('How has  been?')
  })
})

describe('savedQuestionsToDrafts', () => {
  const offered = [{ id: 1 }, { id: '2' }]

  it('keeps a question built from an offered template as its template id and placeholder text', () => {
    const drafts = savedQuestionsToDrafts(
      [
        {
          template: { id: 1, template: 'How has {{thing}} been going?', policy: 'CUSTOMISABLE' },
          params: { placeholders: { thing: 'work' } },
        },
      ],
      offered,
    )
    expect(drafts).toEqual({ '1-uuid': 'work' })
  })

  it('matches offered templates whatever the type of their id', () => {
    const drafts = savedQuestionsToDrafts(
      [
        {
          template: { id: 2, template: 'Have you been to {{thing}}?' },
          params: { placeholders: { thing: 'the gym' } },
        },
      ],
      offered,
    )
    expect(drafts).toEqual({ '2-uuid': 'the gym' })
  })

  it('carries a bespoke question as its whole text', () => {
    const drafts = savedQuestionsToDrafts(
      [
        {
          template: {
            id: 99,
            template: 'Have you spoken to your landlord?',
            policy: 'CUSTOMISABLE',
            responseSpec: { placeholders: [] },
          },
          params: { placeholders: {} },
        },
      ],
      offered,
    )
    expect(drafts).toEqual({ 'bespoke-uuid': 'Have you spoken to your landlord?' })
  })

  it('carries a question whose template has been retired as a bespoke question of its resolved text', () => {
    const drafts = savedQuestionsToDrafts(
      [
        {
          template: {
            id: 7,
            template: 'Have you heard back from {{thing}}',
            policy: 'CUSTOMISABLE',
            responseSpec: { placeholders: ['thing'] },
          },
          params: { placeholders: { thing: 'the housing team' } },
        },
      ],
      offered,
    )
    expect(drafts).toEqual({ 'bespoke-uuid': 'Have you heard back from the housing team?' })
  })

  it('leaves out the FIXED default questions that every check in asks', () => {
    const drafts = savedQuestionsToDrafts(
      [
        {
          template: {
            id: 1001,
            template: 'How have you been feeling since we last spoke?',
            policy: 'FIXED',
            responseSpec: { placeholders: [] },
          },
          params: { placeholders: {} },
        },
        {
          template: { id: 1, template: 'How has {{thing}} been going?', policy: 'CUSTOMISABLE' },
          params: { placeholders: { thing: 'work' } },
        },
      ],
      offered,
    )
    expect(drafts).toEqual({ '1-uuid': 'work' })
  })

  it('returns no drafts when nothing is saved', () => {
    expect(savedQuestionsToDrafts([], offered)).toEqual({})
    expect(savedQuestionsToDrafts(undefined as never, offered)).toEqual({})
  })
})
