import { Router } from 'express'
import type { Services } from '../services'
import eSuperVisionCheckInsRoutes from './eSupervisionCheckins'

export default function routes(router: Router, services: Services): Router {
  eSuperVisionCheckInsRoutes(router, services)
  return router
}
