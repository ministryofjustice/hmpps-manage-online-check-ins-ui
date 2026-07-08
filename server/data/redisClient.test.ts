const mockCreateClient = jest.fn()

jest.mock('redis', () => ({
  createClient: mockCreateClient,
}))

jest.mock('../../logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
}))

describe('createRedisClient', () => {
  beforeEach(() => {
    jest.resetModules()
    mockCreateClient.mockReturnValue({
      on: jest.fn(),
    })
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('creates redis client without tls', async () => {
    jest.doMock('../config', () => {
      const actualConfig = jest.requireActual('../config').default

      return {
        ...actualConfig,
        redis: {
          ...actualConfig.redis,
          tls_enabled: 'false',
          host: 'localhost',
          port: 6379,
          password: undefined,
        },
      }
    })

    const { createRedisClient } = await import('./redisClient')

    createRedisClient()

    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'redis://localhost:6379',
      password: undefined,
      socket: {
        reconnectStrategy: expect.any(Function),
      },
    })
  })

  it('creates redis client with tls', async () => {
    jest.doMock('../config', () => {
      const actualConfig = jest.requireActual('../config').default

      return {
        ...actualConfig,
        redis: {
          ...actualConfig.redis,
          tls_enabled: 'true',
          host: 'localhost',
          port: 6379,
          password: undefined,
        },
      }
    })

    const { createRedisClient } = await import('./redisClient')

    createRedisClient()

    expect(mockCreateClient).toHaveBeenCalledWith({
      url: 'rediss://localhost:6379',
      password: undefined,
      socket: {
        reconnectStrategy: expect.any(Function),
      },
    })
  })
})
