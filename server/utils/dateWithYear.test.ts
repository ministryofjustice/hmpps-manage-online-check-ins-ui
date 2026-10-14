import { dateToLongDate, dateWithYear, dateWithYearTimeFirst } from './dateWithYear'

describe('utils/dateWithYear', () => {
  it.each([
    [null, null, ''],
    ['Empty string', '', ''],
    ['Date string ', '2023-05-25T09:08:34.123', '25 May 2023'],
  ])('%s dateWithYear(%s, %s)', (_: string, a: string, expected: string) => {
    expect(dateWithYear(a)).toEqual(expected)
  })
})

describe('utils/dateToLongDate', () => {
  it.each([
    [null, null, ''],
    ['Empty string', '', ''],
    ['Valid DMY', '29/11/2025', '29 November 2025'],
    ['Valid DMY without zero padding', '1/11/2026', '1 November 2026'],
    ['Valid DMY with single-digit month', '14/3/2026', '14 March 2026'],
    ['Invalid format returns original', '29-11-2025', '29-11-2025'],
  ])('%s dateToLongDate(%s) => %s', (_: string, input: string, expected: string) => {
    expect(dateToLongDate(input as unknown as string)).toEqual(expected)
  })
})

describe('utils/dateWithYearTimeFirst', () => {
  it.each([
    [null, null, ''],
    ['Empty string', '', ''],
    ['Date string ', '2023-05-25T09:08:34.123', '9:08am 25 May 2023'],
  ])('%s dateWithYearTimeFirst(%s)', (_: string, input: string, expected: string) => {
    expect(dateWithYearTimeFirst(input)).toEqual(expected)
  })
})
