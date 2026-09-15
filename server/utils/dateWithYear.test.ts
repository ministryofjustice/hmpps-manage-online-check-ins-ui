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
    ['Single digit day and month', '1/2/2026', '1 February 2026'],
    ['Double digit day and month', '01/2/2026', '1 February 2026'],
    ['Single digit day only', '5/11/2025', '5 November 2025'],
    ['Single digit month only', '29/2/2024', '29 February 2024'],
    ['Invalid format returns original', '29-11-2025', '29-11-2025'],
    ['Non-date text returns original', 'not a date', 'not a date'],
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
