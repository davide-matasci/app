import { WebApplication } from '@/Application/WebApplication'
import { CompoundPredicateBuilderController } from '@/Components/SmartViewBuilder/CompoundPredicateBuilderController'
import { predicateFromJson, SmartViewDefaultIconName, VectorIconNameOrEmoji } from '@standardnotes/snjs'
import { action, makeObservable, observable } from 'mobx'

export class AddSmartViewModalController {
  isAddingSmartView = false
  isSaving = false

  title = ''

  icon: VectorIconNameOrEmoji = SmartViewDefaultIconName

  predicateController = new CompoundPredicateBuilderController()

  constructor(private application: WebApplication) {
    makeObservable(this, {
      isAddingSmartView: observable,
      setIsAddingSmartView: action,

      isSaving: observable,
      setIsSaving: action,

      title: observable,
      setTitle: action,

      icon: observable,
      setIcon: action,
    })
  }

  setIsAddingSmartView = (isAddingSmartView: boolean) => {
    this.isAddingSmartView = isAddingSmartView
  }

  setIsSaving = (isSaving: boolean) => {
    this.isSaving = isSaving
  }

  setTitle = (title: string) => {
    this.title = title
  }

  setIcon = (icon: VectorIconNameOrEmoji) => {
    this.icon = icon
  }

  closeModal = () => {
    this.setIsAddingSmartView(false)
    this.setTitle('')
    this.setIcon('')
    this.setIsSaving(false)
    this.predicateController.resetState()
  }

  saveCurrentSmartView = async () => {
    this.setIsSaving(true)

    if (!this.title || this.predicateController.incompleteConditionCount > 0) {
      this.setIsSaving(false)
      return
    }

    const predicate = predicateFromJson(this.predicateController.toJson())

    await this.application.mutator.createSmartView({
      title: this.title,
      predicate,
      iconString: this.icon as string,
      vault: this.application.vaultDisplayService.exclusivelyShownVault,
    })

    this.setIsSaving(false)
    this.closeModal()
  }
}
