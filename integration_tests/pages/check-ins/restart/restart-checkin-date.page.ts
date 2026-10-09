import { DateTime } from 'luxon'
import Page from '../../page'

export default class RestartCheckinDatePage extends Page {
  constructor() {
    super('to complete their next online check in?')
  }

  // The question is the page heading, rendered as the date picker's label rather than a separate h2.
  checkOnPage(): void {
    cy.contains('label', 'to complete their next online check in?').should('be.visible')
  }

  getDatePickerToggle = () => {
    return cy.get('.moj-datepicker__toggle')
  }

  getNextDayButton = () => {
    const now = DateTime.now()
    const future = now.plus({ days: 2 })
    const futureIsInCurrentMonth = future.month === now.month
    if (!futureIsInCurrentMonth) {
      cy.get('.moj-js-datepicker-next-month').click()
    }
    return cy.get(`[data-testid="${future.toFormat('d/M/yyyy')}"]`)
  }

  enterDateInTwoDays = () => {
    const future = DateTime.now().plus({ days: 2 })
    return this.getDatePickerInput().clear().type(future.toFormat('d/M/yyyy'))
  }
}
