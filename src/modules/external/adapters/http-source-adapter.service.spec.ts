import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  InternalServerErrorException,
  NotFoundException,
  RequestTimeoutException,
} from '@nestjs/common';
import axios from 'axios';
import { HttpSourceAdapterService } from './http-source-adapter.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const ENV: Record<string, string> = {
  WEATHER_API_BASE_URL: 'https://weather.example.com',
  WEATHER_API_TIMEOUT_MS: '2000',
  WEATHER_API_AUTH_TYPE: 'apiKey',
  WEATHER_API_KEY_HEADER: 'x-api-key',
  WEATHER_API_KEY: 'super-secret-key',
};

function buildConfigService(
  overrides: Record<string, string | undefined> = {},
) {
  const values = { ...ENV, ...overrides };
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('HttpSourceAdapterService', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('invokes a configured operation and injects the api key header without leaking it', async () => {
    mockedAxios.request.mockResolvedValue({ data: { temp: 21 } });

    const moduleRef = await Test.createTestingModule({
      providers: [
        HttpSourceAdapterService,
        { provide: ConfigService, useValue: buildConfigService() },
      ],
    }).compile();
    const service = moduleRef.get(HttpSourceAdapterService);

    const result = await service.invoke('weather', 'current', {
      lat: '1',
      lon: '2',
    });

    expect(result).toEqual({ temp: 21 });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockedAxios.request).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: 'https://weather.example.com/current',
        params: { lat: '1', lon: '2' },
        headers: { 'x-api-key': 'super-secret-key' },
        timeout: 2000,
      }),
    );
  });

  it('rejects an unconfigured/unknown source', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HttpSourceAdapterService,
        { provide: ConfigService, useValue: buildConfigService() },
      ],
    }).compile();
    const service = moduleRef.get(HttpSourceAdapterService);

    await expect(service.invoke('erp', 'listOrders', {})).rejects.toThrow(
      NotFoundException,
    );
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('rejects an unconfigured operation for a known source', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HttpSourceAdapterService,
        { provide: ConfigService, useValue: buildConfigService() },
      ],
    }).compile();
    const service = moduleRef.get(HttpSourceAdapterService);

    await expect(
      service.invoke('weather', 'forecast-week', {}),
    ).rejects.toThrow(NotFoundException);
  });

  it('translates a timeout into RequestTimeoutException', async () => {
    mockedAxios.request.mockRejectedValue({ code: 'ECONNABORTED' });

    const moduleRef = await Test.createTestingModule({
      providers: [
        HttpSourceAdapterService,
        { provide: ConfigService, useValue: buildConfigService() },
      ],
    }).compile();
    const service = moduleRef.get(HttpSourceAdapterService);

    await expect(service.invoke('weather', 'current', {})).rejects.toThrow(
      RequestTimeoutException,
    );
  });

  it('translates an upstream error response into ServiceUnavailableException without leaking the body', async () => {
    mockedAxios.request.mockRejectedValue({
      response: { status: 500, data: { secret: 'do-not-leak' } },
    });

    const moduleRef = await Test.createTestingModule({
      providers: [
        HttpSourceAdapterService,
        { provide: ConfigService, useValue: buildConfigService() },
      ],
    }).compile();
    const service = moduleRef.get(HttpSourceAdapterService);

    await expect(
      service.invoke('weather', 'current', {}),
    ).rejects.toMatchObject({
      message: expect.not.stringContaining('do-not-leak'),
    });
  });

  it('throws a generic error when credentials are missing, without naming the env var', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HttpSourceAdapterService,
        {
          provide: ConfigService,
          useValue: buildConfigService({ WEATHER_API_KEY: undefined }),
        },
      ],
    }).compile();
    const service = moduleRef.get(HttpSourceAdapterService);

    await expect(service.invoke('weather', 'current', {})).rejects.toThrow(
      InternalServerErrorException,
    );
    await expect(
      service.invoke('weather', 'current', {}),
    ).rejects.toMatchObject({
      message: expect.not.stringContaining('WEATHER_API_KEY'),
    });
    // eslint-disable-next-line @typescript-eslint/unbound-method
    expect(mockedAxios.request).not.toHaveBeenCalled();
  });

  it('reports unreachable status when the health check fails', async () => {
    mockedAxios.get.mockRejectedValue(new Error('network error'));

    const moduleRef = await Test.createTestingModule({
      providers: [
        HttpSourceAdapterService,
        { provide: ConfigService, useValue: buildConfigService() },
      ],
    }).compile();
    const service = moduleRef.get(HttpSourceAdapterService);

    const status = await service.healthCheck('weather');
    expect(status).toEqual({ source: 'weather', status: 'unreachable' });
  });

  it('reports unconfigured status for an unknown source', async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        HttpSourceAdapterService,
        { provide: ConfigService, useValue: buildConfigService() },
      ],
    }).compile();
    const service = moduleRef.get(HttpSourceAdapterService);

    const status = await service.healthCheck('gis');
    expect(status).toEqual({ source: 'gis', status: 'unconfigured' });
  });
});
