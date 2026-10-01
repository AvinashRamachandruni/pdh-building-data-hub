import { BadRequestException } from '@nestjs/common';
import { HttpSourceAdapterService } from './adapters/http-source-adapter.service';
import { WeatherController } from './weather.controller';

describe('WeatherController', () => {
  it('maps coordinates to the Open-Meteo current-weather request', async () => {
    const invoke = jest.fn().mockResolvedValue({ temperature_2m: 18 });
    const controller = new WeatherController(
      { invoke } as unknown as HttpSourceAdapterService,
    );

    const result = await controller.getCurrentWeather('52.37', '4.90');

    expect(invoke).toHaveBeenCalledWith('weather', 'current', {
      latitude: '52.37',
      longitude: '4.9',
      current:
        'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
      timezone: 'auto',
    });
    expect(result.data).toEqual({ temperature_2m: 18 });
  });

  it.each([
    [undefined, '4.90'],
    ['52.37', undefined],
    ['', '4.90'],
    ['invalid', '4.90'],
    ['91', '4.90'],
    ['52.37', '181'],
  ])('rejects invalid coordinates (%s, %s)', async (lat, lon) => {
    const invoke = jest.fn();
    const controller = new WeatherController({ invoke } as unknown as HttpSourceAdapterService);

    await expect(
      controller.getCurrentWeather(lat, lon),
    ).rejects.toThrow(BadRequestException);
    expect(invoke).not.toHaveBeenCalled();
  });
});