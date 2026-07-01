import config from '../config'

const makePageTitle = ({ pageHeading }: { pageHeading: string | string[] }): string => {
  const titles = !Array.isArray(pageHeading) ? [pageHeading] : pageHeading
  return `${titles.join(' - ')} - ${config.applicationName}`
}

export default makePageTitle
