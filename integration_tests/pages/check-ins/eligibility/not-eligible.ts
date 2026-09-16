import Page, { PageElement } from '../../page'

export default class NotEligiblePage extends Page {
  constructor() {
    super('is not eligible to use online check ins')
  }

  getReason = (): PageElement => cy.get('.govuk-body').first()

  getSubmitBtn = (): PageElement => cy.get('[data-qa="submit-btn"]')
}
