export type CheckInEligibilityPage =
  | 'eligibility-check'
  | 'pilot-check'
  | 'is-eligible'
  | 'not-eligible'
  | 'discuss-before-signup'
  | 'accredited-programme-approval'
  | 'rationale'
  | 'sentence-selection'
  | 'check-in-frequency'

export type CheckInEligibilityJourney = 'setup' | 'reactivation'

export interface CheckInEligibilityContext {
  journey: CheckInEligibilityJourney
  eligibilitySessionKey: 'checkins' | 'restartCheckin'
  eligibilityUrlPrefix: string
  urlForEligibilityPage: (page: CheckInEligibilityPage) => string
}

const reactivationPageNames: Record<CheckInEligibilityPage, string> = {
  'eligibility-check': 'eligibility-check',
  'pilot-check': 'pilot-check',
  'is-eligible': 'is-eligible',
  'not-eligible': 'not-eligible',
  'discuss-before-signup': 'discuss-before-signup',
  'accredited-programme-approval': 'accredited-programme-approval',
  rationale: 'rationale',
  'sentence-selection': 'sentence-selection',
  'check-in-frequency': 'checkin',
}

export const getCheckInEligibilityContext = (
  journey: CheckInEligibilityJourney,
  crn: string,
  id: string,
): CheckInEligibilityContext => {
  const isReactivation = journey === 'reactivation'
  const root = isReactivation
    ? `/case/${crn}/appointments/check-in/manage/${id}`
    : `/case/${crn}/appointments/${id}/check-in`
  const eligibilityUrlPrefix = isReactivation ? `${root}/restart-` : `${root}/`

  return {
    journey,
    eligibilitySessionKey: isReactivation ? 'restartCheckin' : 'checkins',
    eligibilityUrlPrefix,
    urlForEligibilityPage: (page: CheckInEligibilityPage) =>
      `${eligibilityUrlPrefix}${isReactivation ? reactivationPageNames[page] : page}`,
  }
}
