import CompoundPredicateBuilder from '@/Components/SmartViewBuilder/CompoundPredicateBuilder'
import Icon from '@/Components/Icon/Icon'
import IconPicker from '@/Components/Icon/IconPicker'
import Popover from '@/Components/Popover/Popover'
import Spinner from '@/Components/Spinner/Spinner'
import { Platform, SmartViewDefaultIconName, VectorIconNameOrEmoji } from '@standardnotes/snjs'
import { observer } from 'mobx-react-lite'
import { useCallback, useMemo, useRef, useState } from 'react'
import { AddSmartViewModalController } from './AddSmartViewModalController'
import Modal, { ModalAction } from '../Modal/Modal'
import { c } from 'ttag'

type Props = {
  controller: AddSmartViewModalController
  platform: Platform
}

const AddSmartViewModal = ({ controller, platform }: Props) => {
  const { isSaving, title, setTitle, icon, setIcon, closeModal, saveCurrentSmartView, predicateController } = controller

  const titleInputRef = useRef<HTMLInputElement>(null)

  const [shouldShowIconPicker, setShouldShowIconPicker] = useState(false)
  const iconPickerButtonRef = useRef<HTMLButtonElement>(null)

  const toggleIconPicker = () => {
    setShouldShowIconPicker((shouldShow) => !shouldShow)
  }

  const hasIncompleteConditions = predicateController.incompleteConditionCount > 0

  const save = useCallback(() => {
    if (!title.length) {
      titleInputRef.current?.focus()
      return
    }

    void saveCurrentSmartView()
  }, [saveCurrentSmartView, title.length])

  const modalActions = useMemo(
    (): ModalAction[] => [
      {
        label: c('B2.NavSharedUI.Modal.Action').t`Cancel`,
        onClick: closeModal,
        disabled: isSaving,
        type: 'cancel',
        mobileSlot: 'left',
      },
      {
        label: isSaving ? <Spinner className="h-4.5 w-4.5" /> : c('B4.Notes.TagsLinkedItems.Action').t`Save`,
        onClick: save,
        disabled: isSaving || hasIncompleteConditions,
        mobileSlot: 'right',
        type: 'primary',
      },
    ],
    [closeModal, hasIncompleteConditions, isSaving, save],
  )

  return (
    <Modal title={c('B4.Notes.TagsLinkedItems.Action').t`Add Smart View`} close={closeModal} actions={modalActions}>
      {/* Labels and controls aren't text to select (a long press on iPad selected across them); inputs still are */}
      <div className="select-none px-4 py-4 [&_input]:select-text [&_textarea]:select-text">
        <div className="flex h-full flex-col gap-4">
          <div className="flex items-center gap-2.5">
            <div className="text-sm font-semibold">{c('B4.Notes.TagsLinkedItems.Label').t`Title:`}</div>
            <input
              className="rounded border border-border bg-default px-2 py-1 md:translucent-ui:bg-transparent"
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
              }}
              ref={titleInputRef}
            />
          </div>
          <div className="flex items-center gap-2.5">
            <div className="text-sm font-semibold">{c('B4.Notes.TagsLinkedItems.Label').t`Icon:`}</div>
            <button
              className="rounded border border-border p-2"
              aria-label={c('B4.Notes.TagsLinkedItems.Action').t`Change icon`}
              onClick={toggleIconPicker}
              ref={iconPickerButtonRef}
            >
              <Icon type={icon || SmartViewDefaultIconName} />
            </button>
            <Popover
              title={c('B4.Notes.TagsLinkedItems.Label').t`Choose icon`}
              open={shouldShowIconPicker}
              anchorElement={iconPickerButtonRef}
              togglePopover={toggleIconPicker}
              align="start"
              overrideZIndex="z-modal"
            >
              <div className="p-2">
                <IconPicker
                  selectedValue={icon || SmartViewDefaultIconName}
                  onIconChange={(value?: VectorIconNameOrEmoji) => {
                    setIcon(value ?? SmartViewDefaultIconName)
                    toggleIconPicker()
                  }}
                  platform={platform}
                  useIconGrid={true}
                />
              </div>
            </Popover>
          </div>
          <div className="flex flex-col gap-2.5">
            <div className="text-sm font-semibold">{c('B4.Notes.TagsLinkedItems.Label').t`Conditions:`}</div>
            <CompoundPredicateBuilder controller={predicateController} />
            {hasIncompleteConditions && (
              <div className="text-sm text-danger">
                {c('B4.Notes.TagsLinkedItems.Info').t`Pick a tag for each tag condition to save.`}
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}

export default observer(AddSmartViewModal)
