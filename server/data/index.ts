import applicationInfoSupplier from '../applicationInfo'
// import { ArnsComponents } from '@ministryofjustice/hmpps-arns-frontend-components-lib'
import config from '../config'
import HmppsAuthClient from './hmppsAuthClient'
import HmppsAuditClient from './hmppsAuditClient'

import { createRedisClient } from './redisClient'
import InMemoryTokenStore from './tokenStore/inMemoryTokenStore'
import RedisTokenStore from './tokenStore/redisTokenStore'
// import logger from '../../logger'
// import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'

const applicationInfo = applicationInfoSupplier()

// const authClientArns = new AuthenticationClient (
//   config.apis.hmppsAuth,
//   logger,
//   config.redis.enabled ? new RedisTokenStore(createRedisClient()) : new InMemoryTokenStore(),
// )

export const dataAccess = () => {
  const tokenStore = config.redis.enabled ? new RedisTokenStore(createRedisClient()) : new InMemoryTokenStore()

  const hmppsAuthClient = new HmppsAuthClient(tokenStore)

  return {
    applicationInfo,

    hmppsAuthClient,

    hmppsAuditClient: new HmppsAuditClient(config.sqs.audit),

    // authClientArns,
    // [Build] server/data/index.ts:34:40 - error TS2345: Argument of type 'import("/Users/dave.iles/Repos/hmpps-manage-online-check-ins-ui/node_modules/@ministryofjustice/hmpps-auth-clients/dist/index").AuthenticationClient' is not assignable to parameter of type 'import("/Users/dave.iles/Repos/hmpps-manage-online-check-ins-ui/node_modules/@ministryofjustice/hmpps-arns-frontend-components-lib/node_modules/@ministryofjustice/hmpps-auth-clients/dist/index").AuthenticationClient'.
    // [Build]   Property 'config' is protected but type 'AuthenticationClient' is not a class derived from 'AuthenticationClient'.
    // [Build]
    // [Build] 34     arnsComponents: new ArnsComponents(authClientArns, config.apis.arnsApi, logger),
    // arnsComponents: new ArnsComponents(authClientArns, config.apis.arnsApi, logger),

    // esupervisionApiClient: new ESupervisionClient(),
  }
}

export type DataAccess = ReturnType<typeof dataAccess>

export { HmppsAuthClient }
