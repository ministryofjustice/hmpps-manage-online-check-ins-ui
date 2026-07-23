import { DateTime } from 'luxon'
import ManageCheckins from '../pages/check-ins/manage-checkins'
import AddQuestionsPage from '../pages/check-ins/questions/add-questions'
import EditQuestionPage from '../pages/check-ins/questions/edit-question'
import InstructionsPage from '../pages/check-ins/questions/instructions'
import ListQuestionsPage from '../pages/check-ins/questions/list-questions'
import PreviewFeelingPage from '../pages/check-ins/questions/preview/feeling'
import PreviewSupportPage from '../pages/check-ins/questions/preview/support'
import RestartCheckYourAnswersPage from '../pages/check-ins/restart/restart-check-your-answers.page'
import RestartConfirmationPage from '../pages/check-ins/restart/restart-confirmation.page'
import RestartContactPreferencePage from '../pages/check-ins/restart/restart-contact-preference.page'
import RestartDateFrequencyPage from '../pages/check-ins/restart/restart-date-frequency.page'
import RestartEditContactPreferencePage from '../pages/check-ins/restart/restart-edit-contact-preference.page'
import StopCheckins from '../pages/check-ins/stop-checkins'

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
      expect(response?.statusCode).to.be.oneOf([302, 303])
      expect(response?.headers.location).to.eq('https://localhost:9091/manage-people-on-probation/case/X778160')
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
    restartContactPage.checkOnPage()
    restartContactPage.getElementData('updateBanner').should('contain.text', 'Contact details saved')
    restartContactPage.getSubmitBtn().click()
    const restartSummaryPage = new RestartCheckYourAnswersPage()
    restartSummaryPage.checkOnPage()
    restartSummaryPage.getSummaryValue(2).should('contain.text', 'Every week')
    restartSummaryPage.getSubmitBtn().click()
    const restartConfirmPage = new RestartConfirmationPage()
    restartConfirmPage.checkOnPage()
    restartConfirmPage.getPanel().should('contain.text', 'Online check ins restarted')
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
