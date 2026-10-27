import { isEmail, isNotBlank, isNotEmpty } from './validationUtils'

describe('isNotBlank', () => {
  it.each([
    ['empty string', [''], false],
    ['whitespace only', ['   \n\t'], false],
    ['null', [null], false],
    ['undefined', [undefined], false],
    ['populated', ['asdsad'], true],
    ['padded text', ['  asdsad  '], true],
  ])('%s', (_: string, a: any[], expected: boolean) => {
    expect(isNotBlank(a)).toEqual(expected)
  })
})

describe('is not empty', () => {
  it.each([
    ['empty string', [''], false],
    ['null', [null], false],
    ['undefined', [undefined], false],
    ['populated', ['asdsad'], true],
  ])('%s isEmail(%s, %s)', (_: string, a: [], expected: boolean) => {
    expect(isNotEmpty(a)).toEqual(expected)
  })
})

describe('isEmail', () => {
  it.each([
    'name@example.com',
    'first.last@example.co.uk',
    'user+tag@example.com',
    'a1@b2.com',
    'a@b.co',
    ' name@example.com',
    'name@example.com ',
    ' name@example.com ',
  ])('%s is a valid email', (email: string) => {
    expect(isEmail(email)).toEqual(true)
  })

  it.each([
    'plainaddress',
    'a@b',
    'a@',
    '@b.com',
    'a@.com',
    'a@b..com',
    'a@b.com.',
    'a@-b.com',
    'a@b.com-',
    'a b@c.com',
    'a@b .com',
  ])('%s is not a valid email', (email: string) => {
    expect(isEmail(email)).toEqual(false)
  })
})
