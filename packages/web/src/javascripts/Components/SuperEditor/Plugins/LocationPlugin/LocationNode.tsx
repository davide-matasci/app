import { DecoratorBlockNode, SerializedDecoratorBlockNode } from '@lexical/react/LexicalDecoratorBlockNode'
import { DOMExportOutput, EditorConfig, ElementFormatType, LexicalEditor, LexicalNode, NodeKey, Spread } from 'lexical'
import { describeLocation, GeoPoint, mapLinks } from './Location'
import LocationComponent from './LocationComponent'

export type LocationPayload = GeoPoint & { name?: string }

type SerializedLocationNode = Spread<
  {
    lat: number
    lng: number
    name?: string
  },
  SerializedDecoratorBlockNode
>

/**
 * A place in a note: its coordinates and an optional name. The plus code and the links to map apps are
 * computed from the coordinates; nothing else is stored.
 */
export class LocationNode extends DecoratorBlockNode {
  __lat: number
  __lng: number
  __name: string | undefined

  static getType(): string {
    return 'location'
  }

  constructor(lat: number, lng: number, name?: string, format?: ElementFormatType, key?: NodeKey) {
    super(format, key)
    this.__lat = lat
    this.__lng = lng
    this.__name = name || undefined
  }

  static clone(node: LocationNode): LocationNode {
    return new LocationNode(node.__lat, node.__lng, node.__name, node.__format, node.__key)
  }

  static importJSON(serializedNode: SerializedLocationNode): LocationNode {
    return $createLocationNode({
      lat: serializedNode.lat,
      lng: serializedNode.lng,
      name: serializedNode.name,
    }).updateFromJSON(serializedNode)
  }

  exportJSON(): SerializedLocationNode {
    return {
      ...super.exportJSON(),
      lat: this.__lat,
      lng: this.__lng,
      name: this.__name,
    }
  }

  getPoint(): GeoPoint {
    const self = this.getLatest()
    return { lat: self.__lat, lng: self.__lng }
  }

  getName(): string | undefined {
    return this.getLatest().__name
  }

  setLocation(location: LocationPayload): void {
    const writable = this.getWritable()
    writable.__lat = location.lat
    writable.__lng = location.lng
    writable.__name = location.name || undefined
  }

  /** "Name (47.37690, 8.54170, 8FVC9GGR+QM)": what plain-text exports and search see. */
  override getTextContent(): string {
    return describeLocation(this.getPoint(), this.getName())
  }

  exportDOM(): DOMExportOutput {
    const paragraph = document.createElement('p')
    const link = document.createElement('a')
    link.setAttribute('href', mapLinks(this.getPoint(), this.getName()).openStreetMap)
    link.textContent = `📍 ${this.getTextContent()}`
    paragraph.append(link)
    return { element: paragraph }
  }

  decorate(_editor: LexicalEditor, config: EditorConfig): JSX.Element {
    const embedBlockTheme = config.theme.embedBlock || {}
    const className = {
      base: embedBlockTheme.base || '',
      focus: embedBlockTheme.focus || '',
    }

    return (
      <LocationComponent
        className={className}
        format={this.__format}
        nodeKey={this.getKey()}
        lat={this.__lat}
        lng={this.__lng}
        name={this.__name}
      />
    )
  }
}

export function $isLocationNode(node: LexicalNode | null | undefined): node is LocationNode {
  return node instanceof LocationNode
}

export function $createLocationNode(location: LocationPayload): LocationNode {
  return new LocationNode(location.lat, location.lng, location.name)
}
