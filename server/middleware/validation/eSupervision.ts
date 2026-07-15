import { Route } from '../../@types/Route.type'
import { LocalParams } from '../../models/Esupervision'
import { eSuperVisionValidation } from '../../properties/validation/eSupervision'
import { validateWithSpec } from '../../utils/validationUtils'
import getDataValue from '../../utils/getDataValue'

const eSuperVision: Route<void> = (req, res, next) => {
  const { url, params, body } = req
  const { crn, id } = params as Record<string, string>

  const { back = '', cya = '' } = req.query as Record<string, string>
  const localParams: LocalParams = {
    crn,
    id,
    body,
    back,
    cya,
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
  const sessionVal = (group: string, field: string): string =>
    getDataValue(req.session.data, ['esupervision', crn, id, group, field]) || ''

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

  validateStopCheckins()
  validateCheckinSettings()
  validateManageContact()
  validateManageEditContact()
  validateRestartCheckin()
  validateRestartContact()
  validateRestartEditContact()

  if (Object.keys(errorMessages).length) {
    const offenderDetails = res.locals.offenderByCRNResponse
    res.locals.errorMessages = errorMessages
    return res.render(render, {
      errorMessages,
      ...localParams,
      case: offenderDetails?.details,
    })
  }
  return next()
}

export default eSuperVision
