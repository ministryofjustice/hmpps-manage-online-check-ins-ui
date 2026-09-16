import Page, { PageElement } from '../../page'

export default class SpeakToPopPage extends Page {
  constructor() {
    super('You should speak to')
  }

  getSubmitBtn = (): PageElement => cy.get('[data-qa="submit-btn"]')
}
