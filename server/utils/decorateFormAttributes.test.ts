import httpMocks from 'node-mocks-http'

import decorateFormAttributes from './decorateFormAttributes'
import mockAppResponse from '../controllers/mocks/appResponse'

describe('utils/decorateFormAttributes', () => {
  const crn = 'X000001'
  const id = '19a88188-6013-43a7-bb4d-6e338516818f'
  afterEach(() => {
    jest.clearAllMocks()
  })
  it('should decorate a checkbox group with selected options from the value stored in the session', () => {
    const res = mockAppResponse()
    const req = httpMocks.createRequest({
      session: {
        data: {
          appointments: {
            [crn]: { [id]: { type: ['Home visit', 'Initial appointment - home visit'] } },
          },
        },
      },
    })
    const sections = ['appointments', crn, id, 'type']
    const obj = {
      fieldset: {
        legend: {
          html: '<span data-qa="pageHeading">What appointment are you arranging?</span>',
          isPageHeading: true,
        },
        attributes: { 'data-qa': 'type' },
      },
      items: [
        { text: 'Home visit' },
        {
          text: 'Initial appointment - home visit',
          value: 'Initial appointment - home visit',
        },
        {
          text: 'Initial appointment - in office',
          value: 'Initial appointment - in office',
        },
        { text: 'Planned office visit', value: 'Planned office visit' },
      ],
    }
    const expected = {
      ...obj,
      id: `appointments-${crn}-${id}-type`,
      idPrefix: `appointments-${crn}-${id}-type`,
      name: `[appointments][${crn}][${id}][type]`,
      items: [
        { ...obj.items[0], value: obj.items[0].text, checked: 'checked', selected: 'selected' },
        { ...obj.items[1], value: obj.items[1].text, checked: 'checked', selected: 'selected' },
        ...obj.items.slice(2),
      ],
    }
    expect(decorateFormAttributes(req, res)(obj, sections)).toEqual(expected)
  })
  it('should decorate a radio button list with the selected option from the value stored in the session', () => {
    const res = mockAppResponse()
    const req = httpMocks.createRequest({
      session: {
        data: {
          appointments: {
            [crn]: { [id]: { type: 'Home visit' } },
          },
        },
      },
    })
    const sections = ['appointments', crn, id, 'type']
    const obj = {
      fieldset: {
        legend: {
          html: '<span data-qa="pageHeading">What appointment are you arranging?</span>',
          isPageHeading: true,
        },
        attributes: { 'data-qa': 'type' },
      },
      items: [
        { text: 'Home visit' },
        {
          text: 'Initial appointment - home visit',
          value: 'Initial appointment - home visit',
        },
        {
          text: 'Initial appointment - in office',
          value: 'Initial appointment - in office',
        },
        { text: 'Planned office visit', value: 'Planned office visit' },
      ],
    }
    const expected = {
      ...obj,
      id: `appointments-${crn}-${id}-type`,
      idPrefix: `appointments-${crn}-${id}-type`,
      name: `[appointments][${crn}][${id}][type]`,
      items: [
        { ...obj.items[0], value: obj.items[0].text, checked: 'checked', selected: 'selected' },
        ...obj.items.slice(1),
      ],
    }
    expect(decorateFormAttributes(req, res)(obj, sections)).toEqual(expected)
  })
  describe('a field re-rendered with a validation error', () => {
    const sections = ['appointments', crn, id, 'date']
    const fieldId = `appointments-${crn}-${id}-date`
    const decorate = (body: Record<string, unknown>, errorMessages: Record<string, string> = {}) => {
      const res = mockAppResponse({ errorMessages })
      const req = httpMocks.createRequest({
        body,
        session: { data: { appointments: { [crn]: { [id]: { date: '2025-04-09' } } } } },
      })
      return decorateFormAttributes(req, res)({ label: { text: 'Date' } }, sections)
    }

    it('shows the rejected submission rather than the saved value', () => {
      const result = decorate({ appointments: { [crn]: { [id]: { date: '31/2/2030' } } } }, { [fieldId]: 'Bad date' })
      expect(result.value).toBe('31/2/2030')
      expect(result.errorMessage).toEqual({ text: 'Bad date' })
    })

    it('shows an empty value when the field was submitted empty', () => {
      const result = decorate({ appointments: { [crn]: { [id]: { date: '' } } } }, { [fieldId]: 'Enter a date' })
      expect(result.value).toBe('')
    })

    it('still shows the saved value when the field has no error', () => {
      const result = decorate({ appointments: { [crn]: { [id]: { date: '31/2/2030' } } } })
      expect(result.value).toBe('9/4/2025')
    })
  })

  it('should decorate a date input value from the value stored in the session', () => {
    const res = mockAppResponse({
      errorMessages: {
        [`appointments-${crn}-${id}-date`]: 'An error message',
      },
    })

    const req = httpMocks.createRequest({
      session: {
        data: {
          appointments: {
            [crn]: {
              [id]: {
                user: {
                  username: 'user-1',
                  locationCode: 'COP',
                  teamCode: 'TEA',
                },
                type: 'Home visit',
                eventId: '123456789',
                licenceConditionId: '1234',
                requirementId: '5678',
                date: '2025-04-09',
              },
            },
          },
        },
      },
    })
    const sections = ['appointments', crn, id, 'date']
    const obj = {
      label: { text: 'Date', classes: 'govuk-label--s' },
      hint: { text: 'For example, 17/5/2024.' },
      minDate: '08/04/2025',
      value: '',
      id: `appointments-${crn}-${id}-date`,
      name: `[appointments][${crn}][${id}][date]`,
    }
    const expected = {
      ...obj,
      value: '9/4/2025',
      errorMessage: { text: 'An error message' },
    }
    const result = decorateFormAttributes(req, res)(obj, sections)
    expect(result).toEqual(expected)
  })
})
