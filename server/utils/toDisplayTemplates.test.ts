import toDisplayTemplates from './toDisplayTemplates'

describe('utils/toDisplayTemplates', () => {
  it('replaces the placeholder with [insert text] and keeps the other fields', () => {
    const result = toDisplayTemplates([{ id: 3, template: 'How has {{thing}} been going recently?' }])
    expect(result).toEqual([
      {
        id: 3,
        template: 'How has {{thing}} been going recently?',
        displayTemplate: 'How has [insert text] been going recently?',
      },
    ])
  })

  it('leaves a template with no placeholder alone', () => {
    expect(toDisplayTemplates([{ template: 'How are you?' }])[0].displayTemplate).toEqual('How are you?')
  })

  it('copes with no templates', () => {
    expect(toDisplayTemplates(undefined as unknown as { template: string }[])).toEqual([])
  })
})
