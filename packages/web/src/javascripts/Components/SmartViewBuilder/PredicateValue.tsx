import { getDropdownItemsForAllEditors } from '@/Utils/DropdownItemsForEditors'
import { ContentType, naturalSort, NoteType, SNTag } from '@standardnotes/snjs'
import { useApplication } from '../ApplicationProvider'
import { PredicateKeypath } from './PredicateKeypaths'
import { ConditionValue, DateUnits, unitLabel } from './Model/SmartViewConditions'
import { c } from 'ttag'

type Props = {
  field: PredicateKeypath
  value: ConditionValue
  setValue: (value: ConditionValue) => void
}

const inputClassName =
  'rounded border border-border bg-default px-2 py-1.5 focus:outline focus:outline-1 focus:outline-info'

/** The control for a condition's value, chosen by the value's kind (never free-form JSON). */
const PredicateValue = ({ field, value, setValue }: Props) => {
  const application = useApplication()

  switch (value.kind) {
    case 'text':
      return (
        <input
          className={`${inputClassName} min-w-0 flex-grow`}
          value={value.text}
          placeholder={c('Smart view value').t`Text`}
          onChange={(event) => setValue({ kind: 'text', text: event.target.value })}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          className={`${inputClassName} w-28`}
          value={value.number}
          onChange={(event) => setValue({ kind: 'number', number: Number(event.target.value) || 0 })}
        />
      )

    case 'boolean':
      return (
        <select
          className={inputClassName}
          value={value.boolean ? 'yes' : 'no'}
          onChange={(event) => setValue({ kind: 'boolean', boolean: event.target.value === 'yes' })}
        >
          <option value="yes">{c('Smart view value').t`Yes`}</option>
          <option value="no">{c('Smart view value').t`No`}</option>
        </select>
      )

    case 'relativeDate':
      return (
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={1}
            className={`${inputClassName} w-20`}
            value={value.amount}
            onChange={(event) =>
              setValue({ ...value, amount: Math.max(1, Math.floor(Number(event.target.value) || 1)) })
            }
          />
          <select
            className={inputClassName}
            value={value.unit}
            onChange={(event) => setValue({ ...value, unit: event.target.value as typeof value.unit })}
          >
            {DateUnits.map((unit) => (
              <option key={unit} value={unit}>
                {unitLabel(unit, value.amount)}
              </option>
            ))}
          </select>
        </div>
      )

    case 'choice':
      return (
        <select
          className={`${inputClassName} min-w-0 flex-grow`}
          value={value.choice}
          onChange={(event) => setValue({ kind: 'choice', choice: event.target.value })}
        >
          {field === 'noteType'
            ? Object.entries(NoteType).map(([label, noteType]) => (
                <option key={noteType} value={noteType}>
                  {label}
                </option>
              ))
            : getDropdownItemsForAllEditors(application).map((editor) => (
                <option key={editor.value} value={editor.value}>
                  {editor.label}
                </option>
              ))}
        </select>
      )

    case 'tag': {
      const tags = naturalSort(application.items.getItems<SNTag>(ContentType.TYPES.Tag), 'title')
      /** A condition from before tags were stored by id: keep it selectable as is. */
      const legacyTitle = 'title' in value.tag && value.tag.title ? value.tag.title : undefined
      const selected = 'uuid' in value.tag ? value.tag.uuid : legacyTitle ? `title:${legacyTitle}` : ''

      return (
        <select
          className={`${inputClassName} min-w-0 flex-grow truncate`}
          value={selected}
          onChange={(event) => {
            const choice = event.target.value
            setValue({
              kind: 'tag',
              tag: choice.startsWith('title:') ? { title: choice.slice('title:'.length) } : { uuid: choice },
            })
          }}
        >
          <option value="" disabled>
            {c('Smart view value').t`Select a tag…`}
          </option>
          {legacyTitle && <option value={`title:${legacyTitle}`}>{legacyTitle}</option>}
          {tags.map((tag) => (
            <option key={tag.uuid} value={tag.uuid}>
              {application.items.getTagLongTitle(tag) || tag.title}
            </option>
          ))}
        </select>
      )
    }
  }
}

export default PredicateValue
