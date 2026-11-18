import { WebApplication } from '@/Application/WebApplication'
import { StringDeleteTag } from '@/Constants/Strings'
import { CompoundPredicateBuilderController } from '@/Components/SmartViewBuilder/CompoundPredicateBuilderController'
import { SmartView, SmartViewDefaultIconName, SmartViewMutator, VectorIconNameOrEmoji } from '@standardnotes/snjs'
import { confirmDialog } from '@standardnotes/ui-services'
import { action, makeObservable, observable } from 'mobx'

export class EditSmartViewModalController {
  title = ''
  icon: VectorIconNameOrEmoji = SmartViewDefaultIconName
  predicateController = new CompoundPredicateBuilderController()
  isSaving = false
  view: SmartView | undefined = undefined

  constructor(private application: WebApplication) {
    makeObservable(this, {
      title: observable,
      icon: observable,
      isSaving: observable,
      view: observable,

      setTitle: action,
      setIcon: action,
      setIsSaving: action,
      setView: action,
    })
  }

  setTitle = (title: string) => {
    this.title = title
  }

  setIcon = (icon: VectorIconNameOrEmoji) => {
    this.icon = icon
  }

  setView = (view: SmartView | undefined) => {
    this.view = view

    if (view) {
      this.setTitle(view.title)
      this.setIcon(view.iconString)
      this.predicateController.loadFromJson(view.predicate.toJson())
    }
  }

  setIsSaving = (isSaving: boolean) => {
    this.isSaving = isSaving
  }

  closeDialog = () => {
    this.setView(undefined)
    this.setTitle('')
    this.setIcon(SmartViewDefaultIconName)
    this.predicateController.resetState()
  }

  save = async () => {
    if (!this.view) {
      return
    }

    if (this.predicateController.incompleteConditionCount > 0) {
      return
    }

    this.setIsSaving(true)

    await this.application.changeAndSaveItem.execute<SmartViewMutator>(this.view, (mutator) => {
      mutator.title = this.title
      mutator.iconString = (this.icon as string) || SmartViewDefaultIconName
      mutator.predicate = this.predicateController.toJson()
    })

    this.setIsSaving(false)
    this.closeDialog()
  }

  deleteView = async () => {
    if (!this.view) {
      return
    }
    const view = this.view

    this.closeDialog()

    const shouldDelete = await confirmDialog({
      text: StringDeleteTag(),
      confirmButtonStyle: 'danger',
    })
    if (shouldDelete) {
      this.application.mutator
        .deleteItem(view)
        .then(() => this.application.sync.sync())
        .catch(console.error)
    }
  }
}
