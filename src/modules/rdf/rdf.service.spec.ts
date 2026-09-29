import axios from 'axios';
import { ConfigService } from '@nestjs/config';
import { RedisCacheService } from '../cache/redis-cache.service';
import { RdfService } from './rdf.service';

describe('RdfService entity cache', () => {
  const config = {
    get: jest.fn(
      (name: string) =>
        ({
          RDF_SERVER: 'http://graphdb:7200/repositories/building',
          REDIS_ENTITY_TTL_SECONDS: '42',
        })[name],
    ),
  };
  const cache = {
    get: jest.fn<Promise<string | null>, [string]>(),
    set: jest.fn<Promise<void>, [string, string, number]>(),
    del: jest.fn<Promise<void>, [string]>(),
  };
  const bindings = {
    head: { vars: [] },
    results: {
      bindings: [
        {
          entity: { type: 'uri', value: 'http://example.org/room' },
          name: { type: 'literal', value: 'Room' },
        },
      ],
    },
  };
  let service: RdfService;
  let post: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    cache.get.mockResolvedValue(null);
    cache.set.mockResolvedValue(undefined);
    cache.del.mockResolvedValue(undefined);
    post = jest.spyOn(axios, 'post').mockResolvedValue({ data: bindings });
    service = new RdfService(
      config as unknown as ConfigService,
      cache as unknown as RedisCacheService,
    );
  });

  afterEach(() => post.mockRestore());

  it('fetches on a miss, stores a successful result with configured expiry, then hits cache', async () => {
    const first = await service.getEntityById('room-1');
    expect(first?.name).toBe('Room');
    expect(first?.global_id).toBeUndefined();
    expect(cache.set).toHaveBeenCalledWith(
      expect.stringMatching(/^pdh:rdf:entity:v1:[a-f0-9]{64}$/),
      JSON.stringify(first),
      42,
    );
    cache.get.mockResolvedValueOnce(JSON.stringify(first));
    const second = await service.getEntityById('room-1');
    expect(second).toEqual(first);
    expect(second?.created_at).toBeInstanceOf(Date);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('includes repository and complete ID in the key', async () => {
    await service.getEntityById('room-1');
    const key = cache.get.mock.calls[0][0];
    await service.getEntityById('room-2');
    expect(cache.get.mock.calls[1][0]).not.toBe(key);
    config.get.mockImplementationOnce((name: string) =>
      name === 'RDF_SERVER'
        ? 'http://graphdb:7200/repositories/other'
        : undefined,
    );
    const other = new RdfService(
      config as unknown as ConfigService,
      cache as unknown as RedisCacheService,
    );
    await other.getEntityById('room-1');
    expect(cache.get.mock.calls[2][0]).not.toBe(key);
  });

  it('does not cache missing entities or failed upstream reads', async () => {
    post.mockResolvedValueOnce({
      data: { head: { vars: [] }, results: { bindings: [] } },
    });
    expect(await service.getEntityById('missing')).toBeNull();
    post.mockRejectedValueOnce(new Error('GraphDB unavailable'));
    await expect(service.getEntityById('room-1')).rejects.toThrow(
      'Failed to execute SPARQL query: GraphDB unavailable',
    );
    expect(cache.set).not.toHaveBeenCalled();
  });

  it('invalidates a corrupt entry and retrieves a fresh result', async () => {
    cache.get.mockResolvedValueOnce('{not-json');
    expect((await service.getEntityById('room-1'))?.name).toBe('Room');
    expect(cache.del).toHaveBeenCalledWith(cache.get.mock.calls[0][0]);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('falls back to GraphDB if Redis is unavailable', async () => {
    cache.get.mockResolvedValueOnce(null);
    expect((await service.getEntityById('room-1'))?.name).toBe('Room');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid TTL configuration', () => {
    config.get.mockImplementationOnce((name: string) =>
      name === 'RDF_SERVER'
        ? 'http://graphdb:7200/repositories/building'
        : undefined,
    );
    config.get.mockImplementationOnce(() => '0');
    expect(
      () =>
        new RdfService(
          config as unknown as ConfigService,
          cache as unknown as RedisCacheService,
        ),
    ).toThrow('REDIS_ENTITY_TTL_SECONDS must be a positive integer');
  });
});
