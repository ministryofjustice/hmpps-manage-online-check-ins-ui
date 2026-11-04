import httpMocks from 'node-mocks-http'
import HmppsAuthClient from '../data/hmppsAuthClient'
import ESupervisionClient from '../data/eSupervisionClient'
import getCancellableCheckin from './getCancellableCheckin'
import mockAppResponse from '../controllers/mocks/appResponse'
import { EsupervisionUpcomingQuestionsResponse, OffenderByCRNResponse } from '../data/model/esupervision'

jest.mock('../data/eSupervisionClient')

jest.mock('../data/hmppsAuthClient', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getSystemClientToken: jest.fn().mockImplementation(() => Promise.resolve('token-1')),
    }
  })
})

const getUpcomingCheckinQuestions = jest.spyOn(ESupervisionClient.prototype, 'getUpcomingCheckinQuestions')

const crn = 'X000001'
const offenderUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa7'
const checkinUuid = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>

const offender = {
  uuid: offenderUuid,
  crn,
  status: 'VERIFIED',
  contactPreference: 'PHONE',
} as OffenderByCRNResponse

const upcoming = (
  extra: Partial<EsupervisionUpcomingQuestionsResponse> = {},
): EsupervisionUpcomingQuestionsResponse => ({
  expectedCheckinDate: '2026-11-04',
  questions: [],
  ...extra,
})

describe('getCancellableCheckin', () => {
  let res: ReturnType<typeof mockAppResponse>
  let next: jest.Mock
  const req = httpMocks.createRequest({ params: { crn, id: offenderUuid } })

  beforeEach(() => {
    jest.clearAllMocks()
    res = mockAppResponse()
    res.locals.offenderCheckinsByCRNResponse = offender
    next = jest.fn()
  })

  it("attaches the person's upcoming check-in, keeps the questions response, and calls next()", async () => {
    const response = upcoming({ checkinUuid })
    getUpcomingCheckinQuestions.mockResolvedValue(response)

    await getCancellableCheckin(hmppsAuthClient)(req, res, next)

    expect(hmppsAuthClient.getSystemClientToken).toHaveBeenCalledWith('user-1')
    expect(getUpcomingCheckinQuestions).toHaveBeenCalledWith(crn)
    expect(res.locals.cancellableCheckin).toEqual({ uuid: checkinUuid })
    expect(res.locals.upcomingCheckin).toBe(response)
    expect(next).toHaveBeenCalled()
  })

  it('attaches null when the upcoming check-in does not exist yet', async () => {
    getUpcomingCheckinQuestions.mockResolvedValue(upcoming())

    await getCancellableCheckin(hmppsAuthClient)(req, res, next)

    expect(res.locals.cancellableCheckin).toBeNull()
    expect(res.locals.upcomingCheckin).toEqual(upcoming())
    expect(next).toHaveBeenCalled()
  })

  it('attaches null when the API has nothing upcoming for the person', async () => {
    getUpcomingCheckinQuestions.mockRejectedValue(Object.assign(new Error('Not found'), { status: 404 }))

    await getCancellableCheckin(hmppsAuthClient)(req, res, next)

    expect(res.locals.cancellableCheckin).toBeNull()
    expect(res.locals.upcomingCheckin).toBeNull()
    expect(next).toHaveBeenCalled()
  })

  it('does not look for a check-in when the person is not verified', async () => {
    res.locals.offenderCheckinsByCRNResponse = { ...offender, status: 'INACTIVE' }

    await getCancellableCheckin(hmppsAuthClient)(req, res, next)

    expect(getUpcomingCheckinQuestions).not.toHaveBeenCalled()
    expect(res.locals.cancellableCheckin).toBeNull()
    expect(res.locals.upcomingCheckin).toBeUndefined()
    expect(next).toHaveBeenCalled()
  })

  it('does not look for a check-in when there is no offender record', async () => {
    res.locals.offenderCheckinsByCRNResponse = undefined

    await getCancellableCheckin(hmppsAuthClient)(req, res, next)

    expect(getUpcomingCheckinQuestions).not.toHaveBeenCalled()
    expect(res.locals.cancellableCheckin).toBeNull()
    expect(next).toHaveBeenCalled()
  })
})
