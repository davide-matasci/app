import { WebApplication } from '@/Application/WebApplication'
import { getDropdownItemsForAllEditors } from '@/Utils/DropdownItemsForEditors'
import { NoteType, SmartView, SNTag } from '@standardnotes/snjs'
import { describeConditionTree, predicateToConditionTree } from './SmartViewConditions'

/** A smart view's conditions in plain language, with current tag and editor names. */
export function describeSmartView(application: WebApplication, view: SmartView): string {
  const editorLabels = new Map(getDropdownItemsForAllEditors(application).map((item) => [item.value, item.label]))
  const noteTypeLabels = new Map(Object.entries(NoteType).map(([label, value]) => [value as string, label]))

  const summary = describeConditionTree(predicateToConditionTree(view.predicate.toJson()), {
    tagTitle: (uuid) => application.items.findItem<SNTag>(uuid)?.title,
    choiceLabel: (field, choice) =>
      (field === 'noteType' ? noteTypeLabels.get(choice) : editorLabels.get(choice)) ?? choice,
  })

  return summary.charAt(0).toUpperCase() + summary.slice(1)
}
