import Page, { PageElement } from '../page'

export default class EditContactPreferencePage extends Page {
  checkOnPage(): void {
    cy.get('[data-qa="editContactValue"] label').should('contain.text', 'What is')
  }

  getSubmitBtn = (): PageElement => cy.get('[data-qa="submit-btn"]')

  getCancelAndGoBckBtn = (): PageElement => cy.get('[data-qa="formAnchorLink"]')

  getAlert = (): PageElement => cy.get('[data-qa="updateBanner"]')

  getContactValueInput = (): PageElement => this.getElementInput('editContactValue')
}
