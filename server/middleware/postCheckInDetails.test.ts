import httpMocks from 'node-mocks-http'
import HmppsAuthClient from '../data/hmppsAuthClient'
import ESupervisionClient from '../data/eSupervisionClient'
import { postCheckInDetails } from './postCheckInDetails'
import mockAppResponse from '../controllers/mocks/appResponse'
import { OffenderSetup, UploadLocationResponse } from '../data/model/esupervision'
import { CachedPersonalDetails } from '../data/Data'

jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}))

jest.mock('../data/eSupervisionClient')

jest.mock('../data/hmppsAuthClient', () => {
  return jest.fn().mockImplementation(() => {
    return {
      getSystemClientToken: jest.fn().mockImplementation(() => Promise.resolve('token-1')),
    }
  })
})

const mockGetProbationPractitioner = jest.spyOn(ESupervisionClient.prototype, 'getProbationPractitioner')
const mockPostOffenderSetup = jest.spyOn(ESupervisionClient.prototype, 'postOffenderSetup')
const mockGetProfilePhotoUploadLocation = jest.spyOn(ESupervisionClient.prototype, 'getProfilePhotoUploadLocation')

const crn = 'X000001'
const id = '3fa85f64-5717-4562-b3fc-2c963f66afa6'
const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>

const cachedPersonalDetails = {
  offenderDetails: null,
  practitionerDetails: null,
  headerDetails: null,
  riskData: { assessments: [] },
} as CachedPersonalDetails

const buildRequest = () =>
  httpMocks.createRequest({
    params: { crn, id },
    body: { contentSha256: 'YWJjMTIz' },
    session: {
      data: {
        esupervision: {
          [crn]: {
            [id]: {
              checkins: {
                date: '1/8/2026',
                interval: 'WEEKLY',
                preferredComs: 'PHONE',
                eligibilityChoice: [],
                rationale: 'Stable and low risk',
              },
            },
          },
        },
        personalDetails: {
          [crn]: cachedPersonalDetails,
        },
      },
    },
  })

describe('postCheckInDetails', () => {
  let res: ReturnType<typeof mockAppResponse>

  beforeEach(() => {
    jest.clearAllMocks()
    res = mockAppResponse()
    mockGetProbationPractitioner.mockResolvedValue({
      code: 'ABC123',
      name: { forename: 'Jane', surname: 'Doe' },
      unallocated: false,
      username: 'jane.doe',
    })
    mockPostOffenderSetup.mockResolvedValue({ uuid: id } as OffenderSetup)
    mockGetProfilePhotoUploadLocation.mockResolvedValue({} as UploadLocationResponse)
  })

  it('clears the cached personal details for the CRN once setup completes', async () => {
    const req = buildRequest()

    await postCheckInDetails(hmppsAuthClient)(req, res)

    expect(req.session.data.personalDetails[crn]).toBeUndefined()
  })

  it('leaves the cache untouched when setup fails', async () => {
    mockPostOffenderSetup.mockRejectedValue(Object.assign(new Error('boom'), { data: { status: 500 } }))
    const req = buildRequest()

    await expect(postCheckInDetails(hmppsAuthClient)(req, res)).rejects.toThrow('boom')

    expect(req.session.data.personalDetails[crn]).toEqual(cachedPersonalDetails)
  })
})
