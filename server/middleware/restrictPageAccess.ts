import { Route } from '../@types'
import getDataValue from '../utils/getDataValue'
import isValidCrn from '../utils/isValidCrn'
import isValidUUID from '../utils/isValidUUID'
import renderError from './renderError'

type Answers = Record<string, unknown>
type ValuePath = string | string[]
// A requirement may depend on earlier answers: the function gets the setup answers so far and
// returns the path that must be present, or nothing when this page needs no extra answer.
export type RequiredValue = ValuePath | ((answers: Answers) => ValuePath | undefined)

// An ad-hoc setup schedules no first check in, so only a standard interval needs a date.
export const dateUnlessAdHoc: RequiredValue = answers => (answers?.interval === 'AD_HOC' ? undefined : 'date')

// Stops someone deep-linking into the middle of the setup wizard: if the session has no
// answers at all we send them back to the start, and if an answer this page depends on is
// missing we send them to the first page of the flow. Skips when following a
// check-your-answers change link

const restrictPageAccess = ({ requiredValues = [] }: { requiredValues?: RequiredValue[] } = {}): Route<
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
      return res.redirect(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
    }

    if (!req.query?.cya) {
      const answers: Answers = getDataValue(data, dataPath)
      for (const requiredValue of requiredValues) {
        const resolved = typeof requiredValue === 'function' ? requiredValue(answers) : requiredValue
        if (resolved === undefined) continue // eslint-disable-line no-continue
        const path = Array.isArray(resolved) ? resolved : [resolved]
        if (!getDataValue(data, [...dataPath, ...path])) {
          return res.redirect(`/case/${crn}/appointments/${id}/check-in/eligibility-check`)
        }
      }
    }
    return next()
  }
}

export default restrictPageAccess
