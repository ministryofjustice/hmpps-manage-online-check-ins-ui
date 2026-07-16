import nock from 'nock'
import config from '../config'
import { isValidHost } from '../utils/isValidHost'
import { isValidPath } from '../utils/isValidPath'

import {
  DeactivateOffenderRequest,
  EsupervisionAssignQuestionsRequest,
  EsupervisionAssignQuestionsResponse,
  ESupervisionCheckIn,
  EsupervisionUpcomingQuestionItemsResponse,
  EsupervisionUpcomingQuestionsResponse,
  OffenderCheckinsByCRNResponse,
} from './model/esupervision'

import ESupervisionClient from './eSupervisionClient'
import { esupervisionAdditionalQuestions } from '../controllers/mocks/esupervisionAdditionalQuestions'

jest.mock('../utils/isValidHost', () => ({ isValidHost: jest.fn() }))
jest.mock('../utils/isValidPath', () => ({ isValidPath: jest.fn() }))

const mockedIsValidHost = isValidHost as jest.MockedFunction<typeof isValidHost>
const mockedIsValidPath = isValidPath as jest.MockedFunction<typeof isValidPath>

const token = { access_token: 'token-1', expires_in: 300 }

describe('ESupervisionClient', () => {
  let fakeESupervisionApi: nock.Scope
  let client: ESupervisionClient

  beforeEach(() => {
    jest.clearAllMocks()
    mockedIsValidHost.mockReturnValue(true)
    mockedIsValidPath.mockReturnValue(true)
    fakeESupervisionApi = nock(config.apis.eSupervisionApi.url)
    client = new ESupervisionClient(token.access_token)
  })

  afterEach(() => {
    jest.resetAllMocks()
    nock.cleanAll() // Removes all interceptors
    nock.restore() // Restores http/https modules
    nock.activate() // Re-activate for the next test
  })

  describe('getOffenderCheckIn', () => {
    it('should GET offender check-in with personal details by default', async () => {
      const checkInUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

      const response = {
        uuid: checkInUuid,
        status: 'SUBMITTED',
      } as ESupervisionCheckIn

      fakeESupervisionApi
        .get(`/v2/offender_checkins/${checkInUuid}`)
        .query({
          'include-personal-details': 'true',
        })
        .matchHeader('authorization', `Bearer ${token.access_token}`)
        .reply(200, response)

      const output = await client.getOffenderCheckIn(checkInUuid)

      expect(output).toEqual(response)
    })

    it('should GET offender check-in without personal details when requested', async () => {
      const checkInUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

      const response = {
        uuid: checkInUuid,
        status: 'SUBMITTED',
      } as ESupervisionCheckIn

      fakeESupervisionApi
        .get(`/v2/offender_checkins/${checkInUuid}`)
        .query({
          'include-personal-details': 'false',
        })
        .matchHeader('authorization', `Bearer ${token.access_token}`)
        .reply(200, response)

      const output = await client.getOffenderCheckIn(checkInUuid, false)

      expect(output).toEqual(response)
    })
  })

  describe('getOffenderByCRN', () => {
    it('should GET offender details by CRN', async () => {
      const crn = 'X000001'

      const response = {
        uuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
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

      fakeESupervisionApi
        .get(`/v2/offenders/crn/${crn}`)
        .query({
          'include-personal-details': 'true',
        })
        .matchHeader('authorization', `Bearer ${token.access_token}`)
        .reply(200, response)

      const output = await client.getOffenderByCRN(crn)

      expect(output).toEqual(response)
    })

    it('should return null when offender details by CRN returns 404', async () => {
      const crn = 'X000001'

      fakeESupervisionApi
        .get(`/v2/offenders/crn/${crn}`)
        .query({
          'include-personal-details': 'true',
        })
        .matchHeader('authorization', `Bearer ${token.access_token}`)
        .reply(404)

      const output = await client.getOffenderByCRN(crn)

      expect(output).toBeNull()
    })
  })

  describe('postDeactivateOffender', () => {
    it('should POST deactivate offender', async () => {
      const checkInUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6'

      const body: DeactivateOffenderRequest = {
        requestedBy: 'requestedBy',
        reason: 'reason',
        sensitive: true,
      }

      const response = {}

      fakeESupervisionApi
        .post(`/v2/offenders/${checkInUuid}/deactivate`)
        .matchHeader('authorization', `Bearer ${token.access_token}`)
        .reply(200, response)

      const output = await client.postDeactivateOffender(checkInUuid, body)
      expect(output).toEqual(response)
    })
  })

  describe('getQuestionsTemplates', () => {
    it('should get questions templates', async () => {
      const response = esupervisionAdditionalQuestions

      fakeESupervisionApi
        .get(`/v2/questions/templates?language=en-GB`)
        .matchHeader('authorization', `Bearer ${token.access_token}`)
        .reply(200, response)

      const output = await client.getQuestionsTemplates()
      expect(output).toEqual(response)
    })
  })

  describe('getUpcomingCheckinQuestions', () => {
    it('should get upcoming questions items', async () => {
      const crn = 'X000001'
      const response: EsupervisionUpcomingQuestionsResponse = {
        expectedCheckinDate: '',
        questions: [],
      }

      fakeESupervisionApi
        .get(`/v2/questions/upcoming/${crn}/offender-questions?language=en-GB`)
        .matchHeader('authorization', `Bearer ${token.access_token}`)
        .reply(200, response)

      const output = await client.getUpcomingCheckinQuestions(crn)
      expect(output).toEqual(response)
    })
  })

  describe('getUpcomingCheckinQuestionItems', () => {
    it('should get upcoming question items', async () => {
      const crn = 'X000001'
      const response: EsupervisionUpcomingQuestionItemsResponse = {
        upcoming: {
          expectedCheckinDate: '',
          items: [],
        },
      }

      fakeESupervisionApi
        .get(`/v2/questions/upcoming/${crn}/question-items?language=en-GB`)
        .matchHeader('authorization', `Bearer ${token.access_token}`)
        .reply(200, response)

      const output = await client.getUpcomingCheckinQuestionItems(crn)
      expect(output).toEqual(response)
    })
  })

  describe('putAssignQuestionsToCheckIn', () => {
    it('should assign questions to check in', async () => {
      const crn = 'X000001'
      const request: EsupervisionAssignQuestionsRequest = {
        questions: [],
        language: 'en-GB',
        author: 'SYSTEM',
      }

      const response: EsupervisionAssignQuestionsResponse = {
        expectedCheckinDate: '',
        listId: 3,
      }
      fakeESupervisionApi
        .put(`/v2/questions/assignment?crn=${crn}`, request as Record<string, any>)
        .matchHeader('authorization', `Bearer ${token.access_token}`)
        .reply(200, response)

      const output = await client.putAssignQuestionsToCheckIn(crn, request)
      expect(output).toEqual(response)
    })
  })

  describe('deleteAssignedQuestionsFromCheckIn', () => {
    it('should delete assigned questions to check in', async () => {
      const crn = 'X000001'

      const response = { message: 'deleted' }

      fakeESupervisionApi
        .delete(`/v2/questions/assignment?crn=${crn}`)
        .matchHeader('authorization', `Bearer ${token.access_token}`)
        .reply(200, response)

      const output = await client.deleteAssignedQuestionsFromCheckIn(crn)
      expect(output).toEqual(response)
    })
  })
})
