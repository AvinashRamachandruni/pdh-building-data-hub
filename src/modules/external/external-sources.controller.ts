import { Controller, Get, Param } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { HttpSourceAdapterService } from './adapters/http-source-adapter.service';
import { ExternalSourceStatusDto } from './entities/external-source.entity';

/**
 * Simple health/status mechanism for the configured external HTTP sources.
 * Only exposes source names and reachability - never base URLs or secrets.
 */
@ApiTags('External Sources')
@Controller('external/sources')
export class ExternalSourcesController {
  constructor(private readonly httpSourceAdapter: HttpSourceAdapterService) {}

  @Get('status')
  @ApiOperation({
    summary: 'Get reachability status of all configured external sources',
  })
  @ApiOkResponse({ type: ExternalSourceStatusDto, isArray: true })
  async getAllStatuses(): Promise<ExternalSourceStatusDto[]> {
    const names = this.httpSourceAdapter.listSourceNames();
    return Promise.all(
      names.map((name) => this.httpSourceAdapter.healthCheck(name)),
    );
  }

  @Get(':name/status')
  @ApiOperation({
    summary: 'Get reachability status of a specific configured external source',
  })
  @ApiParam({
    name: 'name',
    description: 'Configured source name',
    example: 'weather',
  })
  @ApiOkResponse({ type: ExternalSourceStatusDto })
  async getStatus(
    @Param('name') name: string,
  ): Promise<ExternalSourceStatusDto> {
    return this.httpSourceAdapter.healthCheck(name);
  }
}
