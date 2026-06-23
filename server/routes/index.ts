import { Router } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'

export default function routes({ auditService }: Services): Router {
  const router = Router()

  router.get('/', async (req, res, _next) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, { who: res.locals.user.username, correlationId: req.id })

    res.render('pages/index', {
      title: 'Appointments',

      headerCRN: 'X123456',
      headerDob: '1980-01-01',
      headerPersonName: {
        forename: 'Joe',
        surname: 'Bloggs',
      },

      headerTierLink: '#',
      tierCalculation: {
        tierScore: 'A3',
      },

      risksWidget: {
        overallRisk: 'MEDIUM',
      },

      riskData: {
        assessments: [
          {
            combinedSeriousReoffendingPredictor: {
              band: 'MEDIUM',
              score: 12,
            },
            rsr: {
              band: 'LOW',
              score: 3.2,
            },
          },
        ],
      },
    })
  })

  return router
}
