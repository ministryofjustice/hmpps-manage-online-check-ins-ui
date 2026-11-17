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
    // Repeats isSafeKey inline so CodeQL (js/prototype-polluting-assignment) can see the guard on each assignment
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      return data
    }
    if (!Object.hasOwn(target, key) || !target[key] || typeof target[key] !== 'object') {
      target[key] = {}
    }
    target = target[key]
  }
  const lastKey = path.at(-1)!
  if (lastKey === '__proto__' || lastKey === 'constructor' || lastKey === 'prototype') {
    return data
  }
  target[lastKey] = value
  return data
}

export default setDataValue
