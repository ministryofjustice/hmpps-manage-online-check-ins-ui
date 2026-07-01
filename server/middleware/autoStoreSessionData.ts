import { Route } from '../@types/Route.type'
import { Data } from '../data/Data'
import HmppsAuthClient from '../data/hmppsAuthClient'
import getDataValue from '../utils/getDataValue'
import setDataValue from '../utils/setDataValue'

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
            const newValue = body[valueKey]
            const setPath = id ? [key, crn, id, valueKey] : [key, crn, valueKey]

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
