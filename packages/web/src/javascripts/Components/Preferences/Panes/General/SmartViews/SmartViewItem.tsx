import Button from '@/Components/Button/Button'
import Icon from '@/Components/Icon/Icon'
import { useApplication } from '@/Components/ApplicationProvider'
import { describeSmartView } from '@/Components/SmartViewBuilder/Model/describeSmartView'
import { SmartView } from '@standardnotes/snjs'
import { useCallback, useMemo } from 'react'
import { c } from 'ttag'

type Props = {
  view: SmartView
  onEdit: () => void
  onDelete: (view: SmartView) => void
}

const SmartViewItem = ({ view, onEdit, onDelete }: Props) => {
  const application = useApplication()
  const onClickDelete = useCallback(() => onDelete(view), [onDelete, view])
  const summary = useMemo(() => describeSmartView(application, view), [application, view])

  return (
    <div className="flex items-center gap-2 py-1.5">
      <Icon type={view.iconString} size="custom" className="h-5.5 w-5.5 flex-shrink-0" />
      <div className="mr-auto flex min-w-0 flex-col">
        <span className="overflow-hidden text-ellipsis text-sm">{view.title}</span>
        <span className="overflow-hidden text-ellipsis text-xs text-passive-1" title={summary}>
          {summary}
        </span>
      </div>
      <Button small onClick={onEdit}>
        {c('B6.Preferences.General.Action').t`Edit`}
      </Button>
      <Button small onClick={onClickDelete}>
        {c('B6.Preferences.General.Action').t`Delete`}
      </Button>
    </div>
  )
}

export default SmartViewItem
