import getKeypath from 'lodash/get'
import isSafeKey from './isSafeKey'

const getDataValue = <T = any>(data: any, sections: any): T => {
  const path = Array.isArray(sections) ? sections : [sections]
  if (!path.every(isSafeKey)) {
    return undefined
  }
  return getKeypath(data, path.map((s: any) => `["${s}"]`).join(''))
}
export default getDataValue
