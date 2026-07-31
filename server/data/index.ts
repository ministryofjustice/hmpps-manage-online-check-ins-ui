import { AuthenticationClient } from '@ministryofjustice/hmpps-auth-clients'
import applicationInfoSupplier from '../applicationInfo'
import { ArnsComponents } from '@ministryofjustice/hmpps-arns-frontend-components-lib'
import config from '../config'
import HmppsAuthClient from './hmppsAuthClient'
import HmppsAuditClient from './hmppsAuditClient'

import { createRedisClient } from './redisClient'
import InMemoryTokenStore from './tokenStore/inMemoryTokenStore'
import RedisTokenStore from './tokenStore/redisTokenStore'
import logger from '../../logger'

const applicationInfo = applicationInfoSupplier()

const authClientArns = new AuthenticationClient(
  config.apis.hmppsAuth,
  logger,
  config.redis.enabled ? new RedisTokenStore(createRedisClient()) : new InMemoryTokenStore(),
)

export const dataAccess = () => {
  const tokenStore = config.redis.enabled ? new RedisTokenStore(createRedisClient()) : new InMemoryTokenStore()

  const hmppsAuthClient = new HmppsAuthClient(tokenStore)

  return {
    applicationInfo,

    hmppsAuthClient,

    hmppsAuditClient: new HmppsAuditClient(config.sqs.audit),
    
    authClientArns,
    arnsComponents: new ArnsComponents(authClientArns, config.apis.arnsApi, logger),

    // esupervisionApiClient: new ESupervisionClient(),
  }
}

export type DataAccess = ReturnType<typeof dataAccess>

export { HmppsAuthClient }
