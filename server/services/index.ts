import { dataAccess } from '../data'
import AuditService from './auditService'
import FeatureFlagService from './featureFlagService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, hmppsAuthClient, arnsComponents } = dataAccess()

  return {
    applicationInfo,
    hmppsAuthClient,
    auditService: new AuditService(hmppsAuditClient),
    arnsComponents,
    featureFlagService: new FeatureFlagService(),
  }
}

export type Services = ReturnType<typeof services>
