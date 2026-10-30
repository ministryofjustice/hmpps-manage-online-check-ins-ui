import {
  bespokeQuestionCharsOrLess,
  bespokeQuestionCharsOrMore,
  ensureQuestionMark,
  isBespokeDraftId,
  isBespokeTemplate,
  newBespokeDraftId,
} from './bespokeQuestions'

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20'),
}))

describe('utils/bespokeQuestions', () => {
  describe('ensureQuestionMark', () => {
    it.each([
      ['adds a question mark', 'Have you spoken to your landlord', 'Have you spoken to your landlord?'],
      ['keeps an existing question mark', 'Is work going ok?', 'Is work going ok?'],
      ['trims and collapses whitespace first', '  Have you   been to the   gym  ', 'Have you been to the gym?'],
      ['does not add one to a trailing question mark with spaces', 'How are you ?  ', 'How are you ?'],
      ['returns empty for blank input', '   ', ''],
      ['returns empty for undefined', undefined as unknown as string, ''],
    ])('%s', (_: string, input: string, expected: string) => {
      expect(ensureQuestionMark(input)).toEqual(expected)
    })
  })

  it('identifies bespoke draft ids', () => {
    expect(isBespokeDraftId(newBespokeDraftId())).toBe(true)
    expect(newBespokeDraftId()).toEqual('bespoke-f1654ea3-0abb-46eb-860b-654a96edbe20')
    expect(isBespokeDraftId('3-f1654ea3-0abb-46eb-860b-654a96edbe20')).toBe(false)
  })

  describe('isBespokeTemplate', () => {
    it('is true for a customisable question with no placeholders', () => {
      expect(isBespokeTemplate({ policy: 'CUSTOMISABLE', responseSpec: { placeholders: [] } })).toBe(true)
      expect(isBespokeTemplate({ policy: 'CUSTOMISABLE', responseSpec: {} })).toBe(true)
    })

    it('is false for a template with placeholders or a fixed question', () => {
      expect(isBespokeTemplate({ policy: 'CUSTOMISABLE', responseSpec: { placeholders: ['thing'] } })).toBe(false)
      expect(isBespokeTemplate({ policy: 'FIXED', responseSpec: { placeholders: [] } })).toBe(false)
    })
  })

  describe('bespokeQuestionCharsOrLess', () => {
    it.each([
      ['short question', [10, 'Hi?'], true],
      ['at the limit ending in a question mark', [10, 'abcdefghi?'], true],
      ['at the limit but needing a question mark added', [10, 'abcdefghij'], false],
      ['one under the limit needing a question mark added', [10, 'abcdefghi'], true],
      ['surrounding whitespace is not counted', [10, '   abcdefghi?   '], true],
      ['over the limit', [10, 'abcdefghijk?'], false],
      ['empty', [10, ''], true],
    ])('%s', (_: string, a: any[], expected: boolean) => {
      expect(bespokeQuestionCharsOrLess(a)).toEqual(expected)
    })
  })

  describe('bespokeQuestionCharsOrMore', () => {
    it.each([
      ['long enough', [5, 'Hello'], true],
      ['too short', [5, 'Why?'], false],
      ['counts the question mark it will add', [5, 'Well'], true],
      ['judges a typed question mark the same as an added one', [5, 'Well?'], true],
      ['surrounding whitespace is not counted', [5, '   abc   '], false],
      ['runs of whitespace count once', [5, 'a    b'], false],
      ['empty', [5, ''], false],
      ['undefined', [5, undefined], false],
    ])('%s', (_: string, a: any[], expected: boolean) => {
      expect(bespokeQuestionCharsOrMore(a)).toEqual(expected)
    })
  })
})
