import setDataValue from './setDataValue'

const mockSession = {
  appointments: {
    X000001: {
      '1234': {
        type: 'C084',
        date: '2024-04-10',
      },
      '4567': {
        type: 'CHVS',
        date: '2024-03-11',
      },
    },
  },
}

describe('utils/setDataValue', () => {
  it('should set the value if argument path is a single property', () => {
    const data = mockSession
    const updatedValue = {
      X000002: {
        '1234': {
          ...mockSession.appointments.X000001['1234'],
        },
      },
    }
    setDataValue(data, 'appointments', updatedValue)
    expect(data.appointments).toEqual(updatedValue)
  })

  it('should set the value if argument path is multiple properties', () => {
    const data = mockSession
    const updatedValue = '2025-03-11'
    setDataValue(data, ['appointments', 'X000001', '4567', 'date'], updatedValue)
    expect(data.appointments.X000001['4567'].date).toEqual(updatedValue)
  })

  it.each([
    ['__proto__', 'X000001', 'polluted'],
    ['constructor', 'prototype', 'polluted'],
    ['appointments', '__proto__', 'polluted'],
  ])('should not modify any prototype when the path is %s.%s.%s', (...path) => {
    const data = JSON.parse('{"__proto__": {}}')
    setDataValue(data, path, 'yes')
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
    expect((Object.prototype as Record<string, unknown>).X000001).toBeUndefined()
    expect((Object as unknown as Record<string, unknown>).polluted).toBeUndefined()
    expect(data.appointments).toBeUndefined()
  })
})
