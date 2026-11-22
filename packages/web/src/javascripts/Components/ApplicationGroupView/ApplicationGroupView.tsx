import { WebApplicationGroup } from '@/Application/WebApplicationGroup'
import { WebApplication } from '@/Application/WebApplication'
import { Component } from 'react'
import ApplicationView from '@/Components/ApplicationView/ApplicationView'
import { WebOrDesktopDevice } from '@/Application/Device/WebOrDesktopDevice'
import { ApplicationGroupEvent, ApplicationGroupEventData, DeinitSource } from '@standardnotes/snjs'
import { getPlatformString, isDesktopApplication } from '@/Utils'
import { c } from 'ttag'
import DeallocateHandler from '../DeallocateHandler/DeallocateHandler'
import { IS_CHROME } from '../../Constants/Constants'

type Props = {
  server: string
  device: WebOrDesktopDevice
  enableUnfinished: boolean
  websocketUrl: string
  onDestroy: () => void
}

type State = {
  activeApplication?: WebApplication
  dealloced?: boolean
  deallocSource?: DeinitSource
  deviceDestroyed?: boolean
}

const renderDialog = (message: string) => {
  return (
    <div className="flex h-full w-full items-center justify-center bg-passive-5" role="alert">
      <div
        className={
          'challenge-modal shadow-overlay-light relative flex max-w-125 flex-col items-center rounded border border-solid border-border bg-default p-6'
        }
      >
        <div className="text-base lg:text-xs">{message}</div>
      </div>
    </div>
  )
}

class ApplicationGroupView extends Component<Props, State> {
  applicationObserverRemover?: () => void
  private group?: WebApplicationGroup
  private application?: WebApplication

  constructor(props: Props) {
    super(props)

    if (props.device.isDeviceDestroyed()) {
      this.state = {
        deviceDestroyed: true,
      }

      return
    }

    this.group = new WebApplicationGroup(props.server, props.device, props.websocketUrl)

    window.mainApplicationGroup = this.group

    this.applicationObserverRemover = this.group.addEventObserver((event, data) => {
      if (event === ApplicationGroupEvent.PrimaryApplicationSet) {
        const castData = data as ApplicationGroupEventData[ApplicationGroupEvent.PrimaryApplicationSet]

        this.application = castData.application as WebApplication
        this.setState({ activeApplication: this.application })
      } else if (event === ApplicationGroupEvent.DeviceWillRestart) {
        const castData = data as ApplicationGroupEventData[ApplicationGroupEvent.DeviceWillRestart]

        this.setState({ dealloced: true, deallocSource: castData.source })
      }
    })

    this.state = {}

    this.group.initialize().catch(console.error)

    const platformString = getPlatformString()
    if (!document.body.classList.contains(platformString)) {
      document.body.classList.add(platformString)
    }
    if (IS_CHROME) {
      document.body.classList.add('chromium')
    }
    document.addEventListener('keydown', preventSelectAllOutsideEditableFields)
    if (isAppleTouchDevice() && isHomeScreenWebApp()) {
      fitPageToVisibleArea()
    }
    if (isIPadHomeScreenWebApp()) {
      // iPadOS draws its window controls over the top-left corner of windowed (not full-screen) apps
      const updateWindowControls = () =>
        document.body.classList.toggle('ipad-window-controls', !isWindowFullScreenWidth())
      updateWindowControls()
      window.addEventListener('resize', updateWindowControls)
    }
  }

  deinit() {
    this.application = undefined

    this.applicationObserverRemover?.()
    ;(this.applicationObserverRemover as unknown) = undefined

    this.group?.deinit()
    ;(this.group as unknown) = undefined

    this.setState({ dealloced: true, activeApplication: undefined })

    const onDestroy = this.props.onDestroy

    onDestroy()
  }

  override render() {
    if (this.state.deviceDestroyed) {
      const message = isDesktopApplication()
        ? c('B5.SecuritySync.Protections.Error')
            .t`Secure memory has destroyed this application instance. Restart the app to continue.`
        : c('B5.SecuritySync.Protections.Error')
            .t`Secure memory has destroyed this application instance. Close this browser tab and open a new one to continue.`

      return renderDialog(message)
    }

    if (this.state.dealloced) {
      const message =
        this.state.deallocSource === DeinitSource.Lock
          ? c('B1.Account.Session.Status').t`Locking workspace...`
          : c('B1.Account.Session.Status').t`Switching workspace...`
      return renderDialog(message)
    }

    if (!this.group || !this.state.activeApplication || this.state.activeApplication.dealloced) {
      return null
    }

    return (
      <div
        id={this.state.activeApplication.identifier}
        className={'h-full'}
        key={this.state.activeApplication.ephemeralIdentifier}
      >
        <DeallocateHandler application={this.state.activeApplication}>
          <ApplicationView
            key={this.state.activeApplication.ephemeralIdentifier}
            mainApplicationGroup={this.group}
            application={this.state.activeApplication}
          />
        </DeallocateHandler>
      </div>
    )
  }
}

export default ApplicationGroupView

function isIPadHomeScreenWebApp(): boolean {
  // iPadOS identifies as "Macintosh" (desktop-class browsing); an iPhone's "like Mac OS X" must not match
  const isIPad =
    /iPad/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  return isIPad && isHomeScreenWebApp()
}

function isAppleTouchDevice(): boolean {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  )
}

/**
 * When a text field is focused and the keyboard (or the iPad's shortcut bar) appears, iOS scrolls the page,
 * despite overflow: hidden, to keep the caret visible, and often doesn't scroll it back: the top of the
 * interface ends up off screen. Instead, the app is sized to the area the keyboard leaves visible (the
 * editor scrolls itself to keep the caret in view) and the page is put back at the top: right away when the
 * keyboard opens or closes, and otherwise once a drag has ended and the page has stopped moving (moving it
 * back during the drag made the interface shake). Nothing changes while the page is pinch-zoomed.
 */
function fitPageToVisibleArea() {
  const viewport = window.visualViewport
  if (!viewport) {
    return
  }
  const isZoomed = () => Math.abs(viewport.scale - 1) > 0.01
  const scrollToTop = () => {
    if (!isZoomed() && (window.scrollY !== 0 || window.scrollX !== 0)) {
      window.scrollTo(0, 0)
    }
  }

  let isTouching = false
  let settleTimer: ReturnType<typeof setTimeout> | undefined
  const scrollToTopWhenSettled = () => {
    clearTimeout(settleTimer)
    settleTimer = setTimeout(() => {
      if (!isTouching) {
        scrollToTop()
      }
    }, 150)
  }

  const onResize = () => {
    if (isZoomed()) {
      return
    }
    document.documentElement.style.setProperty('--visible-height', `${Math.round(viewport.height)}px`)
    scrollToTop()
  }

  viewport.addEventListener('resize', onResize)
  viewport.addEventListener('scroll', scrollToTopWhenSettled)
  window.addEventListener('scroll', scrollToTopWhenSettled, { passive: true })
  document.addEventListener(
    'touchstart',
    () => {
      isTouching = true
    },
    { passive: true },
  )
  const onTouchEnd = () => {
    isTouching = false
    scrollToTopWhenSettled()
  }
  document.addEventListener('touchend', onTouchEnd, { passive: true })
  document.addEventListener('touchcancel', onTouchEnd, { passive: true })
  onResize()
}

function isHomeScreenWebApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Whether the app window spans the whole screen width. iPadOS shows window controls only on windowed apps.
 * Safari reports the screen size in portrait, so the width is compared with both screen dimensions.
 */
function isWindowFullScreenWidth(): boolean {
  const tolerance = 2
  return [screen.width, screen.height].some((size) => Math.abs(window.innerWidth - size) <= tolerance)
}

/**
 * Cmd/Ctrl+A outside a text field selected the whole interface (buttons, labels, every pane). It now only
 * selects within inputs, text areas and editors, where it's meant for.
 */
function preventSelectAllOutsideEditableFields(event: KeyboardEvent) {
  const isSelectAll = (event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === 'a'
  if (!isSelectAll) {
    return
  }
  const target = event.target
  const isEditable =
    target instanceof HTMLElement &&
    (target.isContentEditable || target.closest('input, textarea, select, [contenteditable="true"]') !== null)
  if (!isEditable) {
    event.preventDefault()
  }
}
