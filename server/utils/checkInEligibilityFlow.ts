export type CheckInEligibilityPage =
  | 'eligibility-check'
  | 'pilot-check'
  | 'is-eligible'
  | 'not-eligible'
  | 'discuss-before-signup'
  | 'accredited-programme-approval'
  | 'rationale'
  | 'check-in-frequency'

const restartPageNames: Record<CheckInEligibilityPage, string> = {
  'eligibility-check': 'eligibility-check',
  'pilot-check': 'pilot-check',
  'is-eligible': 'is-eligible',
  'not-eligible': 'not-eligible',
  'discuss-before-signup': 'discuss-before-signup',
  'accredited-programme-approval': 'accredited-programme-approval',
  rationale: 'rationale',
  'check-in-frequency': 'checkin',
}

export const getCheckInEligibilityFlow = (pathname: string, crn: string, id: string) => {
  const isRestart = pathname.includes('/appointments/check-in/manage/') && pathname.includes('/restart-')
  const root = isRestart
    ? `/case/${crn}/appointments/check-in/manage/${id}`
    : `/case/${crn}/appointments/${id}/check-in`
  const pathPrefix = isRestart ? `${root}/restart-` : `${root}/`

  return {
    isRestart,
    sessionKey: isRestart ? 'restartCheckin' : 'checkins',
    pathPrefix,
    path: (page: CheckInEligibilityPage) => `${pathPrefix}${isRestart ? restartPageNames[page] : page}`,
  }
}
