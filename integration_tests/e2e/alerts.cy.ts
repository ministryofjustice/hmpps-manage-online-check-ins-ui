import ManageCheckins from '../pages/check-ins/manage-checkins'

context('alerts notification badge', () => {
  it('shows the alerts count badge when the practitioner has alerts', () => {
    cy.task('resetMocks')
    cy.task('stubPractitionerAlerts', 3)
    cy.visit('/case/X778160/appointments/check-in/manage')

    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    manageCheckins.getAlertsBadge().should('be.visible').and('contain.text', '3')
  })

  it('omits the alerts badge when the practitioner has no alerts', () => {
    cy.task('resetMocks')
    cy.task('stubPractitionerAlerts', 0)
    cy.visit('/case/X778160/appointments/check-in/manage')

    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    manageCheckins.getAlertsBadge().should('not.exist')
  })

  it('omits the alerts badge and does not show an error when the alerts API call fails', () => {
    cy.task('resetMocks')
    cy.task('stubPractitionerAlerts500Response')
    cy.visit('/case/X778160/appointments/check-in/manage')

    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    manageCheckins.getAlertsBadge().should('not.exist')
    manageCheckins.getAlert().should('not.exist')
  })
})
