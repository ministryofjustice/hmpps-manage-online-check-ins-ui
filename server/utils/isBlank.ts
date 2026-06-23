const isBlank = (str: string): boolean => !str || /^\s*$/.test(str)
export default isBlank
