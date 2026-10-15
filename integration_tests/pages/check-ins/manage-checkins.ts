import Page, { PageElement } from '../page'

export default class ManageCheckins extends Page {
  constructor() {
    super('Online check ins')
  }

  getImage = (): PageElement => cy.get('[data-qa="photoCard"] img')

  getUpdateBanner = (): PageElement => cy.get('[data-qa="updateBanner"]')

  getNextCheckInValue = (): PageElement => cy.get('[data-qa="nextCheckInValue"]')

  getFrequencyValue = (): PageElement => cy.get('[data-qa="frequencyValue"]')

  getChangeDateLink = (): PageElement => this.getElementData('changeDateAction')

  getChangeFrequencyLink = (): PageElement => this.getElementData('changeFrequencyAction')
}
