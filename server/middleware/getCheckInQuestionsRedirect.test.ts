import httpMocks from 'node-mocks-http'
import HmppsAuthClient from '../data/hmppsAuthClient'
import ESupervisionClient from '../data/eSupervisionClient'
import { getCheckInQuestionsRedirect } from './getCheckInQuestionsRedirect'
import mockAppResponse from '../controllers/mocks/appResponse'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import renderError from './renderError'

jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

jest.mock('../data/eSupervisionClient')
jest.mock('../data/tokenStore/redisTokenStore')

const mockMiddlewareFn = jest.fn()
jest.mock('./renderError', () => jest.fn(() => mockMiddlewareFn))

jest.mock('../utils/isValidCrn', () => jest.fn())
jest.mock('../utils/isValidUUID', () => jest.fn())
jest.mock('../utils/setDataValue', () => jest.fn())
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20'),
}))

jest.mock('../data/hmppsAuthClient', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getSystemClientToken: jest.fn().mockImplementation(() => Promise.resolve('token-1')),
    }
  })
})

const mockGetUpcomingCheckinQuestions = jest
  .spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions')
  .mockImplementation(async () => null)

const mockIsValidCrn = isValidCrn as jest.MockedFunction<typeof isValidCrn>
const mockIsValidUUID = isValidUUID as jest.MockedFunction<typeof isValidUUID>
const mockRenderError = renderError as jest.MockedFunction<typeof renderError>

const crn = 'X000001'
const uuid = 'f1654ea3-0abb-46eb-860b-654a96edbe20'

const res = mockAppResponse()
const redirectSpy = jest.spyOn(res, 'redirect')
const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>

describe('getCheckInQuestionsRedirect', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockIsValidCrn.mockReturnValue(true)
    mockIsValidUUID.mockReturnValue(true)
  })

  it('calls next when the check in date is strictly in the future', async () => {
    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 5)
    mockGetUpcomingCheckinQuestions.mockResolvedValue({
      expectedCheckinDate: futureDate.toISOString(),
      questions: [],
    })

    const req = httpMocks.createRequest({ params: { crn, id: uuid } })
    const nextSpy = jest.fn()

    await getCheckInQuestionsRedirect(hmppsAuthClient)(req, res, nextSpy)

    expect(nextSpy).toHaveBeenCalledTimes(1)
    expect(redirectSpy).not.toHaveBeenCalled()
  })

  it('redirects to manage page when the check in is today', async () => {
    const today = new Date()
    mockGetUpcomingCheckinQuestions.mockResolvedValue({
      expectedCheckinDate: today.toISOString(),
      questions: [],
    })

    const req = httpMocks.createRequest({ params: { crn, id: uuid } })
    const nextSpy = jest.fn()

    await getCheckInQuestionsRedirect(hmppsAuthClient)(req, res, nextSpy)

    expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
    expect(nextSpy).not.toHaveBeenCalled()
  })

  it('redirects to manage page when the check in is in the past', async () => {
    const pastDate = new Date()
    pastDate.setDate(pastDate.getDate() - 2)
    mockGetUpcomingCheckinQuestions.mockResolvedValue({
      expectedCheckinDate: pastDate.toISOString(),
      questions: [],
    })

    const req = httpMocks.createRequest({ params: { crn, id: uuid } })
    const nextSpy = jest.fn()

    await getCheckInQuestionsRedirect(hmppsAuthClient)(req, res, nextSpy)

    expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
    expect(nextSpy).not.toHaveBeenCalled()
  })

  it('redirects to manage page when the API returns null', async () => {
    mockGetUpcomingCheckinQuestions.mockResolvedValue(null)

    const req = httpMocks.createRequest({ params: { crn, id: uuid } })
    const nextSpy = jest.fn()

    await getCheckInQuestionsRedirect(hmppsAuthClient)(req, res, nextSpy)

    expect(redirectSpy).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/${uuid}`)
    expect(nextSpy).not.toHaveBeenCalled()
  })
})
