import { Route } from '../../@types'
import { validateWithSpec } from '../../utils/validationUtils'
import { LocalParams } from '../../models/Esupervision'
import { checkInReviewValidation } from '../../properties/validation/checkInReviewValidation'
import { systemIdCheckPass } from '../../controllers/check-ins'

// Maps a check-in page's URL suffix to the validation `page` key it uses. The
// render template is `pages/check-in/${suffix}`. Matching on the exact suffix
// (endsWith) keeps `view` from also matching `view-expired`.
const validationPages = [
  { suffix: 'review/identity', page: 'identity' },
  { suffix: 'review/expired', page: 'expired' },
  { suffix: 'review/notes', page: 'notes' },
  { suffix: 'view', page: 'view' },
  { suffix: 'view-expired', page: 'view-expired' },
]

const checkInReview: Route<void> = (req, res, next) => {
  const { crn, id } = req.params as Record<string, string>
  const { checkIn } = res.locals
  const { back = '' } = req.query as Record<string, string>

  const baseUrl = req.url.split('?')[0]
  const match = validationPages.find(({ suffix }) => baseUrl.endsWith(`/check-in/${suffix}`))
  if (!match) {
    return next()
  }

  const errorMessages = validateWithSpec(req, checkInReviewValidation({ crn, id, page: match.page }))
  if (!Object.keys(errorMessages).length) {
    return next()
  }

  const localParams: LocalParams = { crn, id, back }
  res.locals.errorMessages = errorMessages
  return res.render(`pages/check-in/${match.suffix}`, {
    errorMessages,
    ...localParams,
    checkIn,
    systemIdCheckPass: checkIn ? systemIdCheckPass(checkIn) : false,
  })
}

export default checkInReview
