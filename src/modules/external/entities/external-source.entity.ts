import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Stable PDH-facing shape for the example weather external source. This
 * hides the real provider's response structure, authentication method and
 * base URL from consumers.
 */
export class WeatherCurrentDto {
  @ApiProperty({
    description: 'Identifier of the external source that served this data',
  })
  source: string;

  @ApiProperty({
    description: 'Timestamp (ISO 8601) at which the PDH requested the data',
  })
  requestedAt: string;

  @ApiPropertyOptional({
    description:
      'Best-effort passthrough of the upstream payload. Kept generic since this is a ' +
      'demonstration source; a production adapter would map this into stable fields.',
  })
  data?: unknown;
}

export class ExternalSourceStatusDto {
  @ApiProperty({ description: 'Configured source name', example: 'weather' })
  source: string;

  @ApiProperty({
    description: 'Reachability status of the source',
    enum: ['ok', 'unreachable', 'unconfigured'],
  })
  status: 'ok' | 'unreachable' | 'unconfigured';
}

export class ExternalSourceErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode: number;

  @ApiProperty({ example: "Unknown or unconfigured external source 'weather'" })
  message: string;
}
