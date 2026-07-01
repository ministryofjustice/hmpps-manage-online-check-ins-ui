import { HmppsUser } from '../../interfaces/hmppsUser'

export declare module 'express-session' {
  // Declare that the session will potentially contain these additional fields
  interface SessionData {
    [key: string]: string | undefined
    returnTo: string
    nowInMinutes: number
    mas?: Mas.MasData
    page: string
    sortBy: string
    caseFilter: CaseFilter
    activityLogFilters?: ActivityLogFilters
    documentFilters?: DocumentFilters
    documentLevels?: DocumentLevel[]
    outcomesFilter?: {
      [crn: string]: 'PAST_TWO_YEARS' | 'OLDER_THAN_TWO_YEARS' | 'ALL'
    }
    data?: Data
    errors?: Errors
    errorMessages?: Record<string, string>
    alertDismissed?: boolean
    cache?: {
      activityLog?: ActivityLogCache
      uploadedFiles?: FileCache[]
    }
    body?: Record<string, any>
  }
}

export declare global {
  namespace Express {
    interface User {
      username: string
      token: string
      authSource: string
    }

    interface Request {
      verified?: boolean
      id: string
      logout(done: (err: unknown) => void): void
    }

    interface Locals {
      user: HmppsUser
      cspNonce: string
      csrfToken: string
      asset_path: string
      applicationName: string
      environmentName: string
      environmentNameColour: string
      appInsightsConnectionString?: string
      appInsightsApplicationName?: string
      buildNumber?: string
    }
  }
}
