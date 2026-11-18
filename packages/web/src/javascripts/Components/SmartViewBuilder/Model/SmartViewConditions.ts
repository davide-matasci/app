import { PredicateJsonForm, PredicateOperator } from '@standardnotes/snjs'
import { c } from 'ttag'
import { PredicateKeypath, PredicateKeypathTypes, getPredicateKeypathLabels } from '../PredicateKeypaths'

/**
 * An editable form of a smart view's predicate: nested groups of conditions. It converts
 * to and from the stored predicate JSON (which is unchanged, so views keep working in
 * every app). Anything the builder can't represent is kept verbatim as a read-only
 * "custom" node, never shown as JSON.
 */

export const MaxGroupDepth = 3

export type GroupMatch = 'all' | 'any'

export type FieldType = (typeof PredicateKeypathTypes)[PredicateKeypath]

export type DateUnit = 'hours' | 'days' | 'months' | 'years'
export const DateUnits: DateUnit[] = ['hours', 'days', 'months', 'years']

export type TagReference = { uuid: string } | { title: string }

export type ConditionValue =
  | { kind: 'text'; text: string }
  | { kind: 'number'; number: number }
  | { kind: 'boolean'; boolean: boolean }
  | { kind: 'relativeDate'; amount: number; unit: DateUnit }
  | { kind: 'choice'; choice: string }
  | { kind: 'tag'; tag: TagReference }

export type Condition = {
  type: 'condition'
  field: PredicateKeypath
  operatorId: OperatorId
  value: ConditionValue
}

export type CustomCondition = {
  type: 'custom'
  /** Kept as stored; saved back unchanged. */
  predicate: PredicateJsonForm
}

export type ConditionGroup = {
  type: 'group'
  match: GroupMatch
  children: ConditionNode[]
}

export type ConditionNode = Condition | CustomCondition | ConditionGroup

export type OperatorId =
  | 'is'
  | 'isNot'
  | 'contains'
  | 'doesNotContain'
  | 'startsWith'
  | 'matchesPattern'
  | 'equals'
  | 'notEquals'
  | 'lessThan'
  | 'greaterThan'
  | 'atMost'
  | 'atLeast'
  | 'withinLast'
  | 'notWithinLast'
  | 'hasTag'
  | 'doesNotHaveTag'

type OperatorDefinition = {
  id: OperatorId
  /** The stored operator; `negated` wraps the condition in a `not`. */
  operator: PredicateOperator
  negated: boolean
  label: () => string
}

const op = (
  id: OperatorId,
  operator: PredicateOperator,
  negated: boolean,
  label: () => string,
): OperatorDefinition => ({
  id,
  operator,
  negated,
  label,
})

/** The operators offered for each field type, in display order. */
export const OperatorsForFieldType: Record<FieldType, OperatorDefinition[]> = {
  string: [
    op('is', '=', false, () => c('Smart view operator').t`is`),
    op('isNot', '!=', false, () => c('Smart view operator').t`is not`),
    op('contains', 'includes', false, () => c('Smart view operator').t`contains`),
    op('doesNotContain', 'includes', true, () => c('Smart view operator').t`does not contain`),
    op('startsWith', 'startsWith', false, () => c('Smart view operator').t`starts with`),
    op('matchesPattern', 'matches', false, () => c('Smart view operator').t`matches pattern`),
  ],
  number: [
    op('equals', '=', false, () => c('Smart view operator').t`is`),
    op('notEquals', '!=', false, () => c('Smart view operator').t`is not`),
    op('lessThan', '<', false, () => c('Smart view operator').t`is less than`),
    op('greaterThan', '>', false, () => c('Smart view operator').t`is more than`),
    op('atMost', '<=', false, () => c('Smart view operator').t`is at most`),
    op('atLeast', '>=', false, () => c('Smart view operator').t`is at least`),
  ],
  boolean: [op('is', '=', false, () => c('Smart view operator').t`is`)],
  date: [
    op('withinLast', '>', false, () => c('Smart view operator').t`is in the last`),
    op('notWithinLast', '<', false, () => c('Smart view operator').t`is not in the last`),
  ],
  noteType: [
    op('is', '=', false, () => c('Smart view operator').t`is`),
    op('isNot', '!=', false, () => c('Smart view operator').t`is not`),
  ],
  editorIdentifier: [
    op('is', '=', false, () => c('Smart view operator').t`is`),
    op('isNot', '!=', false, () => c('Smart view operator').t`is not`),
  ],
  tag: [
    op('hasTag', 'includes', false, () => c('Smart view operator').t`has tag`),
    op('doesNotHaveTag', 'includes', true, () => c('Smart view operator').t`does not have tag`),
  ],
}

export function operatorDefinition(field: PredicateKeypath, operatorId: OperatorId): OperatorDefinition | undefined {
  return OperatorsForFieldType[PredicateKeypathTypes[field]].find((definition) => definition.id === operatorId)
}

export function defaultValueForField(field: PredicateKeypath): ConditionValue {
  switch (PredicateKeypathTypes[field]) {
    case 'string':
      return { kind: 'text', text: '' }
    case 'number':
      return { kind: 'number', number: 0 }
    case 'boolean':
      return { kind: 'boolean', boolean: true }
    case 'date':
      return { kind: 'relativeDate', amount: 7, unit: 'days' }
    case 'noteType':
    case 'editorIdentifier':
      return { kind: 'choice', choice: '' }
    case 'tag':
      return { kind: 'tag', tag: { title: '' } }
  }
}

export function newCondition(field: PredicateKeypath = 'title'): Condition {
  return {
    type: 'condition',
    field,
    operatorId: OperatorsForFieldType[PredicateKeypathTypes[field]][0].id,
    value: defaultValueForField(field),
  }
}

export function newGroup(match: GroupMatch = 'all'): ConditionGroup {
  return { type: 'group', match, children: [newCondition()] }
}

/* ------------------------------------------------------------------ */
/* Tree -> stored predicate                                             */
/* ------------------------------------------------------------------ */

export function conditionTreeToPredicate(group: ConditionGroup): PredicateJsonForm {
  return groupToPredicate(group)
}

function groupToPredicate(group: ConditionGroup): PredicateJsonForm {
  return {
    operator: group.match === 'all' ? 'and' : 'or',
    value: group.children.map(nodeToPredicate),
  }
}

function nodeToPredicate(node: ConditionNode): PredicateJsonForm {
  switch (node.type) {
    case 'group':
      return groupToPredicate(node)
    case 'custom':
      return node.predicate
    case 'condition':
      return conditionToPredicate(node)
  }
}

function conditionToPredicate(condition: Condition): PredicateJsonForm {
  const definition = operatorDefinition(condition.field, condition.operatorId)
  if (!definition) {
    throw new Error(`Operator ${condition.operatorId} is not valid for ${condition.field}`)
  }

  const predicate: PredicateJsonForm =
    condition.value.kind === 'tag'
      ? { keypath: 'tags', operator: 'includes', value: tagReferenceToPredicate(condition.value.tag) }
      : { keypath: condition.field, operator: definition.operator, value: valueToStored(condition.value) }

  return definition.negated ? { operator: 'not', value: predicate } : predicate
}

function tagReferenceToPredicate(tag: TagReference): PredicateJsonForm {
  return 'uuid' in tag
    ? { keypath: 'uuid', operator: '=', value: tag.uuid }
    : { keypath: 'title', operator: '=', value: tag.title }
}

function valueToStored(value: ConditionValue): PredicateJsonForm['value'] {
  switch (value.kind) {
    case 'text':
      return value.text
    case 'number':
      return value.number
    case 'boolean':
      return value.boolean
    case 'relativeDate':
      return `${value.amount}.${value.unit}.ago`
    case 'choice':
      return value.choice
    case 'tag':
      throw new Error('Tag values are stored as a nested predicate')
  }
}

/* ------------------------------------------------------------------ */
/* Stored predicate -> tree                                             */
/* ------------------------------------------------------------------ */

/** Always returns a group at the root; a bare condition becomes a one-condition "all" group. */
export function predicateToConditionTree(predicate: PredicateJsonForm): ConditionGroup {
  const node = predicateToNode(predicate)
  return node.type === 'group' ? node : { type: 'group', match: 'all', children: [node] }
}

function predicateToNode(predicate: PredicateJsonForm): ConditionNode {
  if ((predicate.operator === 'and' || predicate.operator === 'or') && Array.isArray(predicate.value)) {
    const children = predicate.value as unknown[]
    if (children.every(isPredicateObject)) {
      return {
        type: 'group',
        match: predicate.operator === 'and' ? 'all' : 'any',
        children: (children as PredicateJsonForm[]).map(predicateToNode),
      }
    }
  }

  return predicateToCondition(predicate) ?? { type: 'custom', predicate }
}

function isPredicateObject(value: unknown): value is PredicateJsonForm {
  return typeof value === 'object' && value !== null && !Array.isArray(value) && 'operator' in value
}

function predicateToCondition(predicate: PredicateJsonForm): Condition | undefined {
  let negated = false
  let inner = predicate
  if (predicate.operator === 'not') {
    if (!isPredicateObject(predicate.value)) {
      return undefined
    }
    negated = true
    inner = predicate.value
  }

  const field = inner.keypath as PredicateKeypath | undefined
  if (!field || !(field in PredicateKeypathTypes)) {
    return undefined
  }
  const fieldType = PredicateKeypathTypes[field]

  const definition = OperatorsForFieldType[fieldType].find(
    (candidate) => candidate.operator === inner.operator && candidate.negated === negated,
  )
  if (!definition) {
    return undefined
  }

  const value = storedToValue(fieldType, inner.value)
  if (!value) {
    return undefined
  }

  return { type: 'condition', field, operatorId: definition.id, value }
}

function storedToValue(fieldType: FieldType, stored: PredicateJsonForm['value']): ConditionValue | undefined {
  switch (fieldType) {
    case 'string':
      return typeof stored === 'string' ? { kind: 'text', text: stored } : undefined
    case 'number':
      return typeof stored === 'number' ? { kind: 'number', number: stored } : undefined
    case 'boolean':
      return typeof stored === 'boolean' ? { kind: 'boolean', boolean: stored } : undefined
    case 'date':
      return typeof stored === 'string' ? parseRelativeDate(stored) : undefined
    case 'noteType':
    case 'editorIdentifier':
      return typeof stored === 'string' ? { kind: 'choice', choice: stored } : undefined
    case 'tag':
      return isPredicateObject(stored) ? parseTagReference(stored) : undefined
  }
}

function parseRelativeDate(stored: string): ConditionValue | undefined {
  const match = /^(\d+)\.(hours|days|months|years)\.ago$/.exec(stored)
  return match ? { kind: 'relativeDate', amount: parseInt(match[1], 10), unit: match[2] as DateUnit } : undefined
}

function parseTagReference(stored: PredicateJsonForm): ConditionValue | undefined {
  if (stored.operator !== '=' || typeof stored.value !== 'string') {
    return undefined
  }
  if (stored.keypath === 'uuid') {
    return { kind: 'tag', tag: { uuid: stored.value } }
  }
  if (stored.keypath === 'title') {
    return { kind: 'tag', tag: { title: stored.value } }
  }
  return undefined
}

/* ------------------------------------------------------------------ */
/* Plain-language summary                                               */
/* ------------------------------------------------------------------ */

export type DescribeContext = {
  /** Current title of a tag (by uuid), so a renamed tag reads correctly. */
  tagTitle: (uuid: string) => string | undefined
  /** Display name of an editor or note type identifier. */
  choiceLabel: (field: PredicateKeypath, choice: string) => string
}

export function describeConditionTree(group: ConditionGroup, context: DescribeContext): string {
  return describeGroup(group, context, true)
}

function describeGroup(group: ConditionGroup, context: DescribeContext, isRoot: boolean): string {
  const parts = group.children.map((child) => describeNode(child, context))
  const joined = parts.join(group.match === 'all' ? c('Smart view summary').t` and ` : c('Smart view summary').t` or `)
  return isRoot || parts.length < 2 ? joined : `(${joined})`
}

function describeNode(node: ConditionNode, context: DescribeContext): string {
  switch (node.type) {
    case 'group':
      return describeGroup(node, context, false)
    case 'custom':
      return c('Smart view summary').t`a custom condition`
    case 'condition':
      return describeCondition(node, context)
  }
}

export function describeCondition(condition: Condition, context: DescribeContext): string {
  const fieldLabel = getPredicateKeypathLabels()[condition.field]
  const operatorLabel = operatorDefinition(condition.field, condition.operatorId)?.label() ?? ''
  const value = condition.value

  switch (value.kind) {
    case 'boolean':
      return value.boolean ? fieldLabel : c('Smart view summary').t`not ${fieldLabel}`
    case 'tag': {
      const title = 'uuid' in value.tag ? context.tagTitle(value.tag.uuid) : value.tag.title
      const tagName = title || c('Smart view summary').t`a deleted tag`
      return `${operatorLabel} "${tagName}"`
    }
    case 'relativeDate':
      return `${fieldLabel} ${operatorLabel} ${value.amount} ${unitLabel(value.unit, value.amount)}`
    case 'choice':
      return `${fieldLabel} ${operatorLabel} ${context.choiceLabel(condition.field, value.choice)}`
    case 'number':
      return `${fieldLabel} ${operatorLabel} ${value.number}`
    case 'text':
      return `${fieldLabel} ${operatorLabel} "${value.text}"`
  }
}

export function unitLabel(unit: DateUnit, amount: number): string {
  const singular = amount === 1
  switch (unit) {
    case 'hours':
      return singular ? c('Smart view unit').t`hour` : c('Smart view unit').t`hours`
    case 'days':
      return singular ? c('Smart view unit').t`day` : c('Smart view unit').t`days`
    case 'months':
      return singular ? c('Smart view unit').t`month` : c('Smart view unit').t`months`
    case 'years':
      return singular ? c('Smart view unit').t`year` : c('Smart view unit').t`years`
  }
}

/** Deepest group nesting in a tree (the root counts as 1). */
export function groupDepth(group: ConditionGroup): number {
  const childDepths = group.children.map((child) => (child.type === 'group' ? groupDepth(child) : 0))
  return 1 + Math.max(0, ...childDepths)
}
