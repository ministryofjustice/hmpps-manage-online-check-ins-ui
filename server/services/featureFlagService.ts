import { FliptClient } from '@flipt-io/flipt-client-js'
import config from '../config'
import logger from '../../logger'

export default class FeatureFlagService {
  private clientPromise?: Promise<FliptClient>

  private getClient(): Promise<FliptClient> {
    if (!this.clientPromise) {
      this.clientPromise = FliptClient.init(config.flipt).catch(error => {
        this.clientPromise = undefined
        throw error
      })
    }
    return this.clientPromise
  }

  async evaluateBoolean(flagKey: string, entityId: string, context: Record<string, string> = {}): Promise<boolean> {
    try {
      const client = await this.getClient()
      return client.evaluateBoolean({ flagKey, entityId, context }).enabled
    } catch (error) {
      logger.error(error, `Failed to evaluate feature flag '${flagKey}', defaulting to disabled`)
      return false
    }
  }

  async evaluateVariant(
    flagKey: string,
    entityId: string,
    context: Record<string, string> = {},
  ): Promise<string | undefined> {
    try {
      const client = await this.getClient()
      const result = client.evaluateVariant({ flagKey, entityId, context })
      return result.match ? result.variantKey : undefined
    } catch (error) {
      logger.error(error, `Failed to evaluate feature flag variant '${flagKey}', defaulting to no variant`)
      return undefined
    }
  }
}
