import { PageElement } from '../../page'
import EligibilityCheckPage from './eligibility-check'

// The accredited programme and youth sentence boxes are Tier A/B rules, so they only render on that
// tier's template. Early engagement is a Tier A/B rule too, but the ESUP API answers it rather than
// the practitioner, so there is no box for it here.
export default class TiersABEligibilityCheckPage extends EligibilityCheckPage {
  getAccreditedProgramme = (): PageElement => cy.get('input[value="accreditedProgramme"]')

  getYouthSentence = (): PageElement => cy.get('input[value="youthSentence"]')
}
