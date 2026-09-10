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
import DateFrequencyPage from '../pages/check-ins/date-frequencey'
import EditContactPreferencePage from '../pages/check-ins/edit-contact-preference'
import EligibilityCheckPage from '../pages/check-ins/eligibility-check'
import EligibilityDeniedPage from '../pages/check-ins/eligibility-denied'
import EligibilityFullPage from '../pages/check-ins/eligibility-full'
import EligibilitySPOApprovalPage from '../pages/check-ins/eligibility-spo-approval'
import EligibilitySupplementaryPage from '../pages/check-ins/eligibility-supplementary'
import PhotoOptionsPage from '../pages/check-ins/photo-options'
import PhotoRulesPage from '../pages/check-ins/photo-rules'
import RationalePage from '../pages/check-ins/rationale'
import TakeAPhotoPage from '../pages/check-ins/take-a-photo'
import TakeAPhotoOptionsPage from '../pages/check-ins/take-a-photo-options'
import UploadAPhotoPage from '../pages/check-ins/upload-a-photo'
import ErrorPage from '../pages/error'
import { getCheckinUuid } from '../utils/common'

const loadPage = () => {
  cy.task('resetMocks')
  cy.task('stubGetQuestionsTemplates')
  cy.visit(`/case/X000001/appointments/check-in/eligibility-check`)
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
  it('should navigate to supplementary eligibility page when option one is selected', () => {
    loadPage()
    const checkPage = new EligibilityCheckPage()

    checkPage.getOptionOne().check()
    checkPage.getSubmitBtn().click()

    const supplementaryPage = new EligibilitySupplementaryPage()
    supplementaryPage.checkOnPage()
  })

  it('should navigate to supplementary eligibility page when more than one eligible option is selected', () => {
    loadPage()
    const checkPage = new EligibilityCheckPage()

    checkPage.getOptionOne().check()
    checkPage.getOptionTwo().check()

    checkPage.getSubmitBtn().click()

    const supplementaryPage = new EligibilitySupplementaryPage()
    supplementaryPage.checkOnPage()
  })

  it('should navigate to full eligibility choice when "None of these apply" is selected', () => {
    loadPage()
    const checkPage = new EligibilityCheckPage()

    checkPage.getNoneOption().check()
    checkPage.getSubmitBtn().click()

    const fullPage = new EligibilityFullPage()
    fullPage.checkOnPage()
  })
  it('should navigate to SPO approval when "To replace some face-to-face contact" radio is selected', () => {
    loadPage()

    const checkPage = new EligibilityCheckPage()
    checkPage.getNoneOption().check()
    checkPage.getSubmitBtn().click()

    const fullPage = new EligibilityFullPage()
    fullPage.getReplacementRadio().check()
    fullPage.getSubmitBtn().click()

    const spoApprovalPage = new EligibilitySPOApprovalPage()
    spoApprovalPage.checkOnPage()
  })

  it('should navigate to rationale page when SPO approval checkbox is checked', () => {
    loadPage()

    const checkPage = new EligibilityCheckPage()
    checkPage.getNoneOption().check()
    checkPage.getSubmitBtn().click()

    const fullPage = new EligibilityFullPage()
    fullPage.getReplacementRadio().check()
    fullPage.getSubmitBtn().click()

    const spoApprovalPage = new EligibilitySPOApprovalPage()
    spoApprovalPage.checkOnPage()
    spoApprovalPage.getCheckbox().check()
    spoApprovalPage.getSubmitBtn().click()
    const rationalePage = new RationalePage()
    rationalePage.checkOnPage()
  })

  it('should navigate to rationale page when "As well as existing face-to-face contact" radio is selected', () => {
    loadPage()

    const checkPage = new EligibilityCheckPage()
    checkPage.getNoneOption().check()
    checkPage.getSubmitBtn().click()

    const fullPage = new EligibilityFullPage()
    fullPage.getSupplementaryRadio().check()
    fullPage.getSubmitBtn().click()

    const rationalePage = new RationalePage()
    rationalePage.checkOnPage()
  })

  it('should navigate to denied page when option 10 (Intensive Supervision Court pilot case) is selected', () => {
    loadPage()
    const checkPage = new EligibilityCheckPage()
    checkPage.getOptionNine().check()
    checkPage.getSubmitBtn().click()
    const deniedPage = new EligibilityDeniedPage()
    deniedPage.checkOnPage()
  })

  it('should navigate to denied page when option 10 (Intensive Supervision Court pilot case) is selected alongside other eligible choices', () => {
    loadPage()
    const checkPage = new EligibilityCheckPage()
    checkPage.getOptionOne().check()
    checkPage.getOptionNine().check()
    checkPage.getSubmitBtn().click()
    const deniedPage = new EligibilityDeniedPage()
    deniedPage.checkOnPage()
  })

  it('should show validation errors when no option is selected', () => {
    loadPage()
    const checkPage = new EligibilityCheckPage()
    checkPage.getSubmitBtn().click()
    cy.get('.govuk-error-summary').should('be.visible')
    cy.get('.govuk-error-message').should('contain', 'Select if any of these apply')
  })

  it('should be able to submit rationale details', () => {
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
    const rationalePage = new RationalePage()
    rationalePage.rationaleNotes().find('textarea').type('Low risk of reoffending')
    rationalePage.getSubmitBtn().click()
    const dateFrequencyPage = new DateFrequencyPage()
    dateFrequencyPage.checkOnPage()
  })

  it('rationale page should fail with validation errors', () => {
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
    const rationalePage = new RationalePage()

    rationalePage.getSubmitBtn().click()
    rationalePage.getErrorSummaryBox().should('be.visible')
  })

  it('check-in frequency page should fail with validation errors', () => {
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
    const rationalePage = new RationalePage()
    rationalePage.rationaleNotes().find('textarea').type('Low risk of reoffending')
    rationalePage.getSubmitBtn().click()
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
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
  })

  it('contact preference page should fail with validation errors', () => {
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
    contactPreferencePage.getSubmitBtn().click()
    getCheckinUuid().then(uuid => {
      dateFrequencyPage.getElement(`#esupervision-X000001-${uuid}-checkins-preferredComs-error`).should($error => {
        expect($error.text().trim()).to.include('Select how the person wants us to send a link to the service')
      })
    })
  })

  it('should be able to submit contact preference details', () => {
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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

    const photoOptionsPage = new PhotoOptionsPage()
    photoOptionsPage.checkOnPage()
  })

  it('should be able to edit contact preference details', () => {
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
    const editContactPreferencePage = rejectContactPreferenceAndEdit()
    editContactPreferencePage.getContactValueInput().clear().type('07700900456')
    editContactPreferencePage.getSubmitBtn().click()
    const photoOptionsPage = new PhotoOptionsPage()
    photoOptionsPage.checkOnPage()
  })

  it('should be able to choose photo options', () => {
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
    takeAPhotoOptionsPage.getPhotoOptions().find('.govuk-radios__item').eq(1).find('.govuk-radios__input').click()
    takeAPhotoOptionsPage.getSubmitBtn().click()
    const uploadablePhoto = new UploadAPhotoPage()
    uploadablePhoto.checkOnPage()
    uploadablePhoto.getBackLink().click()
    takeAPhotoOptionsPage.checkOnPage()
  })

  it('should be able to upload a pic and show rules page', () => {
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
    checkYourAnswersPage.getSubmitBtn().click()
    const checkinConfirmationPage = new CheckinConfirmationPage()
    checkinConfirmationPage.checkOnPage()
  })

  it('should be able to change options from cya', () => {
    loadPage()
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
      .getSummaryListRow(1)
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Low risk of reoffending')
    checkYourAnswersPage.getElementData('rationaleAction').click()
    rationalePage.checkOnPage()
    rationalePage.rationaleNotes().find('textarea').clear()
    rationalePage.rationaleNotes().find('textarea').type('Hard for them to travel to the office')
    rationalePage.getSubmitBtn().click()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage
      .getSummaryListRow(1)
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Hard for them to travel to the office')

    // Date change
    checkYourAnswersPage.getElementData('dateAction').click()
    dateFrequencyPage.checkOnPage()
    dateFrequencyPage.getSubmitBtn().click()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage.getSummaryListRow(3).find('.govuk-summary-list__value').should('contain.text', 'Every week')
    checkYourAnswersPage.getElementData('intervalAction').click()
    dateFrequencyPage.checkOnPage()
    dateFrequencyPage.getFrequency().find('.govuk-radios__item').eq(2).find('.govuk-radios__input').click()
    dateFrequencyPage.getSubmitBtn().click()
    checkYourAnswersPage.checkOnPage()
    checkYourAnswersPage.getSummaryListRow(3).find('.govuk-summary-list__value').should('contain.text', 'Every 4 weeks')

    // Contact preference change
    checkYourAnswersPage.getSummaryListRow(4).find('.govuk-summary-list__value').should('contain.text', 'Text message')
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
    checkYourAnswersPage.getSummaryListRow(4).find('.govuk-summary-list__value').should('contain.text', 'Email')

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
      .getSummaryListRow(6)
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
      .getSummaryListRow(6)
      .find('.govuk-summary-list__value')
      .should('contain.text', 'Upload a photo')
  })
})

context('check-ins error scenario ', () => {
  it('should show error page when update fails with 404 HTTP response code', () => {
    loadPage()
    cy.task('stubUpdatePersonalContact404Response')
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
    const editContactPreferencePage = rejectContactPreferenceAndEdit()
    editContactPreferencePage.getContactValueInput().clear().type('07700900456')
    editContactPreferencePage.getSubmitBtn().click()
    const errorPage = new ErrorPage()
    errorPage.checkPageTitle('Page not found')
  })

  it('should show error page when update fails with 500 HTTP response code', () => {
    loadPage()
    cy.task('stubUpdatePersonalContact500Response')
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
    const editContactPreferencePage = rejectContactPreferenceAndEdit()
    editContactPreferencePage.getContactValueInput().clear().type('07700900456')
    editContactPreferencePage.getSubmitBtn().click()
    const errorPage = new ErrorPage()
    errorPage.checkPageTitle('Sorry, there is a problem with the service')
  })

  it('should be able to show error message when same phone / email already registered', () => {
    loadPage()
    cy.task('stubOffenderSetup422Response')
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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

    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.getOptionOne().click()
    eligibilityCheckPage.getSubmitBtn().click()
    const eligibilitySupplementaryPage = new EligibilitySupplementaryPage()
    eligibilitySupplementaryPage.checkOnPage()
    eligibilitySupplementaryPage.getSubmitBtn().click()
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
