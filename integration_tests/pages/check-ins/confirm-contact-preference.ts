import Page, { PageElement } from '../page'

export default class ConfirmContactPreferencePage extends Page {
  checkOnPage(): void {
    this.getConfirmPreferredComs().contains('Is this the right')
  }

  getSubmitBtn = (): PageElement => cy.get('[data-qa="submitBtn"]')

  getConfirmPreferredComs = () => {
    return cy.get(`[data-qa="checkInConfirmPreferredComs"]`)
  }
}
