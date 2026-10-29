import Page from '../page'

export default class SentenceSelectionPage extends Page {
  constructor() {
    super('Which sentence do you want to add online check ins to?')
  }

  checkOnPage(): void {
    cy.contains('legend', 'Which sentence do you want to add online check ins to?').should('be.visible')
  }

  getSentences = () => cy.get('[data-qa="sentenceSelection"] .govuk-radios__item')

  selectSentence = (eventNumber: number) => this.getSentences().find(`input[value="${eventNumber}"]`).check()

  getSelectedSentence = () => this.getSentences().find('input:checked')
}
