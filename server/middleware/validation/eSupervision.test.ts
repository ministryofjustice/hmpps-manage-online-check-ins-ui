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

  describe('Test manage-edit-contact', () => {
    const manageEditContactUrl = `${manageBase}/edit-contact`

    it('requires both fields when both had values and are cleared', () => {
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
        body: { esupervision, previousMobile: '07700 900900', previousEmail: 'name@example.com' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse()
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
      const [, renderArgs] = (res.render as jest.Mock).mock.calls[0]
      expect(renderArgs.errorMessages).toEqual({
        'esupervision-X000001-1-manageCheckin-editCheckInMobile': 'Enter a mobile number',
        'esupervision-X000001-1-manageCheckin-editCheckInEmail': 'Enter an email address',
      })
      // Redisplays the saved contact details instead of the blank submission.
      expect(req.session.data.esupervision[crn][id].manageCheckin).toEqual({
        editCheckInMobile: '07700 900900',
        editCheckInEmail: 'name@example.com',
      })
    })

    it('requires both fields when only one had a value and is cleared', () => {
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
        body: { esupervision, previousMobile: '', previousEmail: 'name@example.com' },
        session: { data: { esupervision } },
      })
      const res = mockAppResponse()
      validation.eSuperVision(req, res, next)
      expect(res.render).toHaveBeenCalled()
    })

    it('allows clearing one field when the other still has a value', () => {
      const esupervision = {
        [crn]: {
          [id]: {
            manageCheckin: {
              editCheckInMobile: '',
              editCheckInEmail: 'name@example.com',
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
