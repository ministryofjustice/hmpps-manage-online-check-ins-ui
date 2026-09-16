import Page, { PageElement } from '../../page'

// One page object for all three tiers. The four boxes below are on every tier's template; the
// accredited programme, youth sentence and early engagement boxes are Tier A/B rules and only
// render there, so they live on TiersABEligibilityCheckPage.
export default class EligibilityCheckPage extends Page {
  constructor() {
    super('Check if')
  }

  getSupervisionPackage = (): PageElement => cy.get('input[value="supervisionPackage"]')

  getRecalled = (): PageElement => cy.get('input[value="recalled"]')

  getFinalThird = (): PageElement => cy.get('input[value="finalThird"]')

  getDeviceRestriction = (): PageElement => cy.get('input[value="deviceRestriction"]')

  getSubmitBtn = (): PageElement => cy.get('[data-qa="submit-btn"]')
}
