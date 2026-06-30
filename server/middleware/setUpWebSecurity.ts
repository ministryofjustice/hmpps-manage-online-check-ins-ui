import crypto from 'crypto'
import express, { Router, Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import { IncomingMessage, ServerResponse } from 'http'
import config from '../config'

export default function setUpWebSecurity(): Router {
  const router = express.Router()

  // Secure code best practice - see:
  // 1. https://expressjs.com/en/advanced/best-practice-security.html,
  // 2. https://www.npmjs.com/package/helmet
  router.use((_req: Request, res: Response, next: NextFunction) => {
    res.locals.cspNonce = crypto.randomBytes(16).toString('hex')
    next()
  })
  router.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // This nonce allows us to use scripts with the use of the `cspNonce` local, e.g (in a Nunjucks template):
          // <script nonce="{{ cspNonce }}">
          // or
          // <link href="http://example.com/" rel="stylesheet" nonce="{{ cspNonce }}">
          // This ensures only scripts we trust are loaded, and not anything injected into the
          // page by an attacker.
          imgSrc: [
            "'self'",
            // This is required for the S3 bucket to upload checkin images
            // (either have a custom domain for each environment or use the default wild card domain)
            // data: Allow inline base64 images across all environments (needed for data URL previews)
            'data:',
            'https://*.s3.eu-west-2.amazonaws.com/',
          ],
          scriptSrc: [
            "'self'",
            (_req: IncomingMessage, res: ServerResponse) => `'nonce-${(res as Response).locals.cspNonce}'`,
          ],
          connectSrc: (() => {
            const sources = [config.probationFrontendComponents.connectSrc]
            // Allow localhost for local development only
            if (config.env === 'local') {
              sources.push('http://localhost:9091')
              sources.push('http://localhost:3000')
            }
            return sources
          })(),
          styleSrc: ["'self'", (_req: Request, res: Response) => `'nonce-${res.locals.cspNonce}'`],
          fontSrc: ["'self'"],
          formAction: [`'self' ${config.apis.hmppsAuth.externalUrl}`],
          ...(config.production ? {} : { upgradeInsecureRequests: null }),
        },
      },
      crossOriginEmbedderPolicy: true,
    }),
  )
  return router
}
