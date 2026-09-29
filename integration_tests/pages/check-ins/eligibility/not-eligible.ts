import Page, { PageElement } from '../../page'

export default class NotEligiblePage extends Page {
  constructor() {
    super('is not eligible to use online check ins')
  }

  getReason = (): PageElement => cy.get('.govuk-body').first()

  // Where more than one fact ruled the person out, the reason introduces a list instead of
  // completing a sentence.
  getReasonBullets = (): PageElement => cy.get('[data-qa="reasonBullets"] li')

  // A missing Tier is worded impersonally rather than completing "This is because <forename> …",
  // so it takes the place of the sentence getReason() reads.
  getMissingTierGuidance = (): PageElement => cy.get('[data-qa="missingTier"]')

  // A provisional Tier is worded impersonally for the same reason, and says a final Tier will
  // replace the provisional one rather than being assigned for the first time.
  getProvisionalTierGuidance = (): PageElement => cy.get('[data-qa="provisionalTier"]')

  // No longer being supervised cannot clear, so in place of the invitation to check again it lists
  // what might explain it.
  getNotSupervisedGuidance = (): PageElement => cy.get('[data-qa="notSupervised"]')

  getNotSupervisedReasons = (): PageElement => cy.get('[data-qa="notSupervisedReasons"] li')

  // The paragraph after the reason - for a missing Tier, how a Tier comes to be assigned; for every
  // other reason, the invitation to check eligibility again.
  getGuidance = (): PageElement => cy.get('.govuk-body').eq(1)

  getBackLink = (): PageElement => cy.get('.govuk-back-link')

  getSubmitBtn = (): PageElement => cy.get('[data-qa="submit-btn"]')
}
