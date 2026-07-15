import { ValidationSpec } from '../../models/Errors'
import {
  charsOrLess,
  contactPrefEmailCheck,
  contactPrefMobileCheck,
  isEmail,
  isFutureDate,
  isNotEmpty,
  isTodayOrLater,
  isValidDate,
  isValidDateFormat,
  isValidMobileNumber,
} from '../../utils/validationUtils'

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
  const {
    crn,
    id,
    page,
    checkInEmail = '',
    checkInMobile = '',
    editCheckInEmail = '',
    editCheckInMobile = '',
    change = '',
  } = args
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

    // checkin-settings — change the next check-in date/frequency
    [`[esupervision][${crn}][${id}][manageCheckin][date]`]: {
      optional: page !== 'checkin-settings',
      checks: [
        { validator: isNotEmpty, msg: 'Enter the date you would like the person to complete their next check in' },
        { validator: isValidDateFormat, msg: 'Enter a date in the correct format, for example 17/5/2024' },
        { validator: isValidDate, msg: 'Enter a date in the correct format, for example 17/5/2024' },
        { validator: isFutureDate, msg: 'The next online check in date must be in the future' },
      ],
    },

    // manage-contact — contact preference (validated only when submitting the main form)
    [`[esupervision][${crn}][${id}][manageCheckin][checkInEmail]`]: {
      optional: (page === 'manage-contact' && checkInEmail.trim() !== '') || page !== 'manage-contact',
      checks: [
        {
          validator: contactPrefEmailCheck,
          msg: 'Enter an email address',
          crossField: `[esupervision][${crn}][${id}][manageCheckin][preferredComs]`,
        },
      ],
    },
    [`[esupervision][${crn}][${id}][manageCheckin][checkInMobile]`]: {
      optional: (page === 'manage-contact' && checkInMobile.trim() !== '') || page !== 'manage-contact',
      checks: [
        {
          validator: contactPrefMobileCheck,
          msg: 'Enter a mobile number',
          crossField: `[esupervision][${crn}][${id}][manageCheckin][preferredComs]`,
        },
      ],
    },

    // edit-contact — mobile/email (optional; format-checked only when a value is present)
    [`[esupervision][${crn}][${id}][manageCheckin][editCheckInMobile]`]: {
      optional: (page === 'edit-contact' && !editCheckInMobile) || page !== 'edit-contact',
      checks: [
        { validator: isValidMobileNumber, msg: 'Enter a mobile number in the correct format.' },
        { validator: charsOrLess, length: 35, msg: 'Mobile number must be 35 characters or less.' },
      ],
    },
    [`[esupervision][${crn}][${id}][manageCheckin][editCheckInEmail]`]: {
      optional: (page === 'edit-contact' && !editCheckInEmail) || page !== 'edit-contact',
      checks: [
        { validator: isEmail, msg: 'Enter an email address in the correct format.' },
        { validator: charsOrLess, length: 254, msg: 'Email address must be 254 characters or less.' },
      ],
    },

    // restart-date-frequency
    [`[esupervision][${crn}][${id}][restartCheckin][date]`]: {
      optional: page !== 'restart-date-frequency',
      checks: [
        {
          validator: isNotEmpty,
          msg: 'Enter the date you would like the person to complete their next online check in',
        },
        { validator: isValidDateFormat, msg: 'Enter a date in the correct format, for example 17/5/2024' },
        { validator: isValidDate, msg: 'Enter a date in the correct format, for example 17/5/2024' },
        { validator: isTodayOrLater, msg: 'The next online check in date must be today or in the future' },
      ],
    },
    [`[esupervision][${crn}][${id}][restartCheckin][interval]`]: {
      optional: page !== 'restart-date-frequency',
      checks: [{ validator: isNotEmpty, msg: 'Select how often you would like the person to check in' }],
    },

    // restart-contact — contact preference (validated only when submitting the main form)
    [`[esupervision][${crn}][${id}][restartCheckin][preferredComs]`]: {
      optional: page !== 'restart-contact' || change !== 'main',
      checks: [{ validator: isNotEmpty, msg: 'Select how the person wants us to send a link to the service' }],
    },
    [`[esupervision][${crn}][${id}][restartCheckin][checkInEmail]`]: {
      optional:
        (page === 'restart-contact' && checkInEmail.trim() !== '') || page !== 'restart-contact' || change !== 'main',
      checks: [
        {
          validator: contactPrefEmailCheck,
          msg: 'Enter an email address',
          crossField: `[esupervision][${crn}][${id}][restartCheckin][preferredComs]`,
        },
      ],
    },
    [`[esupervision][${crn}][${id}][restartCheckin][checkInMobile]`]: {
      optional:
        (page === 'restart-contact' && checkInMobile.trim() !== '') || page !== 'restart-contact' || change !== 'main',
      checks: [
        {
          validator: contactPrefMobileCheck,
          msg: 'Enter a mobile number',
          crossField: `[esupervision][${crn}][${id}][restartCheckin][preferredComs]`,
        },
      ],
    },

    // restart-edit-contact — mobile/email (optional; format-checked only when a value is present)
    [`[esupervision][${crn}][${id}][restartCheckin][editCheckInMobile]`]: {
      optional: (page === 'restart-edit-contact' && !editCheckInMobile) || page !== 'restart-edit-contact',
      checks: [
        { validator: isValidMobileNumber, msg: 'Enter a mobile number in the correct format.' },
        { validator: charsOrLess, length: 35, msg: 'Mobile number must be 35 characters or less.' },
      ],
    },
    [`[esupervision][${crn}][${id}][restartCheckin][editCheckInEmail]`]: {
      optional: (page === 'restart-edit-contact' && !editCheckInEmail) || page !== 'restart-edit-contact',
      checks: [{ validator: isEmail, msg: 'Enter an email address in the correct format.' }],
    },
  }
}
