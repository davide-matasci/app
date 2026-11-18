import { observer } from 'mobx-react-lite'
import { c } from 'ttag'
import { useApplication } from '../ApplicationProvider'
import Icon from '../Icon/Icon'
import { CompoundPredicateBuilderController } from './CompoundPredicateBuilderController'
import { PredicateKeypath, PredicateKeypathTypes, getPredicateKeypathLabels } from './PredicateKeypaths'
import PredicateValue from './PredicateValue'
import {
  Condition,
  ConditionGroup,
  ConditionNode,
  GroupMatch,
  MaxGroupDepth,
  OperatorId,
  OperatorsForFieldType,
} from './Model/SmartViewConditions'
import { countMatchingNotes } from './Model/countMatchingNotes'

type Props = {
  controller: CompoundPredicateBuilderController
}

const inputClassName =
  'rounded border border-border bg-default px-2 py-1.5 focus:outline focus:outline-1 focus:outline-info'
const linkButtonClassName = 'flex items-center gap-1 rounded px-1.5 py-1 text-sm text-info hover:bg-contrast'

const CompoundPredicateBuilder = ({ controller }: Props) => {
  const application = useApplication()
  const matchingCount = countMatchingNotes(application.items, controller.toJson())

  return (
    <div className="flex flex-col gap-3">
      <GroupEditor controller={controller} group={controller.root} depth={1} />
      {matchingCount !== undefined && (
        <div className="text-sm text-passive-0">
          {matchingCount === 1
            ? c('Smart view preview').t`1 note matches`
            : c('Smart view preview').t`${matchingCount} notes match`}
        </div>
      )}
    </div>
  )
}

type GroupProps = {
  controller: CompoundPredicateBuilderController
  group: ConditionGroup
  depth: number
  parent?: ConditionGroup
}

const GroupEditor = observer(({ controller, group, depth, parent }: GroupProps) => {
  return (
    <div className={parent ? 'flex flex-col gap-2 rounded border border-border p-3' : 'flex flex-col gap-2'}>
      <div className="flex items-center gap-2 text-sm">
        <span>{c('Smart view builder').t`Match`}</span>
        <select
          className={inputClassName}
          value={group.match}
          onChange={(event) => controller.setMatch(group, event.target.value as GroupMatch)}
        >
          <option value="all">{c('Smart view builder').t`all`}</option>
          <option value="any">{c('Smart view builder').t`any`}</option>
        </select>
        <span className="flex-grow">{c('Smart view builder').t`of the following`}</span>
        {parent && (
          <button
            className="rounded p-1 text-danger hover:bg-contrast"
            aria-label={c('Smart view builder').t`Remove group`}
            title={c('Smart view builder').t`Remove group`}
            onClick={() => controller.removeNode(parent, group)}
          >
            <Icon type="trash" />
          </button>
        )}
      </div>

      {group.children.map((child, index) => (
        <NodeEditor key={index} controller={controller} node={child} parent={group} depth={depth} />
      ))}

      <div className="flex items-center gap-2">
        <button className={linkButtonClassName} onClick={() => controller.addCondition(group)}>
          <Icon type="add" size="small" />
          {c('Smart view builder').t`Condition`}
        </button>
        {depth < MaxGroupDepth && (
          <button className={linkButtonClassName} onClick={() => controller.addGroup(group, depth)}>
            <Icon type="add" size="small" />
            {c('Smart view builder').t`Group`}
          </button>
        )}
      </div>
    </div>
  )
})

type NodeProps = {
  controller: CompoundPredicateBuilderController
  node: ConditionNode
  parent: ConditionGroup
  depth: number
}

const NodeEditor = observer(({ controller, node, parent, depth }: NodeProps) => {
  const canRemove = !(parent === controller.root && parent.children.length === 1)
  const removeButton = canRemove && (
    <button
      className="shrink-0 rounded p-1 text-danger hover:bg-contrast"
      aria-label={c('Smart view builder').t`Remove condition`}
      title={c('Smart view builder').t`Remove condition`}
      onClick={() => controller.removeNode(parent, node)}
    >
      <Icon type="trash" />
    </button>
  )

  if (node.type === 'group') {
    return <GroupEditor controller={controller} group={node} depth={depth + 1} parent={parent} />
  }

  if (node.type === 'custom') {
    return (
      <div className="flex items-center gap-2 rounded border border-dashed border-border px-2 py-1.5 text-sm">
        <Icon type="lock" size="small" className="shrink-0 text-passive-1" />
        <span className="flex-grow text-passive-0">
          {c('Smart view builder').t`Custom condition (kept as is; can't be edited here)`}
        </span>
        {removeButton}
      </div>
    )
  }

  return <ConditionEditor controller={controller} condition={node} removeButton={removeButton} />
})

type ConditionProps = {
  controller: CompoundPredicateBuilderController
  condition: Condition
  removeButton: React.ReactNode
}

const ConditionEditor = observer(({ controller, condition, removeButton }: ConditionProps) => {
  const fieldLabels = getPredicateKeypathLabels()
  const operators = OperatorsForFieldType[PredicateKeypathTypes[condition.field]]

  return (
    <div className="flex w-full flex-col gap-2 md:flex-row md:items-center">
      <select
        className={`${inputClassName} min-w-0 md:w-44`}
        value={condition.field}
        onChange={(event) => controller.setField(condition, event.target.value as PredicateKeypath)}
      >
        {Object.entries(fieldLabels).map(([field, label]) => (
          <option key={field} value={field}>
            {label}
          </option>
        ))}
      </select>
      <select
        className={inputClassName}
        value={condition.operatorId}
        onChange={(event) => controller.setOperator(condition, event.target.value as OperatorId)}
      >
        {operators.map((operator) => (
          <option key={operator.id} value={operator.id}>
            {operator.label()}
          </option>
        ))}
      </select>
      <PredicateValue
        field={condition.field}
        value={condition.value}
        setValue={(value) => controller.setValue(condition, value)}
      />
      {removeButton}
    </div>
  )
})

export default observer(CompoundPredicateBuilder)
