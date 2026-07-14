import { Route } from '../../@types/Route.type'
import { LocalParams } from '../../models/Esupervision'
import { eSuperVisionValidation } from '../../properties/validation/eSupervision'
import getDataValue from '../../utils/getDataValue'
import parseQuestionTemplate from '../../utils/parseQuestionTemplate'
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

  let errorMessages: Record<string, string> = {}

  validateStopCheckins()
  validateEditQuestion()

  if (Object.keys(errorMessages).length) {
    const offenderDetails = res.locals.offenderCheckinsByCRNResponse
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
