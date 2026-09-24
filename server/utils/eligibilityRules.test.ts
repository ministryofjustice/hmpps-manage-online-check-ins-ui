import {
  EligibilityStatus,
  eligibilityViews,
  hasCompletedDiscussion,
  nextAfterEligibilityCheck,
  nextAfterPilotCheck,
  toSelections,
} from './eligibilityRules'
import { TierBand } from './getTierBand'

const bands: TierBand[] = ['AB', 'C', 'DG']

// The ESUP answers for a person nothing is wrong with, so each test below names only the fact it is
// about. See EligibilityStatus - all three come from the supervision-package call.
const ELIGIBLE_STATUS: EligibilityStatus = {
  onSupervisionPackage: true,
  inFinalThird: false,
  inEarlyEngagement: false,
}

const status = (overrides: Partial<EligibilityStatus> = {}): EligibilityStatus => ({ ...ELIGIBLE_STATUS, ...overrides })

describe('utils/eligibilityRules', () => {
  describe('nextAfterEligibilityCheck', () => {
    describe('disqualifiers that apply to every tier', () => {
      it.each(bands)('rules a %s person out when they are not on a supervision package', band => {
        expect(nextAfterEligibilityCheck(band, status({ onSupervisionPackage: false }), [])).toEqual({
          target: 'not-eligible',
          reason: 'is not on a supervision package',
        })
      })

      it.each(bands)('rules a %s person out when they have been recalled', band => {
        expect(nextAfterEligibilityCheck(band, status(), ['recalled'])).toEqual({
          target: 'not-eligible',
          reason: 'has been recalled to prison',
        })
      })

      // From the ESUP call rather than a box, so it applies whatever the practitioner answered.
      it.each(bands)('rules a %s person out in the final third of their sentence', band => {
        expect(nextAfterEligibilityCheck(band, status({ inFinalThird: true }), ['none'])).toEqual({
          target: 'not-eligible',
          reason: 'is in the final third of their sentence',
        })
      })

      // Unlike early engagement, this is not a programme-branch rule - it rules the Tier A/B
      // programme cohort out too, ahead of any exclusion that branch would have reported.
      it('rules the Tier A/B programme cohort out in the final third', () => {
        expect(nextAfterEligibilityCheck('AB', status({ inFinalThird: true }), ['accreditedProgramme'], 'B')).toEqual({
          target: 'not-eligible',
          reason: 'is in the final third of their sentence',
        })
      })

      it.each(bands)('rules a %s person out with a device or internet restriction', band => {
        expect(nextAfterEligibilityCheck(band, status(), ['deviceRestriction'])).toEqual({
          target: 'not-eligible',
          reason: 'has restrictions that mean they cannot use a device or the internet',
        })
      })

      // Every remaining box rules the person out by being ticked, so "None of these apply" asserts
      // there is nothing to find - it no longer rules anyone out, as it did when the supervision
      // package was one of the boxes it denied.
      it.each(bands)('treats "none of these apply" as no disqualifiers for a %s person', band => {
        expect(nextAfterEligibilityCheck(band, status(), ['none']).target).not.toBe('not-eligible')
      })

      // Exclusive in the browser only, so a forged submission can pair it with a disqualifier. The
      // disqualifier still decides the outcome.
      it.each(bands)('still rules a %s person out for a disqualifier sent alongside it', band => {
        expect(nextAfterEligibilityCheck(band, status(), ['none', 'recalled'])).toEqual({
          target: 'not-eligible',
          reason: 'has been recalled to prison',
        })
      })

      it('reports the missing supervision package ahead of any other disqualifier', () => {
        expect(
          nextAfterEligibilityCheck('DG', status({ onSupervisionPackage: false, inFinalThird: true }), ['recalled'])
            .reason,
        ).toBe('is not on a supervision package')
      })

      // Several at once are listed as bullets rather than reported one at a time, so the clause
      // above them is empty - "This is because Joe:".
      it('lists every disqualifier when several apply', () => {
        expect(nextAfterEligibilityCheck('DG', status({ inFinalThird: true }), ['recalled'])).toEqual({
          target: 'not-eligible',
          reason: '',
          bullets: ['has been recalled to prison', 'is in the final third of their sentence'],
        })
      })
    })

    describe('tiers A and B', () => {
      it('sends the accredited programme cohort to the is-eligible page', () => {
        expect(nextAfterEligibilityCheck('AB', status(), ['accreditedProgramme'])).toEqual({
          target: 'is-eligible',
          accreditedProgramme: true,
        })
      })

      // On the programme branch these rule the person out outright - there is no pilot route left
      // for them to fall back on. Off the branch neither matters; see the pilot cohort tests below.
      // Early engagement comes from the ESUP call, the youth sentence is still a box.
      it('rules the programme cohort out when early engagement applies', () => {
        expect(
          nextAfterEligibilityCheck('AB', status({ inEarlyEngagement: true }), ['accreditedProgramme'], 'B'),
        ).toEqual({
          target: 'not-eligible',
          reason: 'is in Tier B and on an accredited programme, but they are in early engagement',
        })
      })

      it('rules the programme cohort out when a youth sentence applies', () => {
        expect(nextAfterEligibilityCheck('AB', status(), ['accreditedProgramme', 'youthSentence'], 'B')).toEqual({
          target: 'not-eligible',
          reason: 'is in Tier B and on an accredited programme, but they are on a youth sentence',
        })
      })

      // Only the programme branch cares - the designer's tree marks these as "doesn't matter if
      // ticked or not" everywhere else, so a person on the pilot route is unaffected. This is why
      // early engagement cannot be settled before the form is answered.
      it('ignores early engagement when not on an accredited programme', () => {
        expect(nextAfterEligibilityCheck('AB', status({ inEarlyEngagement: true }), ['none'])).toEqual({
          target: 'pilot-check',
        })
      })

      it('ignores a youth sentence when not on an accredited programme', () => {
        expect(nextAfterEligibilityCheck('AB', status(), ['youthSentence'])).toEqual({ target: 'pilot-check' })
      })

      it('asks about the pilot cohort when not on an accredited programme', () => {
        expect(nextAfterEligibilityCheck('AB', status(), [])).toEqual({ target: 'pilot-check' })
      })
    })

    describe('tier C', () => {
      it('always asks about the pilot cohort, even on an accredited programme', () => {
        expect(nextAfterEligibilityCheck('C', status(), ['accreditedProgramme'])).toEqual({
          target: 'pilot-check',
        })
      })

      // The programme branch is a Tier A/B rule, so its exclusions never apply here.
      it('ignores early engagement', () => {
        expect(nextAfterEligibilityCheck('C', status({ inEarlyEngagement: true }), ['accreditedProgramme'])).toEqual({
          target: 'pilot-check',
        })
      })
    })

    describe('tiers D to G', () => {
      it('is eligible outright, with no pilot check', () => {
        expect(nextAfterEligibilityCheck('DG', status(), [])).toEqual({
          target: 'is-eligible',
          accreditedProgramme: false,
        })
      })

      // The accredited-programme route is a Tier A/B rule only.
      it('does not take the accredited programme route', () => {
        expect(nextAfterEligibilityCheck('DG', status(), ['accreditedProgramme']).accreditedProgramme).toBe(false)
      })

      it('ignores early engagement', () => {
        expect(nextAfterEligibilityCheck('DG', status({ inEarlyEngagement: true }), ['none'])).toEqual({
          target: 'is-eligible',
          accreditedProgramme: false,
        })
      })
    })
  })

  describe('nextAfterPilotCheck', () => {
    it.each(['AB', 'C'] as const)('lets the %s pilot cohort through', band => {
      expect(nextAfterPilotCheck(band, 'true')).toEqual({ target: 'is-eligible', accreditedProgramme: false })
    })

    // Tier A/B reaching here are outside the pilot cohort and off the programme branch, so both
    // facts are listed beneath the clause.
    it('rules a Tier A/B person outside the pilot cohort out, with its own reason', () => {
      expect(nextAfterPilotCheck('AB', 'false', 'B')).toEqual({
        target: 'not-eligible',
        reason: 'is in Tier B and',
        bullets: [
          'not on an accredited programme',
          'you have no people who were signed up to use online check ins before 1 October 2026',
        ],
      })
    })

    it('rules a Tier C person outside the pilot cohort out, with its own reason', () => {
      expect(nextAfterPilotCheck('C', 'false', 'C')).toEqual({
        target: 'not-eligible',
        reason:
          'is in Tier C and you do not have one or more people on your caseload who started using online check ins before 1 October 2026',
      })
    })

    it('treats an unanswered question as outside the pilot cohort', () => {
      expect(nextAfterPilotCheck('C', '').target).toBe('not-eligible')
    })
  })

  describe('hasCompletedDiscussion', () => {
    const allPoints = ['optional', 'canStop', 'notEnforceable', 'moreTime']

    it('passes when every point has been discussed', () => {
      expect(hasCompletedDiscussion(allPoints)).toBe(true)
    })

    it.each([
      ['nothing ticked', undefined],
      ['an empty list', []],
      ['one point ticked', ['optional']],
      ['all but one ticked', ['optional', 'canStop', 'notEnforceable']],
      ['"I have not done all of these" ticked', ['notAll']],
      // Exclusive in the browser only, so a forged submission carrying both cannot be trusted.
      ['"I have not done all of these" alongside every point', [...allPoints, 'notAll']],
    ])('fails with %s', (_description, discussion) => {
      expect(hasCompletedDiscussion(discussion)).toBe(false)
    })

    // A single ticked box posts as a string rather than an array.
    it('handles a single point posted as a string', () => {
      expect(hasCompletedDiscussion('optional')).toBe(false)
    })

    // The accredited-programme cohort is shown a fifth point - that check ins end with the
    // programme - so only they have to tick it.
    describe('for the accredited programme cohort', () => {
      const forCohort = (discussion: string[]) => hasCompletedDiscussion(discussion, { accreditedProgramme: true })

      it('passes once the programme-only point is confirmed alongside the rest', () => {
        expect(forCohort([...allPoints, 'programmeOnly'])).toBe(true)
      })

      it('fails while the programme-only point is unticked', () => {
        expect(forCohort(allPoints)).toBe(false)
      })

      it('fails with "I have not done all of these" ticked', () => {
        expect(forCohort([...allPoints, 'programmeOnly', 'notAll'])).toBe(false)
      })
    })

    // Everyone else is never shown the point, so a session without it is still complete.
    it('does not ask for the programme-only point off that cohort', () => {
      expect(hasCompletedDiscussion(allPoints, { accreditedProgramme: false })).toBe(true)
    })
  })

  describe('toSelections', () => {
    it('wraps a single posted value', () => {
      expect(toSelections('recalled')).toEqual(['recalled'])
    })

    it('passes an array through', () => {
      expect(toSelections(['recalled', 'deviceRestriction'])).toEqual(['recalled', 'deviceRestriction'])
    })

    it.each([undefined, null])('returns an empty list for %s', value => {
      expect(toSelections(value)).toEqual([])
    })
  })

  describe('eligibilityViews', () => {
    // getPilotCheckPage errors for D-G rather than falling back to another band's template.
    it('has no pilot check for tiers D to G', () => {
      expect(eligibilityViews.DG['pilot-check']).toBeUndefined()
    })

    it('only offers the accredited programme page to tiers A and B', () => {
      expect(eligibilityViews.AB['accredited-programme-is-eligible']).toBeDefined()
      expect(eligibilityViews.C['accredited-programme-is-eligible']).toBeUndefined()
      expect(eligibilityViews.DG['accredited-programme-is-eligible']).toBeUndefined()
    })

    it('gives every band its own eligibility check and is-eligible page', () => {
      bands.forEach(band => {
        expect(eligibilityViews[band]['eligibility-check']).toContain('eligibility/')
        expect(eligibilityViews[band]['is-eligible']).toContain('eligibility/')
      })
    })
  })
})
