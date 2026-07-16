import httpMocks, { RequestOptions } from 'node-mocks-http'
import validation from '.'
import mockAppResponse from '../../controllers/mocks/appResponse'

const crn = 'X000001'
const id = '1'

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20'),
}))

const checkInUrl = `/case/${crn}/appointments/${id}/check-in`

const rationaleUrl = `${checkInUrl}/rationale`
const dateFrequencyUrl = `${checkInUrl}/date-frequency`
const contactPreferenceUrl = `${checkInUrl}/contact-preference`
const editContactPreferenceUrl = `${checkInUrl}/edit-contact-preference`
const photoOptionsUrl = `${checkInUrl}/photo-options`
const uploadPhotoUrl = `${checkInUrl}/upload-a-photo`

const manageBase = `/case/${crn}/appointments/check-in/manage/${id}`
const manageSettingsUrl = `${manageBase}/settings`
const manageEditContactUrl = `${manageBase}/edit-contact`
const manageStopCheckinsUrl = `${manageBase}/stop-checkin`
const manageContactUrl = `${manageBase}/contact`
const restartCheckinUrl = `/case/${crn}/appointments/check-in/manage/${id}/restart-checkin`
const restartContactUrl = `/case/${crn}/appointments/check-in/manage/${id}/restart-contact`
const restartEditContactUrl = `/case/${crn}/appointments/check-in/manage/${id}/restart-edit-contact`
const eligibilityCheckUrl = `${checkInUrl}/eligibility-check`
const fullEligibilityUrl = `${checkInUrl}/full-eligibility`
const spoApprovalUrl = `${checkInUrl}/spo-approval`
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
