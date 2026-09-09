import EligibilityCheckPage from '../pages/check-ins/eligibility-check'
import SetupInstructionsPage from '../pages/check-ins/setup-instructions'

context('eligibilityFeatureToggle feature flag', () => {
  const crn = 'X778160'

  it('sends new setups straight to the instructions page when the flag is on', () => {
    cy.task('resetMocks')
    cy.task('stubEligibilityFeatureToggle', true)
    cy.visit(`/case/${crn}/appointments/check-in/eligibility-check`)

    const instructionsPage = new SetupInstructionsPage()
    instructionsPage.checkOnPage()
    cy.contains('How you can use online check ins with people in Tiers A and B')
  })

  it('sends new setups to the classic eligibility check page when the flag is off', () => {
    cy.task('resetMocks')
    cy.task('stubEligibilityFeatureToggle', false)
    cy.visit(`/case/${crn}/appointments/check-in/eligibility-check`)

    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.checkOnPage()
  })

  it('defaults to the classic eligibility check page when Flipt cannot be reached', () => {
    cy.task('resetMocks')
    cy.visit(`/case/${crn}/appointments/check-in/eligibility-check`)

    const eligibilityCheckPage = new EligibilityCheckPage()
    eligibilityCheckPage.checkOnPage()
  })
})
