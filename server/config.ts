const production = process.env.NODE_ENV === 'production'

function get<T>(name: string, fallback: T, options = { requireInProduction: false }): T | string {
  if (process.env[name]) {
    return process.env[name]
  }
  if (fallback !== undefined && (!production || !options.requireInProduction)) {
    return fallback
  }
  throw new Error(`Missing env var ${name}`)
}

const requiredInProduction = { requireInProduction: true }

const auditConfig = () => {
  const auditEnabled = get('AUDIT_ENABLED', 'false') === 'true'
  return {
    enabled: auditEnabled,
    queueUrl: get(
      'AUDIT_SQS_QUEUE_URL',
      'http://localhost:4566/000000000000/mainQueue',
      auditEnabled ? requiredInProduction : undefined,
    ),
    serviceName: get('AUDIT_SERVICE_NAME', 'UNASSIGNED', auditEnabled ? requiredInProduction : undefined),
    region: get('AUDIT_SQS_REGION', 'eu-west-2'),
  }
}

export class AgentConfig {
  // Sets the working socket to timeout after timeout milliseconds of inactivity on the working socket.
  timeout: number

  constructor(timeout = 8000) {
    this.timeout = timeout
  }
}

export interface ApiConfig {
  url: string
  timeout: {
    // sets maximum time to wait for the first byte to arrive from the server, but it does not limit how long the
    // entire download can take.
    response: number
    // sets a deadline for the entire request (including all uploads, redirects, server processing time) to complete.
    // If the response isn't fully downloaded within that time, the request will be aborted.
    deadline: number
  }
  agent: AgentConfig
}

export default {
  buildNumber: get('BUILD_NUMBER', '1_0_0', requiredInProduction),
  productId: get('PRODUCT_ID', 'UNASSIGNED', requiredInProduction),
  gitRef: get('GIT_REF', 'xxxxxxxxxxxxxxxxxxx', requiredInProduction),
  branchName: get('GIT_BRANCH', 'xxxxxxxxxxxxxxxxxxx', requiredInProduction),
  production,
  https: process.env.NO_HTTPS === 'true' ? false : production,
  applicationName: 'Manage online check ins',
  env: get('ENVIRONMENT', 'dev', requiredInProduction) as 'local' | 'dev' | 'test' | 'preprod' | 'prod',
  staticResourceCacheDuration: '1h',
  redis: {
    enabled: get('REDIS_ENABLED', 'false', requiredInProduction) === 'true',
    host: get('REDIS_HOST', 'localhost', requiredInProduction),
    port: parseInt(process.env.REDIS_PORT, 10) || 6379,
    password: process.env.REDIS_AUTH_TOKEN,
    tls_enabled: get('REDIS_TLS_ENABLED', 'false'),
  },
  session: {
    secret: get('SESSION_SECRET', 'app-insecure-default-session', requiredInProduction),
    expiryMinutes: Number(get('WEB_SESSION_TIMEOUT_IN_MINUTES', 120)),
  },
  managePeopleOnProbation: {
    link: get(
      'MANAGE_PEOPLE_ON_PROBATION_LINK',
      'https://manage-people-on-probation-dev.hmpps.service.justice.gov.uk',
      requiredInProduction,
    ),
  },
  feedbackBanner: {
    link: get(
      'FEEDBACK_BANNER_LINK',
      'https://www.smartsurvey.co.uk/t/AAGPPN?service=Online%20check%20ins',
      requiredInProduction,
    ),
  },
  guidance: {
    link: get(
      'ESUPERVISION_GUIDANCE_LINK',
      'https://probation-check-in-dev.hmpps.service.justice.gov.uk',
      requiredInProduction,
    ),
  },
  probationFrontendComponents: {
    connectSrc: get(
      'COMPONENT_API_URL',
      'https://probation-frontend-components-dev.hmpps.service.justice.gov.uk',
      requiredInProduction,
    ),
    fontSrc: get(
      'COMPONENT_API_URL',
      'https://probation-frontend-components-dev.hmpps.service.justice.gov.uk',
      requiredInProduction,
    ),
  },
  apis: {
    hmppsAuth: {
      url: get('HMPPS_AUTH_URL', 'http://localhost:8090/auth', requiredInProduction),
      healthPath: '/health/ping',
      externalUrl: get('HMPPS_AUTH_EXTERNAL_URL', get('HMPPS_AUTH_URL', 'http://localhost:8090/auth')),
      timeout: {
        response: Number(get('HMPPS_AUTH_TIMEOUT_RESPONSE', 10000)),
        deadline: Number(get('HMPPS_AUTH_TIMEOUT_DEADLINE', 10000)),
      },
      agent: new AgentConfig(Number(get('HMPPS_AUTH_TIMEOUT_RESPONSE', 10000))),
      authClientId: get('AUTH_CODE_CLIENT_ID', 'clientid', requiredInProduction),
      authClientSecret: get('AUTH_CODE_CLIENT_SECRET', 'clientsecret', requiredInProduction),
      systemClientId: get('CLIENT_CREDS_CLIENT_ID', 'clientid', requiredInProduction),
      systemClientSecret: get('CLIENT_CREDS_CLIENT_SECRET', 'clientsecret', requiredInProduction),
    },
    tokenVerification: {
      url: get('TOKEN_VERIFICATION_API_URL', 'http://localhost:8100', requiredInProduction),
      healthPath: '/health/ping',
      timeout: {
        response: Number(get('TOKEN_VERIFICATION_API_TIMEOUT_RESPONSE', 5000)),
        deadline: Number(get('TOKEN_VERIFICATION_API_TIMEOUT_DEADLINE', 5000)),
      },
      agent: new AgentConfig(Number(get('TOKEN_VERIFICATION_API_TIMEOUT_RESPONSE', 5000))),
      enabled: get('TOKEN_VERIFICATION_ENABLED', 'false') === 'true',
    },
    masApi: {
      url: get('MAS_API_URL', 'http://localhost:8100', requiredInProduction),
      pageSize: 10,
      timeout: {
        response: Number(get('MAS_API_TIMEOUT_RESPONSE', 10000)),
        deadline: Number(get('MAS_API_TIMEOUT_DEADLINE', 10000)),
      },
      agent: new AgentConfig(Number(get('MAS_API_TIMEOUT_RESPONSE', 10000))),
    },
    probationApi: {
      url: get(
        'COMPONENT_API_URL',
        'https://probation-frontend-components-dev.hmpps.service.justice.gov.uk',
        requiredInProduction,
      ),
      healthPath: '/health/ping',
    },
    eSupervisionApi: {
      url: get('ESUPERVISION_API_URL', 'http://localhost:8080', requiredInProduction),
      healthPath: '/health/ping',
      timeout: {
        response: Number(get('ESUPERVISION_API_TIMEOUT_RESPONSE', 5000)),
        deadline: Number(get('ESUPERVISION_API_TIMEOUT_DEADLINE', 5000)),
      },
      agent: new AgentConfig(Number(get('ESUPERVISION_API_TIMEOUT_RESPONSE', 5000))),
    },
  },
  sqs: {
    audit: auditConfig(),
  },
  ingressUrl: get('INGRESS_URL', 'http://localhost:3000', requiredInProduction),
  environmentName: get('ENVIRONMENT_NAME', ''),
  dateFields: ['date'],
  timeFields: [
    { name: 'start', dateField: 'date' },
    { name: 'end', dateField: 'date' },
  ],
  preservedWords: ['(NS)', '(Non', 'NS)'],
  preservedSeparators: ['-'],
  maxCharCount: get('CHAR_COUNT', 12000, requiredInProduction),
}
