/* eslint-disable no-param-reassign */
import { Request } from 'express'
import getDataValue from './getDataValue'
import config from '../config'
import { AppResponse } from '../models/Locals'

interface Item {
  checked?: string
  selected?: string
  value: string
  text?: string
  idPrefix?: string
}

const decorateFormAttributes = (req: Request, res: AppResponse) => (obj: any, sections?: string[]) => {
  const newObj = obj
  const { data } = req.session as any
  const fieldId = sections?.join('-')
  const hasError = Boolean(fieldId && res?.locals?.errorMessages?.[fieldId])
  const submittedValue = getDataValue(req.body, sections)
  // A field being re-rendered with a validation error shows what was just submitted - even an
  // empty value - rather than a previously saved answer, which the person may not notice and
  // would otherwise re-submit by accident. Validation may run before the submission is stored, so
  // the session cannot be relied on to hold it.
  let storedValue =
    hasError && submittedValue !== undefined ? submittedValue : getDataValue(data, sections) || submittedValue
  // Saved dates are ISO (yyyy-mm-dd); the form wants d/M/yyyy. Anything else, such as rejected
  // free text, is shown as it was submitted.
  const isIsoDate = typeof storedValue === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(storedValue)
  if (isIsoDate && config.dateFields.includes(sections![sections!.length - 1])) {
    const [year, month, day] = storedValue
      .split('-')
      .map((value: string) => (value.startsWith('0') ? value.substring(1) : value))
    storedValue = [day, month, year].join('/')
  }
  if (newObj.items !== undefined) {
    newObj.items = newObj.items.map((item: Item) => {
      if (typeof item.value === 'undefined') {
        item.value = item.text!
      }
      if (storedValue) {
        if (
          (Array.isArray(storedValue) && storedValue.includes(item?.value?.toString())) ||
          storedValue === item?.value?.toString()
        ) {
          if (storedValue.indexOf(item.value) !== -1) {
            item.checked = 'checked'
            item.selected = 'selected'
          }
        }
      }
      return item
    })
    if (sections?.length) {
      newObj.idPrefix = sections.join('-')
    }
  } else {
    newObj.value = storedValue
  }
  if (sections?.length) {
    const id = sections.join('-')
    if (typeof newObj.id === 'undefined') {
      newObj.id = id
    }
    newObj.name = sections.map((s: string) => `[${s}]`).join('')
    if (res?.locals?.errorMessages?.[id]) {
      newObj.errorMessage = { text: res.locals.errorMessages[id] }
    }
  }

  return newObj
}
export default decorateFormAttributes
