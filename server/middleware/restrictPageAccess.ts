import { Route } from '../@types'
import getDataValue from '../utils/getDataValue'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import renderError from './renderError'

// Stops someone deep-linking into the middle of the setup wizard: if the session has no
// answers at all we send them back to the start, and if an answer this page depends on is
// missing we send them to the first page of the flow. Skips when following a
// check-your-answers change link

const restrictPageAccess = ({ requiredValues = [] }: { requiredValues?: (string | string[])[] } = {}): Route<
  Promise<void>
> => {
  return async (req, res, next) => {
    const { crn, id } = req.params as Record<string, string>
    if (!isValidCrn(crn) || !isValidUUID(id)) {
      return renderError(404)(req, res)
    }

    const dataPath = ['esupervision', crn, id, 'checkins']
    const { data } = req.session

    if (getDataValue(data, dataPath) === undefined) {
      return res.redirect(`/case/${crn}/appointments/check-in/eligibility-check`)
    }

    if (!req.query?.cya) {
      for (const requiredValue of requiredValues) {
        const path = Array.isArray(requiredValue) ? requiredValue : [requiredValue]
        if (!getDataValue(data, [...dataPath, ...path])) {
          return res.redirect(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
        }
      }
    }
    return next()
  }
}

export default restrictPageAccess
