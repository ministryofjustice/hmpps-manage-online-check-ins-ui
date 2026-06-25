import { dataAccess } from '../data'
import AuditService from './auditService'
import EsupervisionService from './esupervisionService'
import ExampleService from './exampleService'

export const services = () => {
  const { applicationInfo, hmppsAuditClient, exampleApiClient, esupervisionApiClient } = dataAccess()

  return {
    applicationInfo,
    auditService: new AuditService(hmppsAuditClient),
    exampleService: new ExampleService(exampleApiClient),
    esupervisionService: new EsupervisionService(esupervisionApiClient),
  }
}

export type Services = ReturnType<typeof services>
