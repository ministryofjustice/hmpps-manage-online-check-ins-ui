import type { Response } from 'express'
import { Errors } from './Errors'
import {
  CancellableCheckin,
  EsupervisionUpcomingQuestionsResponse,
  OffenderByCRNResponse,
  SupervisionPackageStatus,
} from '../data/model/esupervision'
import type { CheckInEligibilityJourney } from '../utils/checkInEligibilityContext'

export interface LocalsUser {
  userId?: string
  userUuid?: string
  username?: string
  firstName?: string
  surname?: string
  email?: string
  roles?: string[]
  name?: string
  displayName?: string
  token?: string
  authSource?: string
}

export interface FeatureFlagDescriptor {
  key: string
  type: 'boolean' | 'variant'
}

// Add Flipt flags here with their type
export const featureFlags: FeatureFlagDescriptor[] = [
  { key: 'eligibilityFeatureToggle', type: 'boolean' },
  { key: 'mockAccreditedProgrammeTiersABToggle', type: 'boolean' },
  { key: 'newDesignPopHeader', type: 'boolean' },
  { key: 'enablePersonHeaderTierV3', type: 'boolean' }, // gitleaks:allow - feature flag name, not a secret
]

export type FeatureFlags = Record<string, boolean | string | undefined>

export interface AppLocals extends Record<string, unknown> {
  errorMessages?: Record<string, string>
  warningMessages?: Record<string, string>
  user?: LocalsUser

  applicationName?: string
  environmentName?: string
  environmentNameColour?: string
  asset_path?: string

  csrfToken?: string
  cspNonce?: string
  errors?: Errors

  title?: string
  status?: number
  stack?: boolean | number | string
  version?: string
  backLink?: string

  uploadError?: string
  renderPath?: string
  offenderCheckinsByCRNResponse?: OffenderByCRNResponse
  // The person's open check-in, if they have one; set by middleware/getCancellableCheckin.
  cancellableCheckin?: CancellableCheckin | null
  // The upcoming-questions response, fetched by getCancellableCheckin for the overview to reuse.
  upcomingCheckin?: EsupervisionUpcomingQuestionsResponse | null
  supervisionPackageStatus?: SupervisionPackageStatus | null
  checkInEligibilityJourney?: CheckInEligibilityJourney
  flags?: FeatureFlags
}

export type AppResponse = Response<unknown, AppLocals>
