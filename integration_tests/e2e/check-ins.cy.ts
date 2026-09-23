import { DateTime } from 'luxon'
import ManageCheckins from '../pages/check-ins/manage-checkins'
import AddQuestionsPage from '../pages/check-ins/questions/add-questions'
import EditQuestionPage from '../pages/check-ins/questions/edit-question'
import InstructionsPage from '../pages/check-ins/questions/instructions'
import ListQuestionsPage from '../pages/check-ins/questions/list-questions'
import PreviewFeelingPage from '../pages/check-ins/questions/preview/feeling'
import PreviewSupportPage from '../pages/check-ins/questions/preview/support'
import RestartContactPreferencePage from '../pages/check-ins/restart/restart-contact-preference.page'
import RestartDateFrequencyPage from '../pages/check-ins/restart/restart-date-frequency.page'
import RestartEditContactPreferencePage from '../pages/check-ins/restart/restart-edit-contact-preference.page'
import StopCheckins from '../pages/check-ins/stop-checkins'
import CheckYourAnswersPage from '../pages/check-ins/check-your-answers'
import CheckinConfirmationPage from '../pages/check-ins/confirmation.page'
import ConfirmContactPreferencePage from '../pages/check-ins/confirm-contact-preference'
import ContactPreferencePage from '../pages/check-ins/contact-preference'
import AccreditedProgrammeApprovalPage from '../pages/check-ins/accredited-programme-approval'
import DateFrequencyPage from '../pages/check-ins/date-frequencey'
import EditContactPreferencePage from '../pages/check-ins/edit-contact-preference'
import EligibilityCheckPage from '../pages/check-ins/eligibility/eligibility-check'
import TiersABEligibilityCheckPage from '../pages/check-ins/eligibility/tiers-a-b-eligibility-check'
import PilotCheckPage from '../pages/check-ins/eligibility/pilot-check'
import IsEligiblePage from '../pages/check-ins/eligibility/is-eligible'
import NotEligiblePage from '../pages/check-ins/eligibility/not-eligible'
import DiscussBeforeSignupPage from '../pages/check-ins/eligibility/discuss-before-signup'
import PhotoOptionsPage from '../pages/check-ins/photo-options'
import PhotoRulesPage from '../pages/check-ins/photo-rules'
import RationalePage from '../pages/check-ins/rationale'
import TakeAPhotoPage from '../pages/check-ins/take-a-photo'
import TakeAPhotoOptionsPage from '../pages/check-ins/take-a-photo-options'
import UploadAPhotoPage from '../pages/check-ins/upload-a-photo'
import ErrorPage from '../pages/error'
import { getCheckinUuid } from '../utils/common'

// The header stub derives each CRN's tier from its last digit, so a spec picks its CRN to pick
// the tier band the eligibility rules will apply. See wiremock/mappings/eSupervisionAPI.json.
//
// X000001 is the primary case, with the full fixture the downstream specs assert against, and
// the stub's default tier is D1 so that it lands in D-G - the band that reaches date-frequency
// in the fewest steps.
const CRN_TIER_AB = 'X000004'
const CRN_TIER_C = 'X000002'
const CRN_TIER_DG = 'X000001'
// Stubbed to answer false for the supervision-package check - see wiremock/mappings/eSupervisionAPI.json.
const CRN_NOT_ON_SUPERVISION_PACKAGE = 'X000003'
// The two ways a tier can be unusable. X000010 answers with the score 'MISSING', which is how the
// API reports a person with no tier assigned; X000009's header endpoint 404s, which getPersonalDetails
// coerces to an empty score and which means the same thing. X000011 answers with a score that is
// present but not a tier we recognise - unexpected data, and the only one of the three that errors.
const CRN_TIER_MISSING = 'X000010'
const CRN_TIER_MISSING_NO_HEADER = 'X000009'
const CRN_TIER_UNREADABLE = 'X000011'
// X000012 has a readable tier (D1) that the header flags as provisional, so nothing but the flag
// rules the person out - the rules would otherwise take them all the way to is-eligible.
const CRN_TIER_PROVISIONAL = 'X000012'
// X000013's header answers 'NOT_SUPERVISED', which rules the person out outright.
const CRN_NOT_SUPERVISED = 'X000013'

// failOnStatusCode is for the pages that are meant to answer with an error status - cy.visit
// treats any non-2xx as a test failure otherwise, even when the error page is what we asserted on.
const loadPage = (crn: string = CRN_TIER_DG, failOnStatusCode = true) => {
  cy.task('resetMocks')
  cy.visit(`/case/${crn}/appointments/check-in/eligibility-check`, { failOnStatusCode })
}

// Every setup spec starts here: the eligibility check is the wizard's opening page, and the only
// way through to rationale, date-frequency and beyond.
const startSetup = (crn: string = CRN_TIER_DG) => {
  loadPage(crn)
  return new EligibilityCheckPage()
}

// Tiers A and B are asked about the accredited programme, youth sentences and early engagement
// on top of the boxes every tier gets, so their specs need the wider page object.
const startSetupTiersAB = () => {
  loadPage(CRN_TIER_AB)
  return new TiersABEligibilityCheckPage()
}

// Tiers D-G are eligible on the ESUP supervision-package answer alone and go straight from
// is-eligible to date-frequency - the shortest route to the pages that follow eligibility.
// "None of these apply" is how an eligible person is submitted now that every other box is a
// disqualifier; validation still requires an answer.
const completeEligibilityCheck = () => {
  const checkPage = new EligibilityCheckPage()
  checkPage.getNone().click()
  checkPage.getSubmitBtn().click()
  const isEligiblePage = new IsEligiblePage()
  isEligiblePage.confirmDiscussion()
  isEligiblePage.getSubmitBtn().click()
}

// The downstream setup specs all reach their page this way. The error-scenario specs instead
// call loadPage and completeEligibilityCheck themselves, so they can stub a failing API
// response after loadPage has reset the mocks.
const passEligibilityCheck = (crn: string = CRN_TIER_DG) => {
  startSetup(crn)
  completeEligibilityCheck()
}

// The Tier A/B accredited-programme cohort is the only one that reaches approval and rationale,
// so the rationale specs come through here.
const passEligibilityCheckToRationale = () => {
  const checkPage = startSetupTiersAB()
  checkPage.getAccreditedProgramme().click()
  checkPage.getSubmitBtn().click()
  const isEligiblePage = new IsEligiblePage()
  isEligiblePage.confirmDiscussion({ accreditedProgramme: true })
  isEligiblePage.getSubmitBtn().click()
  const approvalPage = new AccreditedProgrammeApprovalPage()
  approvalPage.getCheckboxField('accreditedProgrammeApproval').click()
  approvalPage.getSubmitBtn().click()
}

const confirmContactPreference = () => {
  const confirmContactPreferencePage = new ConfirmContactPreferencePage()
  confirmContactPreferencePage.checkOnPage()
  confirmContactPreferencePage.getConfirmPreferredComs().find('input[value="YES"]').click()
  confirmContactPreferencePage.getSubmitBtn().click()
}

const rejectContactPreferenceAndEdit = (): EditContactPreferencePage => {
  const confirmContactPreferencePage = new ConfirmContactPreferencePage()
  confirmContactPreferencePage.checkOnPage()
  confirmContactPreferencePage.getConfirmPreferredComs().find('input[value="NO"]').click()
  confirmContactPreferencePage.getSubmitBtn().click()
  const editContactPreferencePage = new EditContactPreferencePage()
  editContactPreferencePage.checkOnPage()
  return editContactPreferencePage
}

context('Appointment check-ins', () => {
  // The tier band decides which eligibility rules apply and which template renders, so there is
  // one walkthrough per band. Each uses a CRN whose stubbed tier puts it in that band.
  describe('eligibility, tiers A and B', () => {
    it('routes the accredited programme cohort through approval and rationale', () => {
      const checkPage = startSetupTiersAB()
      checkPage.getAccreditedProgramme().click()
      checkPage.getSubmitBtn().click()

      const isEligiblePage = new IsEligiblePage()
      isEligiblePage.confirmDiscussion({ accreditedProgramme: true })
      isEligiblePage.getSubmitBtn().click()

      // Only this cohort passes through approval and rationale on the way to date-frequency.
      const approvalPage = new AccreditedProgrammeApprovalPage()
      approvalPage.getCheckboxField('accreditedProgrammeApproval').click()
      approvalPage.getSubmitBtn().click()

      const rationalePage = new RationalePage()
      rationalePage.rationaleNotes().find('textarea').type('On an accredited programme')
      rationalePage.getSubmitBtn().click()

      new DateFrequencyPage().checkOnPage()
    })

    // The accredited programme is the A/B route that skips the pilot question; without it the
    // pilot cohort is the only way through.
    it('asks about the pilot cohort when the person is not on an accredited programme', () => {
      const checkPage = startSetupTiersAB()
      checkPage.getNone().click()
      checkPage.getSubmitBtn().click()

      const pilotCheckPage = new PilotCheckPage()
      pilotCheckPage.getYes().click()
      pilotCheckPage.getSubmitBtn().click()

      const isEligiblePage = new IsEligiblePage()
      isEligiblePage.confirmDiscussion()
      isEligiblePage.getSubmitBtn().click()

      new DateFrequencyPage().checkOnPage()
    })

    // On the accredited-programme branch early engagement rules the person out outright - there is
    // no pilot question left to fall back on.
    it('rules the programme cohort out when the person is in early engagement', () => {
      const checkPage = startSetupTiersAB()
      checkPage.getAccreditedProgramme().click()
      checkPage.getEarlyEngagement().click()
      checkPage.getSubmitBtn().click()

      new NotEligiblePage()
        .getReason()
        .should('contain', 'is in Tier A/B and on an accredited programme, but they are in early engagement')
    })

    // Both exclusions at once are listed beneath the clause rather than reported one at a time.
    it('lists both programme exclusions when both apply', () => {
      const checkPage = startSetupTiersAB()
      checkPage.getAccreditedProgramme().click()
      checkPage.getYouthSentence().click()
      checkPage.getEarlyEngagement().click()
      checkPage.getSubmitBtn().click()

      const notEligiblePage = new NotEligiblePage()
      notEligiblePage.getReason().should('contain', 'is in Tier A/B and on an accredited programme, but they are')
      notEligiblePage.getReasonBullets().should('have.length', 2)
      notEligiblePage.getReasonBullets().first().should('contain', 'on a youth sentence')
      notEligiblePage.getReasonBullets().last().should('contain', 'in early engagement')
    })

    // Off the programme branch neither exclusion matters, so the pilot cohort still decides.
    it('ignores early engagement when the person is not on an accredited programme', () => {
      const checkPage = startSetupTiersAB()
      checkPage.getEarlyEngagement().click()
      checkPage.getSubmitBtn().click()

      const pilotCheckPage = new PilotCheckPage()
      pilotCheckPage.getYes().click()
      pilotCheckPage.getSubmitBtn().click()

      const isEligiblePage = new IsEligiblePage()
      isEligiblePage.confirmDiscussion()
      isEligiblePage.getSubmitBtn().click()

      // Outside the accredited programme cohort there is no approval or rationale step.
      new DateFrequencyPage().checkOnPage()
    })

    // Tier A/B reaching the pilot question are off the programme branch too, so both facts that
    // ruled them out are listed.
    it('rules the person out when they are not in the pilot cohort', () => {
      const checkPage = startSetupTiersAB()
      checkPage.getNone().click()
      checkPage.getSubmitBtn().click()

      const pilotCheckPage = new PilotCheckPage()
      pilotCheckPage.getNo().click()
      pilotCheckPage.getSubmitBtn().click()

      const notEligiblePage = new NotEligiblePage()
      notEligiblePage.getReason().should('contain', 'is in Tier A/B and')
      notEligiblePage.getReasonBullets().should('have.length', 2)
      notEligiblePage.getReasonBullets().first().should('contain', 'not on an accredited programme')
      notEligiblePage
        .getReasonBullets()
        .last()
        .should('contain', 'no people who were signed up to use online check ins before 1 October 2026')
    })

    it('shows a validation error when the pilot cohort question is not answered', () => {
      const checkPage = startSetupTiersAB()
      checkPage.getNone().click()
      checkPage.getSubmitBtn().click()

      const pilotCheckPage = new PilotCheckPage()
      pilotCheckPage.getSubmitBtn().click()
      pilotCheckPage.checkErrorSummaryBox([
        'Select if you have one or more people who started using online check ins before 1 October 2026',
      ])
    })
  })

  describe('eligibility, tier C', () => {
    // The accredited programme, youth sentence and early engagement boxes are Tier A/B rules, so
    // the tier C template does not offer them at all.
    it('does not ask about the accredited programme', () => {
      startSetup(CRN_TIER_C)
      cy.get('input[value="accreditedProgramme"]').should('not.exist')
      cy.get('input[value="youthSentence"]').should('not.exist')
      cy.get('input[value="earlyEngagement"]').should('not.exist')
    })

    it('always asks about the pilot cohort', () => {
      const checkPage = startSetup(CRN_TIER_C)
      checkPage.getNone().click()
      checkPage.getSubmitBtn().click()

      const pilotCheckPage = new PilotCheckPage()
      pilotCheckPage.getYes().click()
      pilotCheckPage.getSubmitBtn().click()

      const isEligiblePage = new IsEligiblePage()
      isEligiblePage.confirmDiscussion()
      isEligiblePage.getSubmitBtn().click()

      new DateFrequencyPage().checkOnPage()
    })

    it('rules the person out with the tier C pilot reason', () => {
      const checkPage = startSetup(CRN_TIER_C)
      checkPage.getNone().click()
      checkPage.getSubmitBtn().click()

      const pilotCheckPage = new PilotCheckPage()
      pilotCheckPage.getNo().click()
      pilotCheckPage.getSubmitBtn().click()

      const notEligiblePage = new NotEligiblePage()
      notEligiblePage.getReason().should('contain', 'is in Tier C and you do not have one or more people')
    })
  })

  describe('eligibility, tiers D to G', () => {
    it('is eligible outright, with no pilot check', () => {
      const checkPage = startSetup(CRN_TIER_DG)
      checkPage.getNone().click()
      checkPage.getSubmitBtn().click()

      const isEligiblePage = new IsEligiblePage()
      isEligiblePage.confirmDiscussion()
      isEligiblePage.getSubmitBtn().click()

      new DateFrequencyPage().checkOnPage()
    })

    // The accredited programme route is a Tier A/B rule, so the box is not offered here either.
    it('does not ask about the accredited programme', () => {
      startSetup(CRN_TIER_DG)
      cy.get('input[value="accreditedProgramme"]').should('not.exist')
      cy.get('input[value="youthSentence"]').should('not.exist')
      cy.get('input[value="earlyEngagement"]').should('not.exist')
    })
  })

  describe('eligibility, rules that apply to every tier', () => {
    // The supervision package is no longer asked about - the ESUP API answers it
    it('does not ask the practitioner about the supervision package', () => {
      startSetup()
      cy.get('input[value="supervisionPackage"]').should('not.exist')
    })

    // A blanket failure whatever the tier - the eligibility-check form is skipped entirely since
    // no checkbox on it could change this outcome. See getEligibilityPage in check-ins.ts.
    it('sends the person straight to not-eligible when the ESUP API says they are not on a supervision package', () => {
      loadPage(CRN_NOT_ON_SUPERVISION_PACKAGE)
      new NotEligiblePage().getReason().should('contain', 'is not on a supervision package')
    })

    // Every remaining box rules the person out, so this is how an eligible person is submitted.
    it('lets the person through when none of the boxes apply', () => {
      const checkPage = startSetup()
      checkPage.getNone().click()
      checkPage.getSubmitBtn().click()

      // The Page constructor asserts the heading, so constructing it is the assertion.
      const isEligiblePage = new IsEligiblePage()
      isEligiblePage.checkOnPage()
    })

    // Leaving the group untouched is neither an answer nor a way of saying none of them apply -
    // that is what "None of these apply" is for.
    it('shows a validation error when nothing is selected', () => {
      const checkPage = startSetup()
      checkPage.getSubmitBtn().click()

      checkPage.checkErrorSummaryBox(['Select if any of these apply to the person'])
    })

    it('rules the person out when they have been recalled', () => {
      const checkPage = startSetup()
      checkPage.getRecalled().click()

      checkPage.getSubmitBtn().click()

      new NotEligiblePage().getReason().should('contain', 'has been recalled to prison')

      // A mis-answered box is the likeliest explanation, so the re-check is offered on every screen.
      cy.contains('you can go back and check eligibility again').should('exist')
    })

    // Several facts at once are listed beneath "This is because <forename>:" rather than reported
    // one at a time - the disqualifiers are whole clauses, so there is no stem above them.
    it('lists every disqualifier when several apply', () => {
      const checkPage = startSetup()
      checkPage.getRecalled().click()
      checkPage.getFinalThird().click()
      checkPage.getSubmitBtn().click()

      const notEligiblePage = new NotEligiblePage()
      notEligiblePage.getReasonBullets().should('have.length', 2)
      notEligiblePage.getReasonBullets().first().should('contain', 'has been recalled to prison')
      notEligiblePage.getReasonBullets().last().should('contain', 'is in the final third of their sentence')
    })

    it('rules the person out in the final third of their sentence', () => {
      const checkPage = startSetup()
      checkPage.getFinalThird().click()
      checkPage.getSubmitBtn().click()

      new NotEligiblePage().getReason().should('contain', 'is in the final third of their sentence')
    })

    it('rules the person out with a device or internet restriction', () => {
      const checkPage = startSetup()
      checkPage.getDeviceRestriction().click()
      checkPage.getSubmitBtn().click()

      new NotEligiblePage().getReason().should('contain', 'cannot use a device or the internet')
    })

    // A part-filled set of discussion boxes means the conversation with the person has not
    // happened yet, which is guidance rather than a validation error.
    it('sends the practitioner to speak to the person when the discussion is incomplete', () => {
      const checkPage = startSetup()
      checkPage.getNone().click()
      checkPage.getSubmitBtn().click()

      const isEligiblePage = new IsEligiblePage()
      isEligiblePage.getOptional().click()
      isEligiblePage.getSubmitBtn().click()

      new DiscussBeforeSignupPage().checkOnPage()
    })

    // "I have not done all of these" says outright what a part-filled set implies, and takes the
    // same route.
    it('sends the practitioner to speak to the person when they have not done all of these', () => {
      const checkPage = startSetup()
      checkPage.getNone().click()
      checkPage.getSubmitBtn().click()

      const isEligiblePage = new IsEligiblePage()
      isEligiblePage.getNotAll().click()
      isEligiblePage.getSubmitBtn().click()

      new DiscussBeforeSignupPage().checkOnPage()
    })

    // Leaving the group untouched says nothing either way, so it is a validation error rather than
    // an answer.
    it('shows a validation error when no discussion box is ticked', () => {
      const checkPage = startSetup()
      checkPage.getNone().click()
      checkPage.getSubmitBtn().click()

      const isEligiblePage = new IsEligiblePage()
      isEligiblePage.getSubmitBtn().click()

      isEligiblePage.checkErrorSummaryBox(['Select if you have discussed any of these with the person'])
    })

    // Every rule keys off the tier, so a score we cannot read is an error rather than a default band.
    // The page answers 500, which is the point - hence failOnStatusCode: false.
    it('shows an error page when the tier cannot be read', () => {
      loadPage(CRN_TIER_UNREADABLE, false)
      new ErrorPage().checkPageTitle('Sorry, there is a problem with the service')
    })

    // No header at all leaves an empty score, which says the same thing as 'MISSING' - so it rules
    // the person out with the same reason rather than erroring.
    it('rules the person out when no header details exist to carry a tier', () => {
      loadPage(CRN_TIER_MISSING_NO_HEADER)
      new NotEligiblePage()
        .getMissingTierGuidance()
        .should('contain', 'This is because they have not been assigned a Tier yet')
    })

    // A tier the API reports as 'MISSING' is a fact about the record, not a fault - so the person is
    // ruled out with a reason, without being asked any of the eligibility questions first. It is
    // worded impersonally, unlike the reasons that complete "This is because <forename> …".
    it('rules the person out without asking anything when they have no Tier yet', () => {
      loadPage(CRN_TIER_MISSING)
      const notEligiblePage = new NotEligiblePage()
      notEligiblePage
        .getMissingTierGuidance()
        .should('contain', 'This is because they have not been assigned a Tier yet')
      notEligiblePage
        .getGuidance()
        .should('contain', 'risk scores have been completed')
        .should('contain', 'You can come back and check eligibility again')
    })

    // A provisional tier reads as a real score, so only the header's flag rules the person out -
    // and it does so before any question is asked, as a missing tier does.
    it('rules the person out without asking anything when their Tier is only provisional', () => {
      loadPage(CRN_TIER_PROVISIONAL)
      const notEligiblePage = new NotEligiblePage()
      notEligiblePage
        .getProvisionalTierGuidance()
        .should('contain', 'This is because they are currently in a provisional Tier')
      notEligiblePage
        .getGuidance()
        .should('contain', 'the system has calculated their final Tier')
        .should('contain', 'You can come back and check eligibility again')
    })

    // An automatic disqualification like a missing tier, but one that cannot clear - so it lists what
    // might explain it rather than inviting the practitioner to check eligibility again.
    it('rules the person out when they are no longer being supervised', () => {
      loadPage(CRN_NOT_SUPERVISED)
      const notEligiblePage = new NotEligiblePage()
      notEligiblePage
        .getNotSupervisedGuidance()
        .should('contain', 'This is because they are not currently being supervised')
      notEligiblePage.getGuidance().should('contain', 'This could be because they have')
      notEligiblePage
        .getNotSupervisedReasons()
        .should('have.length', 3)
        .then(items => {
          expect([...items].map(item => item.textContent.trim())).to.deep.equal([
            'passed away',
            'been recalled to prison',
            'have finished their probation',
          ])
        })
      notEligiblePage.getBackLink().should('have.attr', 'href', `/case/${CRN_NOT_SUPERVISED}`)
      notEligiblePage.getSubmitBtn().should('contain', "Go to Tier's overview")
    })
  })

  it('should be able to submit rationale details', () => {
    passEligibilityCheckToRationale()
    const rationalePage = new RationalePage()
    rationalePage.rationaleNotes().find('textarea').type('Low risk of reoffending')
    rationalePage.getSubmitBtn().click()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
  })

  it('rationale page should fail with validation errors', () => {
    passEligibilityCheckToRationale()
    const rationalePage = new RationalePage()

    rationalePage.getSubmitBtn().click()
    rationalePage.getErrorSummaryBox().should('be.visible')
  })

  it('check-in frequency page should fail with validation errors', () => {
    passEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    dateFrequencyPage.getSubmitBtn().click()
    dateFrequencyPage.checkErrorSummaryBox([
      'Enter the date you would like the person to complete their first check in',
      'Select how often you would like the person to check in',
    ])

    getCheckinUuid().then(uuid => {
      dateFrequencyPage.getElement(`#esupervision-X000001-${uuid}-checkins-date-error`).should($error => {
        expect($error.text().trim()).to.include(
          'Enter the date you would like the person to complete their first check in',
        )
      })
      dateFrequencyPage.getElement(`#esupervision-X000001-${uuid}-checkins-interval-error`).should($error => {
        expect($error.text().trim()).to.include('Select how often you would like the person to check in')
      })
    })
  })

  it('should be able to submit check-in frequency details', () => {
    passEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
  })

  it('contact preference page should fail with validation errors', () => {
    passEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage.getSubmitBtn().click()
    getCheckinUuid().then(uuid => {
      dateFrequencyPage.getElement(`#esupervision-X000001-${uuid}-checkins-preferredComs-error`).should($error => {
        expect($error.text().trim()).to.include('Select how the person wants us to send a link to the service')
      })
    })
  })

  it('should be able to submit contact preference details', () => {
    passEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    confirmContactPreference()

    const photoOptionsPage = new PhotoOptionsPage()
    photoOptionsPage.checkOnPage()
  })

  it('should be able to edit contact preference details', () => {
    passEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    const editContactPreferencePage = rejectContactPreferenceAndEdit()
    editContactPreferencePage.getContactValueInput().clear().type('07700900456')
    editContactPreferencePage.getSubmitBtn().click()
    const photoOptionsPage = new PhotoOptionsPage()
    photoOptionsPage.checkOnPage()
  })

  it('should be able to choose photo options', () => {
    passEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    confirmContactPreference()
    const takeAPhotoOptionsPage = new TakeAPhotoOptionsPage()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    takeAPhotoOptionsPage.getBackLink().click()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(1).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    const uploadablePhoto = new UploadAPhotoPage()
    uploadablePhoto.checkOnPage()
    uploadablePhoto.getBackLink().click()
    takeAPhotoOptionsPage.checkOnPage()
  })

  it('should be able to upload a pic and show rules page', () => {
    passEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    confirmContactPreference()
    const takeAPhotoOptionsPage = new TakeAPhotoOptionsPage()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    takeAPhotoOptionsPage.getBackLink().click()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(1).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    const uploadAPhoto = new UploadAPhotoPage()
    uploadAPhoto.checkOnPage()
    uploadAPhoto.uploadPhoto('person.jpg')
    uploadAPhoto.continueButton().click()
    const photoRules = new PhotoRulesPage()
    photoRules.checkOnPage()
    photoRules.getBackLink().click()
    uploadAPhoto.checkOnPage()
  })

  it('should be able to show cya and confirm page', () => {
    passEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    confirmContactPreference()
    const takeAPhotoOptionsPage = new TakeAPhotoOptionsPage()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    takeAPhotoOptionsPage.getBackLink().click()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(1).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    const uploadAPhoto = new UploadAPhotoPage()
    uploadAPhoto.checkOnPage()
    uploadAPhoto.uploadPhoto('person.jpg')
    uploadAPhoto.continueButton().click()
    const photoRules = new PhotoRulesPage()
    photoRules.checkOnPage()
    photoRules.getSubmitBtn().click()
    const checkYourAnswersPage = new CheckYourAnswersPage()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage.getSubmitBtn().click()
    const checkinConfirmationPage = new CheckinConfirmationPage()
    checkinConfirmationPage.checkOnPage()
  })

  it('should be able to take a photo and show cya and confirm page', () => {
    passEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    confirmContactPreference()
    const takeAPhotoOptionsPage = new TakeAPhotoOptionsPage()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    takeAPhotoOptionsPage.getBackLink().click()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    const takeAPhotoPage = new TakeAPhotoPage()
    takeAPhotoPage.checkOnPage()
    takeAPhotoPage.getSubmitBtn().click()
    const photoRules = new PhotoRulesPage()
    photoRules.checkOnPage()
    photoRules.getSubmitBtn().click()
    const checkYourAnswersPage = new CheckYourAnswersPage()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage.getSubmitBtn().click()
    const checkinConfirmationPage = new CheckinConfirmationPage()
    checkinConfirmationPage.checkOnPage()
  })

  it('should be able to change options from cya', () => {
    // Via the Tier A/B accredited-programme route, because rationale is the only answer the
    // summary offers a change link for that other bands never collect.
    passEligibilityCheckToRationale()
    const rationalePage = new RationalePage()
    rationalePage.rationaleNotes().find('textarea').type('Low risk of reoffending')
    rationalePage.getSubmitBtn().click()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    confirmContactPreference()
    const takeAPhotoOptionsPage = new TakeAPhotoOptionsPage()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    takeAPhotoOptionsPage.getBackLink().click()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    const takeAPhotoPage = new TakeAPhotoPage()
    takeAPhotoPage.checkOnPage()
    takeAPhotoPage.getSubmitBtn().click()
    const photoRules = new PhotoRulesPage()
    photoRules.checkOnPage()
    photoRules.getSubmitBtn().click()
    const checkYourAnswersPage = new CheckYourAnswersPage()
    checkYourAnswersPage.checkOnPage()

    // Rationale change
    checkYourAnswersPage
      .getSummaryListRowByAction('rationaleAction')
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Low risk of reoffending')
    checkYourAnswersPage.getElementData('rationaleAction').click()
    rationalePage.checkOnPage()
    rationalePage.rationaleNotes().find('textarea').clear()
    rationalePage.rationaleNotes().find('textarea').type('Hard for them to travel to the office')
    rationalePage.getSubmitBtn().click()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage
      .getSummaryListRowByAction('rationaleAction')
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Hard for them to travel to the office')

    // Date change
    checkYourAnswersPage.getElementData('dateAction').click()
    dateFrequencyPage.checkOnPage()
    dateFrequencyPage.getSubmitBtn().click()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage
      .getSummaryListRowByAction('intervalAction')
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Every week')
    checkYourAnswersPage.getElementData('intervalAction').click()
    dateFrequencyPage.checkOnPage()
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(2).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage
      .getSummaryListRowByAction('intervalAction')
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Every 4 weeks')

    // Contact preference change
    checkYourAnswersPage
      .getSummaryListRowByAction('preferredComsAction')
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Text message')
    checkYourAnswersPage.getElementData('preferredComsAction').click()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(1)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    confirmContactPreference()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage
      .getSummaryListRowByAction('preferredComsAction')
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Email')

    // Email
    checkYourAnswersPage.getElementData('checkInEmailAction').click()
    const editContactPreferencePage = new EditContactPreferencePage()
    editContactPreferencePage.checkOnPage()
    editContactPreferencePage
      .getAlert()
      .should('be.visible')
      .and('contain', 'If you change contact details here, this will update the record in NDelius.')
    editContactPreferencePage.getSubmitBtn().click()
    checkYourAnswersPage.checkOnPage()

    // photo options
    checkYourAnswersPage
      .getSummaryListRowByAction('photoUploadOptionAction')
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Take a photo using this device')
    checkYourAnswersPage.getElementData('photoUploadOptionAction').click()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(1).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    const uploadAPhoto = new UploadAPhotoPage()
    uploadAPhoto.checkOnPage()
    uploadAPhoto.uploadPhoto('person.jpg')
    uploadAPhoto.continueButton().click()

    photoRules.checkOnPage()
    photoRules.getSubmitBtn().click()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage
      .getSummaryListRowByAction('photoUploadOptionAction')
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Upload a photo')
  })
})

context('check-ins error scenario ', () => {
  it('should show error page when update fails with 404 HTTP response code', () => {
    loadPage()
    cy.task('stubUpdatePersonalContact404Response')
    completeEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    const editContactPreferencePage = rejectContactPreferenceAndEdit()
    editContactPreferencePage.getContactValueInput().clear().type('07700900456')
    editContactPreferencePage.getSubmitBtn().click()
    const errorPage = new ErrorPage()
    errorPage.checkPageTitle('Page not found')
  })

  it('should show error page when update fails with 500 HTTP response code', () => {
    loadPage()
    cy.task('stubUpdatePersonalContact500Response')
    completeEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    const editContactPreferencePage = rejectContactPreferenceAndEdit()
    editContactPreferencePage.getContactValueInput().clear().type('07700900456')
    editContactPreferencePage.getSubmitBtn().click()
    const errorPage = new ErrorPage()
    errorPage.checkPageTitle('Sorry, there is a problem with the service')
  })

  it('should be able to show error message when same phone / email already registered', () => {
    loadPage()
    cy.task('stubOffenderSetup422Response')
    completeEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    confirmContactPreference()
    const takeAPhotoOptionsPage = new TakeAPhotoOptionsPage()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    takeAPhotoOptionsPage.getBackLink().click()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(1).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    const uploadAPhoto = new UploadAPhotoPage()
    uploadAPhoto.checkOnPage()
    uploadAPhoto.uploadPhoto('person.jpg')
    uploadAPhoto.continueButton().click()
    const photoRules = new PhotoRulesPage()
    photoRules.checkOnPage()
    photoRules.getSubmitBtn().click()
    const checkYourAnswersPage = new CheckYourAnswersPage()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage.getSubmitBtn().click()
    checkYourAnswersPage
      .getErrorText()
      .should(
        'contain.text',
        "The email address or phone number you've entered is already associated with another person",
      )
  })

  it('should be able to show check ins registration error message', () => {
    loadPage()
    cy.task('stubOffenderSetup500Response')
    completeEligibilityCheck()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()
    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    confirmContactPreference()
    const takeAPhotoOptionsPage = new TakeAPhotoOptionsPage()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    takeAPhotoOptionsPage.getBackLink().click()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(1).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    const uploadAPhoto = new UploadAPhotoPage()
    uploadAPhoto.checkOnPage()
    uploadAPhoto.uploadPhoto('person.jpg')
    uploadAPhoto.continueButton().click()
    const photoRules = new PhotoRulesPage()
    photoRules.checkOnPage()
    photoRules.getSubmitBtn().click()
    const checkYourAnswersPage = new CheckYourAnswersPage()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage.getSubmitBtn().click()
    checkYourAnswersPage.getErrorText().should('contain.text', 'An error occurred during registration')
  })

  it('should be able to show error page, when checkin registration fails', () => {
    loadPage()
    cy.task('stubOffenderSetupComplete500Response')
    completeEligibilityCheck()

    const dateFrequencyPage = new DateFrequencyPage()

    dateFrequencyPage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    dateFrequencyPage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()

    const contactPreferencePage = new ContactPreferencePage()
    contactPreferencePage.checkOnPage()

    contactPreferencePage
      .getCheckInPreferredComs()
      .find('.govuk-radios__item')
      .eq(0)
      .find('.govuk-radios__input')
      .click()
    contactPreferencePage.getSubmitBtn().click()
    confirmContactPreference()
    const takeAPhotoOptionsPage = new TakeAPhotoOptionsPage()
    takeAPhotoOptionsPage.checkOnPage()
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    takeAPhotoOptionsPage.getBackLink().click()
    takeAPhotoOptionsPage.checkOnPage()

    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(1).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    const uploadAPhoto = new UploadAPhotoPage()
    uploadAPhoto.checkOnPage()
    uploadAPhoto.uploadPhoto('person.jpg')
    uploadAPhoto.continueButton().click()
    const photoRules = new PhotoRulesPage()
    photoRules.checkOnPage()

    photoRules.getSubmitBtn().click()
    const checkYourAnswersPage = new CheckYourAnswersPage()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage.getSubmitBtn().click()
    cy.get('h1').should('contain.text', 'Sorry, there is a problem with the service')
    cy.get('body')
      .should('contain.text', 'Try again later.')
      .and(
        'contain.text',
        'Any information you entered has not been saved. When the service is available, you will need to start again.',
      )
  })
})

context('check-ins overview and manage pages', () => {
  it('should be able to stop check in', () => {
    cy.task('resetMocks')
    cy.visit(`/case/X778160/appointments/check-in/manage`)
    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    manageCheckins.getElementData('stop-checkin-btn').click()

    const stopCheckIn = new StopCheckins()
    stopCheckIn.checkOnPage()

    stopCheckIn.getSubmitBtn().click()

    stopCheckIn.checkErrorSummaryBox([
      'Enter the reason for stopping',
      'Select yes if the reason for stopping includes sensitive information',
    ])
    stopCheckIn.getElementData('stop-checkin-reason').find('textarea').type('No longer available')

    stopCheckIn.getElementData('sensitiveContact').find('input[type="radio"][value="false"]').click({ force: true })

    cy.intercept(
      'POST',
      '/case/X778160/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/stop-checkin',
    ).as('stopCheckin')

    stopCheckIn.getSubmitBtn().click()

    cy.wait('@stopCheckin').then(({ response }) => {
      expect(response?.headers.location).to.eq(
        '/case/X778160/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7',
      )
    })
  })
  it('should be able to stop and restart online check ins', () => {
    cy.task('resetMocks')
    cy.visit(`/case/X778160/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/restart-checkin`)
    const restartDatePage = new RestartDateFrequencyPage()
    restartDatePage.checkOnPage()
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    restartDatePage
      .getDatePickerInput()
      .clear()
      .type(`${future.toFormat('d/M/yyyy')}`)
    restartDatePage.getFrequency().find('.govuk-radios__item').eq(0).find('.govuk-radios__input').click()
    restartDatePage.getSubmitBtn().click()

    const restartContactPage = new RestartContactPreferencePage()
    restartContactPage.checkOnPage()
    restartContactPage.getCheckInPreferredComs().find('input[value="PHONE"]').should('be.checked')
    restartContactPage.getMobileNumberChangeLink().click()
    const restartEditPage = new RestartEditContactPreferencePage()
    restartEditPage.checkOnPage()
    restartEditPage.getAlert().should('be.visible').and('contain.text', 'update the record in NDelius')
    restartEditPage.getMobileInput().clear().type('07700900123')
    restartEditPage.getSubmitBtn().click()
  })
})
context('check-ins add questions pages', () => {
  it('should allow a user to start the add questions to online check ins journey', () => {
    cy.task('resetMocks')
    cy.task('stubGetQuestionsTemplates')
    cy.task('stubGetUpcomingCheckinQuestions')
    cy.task('stubGetUpcomingCheckinQuestionItems')
    cy.task('stubAssignQuestions')
    cy.task('stubGetOffenderByCRN', 'X000001')
    cy.visit('/case/X000001/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/questions/start')
    const instructionsPage = new InstructionsPage()
    instructionsPage.clickContinue()
    const addQuestionsPage = new AddQuestionsPage()
    addQuestionsPage.checkOnPage()
  })

  it('should allow a user to view the default questions preview pages', () => {
    cy.task('resetMocks')
    cy.task('stubGetQuestionsTemplates')
    cy.task('stubGetUpcomingCheckinQuestions')
    cy.task('stubGetUpcomingCheckinQuestionItems')
    cy.task('stubAssignQuestions')
    cy.task('stubGetOffenderByCRN', 'X000001')

    cy.visit('/case/X000001/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/questions/start')
    const instructionsPage = new InstructionsPage()
    instructionsPage.clickContinue()
    const addQuestionsPage = new AddQuestionsPage()
    addQuestionsPage.checkOnPage()
    addQuestionsPage.getElement('.govuk-table').should('contain.text', 'How have you been feeling')
    addQuestionsPage.getElement('.govuk-table').should('contain.text', 'Is there anything you need support with')
    addQuestionsPage.clickPreviewFeeling()
    const feelingPreview = new PreviewFeelingPage()
    feelingPreview.checkOnPage()
    feelingPreview.getElement('.govuk-textarea').first().should('have.attr', 'readonly')
    feelingPreview.clickBackToQuestions()
    addQuestionsPage.checkOnPage()
    addQuestionsPage.clickPreviewSupport()
    const supportPreview = new PreviewSupportPage()
    supportPreview.checkOnPage()
    supportPreview.clickBackToQuestions()
    addQuestionsPage.checkOnPage()
    addQuestionsPage.clickCancel()
    instructionsPage.checkOnPage()
  })

  it('should show the "Add question" button for additional custom questions', () => {
    cy.task('resetMocks')
    cy.task('stubGetQuestionsTemplates')
    cy.task('stubGetUpcomingCheckinQuestions')
    cy.task('stubGetUpcomingCheckinQuestionItems')
    cy.task('stubAssignQuestions')
    cy.task('stubGetOffenderByCRN', 'X000001')

    cy.visit('/case/X000001/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/questions/add')
    const addQuestionsPage = new AddQuestionsPage()
    addQuestionsPage.getElement('[data-qa="add-question-btn"]').should('be.visible')
  })

  it('should show the "Save questions" button', () => {
    cy.task('resetMocks')
    cy.task('stubGetQuestionsTemplates')
    cy.task('stubGetUpcomingCheckinQuestions')
    cy.task('stubGetUpcomingCheckinQuestionItems')
    cy.task('stubAssignQuestions')
    cy.task('stubGetOffenderByCRN', 'X000001')

    cy.visit('/case/X000001/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/questions/add')
    const addQuestionsPage = new AddQuestionsPage()
    addQuestionsPage.getElement('[data-qa="save-questions-btn"]').should('be.visible')
  })

  it('should show the "cancel and go back" button ', () => {
    cy.task('resetMocks')
    cy.task('stubGetQuestionsTemplates')
    cy.task('stubGetUpcomingCheckinQuestions')
    cy.task('stubGetUpcomingCheckinQuestionItems')
    cy.task('stubAssignQuestions')
    cy.task('stubGetOffenderByCRN', 'X000001')

    cy.visit('/case/X000001/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/questions/add')
    const addQuestionsPage = new AddQuestionsPage()
    addQuestionsPage.getElement('[data-qa="cancel-link"]').should('be.visible')
  })

  it('should trigger validation errors when trying to save a blank custom question', () => {
    cy.task('resetMocks')
    cy.task('stubGetQuestionsTemplates')
    cy.task('stubGetUpcomingCheckinQuestions')
    cy.task('stubGetUpcomingCheckinQuestionItems')
    cy.task('stubAssignQuestions')
    cy.task('stubGetOffenderByCRN', 'X000001')

    cy.visit('/case/X000001/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/questions/add')

    const addQuestionsPage = new AddQuestionsPage()
    addQuestionsPage.clickAddQuestion()

    const listQuestionsPage = new ListQuestionsPage()
    listQuestionsPage.clickAddTemplateByIndex(0)

    const editQuestionPage = new EditQuestionPage()
    editQuestionPage.clickContinue()

    editQuestionPage.checkValidationError('Enter what you want to ask')
  })

  it('should allow a user to add, edit, and delete a custom question', () => {
    cy.task('resetMocks')
    cy.task('stubGetQuestionsTemplates')
    cy.task('stubGetUpcomingCheckinQuestions')
    cy.task('stubGetUpcomingCheckinQuestionItems')
    cy.task('stubAssignQuestions')
    cy.task('stubGetOffenderByCRN', 'X000001')

    cy.visit('/case/X000001/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/questions/start')

    const instructionsPage = new InstructionsPage()
    instructionsPage.clickContinue()

    const addQuestionsPage = new AddQuestionsPage()

    // Add "How has [your unpaid work] been going recently?"
    addQuestionsPage.clickAddQuestion()
    const listQuestionsPage = new ListQuestionsPage()
    listQuestionsPage.clickAddTemplateByIndex(0)

    const editQuestionPage = new EditQuestionPage()
    editQuestionPage.enterDraftQuestionInput('your unpaid work')
    editQuestionPage.clickContinue()

    addQuestionsPage.checkOnPage()
    addQuestionsPage.verifyQuestionInList('your unpaid work')

    // Edit "How has [your college course] been going recently?"
    addQuestionsPage.clickEditForQuestion(0)

    editQuestionPage.checkOnPage()
    editQuestionPage.enterDraftQuestionInput('your college course')
    editQuestionPage.clickContinue()

    addQuestionsPage.checkOnPage()
    addQuestionsPage.verifyQuestionInList('your college course')
    addQuestionsPage.verifyQuestionNotInList('your unpaid work')

    // Delete
    addQuestionsPage.clickDeleteForQuestion(0)

    addQuestionsPage.checkOnPage()
    addQuestionsPage.verifyQuestionNotInList('your college course')
  })

  it('should enforce the maximum limit of 3 custom questions', () => {
    cy.task('resetMocks')
    cy.task('stubGetQuestionsTemplates')
    cy.task('stubGetUpcomingCheckinQuestions')
    cy.task('stubGetUpcomingCheckinQuestionItems')
    cy.task('stubAssignQuestions')
    cy.task('stubGetOffenderByCRN', 'X000001')
    cy.visit('/case/X000001/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/questions/start')
    const instructionsPage = new InstructionsPage()
    instructionsPage.clickContinue()

    const addQuestionsPage = new AddQuestionsPage()

    // Add "How has [your apprenticeship] been going recently?"
    addQuestionsPage.clickAddQuestion()
    const listQuestionsPage = new ListQuestionsPage()
    listQuestionsPage.clickAddTemplateByIndex(0)
    const editQuestionPage = new EditQuestionPage()
    editQuestionPage.checkOnPage()
    editQuestionPage.enterDraftQuestionInput('your apprenticeship')
    editQuestionPage.clickContinue()

    // Add "How have things been feeling [at home] recently?"
    addQuestionsPage.checkOnPage()
    addQuestionsPage.clickAddQuestion()
    listQuestionsPage.checkOnPage()
    listQuestionsPage.clickAddTemplateByIndex(1)
    editQuestionPage.checkOnPage()
    editQuestionPage.enterDraftQuestionInput('at home')
    editQuestionPage.clickContinue()

    // Add "How is [your physical health]?"
    addQuestionsPage.checkOnPage()
    addQuestionsPage.clickAddQuestion()
    listQuestionsPage.checkOnPage()
    listQuestionsPage.clickAddTemplateByIndex(1)
    editQuestionPage.checkOnPage()
    editQuestionPage.enterDraftQuestionInput('your physical health')
    editQuestionPage.clickContinue()
    addQuestionsPage.checkOnPage()
    addQuestionsPage.verifyQuestionInList('your apprenticeship')
    addQuestionsPage.verifyQuestionInList('at home')
    addQuestionsPage.verifyQuestionInList('your physical health')
    addQuestionsPage.verifyAddQuestionButtonHidden()
  })
})
