import { Route } from '../@types'
import FeatureFlagService from '../services/featureFlagService'
import { featureFlags, FeatureFlagDescriptor, FeatureFlags } from '../models/Locals'
import config from '../config'

// Dev and test share dev's Flipt namespace. Sending the environment lets a flag's rollout set test
// apart, e.g. a branch under test there while the flag stays off in dev.
const flagContext = (): Record<string, string> => ({ environment: config.env })

const evaluateFeatureFlags = (
  featureFlagService: FeatureFlagService,
  flagDescriptors: readonly FeatureFlagDescriptor[] = featureFlags,
): Route<Promise<void>> => {
  return async (req, res, next) => {
    const context = flagContext()
    const flags: FeatureFlags = res.locals.flags ?? {}
    res.locals.flags = flags
    await Promise.all(
      flagDescriptors.map(async ({ key, type }) => {
        const value =
          type === 'variant'
            ? await featureFlagService.evaluateVariant(key, 'global', context)
            : await featureFlagService.evaluateBoolean(key, 'global', context)
        flags[key] = value
      }),
    )
    return next()
  }
}

export default evaluateFeatureFlags
