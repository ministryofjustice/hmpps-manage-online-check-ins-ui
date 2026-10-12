import { DateTime } from 'luxon'
import ManageCheckins from '../pages/check-ins/manage-checkins'
import CheckinSettingsDatePage from '../pages/check-ins/settings/checkin-settings-date.page'
import CheckinSettingsFrequencyPage from '../pages/check-ins/settings/checkin-settings-frequency.page'
import ScheduleCheckinPage from '../pages/check-ins/schedule-checkin.page'
import RestartCheckinFrequencyPage from '../pages/check-ins/restart/restart-checkin-frequency.page'
import RestartContactPreferencePage from '../pages/check-ins/restart/restart-contact-preference.page'
import RestartCheckYourAnswersPage from '../pages/check-ins/restart/restart-check-your-answers.page'
import RestartConfirmationPage from '../pages/check-ins/restart/restart-confirmation.page'

// X778160 is the WireMock fixture for a person already set up: VERIFIED, weekly, with an upcoming
// check in 5 days out. See wiremock/mappings/eSupervisionAPI.json.
const crn = 'X778160'
const uuid = '3fa85f64-5717-4562-b3fc-2c963f66afa7'
const managePage = `/case/${crn}/appointments/check-in/manage`
const manageById = `${managePage}/${uuid}`
const wiremockAdmin = 'http://localhost:9091/__admin'

// The frequency radios, in order; ad-hoc sits after a divider, which is not a radio item.
const WEEKLY = 0
const TWO_WEEKS = 1
const AD_HOC = 4

// What the UI sent to the API is the point of these journeys, and the browser never sees that
// request, so read it back from WireMock's request journal.
const clearApiRequests = () => cy.request('DELETE', `${wiremockAdmin}/requests`)
const lastApiRequestBody = (urlPathPattern: string, method = 'POST') =>
  cy.request('POST', `${wiremockAdmin}/requests/find`, { method, urlPathPattern }).then(({ body }) => {
    expect(body.requests, `a ${method} to ${urlPathPattern}`).to.have.length.greaterThan(0)
    return JSON.parse(body.requests[0].body)
  })

const openManagePage = () => {
  cy.visit(managePage)
  const manageCheckins = new ManageCheckins()
  manageCheckins.checkOnPage()
  return manageCheckins
}

context('check in settings for a scheduled person', () => {
  beforeEach(() => {
    cy.task('resetMocks')
    clearApiRequests()
  })

  it('offers a change of next check in date and of frequency', () => {
    const manageCheckins = openManagePage()
    manageCheckins.getFrequencyValue().should('contain.text', 'Every week')
    manageCheckins.getChangeDateLink().should('have.attr', 'href', `${manageById}/settings-date`)
    manageCheckins.getChangeFrequencyLink().should('have.attr', 'href', `${manageById}/settings`)
  })

  // Only a move from ad-hoc needs a date, so a scheduled person's change saves straight away,
  // carrying their upcoming check in forward as the date the new interval runs from.
  it('saves a change of frequency straight away, keeping the next check in date', () => {
    openManagePage().getChangeFrequencyLink().click()
    const frequencyPage = new CheckinSettingsFrequencyPage()
    frequencyPage.checkOnPage()
    frequencyPage.getCheckedFrequency().should('have.value', 'WEEKLY')
    frequencyPage.getBackLink().should('have.attr', 'href', manageById)
    frequencyPage.selectFrequency(TWO_WEEKS)
    frequencyPage.getSubmitBtn().click()

    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    manageCheckins.getUpdateBanner().should('contain.text', 'Check in settings saved')
    lastApiRequestBody('/v2/offenders/.+?/update_details').then(sent => {
      expect(sent.checkinSchedule).to.include({
        mode: 'SCHEDULED',
        checkinInterval: 'TWO_WEEKS',
        firstCheckin: DateTime.now().plus({ days: 5 }).toISODate(),
      })
    })
  })

  it('changes the next check in date, starting from the upcoming one', () => {
    openManagePage().getChangeDateLink().click()
    const datePage = new CheckinSettingsDatePage()
    datePage.checkOnPage()
    datePage.getDatePickerInput().should('have.value', DateTime.now().plus({ days: 5 }).toFormat('d/M/yyyy'))
    datePage.getBackLink().should('have.attr', 'href', manageById)

    datePage.getDatePickerInput().clear()
    datePage.getSubmitBtn().click()
    datePage.checkErrorSummaryBox(['Enter the date you would like the person to complete their next check in'])

    datePage.enterDateInTwoDays()
    datePage.getSubmitBtn().click()
    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    manageCheckins.getUpdateBanner().should('contain.text', 'Check in settings saved')
    lastApiRequestBody('/v2/offenders/.+?/update_details').then(sent => {
      expect(sent.checkinSchedule).to.include({
        mode: 'SCHEDULED',
        checkinInterval: 'WEEKLY',
        firstCheckin: DateTime.now().plus({ days: 2 }).toFormat('yyyy/M/dd'),
      })
    })
  })
})

context('check in settings for an ad-hoc person', () => {
  beforeEach(() => {
    cy.task('resetMocks')
    cy.task('stubGetAdHocOffenderByCRN', crn)
    clearApiRequests()
  })

  it('shows the ad-hoc frequency with no next check in date to change', () => {
    const manageCheckins = openManagePage()
    manageCheckins.getFrequencyValue().should('contain.text', "I'll schedule them one at a time")
    manageCheckins.getChangeDateLink().should('not.exist')
    manageCheckins.getChangeFrequencyLink().should('have.attr', 'href', `${manageById}/settings`)
  })

  // An ad-hoc person has no schedule to carry forward, so this is the one change that asks for a date.
  it('asks for a first check in date when moving to an interval', () => {
    openManagePage().getChangeFrequencyLink().click()
    const frequencyPage = new CheckinSettingsFrequencyPage()
    frequencyPage.checkOnPage()
    frequencyPage.getCheckedFrequency().should('have.value', 'AD_HOC')
    frequencyPage.selectFrequency(WEEKLY)
    frequencyPage.getSubmitBtn().click()

    const datePage = new CheckinSettingsDatePage()
    datePage.checkOnPage()
    datePage.getDatePickerInput().should('have.value', '')
    datePage.getBackLink().should('have.attr', 'href', `${manageById}/settings`)
    datePage.getSubmitBtn().click()
    datePage.checkErrorSummaryBox(['Enter the date you would like the person to complete their next check in'])

    datePage.enterDateInTwoDays()
    datePage.getSubmitBtn().click()
    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    manageCheckins.getUpdateBanner().should('contain.text', 'Check in settings saved')
    lastApiRequestBody('/v2/offenders/.+?/update_details').then(sent => {
      expect(sent.checkinSchedule).to.include({
        mode: 'SCHEDULED',
        checkinInterval: 'WEEKLY',
        firstCheckin: DateTime.now().plus({ days: 2 }).toFormat('yyyy/M/dd'),
      })
    })
  })

  // The API takes ad-hoc as a mode alone: it rejects an interval or a date sent with it.
  it('saves staying ad-hoc without asking for a date', () => {
    openManagePage().getChangeFrequencyLink().click()
    const frequencyPage = new CheckinSettingsFrequencyPage()
    frequencyPage.checkOnPage()
    frequencyPage.selectFrequency(AD_HOC)
    frequencyPage.getSubmitBtn().click()

    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    manageCheckins.getUpdateBanner().should('contain.text', 'Check in settings saved')
    lastApiRequestBody('/v2/offenders/.+?/update_details').then(sent => {
      expect(sent.checkinSchedule).to.include({ mode: 'AD_HOC' })
      expect(sent.checkinSchedule).not.to.have.property('checkinInterval')
      expect(sent.checkinSchedule).not.to.have.property('firstCheckin')
    })
  })

  it('starts scheduling an ad-hoc check in at the date page', () => {
    cy.visit(`${manageById}/schedule-check-in`)
    const schedulePage = new ScheduleCheckinPage()
    schedulePage.checkOnPage()
    schedulePage.getDatePickerInput().should('be.visible')
    schedulePage.getSubmitBtn().should('be.visible')
  })
})

context('restarting check ins as ad-hoc', () => {
  beforeEach(() => {
    cy.task('resetMocks')
    // A weekly person with a mobile number on file, so contact can be confirmed as it stands.
    cy.task('stubGetScheduledOffenderByCRN', crn)
    clearApiRequests()
  })

  it('skips the date page and restarts with no schedule', () => {
    cy.visit(`${manageById}/restart-checkin`)
    const frequencyPage = new RestartCheckinFrequencyPage()
    frequencyPage.checkOnPage()
    frequencyPage.selectFrequency(AD_HOC)
    frequencyPage.getSubmitBtn().click()

    const contactPage = new RestartContactPreferencePage()
    contactPage.checkOnPage()
    contactPage.getCheckInPreferredComs().find('input[value="PHONE"]').should('be.checked')
    contactPage.getSubmitBtn().click()

    const summaryPage = new RestartCheckYourAnswersPage()
    summaryPage.checkOnPage()
    cy.get('[data-qa="dateAction"]').should('not.exist')
    cy.get('.govuk-summary-list').should('contain.text', "I'll schedule them one at a time")
    summaryPage.getSubmitBtn().click()

    const confirmationPage = new RestartConfirmationPage()
    confirmationPage.checkOnPage()
    confirmationPage.getPanel().should('not.contain.text', 'Starting')
    confirmationPage.getWhatHappensNext().should('contain.text', 'Schedule an online check in')
    lastApiRequestBody('/v2/offenders/.+?/reactivate').then(sent => {
      expect(sent.checkinSchedule).to.include({ mode: 'AD_HOC' })
      expect(sent.checkinSchedule).not.to.have.property('checkinInterval')
      expect(sent.checkinSchedule).not.to.have.property('firstCheckin')
    })
  })
})
