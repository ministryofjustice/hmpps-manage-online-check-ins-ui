import Page from './page'

export default class ErrorPage extends Page {
  checkOnPage(): void {
    cy.get('h1').contains(this.title)
  }
}
