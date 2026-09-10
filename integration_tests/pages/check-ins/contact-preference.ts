import Page, { PageElement } from '../page'

export default class ContactPreferencePage extends Page {
  checkOnPage(): void {
    this.getCheckInPreferredComs().contains('How does')
  }

  getSubmitBtn = (): PageElement => cy.get('[data-qa="submitBtn"]')

  getCheckInPreferredComs = () => {
    return cy.get(`[data-qa="checkInPreferredComs"]`)
  }
}
