import { PredicateJsonForm, predicateFromJson } from '@standardnotes/snjs'
import {
  formatPredicateText,
  ConditionGroup,
  DescribeContext,
  MaxGroupDepth,
  conditionTreeToPredicate,
  describeConditionTree,
  groupDepth,
  newCondition,
  predicateToConditionTree,
} from './SmartViewConditions'

const roundTrip = (predicate: PredicateJsonForm) => conditionTreeToPredicate(predicateToConditionTree(predicate))

const context: DescribeContext = {
  tagTitle: (uuid) => ({ 'tag-work': 'Work' })[uuid],
  choiceLabel: (_field, choice) => choice,
}

describe('smart view conditions', () => {
  it('reads and writes back a view made by the old builder unchanged', () => {
    const stored: PredicateJsonForm = {
      operator: 'and',
      value: [
        { keypath: 'title', operator: 'includes', value: 'meeting' },
        { keypath: 'starred', operator: '=', value: true },
        { keypath: 'userModifiedDate', operator: '>', value: '7.days.ago' },
        { keypath: 'tags', operator: 'includes', value: { keypath: 'title', operator: '=', value: 'Work' } },
      ],
    }

    const tree = predicateToConditionTree(stored)

    expect(tree.children.map((child) => child.type)).toEqual(['condition', 'condition', 'condition', 'condition'])
    expect(roundTrip(stored)).toEqual(stored)
  })

  it('reads and writes back nested groups and negations', () => {
    const stored: PredicateJsonForm = {
      operator: 'and',
      value: [
        { operator: 'not', value: { keypath: 'archived', operator: '=', value: true } } as PredicateJsonForm,
        {
          operator: 'or',
          value: [
            { keypath: 'pinned', operator: '=', value: true },
            { operator: 'not', value: { keypath: 'text', operator: 'includes', value: 'draft' } },
          ],
        },
      ],
    }

    const tree = predicateToConditionTree(stored)

    expect(tree.children[1].type).toBe('group')
    expect(groupDepth(tree)).toBe(2)
    expect(roundTrip(stored)).toEqual(stored)
  })

  it('keeps what the builder cannot represent, untouched, as a custom condition', () => {
    const inList: PredicateJsonForm = { keypath: 'title', operator: 'in', value: ['Meeting', 'Todo'] }
    const unknownField: PredicateJsonForm = { keypath: 'content_type', operator: '=', value: 'Note' }
    const absoluteDate: PredicateJsonForm = { keypath: 'created_at', operator: '>', value: '2024-01-01' }
    const stored: PredicateJsonForm = { operator: 'or', value: [inList, unknownField, absoluteDate] }

    const tree = predicateToConditionTree(stored)

    expect(tree.children.map((child) => child.type)).toEqual(['custom', 'custom', 'custom'])
    expect(roundTrip(stored)).toEqual(stored)
  })

  it('wraps a bare condition in an "all" group without changing what it matches', () => {
    const stored: PredicateJsonForm = { keypath: 'pinned', operator: '=', value: true }

    const tree = predicateToConditionTree(stored)

    expect(tree.match).toBe('all')
    expect(conditionTreeToPredicate(tree)).toEqual({ operator: 'and', value: [stored] })
  })

  it('stores new tag conditions by tag uuid, so renaming the tag keeps the view working', () => {
    const tree: ConditionGroup = {
      type: 'group',
      match: 'all',
      children: [
        { type: 'condition', field: 'tags', operatorId: 'hasTag', value: { kind: 'tag', tag: { uuid: 'tag-work' } } },
        {
          type: 'condition',
          field: 'tags',
          operatorId: 'doesNotHaveTag',
          value: { kind: 'tag', tag: { uuid: 'tag-old' } },
        },
      ],
    }

    const predicate = predicateFromJson(conditionTreeToPredicate(tree))
    const note = (tags: { uuid: string; title: string }[]) => ({ tags }) as never

    expect(predicate.matchesItem(note([{ uuid: 'tag-work', title: 'Renamed' }]))).toBe(true)
    expect(
      predicate.matchesItem(
        note([
          { uuid: 'tag-work', title: 'Work' },
          { uuid: 'tag-old', title: 'Old' },
        ]),
      ),
    ).toBe(false)
    expect(predicate.matchesItem(note([]))).toBe(false)
  })

  it('describes a view in plain language', () => {
    const tree: ConditionGroup = {
      type: 'group',
      match: 'all',
      children: [
        { type: 'condition', field: 'tags', operatorId: 'hasTag', value: { kind: 'tag', tag: { uuid: 'tag-work' } } },
        {
          type: 'group',
          match: 'any',
          children: [
            { type: 'condition', field: 'starred', operatorId: 'is', value: { kind: 'boolean', boolean: true } },
            {
              type: 'condition',
              field: 'userModifiedDate',
              operatorId: 'withinLast',
              value: { kind: 'relativeDate', amount: 7, unit: 'days' },
            },
          ],
        },
      ],
    }

    expect(describeConditionTree(tree, context)).toBe(
      'has tag "Work" and (Starred or User Modified Date is in the last 7 days)',
    )
  })

  it('creates new conditions with an operator valid for their field', () => {
    expect(newCondition('created_at').operatorId).toBe('withinLast')
    expect(newCondition('tags').operatorId).toBe('hasTag')
    expect(MaxGroupDepth).toBe(3)
  })
})

describe('formatPredicateText', () => {
  it('shows a custom predicate as compact text, nested groups in parentheses', () => {
    const predicate = {
      operator: 'and',
      value: [
        { keypath: 'title', operator: 'startsWith', value: 'x' },
        {
          operator: 'or',
          value: [
            { keypath: 'content.appData.foo', operator: '=', value: true },
            { operator: 'not', value: { keypath: 'tags', operator: 'includes', value: ['a', 'b'] } },
          ],
        },
      ],
    } as unknown as PredicateJsonForm

    expect(formatPredicateText(predicate)).toBe(
      'title startsWith "x" and (content.appData.foo = true or not (tags includes ["a", "b"]))',
    )
  })
})

describe('date conditions written with >= or <=', () => {
  it('are editable as "in the last" / "not in the last"', () => {
    const tree = predicateToConditionTree({ keypath: 'created_at', operator: '>=', value: '365.days.ago' })
    expect(tree.children[0]).toEqual({
      type: 'condition',
      field: 'created_at',
      operatorId: 'withinLast',
      value: { kind: 'relativeDate', amount: 365, unit: 'days' },
    })

    const notWithin = predicateToConditionTree({ keypath: 'created_at', operator: '<=', value: '2.years.ago' })
    expect(notWithin.children[0]).toMatchObject({ operatorId: 'notWithinLast' })
  })
})

describe('a pattern with a date placeholder', () => {
  it('is an ordinary "matches pattern" condition and finds the diary note of a year ago', () => {
    const stored: PredicateJsonForm = { keypath: 'title', operator: 'matches', value: '^{1.years.ago}$' }
    const tree = predicateToConditionTree(stored)
    expect(tree.children[0]).toMatchObject({
      operatorId: 'matchesPattern',
      value: { kind: 'text', text: '^{1.years.ago}$' },
    })
    expect(roundTrip(stored)).toEqual({ operator: 'and', value: [stored] })
  })
})
