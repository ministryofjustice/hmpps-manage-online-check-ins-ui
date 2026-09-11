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
    it('shows the practitioner name and hands off risk badges when allocated', async () => {
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
        practitioner: { name: { forename: 'Jane', surname: 'Doe' }, unallocated: false },
      })

      expect(html).toContain('person-header')
      expect(html).not.toContain('govuk-flex')
      expect(html).toContain('Jane Doe')
      expect(html).not.toContain('Unallocated')
      expect(html).toContain('data-badge-base="OSP/C HIGH"')
      expect(html).toContain('data-badge-base="RISK OF SERIOUS HARM HIGH"')
    })

    it('falls back to Unallocated when the practitioner is flagged unallocated', async () => {
      const html = await render({
        flags: { newDesignPopHeader: true },
        practitioner: { name: { forename: 'Jane', surname: 'Doe' }, unallocated: true },
      })

      expect(html).toContain('Unallocated')
      expect(html).not.toContain('Jane Doe')
    })

    it('falls back to Unallocated when the practitioner is missing', async () => {
      const html = await render({
        flags: { newDesignPopHeader: true },
        practitioner: null,
      })

      expect(html).toContain('Unallocated')
    })
  })
})
