import httpMocks from 'node-mocks-http'
import controllers from '.'

import { CheckinScheduleResponse, OffenderCheckinsByCRNResponse } from '../data/model/esupervision'
import ESupervisionClient from '../data/eSupervisionClient'
import mockAppResponse from './mocks/appResponse'
import HmppsAuthClient from '../data/hmppsAuthClient'
import renderError from '../middleware/renderError'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import setDataValue from '../utils/setDataValue'

jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

const mockMiddlewareFn = jest.fn()

jest.mock('../middleware/renderError', () => jest.fn(() => mockMiddlewareFn))
jest.mock('../utils/isValidCrn', () => jest.fn())
jest.mock('../utils/isValidUUID', () => jest.fn())
jest.mock('../utils/setDataValue', () => jest.fn())
jest.mock('../data/eSupervisionClient')

jest.mock('../data/hmppsAuthClient', () => {
  return jest.fn().mockImplementation(() => ({
    getSystemClientToken: jest.fn().mockResolvedValue('token-1'),
  }))
})

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20'),
}))

jest.mock('../config', () => {
  const actualConfig = jest.requireActual('../config').default

  return {
    ...actualConfig,
    managePeopleOnProbation: {
      ...actualConfig.managePeopleOnProbation,
      link: 'https://localhost:9091/manage-people-on-probation',
    },
  }
})

const postDeactivateOffender = jest
  .spyOn(ESupervisionClient.prototype, 'postDeactivateOffender')
  .mockImplementation(() => Promise.resolve({} as CheckinScheduleResponse))

const mockIsValidCrn = isValidCrn as jest.MockedFunction<typeof isValidCrn>
const mockIsValidUUID = isValidUUID as jest.MockedFunction<typeof isValidUUID>
const mockRenderError = renderError as jest.MockedFunction<typeof renderError>
const mockSetDataValue = setDataValue as jest.MockedFunction<typeof setDataValue>

const crn = 'X000001'
const uuid = 'f1654ea3-0abb-46eb-860b-654a96edbe20'

const offenderCheckinsByCRNResponse = {
  uuid,
  crn,
  status: 'VERIFIED',
  firstCheckin: '2025-11-03',
  checkinInterval: 'WEEKLY',
  contactPreference: 'PHONE',
  photoUrl: '/assets/images/placeholder.png',
  details: {
    name: {
      forename: 'Joe',
      surname: 'Bloggs',
    },
  },
} as OffenderCheckinsByCRNResponse

const baseReq = (data?: any) =>
  httpMocks.createRequest({
    params: { crn, id: uuid },
    session: { data },
    query: {
      back: 'string',
    },
    url: 'url',
  })

const res = mockAppResponse()
res.locals.offenderCheckinsByCRNResponse = offenderCheckinsByCRNResponse

const renderSpy = jest.spyOn(res, 'render')
const redirectSpy = jest.spyOn(res, 'redirect')
const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>

describe('checkInsController', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useRealTimers()
    res.locals.offenderCheckinsByCRNResponse = offenderCheckinsByCRNResponse
  })

  describe('getManageCheckinPage', () => {
    it('renders manage check in page', async () => {
      const req = httpMocks.createRequest({
        params: { crn },
      })

      await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(req, res)

      expect(renderSpy).toHaveBeenCalled()
      const [template, context] = (renderSpy as jest.Mock).mock.calls.pop()

      expect(template).toBe('pages/check-in/index.njk')
      expect(context.crn).toBe(crn)
      expect(context.id).toBe(uuid)
      expect(context.case).toEqual(offenderCheckinsByCRNResponse.details)
      expect(context.offenderCheckinsByCRNResponse).toEqual(offenderCheckinsByCRNResponse)
    })

    it('returns 404 when offender details are missing', async () => {
      const req = httpMocks.createRequest({
        params: { crn },
      })

      res.locals.offenderCheckinsByCRNResponse = undefined

      await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(req, res)

      expect(mockRenderError).toHaveBeenCalledWith(404)
      expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
    })
  })

  describe('getStopCheckinPage', () => {
    it('renders stop-check in page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const req = httpMocks.createRequest({
        params: { crn, id: uuid },
      })

      await controllers.checkIns.getStopCheckinPage(hmppsAuthClient)(req, res)

      expect(renderSpy).toHaveBeenCalled()
      const [template, context] = (renderSpy as jest.Mock).mock.calls.pop()

      expect(template).toBe('pages/check-in/manage/stop-checkin.njk')
      expect(context.crn).toBe(crn)
      expect(context.id).toBe(uuid)
      expect(context.case).toEqual(offenderCheckinsByCRNResponse.details)
    })
  })

  describe('postManageStopCheckin', () => {
    it('redirects to manage people on probation case page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const req = baseReq({
        esupervision: {
          [crn]: {
            [uuid]: {
              manageCheckin: {
                stopCheckinReason: 'Reason for stopping check in',
                stopCheckinSensitive: 'false',
              },
            },
          },
        },
      })

      await controllers.checkIns.postManageStopCheckin(hmppsAuthClient)(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(303, `https://localhost:9091/manage-people-on-probation/case/${crn}`)
    })

    it('stops check in, clears session data and redirects', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data: any = {
        esupervision: {
          [crn]: {
            [uuid]: {
              manageCheckin: {
                stopCheckinReason: 'Reason for stopping check in',
                stopCheckinSensitive: 'true',
              },
            },
          },
        },
      }

      const req = baseReq(data)

      await controllers.checkIns.postManageStopCheckin(hmppsAuthClient)(req, res)

      expect(hmppsAuthClient.getSystemClientToken).toHaveBeenCalledWith('user-1')

      expect(postDeactivateOffender).toHaveBeenCalledWith(uuid, {
        requestedBy: 'user-1',
        reason: 'Reason for stopping check in',
        sensitive: true,
      })

      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'manageCheckin'],
        null,
      )

      expect(redirectSpy).toHaveBeenCalledWith(303, `https://localhost:9091/manage-people-on-probation/case/${crn}`)
    })

    it('escapes double quotes in the reason', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const req = baseReq({
        esupervision: {
          [crn]: {
            [uuid]: {
              manageCheckin: {
                stopCheckinReason: 'Reason with "quotes"',
                stopCheckinSensitive: 'false',
              },
            },
          },
        },
      })

      await controllers.checkIns.postManageStopCheckin(hmppsAuthClient)(req, res)

      expect(postDeactivateOffender).toHaveBeenCalledWith(uuid, {
        requestedBy: 'user-1',
        reason: 'Reason with \\"quotes\\"',
        sensitive: false,
      })
    })
  })

  describe('Additional questions for online check ins journey', () => {
    describe('getStartQuestionsPage', () => {
      it('renders start questions page when CRN is valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq()
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getStartQuestionsPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith('pages/check-in/questions/instructions.njk', {
          crn,
          id,
          back: req.query.back,
          case: offenderCheckinsByCRNResponse.details,
          data: req.session.data,
        })
        expect(mockRenderError).not.toHaveBeenCalled()
      })
    })

    describe('postStartQuestionsPage', () => {
      it('redirects to add questions page when CRN and id are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq()
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.postStartQuestionsPage(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })
    })

    describe('getAddQuestionsPage', () => {
      beforeEach(() => {
        jest.spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates').mockResolvedValue({
          templates: [
            {
              id: 1,
              template: 'How has {{thing}} been going recently?',
              example: 'unpaid work, college course, work, apprenticeship, university course, sentence plan, training',
              responseFormat: 'TEXT',
              responseSpec: {
                hint: 'Hint for the question about the {{thing}}',
                placeholders: ['thing'],
              },
              policy$hmpps_esupervision_api: 'CUSTOMISABLE',
            },
            {
              id: 2,
              template: 'How have things been feeling {{thing}} recently? ',
              example:
                'home, work, relationships with family, appointments with other bodies, physical or mental health, recovery journey',
              responseFormat: 'TEXT',
              responseSpec: {
                hint: 'Hint for the question about the {{thing}}',
                placeholders: ['thing'],
              },
              policy$hmpps_esupervision_api: 'CUSTOMISABLE',
            },
          ],
        } as any)
      })

      it('renders add questions page when CRN and id are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockResolvedValue({
          upcoming: {
            items: [],
          },
        } as any)

        const req = baseReq()
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/add-questions.njk',
          expect.objectContaining({
            crn,
            id,
            case: offenderCheckinsByCRNResponse.details,
            addedQuestions: [],
            data: req.session.data,
          }),
        )
        expect(mockRenderError).not.toHaveBeenCalled()
      })

      it('safely extracts text from nested placeholders object from the API', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        jest.spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates').mockResolvedValue({
          templates: [
            {
              id: 5,
              template: 'How is {{thing}}?',
              responseSpec: { placeholders: ['thing'] },
              policy$hmpps_esupervision_api: 'CUSTOMISABLE',
            },
          ],
        } as any)

        jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockResolvedValue({
          upcoming: {
            items: [
              {
                template: { id: 5 },
                params: {
                  placeholders: { thing: 'work going' },
                },
              },
            ],
          },
        } as any)

        const req = baseReq()

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, uuid, 'manageQuestions', 'questionTemplateAndInputs'],
          expect.any(Object),
        )

        const setDataCall = mockSetDataValue.mock.calls.find(call => call[1].includes('questionTemplateAndInputs'))
        const savedData = setDataCall?.[2]

        expect(Object.values(savedData)).toContain('work going')
      })

      it('skips fetching upcoming questions if they already exist in the session', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: { '1-uuid': 'existing answer' },
                  availableTemplates: [
                    {
                      id: '1',
                      template: 'How is {{thing}}?',
                      responseSpec: { placeholders: ['thing'] },
                      policy$hmpps_esupervision_api: 'CUSTOMISABLE',
                    },
                  ],
                },
              },
            },
          },
        })

        const getUpcomingSpy = jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems')

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(getUpcomingSpy).not.toHaveBeenCalled()
        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/add-questions.njk',
          expect.objectContaining({
            addedQuestions: [{ id: '1-uuid', fullText: 'How is existing answer?' }],
          }),
        )
      })

      it('renders 500 error page if fetching upcoming questions fails with non-404', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestionItems').mockRejectedValue({ status: 500 })

        const req = baseReq()

        await controllers.checkIns.getAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(500)
      })
    })

    describe('postAddQuestionsPage', () => {
      beforeEach(() => {
        jest.spyOn(ESupervisionClient.prototype, 'putAssignQuestionsToCheckIn').mockResolvedValue({} as any)
        jest.spyOn(ESupervisionClient.prototype, 'deleteAssignedQuestionsFromCheckIn').mockResolvedValue({} as any)
      })

      it('maps session data to payload and redirects to manage page on success', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  availableTemplates: [{ id: '1', responseFormat: 'TEXT', responseSpec: { placeholders: ['thing'] } }],
                  questionTemplateAndInputs: {
                    '1-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'the housing service',
                  },
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.postAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(hmppsAuthClient.getSystemClientToken).toHaveBeenCalled()
        expect(ESupervisionClient.prototype.putAssignQuestionsToCheckIn).toHaveBeenCalledWith(crn, {
          questions: [
            {
              id: 1,
              params: {
                placeholders: {
                  thing: 'the housing service',
                },
                responseFormat: 'TEXT',
              },
            },
          ],
          language: 'en-GB',
          author: 'user-1',
        })
        expect(redirectSpy).toHaveBeenCalledWith(303, `https://localhost:9091/manage-people-on-probation/case/${crn}`)
      })

      it('handles completely empty session data by redirecting to manage page', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({})
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.postAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(303, `https://localhost:9091/manage-people-on-probation/case/${crn}`)
      })

      it('calls DELETE endpoint when there are no custom questions to save', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {},
                  availableTemplates: [{ id: '3', responseSpec: { placeholders: ['thing'] } }],
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.postAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(ESupervisionClient.prototype.deleteAssignedQuestionsFromCheckIn).toHaveBeenCalledWith(crn)
        expect(ESupervisionClient.prototype.putAssignQuestionsToCheckIn).not.toHaveBeenCalled()

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, id, 'questionsAdded'],
          false,
        )
        expect(redirectSpy).toHaveBeenCalledWith(303, `https://localhost:9091/manage-people-on-probation/case/${crn}`)
      })

      it('renders 500 error page if saving questions to the API fails', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: { '1-some-uuid': 'answer' },
                  availableTemplates: [{ id: '1', responseSpec: { placeholders: ['text'] }, responseFormat: 'TEXT' }],
                },
              },
            },
          },
        })

        jest.spyOn(ESupervisionClient.prototype, 'putAssignQuestionsToCheckIn').mockRejectedValue({ status: 500 })

        await controllers.checkIns.postAddQuestionsPage(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(500)
        expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
      })
    })

    describe('getPreviewFeelingPage', () => {
      it('renders feeling preview page when CRN and id are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({ mockData: 'value' })
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getPreviewFeelingPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith('pages/check-in/questions/preview/feeling.njk', {
          crn,
          id,
          back: req.query.back,
          data: req.session.data,
        })
        expect(mockRenderError).not.toHaveBeenCalled()
      })
    })

    describe('getPreviewSupportPage', () => {
      it('renders support preview page when CRN and id are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({ mockData: 'value' })
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getPreviewSupportPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith('pages/check-in/questions/preview/support.njk', {
          crn,
          id,
          back: req.query.back,
          data: req.session.data,
        })
        expect(mockRenderError).not.toHaveBeenCalled()
      })
    })

    describe('getQuestionsListPage', () => {
      it('renders list questions page when CRN and id are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const getQuestionsListSpy = jest
          .spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates')
          .mockImplementation(() =>
            Promise.resolve({
              templates: [
                {
                  id: '1',
                  template: 'Have you heard back from {{thing}}?',
                  responseSpec: { placeholders: ['thing'] },
                  policy$hmpps_esupervision_api: 'CUSTOMISABLE',
                },
              ],
            } as any),
          )

        const req = baseReq()
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getQuestionsListPage(hmppsAuthClient)(req, res)

        expect(getQuestionsListSpy).toHaveBeenCalledWith('en-GB')
        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, id, 'manageQuestions', 'availableTemplates'],
          [
            {
              id: '1',
              template: 'Have you heard back from {{thing}}?',
              responseSpec: { placeholders: ['thing'] },
              policy$hmpps_esupervision_api: 'CUSTOMISABLE',
            },
          ],
        )
        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/list-questions.njk',
          expect.objectContaining({
            crn,
            id,
            back: req.query.back,
            case: offenderCheckinsByCRNResponse.details,
            data: req.session.data,
          }),
        )
        expect(mockRenderError).not.toHaveBeenCalled()
      })

      it('redirects to add questions page if 3 or more questions are already saved', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        jest.spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates').mockImplementation(() =>
          Promise.resolve({
            templates: [],
          } as any),
        )

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {
                    '1-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'work',
                    '2-a81bc81b-dead-4e5d-abff-90865d1e13b1': 'the housing service',
                    '3-c91350a4-37a4-4422-92e1-7d121bc1e612': 'your landlord',
                  },
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.getQuestionsListPage(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })
    })

    describe('postQuestionsListPage', () => {
      it('redirects to add questions page when CRN and id are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq()
        const { id } = req.params as Record<string, string>

        await controllers.checkIns.postQuestionsListPage(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })
    })

    describe('getEditQuestionPage', () => {
      it('renders edit question page when CRN, id, and question template are valid', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  availableTemplates: [
                    {
                      id: '1',
                      template: 'Have you heard back from {{thing}}?',
                      responseSpec: { placeholders: ['thing'] },
                    },
                  ],
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>
        req.params.questionId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'

        await controllers.checkIns.getEditQuestionPage(hmppsAuthClient)(req, res)

        expect(renderSpy).toHaveBeenCalledWith(
          'pages/check-in/questions/edit-question.njk',
          expect.objectContaining({
            crn,
            id,
            questionId: '1-f47ac10b-58cc-4372-a567-0e02b2c3d479',
            case: offenderCheckinsByCRNResponse.details,
            question: expect.objectContaining({
              prefix: 'Have you heard back from ',
              suffix: '?',
              placeholderWord: 'thing',
            }),
            data: req.session.data,
          }),
        )
        expect(mockRenderError).not.toHaveBeenCalled()
      })

      it('fetches templates from API and saves to session if none are in session data', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const getQuestionsListSpy = jest
          .spyOn(ESupervisionClient.prototype, 'getQuestionsTemplates')
          .mockResolvedValue({
            templates: [
              {
                id: '1',
                template: 'Have you heard back from {{thing}}?',
                responseSpec: { placeholders: ['thing'] },
                policy$hmpps_esupervision_api: 'CUSTOMISABLE',
              },
            ],
          } as any)

        const req = baseReq()
        const { id } = req.params as Record<string, string>
        req.params.questionId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'

        await controllers.checkIns.getEditQuestionPage(hmppsAuthClient)(req, res)

        expect(getQuestionsListSpy).toHaveBeenCalledWith('en-GB')

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          ['esupervision', crn, id, 'manageQuestions', 'availableTemplates'],
          expect.any(Array),
        )

        expect(renderSpy).toHaveBeenCalled()
      })

      it('returns 404 when templateId cannot be parsed/found', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  availableTemplates: [{ id: '1', template: 'Have you heard back from {{thing}}?' }],
                },
              },
            },
          },
        })
        req.params.questionId = 'error-id'

        await controllers.checkIns.getEditQuestionPage(hmppsAuthClient)(req, res)

        expect(mockRenderError).toHaveBeenCalledWith(404)
        expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
      })
    })

    describe('postEditQuestionPage', () => {
      it('saves answer to session and redirects to add questions page', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  draftQuestionInput: 'the housing service',
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>
        req.params.questionId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'
        req.body = {
          esupervision: {
            [crn]: {
              [id]: {
                manageQuestions: {
                  draftQuestionInput: 'the housing service',
                },
              },
            },
          },
        }

        await controllers.checkIns.postEditQuestionPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).toHaveBeenCalledWith(
          req.session.data,
          [
            'esupervision',
            crn,
            id,
            'manageQuestions',
            'questionTemplateAndInputs',
            '1-f47ac10b-58cc-4372-a567-0e02b2c3d479',
          ],
          'the housing service',
        )
        expect(req.session.data.esupervision[crn][id].manageQuestions.draftQuestionInput).toBeUndefined()
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })

      it('does not save to session if input is empty or whitespace, but still redirects', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq()
        const { id } = req.params as Record<string, string>
        req.params.questionId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'

        req.body = {
          esupervision: {
            [crn]: {
              [id]: {
                manageQuestions: {
                  draftQuestionInput: '   ',
                },
              },
            },
          },
        }

        await controllers.checkIns.postEditQuestionPage(hmppsAuthClient)(req, res)

        expect(mockSetDataValue).not.toHaveBeenCalled()
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })
    })

    describe('getSelectQuestionPage', () => {
      it('redirects to edit question page', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq()
        const { id } = req.params as Record<string, string>
        req.params.templateId = '1'

        await controllers.checkIns.getSelectQuestionPage(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(
          `/case/${crn}/appointments/check-in/manage/${id}/questions/1-f1654ea3-0abb-46eb-860b-654a96edbe20/edit`,
        )
      })

      it('redirects to add questions page if 3 or more questions are already saved', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {
                    '1-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'work',
                    '2-a81bc81b-dead-4e5d-abff-90865d1e13b1': 'the housing service',
                    '3-c91350a4-37a4-4422-92e1-7d121bc1e612': 'your landlord',
                  },
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>
        req.params.templateId = '1'

        await controllers.checkIns.getSelectQuestionPage(hmppsAuthClient)(req, res)

        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })
    })

    describe('getDeleteQuestion', () => {
      it('removes question from session and redirects to add questions page', async () => {
        mockIsValidCrn.mockReturnValue(true)
        mockIsValidUUID.mockReturnValue(true)

        const req = baseReq({
          esupervision: {
            [crn]: {
              [uuid]: {
                manageQuestions: {
                  questionTemplateAndInputs: {
                    '1-f47ac10b-58cc-4372-a567-0e02b2c3d479': 'work',
                    '2-a81bc81b-dead-4e5d-abff-90865d1e13b1': 'the housing service',
                    '3-c91350a4-37a4-4422-92e1-7d121bc1e612': 'your landlord',
                  },
                },
              },
            },
          },
        })
        const { id } = req.params as Record<string, string>
        req.params.questionId = '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'

        await controllers.checkIns.getDeleteQuestion(hmppsAuthClient)(req, res)

        expect(
          req.session.data.esupervision[crn][id].manageQuestions.questionTemplateAndInputs[
            '1-f47ac10b-58cc-4372-a567-0e02b2c3d479'
          ],
        ).toBeUndefined()
        expect(
          req.session.data.esupervision[crn][id].manageQuestions.questionTemplateAndInputs[
            '2-a81bc81b-dead-4e5d-abff-90865d1e13b1'
          ],
        ).toBeDefined()
        expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${id}/questions/add`)
      })
    })
  })
})
