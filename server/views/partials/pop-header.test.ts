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
    it('renders the legacy markup and not the new person-header component', async () => {
      const html = await render({ flags: {} })

      expect(html).toContain('govuk-flex')
      expect(html).not.toContain('person-header')
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
  })
})
