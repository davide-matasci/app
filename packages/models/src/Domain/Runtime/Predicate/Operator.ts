import { isString } from '@standardnotes/utils'
import { FalseyValue, PredicateOperator, PrimitiveOperand, SureValue } from './Interface'
import { dateFromDSLDateString, replaceDatePlaceholders } from './Utils'

export function valueMatchesTargetValue(
  value: PrimitiveOperand,
  operator: PredicateOperator,
  targetValue: SureValue,
): boolean {
  if (targetValue == undefined) {
    return false
  }

  if (operator === 'matches' && typeof targetValue === 'string') {
    targetValue = replaceDatePlaceholders(targetValue)
  } else if (typeof targetValue === 'string' && targetValue.includes('.ago')) {
    targetValue = dateFromDSLDateString(targetValue)
  }

  /** Before lowercasing: a regex's meaning changes with case (\D is not \d). */
  const originalTargetValue = targetValue

  if (typeof targetValue === 'string') {
    targetValue = targetValue.toLowerCase()
  }

  if (typeof value === 'string') {
    value = value.toLowerCase()
  }

  if (value instanceof Date && typeof targetValue === 'string') {
    targetValue = new Date(targetValue)
  }

  if (operator === 'not') {
    return !valueMatchesTargetValue(value, '=', targetValue)
  }

  const falseyValues = [false, '', null, undefined, NaN]
  if (value == undefined) {
    const isExpectingFalseyValue = falseyValues.includes(targetValue as FalseyValue)
    if (operator === '!=') {
      return !isExpectingFalseyValue
    } else {
      return isExpectingFalseyValue
    }
  }

  if (operator === '=') {
    if (Array.isArray(value)) {
      return JSON.stringify(value) === JSON.stringify(targetValue)
    } else {
      return value === targetValue
    }
  }

  if (operator === '!=') {
    if (Array.isArray(value)) {
      return JSON.stringify(value) !== JSON.stringify(targetValue)
    } else {
      return value !== targetValue
    }
  }

  if (operator === '<') {
    return (value as number) < (targetValue as number)
  }

  if (operator === '>') {
    return (value as number) > (targetValue as number)
  }

  if (operator === '<=') {
    return (value as number) <= (targetValue as number)
  }

  if (operator === '>=') {
    return (value as number) >= (targetValue as number)
  }

  if (operator === 'startsWith') {
    return (value as string).startsWith(targetValue as string)
  }

  if (operator === 'in' && Array.isArray(targetValue)) {
    /** Case-insensitive like the other operators: the value is lowercased, so the list is too. */
    const candidates = (targetValue as SureValue[]).map((candidate) => {
      return typeof candidate === 'string' ? candidate.toLowerCase() : candidate
    })
    return candidates.includes(value as SureValue)
  }

  if (operator === 'includes') {
    if (isString(value)) {
      return value.includes(targetValue as string)
    }

    if (isString(targetValue) && (isString(value) || Array.isArray(value))) {
      return (value as SureValue[]).includes(targetValue)
    }
  }

  if (operator === 'matches') {
    const regex = new RegExp(originalTargetValue as string, 'i')
    return regex.test(value as string)
  }
  return false
}
