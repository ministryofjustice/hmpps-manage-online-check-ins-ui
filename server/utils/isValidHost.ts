import config from '../config'

export const isValidHost = (host: string): boolean => {
  const validHosts = [
    config.apis.hmppsAuth.url,
    config.apis.hmppsAuth.externalUrl,
    config.apis.tokenVerification.url,
    config.apis.masApi.url,
    config.apis.probationApi.url,
    config.apis.eSupervisionApi.url,
  ].filter(Boolean)
  return validHosts.includes(host)
}
