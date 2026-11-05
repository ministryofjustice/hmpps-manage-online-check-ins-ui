import setDataValue from './setDataValue'

// Clears only the cancel page's answers, leaving anything else in progress under manageCheckin.
const clearCancelCheckinAnswers = (data: Record<string, unknown>, crn: string, id: string): void => {
  setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'cancelCheckinReason'], undefined)
  setDataValue(data, ['esupervision', crn, id, 'manageCheckin', 'cancelCheckinSensitive'], undefined)
}

export default clearCancelCheckinAnswers
