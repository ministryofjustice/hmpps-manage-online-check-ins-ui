import express from 'express'
import nunjucksSetup from '../../utils/nunjucksSetup'

const app = express()
nunjucksSetup(app)

const baseLocals = {
  headerPersonName: { forename: 'Bob', surname: 'Smith' },
  headerCRN: 'X000001',
  headerDob: '1990-01-01',
  tierScore: 'B1',
  tierDetailsLink: '/tier-details',
  overallRisk: 'NOT_FOUND',
  riskData: {
    assessments: [
      {
        combinedSeriousReoffendingPredictor: { name: 'OSP/C', band: 'NOT APPLICABLE' },
      },
    ],
  },
}

const render = (locals: Record<string, unknown>): Promise<string> =>
  new Promise((resolve, reject) => {
    app.render('partials/pop-header.njk', { ...baseLocals, ...locals }, (err: Error, html: string) =>
      err ? reject(err) : resolve(html),
    )
  })

describe('pop-header', () => {
  describe('legacy header (flags.newDesignPopHeader off)', () => {
    it('renders the pop-header component and not the new person-header component', async () => {
      const html = await render({ flags: {} })

      expect(html).toContain('pop-header__details')
      expect(html).not.toContain('person-header')
    })

    it('shows the CRN, date of birth and age', async () => {
      const html = await render({ flags: {} })

      expect(html).toContain("<span data-qa='crn' aria-hidden='true'>X000001</span>")
      expect(html).toContain("<span data-qa='headerDateOfBirthValue'>1 January 1990</span>")
      expect(html).toMatch(/<span data-qa='headerDateOfBirthAge'>\d+ years old<\/span>/)
    })

    it('links the tier score to the tier history', async () => {
      const html = await render({ flags: {} })

      expect(html).toContain("href='/tier-details' data-qa='tierLink'")
      expect(html).toContain('Tier: B1</a>')
    })

    it('shows the name as the page heading', async () => {
      const html = await render({ flags: {} })

      expect(html).toContain('<span data-qa="name">Bob Smith</span>')
    })
  })

  describe('new header (flags.newDesignPopHeader on)', () => {
    const managedBy = {
      text: 'Jane Doe (London PDU)',
      href: 'https://mpop/case/X000001/personal-details/staff-contacts',
    }

    it('shows the managed-by link and hands off risk badges', async () => {
      const html = await render({
        flags: { newDesignPopHeader: true },
        overallRisk: 'HIGH',
        riskData: {
          assessments: [
            {
              combinedSeriousReoffendingPredictor: {
                name: 'OSP/C',
                band: 'HIGH',
                score: 45,
                staticOrDynamic: 'Static',
              },
            },
          ],
        },
        managedBy,
      })

      expect(html).toContain('person-header')
      expect(html).not.toContain('govuk-flex')
      expect(html).toContain('Jane Doe (London PDU)')
      expect(html).toContain(`href='${managedBy.href}'`)
      expect(html).toContain('data-badge-base="OSP/C HIGH"')
      expect(html).toContain('data-badge-base="RISK OF SERIOUS HARM HIGH"')
    })

    it('renders whatever managed-by text it is given, such as Unallocated', async () => {
      const html = await render({
        flags: { newDesignPopHeader: true },
        managedBy: { ...managedBy, text: 'Unallocated' },
      })

      expect(html).toContain('Unallocated')
      expect(html).not.toContain('Jane Doe')
    })

    it('shows the tier score when present', async () => {
      const html = await render({ flags: { newDesignPopHeader: true }, managedBy })

      expect(html).toContain('>B1<')
      expect(html).not.toContain('Missing')
    })

    it('shows Missing when the tier score is absent', async () => {
      const html = await render({ flags: { newDesignPopHeader: true }, managedBy, tierScore: '' })

      expect(html).toContain('>Missing<')
    })

    it('shows a tier status in sentence case', async () => {
      const html = await render({ flags: { newDesignPopHeader: true }, managedBy, tierScore: 'NOT_SUPERVISED' })

      expect(html).toContain('>Not supervised<')
      expect(html).not.toContain('NOT_SUPERVISED')
    })

    it('shows a MISSING status as Missing', async () => {
      const html = await render({ flags: { newDesignPopHeader: true }, managedBy, tierScore: 'MISSING' })

      expect(html).toContain('>Missing<')
      expect(html).not.toContain('MISSING')
    })
  })

  describe('tier score in the legacy header', () => {
    it('shows a tier status in sentence case', async () => {
      const html = await render({ flags: {}, tierScore: 'NOT_SUPERVISED' })

      expect(html).toContain('Tier: Not supervised')
      expect(html).not.toContain('NOT_SUPERVISED')
    })

    it('shows Missing when the tier score is absent', async () => {
      const html = await render({ flags: {}, tierScore: '' })

      expect(html).toContain('Tier: Missing')
    })
  })
})
