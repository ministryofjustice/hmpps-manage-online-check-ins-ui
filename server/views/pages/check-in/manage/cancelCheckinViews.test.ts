// Renders the cancel check in page and the overview's cancel action for real, since a missing
// filter, macro or local only otherwise surfaces as a 500 in the browser.
import express from 'express'
import nunjucksSetup from '../../../../utils/nunjucksSetup'

const crn = 'X778160'
const id = '3fa85f64-5717-4562-b3fc-2c963f66afa7'
const overview = `/case/${crn}/appointments/check-in/manage/${id}`

const app = express()
nunjucksSetup(app)

const render = (view: string, locals: Record<string, unknown>): Promise<string> =>
  new Promise((resolve, reject) => {
    app.render(`pages/check-in/manage/${view}.njk`, locals, (err: Error, html: string) =>
      err ? reject(err) : resolve(html),
    )
  })

const base: Record<string, unknown> = {
  crn,
  id,
  case: { name: { forename: 'Joe', surname: 'Bloggs' } },
  csrfToken: 'token',
  paths: { current: `${overview}/cancel-checkin` },
  managePeopleOnProbationUrl: '',
  data: { esupervision: {} },
  cancellableCheckin: { uuid: '3fa85f64-5717-4562-b3fc-2c963f66afa6' },
}

describe('cancel-checkin', () => {
  // Field names come from the decorateFormAttributes filter, which needs a live request, so
  // this checks the page's words rather than its inputs.
  it('asks for the reason and whether it is sensitive, with a link to the guidance', async () => {
    const html = await render('cancel-checkin', base)
    expect(html).toContain('Cancel upcoming online check in for Joe')
    expect(html).toContain('Learn more about cancelling an online check in')
    expect(html).toContain('Joe will receive a message telling them this check in has been cancelled')
    expect(html).toContain('Reason for cancelling')
    expect(html).toContain('Does the reason for cancelling include sensitive information?')
    expect(html).toMatch(/id="submit-btn">\s*Cancel online check in\s*<\/button>/)
    expect(html).toMatch(new RegExp(`href="${overview}" data-qa="formAnchorLink">\\s*Go back to online check ins`))
  })

  it('re-renders with the errors', async () => {
    const html = await render('cancel-checkin', {
      ...base,
      errorMessages: {
        [`esupervision[${crn}][${id}][manageCheckin][cancelCheckinSensitive]`]:
          'Select if the reason for cancelling includes sensitive information',
      },
    })
    expect(html).toContain('Error: Cancel upcoming online check in for the person')
    expect(html).toContain('There is a problem')
    expect(html).toContain('Select if the reason for cancelling includes sensitive information')
  })
})

describe('manage-checkin', () => {
  const overviewLocals = (extra: Record<string, unknown>) => ({
    ...base,
    offenderCheckinsByCRNResponse: { status: 'VERIFIED', contactPreference: 'PHONE', mode: 'SCHEDULED' },
    email: '',
    mobile: '07700900000',
    checkinFrequency: 'WEEKLY',
    showChange: true,
    upcomingCheckin: { expectedCheckinDate: '2026-11-04', questions: [] as unknown[] },
    nextCheckinDate: '2026-11-04',
    canChangeDate: false,
    canEditQuestions: false,
    ...extra,
  })

  it('offers to cancel the upcoming check in from its card', async () => {
    const html = await render('manage-checkin', overviewLocals({ canCancelCheckin: true }))
    expect(html).toMatch(new RegExp(`href="${overview}/cancel-checkin"[^>]*data-qa="cancel-checkin-link"`))
    expect(html).toContain('Cancel check in')
  })

  it('offers nothing to cancel otherwise', async () => {
    const html = await render('manage-checkin', overviewLocals({ canCancelCheckin: false }))
    expect(html).not.toContain('cancel-checkin')
  })

  it('shows the cancellation confirmed, or refused', async () => {
    const confirmed = await render(
      'manage-checkin',
      overviewLocals({ success: true, successMessageHtml: '<strong>Online check in cancelled</strong>' }),
    )
    expect(confirmed).toContain('data-qa="updateBanner"')
    expect(confirmed).toContain('Online check in cancelled')

    const refused = await render(
      'manage-checkin',
      overviewLocals({ warningMessageHtml: '<strong>Could not be cancelled</strong>' }),
    )
    expect(refused).toContain('data-qa="warningBanner"')
    expect(refused).toContain('Could not be cancelled')
    expect(refused).not.toContain('data-qa="updateBanner"')
  })
})
