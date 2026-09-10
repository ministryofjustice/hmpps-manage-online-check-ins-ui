import { Route } from '../@types'
import FeatureFlagService from '../services/featureFlagService'
import { featureFlags, FeatureFlagDescriptor, FeatureFlags } from '../models/Locals'

const evaluateFeatureFlags = (
  featureFlagService: FeatureFlagService,
  flagDescriptors: readonly FeatureFlagDescriptor[] = featureFlags,
): Route<Promise<void>> => {
  return async (req, res, next) => {
    const flags: FeatureFlags = res.locals.flags ?? {}
    res.locals.flags = flags
    await Promise.all(
      flagDescriptors.map(async ({ key, type }) => {
        const value =
          type === 'variant'
            ? await featureFlagService.evaluateVariant(key, 'global')
            : await featureFlagService.evaluateBoolean(key, 'global')
        flags[key] = value
      }),
    )
    return next()
  }
}

export default evaluateFeatureFlags
