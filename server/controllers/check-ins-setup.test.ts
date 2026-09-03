import httpMocks from 'node-mocks-http'
import controllers from '.'
import mockAppResponse from './mocks/appResponse'
import HmppsAuthClient from '../data/hmppsAuthClient'
import ESupervisionClient from '../data/eSupervisionClient'
import config from '../config'
import { getOffenderEligibility } from '../data/mockAccreditedProgramme'

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'f1654ea3-0abb-46eb-860b-654a96edbe20'),
}))

jest.mock('../../logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }))
jest.mock('../data/eSupervisionClient')
jest.mock('@ministryofjustice/hmpps-audit-client')
jest.mock('../data/hmppsAuthClient', () => {
  return jest.fn().mockImplementation(() => ({
    getSystemClientToken: jest.fn().mockResolvedValue('token-1'),
  }))
})
jest.mock('../data/mockAccreditedProgramme', () => ({
  getOffenderEligibility: jest.fn(),
}))

const crn = 'X000001'
const id = '11111111-1111-4111-8111-111111111111'
const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>

const requestFor = (body: Record<string, unknown> = {}, session: Record<string, unknown> = {}) =>
  httpMocks.createRequest({ params: { crn, id }, body, session, query: {} })

describe('check-in setup flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(getOffenderEligibility as jest.Mock).mockResolvedValue({ accreditedProgramme: true, tierA: true, tierB: true })
  })

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

  describe('eligibility check v2 flag', () => {
    afterEach(() => {
      config.eligibilityCheckV2Enabled = false
    })

    it('sends new setups to the instructions page when the flag is on', async () => {
      config.eligibilityCheckV2Enabled = true
      const req = requestFor()
      const res = mockAppResponse()
      await controllers.checkIns.getStartSetup()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^/case/${crn}/appointments/[\\w-]+/check-in/instructions$`)),
      )
    })

    it('renders the instructions template via the dedicated controller when the flag is on', async () => {
      ;(ESupervisionClient as jest.Mock).mockImplementation(() => ({
        getProbationPractitioner: jest.fn().mockResolvedValue({ unallocated: false }),
      }))
      const req = requestFor()
      const res = mockAppResponse()
      await controllers.checkIns.getInstructionsPage(hmppsAuthClient)(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/instructions.njk',
        expect.objectContaining({ crn, id, accreditedProgramme: true }),
      )
    })

    it('does not show the accredited programme content when in Tier A/B but not on an accredited programme', async () => {
      ;(ESupervisionClient as jest.Mock).mockImplementation(() => ({
        getProbationPractitioner: jest.fn().mockResolvedValue({ unallocated: false }),
      }))
      ;(getOffenderEligibility as jest.Mock).mockResolvedValue({
        accreditedProgramme: false,
        tierA: true,
        tierB: false,
      })
      const req = requestFor()
      const res = mockAppResponse()
      await controllers.checkIns.getInstructionsPage(hmppsAuthClient)(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/instructions.njk',
        expect.objectContaining({ crn, id, accreditedProgramme: false }),
      )
    })

    it('still renders the original template via the original controller when the flag is off', async () => {
      ;(ESupervisionClient as jest.Mock).mockImplementation(() => ({
        getProbationPractitioner: jest.fn().mockResolvedValue({ unallocated: false }),
      }))
      const req = requestFor()
      const res = mockAppResponse()
      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility-check.njk',
        expect.objectContaining({ crn, id }),
      )
    })

    it('goes to the accredited programme approval step when on an accredited programme and in Tier A or B', async () => {
      const req = requestFor()
      const res = mockAppResponse()
      await controllers.checkIns.postInstructionsPage()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(
        `/case/${crn}/appointments/${id}/check-in/accredited-programme-approval`,
      )
    })

    it.each([
      ['accredited programme but not in Tier A or B', { accreditedProgramme: true, tierA: false, tierB: false }],
      ['in Tier A but not on an accredited programme', { accreditedProgramme: false, tierA: true, tierB: false }],
      ['in Tier B but not on an accredited programme', { accreditedProgramme: false, tierA: false, tierB: true }],
    ])('skips the accredited programme approval step when %s', async (_description, eligibility) => {
      ;(getOffenderEligibility as jest.Mock).mockResolvedValue(eligibility)
      const req = requestFor()
      const res = mockAppResponse()
      await controllers.checkIns.postInstructionsPage()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/rationale`)
    })

    it('renders the accredited programme approval template via the dedicated controller', async () => {
      const req = requestFor()
      const res = mockAppResponse()
      await controllers.checkIns.getAccreditedProgrammeApprovalPage()(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/accredited-programme-approval.njk',
        expect.objectContaining({ crn, id }),
      )
    })

    it('still renders the original spo-approval template via the original controller', async () => {
      const req = requestFor()
      const res = mockAppResponse()
      await controllers.checkIns.getSPOApprovalPage()(req, res)
      expect(res.render).toHaveBeenCalledWith('pages/check-in/spo-approval.njk', expect.objectContaining({ crn, id }))
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

    describe('with the eligibility check v2 flag on', () => {
      afterEach(() => {
        config.eligibilityCheckV2Enabled = false
      })

      it('retraces the accredited programme approval branch and shows its hint', async () => {
        config.eligibilityCheckV2Enabled = true
        const req = httpMocks.createRequest({
          params: { crn, id },
          query: {},
          session: { data: { esupervision: { [crn]: { [id]: { checkins: { accreditedProgramme: true } } } } } },
        })
        const res = mockAppResponse()
        await controllers.checkIns.getRationalePage()(req, res)
        const renderedLocals = (res.render as jest.Mock).mock.calls[0][1]
        expect(renderedLocals.backLink).toBe(`/case/${crn}/appointments/${id}/check-in/accredited-programme-approval`)
        expect(renderedLocals.accreditedProgramme).toBe(true)
      })

      it('retraces the instructions page and hides the accredited programme hint when not on the programme', async () => {
        config.eligibilityCheckV2Enabled = true
        const req = httpMocks.createRequest({
          params: { crn, id },
          query: {},
          session: { data: { esupervision: { [crn]: { [id]: { checkins: { accreditedProgramme: false } } } } } },
        })
        const res = mockAppResponse()
        await controllers.checkIns.getRationalePage()(req, res)
        const renderedLocals = (res.render as jest.Mock).mock.calls[0][1]
        expect(renderedLocals.backLink).toBe(`/case/${crn}/appointments/${id}/check-in/instructions`)
        expect(renderedLocals.accreditedProgramme).toBeFalsy()
      })
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

  describe('checkin summary', () => {
    it('renders the check-your-answers page for an in-progress setup', async () => {
      const req = requestFor(
        {},
        { data: { esupervision: { [crn]: { [id]: { checkins: { photoUploadOption: 'TAKE_A_PIC' } } } } } },
      )
      const res = mockAppResponse()
      await controllers.checkIns.getCheckinSummaryPage()(req, res)
      expect(res.render).toHaveBeenCalledWith('pages/check-in/checkin-summary.njk', expect.anything())
    })

    it('redirects to the check-in overview instead of re-showing stale answers once setup has completed', async () => {
      const req = requestFor(
        {},
        {
          data: {
            esupervision: {
              [crn]: {
                [id]: {
                  checkins: { photoUploadOption: 'TAKE_A_PIC', completed: true, activeId: 'active-id-1' },
                },
              },
            },
          },
        },
      )
      const res = mockAppResponse()
      await controllers.checkIns.getCheckinSummaryPage()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage/active-id-1`)
      expect(res.render).not.toHaveBeenCalled()
    })

    it('falls back to the id-less overview when no activeId was recorded', async () => {
      const req = requestFor(
        {},
        {
          data: {
            esupervision: { [crn]: { [id]: { checkins: { photoUploadOption: 'TAKE_A_PIC', completed: true } } } },
          },
        },
      )
      const res = mockAppResponse()
      await controllers.checkIns.getCheckinSummaryPage()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/check-in/manage`)
    })
  })

  describe('postConfirmEnd', () => {
    it('completes setup and redirects to the GET confirmation page', async () => {
      const postOffenderSetupComplete = jest.fn().mockResolvedValue({})
      ;(ESupervisionClient as jest.Mock).mockImplementation(() => ({ postOffenderSetupComplete }))

      const req = requestFor()
      const res = mockAppResponse()
      await controllers.checkIns.postConfirmEnd(hmppsAuthClient)(req, res)

      expect(postOffenderSetupComplete).toHaveBeenCalledWith(id)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/confirm-end`)
    })

    it('renders a 404 and does not complete setup when the crn or id is invalid', async () => {
      const postOffenderSetupComplete = jest.fn()
      ;(ESupervisionClient as jest.Mock).mockImplementation(() => ({ postOffenderSetupComplete }))

      const req = httpMocks.createRequest({ params: { crn: 'not-a-crn', id }, session: {}, query: {} })
      const res = mockAppResponse()
      await controllers.checkIns.postConfirmEnd(hmppsAuthClient)(req, res)

      expect(postOffenderSetupComplete).not.toHaveBeenCalled()
      expect(res.redirect).not.toHaveBeenCalled()
      expect(res.status).toHaveBeenCalledWith(404)
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
