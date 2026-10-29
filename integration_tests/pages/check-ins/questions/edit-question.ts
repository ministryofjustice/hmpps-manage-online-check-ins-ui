import Page from '../../page'

export default class EditQuestionPage extends Page {
  // A template question is headed "What do you want to ask <name>?"; a question the practitioner
  // wrote themselves is headed "Write your own question".
  constructor(heading: 'What do you want to ask' | 'Write your own question' = 'What do you want to ask') {
    super(heading)
  }

  enterDraftQuestionInput(text: string) {
    cy.get('input[name*="[manageQuestions][draftQuestionInput]"]').type(`{selectall}{backspace}${text}`)
  }

  clickContinue() {
    cy.get('button[data-qa="submit-btn"]').click()
  }

  checkValidationError(expectedMessage: string) {
    cy.get('.govuk-error-message').should('contain.text', expectedMessage)
  }
}
