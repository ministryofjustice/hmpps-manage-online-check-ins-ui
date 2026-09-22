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
jest.mock('@ministryofjustice/hmpps-audit-client')
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

// getPersonalDetails puts the tier score on res.locals for every eligibility route, and the
// band derived from it decides which template and which rules apply.
const responseForTier = (tierScore: string, locals: Record<string, unknown> = {}) =>
  mockAppResponse({ tierScore, ...locals })

describe('check-in setup flow', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(ESupervisionClient as jest.Mock).mockImplementation(() => ({
      getProbationPractitioner: jest.fn().mockResolvedValue({ unallocated: false }),
    }))
  })

  describe('starting a setup', () => {
    // The eligibility check is the wizard's opening page. The instructions page is kept for now
    // in case the guidance is wanted back, but nothing routes into or out of it.
    it('sends new setups straight to the eligibility check', async () => {
      const req = requestFor()
      const res = responseForTier('B1')
      await controllers.checkIns.getStartSetup()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringMatching(new RegExp(`^/case/${crn}/appointments/[\\w-]+/check-in/eligibility-check$`)),
      )
    })

    it('records when the setup started against the new setup id', async () => {
      const req = requestFor()
      const res = mockAppResponse()
      const before = Date.now()
      await controllers.checkIns.getStartSetup()(req, res)

      const redirect: string = (res.redirect as jest.Mock).mock.calls[0][0]
      const [, , , , setupId] = redirect.split('/')
      const { setupStartedAt, checkins } = req.session.data.esupervision[crn][setupId]
      expect(Date.parse(setupStartedAt)).toBeGreaterThanOrEqual(before)
      expect(Date.parse(setupStartedAt)).toBeLessThanOrEqual(Date.now())
      // restrictPageAccess reads any `checkins` data as answers given, so starting must not create it
      expect(checkins).toBeUndefined()
    })
  })

  // Still routable, though no longer part of the flow.
  describe('instructions', () => {
    it('shows the accredited programme guidance for Tier A/B', async () => {
      const req = requestFor()
      const res = responseForTier('A2')
      await controllers.checkIns.getInstructionsPage(hmppsAuthClient)(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/instructions.njk',
        expect.objectContaining({ crn, id, accreditedProgramme: true }),
      )
    })

    it.each([
      ['C1', 'C'],
      ['D3', 'D-G'],
    ])('hides the accredited programme guidance for tier %s', async tierScore => {
      const req = requestFor()
      const res = responseForTier(tierScore)
      await controllers.checkIns.getInstructionsPage(hmppsAuthClient)(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/instructions.njk',
        expect.objectContaining({ crn, id, accreditedProgramme: false }),
      )
    })

    it('continues to the eligibility check', async () => {
      const req = requestFor()
      const res = responseForTier('B1')
      await controllers.checkIns.postInstructionsPage()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
    })

    it('errors rather than guessing a band when the tier is unknown', async () => {
      const req = requestFor()
      const res = responseForTier('Z1')
      await controllers.checkIns.getInstructionsPage(hmppsAuthClient)(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.render).not.toHaveBeenCalledWith('pages/check-in/instructions.njk', expect.anything())
    })

    it('rules the person out when their tier is missing', async () => {
      const req = requestFor()
      const res = responseForTier('MISSING')
      await controllers.checkIns.getInstructionsPage(hmppsAuthClient)(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      expect(res.render).not.toHaveBeenCalledWith('pages/check-in/instructions.njk', expect.anything())
    })
  })

  describe('eligibility check', () => {
    // Every band shares one template, which renders the Tier A/B-only questions off `tierBand`.
    it.each([
      ['A1', 'AB'],
      ['B2', 'AB'],
      ['C1', 'C'],
      ['E2', 'DG'],
    ])('renders the eligibility check for tier %s with band %s', async (tierScore, tierBand) => {
      const req = requestFor()
      const res = responseForTier(tierScore)
      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/eligibility-check.njk',
        expect.objectContaining({ crn, id, tierScore, tierBand }),
      )
    })

    it('errors rather than guessing a band when the tier is unknown', async () => {
      const req = requestFor()
      const res = responseForTier('Z1')
      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.render).not.toHaveBeenCalledWith(expect.stringContaining('eligibility-check'), expect.anything())
    })

    // Nothing on the eligibility check can change the outcome for someone with no tier, so they
    // are ruled out with that as the reason rather than being asked anything.
    it('rules the person out when their tier is missing', async () => {
      const req = requestFor()
      const res = responseForTier('MISSING')
      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      expect(req.session.data.esupervision[crn][id].checkins.notEligibleReason).toBe('has not been assigned a Tier yet')
      expect(req.session.data.esupervision[crn][id].checkins.notEligibleReasonBullets).toEqual([])
      expect(res.render).not.toHaveBeenCalledWith(expect.stringContaining('eligibility-check'), expect.anything())
    })
  })

  describe('eligibility branching', () => {
    const postEligibility = async (tierScore: string, eligibility: string[]) => {
      const req = requestFor({ esupervision: { [crn]: { [id]: { checkins: { eligibility } } } } })
      const res = responseForTier(tierScore)
      await controllers.checkIns.postEligibilityPage()(req, res)
      return {
        redirect: (res.redirect as jest.Mock).mock.calls[0][0],
        checkins: req.session.data?.esupervision?.[crn]?.[id]?.checkins,
      }
    }

    // The four all-tier disqualifiers, each with the reason not-eligible.njk renders.
    it.each([
      [[] as string[], 'is not on a supervision package'],
      [['supervisionPackage', 'recalled'], 'has been recalled to prison'],
      [['supervisionPackage', 'finalThird'], 'is in the final third of their sentence'],
      [
        ['supervisionPackage', 'deviceRestriction'],
        'has restrictions that mean they cannot use a device or the internet',
      ],
    ])('rules the person out for %s whatever their tier', async (eligibility, reason) => {
      const { redirect, checkins } = await postEligibility('D1', eligibility)
      expect(redirect).toBe(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      expect(checkins.notEligibleReason).toBe(reason)
    })

    it('sends the Tier A/B accredited programme cohort straight to is-eligible', async () => {
      const { redirect, checkins } = await postEligibility('A1', ['supervisionPackage', 'accreditedProgramme'])
      expect(redirect).toBe(`/case/${crn}/appointments/${id}/check-in/is-eligible`)
      expect(checkins.accreditedProgramme).toBe(true)
    })

    // On the programme branch these rule the person out rather than diverting them to the pilot
    // route - see nextAfterEligibilityCheck.
    it.each(['earlyEngagement', 'youthSentence'])(
      'rules the Tier A/B programme cohort out when %s applies',
      async exclusion => {
        const { redirect, checkins } = await postEligibility('B1', [
          'supervisionPackage',
          'accreditedProgramme',
          exclusion,
        ])
        expect(redirect).toBe(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
        expect(checkins.notEligibleReason).toContain('on an accredited programme, but they are')
        expect(checkins.accreditedProgramme).toBe(false)
      },
    )

    // Off the programme branch neither has any bearing, so the pilot route is unaffected.
    it.each(['earlyEngagement', 'youthSentence'])(
      'still asks Tier A/B about the pilot when %s applies without a programme',
      async exclusion => {
        const { redirect } = await postEligibility('B1', ['supervisionPackage', exclusion])
        expect(redirect).toBe(`/case/${crn}/appointments/${id}/check-in/pilot-check`)
      },
    )

    // The pilot answer cannot change the outcome for a disqualified person, so it is not asked.
    it('rules a disqualified Tier A/B person out without asking about the pilot', async () => {
      const { redirect, checkins } = await postEligibility('A1', ['supervisionPackage', 'recalled'])
      expect(redirect).toBe(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      expect(checkins.notEligibleReason).toBe('has been recalled to prison')
    })

    // Several disqualifiers are listed as bullets, so the clause above them is empty.
    it('records every disqualifier that applies', async () => {
      const { checkins } = await postEligibility('D1', ['supervisionPackage', 'recalled', 'deviceRestriction'])
      expect(checkins.notEligibleReason).toBe('')
      expect(checkins.notEligibleReasonBullets).toEqual([
        'has been recalled to prison',
        'has restrictions that mean they cannot use a device or the internet',
      ])
    })

    // "None of these apply" is exclusive in the browser only.
    it('rules a person out when "none of these apply" is ticked alongside a package', async () => {
      const { redirect, checkins } = await postEligibility('D1', ['none', 'supervisionPackage'])
      expect(redirect).toBe(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      expect(checkins.notEligibleReason).toBe('is not on a supervision package')
    })

    it.each(['A1', 'C2'])(
      'asks tier %s about the pilot cohort when not on an accredited programme',
      async tierScore => {
        const { redirect } = await postEligibility(tierScore, ['supervisionPackage'])
        expect(redirect).toBe(`/case/${crn}/appointments/${id}/check-in/pilot-check`)
      },
    )

    it('skips the pilot check for tiers D to G', async () => {
      const { redirect } = await postEligibility('F1', ['supervisionPackage'])
      expect(redirect).toBe(`/case/${crn}/appointments/${id}/check-in/is-eligible`)
    })

    it('records the resolved band so later pages do not re-derive it', async () => {
      const { checkins } = await postEligibility('C1', ['supervisionPackage'])
      expect(checkins.tierBand).toBe('C')
    })

    it('errors rather than guessing a band when the tier is unknown', async () => {
      const req = requestFor({ esupervision: { [crn]: { [id]: { checkins: { eligibility: [] } } } } })
      const res = responseForTier('Z1')
      await controllers.checkIns.postEligibilityPage()(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.redirect).not.toHaveBeenCalled()
    })

    it('rules the person out when their tier is missing', async () => {
      const req = requestFor({
        esupervision: { [crn]: { [id]: { checkins: { eligibility: ['supervisionPackage'] } } } },
      })
      const res = responseForTier('MISSING')
      await controllers.checkIns.postEligibilityPage()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      expect(req.session.data.esupervision[crn][id].checkins.notEligibleReason).toBe('has not been assigned a Tier yet')
    })
  })

  describe('pilot check', () => {
    const postPilotCheck = async (tierScore: string, pilotCheck: string) => {
      const req = requestFor({ esupervision: { [crn]: { [id]: { checkins: { pilotCheck } } } } })
      const res = responseForTier(tierScore)
      await controllers.checkIns.postPilotCheckPage()(req, res)
      return {
        redirect: (res.redirect as jest.Mock).mock.calls[0][0],
        checkins: req.session.data?.esupervision?.[crn]?.[id]?.checkins,
      }
    }

    // A/B and C are asked the same question, so they share one template.
    it.each(['A1', 'C1'])('renders the pilot check for tier %s', async tierScore => {
      const req = requestFor()
      const res = responseForTier(tierScore)
      await controllers.checkIns.getPilotCheckPage()(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/pilot-check.njk',
        expect.objectContaining({ crn, id, tierScore }),
      )
    })

    // Tiers D-G never reach this page - there is no template for them to fall back on.
    it('errors for tiers D to G, which have no pilot question', async () => {
      const req = requestFor()
      const res = responseForTier('D1')
      await controllers.checkIns.getPilotCheckPage()(req, res)
      expect(res.status).toHaveBeenCalledWith(500)
      expect(res.render).not.toHaveBeenCalledWith(expect.stringContaining('pilot-check'), expect.anything())
    })

    it('rules the person out when their tier is missing', async () => {
      const req = requestFor()
      const res = responseForTier('MISSING')
      await controllers.checkIns.getPilotCheckPage()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      expect(res.render).not.toHaveBeenCalledWith(expect.stringContaining('pilot-check'), expect.anything())
    })

    it.each(['A1', 'C1'])('lets the tier %s pilot cohort through', async tierScore => {
      const { redirect } = await postPilotCheck(tierScore, 'true')
      expect(redirect).toBe(`/case/${crn}/appointments/${id}/check-in/is-eligible`)
    })

    // Tier A/B here are outside the cohort and off the programme branch, so both facts are listed;
    // Tier C has only the one, which reads as a single sentence.
    it.each([
      [
        'B1',
        'is in Tier A/B and',
        [
          'not on an accredited programme',
          'you have no people who were signed up to use online check ins before 1 October 2026',
        ],
      ],
      [
        'C1',
        'is in Tier C and you do not have one or more people on your caseload who started using online check ins before 1 October 2026',
        [],
      ],
    ])('rules tier %s out with its own reason when outside the pilot cohort', async (tierScore, reason, bullets) => {
      const { redirect, checkins } = await postPilotCheck(tierScore, 'false')
      expect(redirect).toBe(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      expect(checkins.notEligibleReason).toBe(reason)
      expect(checkins.notEligibleReasonBullets).toEqual(bullets)
    })
  })

  describe('is eligible', () => {
    const sessionWith = (checkins: Record<string, unknown>) => ({
      data: { esupervision: { [crn]: { [id]: { checkins } } } },
    })

    it('renders the accredited programme page for the Tier A/B programme cohort', async () => {
      const req = requestFor({}, sessionWith({ accreditedProgramme: true }))
      const res = responseForTier('A1')
      await controllers.checkIns.getIsEligiblePage()(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/tiers-a-b/accredited-programme-is-eligible.njk',
        expect.objectContaining({ crn, id, tierScore: 'A1' }),
      )
    })

    it.each([
      ['A1', { accreditedProgramme: false }, 'eligibility/pilot-is-eligible.njk'],
      ['C1', {}, 'eligibility/pilot-is-eligible.njk'],
      ['G1', {}, 'eligibility/tiers-d-g/is-eligible.njk'],
    ])('renders the tier %s page otherwise', async (tierScore, checkins, view) => {
      const req = requestFor({}, sessionWith(checkins))
      const res = responseForTier(tierScore)
      await controllers.checkIns.getIsEligiblePage()(req, res)
      expect(res.render).toHaveBeenCalledWith(`pages/check-in/${view}`, expect.objectContaining({ crn, id }))
    })

    it('rules the person out when their tier is missing', async () => {
      const req = requestFor({}, sessionWith({}))
      const res = responseForTier('MISSING')
      await controllers.checkIns.getIsEligiblePage()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/not-eligible`)
      expect(res.render).not.toHaveBeenCalled()
    })

    const allDiscussionPoints = ['optional', 'canStop', 'notEnforceable', 'moreTime']

    const postIsEligible = async ({ discussion, ...checkins }: Record<string, unknown>) => {
      const req = requestFor({ esupervision: { [crn]: { [id]: { checkins: { discussion } } } } }, sessionWith(checkins))
      const res = responseForTier('D1')
      await controllers.checkIns.postIsEligiblePage()(req, res)
      return (res.redirect as jest.Mock).mock.calls[0][0]
    }

    it('continues to date frequency once every discussion point is confirmed', async () => {
      expect(await postIsEligible({ discussion: allDiscussionPoints })).toBe(
        `/case/${crn}/appointments/${id}/check-in/date-frequency`,
      )
    })

    it('routes the accredited programme cohort through approval first', async () => {
      expect(
        await postIsEligible({
          discussion: [...allDiscussionPoints, 'programmeOnly'],
          accreditedProgramme: true,
        }),
      ).toBe(`/case/${crn}/appointments/${id}/check-in/accredited-programme-approval`)
    })

    // That cohort is shown an extra point - that check ins end with the programme - so the four
    // everyone else answers leave their discussion unfinished.
    it('diverts the accredited programme cohort when the programme-only point is unticked', async () => {
      expect(await postIsEligible({ discussion: allDiscussionPoints, accreditedProgramme: true })).toBe(
        `/case/${crn}/appointments/${id}/check-in/discuss-before-signup`,
      )
    })

    // Part-ticked boxes are guidance rather than a validation error.
    it.each([
      ['none ticked', undefined],
      ['one ticked', ['optional']],
      ['all but one ticked', ['optional', 'canStop', 'notEnforceable']],
    ])('diverts to discuss-before-signup when the discussion has %s', async (_description, discussion) => {
      expect(await postIsEligible({ discussion })).toBe(
        `/case/${crn}/appointments/${id}/check-in/discuss-before-signup`,
      )
    })
  })

  describe('not eligible', () => {
    it('renders the reason recorded by whichever check ruled the person out', async () => {
      const req = requestFor(
        {},
        {
          data: {
            esupervision: { [crn]: { [id]: { checkins: { notEligibleReason: 'has been recalled to prison' } } } },
          },
        },
      )
      const res = responseForTier('C1')
      await controllers.checkIns.getNotEligiblePage()(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/not-eligible.njk',
        expect.objectContaining({ crn, id, reason: 'has been recalled to prison' }),
      )
    })

    // The bullets are passed through for the reasons that have them, so the page can list the facts
    // rather than running them into one sentence.
    it('passes the bullets through when several facts ruled the person out', async () => {
      const bullets = ['has been recalled to prison', 'is in the final third of their sentence']
      const req = requestFor(
        {},
        {
          data: {
            esupervision: {
              [crn]: { [id]: { checkins: { notEligibleReason: '', notEligibleReasonBullets: bullets } } },
            },
          },
        },
      )
      const res = responseForTier('C1')
      await controllers.checkIns.getNotEligiblePage()(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/not-eligible.njk',
        expect.objectContaining({ reason: '', reasonBullets: bullets }),
      )
    })

    // The page hides its back link and its offer to try again off this, since a missing tier is the
    // one reason going back could not change.
    it.each([
      ['MISSING', true],
      ['C1', false],
    ])('tells the page whether the tier is missing for score %s', async (tierScore, missingTier) => {
      const req = requestFor({}, { data: { esupervision: { [crn]: { [id]: { checkins: {} } } } } })
      const res = responseForTier(tierScore)
      await controllers.checkIns.getNotEligiblePage()(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/not-eligible.njk',
        expect.objectContaining({ missingTier }),
      )
    })

    it('returns to the case overview', async () => {
      const req = requestFor()
      const res = responseForTier('C1')
      await controllers.checkIns.postNotEligiblePage()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}`)
    })
  })

  describe('discuss before signup', () => {
    it('renders the guidance page', async () => {
      const req = requestFor()
      const res = responseForTier('C1')
      await controllers.checkIns.getDiscussBeforeSignupPage()(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/discuss-before-signup.njk',
        expect.objectContaining({ crn, id }),
      )
    })

    it('returns to the case overview', async () => {
      const req = requestFor()
      const res = responseForTier('C1')
      await controllers.checkIns.postDiscussBeforeSignupPage()(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}`)
    })
  })

  describe('rationale', () => {
    const renderFor = async (checkins: Record<string, unknown>, query: Record<string, string> = {}) => {
      const req = httpMocks.createRequest({
        params: { crn, id },
        query,
        session: { data: { esupervision: { [crn]: { [id]: { checkins } } } } },
      })
      const res = responseForTier('A1')
      await controllers.checkIns.getRationalePage()(req, res)
      return { res, locals: (res.render as jest.Mock).mock.calls[0]?.[1] }
    }

    it('retraces the accredited programme approval step', async () => {
      const { locals } = await renderFor({ accreditedProgramme: true })
      expect(locals.backLink).toBe(`/case/${crn}/appointments/${id}/check-in/accredited-programme-approval`)
      expect(locals.accreditedProgramme).toBe(true)
    })

    it('returns to the summary when following a change link', async () => {
      const { locals } = await renderFor({ accreditedProgramme: true }, { cya: 'true' })
      expect(locals.backLink).toBe(`/case/${crn}/appointments/${id}/check-in/checkin-summary`)
    })

    // Rationale only applies to the accredited-programme cohort.
    it('redirects to date frequency for everyone else', async () => {
      const { res } = await renderFor({ accreditedProgramme: false })
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments/${id}/check-in/date-frequency`)
      expect(res.render).not.toHaveBeenCalled()
    })
  })

  describe('date frequency back link', () => {
    const backLinkFor = async (checkins: Record<string, unknown>, query: Record<string, string> = {}) => {
      const req = httpMocks.createRequest({
        params: { crn, id },
        query,
        session: { data: { esupervision: { [crn]: { [id]: { checkins } } } } },
      })
      const res = responseForTier('A1')
      await controllers.checkIns.getDateFrequencyPage()(req, res)
      return (res.render as jest.Mock).mock.calls[0][1].backLink
    }

    it('retraces rationale for the accredited programme cohort', async () => {
      expect(await backLinkFor({ accreditedProgramme: true })).toBe(
        `/case/${crn}/appointments/${id}/check-in/rationale`,
      )
    })

    it('retraces is-eligible - skipping rationale - for everyone else', async () => {
      expect(await backLinkFor({ accreditedProgramme: false })).toBe(
        `/case/${crn}/appointments/${id}/check-in/is-eligible`,
      )
    })

    it('returns to the summary when following a change link', async () => {
      expect(await backLinkFor({ accreditedProgramme: true }, { cya: 'true' })).toBe(
        `/case/${crn}/appointments/${id}/check-in/checkin-summary`,
      )
    })
  })

  describe('accredited programme approval', () => {
    it('renders its template', async () => {
      const req = requestFor()
      const res = responseForTier('A1')
      await controllers.checkIns.getAccreditedProgrammeApprovalPage()(req, res)
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/accredited-programme-approval.njk',
        expect.objectContaining({ crn, id }),
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
      const res = responseForTier('B1')
      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments`)
    })
  })

  describe('allocation check with the new pop header flag on', () => {
    it('reuses res.locals.practitioner instead of calling getProbationPractitioner again', async () => {
      const getProbationPractitioner = jest.fn()
      ;(ESupervisionClient as jest.Mock).mockImplementation(() => ({ getProbationPractitioner }))
      const req = requestFor()
      const res = responseForTier('B1', {
        flags: { newDesignPopHeader: true },
        practitioner: { unallocated: false },
      })
      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)
      expect(getProbationPractitioner).not.toHaveBeenCalled()
      expect(res.render).toHaveBeenCalledWith(
        'pages/check-in/eligibility/eligibility-check.njk',
        expect.objectContaining({ crn }),
      )
    })

    it('redirects unallocated cases away from the setup flow using res.locals.practitioner', async () => {
      const getProbationPractitioner = jest.fn()
      ;(ESupervisionClient as jest.Mock).mockImplementation(() => ({ getProbationPractitioner }))
      const req = requestFor()
      const res = responseForTier('B1', {
        flags: { newDesignPopHeader: true },
        practitioner: { unallocated: true },
      })
      await controllers.checkIns.getEligibilityPage(hmppsAuthClient)(req, res)
      expect(getProbationPractitioner).not.toHaveBeenCalled()
      expect(res.redirect).toHaveBeenCalledWith(`/case/${crn}/appointments`)
    })
  })
})
