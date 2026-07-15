import { Route } from '../@types'

const postRedirectWizard = (): Route<Promise<void>> => {
  return async (req, res, next) => {
    const { crn, id } = req.params as Record<string, string>
    const skipContactPrefTypes = ['mobile', 'emailAddress']
    if (req.query.cya === 'true') {
      if (skipContactPrefTypes.includes(req.body.change)) {
        return next()
      }
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/checkin-summary`)
    }
    return next()
  }
}

export default postRedirectWizard
