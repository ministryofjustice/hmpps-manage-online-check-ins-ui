// Exhaustive coverage of the eligibility decision tree: every combination of the remaining
// checkboxes, against every tier band, all eight combinations of the three answers the ESUP
// supervision-package call gives, and - where the flow reaches it - both answers to the pilot
// question.
//
// The expectation is not a fixture of what the code currently returns. It is an independent oracle
// written from the designer's tree, structured the way the tree is drawn rather than the way
// nextAfterEligibilityCheck is written: supervision package, then the programme branch with its own
// exclusions, then the pilot branch, with the shared disqualifiers repeated at the foot of each.
// The code settles those up front instead - the same verdict by a shorter route. Two implementations
// of the same rules that disagree on any of the 384 cases fail the test - which is the point, since
// the rules are the requirement and the code is only one expression of them.
//
// Cases where the rules are the same for every band are covered once here rather than three times;
// eligibilityRules.test.ts keeps the readable per-rule tests that name each behaviour.
import {
  nextAfterEligibilityCheck,
  nextAfterPilotCheck,
  EligibilityOutcome,
  EligibilityStatus,
} from './eligibilityRules'
import { TierBand } from './getTierBand'

// Only ever ticked on Tiers A and B - the boxes are not rendered for other bands.
const tierABOnly = ['accreditedProgramme', 'youthSentence'] as const
const allTiers = ['recalled', 'deviceRestriction'] as const

const bands: TierBand[] = ['AB', 'C', 'DG']

// All eight answers the supervision-package call can give. The final third and early engagement used
// to be boxes in the lists above; the tree is unchanged by where the facts come from, so they are
// swept here in place of being ticked.
const statuses: EligibilityStatus[] = [true, false].flatMap(onSupervisionPackage =>
  [true, false].flatMap(inFinalThird =>
    [true, false].map(inEarlyEngagement => ({ onSupervisionPackage, inFinalThird, inEarlyEngagement })),
  ),
)

const describeStatus = ({ onSupervisionPackage, inFinalThird, inEarlyEngagement }: EligibilityStatus): string =>
  `package ${onSupervisionPackage ? 'yes' : 'no'}, final third ${inFinalThird ? 'yes' : 'no'}, early engagement ${
    inEarlyEngagement ? 'yes' : 'no'
  }`

// A person the ESUP call finds nothing wrong with, for the reason-precedence tests below, which name
// the one fact they are about.
const ON_PACKAGE: EligibilityStatus = { onSupervisionPackage: true, inFinalThird: false, inEarlyEngagement: false }
const withStatus = (overrides: Partial<EligibilityStatus> = {}): EligibilityStatus => ({ ...ON_PACKAGE, ...overrides })

// What not-eligible.njk renders after "This is because <forename>". One fact reads as a single
// sentence; several are listed as bullets under a stem, so most reasons have both forms.
const REASONS = {
  supervisionPackage: 'is not on a supervision package',
  recalled: 'has been recalled to prison',
  finalThird: 'is in the final third of their sentence',
  deviceRestriction: 'has restrictions that mean they cannot use a device or the internet',
  youthSentence: 'is in Tier A/B and on an accredited programme, but they are on a youth sentence',
  earlyEngagement: 'is in Tier A/B and on an accredited programme, but they are in early engagement',
  pilotC:
    'is in Tier C and you do not have one or more people on your caseload who started using online check ins before 1 October 2026',
}

// The clause that introduces a bullet list. The shared disqualifiers are whole clauses in
// themselves, so they are listed under no stem at all - "This is because Joe:".
const STEMS = {
  disqualifiers: '',
  programme: 'is in Tier A/B and on an accredited programme, but they are',
  pilotAB: 'is in Tier A/B and',
}

const BULLETS = {
  recalled: 'has been recalled to prison',
  finalThird: 'is in the final third of their sentence',
  deviceRestriction: 'has restrictions that mean they cannot use a device or the internet',
  youthSentence: 'on a youth sentence',
  earlyEngagement: 'in early engagement',
  noProgramme: 'not on an accredited programme',
  noPilot: 'you have no people who were signed up to use online check ins before 1 October 2026',
}

const boxesFor = (band: TierBand): string[] => (band === 'AB' ? [...allTiers, ...tierABOnly] : [...allTiers])

// Every subset of the boxes a band is actually shown - 2^6 for A/B, 2^3 for the rest. Built by
// doubling the list of subsets once per box: each existing subset both with and without it.
const combinationsFor = (band: TierBand): string[][] =>
  boxesFor(band).reduce<string[][]>((subsets, box) => [...subsets, ...subsets.map(subset => [...subset, box])], [[]])

// The oracle: the designer's tree, walked in the order it is drawn. Answers the two questions the
// tree decides - is the person eligible, and did they qualify via the accredited programme - for the
// whole flow, so a case that passes through pilot-check is resolved with that answer rather than
// stopping at the question.
//
// Deliberately says nothing about which reason a ruled-out person is shown, nor about which
// questions they were asked on the way. The tree draws the shared disqualifiers at the foot of every
// branch; the code checks them first and stops there, since the pilot answer cannot change the
// outcome for someone who is recalled. Both rule the person out, so the difference is only the
// sentence on not-eligible - asserted on its own below, where the precedence can be stated once.
type ExpectedOutcome = { eligible: false } | { eligible: true; accreditedProgramme: boolean }

const expectedOutcome = (
  band: TierBand,
  status: EligibilityStatus,
  ticked: string[],
  pilot: boolean,
): ExpectedOutcome => {
  const has = (box: string) => ticked.includes(box)
  const notEligible = { eligible: false } as const

  // A supervision package is a hard requirement on every branch of the tree. The ESUP API answers
  // this now rather than the practitioner ticking a box.
  if (!status.onSupervisionPackage) {
    return notEligible
  }

  // The three shared disqualifiers sit at the foot of every branch, so whichever route the person
  // took, one of them rules them out. Written as its own step because the tree draws it
  // once per branch, though the code can settle it up front - the verdict is the same either way.
  // The final third is the ESUP answer now rather than a box, but it sits in the same place.
  const disqualified = has('recalled') || status.inFinalThird || has('deviceRestriction')

  // Tiers A/B split on the accredited programme. On that branch a youth sentence or early
  // engagement rules the person out; off it, neither matters at all.
  if (band === 'AB' && has('accreditedProgramme')) {
    if (has('youthSentence') || status.inEarlyEngagement) {
      return notEligible
    }
    return disqualified ? notEligible : { eligible: true, accreditedProgramme: true }
  }

  // Tiers D-G never see the pilot question and are eligible on the package alone.
  if (band === 'DG') {
    return disqualified ? notEligible : { eligible: true, accreditedProgramme: false }
  }

  // Tiers A/B without a programme, and all of Tier C, qualify only through the pilot cohort.
  if (!pilot || disqualified) {
    return notEligible
  }
  return { eligible: true, accreditedProgramme: false }
}

// Reduces an outcome to the same two questions, so the exhaustive comparison is about eligibility
// rather than the wording shown to the practitioner.
const asExpected = (outcome: EligibilityOutcome): ExpectedOutcome =>
  outcome.target === 'not-eligible'
    ? { eligible: false }
    : { eligible: true, accreditedProgramme: Boolean(outcome.accreditedProgramme) }

// What the code does with the same answers, following the flow through pilot-check when it gets
// there so that both sides describe the end of the flow rather than one step of it.
const actualOutcome = (
  band: TierBand,
  status: EligibilityStatus,
  ticked: string[],
  pilot: boolean,
): EligibilityOutcome => {
  const outcome = nextAfterEligibilityCheck(band, status, ticked)
  if (outcome.target !== 'pilot-check') {
    return outcome
  }
  return nextAfterPilotCheck(band as 'AB' | 'C', pilot ? 'true' : 'false')
}

describe('eligibility decision table', () => {
  // Named so a failure reports the band, the package answer, the ticked boxes and the pilot answer
  // that produced it.
  const cases = bands.flatMap(band =>
    combinationsFor(band).flatMap(ticked =>
      statuses.flatMap(status =>
        [true, false].map(pilot => ({
          name: `${band}: ${ticked.join(' + ') || 'nothing ticked'} (${describeStatus(status)}, pilot ${
            pilot ? 'yes' : 'no'
          })`,
          band,
          status,
          ticked,
          pilot,
        })),
      ),
    ),
  )

  it('covers every combination of the boxes each band is shown', () => {
    // 2^4 A/B + 2^2 C + 2^2 D-G, each with all eight ESUP answers and both pilot answers.
    expect(cases).toHaveLength((2 ** 4 + 2 ** 2 + 2 ** 2) * 8 * 2)
  })

  it.each(cases)('$name', ({ band, status, ticked, pilot }) => {
    expect(asExpected(actualOutcome(band, status, ticked, pilot))).toEqual(expectedOutcome(band, status, ticked, pilot))
  })

  // Every ruled-out person gets something to show, and it has to be one of the real reasons - not
  // undefined, which not-eligible.njk would render as "This is because Joe .". A reason with bullets
  // carries the facts there instead, and its clause may be empty by design.
  it.each(cases)('$name gives a usable reason when ruled out', ({ band, status, ticked, pilot }) => {
    const outcome = actualOutcome(band, status, ticked, pilot)
    if (outcome.target === 'not-eligible') {
      if (outcome.bullets?.length) {
        expect(Object.values(STEMS)).toContain(outcome.reason)
        outcome.bullets.forEach(bullet => expect(Object.values(BULLETS)).toContain(bullet))
      } else {
        expect(Object.values(REASONS)).toContain(outcome.reason)
      }
    }
  })

  // What a ruled-out person is shown when several facts apply at once. The tree does not settle
  // this, so the choices are the code's: the shared disqualifiers come first, being the most
  // specific facts about the person, and every fact that applies is reported rather than just the
  // first - as a bullet list once there is more than one.
  describe('reasons when several apply', () => {
    // Both come from the same ESUP call, so the wording has to settle which is reported.
    it('reports the missing supervision package ahead of everything else', () => {
      expect(
        nextAfterEligibilityCheck('AB', withStatus({ onSupervisionPackage: false, inFinalThird: true }), [
          'recalled',
          'accreditedProgramme',
          'youthSentence',
        ]).reason,
      ).toBe(REASONS.supervisionPackage)
    })

    it('reads a single shared disqualifier as one sentence', () => {
      expect(nextAfterEligibilityCheck('DG', withStatus({ inFinalThird: true }), ['none'])).toEqual({
        target: 'not-eligible',
        reason: REASONS.finalThird,
      })
    })

    // Listed under "This is because Joe:" - the facts are whole clauses, so there is no stem. The
    // final third keeps its place among them now it comes from the ESUP call rather than a box.
    it.each([
      [['deviceRestriction'], [BULLETS.finalThird, BULLETS.deviceRestriction]],
      [
        ['recalled', 'deviceRestriction'],
        [BULLETS.recalled, BULLETS.finalThird, BULLETS.deviceRestriction],
      ],
    ])('lists every shared disqualifier for the final third plus %p', (boxes, bullets) => {
      expect(nextAfterEligibilityCheck('DG', withStatus({ inFinalThird: true }), [...boxes])).toEqual({
        target: 'not-eligible',
        reason: STEMS.disqualifiers,
        bullets,
      })
    })

    it('reports the shared disqualifiers ahead of the programme exclusions', () => {
      expect(
        nextAfterEligibilityCheck('AB', withStatus(), ['accreditedProgramme', 'youthSentence', 'recalled']),
      ).toEqual({
        target: 'not-eligible',
        reason: REASONS.recalled,
      })
    })

    // The final third is a shared disqualifier, so it outranks the programme branch it arrives with.
    it('reports the final third ahead of the programme exclusions', () => {
      expect(
        nextAfterEligibilityCheck('AB', withStatus({ inFinalThird: true, inEarlyEngagement: true }), [
          'accreditedProgramme',
        ]),
      ).toEqual({ target: 'not-eligible', reason: REASONS.finalThird })
    })

    it('reads a single programme exclusion as one sentence', () => {
      expect(nextAfterEligibilityCheck('AB', withStatus({ inEarlyEngagement: true }), ['accreditedProgramme'])).toEqual(
        {
          target: 'not-eligible',
          reason: REASONS.earlyEngagement,
        },
      )
    })

    it('lists both programme exclusions when both apply', () => {
      expect(
        nextAfterEligibilityCheck('AB', withStatus({ inEarlyEngagement: true }), [
          'accreditedProgramme',
          'youthSentence',
        ]),
      ).toEqual({
        target: 'not-eligible',
        reason: STEMS.programme,
        bullets: [BULLETS.youthSentence, BULLETS.earlyEngagement],
      })
    })

    // The pilot answer cannot save someone who is recalled, so the question is not asked at all.
    it('rules a disqualified person out without asking about the pilot', () => {
      expect(nextAfterEligibilityCheck('AB', withStatus(), ['recalled'])).toEqual({
        target: 'not-eligible',
        reason: REASONS.recalled,
      })
    })

    it('tells Tier A/B outside the cohort both of the things that ruled them out', () => {
      expect(nextAfterPilotCheck('AB', 'false')).toEqual({
        target: 'not-eligible',
        reason: STEMS.pilotAB,
        bullets: [BULLETS.noProgramme, BULLETS.noPilot],
      })
    })
  })

  // "None of these apply" asserts that no box below it applies. Every one of those boxes rules the
  // person out by being ticked, so on its own it leaves nothing to find - it decides nothing, and
  // the outcome is whatever the tier and the ESUP answer give. It ruled a person out before only
  // because the supervision package was among the boxes it denied.
  describe('none of these apply', () => {
    it.each(bands)('leaves a %s person to be judged on their tier alone', band => {
      expect(nextAfterEligibilityCheck(band, withStatus(), ['none'])).toEqual(
        nextAfterEligibilityCheck(band, withStatus(), []),
      )
    })

    // Exclusive in the browser only, so a forged submission can arrive with it and a disqualifier
    // at once. The box asserts nothing the rules rely on, so the disqualifiers still decide.
    it.each(bands)('is ignored when a %s person sends it alongside every other box', band => {
      expect(nextAfterEligibilityCheck(band, withStatus(), ['none', ...boxesFor(band)])).toEqual(
        nextAfterEligibilityCheck(band, withStatus(), boxesFor(band)),
      )
    })

    it.each(bands)('cannot make a %s person eligible without a supervision package', band => {
      expect(nextAfterEligibilityCheck(band, withStatus({ onSupervisionPackage: false }), ['none'])).toEqual({
        target: 'not-eligible',
        reason: REASONS.supervisionPackage,
      })
    })

    // The boxes are all it asserts anything about - the ESUP answers are not the practitioner's to
    // deny, so ticking it cannot clear the final third.
    it.each(bands)('cannot make a %s person in the final third eligible', band => {
      expect(nextAfterEligibilityCheck(band, withStatus({ inFinalThird: true }), ['none'])).toEqual({
        target: 'not-eligible',
        reason: REASONS.finalThird,
      })
    })
  })

  // The tier bands are decided by the letter of the tier score, so every letter A-G must reach the
  // band whose rules the designer's tree gives it.
  describe('tier score to band', () => {
    it.each([
      ['A', 'is-eligible'],
      ['B', 'is-eligible'],
    ])('routes %s through the accredited programme branch', (_tier, target) => {
      expect(nextAfterEligibilityCheck('AB', withStatus(), ['accreditedProgramme']).target).toBe(target)
    })

    it('asks Tier C about the pilot even on an accredited programme', () => {
      // The box is not rendered for Tier C, but a forged submission must not open the A/B route.
      expect(nextAfterEligibilityCheck('C', withStatus(), ['accreditedProgramme']).target).toBe('pilot-check')
    })

    it('ignores a forged youth sentence for Tier C', () => {
      expect(nextAfterEligibilityCheck('C', withStatus(), ['youthSentence']).target).toBe('pilot-check')
    })

    it.each(['accreditedProgramme', 'youthSentence'])('ignores a forged %s for Tiers D-G', box => {
      expect(nextAfterEligibilityCheck('DG', withStatus(), [box])).toEqual({
        target: 'is-eligible',
        accreditedProgramme: false,
      })
    })

    // Early engagement is a programme-branch rule, and the branch is Tier A/B's alone - so even with
    // the box forged onto the submission, the other bands are unaffected by the ESUP answer.
    it.each(['C', 'DG'] as const)('ignores early engagement for Tier %s on a forged programme box', band => {
      expect(nextAfterEligibilityCheck(band, withStatus({ inEarlyEngagement: true }), ['accreditedProgramme'])).toEqual(
        nextAfterEligibilityCheck(band, withStatus(), ['accreditedProgramme']),
      )
    })
  })

  // An unanswered pilot question must not be read as a yes; validation normally catches it first.
  describe('pilot answers other than yes', () => {
    it.each(['', 'false', 'nonsense', 'TRUE'])('treats %p as outside the pilot cohort', answer => {
      expect(nextAfterPilotCheck('AB', answer).target).toBe('not-eligible')
    })
  })
})
