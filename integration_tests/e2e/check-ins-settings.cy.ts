import { DateTime } from 'luxon'
import ManageCheckins from '../pages/check-ins/manage-checkins'
import CheckinSettingsDatePage from '../pages/check-ins/settings/checkin-settings-date.page'
import CheckinSettingsFrequencyPage from '../pages/check-ins/settings/checkin-settings-frequency.page'
import ScheduleCheckinPage from '../pages/check-ins/schedule-checkin.page'
import EligibilityCheckPage from '../pages/check-ins/eligibility/eligibility-check'
import IsEligiblePage from '../pages/check-ins/eligibility/is-eligible'
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

const startRestartJourney = () => {
  cy.visit(`${manageById}/restart-eligibility-check`)
  const eligibilityPage = new EligibilityCheckPage()
  eligibilityPage.checkOnPage()
  eligibilityPage.getNone().click()
  eligibilityPage.getSubmitBtn().click()

  const isEligiblePage = new IsEligiblePage()
  isEligiblePage.checkOnPage()
  isEligiblePage.confirmDiscussion()
  isEligiblePage.getSubmitBtn().click()
}

context('check in settings for a scheduled person', () => {
  beforeEach(() => {
    cy.task('resetMocks')
    clearApiRequests()
  })

  it('does not offer ad-hoc scheduling and redirects a direct visit to manage', () => {
    openManagePage()
    cy.get('[data-qa="schedule-check-in-btn"]').should('not.exist')

    cy.visit(`${manageById}/schedule-check-in`)

    new ManageCheckins().checkOnPage()
    cy.location('pathname').should('equal', manageById)
    cy.request('POST', `${wiremockAdmin}/requests/find`, {
      method: 'POST',
      urlPathPattern: `/v2/offenders/crn/${crn}/schedule-ad-hoc-check-in`,
    }).then(({ body }) => {
      expect(body.requests).to.have.length(0)
    })
  })

  // Once the check in is active we can't change the date because notifications have been sent.
  // So the card no longer shows the check in link.
  it('offers no change of date once the next check in is due today', () => {
    cy.task('stubGetUpcomingCheckinQuestions', 0)
    const manageCheckins = openManagePage()
    manageCheckins.getNextCheckInValue().first().should('contain.text', DateTime.now().toFormat('d MMMM yyyy'))
    manageCheckins.getChangeDateLink().should('not.exist')
    manageCheckins.getChangeFrequencyLink().should('have.attr', 'href', `${manageById}/settings`)
  })

  it('offers a change of next check in date and of frequency', () => {
    const manageCheckins = openManagePage()
    manageCheckins.getFrequencyValue().should('contain.text', 'Every week')
    manageCheckins.getChangeDateLink().should('have.attr', 'href', `${manageById}/settings-date`)
    manageCheckins.getChangeFrequencyLink().should('have.attr', 'href', `${manageById}/settings`)
  })

  // Only moving from adhoc checkins to scheduled, needs a date, so a scheduled person's change saves
  // straight away, using their upcoming check in forward as the date the new interval runs from.
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

  // The fixture's weekly schedule started on 3 November 2025. With no check in booked yet, the next
  // check in day is worked out by repeating that schedule, so the practitioner is not asked for a date.
  it('saves a change of frequency from the saved schedule when no check in is booked yet', () => {
    cy.task('stubNoUpcomingCheckin')
    const start = DateTime.fromISO('2025-11-03')
    // The first weekly repeat strictly after today: today's own check in, if any, is already done.
    const weeksSince = Math.floor(Math.round(DateTime.now().startOf('day').diff(start, 'days').days) / 7) + 1
    const nextWeeklyDay = start.plus({ weeks: weeksSince })

    const managePageBefore = openManagePage()
    // The settings card shows that day too, not the long-past first date the schedule started on.
    managePageBefore.getNextCheckInValue().last().should('contain.text', nextWeeklyDay.toFormat('d MMMM yyyy'))
    managePageBefore.getChangeFrequencyLink().click()
    const frequencyPage = new CheckinSettingsFrequencyPage()
    frequencyPage.checkOnPage()
    frequencyPage.selectFrequency(TWO_WEEKS)
    frequencyPage.getSubmitBtn().click()

    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    cy.location('pathname').should('equal', manageById)
    manageCheckins.getUpdateBanner().should('contain.text', 'Check in settings saved')
    lastApiRequestBody('/v2/offenders/.+?/update_details').then(sent => {
      expect(sent.checkinSchedule).to.include({
        mode: 'SCHEDULED',
        checkinInterval: 'TWO_WEEKS',
        firstCheckin: nextWeeklyDay.toISODate(),
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

  // The upcoming check in stub books one five days out, so the manage card offers to move it by
  // booking again, with the picker starting on the booked date.
  it('shows the ad-hoc frequency and moves the booked check in from the schedule page', () => {
    const manageCheckins = openManagePage()
    manageCheckins.getFrequencyValue().should('contain.text', "I'll schedule them one at a time")
    manageCheckins.getChangeFrequencyLink().should('have.attr', 'href', `${manageById}/settings`)
    manageCheckins.getChangeDateLink().should('have.attr', 'href', `${manageById}/schedule-check-in`)
    manageCheckins.getChangeDateLink().click()

    const schedulePage = new ScheduleCheckinPage()
    schedulePage.checkOnPage()
    schedulePage
      .getDatePickerInput()
      .find('input')
      .should('have.value', DateTime.now().plus({ days: 5 }).toFormat('d/M/yyyy'))

    // A moved check in may not land on today: it would become active at once.
    schedulePage.getDatePickerInput().find('input').clear().type(DateTime.now().toFormat('d/M/yyyy'))
    schedulePage.getSubmitBtn().click()
    schedulePage.checkErrorSummaryBox(['The next online check in date must be in the future'])

    // Moving a booked check in only changes its date, so it saves without the questions step.
    const movedTo = DateTime.now().plus({ days: 2 })
    schedulePage.getDatePickerInput().find('input').clear().type(movedTo.toFormat('d/M/yyyy'))
    schedulePage.getSubmitBtn().click()

    manageCheckins.checkOnPage()
    cy.location('pathname').should('equal', manageById)
    manageCheckins
      .getUpdateBanner()
      .should('contain.text', `Single online check in for Joe has been moved to ${movedTo.toFormat('d MMMM yyyy')}`)
    lastApiRequestBody(`/v2/offenders/crn/${crn}/schedule-ad-hoc-check-in`).then(sent => {
      expect(sent).to.deep.equal({ requestedBy: 'USER1', firstCheckin: movedTo.toISODate() })
    })
  })

  it('offers no change of date once the booked check in is due today, and refuses a direct visit', () => {
    cy.task('stubGetUpcomingCheckinQuestions', 0)
    const manageCheckins = openManagePage()
    manageCheckins.getChangeDateLink().should('not.exist')
    cy.get('[data-qa="schedule-check-in-btn"]').should('not.exist')

    // Nothing can be booked over the active check in, so the schedule page sends them straight back.
    cy.visit(`${manageById}/schedule-check-in`)
    new ManageCheckins().checkOnPage()
    cy.location('pathname').should('equal', manageById)
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

  it('creates an ad-hoc check in for the selected date', () => {
    cy.task('stubNoUpcomingCheckin')
    const checkinDate = DateTime.now().plus({ days: 2 })
    openManagePage().getChangeDateLink().should('not.exist')
    cy.get('[data-qa="schedule-check-in-btn"]').click()
    const schedulePage = new ScheduleCheckinPage()
    schedulePage.checkOnPage()
    schedulePage.getDatePickerInput().find('input').should('have.value', '')
    // Unlike a move, a new booking may be for today.
    schedulePage.getDatePickerInput().find('input').type(DateTime.now().toFormat('d/M/yyyy'))
    schedulePage.getSubmitBtn().click()
    cy.location('pathname').should('equal', `${manageById}/schedule-check-in/questions/add`)
    cy.go('back')
    schedulePage.checkOnPage()
    schedulePage.getDatePickerInput().find('input').clear().type(checkinDate.toFormat('d/M/yyyy'))
    schedulePage.getSubmitBtn().click()

    cy.location('pathname').should('equal', `${manageById}/schedule-check-in/questions/add`)
    cy.get('[data-qa="save-questions-btn"]').click()

    const manageCheckins = new ManageCheckins()
    manageCheckins.checkOnPage()
    cy.location('pathname').should('equal', manageById)
    manageCheckins.getUpdateBanner().should('contain.text', 'Single online check in for Joe has been created')
    lastApiRequestBody(`/v2/offenders/crn/${crn}/schedule-ad-hoc-check-in`).then(sent => {
      expect(sent).to.deep.equal({ requestedBy: 'USER1', firstCheckin: checkinDate.toISODate() })
    })
  })
})

context('restarting check ins as ad-hoc', () => {
  beforeEach(() => {
    cy.task('resetMocks')
    // A weekly person with a mobile number on file, so contact can be confirmed as it stands.
    cy.task('stubGetScheduledOffenderByCRN', crn)
    cy.task('stubGetOffenderHeaderByCRN', crn)
    clearApiRequests()
  })

  it('skips the date page and restarts with no schedule', () => {
    startRestartJourney()
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
