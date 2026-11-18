import { CompoundPredicateBuilderController } from './CompoundPredicateBuilderController'
import { ConditionGroup } from './Model/SmartViewConditions'

describe('CompoundPredicateBuilderController', () => {
  it('keeps at least one condition at the root', () => {
    const controller = new CompoundPredicateBuilderController()
    const only = controller.root.children[0]

    controller.removeNode(controller.root, only)

    expect(controller.root.children).toHaveLength(1)
  })

  it('removes a nested group once its last condition is removed', () => {
    const controller = new CompoundPredicateBuilderController()
    controller.addGroup(controller.root, 1)
    const group = controller.root.children[1] as ConditionGroup

    controller.removeNode(group, group.children[0])

    expect(controller.root.children.map((child) => child.type)).toEqual(['condition'])
  })

  it('nests groups at most three levels deep', () => {
    const controller = new CompoundPredicateBuilderController()
    controller.addGroup(controller.root, 1)
    const level2 = controller.root.children[1] as ConditionGroup
    controller.addGroup(level2, 2)
    const level3 = level2.children[1] as ConditionGroup

    controller.addGroup(level3, 3)

    expect(level3.children.map((child) => child.type)).toEqual(['condition'])
  })

  it('resets operator and value to valid ones when the field changes', () => {
    const controller = new CompoundPredicateBuilderController()
    const condition = controller.root.children[0]
    if (condition.type !== 'condition') {
      throw new Error('expected a condition')
    }

    controller.setField(condition, 'userModifiedDate')

    expect(condition.operatorId).toBe('withinLast')
    expect(condition.value).toEqual({ kind: 'relativeDate', amount: 7, unit: 'days' })
    expect(controller.toJson()).toEqual({
      operator: 'and',
      value: [{ keypath: 'userModifiedDate', operator: '>', value: '7.days.ago' }],
    })
  })

  it('counts tag conditions without a tag as incomplete, until a tag is picked', () => {
    const controller = new CompoundPredicateBuilderController()
    const condition = controller.root.children[0]
    if (condition.type !== 'condition') {
      throw new Error('expected a condition')
    }

    controller.setField(condition, 'tags')
    expect(controller.incompleteConditionCount).toBe(1)

    controller.setValue(condition, { kind: 'tag', tag: { uuid: 'tag-work' } })
    expect(controller.incompleteConditionCount).toBe(0)
  })
})
