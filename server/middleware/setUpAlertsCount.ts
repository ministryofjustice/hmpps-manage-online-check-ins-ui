import express from 'express'
import { HmppsAuthClient } from '../data'
import ESupervisionClient from '../data/eSupervisionClient'
import logger from '../../logger'

export default function setUpAlertsCount(hmppsAuthClient: HmppsAuthClient) {
  const router = express.Router()

  router.use(async (_req, res, next) => {
    res.locals.alertsCount = null
    try {
      const { username } = res.locals.user
      const token = await hmppsAuthClient.getSystemClientToken(username)
      const eSupervisionClient = new ESupervisionClient(token)
      const { count } = await eSupervisionClient.getPractitionerAlerts(username)
      res.locals.alertsCount = count
    } catch (error) {
      logger.warn(error, 'Failed to fetch practitioner alerts count')
    }
    next()
  })

  return router
}
