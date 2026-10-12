import { DateTime } from 'luxon'
import Page from '../../page'

export default class CheckinSettingsDatePage extends Page {
  constructor() {
    super('to complete their next online check in?')
  }

  // The question is the page heading, rendered as the date picker's label rather than a separate h2.
  checkOnPage(): void {
    cy.contains('label', 'to complete their next online check in?').should('be.visible')
  }

  enterDateInTwoDays = () => {
    const future = DateTime.now().plus({ days: 2 })
    return this.getDatePickerInput().clear().type(future.toFormat('d/M/yyyy'))
  }
}
