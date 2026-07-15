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
    // Setup flow — eligibility through to the photo
    [`[esupervision][${crn}][${id}][checkins][eligibility]`]: {
      optional: page !== 'eligibility-check',
      checks: [
        {
          validator: isNotEmpty,
          msg: 'Select if any of these apply to the person',
          log: 'Eligibility criteria not selected',
        },
      ],
    },
    [`[esupervision][${crn}][${id}][checkins][eligibilityChoice]`]: {
      optional: page !== 'full-eligibility',
      checks: [{ validator: isNotEmpty, msg: 'Select how you will use online check ins' }],
    },
    [`[esupervision][${crn}][${id}][checkins][eligibilitySPOApproval]`]: {
      optional: page !== 'spo-approval',
      checks: [{ validator: isNotEmpty, msg: 'Select to confirm SPO approval', log: 'SPO approval not confirmed' }],
    },
    [`[esupervision][${crn}][${id}][checkins][rationale]`]: {
      optional: page !== 'rationale',
      checks: [{ validator: isNotEmpty, msg: 'Enter why the person is suitable to use online check ins' }],
    },
    [`[esupervision][${crn}][${id}][checkins][date]`]: {
      optional: page !== 'date-frequency',
      checks: [
        { validator: isNotEmpty, msg: 'Enter the date you would like the person to complete their first check in' },
        { validator: isValidDateFormat, msg: 'Enter a date in the correct format, for example 17/5/2024' },
        { validator: isValidDate, msg: 'Enter a date in the correct format, for example 17/5/2024' },
        { validator: isTodayOrLater, msg: 'The first online check in date must be today or in the future' },
      ],
    },
    [`[esupervision][${crn}][${id}][checkins][interval]`]: {
      optional: page !== 'date-frequency',
      checks: [{ validator: isNotEmpty, msg: 'Select how often you would like the person to check in' }],
    },

    // contact-preference — only validated when submitting the main form, not the change buttons
    [`[esupervision][${crn}][${id}][checkins][preferredComs]`]: {
      optional: page !== 'contact-preference' || change !== 'main',
      checks: [{ validator: isNotEmpty, msg: 'Select how the person wants us to send a link to the service' }],
    },
    [`[esupervision][${crn}][${id}][checkins][checkInEmail]`]: {
      optional: (page === 'contact-preference' && checkInEmail.trim() !== '') || page !== 'contact-preference',
      checks: [
        {
          validator: contactPrefEmailCheck,
          msg: 'Enter an email address',
          crossField: `[esupervision][${crn}][${id}][checkins][preferredComs]`,
        },
      ],
    },
    [`[esupervision][${crn}][${id}][checkins][checkInMobile]`]: {
      optional: (page === 'contact-preference' && checkInMobile.trim() !== '') || page !== 'contact-preference',
      checks: [
        {
          validator: contactPrefMobileCheck,
          msg: 'Enter a mobile number',
          crossField: `[esupervision][${crn}][${id}][checkins][preferredComs]`,
        },
      ],
    },

    // edit-contact-preference — both optional; format-checked only when a value is present
    [`[esupervision][${crn}][${id}][checkins][editCheckInMobile]`]: {
      optional: (page === 'edit-contact-preference' && !editCheckInMobile) || page !== 'edit-contact-preference',
      checks: [
        { validator: isValidMobileNumber, msg: 'Enter a mobile number in the correct format.' },
        { validator: charsOrLess, length: 35, msg: 'Mobile number must be 35 characters or less.' },
      ],
    },
    [`[esupervision][${crn}][${id}][checkins][editCheckInEmail]`]: {
      optional: (page === 'edit-contact-preference' && !editCheckInEmail) || page !== 'edit-contact-preference',
      checks: [
        { validator: isEmail, msg: 'Enter an email address in the correct format.' },
        { validator: charsOrLess, length: 254, msg: 'Email address must be 254 characters or less.' },
      ],
    },

    [`[esupervision][${crn}][${id}][checkins][photoUploadOption]`]: {
      optional: page !== 'photo-options',
      checks: [{ validator: isNotEmpty, msg: 'Select an option to continue', log: 'Photo option, not selected' }],
    },
    // Not namespaced: the file input posts as a plain `photoUpload` field.
    photoUpload: {
      optional: page !== 'upload-a-photo',
      checks: [{ validator: isNotEmpty, msg: 'Select a photo of the person', log: 'Photo not selected.' }],
    },

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
