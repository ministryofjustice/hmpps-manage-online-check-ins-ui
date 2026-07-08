import applicationInfoSupplier from '../applicationInfo'
import config from '../config'
import HmppsAuthClient from './hmppsAuthClient'
import HmppsAuditClient from './hmppsAuditClient'

import { createRedisClient } from './redisClient'
import InMemoryTokenStore from './tokenStore/inMemoryTokenStore'
import RedisTokenStore from './tokenStore/redisTokenStore'

const applicationInfo = applicationInfoSupplier()

export const dataAccess = () => {
  const tokenStore = config.redis.enabled ? new RedisTokenStore(createRedisClient()) : new InMemoryTokenStore()

  const hmppsAuthClient = new HmppsAuthClient(tokenStore)

  return {
    applicationInfo,

    hmppsAuthClient,

    hmppsAuditClient: new HmppsAuditClient(config.sqs.audit),

    // esupervisionApiClient: new ESupervisionClient()
  }
}

export type DataAccess = ReturnType<typeof dataAccess>

export { HmppsAuthClient }
