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
  summaryUrl: string
  urlForEligibilityPage: (page: CheckInEligibilityPage) => string
  nextPageAfterSentenceSelection: (cya: boolean) => string
  sentenceSelectionBackLink: (cya: boolean, accreditedProgramme: boolean) => string
  frequencyBackLink: (options: {
    cya: boolean
    accreditedProgramme: boolean
    sentenceSelectionEnabled: boolean
    eventCount: number
  }) => string
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
  const summaryUrl = `${root}/${isReactivation ? 'restart-summary' : 'checkin-summary'}`
  const urlForEligibilityPage = (page: CheckInEligibilityPage) =>
    `${eligibilityUrlPrefix}${isReactivation ? reactivationPageNames[page] : page}`

  return {
    journey,
    eligibilitySessionKey: isReactivation ? 'restartCheckin' : 'checkins',
    eligibilityUrlPrefix,
    summaryUrl,
    urlForEligibilityPage,
    nextPageAfterSentenceSelection: cya => (cya ? summaryUrl : urlForEligibilityPage('check-in-frequency')),
    sentenceSelectionBackLink: (cya, accreditedProgramme) =>
      cya ? summaryUrl : urlForEligibilityPage(accreditedProgramme ? 'rationale' : 'is-eligible'),
    frequencyBackLink: ({ cya, accreditedProgramme, sentenceSelectionEnabled, eventCount }) => {
      if (cya) return summaryUrl
      if (sentenceSelectionEnabled && eventCount > 1) return urlForEligibilityPage('sentence-selection')
      return urlForEligibilityPage(accreditedProgramme ? 'rationale' : 'is-eligible')
    },
  }
}
