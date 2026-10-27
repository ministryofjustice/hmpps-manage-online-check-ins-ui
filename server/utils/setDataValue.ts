import isSafeKey from './isSafeKey'

const setDataValue = <TData extends Record<string, any>, TValue = any>(
  data: TData,
  sections: string | string[],
  value: TValue,
): TData => {
  const path = Array.isArray(sections) ? sections : [sections]
  if (!path.every(isSafeKey)) {
    return data
  }
  let target: Record<string, any> = data
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]
    if (!Object.hasOwn(target, key) || !target[key] || typeof target[key] !== 'object') {
      target[key] = {}
    }
    target = target[key]
  }
  target[path.at(-1)!] = value
  return data
}

export default setDataValue
