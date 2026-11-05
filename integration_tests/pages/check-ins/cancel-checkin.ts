import Page, { PageElement } from '../page'

export default class CancelCheckin extends Page {
  constructor() {
    super('Cancel upcoming online check in for')
  }

  getIntro = (): PageElement => this.getElementData('cancel-checkin-intro')

  getReason = (): PageElement => this.getElementData('cancel-checkin-reason').find('textarea')

  getSensitiveOption = (value: 'true' | 'false'): PageElement =>
    this.getElementData('cancel-checkin-sensitive').find(`input[type="radio"][value="${value}"]`)

  getGoBackLink = (): PageElement => this.getElementData('formAnchorLink')
}
