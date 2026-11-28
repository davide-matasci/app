import { BlockPickerOption } from '../BlockPickerPlugin/BlockPickerOption'
import { c } from 'ttag'

export function GetLocationBlockOption(onSelect: () => void) {
  return new BlockPickerOption(c('B3.Notes.EditorToolbar.Action').t`Location`, {
    iconName: 'pin',
    keywords: ['location', 'map', 'place', 'coordinates', 'plus code', 'gps'],
    onSelect: onSelect,
  })
}
