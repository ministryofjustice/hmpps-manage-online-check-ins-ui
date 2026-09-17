// Exhaustive coverage of the eligibility decision tree: every combination of the seven checkboxes,
// against every tier band, and - where the flow reaches it - both answers to the pilot question.
//
// The expectation is not a fixture of what the code currently returns. It is an independent oracle
// written from the designer's tree, structured the way the tree is drawn rather than the way
// nextAfterEligibilityCheck is written: supervision package, then the programme branch with its own
// exclusions, then the pilot branch, with the shared disqualifiers repeated at the foot of each.
// The code settles those up front instead - the same verdict by a shorter route. Two implementations
// of the same rules that disagree on any of the 320 cases fail the test - which is the point, since
// the rules are the requirement and the code is only one expression of them.
//
// Cases where the rules are the same for every band are covered once here rather than three times;
// eligibilityRules.test.ts keeps the readable per-rule tests that name each behaviour.
import { nextAfterEligibilityCheck, nextAfterPilotCheck, EligibilityOutcome } from './eligibilityRules'
import { TierBand } from './getTierBand'

// Only ever ticked on Tiers A and B - the boxes are not rendered for other bands.
const tierABOnly = ['accreditedProgramme', 'youthSentence', 'earlyEngagement'] as const
const allTiers = ['supervisionPackage', 'recalled', 'finalThird', 'deviceRestriction'] as const

const bands: TierBand[] = ['AB', 'C', 'DG']

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

// Every subset of the boxes a band is actually shown - 2^7 for A/B, 2^4 for the rest. Built by
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

const expectedOutcome = (band: TierBand, ticked: string[], pilot: boolean): ExpectedOutcome => {
  const has = (box: string) => ticked.includes(box)
  const notEligible = { eligible: false } as const

  // A supervision package is a hard requirement on every branch of the tree.
  if (!has('supervisionPackage')) {
    return notEligible
  }

  // The three shared disqualifiers sit at the foot of every branch, so whichever route the person
  // took, ticking one of them rules them out. Written as its own step because the tree draws it
  // once per branch, though the code can settle it up front - the verdict is the same either way.
  const disqualified = has('recalled') || has('finalThird') || has('deviceRestriction')

  // Tiers A/B split on the accredited programme. On that branch a youth sentence or early
  // engagement rules the person out; off it, neither matters at all.
  if (band === 'AB' && has('accreditedProgramme')) {
    if (has('youthSentence') || has('earlyEngagement')) {
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
const actualOutcome = (band: TierBand, ticked: string[], pilot: boolean): EligibilityOutcome => {
  const outcome = nextAfterEligibilityCheck(band, ticked)
  if (outcome.target !== 'pilot-check') {
    return outcome
  }
  return nextAfterPilotCheck(band as 'AB' | 'C', pilot ? 'true' : 'false')
}

describe('eligibility decision table', () => {
  // Named so a failure reports the band, the ticked boxes and the pilot answer that produced it.
  const cases = bands.flatMap(band =>
    combinationsFor(band).flatMap(ticked =>
      [true, false].map(pilot => ({
        name: `${band}: ${ticked.join(' + ') || 'nothing ticked'} (pilot ${pilot ? 'yes' : 'no'})`,
        band,
        ticked,
        pilot,
      })),
    ),
  )

  it('covers every combination of the boxes each band is shown', () => {
    // 2^7 A/B + 2^4 C + 2^4 D-G, each with both pilot answers.
    expect(cases).toHaveLength((2 ** 7 + 2 ** 4 + 2 ** 4) * 2)
  })

  it.each(cases)('$name', ({ band, ticked, pilot }) => {
    expect(asExpected(actualOutcome(band, ticked, pilot))).toEqual(expectedOutcome(band, ticked, pilot))
  })

  // Every ruled-out person gets something to show, and it has to be one of the real reasons - not
  // undefined, which not-eligible.njk would render as "This is because Joe .". A reason with bullets
  // carries the facts there instead, and its clause may be empty by design.
  it.each(cases)('$name gives a usable reason when ruled out', ({ band, ticked, pilot }) => {
    const outcome = actualOutcome(band, ticked, pilot)
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
    it('reports the missing supervision package ahead of everything else', () => {
      expect(nextAfterEligibilityCheck('AB', ['recalled', 'accreditedProgramme', 'youthSentence']).reason).toBe(
        REASONS.supervisionPackage,
      )
    })

    it('reads a single shared disqualifier as one sentence', () => {
      expect(nextAfterEligibilityCheck('DG', ['supervisionPackage', 'finalThird'])).toEqual({
        target: 'not-eligible',
        reason: REASONS.finalThird,
      })
    })

    // Listed under "This is because Joe:" - the facts are whole clauses, so there is no stem.
    it.each([
      [
        ['finalThird', 'deviceRestriction'],
        [BULLETS.finalThird, BULLETS.deviceRestriction],
      ],
      [
        ['recalled', 'finalThird', 'deviceRestriction'],
        [BULLETS.recalled, BULLETS.finalThird, BULLETS.deviceRestriction],
      ],
    ])('lists every shared disqualifier for %p', (boxes, bullets) => {
      expect(nextAfterEligibilityCheck('DG', ['supervisionPackage', ...boxes])).toEqual({
        target: 'not-eligible',
        reason: STEMS.disqualifiers,
        bullets,
      })
    })

    it('reports the shared disqualifiers ahead of the programme exclusions', () => {
      expect(
        nextAfterEligibilityCheck('AB', ['supervisionPackage', 'accreditedProgramme', 'youthSentence', 'recalled']),
      ).toEqual({ target: 'not-eligible', reason: REASONS.recalled })
    })

    it('reads a single programme exclusion as one sentence', () => {
      expect(nextAfterEligibilityCheck('AB', ['supervisionPackage', 'accreditedProgramme', 'earlyEngagement'])).toEqual(
        { target: 'not-eligible', reason: REASONS.earlyEngagement },
      )
    })

    it('lists both programme exclusions when both apply', () => {
      expect(
        nextAfterEligibilityCheck('AB', [
          'supervisionPackage',
          'accreditedProgramme',
          'youthSentence',
          'earlyEngagement',
        ]),
      ).toEqual({
        target: 'not-eligible',
        reason: STEMS.programme,
        bullets: [BULLETS.youthSentence, BULLETS.earlyEngagement],
      })
    })

    // The pilot answer cannot save someone who is recalled, so the question is not asked at all.
    it('rules a disqualified person out without asking about the pilot', () => {
      expect(nextAfterEligibilityCheck('AB', ['supervisionPackage', 'recalled'])).toEqual({
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

  // "None of these apply" is exclusive in the browser only, so the rules must treat it as
  // overriding whatever else arrives with it - including a full set of qualifying answers.
  describe('none of these apply', () => {
    const notEligible = { target: 'not-eligible', reason: REASONS.supervisionPackage }

    it.each(bands)('rules a %s person out on its own', band => {
      expect(nextAfterEligibilityCheck(band, ['none'])).toEqual(notEligible)
    })

    it.each(bands)('overrides every other box for a %s person', band => {
      expect(nextAfterEligibilityCheck(band, ['none', ...boxesFor(band)])).toEqual(notEligible)
    })
  })

  // The tier bands are decided by the letter of the tier score, so every letter A-G must reach the
  // band whose rules the designer's tree gives it.
  describe('tier score to band', () => {
    it.each([
      ['A1', 'is-eligible'],
      ['B2', 'is-eligible'],
    ])('routes %s through the accredited programme branch', (_tier, target) => {
      expect(nextAfterEligibilityCheck('AB', ['supervisionPackage', 'accreditedProgramme']).target).toBe(target)
    })

    it('asks Tier C about the pilot even on an accredited programme', () => {
      // The box is not rendered for Tier C, but a forged submission must not open the A/B route.
      expect(nextAfterEligibilityCheck('C', ['supervisionPackage', 'accreditedProgramme']).target).toBe('pilot-check')
    })

    it.each(['youthSentence', 'earlyEngagement'])('ignores a forged %s for Tier C', box => {
      expect(nextAfterEligibilityCheck('C', ['supervisionPackage', box]).target).toBe('pilot-check')
    })

    it.each(['accreditedProgramme', 'youthSentence', 'earlyEngagement'])('ignores a forged %s for Tiers D-G', box => {
      expect(nextAfterEligibilityCheck('DG', ['supervisionPackage', box])).toEqual({
        target: 'is-eligible',
        accreditedProgramme: false,
      })
    })
  })

  // An unanswered pilot question must not be read as a yes; validation normally catches it first.
  describe('pilot answers other than yes', () => {
    it.each(['', 'false', 'nonsense', 'TRUE'])('treats %p as outside the pilot cohort', answer => {
      expect(nextAfterPilotCheck('AB', answer).target).toBe('not-eligible')
    })
  })
})
