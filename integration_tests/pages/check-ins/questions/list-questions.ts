import Page from '../../page'

export default class ListQuestionsPage extends Page {
  constructor() {
    super('Choose a question to add')
  }

  clickAddTemplateByIndex(index: number) {
    cy.get('[data-qa="add-question-link"]').eq(index).click()
  }

  enterBespokeQuestion(text: string) {
    cy.get('[data-qa="bespoke-question-input"]').type(`{selectall}{backspace}${text}`)
  }

  clickContinue() {
    cy.get('button[data-qa="submit-btn"]').click()
  }

  checkValidationError(expectedMessage: string) {
    cy.get('.govuk-error-message').should('contain.text', expectedMessage)
  }
}
