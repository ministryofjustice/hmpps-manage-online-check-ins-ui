import Page, { PageElement } from '../../page'

// Covers all four is-eligible variants - the per-tier pages differ only in their explanation
// of why the person is eligible; the discussion checkboxes are identical across them.
export default class IsEligiblePage extends Page {
  constructor() {
    super('is eligible to use online check ins')
  }

  getOptional = (): PageElement => cy.get('input[value="optional"]')

  getCanStop = (): PageElement => cy.get('input[value="canStop"]')

  getNotEnforceable = (): PageElement => cy.get('input[value="notEnforceable"]')

  getMoreTime = (): PageElement => cy.get('input[value="moreTime"]')

  getNotAll = (): PageElement => cy.get('input[value="notAll"]')

  confirmDiscussion = (): void => {
    this.getOptional().click()
    this.getCanStop().click()
    this.getNotEnforceable().click()
    this.getMoreTime().click()
  }

  getSubmitBtn = (): PageElement => cy.get('[data-qa="submit-btn"]')
}
