import { Route } from '../@types/Route.type'
import { Data } from '../data/Data'
import HmppsAuthClient from '../data/hmppsAuthClient'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'

// Values the controllers record themselves (see models/Esupervision). Wizard pages post into the
// same session entry, so without this a crafted post could overwrite them - fabricating how long a
// setup took, or claiming questions were added.
const SERVER_OWNED_KEYS = ['setupStartedAt', 'questionsAdded', 'supervisionPackageStatus']

// Derived by the eligibility rules inside a wizard group (`checkins`, `restartCheckin`); trusting a
// posted value would let a crafted post skip the accredited-programme approval and rationale.
const SERVER_OWNED_GROUP_KEYS = [
  'events',
  'currentEvent',
  'accreditedProgramme',
  'tierBand',
  'notEligibleReason',
  'notEligibleReasonBullets',
  'additionalTierInformation',
]

const autoStoreSessionData = (_hmppsAuthClient: HmppsAuthClient): Route<Promise<void>> => {
  return async (req, _res, next) => {
    const newSessionData: Data = req.session.data ?? {}

    const { crn, id } = req.params as Record<string, string>
    const inputs: Record<string, unknown> = req.body ?? {}

    Object.entries(inputs).forEach(([key]) => {
      if (!key.startsWith('_')) {
        const getPath = id ? [key, crn, id] : [key, crn]
        const body = getDataValue<Record<string, unknown> | undefined>(inputs, getPath)

        if (body) {
          Object.keys(body).forEach(valueKey => {
            if (SERVER_OWNED_KEYS.includes(valueKey)) {
              return
            }

            let newValue = body[valueKey]
            const setPath = id ? [key, crn, id, valueKey] : [key, crn, valueKey]

            // Each page of a wizard posts only its own fields within a shared group (e.g.
            // `checkins`). Merge rather than assign, so answers from earlier pages survive.
            if (newValue && typeof newValue === 'object' && !Array.isArray(newValue)) {
              const posted = Object.fromEntries(
                Object.entries(newValue as Record<string, unknown>).filter(
                  ([field]) => !SERVER_OWNED_GROUP_KEYS.includes(field),
                ),
              )
              const existing = getDataValue<Record<string, unknown> | undefined>(newSessionData, setPath)
              newValue = { ...(existing ?? {}), ...posted }
            }

            setDataValue(newSessionData, setPath, newValue)
          })
        }
      }
    })

    req.session.data = newSessionData

    return next()
  }
}
export default autoStoreSessionData
