import Page, { PageElement } from '../../page'

// Both tiers' pilot-check templates ask the same question and set no `title`, so there is no
// data-qa=pageHeading to assert on - the radios legend is the heading on this page.
export default class PilotCheckPage extends Page {
  constructor() {
    super('started using online check ins before 1 October 2026?')
  }

  getYes = (): PageElement => cy.get('input[value="true"]')

  getNo = (): PageElement => cy.get('input[value="false"]')

  getSubmitBtn = (): PageElement => cy.get('[data-qa="submit-btn"]')

  checkOnPage(): void {
    cy.get('[data-qa="pilot-check"] legend').contains(this.title)
  }
}
