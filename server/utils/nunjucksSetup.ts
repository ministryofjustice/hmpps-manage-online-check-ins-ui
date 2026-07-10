/* eslint-disable no-param-reassign */
import path from 'path'
import fs from 'fs'
import { AsyncLocalStorage } from 'node:async_hooks'
import express, { Request, RequestHandler } from 'express'
import nunjucks from 'nunjucks'
import { arnsNunjucksSetup } from '@ministryofjustice/hmpps-arns-frontend-components-lib'

import type { AppResponse } from '../models/Locals'
import config from '../config'
import logger from '../../logger'

import { initialiseName } from './utils'
import { dateWithYear, dateWithYearTimeFirst } from './dateWithYear'

import yearsSince from './yearsSince'
import makePageTitle from './makePageTitle'
import decorateFormAttributes from './decorateFormAttributes'
import toErrorList from './toErrorList'

import getUserFriendlyString from './eSupervisionFriendlyString'
import { handleQuotes } from './handleQuotes'
import { formatEnforcementActionNote } from './formatEnforcementActionNote'
import { splitString } from './splitString'

export default function nunjucksSetup(app: express.Express): void {
  app.set('view engine', 'njk')

  app.locals.asset_path = '/assets/'
  app.locals.applicationName = 'HMPPS Manage Online Check Ins Ui'
  app.locals.environmentName = config.environmentName
  app.locals.environmentNameColour = config.environmentName === 'PRE-PRODUCTION' ? 'govuk-tag--green' : ''

  const requestContext = new AsyncLocalStorage<{ req: Request; res: AppResponse }>()

  const requestContextMiddleware: RequestHandler = (req, res, next) => {
    requestContext.run({ req, res: res as AppResponse }, next)
  }

  app.use(requestContextMiddleware)

  let assetManifest: Record<string, string> = {}

  try {
    const assetMetadataPath = path.resolve(__dirname, '../../assets/manifest.json')
    assetManifest = JSON.parse(fs.readFileSync(assetMetadataPath, 'utf8'))
  } catch (e) {
    if (process.env.NODE_ENV !== 'test') {
      logger.error(e, 'Could not read asset manifest file')
    }
  }

  const njkEnv = nunjucks.configure(
    [
      path.join(__dirname, 'server/views'),
      path.join(__dirname, '../../server/views'),
      'node_modules/govuk-frontend/dist/',
      'node_modules/govuk-frontend/dist/components/',
      'node_modules/@ministryofjustice/frontend/',
      'node_modules/@ministryofjustice/frontend/moj/components/',
      'node_modules/@ministryofjustice/hmpps-probation-frontend-components/dist/assets/',
      'node_modules/@ministryofjustice/probation-search-frontend/components',
      'node_modules/@ministryofjustice/hmpps-arns-frontend-components-lib/dist/',
      'node_modules/@ministryofjustice/hmpps-mpop-frontend-components-lib/dist/',
    ],
    {
      autoescape: true,
      express: app,
      noCache: process.env.NODE_ENV !== 'production',
    },
  )

  njkEnv.addFilter('initialiseName', initialiseName)
  njkEnv.addFilter('dateWithYear', dateWithYear)
  njkEnv.addFilter('dateWithYearTimeFirst', dateWithYearTimeFirst)
  njkEnv.addFilter('yearsSince', yearsSince)
  njkEnv.addFilter('split', splitString)
  njkEnv.addFilter('userFriendlyString', getUserFriendlyString)
  njkEnv.addFilter('formatEnforcementActionNote', formatEnforcementActionNote)
  njkEnv.addFilter('handleQuotes', handleQuotes)
  njkEnv.addFilter('assetMap', (url: string) => assetManifest[url] || url)
  njkEnv.addFilter('decorateFormAttributes', (obj: unknown, sections?: string[]) => {
    const ctx = requestContext.getStore()

    if (!ctx) {
      logger.warn('decorateFormAttributes called without request context')
      return obj
    }

    return decorateFormAttributes(ctx.req, ctx.res)(obj, sections)
  })
  njkEnv.addFilter('toErrorList', toErrorList)
  njkEnv.addGlobal('makePageTitle', makePageTitle)

  arnsNunjucksSetup(njkEnv)
}
