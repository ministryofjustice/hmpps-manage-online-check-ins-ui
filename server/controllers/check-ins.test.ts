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
import MasApiClient from '../data/masApiClient'
import { PersonalDetails } from '../data/model/personalDetails'
import { SubjectType } from '../middleware/sendAuditMessage'
import { checkSendAuditMessage } from './testutils'

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
jest.mock('@ministryofjustice/hmpps-audit-client')

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

const mockPersonalDetails = {} as PersonalDetails
const getPersonalDetailsSpy = jest
  .spyOn(MasApiClient.prototype, 'getPersonalDetails')
  .mockImplementation(() => Promise.resolve(mockPersonalDetails))

const updatePersonalDetailsSpy = jest
  .spyOn(MasApiClient.prototype, 'updatePersonalDetailsContact')
  .mockImplementation(() => Promise.resolve({ crn } as PersonalDetails))

const postDeactivateOffender = jest
  .spyOn(ESupervisionClient.prototype, 'postDeactivateOffender')
  .mockImplementation(() => Promise.resolve({} as CheckinScheduleResponse))

const postReactivateOffenderSpy = jest
  .spyOn(ESupervisionClient.prototype, 'postReactivateOffender')
  .mockImplementation(() => Promise.resolve({} as CheckinScheduleResponse))

const postUpdateOffenderDetailsSpy = jest
  .spyOn(ESupervisionClient.prototype, 'postUpdateOffenderDetails')
  .mockImplementation(() => Promise.resolve({} as CheckinScheduleResponse))

const getOffenderCheckinsByCRNSpy = jest
  .spyOn(ESupervisionClient.prototype, 'getOffenderByCRN')
  .mockImplementation(async () => null)

const mockIsValidCrn = isValidCrn as jest.MockedFunction<typeof isValidCrn>
const mockIsValidUUID = isValidUUID as jest.MockedFunction<typeof isValidUUID>
const mockRenderError = renderError as jest.MockedFunction<typeof renderError>
const mockSetDataValue = setDataValue as jest.MockedFunction<typeof setDataValue>

const crn = 'X000001'
const uuid = 'f1654ea3-0abb-46eb-860b-654a96edbe20'
const cya = false

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
    it('renders the manage check in page', async () => {
      ;(ESupervisionClient.prototype.getOffenderByCRN as jest.Mock).mockResolvedValueOnce(offenderCheckinsByCRNResponse)

      const req = httpMocks.createRequest({
        params: { crn, id: uuid },
        session: { data: {} },
      })

      await controllers.checkIns.getManageCheckinPage(hmppsAuthClient)(req, res)

      expect(renderSpy).toHaveBeenCalled()
      const [template, context] = (renderSpy as jest.Mock).mock.calls.pop()

      expect(template).toBe('pages/check-in/manage/manage-checkin.njk')
      expect(context.crn).toBe(crn)
      expect(context.id).toBe(uuid)
      expect(context.case).toEqual(offenderCheckinsByCRNResponse.details)

      expect(context.offenderCheckinsByCRNResponse).toEqual(offenderCheckinsByCRNResponse)
      checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_CHECK_IN', crn, SubjectType.CRN)
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
      checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_MANAGE_STOP_CHECK_IN', crn, SubjectType.CRN)
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

  describe('getRestartCheckinPage', () => {
    it('sets session values and renders restart date page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      res.locals.offenderCheckinsByCRNResponse = {
        ...offenderCheckinsByCRNResponse,
        status: 'INACTIVE',
        firstCheckin: '01/01/2026',
        checkinInterval: 'WEEKLY',
        contactPreference: 'EMAIL',
      }
      const req = baseReq({})

      await controllers.checkIns.getRestartCheckinPage(hmppsAuthClient)(req, res)

      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'id'],
        uuid,
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'interval'],
        'WEEKLY',
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'preferredComs'],
        'EMAIL',
      )
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-date-frequency.njk',
        expect.objectContaining({
          crn,
          id: uuid,
          cya,
        }),
      )
    })
  })

  describe('postRestartCheckinPage', () => {
    it('redirects to restart contact page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq()
      await controllers.checkIns.postRestartCheckinPage(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-contact`)
    })

    it('redirects to summary when CYA is true', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const req = baseReq()
      req.query = { cya: 'true' }
      await controllers.checkIns.postRestartCheckinPage(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(
        `/case/${crn}/appointments/check-in/manage/${uuid}/restart-summary?cya=true`,
      )
    })
  })

  describe('getRestartContactPage', () => {
    it('renders restart contact page and stores edit values in session', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      ;(mockPersonalDetails as PersonalDetails).mobileNumber = '07700900000'
      ;(mockPersonalDetails as PersonalDetails).email = 'test@example.com'

      const req = baseReq({
        esupervision: { [crn]: { [uuid]: { restartCheckin: { preferredComs: 'EMAIL' } } } },
      })

      await controllers.checkIns.getRestartContactPage(hmppsAuthClient)(req, res)

      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'editCheckInMobile'],
        '07700900000',
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin', 'editCheckInEmail'],
        'test@example.com',
      )
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-contact-preference.njk',
        expect.objectContaining({
          crn,
          id: uuid,
          checkInMobile: '07700900000',
          checkInEmail: 'test@example.com',
          preferredComs: 'EMAIL',
        }),
      )
    })
  })

  describe('postRestartContactPage', () => {
    it('redirects to summary when change is main', async () => {
      const req = baseReq()
      req.body = { change: 'main' }
      await controllers.checkIns.postRestartContactPage(hmppsAuthClient)(req, res)
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-summary`)
    })
  })

  describe('getRestartEditContactPage', () => {
    it('renders restart edit contact page with session values', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                editCheckInMobile: '07123456789',
                editCheckInEmail: 'test@example.com',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      req.query = { change: 'email', cya: 'false' }

      await controllers.checkIns.getRestartEditContactPage(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith('pages/check-in/manage/restart-edit-contact.njk', {
        crn,
        id: uuid,
        case: {
          name: {
            forename: 'Joe',
            surname: 'Bloggs',
          },
        },
        change: 'email',
        cya: 'false',
        checkInMobile: '07123456789',
        checkInEmail: 'test@example.com',
      })
    })

    it('sets success flag when contactUpdated is true in session', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: { [crn]: { [uuid]: { restartCheckin: { contactUpdated: true } } } },
      }
      const req = baseReq(data)
      await controllers.checkIns.getRestartEditContactPage(hmppsAuthClient)(req, res)
      expect(res.locals.success).toBe(true)
    })
  })

  describe('postRestartEditContactPage', () => {
    it('updates MAS when values have changed', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                editCheckInMobile: '07123456789',
                editCheckInEmail: 'test@example.com',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      req.body = { previousMobile: '07000000000', previousEmail: 'old@example.com' }

      await controllers.checkIns.postRestartEditContactPage(hmppsAuthClient)(req, res)

      expect(updatePersonalDetailsSpy).toHaveBeenCalledWith(crn, {
        emailAddress: 'test@example.com',
        mobileNumber: '07123456789',
      })
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-contact`)
    })

    it('skips contact details update when values are identical to previous', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                editCheckInMobile: '07700900111',
                editCheckInEmail: 'same@example.com',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      req.body = { previousMobile: '07700900111', previousEmail: 'same@example.com' }

      await controllers.checkIns.postRestartEditContactPage(hmppsAuthClient)(req, res)

      expect(updatePersonalDetailsSpy).not.toHaveBeenCalled()
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-contact`)
    })
  })

  describe('getRestartSummaryPage', () => {
    it('renders restart summary with transformed userDetails', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                interval: 'WEEKLY',
                preferredComs: 'EMAIL',
                checkInEmail: 'test@example.com',
                date: '19/2/2026',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      await controllers.checkIns.getRestartSummaryPage(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-checkin-summary.njk',
        expect.objectContaining({
          crn,
          userDetails: expect.objectContaining({
            interval: 'Every week',
            preferredComs: 'Email',
          }),
        }),
      )
    })
  })

  describe('postRestartSummaryPage', () => {
    it('calls reactivate API with ISO date and redirects to confirmation', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                date: '19/2/2026',
                interval: 'WEEKLY',
                preferredComs: 'EMAIL',
                reason: 'Back on supervision',
              },
            },
          },
        },
      }
      const req = baseReq(data)
      await controllers.checkIns.postRestartSummaryPage(hmppsAuthClient)(req, res)

      expect(postReactivateOffenderSpy).toHaveBeenCalledWith(
        uuid,
        expect.objectContaining({
          requestedBy: res.locals.user.username,
          checkinSchedule: expect.objectContaining({
            requestedBy: res.locals.user.username,
            firstCheckin: '2026-02-19',
          }),
          contactPreference: expect.objectContaining({
            requestedBy: res.locals.user.username,
            contactPreference: 'EMAIL',
          }),
        }),
      )
      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-confirmation`)
    })
    it('redirects to restart start page if session data is missing', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const req = baseReq({})
      await controllers.checkIns.postRestartSummaryPage(hmppsAuthClient)(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}/restart-checkin`)
    })

    it('renders 500 error page if reactivate API call fails', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const data = { esupervision: { [crn]: { [uuid]: { restartCheckin: { date: '19/2/2026' } } } } }
      const req = baseReq(data)

      postReactivateOffenderSpy.mockRejectedValueOnce(new Error('API failure'))

      await controllers.checkIns.postRestartSummaryPage(hmppsAuthClient)(req, res)

      expect(mockRenderError).toHaveBeenCalledWith(500)
      expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
    })
  })

  describe('getRestartConfirmation', () => {
    it('renders restart confirmation and clears session data', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      const data = {
        esupervision: {
          [crn]: {
            [uuid]: {
              restartCheckin: {
                date: '19/2/2026',
                interval: 'WEEKLY',
                preferredComs: 'EMAIL',
                checkInEmail: 'test@example.com',
              },
            },
          },
        },
      }
      const req = baseReq(data)

      await controllers.checkIns.getRestartConfirmation(hmppsAuthClient)(req, res)
      expect(renderSpy).toHaveBeenCalledWith(
        'pages/check-in/manage/restart-confirmation.njk',
        expect.objectContaining({
          userDetails: expect.objectContaining({
            displayDay: 'Thursday',
          }),
        }),
      )
      expect(mockSetDataValue).toHaveBeenCalledWith(
        req.session.data,
        ['esupervision', crn, uuid, 'restartCheckin'],
        undefined,
      )
    })
    it('redirects to manage page if saved restart details are missing', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)

      const req = baseReq({})
      await controllers.checkIns.getRestartConfirmation(hmppsAuthClient)(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
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
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ADD_CHECK_IN_QUESTIONS_START', crn, SubjectType.CRN)
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
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_CHECK_IN_ADD_QUESTIONS', crn, SubjectType.CRN)
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
        checkSendAuditMessage(
          res,
          'VIEW_MANAGE_ONLINE_CHECK_INS_PREVIEW_FEELING_CHECK_IN_QUESTIONS',
          crn,
          SubjectType.CRN,
        )
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
        checkSendAuditMessage(
          res,
          'VIEW_MANAGE_ONLINE_CHECK_INS_PREVIEW_SUPPORT_CHECK_IN_QUESTIONS',
          crn,
          SubjectType.CRN,
        )
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
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_LIST_CHECK_IN_LIST_QUESTIONS', crn, SubjectType.CRN)
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
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ADD_CHECK_IN_QUESTIONS_EDIT', crn, SubjectType.CRN)
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
        checkSendAuditMessage(res, 'VIEW_MANAGE_ONLINE_CHECK_INS_ADD_CHECK_IN_QUESTIONS_DELETE', crn, SubjectType.CRN)
      })
    })
  })
})
