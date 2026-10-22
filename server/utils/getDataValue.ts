import getKeypath from 'lodash/get'
import isSafeKey from './isSafeKey'

const getDataValue = <T = any>(data: any, sections: any): T => {
  const path = Array.isArray(sections) ? sections : [sections]
  if (!path.every(isSafeKey)) {
    return undefined
  }
  // An array path is taken literally by lodash, so keys can't smuggle extra segments (e.g. `a"]["__proto__`)
  return getKeypath(data, path)
}
export default getDataValue
