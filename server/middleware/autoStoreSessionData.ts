import { Route } from '../@types/Route.type'
import { Data } from '../data/Data'
import HmppsAuthClient from '../data/hmppsAuthClient'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'

// Values the controllers record themselves (see models/Esupervision). Wizard pages post into the
// same session entry, so without this a crafted post could overwrite them - fabricating how long a
// setup took, or claiming questions were added.
const SERVER_OWNED_KEYS = ['setupStartedAt', 'questionsAdded']

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
              const existing = getDataValue<Record<string, unknown> | undefined>(newSessionData, setPath)
              newValue = { ...(existing ?? {}), ...(newValue as Record<string, unknown>) }
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
