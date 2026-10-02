import Page from '../../page'

export default class RestartCheckinFrequencyPage extends Page {
  constructor() {
    super('Online check in settings')
  }

  getFrequency = () => {
    return cy.get(`[data-qa="checkInFrequency"]`)
  }
}
