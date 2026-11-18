import { ComponentFeatureDescription } from '@standardnotes/features'
import { Environment, Platform, UIFeature } from '@standardnotes/models'
import { DesktopManagerInterface } from '@standardnotes/services'

const DESKTOP_URL_PREFIX = 'sn://'
const LOCAL_HOST = 'localhost'
const CUSTOM_LOCAL_HOST = 'sn.local'
const ANDROID_LOCAL_HOST = '10.0.2.2'

export class GetFeatureUrl {
  constructor(
    private desktopManager: DesktopManagerInterface | undefined,
    private environment: Environment,
    private platform: Platform,
  ) {}

  execute(uiFeature: UIFeature<ComponentFeatureDescription>): string | undefined {
    if (this.desktopManager) {
      return this.urlForFeatureOnDesktop(uiFeature)
    }

    if (uiFeature.isNativeFeature) {
      return this.urlForNativeComponent(
        uiFeature.featureDescription.identifier,
        uiFeature.featureDescription.index_path,
      )
    }

    if (uiFeature.asComponent.offlineOnly) {
      return undefined
    }

    const url = uiFeature.asComponent.hosted_url || uiFeature.asComponent.legacy_url
    if (!url) {
      if (uiFeature.asComponent.package_info.identifier && uiFeature.asComponent.package_info.index_path) {
        return this.urlForNativeComponent(
          uiFeature.asComponent.package_info.identifier,
          uiFeature.asComponent.package_info.index_path,
        )
      }

      return undefined
    }

    if (this.isMobile) {
      const localReplacement = this.platform === Platform.Ios ? LOCAL_HOST : ANDROID_LOCAL_HOST
      return url.replace(LOCAL_HOST, localReplacement).replace(CUSTOM_LOCAL_HOST, localReplacement)
    }

    return url
  }

  private urlForFeatureOnDesktop(uiFeature: UIFeature<ComponentFeatureDescription>): string | undefined {
    if (!this.desktopManager) {
      throw new Error('Desktop manager is not defined')
    }

    if (uiFeature.isNativeFeature) {
      return `${this.desktopManager.getExtServerHost()}/components/${uiFeature.featureIdentifier}/${
        uiFeature.featureDescription.index_path
      }`
    } else {
      if (uiFeature.asComponent.local_url) {
        return uiFeature.asComponent.local_url.replace(DESKTOP_URL_PREFIX, this.desktopManager.getExtServerHost() + '/')
      }

      return uiFeature.asComponent.hosted_url || uiFeature.asComponent.legacy_url
    }
  }

  private urlForNativeComponent(
    identifier: ComponentFeatureDescription['identifier'],
    index_path: ComponentFeatureDescription['index_path'],
  ): string {
    if (this.isMobile) {
      const baseUrlRequiredForThemesInsideEditors = window.location.href.split('/index.html')[0]
      return `${baseUrlRequiredForThemesInsideEditors}/web-src/components/assets/${identifier}/${index_path}`
    } else {
      // Resolve against the document base rather than the origin, so the web app also works when it is
      // hosted under a sub-path (e.g. https://user.github.io/app/). At the root this equals the origin.
      const baseUri = typeof document !== 'undefined' ? document.baseURI : undefined
      const baseUrlRequiredForThemesInsideEditors = baseUri
        ? new URL('.', baseUri).href.replace(/\/$/, '')
        : window.location.origin
      return `${baseUrlRequiredForThemesInsideEditors}/components/assets/${identifier}/${index_path}`
    }
  }

  get isMobile(): boolean {
    return this.environment === Environment.Mobile
  }
}
