import { NativeFeatureIdentifier } from '@standardnotes/features'
import { NoteType, PredicateJsonForm } from '@standardnotes/snjs'
import { action, makeObservable, observable, toJS } from 'mobx'
import { PredicateKeypath } from './PredicateKeypaths'
import {
  Condition,
  ConditionGroup,
  ConditionNode,
  ConditionValue,
  GroupMatch,
  MaxGroupDepth,
  OperatorId,
  conditionTreeToPredicate,
  defaultValueForField,
  newCondition,
  newGroup,
  operatorDefinition,
  predicateToConditionTree,
} from './Model/SmartViewConditions'

/** Edits a smart view's conditions as a tree of groups (see Model/SmartViewConditions). */
export class CompoundPredicateBuilderController {
  root: ConditionGroup = newGroup()

  constructor() {
    makeObservable(this, {
      root: observable,
      loadFromJson: action,
      resetState: action,
      setMatch: action,
      addCondition: action,
      addGroup: action,
      removeNode: action,
      setField: action,
      setOperator: action,
      setValue: action,
    })
  }

  loadFromJson = (predicate: PredicateJsonForm) => {
    this.root = predicateToConditionTree(predicate)
  }

  resetState = () => {
    this.root = newGroup()
  }

  toJson(): PredicateJsonForm {
    return conditionTreeToPredicate(toJS(this.root))
  }

  setMatch = (group: ConditionGroup, match: GroupMatch) => {
    group.match = match
  }

  addCondition = (group: ConditionGroup) => {
    group.children.push(newCondition())
  }

  /** `depth` is the group's own depth (the root is 1); groups nest at most MaxGroupDepth deep. */
  addGroup = (group: ConditionGroup, depth: number) => {
    if (depth >= MaxGroupDepth) {
      return
    }
    group.children.push(newGroup(group.match === 'all' ? 'any' : 'all'))
  }

  /** Removes a node; a nested group left empty is removed too, the root keeps at least one node. */
  removeNode = (parent: ConditionGroup, node: ConditionNode) => {
    const isLastAtRoot = parent === this.root && parent.children.length === 1
    if (isLastAtRoot) {
      return
    }

    parent.children.splice(parent.children.indexOf(node), 1)

    if (parent !== this.root && parent.children.length === 0) {
      const grandparent = this.findParent(this.root, parent)
      if (grandparent) {
        this.removeNode(grandparent, parent)
      }
    }
  }

  setField = (condition: Condition, field: PredicateKeypath) => {
    const fresh = newCondition(field)
    condition.field = field
    condition.operatorId = fresh.operatorId
    condition.value = initialValueForField(field)
  }

  setOperator = (condition: Condition, operatorId: OperatorId) => {
    if (operatorDefinition(condition.field, operatorId)) {
      condition.operatorId = operatorId
    }
  }

  setValue = (condition: Condition, value: ConditionValue) => {
    condition.value = value
  }

  private findParent(group: ConditionGroup, node: ConditionNode): ConditionGroup | undefined {
    for (const child of group.children) {
      if (child === node) {
        return group
      }
      if (child.type === 'group') {
        const found = this.findParent(child, node)
        if (found) {
          return found
        }
      }
    }
    return undefined
  }
}

/** Like defaultValueForField, with a concrete first choice for note type and editor. */
function initialValueForField(field: PredicateKeypath): ConditionValue {
  const value = defaultValueForField(field)
  if (value.kind === 'choice') {
    return {
      kind: 'choice',
      choice: field === 'noteType' ? Object.values(NoteType)[0] : NativeFeatureIdentifier.TYPES.PlainEditor,
    }
  }
  return value
}
