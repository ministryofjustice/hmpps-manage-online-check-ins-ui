import httpMocks from 'node-mocks-http'
import controllers from '.'
import mockAppResponse from './mocks/appResponse'
import HmppsAuthClient from '../data/hmppsAuthClient'
import ESupervisionClient from '../data/eSupervisionClient'

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20'),
}))

jest.mock('../../logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }))
jest.mock('../data/eSupervisionClient')
jest.mock('../data/hmppsAuthClient', () => {
  return jest.fn().mockImplementation(() => ({
    getSystemClientToken: jest.fn().mockResolvedValue('token-1'),
  }))
})

const crn = 'X000001'
const id = '11111111-1111-4111-8111-111111111111'
const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>

const requestFor = (body: Record<string, unknown> = {}, session: Record<string, unknown> = {}) =>
  httpMocks.createRequest({ params: { crn, id }, body, session, query: {} })

describe('check-in setup flow', () => {
  beforeEach(() => jest.clearAllMocks())

  describe('eligibility branching', () => {
    const postEligibility = async (eligibility: string | string[]) => {
      const req = requestFor({ esupervision: { [crn]: { [id]: { checkins: { eligibility } } } } })
      const res = mockAppResponse()
      await controllers.checkIns.postEligibilityPage()(req, res)
      return (res.redirect as jest.Mock).mock.calls[0][0]
    }

    it('sends Intensive Supervision Court pilot cases to the denied page', async () => {
      expect(await postEligibility(['eligibility-9'])).toBe(
        `/case/${crn}/appointments/${id}/check-in/denied-eligibility`,
      )
    })

    it('sends people with no criteria to the full eligibility page', async () => {
      expect(await postEligibility(['eligibility-none'])).toBe(
        `/case/${crn}/appointments/${id}/check-in/full-eligibility`,
      )
    })

    it('sends people with any other criterion to the supplementary page', async () => {
      expect(await postEligibility(['eligibility-2'])).toBe(
        `/case/${crn}/appointments/${id}/check-in/supplementary-eligibility`,
      )
    })

    it('prefers the denied page when the pilot is selected alongside other criteria', async () => {
      expect(await postEligibility(['eligibility-2', 'eligibility-9'])).toBe(
        `/case/${crn}/appointments/${id}/check-in/denied-eligibility`,
      )
    })
  })

  describe('full eligibility', () => {
    const postFullEligibility = async (eligibilityChoice: string) => {
      const req = requestFor({}, { data: { esupervision: { [crn]: { [id]: { checkins: { eligibilityChoice } } } } } })
      const res = mockAppResponse()
      await controllers.checkIns.postFullEligibilityPage()(req, res)
      return (res.redirect as jest.Mock).mock.calls[0][0]
    }

    it('requires SPO approval when replacing face-to-face contact', async () => {
      expect(await postFullEligibility('REPLACE_F2F')).toBe(`/case/${crn}/appointments/${id}/check-in/spo-approval`)
    })

    it('skips SPO approval when supplementing face-to-face contact', async () => {
      expect(await postFullEligibility('SUPPLEMENT_F2F')).toBe(`/case/${crn}/appointments/${id}/check-in/rationale`)
    })
  })

  describe('rationale back link', () => {
    const backLinkFor = async (checkins: Record<string, unknown>, query: Record<string, string> = {}) => {
      const req = httpMocks.createRequest({
        params: { crn, id },
        query,
        session: { data: { esupervision: { [crn]: { [id]: { checkins } } } } },
      })
      const res = mockAppResponse()
      await controllers.checkIns.getRationalePage()(req, res)
      return (res.render as jest.Mock).mock.calls[0][1].backLink
    }

    it('retraces the SPO approval branch', async () => {
      expect(await backLinkFor({ eligibilityChoice: 'REPLACE_F2F' })).toBe(
        `/case/${crn}/appointments/${id}/check-in/spo-approval`,
      )
    })

    it('retraces the full eligibility branch', async () => {
      expect(await backLinkFor({ eligibility: ['eligibility-none'] })).toBe(
        `/case/${crn}/appointments/${id}/check-in/full-eligibility`,
      )
    })

    it('retraces the supplementary branch', async () => {
      expect(await backLinkFor({ eligibility: ['eligibility-2'] })).toBe(
        `/case/${crn}/appointments/${id}/check-in/supplementary-eligibility`,
      )
    })

    it('returns to the summary when following a change link', async () => {
      expect(await backLinkFor({ eligibilityChoice: 'REPLACE_F2F' }, { cya: 'true' })).toBe(
        `/case/${crn}/appointments/${id}/check-in/checkin-summary`,
      )
    })
  })

  describe('photo options', () => {
    const postPhotoOptions = async (photoUploadOption: string) => {
      const req = requestFor({}, { data: { esupervision: { [crn]: { [id]: { checkins: { photoUploadOption } } } } } })
      const res = mockAppResponse()
      await controllers.checkIns.postPhotoOptionsPage()(req, res)
      return (res.redirect as jest.Mock).mock.calls[0][0]
    }

    it('routes to the camera when taking a photo', async () => {
      expect(await postPhotoOptions('TAKE_A_PIC')).toBe(`/case/${crn}/appointments/${id}/check-in/take-a-photo`)
    })

    it('routes to the file upload otherwise', async () => {
      expect(await postPhotoOptions('UPLOAD_A_PIC')).toBe(`/case/${crn}/appointments/${id}/check-in/upload-a-photo`)
    })
  })

  describe('contact preference', () => {
    const postContactPreference = async (checkins: Record<string, unknown>) => {
      const req = requestFor({ change: 'main' }, { data: { esupervision: { [crn]: { [id]: { checkins } } } } })
      const res = mockAppResponse()
      await controllers.checkIns.postContactPreferencePage()(req, res)
      return (res.redirect as jest.Mock).mock.calls[0][0]
    }

    it('continues to the confirm page when the selected contact detail is on file', async () => {
      expect(await postContactPreference({ preferredComs: 'PHONE', checkInMobile: '07700900000' })).toBe(
        `/case/${crn}/appointments/${id}/check-in/confirm-contact-preference`,
      )
    })

    it('diverts to the edit page when the selected contact detail is missing', async () => {
      expect(await postContactPreference({ preferredComs: 'PHONE' })).toBe(
        `/case/${crn}/appointments/${id}/check-in/edit-contact-preference?change=mobile`,
      )
    })

    it('preserves cya as a well-formed query string when diverting to the edit page', async () => {
      const req = requestFor(
        { change: 'main' },
        { data: { esupervision: { [crn]: { [id]: { checkins: { preferredComs: 'PHONE' } } } } } },
      )
      req.query = { cya: 'true' }
      const res = mockAppResponse()
      await controllers.checkIns.postContactPreferencePage()(req, res)
      expect((res.redirect as jest.Mock).mock.calls[0][0]).toBe(
        `/case/${crn}/appointments/${id}/check-in/edit-contact-preference?change=mobile&cya=true`,
      )
    })

    it('preserves cya as a well-formed query string when continuing to the confirm page', async () => {
      const req = requestFor(
        { change: 'main' },
        {
          data: {
            esupervision: { [crn]: { [id]: { checkins: { preferredComs: 'PHONE', checkInMobile: '07700900000' } } } },
          },
        },
      )
      req.query = { cya: 'true' }
      const res = mockAppResponse()
      await controllers.checkIns.postContactPreferencePage()(req, res)
      expect((res.redirect as jest.Mock).mock.calls[0][0]).toBe(
        `/case/${crn}/appointments/${id}/check-in/confirm-contact-preference?cya=true`,
      )
    })
  })

  describe('unallocated cases', () => {
    it('are redirected away from the setup flow', async () => {
      ;(ESupervisionClient as jest.Mock).mockImplementation(() => ({
        getProbationPractitioner: jest.fn().mockResolvedValue({ unallocated: true }),
      }))
      const req = requestFor()
      const res = mockAppResponse()
      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments`)
    })
  })
})
