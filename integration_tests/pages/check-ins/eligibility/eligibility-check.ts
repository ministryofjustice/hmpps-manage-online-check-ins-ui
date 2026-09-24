import Page, { PageElement } from '../../page'

// One page object for all three tiers. The three boxes below are on every tier's template; the
// accredited programme and youth sentence boxes are Tier A/B rules and only render there, so they
// live on TiersABEligibilityCheckPage.
//
// The supervision package, the final third and early engagement are not asked about here - the ESUP
// API answers all three, via the getSupervisionPackageStatus middleware.
export default class EligibilityCheckPage extends Page {
  constructor() {
    super('Check if')
  }

  getRecalled = (): PageElement => cy.get('input[value="recalled"]')

  getDeviceRestriction = (): PageElement => cy.get('input[value="deviceRestriction"]')

  getNone = (): PageElement => cy.get('input[value="none"]')

  getSubmitBtn = (): PageElement => cy.get('[data-qa="submit-btn"]')
}
