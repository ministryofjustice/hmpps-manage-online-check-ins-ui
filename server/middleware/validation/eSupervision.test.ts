import httpMocks, { RequestOptions } from 'node-mocks-http'
import validation from '.'
import mockAppResponse from '../../controllers/mocks/appResponse'

const crn = 'X000001'
const id = '1'

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20'),
}))

const manageBase = `/case/${crn}/appointments/check-in/manage/${id}`
const manageStopCheckinsUrl = `${manageBase}/stop-checkin`
const reqBase = {
  method: 'POST',
  params: { crn, id },
  query: {},
  session: {},
  body: {},
} as RequestOptions

const makeReq = (overrides: Record<string, unknown> = {}) =>
  httpMocks.createRequest(
    JSON.parse(
      JSON.stringify({
        ...reqBase,
        ...overrides,
      }),
    ),
  )

const makeRes = () =>
  mockAppResponse({
    filters: {
      dateFrom: '',
      dateTo: '',
      keywords: '',
    },
  })

describe('Test eSuperVision validation', () => {
  let next: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    next = jest.fn()
  })

  it('passes when url does not match any page', () => {
    const req = makeReq()
    const res = makeRes()
    validation.eSuperVision(req, res, next)
    expect(next).toHaveBeenCalled()
  })

  describe('Test stop-checkin', () => {
    it('passes when both reason and sensitive fields are provided', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              stopCheckinReason: 'Reason for stopping',
              stopCheckinSensitive: 'false',
            },
          },
        },
      }
      const req = makeReq({ url: manageStopCheckinsUrl, body: { esupervision }, session: { data: { esupervision } } })
      const res = makeRes()
      validation.eSuperVision(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    it('fails when both fields are missing', () => {
      const req = makeReq({ url: manageStopCheckinsUrl, body: { esupervision: {} }, session: { data: {} } })
      const res = makeRes()
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
    })

    it('fails when reason is missing but sensitive is selected', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              stopCheckinReason: '',
              stopCheckinSensitive: 'true',
            },
          },
        },
      }
      const req = makeReq({ url: manageStopCheckinsUrl, body: { esupervision }, session: { data: { esupervision } } })
      const res = makeRes()
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
    })

    it('fails when reason is provided but sensitive flag is not inputted', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              stopCheckinReason: 'Reason for stopping',
            },
          },
        },
      }
      const req = makeReq({ url: manageStopCheckinsUrl, body: { esupervision }, session: { data: { esupervision } } })
      const res = makeRes()
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
    })
  })

  describe('Test checkin-settings', () => {
    const manageSettingsUrl = `${manageBase}/settings`

    it('restores the saved check-in date and interval when the submitted date is invalid', () => {
      // autoStoreSessionData has already run and stored the invalid submission by the time
      // validation middleware runs, so the session starts out holding the rejected input.
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              date: '',
              interval: 'WEEKLY',
            },
          },
        },
      }
      const req = makeReq({
        url: manageSettingsUrl,
        body: { esupervision },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse({
        offenderCheckinsByCRNResponse: {
          firstCheckin: '2026-09-01',
          checkinInterval: 'FOUR_WEEKS',
        },
      })
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
      expect(req.session.data.esupervision[crn][id].manageCheckin).toEqual({
        date: '2026-09-01',
        interval: 'FOUR_WEEKS',
      })
    })
  })

  describe('Test manage-contact', () => {
    const manageContactUrl = `${manageBase}/contact`

    it('resets the preference radio to the saved contact preference when the new selection has no value on file', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              preferredComs: 'PHONE',
              checkInMobile: '',
              checkInEmail: 'name@example.com',
            },
          },
        },
      }
      const req = makeReq({
        url: manageContactUrl,
        body: { esupervision, change: 'main' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse({ offenderCheckinsByCRNResponse: { contactPreference: 'EMAIL' } })
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
      expect(req.session.data.esupervision[crn][id].manageCheckin.preferredComs).toBe('EMAIL')
    })

    it('keeps the new selection when it has a value on file', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              preferredComs: 'PHONE',
              checkInMobile: '07700 900900',
              checkInEmail: 'name@example.com',
            },
          },
        },
      }
      const req = makeReq({
        url: manageContactUrl,
        body: { esupervision, change: 'main' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse({ offenderCheckinsByCRNResponse: { contactPreference: 'EMAIL' } })
      validation.eSuperVision(req, res, next)
      expect(next).toHaveBeenCalled()
      expect(req.session.data.esupervision[crn][id].manageCheckin.preferredComs).toBe('PHONE')
    })

    it('does not validate the preference when the request is a change button, not the main submit', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              preferredComs: 'PHONE',
              checkInMobile: '',
              checkInEmail: 'name@example.com',
            },
          },
        },
      }
      const req = makeReq({
        url: manageContactUrl,
        body: { esupervision, change: 'mobile' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse({ offenderCheckinsByCRNResponse: { contactPreference: 'EMAIL' } })
      validation.eSuperVision(req, res, next)
      expect(next).toHaveBeenCalled()
      expect(req.session.data.esupervision[crn][id].manageCheckin.preferredComs).toBe('PHONE')
    })
  })

  describe('Test manage-edit-contact', () => {
    const manageEditContactUrl = `${manageBase}/edit-contact`

    // Scenario 1 & 2: whichever method is the person's preferred contact method can never be
    // cleared - that's true whether or not the other field still has a value, since a stale
    // preference (set once from NDelius, only changed via the main contact-preference form)
    // would otherwise let the wrong field be treated as required.
    it('blocks clearing email when email is the preferred contact method, even if mobile still has a value', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              editCheckInMobile: '07700 900900',
              editCheckInEmail: '',
              preferredComs: 'EMAIL',
            },
          },
        },
      }
      const req = makeReq({
        url: manageEditContactUrl,
        body: { esupervision, previousMobile: '07700 900900', previousEmail: 'name@example.com' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse()
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
      const [, renderArgs] = (res.render as jest.Mock).mock.calls[0]
      expect(renderArgs.errorMessages).toEqual({
        'esupervision-X000001-1-manageCheckin-editCheckInEmail': 'Enter an email address',
      })
      expect(req.session.data.esupervision[crn][id].manageCheckin).toEqual({
        editCheckInMobile: '07700 900900',
        editCheckInEmail: 'name@example.com',
        preferredComs: 'EMAIL',
      })
    })

    it('keeps the malformed submission on screen instead of redisplaying the saved value', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              editCheckInMobile: '07700 900900',
              editCheckInEmail: 'not-an-email',
              preferredComs: 'EMAIL',
            },
          },
        },
      }
      const req = makeReq({
        url: manageEditContactUrl,
        body: { esupervision, previousMobile: '07700 900900', previousEmail: 'name@example.com' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse()
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
      const [, renderArgs] = (res.render as jest.Mock).mock.calls[0]
      expect(renderArgs.errorMessages).toEqual({
        'esupervision-X000001-1-manageCheckin-editCheckInEmail': 'Enter an email address in the correct format.',
      })
      expect(req.session.data.esupervision[crn][id].manageCheckin).toEqual({
        editCheckInMobile: '07700 900900',
        editCheckInEmail: 'not-an-email',
        preferredComs: 'EMAIL',
      })
    })

    it('blocks clearing mobile when mobile is the preferred contact method, even if email still has a value', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              editCheckInMobile: '',
              editCheckInEmail: 'name@example.com',
              preferredComs: 'PHONE',
            },
          },
        },
      }
      const req = makeReq({
        url: manageEditContactUrl,
        body: { esupervision, previousMobile: '07700 900900', previousEmail: 'name@example.com' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse()
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
      const [, renderArgs] = (res.render as jest.Mock).mock.calls[0]
      expect(renderArgs.errorMessages).toEqual({
        'esupervision-X000001-1-manageCheckin-editCheckInMobile': 'Enter a mobile number',
      })
      expect(req.session.data.esupervision[crn][id].manageCheckin).toEqual({
        editCheckInMobile: '07700 900900',
        editCheckInEmail: 'name@example.com',
        preferredComs: 'PHONE',
      })
    })

    it('blocks clearing the only contact method when it is also the preferred one', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              editCheckInMobile: '',
              editCheckInEmail: '',
              preferredComs: 'EMAIL',
            },
          },
        },
      }
      const req = makeReq({
        url: manageEditContactUrl,
        body: { esupervision, previousMobile: '', previousEmail: 'name@example.com' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse()
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
      const [, renderArgs] = (res.render as jest.Mock).mock.calls[0]
      expect(renderArgs.errorMessages).toEqual({
        'esupervision-X000001-1-manageCheckin-editCheckInEmail': 'Enter an email address',
      })
    })

    it('allows clearing the non-preferred field when it still has a value', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              editCheckInMobile: '',
              editCheckInEmail: 'name@example.com',
              preferredComs: 'EMAIL',
            },
          },
        },
      }
      const req = makeReq({
        url: manageEditContactUrl,
        body: { esupervision, previousMobile: '07700 900900', previousEmail: 'name@example.com' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse()
      validation.eSuperVision(req, res, next)
      expect(next).toHaveBeenCalled()
    })

    it('passes when both fields were already empty and remain empty', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              editCheckInMobile: '',
              editCheckInEmail: '',
            },
          },
        },
      }
      const req = makeReq({
        url: manageEditContactUrl,
        body: { esupervision, previousMobile: '', previousEmail: '' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse()
      validation.eSuperVision(req, res, next)
      expect(next).toHaveBeenCalled()
    })
  })

  describe('Test edit question', () => {
    const editQuestionUrl = `/case/${crn}/appointments/check-in/manage/${id}/questions/1-f47ac10b-58cc-4372-a567-0e02b2c3d479/edit`

    it('passes when draftQuestionInput is provided', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageQuestions: {
              draftQuestionInput: 'the housing service',
            },
          },
        },
      }
      const req = makeReq({
        url: editQuestionUrl,
        body: { esupervision },
        session: { data: { esupervision } },
      })
      const res = makeRes()
      validation.eSuperVision(req, res, next)

      expect(next).toHaveBeenCalled()
    })

    it('fails when draftQuestionInput is empty', () => {
      const bodyEsupervision = {
        [crn]: {
          [id]: {
            manageQuestions: {
              draftQuestionInput: '',
            },
          },
        },
      }

      const sessionEsupervision = {
        [crn]: {
          [id]: {
            manageQuestions: {
              availableTemplates: [{ id: '1', template: 'Have you heard back from {{thing}}?' }],
            },
          },
        },
      }

      const req = makeReq({
        url: editQuestionUrl,
        body: { esupervision: bodyEsupervision },
        session: { data: { esupervision: sessionEsupervision } },
      })
      const res = makeRes()

      validation.eSuperVision(req, res, next)

      expect(res.render).toHaveBeenCalledWith('pages/check-in/questions/edit-question', expect.any(Object))
      expect(next).not.toHaveBeenCalled()
    })
  })
})
