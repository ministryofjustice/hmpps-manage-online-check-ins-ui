import Page from '../page'

export default class SetupInstructionsPage extends Page {
  constructor() {
    super('About online check ins')
  }

  clickContinue() {
    cy.get('[data-qa="submit-btn"]').click()
  }
}
