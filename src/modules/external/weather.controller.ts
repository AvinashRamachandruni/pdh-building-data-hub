import { Controller, Get, Query } from '@nestjs/common';
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
    required: false,
    description: 'Latitude',
    example: '52.37',
  })
  @ApiQuery({
    name: 'lon',
    required: false,
    description: 'Longitude',
    example: '4.90',
  })
  @ApiOkResponse({ type: WeatherCurrentDto })
  async getCurrentWeather(
    @Query('lat') lat?: string,
    @Query('lon') lon?: string,
  ): Promise<WeatherCurrentDto> {
    const params: Record<string, string> = {};
    if (lat) params.lat = lat;
    if (lon) params.lon = lon;

    const data = await this.httpSourceAdapter.invoke(
      'weather',
      'current',
      params,
    );

    return {
      source: 'weather',
      requestedAt: new Date().toISOString(),
      data,
    };
  }
}
