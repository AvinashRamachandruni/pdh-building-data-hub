import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { HttpSourceAdapterService } from './adapters/http-source-adapter.service';
import { WeatherCurrentDto } from './entities/external-source.entity';

/**
 * Domain-facing example endpoint demonstrating the external HTTP API
 * adapter pattern. Consumers only see this stable PDH route/DTO; they never
 * know the real provider URL, authentication method, or native response
 * structure - all of that lives in HttpSourceAdapterService + configuration.
 */
@ApiTags('External Sources')
@Controller('external/weather')
export class WeatherController {
  constructor(private readonly httpSourceAdapter: HttpSourceAdapterService) {}

  @Get('current')
  @ApiOperation({
    summary:
      'Get current weather conditions via a preconfigured external weather API (example of the generic HTTP source adapter pattern)',
  })
  @ApiQuery({
    name: 'lat',
    required: true,
    description: 'Latitude',
    example: '52.37',
  })
  @ApiQuery({
    name: 'lon',
    required: true,
    description: 'Longitude',
    example: '4.90',
  })
  @ApiOkResponse({ type: WeatherCurrentDto })
  async getCurrentWeather(
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
  ): Promise<WeatherCurrentDto> {
    const latitude = Number(lat);
    const longitude = Number(lon);
    if (
      lat === undefined ||
      lon === undefined ||
      lat.trim() === '' ||
      lon.trim() === '' ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude) ||
      latitude < -90 ||
      latitude > 90 ||
      longitude < -180 ||
      longitude > 180
    ) {
      throw new BadRequestException(
        'Valid lat (-90 to 90) and lon (-180 to 180) query parameters are required',
      );
    }

    const data = await this.httpSourceAdapter.invoke(
      'weather',
      'current',
      {
        latitude: String(latitude),
        longitude: String(longitude),
        current:
          'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m',
        timezone: 'auto',
      },
    );

    return {
      source: 'weather',
      requestedAt: new Date().toISOString(),
      data,
    };
  }
}
