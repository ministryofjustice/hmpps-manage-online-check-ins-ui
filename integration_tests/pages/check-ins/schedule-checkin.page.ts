import Page, { PageElement } from '../page'

// Placeholder for the ad-hoc "schedule a check in" journey, which the confirmation pages link to.
export default class ScheduleCheckinPage extends Page {
  constructor() {
    super('Schedule an online check in')
  }

  getPlaceholder = (): PageElement => this.getElementData('schedulePlaceholder')

  getReturnLink = (): PageElement => this.getElementData('returnToManage')
}
