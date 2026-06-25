import { Router } from 'express'

export default function routes(): Router {
  const router = Router()

  router.get('/', async (req, res, _next) => {
    return res.render('pages/index')
  })

  return router
}
