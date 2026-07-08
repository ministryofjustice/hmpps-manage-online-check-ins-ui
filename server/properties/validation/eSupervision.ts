import { ValidationSpec } from '../../models/Errors'
import { isNotEmpty } from '../../utils/validationUtils'

export interface ESupervisionValidationArgs {
  crn: string
  id: string
  page: string
  checkInMobile?: string
  checkInEmail?: string
  editCheckInEmail?: string
  editCheckInMobile?: string
  change?: string
  stopCheckIn?: string
}

export const eSuperVisionValidation = (args: ESupervisionValidationArgs): ValidationSpec => {
  const { crn, id, page } = args
  return {
    [`[esupervision][${crn}][${id}][manageCheckin][stopCheckinReason]`]: {
      optional: page !== 'stop-checkin',
      checks: [
        {
          validator: isNotEmpty,
          msg: 'Enter the reason for stopping',
          log: 'Stop checkin, reason not provided',
        },
      ],
    },
    [`[esupervision][${crn}][${id}][manageCheckin][stopCheckinSensitive]`]: {
      optional: page !== 'stop-checkin',
      checks: [
        {
          validator: isNotEmpty,
          msg: 'Select yes if the reason for stopping includes sensitive information',
          log: 'Stop checkin sensitive selection not completed',
        },
      ],
    },
  }
}
