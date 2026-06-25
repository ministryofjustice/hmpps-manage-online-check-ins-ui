import { Router } from 'express'

import type { Services } from '../services'
import { Page } from '../services/auditService'
import manageController from '../controllers/manageController'

export default function routes({ auditService, esupervisionService }: Services): Router {
  const router = Router()

  router.get('/', async (req, res) => {
    await auditService.logPageView(Page.EXAMPLE_PAGE, {
      who: res.locals.user.username,
      correlationId: req.id,
    })

    res.render('pages/index')
  })

  router.get(
    '/case/:crn',
    manageController.getViewCase({
      esupervisionService,
    }),
  )

  return router
}
