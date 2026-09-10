import { FliptClient } from '@flipt-io/flipt-client-js'
import FeatureFlagService from './featureFlagService'

jest.mock('@flipt-io/flipt-client-js', () => ({
  FliptClient: { init: jest.fn() },
}))

type FliptNodeClient = FliptClient & { close: () => void }

describe('FeatureFlagService', () => {
  let featureFlagService: FeatureFlagService
  let client: jest.Mocked<FliptNodeClient>

  beforeEach(() => {
    jest.resetAllMocks()
    client = {
      evaluateBoolean: jest.fn(),
      evaluateVariant: jest.fn(),
      close: jest.fn(),
    } as unknown as jest.Mocked<FliptNodeClient>
    ;(FliptClient.init as jest.Mock).mockResolvedValue(client)
    featureFlagService = new FeatureFlagService()
  })

  describe('evaluateBoolean', () => {
    it('returns the enabled value from the client', async () => {
      client.evaluateBoolean.mockReturnValue({ enabled: true } as ReturnType<typeof client.evaluateBoolean>)

      const result = await featureFlagService.evaluateBoolean('my-flag', 'user-123')

      expect(result).toBe(true)
      expect(client.evaluateBoolean).toHaveBeenCalledWith({ flagKey: 'my-flag', entityId: 'user-123', context: {} })
    })

    it('defaults to false if evaluation fails', async () => {
      ;(FliptClient.init as jest.Mock).mockRejectedValue(new Error('unreachable'))

      const result = await featureFlagService.evaluateBoolean('my-flag', 'user-123')

      expect(result).toBe(false)
    })
  })

  describe('evaluateVariant', () => {
    it('returns the variant key from the client when matched', async () => {
      client.evaluateVariant.mockReturnValue({
        match: true,
        variantKey: 'v2',
      } as ReturnType<typeof client.evaluateVariant>)

      const result = await featureFlagService.evaluateVariant('template-version', 'user-123')

      expect(result).toBe('v2')
      expect(client.evaluateVariant).toHaveBeenCalledWith({
        flagKey: 'template-version',
        entityId: 'user-123',
        context: {},
      })
    })

    it('returns undefined when there is no match', async () => {
      client.evaluateVariant.mockReturnValue({
        match: false,
        variantKey: '',
      } as ReturnType<typeof client.evaluateVariant>)

      const result = await featureFlagService.evaluateVariant('template-version', 'user-123')

      expect(result).toBeUndefined()
    })

    it('defaults to undefined if evaluation fails', async () => {
      ;(FliptClient.init as jest.Mock).mockRejectedValue(new Error('unreachable'))

      const result = await featureFlagService.evaluateVariant('template-version', 'user-123')

      expect(result).toBeUndefined()
    })
  })
})
