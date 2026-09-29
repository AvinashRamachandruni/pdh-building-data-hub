import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';
import { RedisCacheService } from './redis-cache.service';

jest.mock('redis', () => ({ createClient: jest.fn() }));

describe('RedisCacheService', () => {
  const client = {
    isReady: false,
    isOpen: false,
    on: jest.fn(),
    connect: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    quit: jest.fn(),
  };
  const config = {
    get: jest.fn().mockReturnValue('redis://localhost:6379'),
  };
  let cache: RedisCacheService;

  beforeEach(() => {
    jest.clearAllMocks();
    client.isReady = false;
    client.isOpen = false;
    client.connect.mockResolvedValue(undefined);
    client.get.mockResolvedValue('value');
    client.set.mockResolvedValue('OK');
    client.del.mockResolvedValue(1);
    jest.mocked(createClient).mockReturnValue(client as never);
    cache = new RedisCacheService(config as unknown as ConfigService);
  });

  it('creates one client with bounded connection attempts and reuses it', async () => {
    expect(createClient).toHaveBeenCalledWith({
      url: 'redis://localhost:6379',
      socket: { connectTimeout: 1000, reconnectStrategy: false },
      disableOfflineQueue: true,
    });
    await cache.get('key');
    client.isReady = true;
    await cache.set('key', 'value', 42);
    await cache.del('key');
    expect(client.connect).toHaveBeenCalledTimes(1);
    expect(client.set).toHaveBeenCalledWith('key', 'value', { EX: 42 });
    expect(client.del).toHaveBeenCalledWith('key');
  });

  it('does not break reads or writes when connection fails', async () => {
    client.connect.mockRejectedValue(new Error('refused'));
    expect(await cache.get('key')).toBeNull();
    await expect(cache.set('key', 'value', 42)).resolves.toBeUndefined();
    await expect(cache.del('key')).resolves.toBeUndefined();
    expect(client.get).not.toHaveBeenCalled();
  });

  it('disables caching without a Redis URL', async () => {
    config.get.mockReturnValueOnce(undefined);
    const disabled = new RedisCacheService(config as unknown as ConfigService);
    expect(await disabled.get('key')).toBeNull();
    await expect(disabled.set('key', 'value', 42)).resolves.toBeUndefined();
    expect(createClient).toHaveBeenCalledTimes(1);
  });

  it('does not break reads or writes when Redis commands fail', async () => {
    client.get.mockRejectedValue(new Error('lost connection'));
    client.set.mockRejectedValue(new Error('lost connection'));
    client.del.mockRejectedValue(new Error('lost connection'));
    expect(await cache.get('key')).toBeNull();
    await expect(cache.set('key', 'value', 42)).resolves.toBeUndefined();
    await expect(cache.del('key')).resolves.toBeUndefined();
  });
});
