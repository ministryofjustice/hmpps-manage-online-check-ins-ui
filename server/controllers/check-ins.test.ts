import httpMocks from 'node-mocks-http'
import controllers from '.'

import { CheckinScheduleResponse, OffenderCheckinsByCRNResponse } from '../data/model/esupervision'
import ESupervisionClient from '../data/eSupervisionClient'
import mockAppResponse from './mocks/appResponse'
import HmppsAuthClient from '../data/hmppsAuthClient'
import renderError from '../middleware/renderError'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'
import config from '../config'

jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

const mockMiddlewareFn = jest.fn()

jest.mock('../middleware/renderError', () => jest.fn(() => mockMiddlewareFn))
jest.mock('../utils/isValidCrn', () => jest.fn())
jest.mock('../utils/isValidUUID', () => jest.fn())
jest.mock('../utils/getDataValue', () => jest.fn())
jest.mock('../utils/setDataValue', () => jest.fn())
jest.mock('../data/eSupervisionClient')

jest.mock('../data/hmppsAuthClient', () => {
  return jest.fn().mockImplementation(() => ({
    getSystemClientToken: jest.fn().mockResolvedValue('token-1'),
  }))
})

jest.mock('../config', () => {
  const actualConfig = jest.requireActual('../config').default

  return {
    ...actualConfig,
    managePeopleOnProbation: {
      ...actualConfig.managePeopleOnProbation,
      link: 'https://manage-people-on-probation-dev.hmpps.service.justice.gov.uk',
    },
  }
})

const postDeactivateOffender = jest
  .spyOn(ESupervisionClient.prototype, 'postDeactivateOffender')
  .mockImplementation(() => Promise.resolve({} as CheckinScheduleResponse))

const mockIsValidCrn = isValidCrn as jest.MockedFunction<typeof isValidCrn>
const mockIsValidUUID = isValidUUID as jest.MockedFunction<typeof isValidUUID>
const mockRenderError = renderError as jest.MockedFunction<typeof renderError>
const mockGetDataValue = getDataValue as jest.MockedFunction<typeof getDataValue>
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

    it('returns 404 when CRN is invalid', async () => {
      mockIsValidCrn.mockReturnValue(false)
      mockIsValidUUID.mockReturnValue(true)

      const req = baseReq()

      await controllers.checkIns.getStopCheckinPage(hmppsAuthClient)(req, res)

      expect(mockRenderError).toHaveBeenCalledWith(404)
      expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
    })

    it('returns 404 when id is not a valid UUID', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(false)

      const req = baseReq()

      await controllers.checkIns.getStopCheckinPage(hmppsAuthClient)(req, res)

      expect(mockRenderError).toHaveBeenCalledWith(404)
      expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
    })
  })

  describe('postManageStopCheckin', () => {
    it('returns 404 when CRN or id invalid', async () => {
      mockIsValidCrn.mockReturnValue(false)
      mockIsValidUUID.mockReturnValue(true)

      const req = baseReq()

      await controllers.checkIns.postManageStopCheckin(hmppsAuthClient)(req, res)

      expect(mockRenderError).toHaveBeenCalledWith(404)
      expect(mockMiddlewareFn).toHaveBeenCalledWith(req, res)
    })

    it('redirects to manage people on probation case page', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      mockGetDataValue.mockReturnValueOnce('Reason for stopping check in').mockReturnValueOnce('false')

      const req = baseReq()

      await controllers.checkIns.postManageStopCheckin(hmppsAuthClient)(req, res)

      expect(redirectSpy).toHaveBeenCalledWith(
        303,
        `https://manage-people-on-probation-dev.hmpps.service.justice.gov.uk/case/${crn}`,
      )
    })

    it('stops check in, clears session data and redirects', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      mockGetDataValue.mockReturnValueOnce('Reason for stopping check in').mockReturnValueOnce('true')

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

      expect(redirectSpy).toHaveBeenCalledWith(
        303,
        `https://manage-people-on-probation-dev.hmpps.service.justice.gov.uk/case/${crn}`,
      )
    })

    it('escapes double quotes in the reason', async () => {
      mockIsValidCrn.mockReturnValue(true)
      mockIsValidUUID.mockReturnValue(true)
      mockGetDataValue.mockReturnValueOnce('Reason with "quotes"').mockReturnValueOnce('false')

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
})
