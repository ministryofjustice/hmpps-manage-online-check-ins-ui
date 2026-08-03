import express from 'express'
import nunjucksSetup from '../../../utils/nunjucksSetup'

const crn = 'X000001'
const id = '11111111-1111-4111-8111-111111111111'

const app = express()
nunjucksSetup(app)

const baseUserDetails = {
  date: '1/8/2026',
  interval: 'Every week',
  checkInMobile: '07700900000',
  checkInEmail: 'bob@example.com',
  photoUploadOption: 'Upload a photo',
  rationale: 'Stable and low risk',
}

const render = (userDetails: Record<string, unknown>): Promise<string> =>
  new Promise((resolve, reject) => {
    app.render(
      'pages/check-in/checkin-summary.njk',
      {
        crn,
        id,
        case: { name: { forename: 'Bob', surname: 'Smith' } },
        csrfToken: 'token',
        data: { features: {} },
        userDetails,
      },
      (err: Error, html: string) => (err ? reject(err) : resolve(html)),
    )
  })

describe('checkin-summary', () => {
  it('shows only the email address row when email is the preferred contact method', async () => {
    const html = await render({ ...baseUserDetails, preferredComs: 'Email' })

    expect(html).toContain('checkInEmailAction')
    expect(html).not.toContain('checkInMobileAction')
    expect(html).toContain('Email address')
    expect(html).not.toContain('Mobile number')
  })

  it('shows only the mobile number row when text message is the preferred contact method', async () => {
    const html = await render({ ...baseUserDetails, preferredComs: 'Text message' })

    expect(html).toContain('checkInMobileAction')
    expect(html).not.toContain('checkInEmailAction')
    expect(html).toContain('Mobile number')
    expect(html).not.toContain('Email address')
  })
})
