import { Result, SyncUseCaseInterface } from '@standardnotes/domain-core'

import { GetHost } from './GetHost'

export class IsApplicationUsingThirdPartyHost implements SyncUseCaseInterface<boolean> {
  private readonly APPLICATION_DEFAULT_HOSTS = ['api.standardnotes.com', 'sync.standardnotes.org', 'localhost:3123']

  private readonly FILES_DEFAULT_HOSTS = ['files.standardnotes.com']

  /**
   * defaultHost: the sync server this build ships with (the application's
   * defaultHost option). It counts as first-party too, so a build made for a
   * self-hosted server treats that server like the official one.
   */
  constructor(
    private getHostUseCase: GetHost,
    private defaultHost?: string,
  ) {}

  execute(): Result<boolean> {
    const result = this.getHostUseCase.execute()
    if (result.isFailed()) {
      return Result.fail(result.getError())
    }

    const host = result.getValue()

    return Result.ok(!this.isUrlFirstParty(host))
  }

  private isUrlFirstParty(url: string): boolean {
    try {
      const { host } = new URL(url)
      return (
        this.APPLICATION_DEFAULT_HOSTS.includes(host) ||
        this.FILES_DEFAULT_HOSTS.includes(host) ||
        host === this.getDefaultHost()
      )
    } catch {
      return false
    }
  }

  private getDefaultHost(): string | undefined {
    try {
      return this.defaultHost ? new URL(this.defaultHost).host : undefined
    } catch {
      return undefined
    }
  }
}
