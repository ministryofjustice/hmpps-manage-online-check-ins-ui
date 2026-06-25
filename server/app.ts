import express from 'express'

import createError from 'http-errors'

import pdsComponents from '@ministryofjustice/hmpps-probation-frontend-components'
import nunjucksSetup from './utils/nunjucksSetup'
import errorHandler from './errorHandler'
import authorisationMiddleware from './middleware/authorisationMiddleware'
import setUpAuthentication from './middleware/setUpAuthentication'
import setUpCsrf from './middleware/setUpCsrf'
import setUpCurrentUser from './middleware/setUpCurrentUser'
import setUpHealthChecks from './middleware/setUpHealthChecks'
import setUpStaticResources from './middleware/setUpStaticResources'
import setUpWebRequestParsing from './middleware/setUpRequestParsing'
import setUpWebSecurity from './middleware/setUpWebSecurity'
import setUpWebSession from './middleware/setUpWebSession'

import routes from './routes'
import type { Services } from './services'
import config from './config'
import logger from '../logger'

export default function createApp(services: Services): express.Application {
  const app = express()

  app.set('json spaces', 2)
  app.set('trust proxy', true)
  app.set('port', process.env.PORT || 3000)

  app.use(setUpHealthChecks(services.applicationInfo))
  app.use(setUpWebSecurity())
  app.use(setUpWebSession())
  app.use(setUpWebRequestParsing())
  app.use(setUpStaticResources())
  nunjucksSetup(app)
  app.use(setUpAuthentication())
  app.use(authorisationMiddleware())
  app.use(setUpCsrf())
  app.use(setUpCurrentUser())
  app.use((req, res, next) => {
    logger.info(
      {
        pdsUrl: config.apis.probationApi.url,
        hasUser: !!res.locals.user,
        hasToken: !!res.locals.user?.token,
        displayName: res.locals.user?.displayName,
        tokenStart: res.locals.user?.token,
      },
      'Before probation frontend components',
    )
    next()
  })
  app.get(
    '/{*splat}',
    pdsComponents.getPageComponents({
      pdsUrl: config.apis.probationApi.url,
      logger,
    }),
  )
  app.use(routes())

  app.use((_req, _res, next) => next(createError(404, 'Not found')))
  app.use(errorHandler(process.env.NODE_ENV === 'production'))

  return app
}
