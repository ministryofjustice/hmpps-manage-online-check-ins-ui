import Page from '../../../page'

export default class PreviewFeelingPage extends Page {
  constructor() {
    super('How have you been feeling since we last spoke?')
  }

  verifyQuestionPreviewHint() {
    cy.get('.govuk-hint')
      .contains('Think about things like if you have noticed a change in your mood')
      .should('be.visible')
  }

  clickBackToQuestions() {
    cy.get('[data-qa="submit-btn"]').click()
  }
}
