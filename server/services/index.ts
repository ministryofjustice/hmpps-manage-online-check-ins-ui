import { dataAccess } from '../data'
import AuditService from './auditService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, hmppsAuthClient } = dataAccess()
  // const { applicationInfo, hmppsAuditClient, hmppsAuthClient, arnsComponents } = dataAccess()

  return {
    applicationInfo,
    hmppsAuthClient,
    auditService: new AuditService(hmppsAuditClient),
    // arnsComponents,
  }
}

export type Services = ReturnType<typeof services>
