import { Route } from '../../@types/Route.type'
import { LocalParams } from '../../models/Esupervision'
import { eSuperVisionValidation } from '../../properties/validation/eSupervision'
import { validateWithSpec } from '../../utils/validationUtils'

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

  const validateStopCheckins = () => {
    if (baseUrl.includes(`case/${crn}/appointments/check-in/manage/${id}/stop-checkin`)) {
      render = `pages/check-in/manage/stop-checkin`
      localParams.id = id
      errorMessages = validateWithSpec(
        req,
        eSuperVisionValidation({
          crn,
          id,
          page: 'stop-checkin',
        }),
      )
    }
  }

  let errorMessages: Record<string, string> = {}

  validateStopCheckins()

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
