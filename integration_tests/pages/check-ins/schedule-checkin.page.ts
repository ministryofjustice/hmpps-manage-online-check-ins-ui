import Page, { PageElement } from '../page'

export default class ScheduleCheckinPage extends Page {
  constructor() {
    super()
  }

  checkOnPage(): void {
    cy.contains('label', 'When would you like the person to complete their online check in?').should('be.visible')
  }

  getDatePickerInput = (): PageElement => this.getElementData('checkInDate')
}
