import {
  eligibilityViews,
  hasCompletedDiscussion,
  nextAfterEligibilityCheck,
  nextAfterPilotCheck,
  toSelections,
} from './eligibilityRules'
import { TierBand } from './getTierBand'

const bands: TierBand[] = ['AB', 'C', 'DG']

describe('utils/eligibilityRules', () => {
  describe('nextAfterEligibilityCheck', () => {
    describe('disqualifiers that apply to every tier', () => {
      it.each(bands)('rules a %s person out when they are not on a supervision package', band => {
        expect(nextAfterEligibilityCheck(band, [])).toEqual({
          target: 'not-eligible',
          reason: 'is not on a supervision package',
        })
      })

      it.each(bands)('rules a %s person out when they have been recalled', band => {
        expect(nextAfterEligibilityCheck(band, ['supervisionPackage', 'recalled'])).toEqual({
          target: 'not-eligible',
          reason: 'has been recalled to prison',
        })
      })

      it.each(bands)('rules a %s person out in the final third of their sentence', band => {
        expect(nextAfterEligibilityCheck(band, ['supervisionPackage', 'finalThird'])).toEqual({
          target: 'not-eligible',
          reason: 'is in the final third of their sentence',
        })
      })

      it.each(bands)('rules a %s person out with a device or internet restriction', band => {
        expect(nextAfterEligibilityCheck(band, ['supervisionPackage', 'deviceRestriction'])).toEqual({
          target: 'not-eligible',
          reason: 'has restrictions that mean they cannot use a device or the internet',
        })
      })

      // A blank submission means none of the criteria apply, including the supervision
      // package the person needs - so it rules them out rather than erroring.
      it('treats a blank submission as no supervision package', () => {
        expect(nextAfterEligibilityCheck('DG', []).reason).toBe('is not on a supervision package')
      })

      it('reports the missing supervision package ahead of any other disqualifier', () => {
        expect(nextAfterEligibilityCheck('DG', ['recalled', 'finalThird']).reason).toBe(
          'is not on a supervision package',
        )
      })

      it('reports the first disqualifier when several apply', () => {
        expect(nextAfterEligibilityCheck('DG', ['supervisionPackage', 'finalThird', 'recalled']).reason).toBe(
          'has been recalled to prison',
        )
      })
    })

    describe('tiers A and B', () => {
      it('sends the accredited programme cohort to the is-eligible page', () => {
        expect(nextAfterEligibilityCheck('AB', ['supervisionPackage', 'accreditedProgramme'])).toEqual({
          target: 'is-eligible',
          accreditedProgramme: true,
        })
      })

      it.each(['earlyEngagement', 'youthSentence'])('falls back to the pilot check when %s applies', exclusion => {
        expect(nextAfterEligibilityCheck('AB', ['supervisionPackage', 'accreditedProgramme', exclusion])).toEqual({
          target: 'pilot-check',
        })
      })

      it('asks about the pilot cohort when not on an accredited programme', () => {
        expect(nextAfterEligibilityCheck('AB', ['supervisionPackage'])).toEqual({ target: 'pilot-check' })
      })
    })

    describe('tier C', () => {
      it('always asks about the pilot cohort, even on an accredited programme', () => {
        expect(nextAfterEligibilityCheck('C', ['supervisionPackage', 'accreditedProgramme'])).toEqual({
          target: 'pilot-check',
        })
      })
    })

    describe('tiers D to G', () => {
      it('is eligible outright, with no pilot check', () => {
        expect(nextAfterEligibilityCheck('DG', ['supervisionPackage'])).toEqual({
          target: 'is-eligible',
          accreditedProgramme: false,
        })
      })

      // The accredited-programme route is a Tier A/B rule only.
      it('does not take the accredited programme route', () => {
        expect(nextAfterEligibilityCheck('DG', ['supervisionPackage', 'accreditedProgramme']).accreditedProgramme).toBe(
          false,
        )
      })
    })
  })

  describe('nextAfterPilotCheck', () => {
    it.each(['AB', 'C'] as const)('lets the %s pilot cohort through', band => {
      expect(nextAfterPilotCheck(band, 'true')).toEqual({ target: 'is-eligible', accreditedProgramme: false })
    })

    it('rules a Tier A/B person outside the pilot cohort out, with its own reason', () => {
      expect(nextAfterPilotCheck('AB', 'false')).toEqual({
        target: 'not-eligible',
        reason:
          'is in Tier A/B and you do not have one or more people on your caseload who started using online check ins before 1 October 2026',
      })
    })

    it('rules a Tier C person outside the pilot cohort out, with its own reason', () => {
      expect(nextAfterPilotCheck('C', 'false')).toEqual({
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
    ])('fails with %s', (_description, discussion) => {
      expect(hasCompletedDiscussion(discussion)).toBe(false)
    })

    // A single ticked box posts as a string rather than an array.
    it('handles a single point posted as a string', () => {
      expect(hasCompletedDiscussion('optional')).toBe(false)
    })
  })

  describe('toSelections', () => {
    it('wraps a single posted value', () => {
      expect(toSelections('recalled')).toEqual(['recalled'])
    })

    it('passes an array through', () => {
      expect(toSelections(['recalled', 'finalThird'])).toEqual(['recalled', 'finalThird'])
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
