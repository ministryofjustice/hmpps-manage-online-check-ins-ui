import ManageCheckins from '../pages/check-ins/manage-checkins'
import StopCheckins from '../pages/check-ins/stop-checkins'

context('check-ins overview and manage pages', () => {
  it('should be able to stop check in', () => {
    cy.task('resetMocks')
    cy.visit(`/case/X778160/appointments/check-in/manage`)
    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    manageCheckins.getElementData('stop-checkin-btn').click()

    const stopCheckIn = new StopCheckins()
    stopCheckIn.checkOnPage()

    stopCheckIn.getSubmitBtn().click()

    stopCheckIn.checkErrorSummaryBox([
      'Enter the reason for stopping',
      'Select yes if the reason for stopping includes sensitive information',
    ])
    stopCheckIn.getElementData('stop-checkin-reason').find('textarea').type('No longer available')

    stopCheckIn.getElementData('sensitiveContact').find('input[type="radio"][value="false"]').click({ force: true })

    cy.intercept(
      'POST',
      '/case/X778160/appointments/check-in/manage/3fa85f64-5717-4562-b3fc-2c963f66afa7/stop-checkin',
    ).as('stopCheckin')

    stopCheckIn.getSubmitBtn().click()

    cy.wait('@stopCheckin').then(({ response }) => {
      expect(response?.statusCode).to.be.oneOf([302, 303])
      expect(response?.headers.location).to.eq('https://localhost:9091/manage-people-on-probation/case/X778160')
    })
  })
})
