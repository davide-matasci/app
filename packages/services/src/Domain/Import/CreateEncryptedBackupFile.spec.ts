import { ContentType } from '@standardnotes/domain-core'
import { EncryptedPayload, PayloadTimestampDefaults } from '@standardnotes/models'
import { EncryptionProviderInterface } from '../Encryption/EncryptionProviderInterface'
import { ItemManagerInterface } from '../Item/ItemManagerInterface'
import { ProtectionsClientInterface } from '../Protection/ProtectionClientInterface'
import { CreateEncryptedBackupFile } from './CreateEncryptedBackupFile'

describe('CreateEncryptedBackupFile', () => {
  it('includes items that cannot be decrypted right now, as they are', async () => {
    const undecryptable = new EncryptedPayload({
      uuid: 'waiting-for-key',
      content_type: ContentType.TYPES.Note,
      content: '004:encrypted',
      enc_item_key: '004:key',
      items_key_id: 'missing-key',
      errorDecrypting: true,
      waitingForKey: true,
      ...PayloadTimestampDefaults(),
    })

    const items = { items: [], invalidItems: [{ payload: undecryptable }] } as unknown as ItemManagerInterface
    const encryption = {
      encryptSplit: jest.fn().mockResolvedValue([]),
      getRootKeyParams: jest.fn().mockReturnValue(undefined),
    } as unknown as EncryptionProviderInterface

    const result = await new CreateEncryptedBackupFile(items, {} as ProtectionsClientInterface, encryption).execute({
      skipAuthorization: true,
    })

    expect(result.getValue().items.map((item) => item.uuid)).toEqual(['waiting-for-key'])
  })
})
