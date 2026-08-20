import httpMocks from 'node-mocks-http'
import HmppsAuthClient from '../data/hmppsAuthClient'
import ESupervisionClient from '../data/eSupervisionClient'
import getCheckIn from './getCheckIn'
import mockAppResponse from '../controllers/mocks/appResponse'
import { ESupervisionCheckIn } from '../data/model/esupervision'

jest.mock('../data/eSupervisionClient')

jest.mock('../data/hmppsAuthClient', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getSystemClientToken: jest.fn().mockImplementation(() => Promise.resolve('token-1')),
    }
  })
})

const mockGetOffenderCheckIn = jest.spyOn(ESupervisionClient.prototype, 'getOffenderCheckIn')

const crn = 'X000001'
const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>

describe('getCheckIn', () => {
  let res: ReturnType<typeof mockAppResponse>
  let next: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    res = mockAppResponse()
    next = jest.fn()
  })

  it('attaches the check-in to res.locals and calls next() when the CRN matches', async () => {
    const checkInResponse = {
      status: 'SUBMITTED',
      personalDetails: { crn },
      checkinLogs: { logs: [] },
    } as unknown as ESupervisionCheckIn
    mockGetOffenderCheckIn.mockResolvedValue(checkInResponse)

    const req = httpMocks.createRequest({ params: { crn, id } })

    await getCheckIn(hmppsAuthClient)(req, res, next)

    expect(res.locals.checkIn).toEqual(checkInResponse)
    expect(next).toHaveBeenCalled()
    expect(res.status).not.toHaveBeenCalled()
    expect(res.render).not.toHaveBeenCalled()
  })

  it('renders a 404 and does not call next() when the CRN does not match', async () => {
    const checkInResponse = {
      status: 'SUBMITTED',
      personalDetails: { crn: 'X000002' },
      checkinLogs: { logs: [] },
    } as unknown as ESupervisionCheckIn
    mockGetOffenderCheckIn.mockResolvedValue(checkInResponse)

    const req = httpMocks.createRequest({ params: { crn, id } })

    await getCheckIn(hmppsAuthClient)(req, res, next)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.render).toHaveBeenCalledWith('pages/error')
    expect(next).not.toHaveBeenCalled()
    expect(res.locals.checkIn).toBeUndefined()
  })
})
