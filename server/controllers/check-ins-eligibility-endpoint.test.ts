import httpMocks from 'node-mocks-http'
import controllers from '.'
import baseAppResponse from './mocks/appResponse'
import HmppsAuthClient from '../data/hmppsAuthClient'
import ESupervisionClient from '../data/eSupervisionClient'
import { EligibilityCheckResponse } from '../data/model/esupervision'

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

const crn = 'X000001'
const id = '11111111-1111-4111-8111-111111111111'
const hmppsAuthClient = new HmppsAuthClient(null) as jest.Mocked<HmppsAuthClient>
const root = `/case/${crn}/appointments/${id}/check-in`

const flaggedResponse = (tierScore: string, locals: Record<string, unknown> = {}) =>
  baseAppResponse({ tierScore, flags: { useEligibilityEndpoint: true }, ...locals })

const requestFor = (body: Record<string, unknown> = {}, checkins: Record<string, unknown> = {}) =>
  httpMocks.createRequest({
    params: { crn, id },
    body,
    session: { data: { esupervision: { [crn]: { [id]: { checkins } } } } },
    query: {},
  })

const eligibilityBody = (eligibility: string[]) => ({
  esupervision: { [crn]: { [id]: { checkins: { eligibility } } } },
})

let checkEligibility: jest.Mock
let getProbationPractitioner: jest.Mock

const givenCheck = (...responses: (EligibilityCheckResponse | null | Error)[]) => {
  responses.forEach(response =>
    response instanceof Error
      ? checkEligibility.mockRejectedValueOnce(response)
      : checkEligibility.mockResolvedValueOnce(response),
  )
}

const stored = (req: ReturnType<typeof requestFor>) => req.session.data.esupervision[crn][id].checkins

describe('eligibility journey with the useEligibilityEndpoint flag on', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    checkEligibility = jest.fn()
    getProbationPractitioner = jest.fn().mockResolvedValue({ unallocated: false, username: 'ALLOCATED.PP' })
    ;(ESupervisionClient as jest.Mock).mockImplementation(() => ({ checkEligibility, getProbationPractitioner }))
  })

  describe('eligibility-check page', () => {
    it('rules the person out before asking anything when the API can', async () => {
      givenCheck({ outcome: 'INELIGIBLE', message: 'Joe is recalled.', ruleCode: 'IS_RECALLED' })
      const req = requestFor()
      const res = flaggedResponse('D')

      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)

      expect(checkEligibility).toHaveBeenCalledWith(crn, { practitionerId: 'ALLOCATED.PP' })
      expect(res.redirect).toHaveBeenCalledWith(`${root}/not-eligible`)
      expect(stored(req).eligibilityCheck).toEqual({
        outcome: 'INELIGIBLE',
        message: 'Joe is recalled.',
        ruleCode: 'IS_RECALLED',
        answers: null,
      })
      expect(stored(req).tierBand).toBeUndefined()
    })

    it('asks the checkboxes, without recall, when the API needs answers', async () => {
      givenCheck({ outcome: 'UNKNOWN', message: 'Joe may be eligible.' })
      const req = requestFor()
      const res = flaggedResponse('B')

      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)

      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/eligibility-check.njk',
        expect.objectContaining({ tierBand: 'AB', askRecalled: false }),
      )
      expect(stored(req).tierBand).toBe('AB')
    })

    it('checks for whoever is signed in when no practitioner is allocated a username', async () => {
      getProbationPractitioner.mockResolvedValue({ unallocated: false })
      givenCheck({ outcome: 'UNKNOWN', message: null })
      const req = requestFor()
      const res = flaggedResponse('D')

      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)

      expect(checkEligibility).toHaveBeenCalledWith(crn, { practitionerId: res.locals.user.username })
    })

    it('records a header that disagrees with the API as the matching rule', async () => {
      givenCheck({ outcome: 'UNKNOWN', message: null })
      const req = requestFor()
      const res = flaggedResponse('MISSING')

      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)

      expect(res.redirect).toHaveBeenCalledWith(`${root}/not-eligible`)
      expect(stored(req).eligibilityCheck).toEqual(
        expect.objectContaining({ outcome: 'INELIGIBLE', ruleCode: 'IS_TIER_MISSING' }),
      )
    })

    it.each([
      ['the API fails', new Error('503'), 500],
      ['NDelius does not know the CRN', null, 404],
    ])('shows an error page when %s', async (_, response, status) => {
      givenCheck(response)
      const req = requestFor()
      const res = flaggedResponse('D')

      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)

      expect(res.status).toHaveBeenCalledWith(status)
      expect(res.render).toHaveBeenCalledWith('pages/error')
    })

    it('does not use the API with the flag off', async () => {
      const req = requestFor()
      const res = baseAppResponse({ tierScore: 'D', supervisionPackageStatus: { onSupervisionPackage: true } })

      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)

      expect(checkEligibility).not.toHaveBeenCalled()
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/eligibility-check.njk',
        expect.objectContaining({ askRecalled: true }),
      )
    })
  })

  describe('eligibility-check post', () => {
    it('sends the answers and follows an eligible Tier D-G outcome', async () => {
      givenCheck({ outcome: 'ELIGIBLE', message: null, ruleCode: 'IS_TIER_D_TO_G' })
      const req = requestFor(eligibilityBody(['none']))
      const res = flaggedResponse('E')

      await controllers.checkIns.postEligibilityPage(hmppsAuthClient)(req, res)

      expect(checkEligibility).toHaveBeenCalledWith(crn, {
        practitionerId: 'ALLOCATED.PP',
        eligibilityAnswers: { accreditedProgramme: null, deviceRestriction: false, youthSentence: null },
      })
      expect(res.redirect).toHaveBeenCalledWith(`${root}/is-eligible`)
      expect(stored(req).accreditedProgramme).toBe(false)
    })

    it('takes the accredited programme route when early engagement decided it', async () => {
      givenCheck({ outcome: 'ELIGIBLE', message: null, ruleCode: 'IN_EARLY_ENGAGEMENT' })
      const req = requestFor(eligibilityBody(['accreditedProgramme']))
      const res = flaggedResponse('B')

      await controllers.checkIns.postEligibilityPage(hmppsAuthClient)(req, res)

      expect(res.redirect).toHaveBeenCalledWith(`${root}/is-eligible`)
      expect(stored(req).accreditedProgramme).toBe(true)
      expect(stored(req).eligibilityCheck.answers).toEqual({
        accreditedProgramme: true,
        deviceRestriction: false,
        youthSentence: false,
      })
    })

    it('clears accredited programme answers when the route changes', async () => {
      givenCheck({ outcome: 'ELIGIBLE', message: null, ruleCode: 'PRACTITIONER_HAS_PILOT_CASE' })
      const req = requestFor(eligibilityBody(['none']), { accreditedProgrammeApproval: ['x'], rationale: 'because' })
      const res = flaggedResponse('B')

      await controllers.checkIns.postEligibilityPage(hmppsAuthClient)(req, res)

      expect(stored(req).accreditedProgramme).toBe(false)
      expect(stored(req).accreditedProgrammeApproval).toBeUndefined()
      expect(stored(req).rationale).toBeUndefined()
    })

    it('sends an ineligible outcome to not-eligible', async () => {
      givenCheck({ outcome: 'INELIGIBLE', message: 'Joe is in Tier C.', ruleCode: 'IS_TIER_C' })
      const req = requestFor(eligibilityBody(['none']))
      const res = flaggedResponse('C')

      await controllers.checkIns.postEligibilityPage(hmppsAuthClient)(req, res)

      expect(res.redirect).toHaveBeenCalledWith(`${root}/not-eligible`)
    })

    it('treats an UNKNOWN outcome with answers as an error', async () => {
      givenCheck({ outcome: 'UNKNOWN', message: null })
      const req = requestFor(eligibilityBody(['none']))
      const res = flaggedResponse('D')

      await controllers.checkIns.postEligibilityPage(hmppsAuthClient)(req, res)

      expect(res.status).toHaveBeenCalledWith(500)
      expect(stored(req).eligibilityCheck).toBeUndefined()
    })
  })

  describe('is-eligible page', () => {
    it('goes straight to not-eligible when the header has since turned provisional', async () => {
      const req = requestFor(
        {},
        {
          tierBand: 'DG',
          eligibilityCheck: { outcome: 'ELIGIBLE', message: null, ruleCode: 'IS_TIER_D_TO_G', answers: null },
        },
      )
      const res = flaggedResponse('D', { tierProvisional: true })

      await controllers.checkIns.getIsEligiblePage()(req, res)

      expect(res.redirect).toHaveBeenCalledWith(`${root}/not-eligible`)
      expect(stored(req).eligibilityCheck).toEqual(
        expect.objectContaining({ outcome: 'INELIGIBLE', ruleCode: 'IS_TIER_PROVISIONAL' }),
      )
    })

    it('goes back to the eligibility check rather than a pilot question', async () => {
      const req = requestFor({}, { tierBand: 'C', accreditedProgramme: false })
      const res = flaggedResponse('C')

      await controllers.checkIns.getIsEligiblePage()(req, res)

      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/pilot-is-eligible.njk',
        expect.objectContaining({ askedPilotCheck: false }),
      )
    })
  })

  describe('instructions page', () => {
    it('is unaffected by the flag', async () => {
      const req = requestFor()
      const res = flaggedResponse('D')

      await controllers.checkIns.getInstructionsPage(hmppsAuthClient)(req, res)

      expect(checkEligibility).not.toHaveBeenCalled()
      expect(res.render).toHaveBeenCalledWith(expect.stringContaining('instructions'), expect.anything())
    })
  })

  describe('not-eligible page', () => {
    it('shows the API reason with the display for its rule', async () => {
      const req = requestFor(
        {},
        {
          eligibilityCheck: {
            outcome: 'INELIGIBLE',
            message: 'Joe is in Tier C.',
            ruleCode: 'IS_TIER_C',
            answers: null,
          },
        },
      )
      const res = flaggedResponse('C')

      await controllers.checkIns.getNotEligiblePage()(req, res)

      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/not-eligible.njk',
        expect.objectContaining({
          apiReason: true,
          apiMessage: 'Joe is in Tier C.',
          additionalTierInformation: true,
          returnToOverviewPage: false,
        }),
      )
    })

    it('goes back to the eligibility check without an ineligible outcome', async () => {
      const req = requestFor()
      const res = flaggedResponse('C')

      await controllers.checkIns.getNotEligiblePage()(req, res)

      expect(res.redirect).toHaveBeenCalledWith(`${root}/eligibility-check`)
    })
  })
})
