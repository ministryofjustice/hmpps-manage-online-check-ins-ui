import Page from '../../page'

export default class RestartCheckinFrequencyPage extends Page {
  constructor() {
    super('to check in?')
  }

  // The question is the page heading, rendered as the radios' legend rather than a separate h2.
  checkOnPage(): void {
    cy.contains('legend', 'to check in?').should('be.visible')
  }

  getFrequency = () => {
    return cy.get(`[data-qa="checkInFrequency"]`)
  }

  selectFrequency = (index: number) => {
    return this.getFrequency().find('.govuk-radios__item').eq(index).find('.govuk-radios__input').click()
  }
}
