const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

// Guards object paths built from user input (e.g. request body keys) against prototype pollution
const isSafeKey = (key: unknown): boolean => !UNSAFE_KEYS.has(String(key))

export default isSafeKey
