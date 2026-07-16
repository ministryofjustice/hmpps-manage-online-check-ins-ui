import { Route } from '../../@types/Route.type'
import { LocalParams } from '../../models/Esupervision'
import { eSuperVisionValidation } from '../../properties/validation/eSupervision'
import getDataValue from '../../utils/getDataValue'
import parseQuestionTemplate from '../../utils/parseQuestionTemplate'
import { validateWithSpec } from '../../utils/validationUtils'
import config from '../../config'

const eSuperVision: Route<void> = (req, res, next) => {
  const { url, params, body } = req
  const { crn, id } = params as Record<string, string>

  const { back = '', cya = '' } = req.query as Record<string, string>
  // The setup pages carry these on hidden inputs so that re-rendering with errors preserves
  // them; without them the contact details would blank out and post back empty. The manage
  // validators below read their equivalents from session instead and overwrite these.
  const {
    checkInMinDate,
    checkInMobile: bodyCheckInMobile,
    checkInEmail: bodyCheckInEmail,
  } = body as Record<string, string>
  const localParams: LocalParams = {
    crn,
    id,
    body,
    back,
    cya,
    checkInMinDate,
    checkInMobile: bodyCheckInMobile,
    checkInEmail: bodyCheckInEmail,
  }
  const baseUrl = req.url.split('?')[0]
  let render = `pages/${[
    url
      .split('?')[0]
      .split('/')
      .filter(item => item)
      .filter((_item, i) => ![0, 1, 3].includes(i))
      .join('/'),
  ]}`

  let errorMessages: Record<string, string> = {}

  const manage = (segment: string) => `case/${crn}/appointments/check-in/manage/${id}/${segment}`
  const setup = (segment: string) => `/case/${crn}/appointments/${id}/check-in/${segment}`
  const sessionVal = (group: string, field: string): string =>
    getDataValue(req.session.data, ['esupervision', crn, id, group, field]) || ''

  // Setup flow. The contact fields are posted as hidden inputs, so they are read from the
  // body; the edit page's values were saved to session when contact-preference rendered.
  const validateSetupPage = (segment: string, view: string, page: string) => {
    if (!baseUrl.includes(setup(segment))) {
      return
    }
    render = `pages/check-in/${view}`
    errorMessages = validateWithSpec(
      req,
      eSuperVisionValidation({
        crn,
        id,
        page,
        checkInEmail: bodyCheckInEmail ?? '',
        checkInMobile: bodyCheckInMobile ?? '',
        editCheckInEmail: sessionVal('checkins', 'editCheckInEmail'),
        editCheckInMobile: sessionVal('checkins', 'editCheckInMobile'),
        change: body?.change as string,
      }),
    )
  }

  const validateSetupFlow = () => {
    validateSetupPage('eligibility-check', 'eligibility-check', 'eligibility-check')
    validateSetupPage('full-eligibility', 'eligibility-full', 'full-eligibility')
    validateSetupPage('spo-approval', 'spo-approval', 'spo-approval')
    validateSetupPage('rationale', 'rationale', 'rationale')
    validateSetupPage('date-frequency', 'date-frequency', 'date-frequency')
    validateSetupPage('photo-options', 'photo-options', 'photo-options')
    validateSetupPage('upload-a-photo', 'upload-a-photo', 'upload-a-photo')

    // The change buttons on contact-preference deliberately skip validation so the user can
    // go and fix their details; only the main Continue submit is checked.
    if (body?.change === 'main') {
      validateSetupPage('contact-preference', 'contact-preference', 'contact-preference')
    }

    if (baseUrl.includes(setup('edit-contact-preference'))) {
      validateSetupPage('edit-contact-preference', 'edit-contact-preference', 'edit-contact-preference')
      localParams.change = body?.change as string
    }
  }

  const validateStopCheckins = () => {
    if (baseUrl.includes(manage('stop-checkin'))) {
      render = `pages/check-in/manage/stop-checkin`
      localParams.id = id
      errorMessages = validateWithSpec(req, eSuperVisionValidation({ crn, id, page: 'stop-checkin' }))
    }
  }

  const validateCheckinSettings = () => {
    if (baseUrl.includes(manage('settings'))) {
      render = `pages/check-in/manage/checkin-settings`
      localParams.id = id
      errorMessages = validateWithSpec(req, eSuperVisionValidation({ crn, id, page: 'checkin-settings' }))
    }
  }

  const validateManageContact = () => {
    if (baseUrl.includes(manage('contact'))) {
      render = `pages/check-in/manage/manage-contact`
      if (body?.change === 'main') {
        const checkInEmail = sessionVal('manageCheckin', 'checkInEmail')
        const checkInMobile = sessionVal('manageCheckin', 'checkInMobile')
        localParams.checkInEmail = checkInEmail
        localParams.checkInMobile = checkInMobile
        errorMessages = validateWithSpec(
          req,
          eSuperVisionValidation({ crn, id, checkInEmail, checkInMobile, page: 'manage-contact', change: 'main' }),
        )
      }
    }
  }

  const validateManageEditContact = () => {
    if (baseUrl.includes(manage('edit-contact'))) {
      render = `pages/check-in/manage/manage-edit-contact`
      localParams.change = body?.change as string
      const editCheckInEmail = sessionVal('manageCheckin', 'editCheckInEmail')
      const editCheckInMobile = sessionVal('manageCheckin', 'editCheckInMobile')
      errorMessages = validateWithSpec(
        req,
        eSuperVisionValidation({ crn, id, editCheckInEmail, editCheckInMobile, page: 'edit-contact' }),
      )
    }
  }

  const validateRestartCheckin = () => {
    if (baseUrl.includes(manage('restart-checkin'))) {
      render = `pages/check-in/manage/restart-date-frequency`
      localParams.id = id
      errorMessages = validateWithSpec(req, eSuperVisionValidation({ crn, id, page: 'restart-date-frequency' }))
    }
  }

  const validateEditQuestion = () => {
    const questionMatch = baseUrl.match(/\/questions\/([\w-]+)\/edit/)

    if (questionMatch) {
      const draftId = questionMatch[1]
      const templateId = draftId.split('-')[0]
      render = `pages/check-in/questions/edit-question`

      localParams.questionId = draftId

      const availableTemplates =
        getDataValue(req.session.data, ['esupervision', crn, id, 'manageQuestions', 'availableTemplates']) || []
      const questionData = parseQuestionTemplate(availableTemplates, templateId)
      if (questionData) {
        localParams.question = questionData
      }
      errorMessages = validateWithSpec(
        req,
        eSuperVisionValidation({
          crn,
          id,
          page: 'edit-question',
        }),
      )
    }
  }

  const validateRestartContact = () => {
    if (baseUrl.includes(manage('restart-contact'))) {
      render = `pages/check-in/manage/restart-contact-preference`
      if (body?.change === 'main') {
        const checkInEmail = sessionVal('restartCheckin', 'checkInEmail')
        const checkInMobile = sessionVal('restartCheckin', 'checkInMobile')
        localParams.checkInEmail = checkInEmail
        localParams.checkInMobile = checkInMobile
        errorMessages = validateWithSpec(
          req,
          eSuperVisionValidation({ crn, id, checkInEmail, checkInMobile, page: 'restart-contact', change: 'main' }),
        )
      }
    }
  }

  const validateRestartEditContact = () => {
    if (baseUrl.includes(manage('restart-edit-contact'))) {
      render = `pages/check-in/manage/restart-edit-contact`
      localParams.change = body?.change as string
      const editCheckInEmail = sessionVal('restartCheckin', 'editCheckInEmail')
      const editCheckInMobile = sessionVal('restartCheckin', 'editCheckInMobile')
      errorMessages = validateWithSpec(
        req,
        eSuperVisionValidation({ crn, id, editCheckInEmail, editCheckInMobile, page: 'restart-edit-contact' }),
      )
    }
  }

  validateSetupFlow()
  validateStopCheckins()
  validateCheckinSettings()
  validateManageContact()
  validateManageEditContact()
  validateRestartCheckin()
  validateRestartContact()
  validateRestartEditContact()
  validateEditQuestion()

  if (Object.keys(errorMessages).length) {
    const offenderDetails = res.locals.offenderCheckinsByCRNResponse
    res.locals.errorMessages = errorMessages
    return res.render(render, {
      errorMessages,
      ...localParams,
      // Setup pages have no offender record yet and get their person from res.locals.case,
      // which render options would otherwise shadow with undefined.
      case: offenderDetails?.details ?? res.locals.case,
      guidanceUrl: config.guidance.link,
      data: req.session.data,
    })
  }
  return next()
}

export default eSuperVision
