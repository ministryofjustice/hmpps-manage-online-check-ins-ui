import { PageElement } from '../../page'
import EligibilityCheckPage from './eligibility-check'

// The accredited programme, youth sentence and early engagement boxes are Tier A/B rules, so
// they only render on that tier's template.
export default class TiersABEligibilityCheckPage extends EligibilityCheckPage {
  getAccreditedProgramme = (): PageElement => cy.get('input[value="accreditedProgramme"]')

  getYouthSentence = (): PageElement => cy.get('input[value="youthSentence"]')

  getEarlyEngagement = (): PageElement => cy.get('input[value="earlyEngagement"]')
}
