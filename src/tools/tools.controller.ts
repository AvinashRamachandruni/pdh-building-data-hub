// pdh.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { ToolsService } from './tools.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('WILSON-Tools')
@Controller('tools')
export class ToolsController {
  constructor(private readonly service: ToolsService) {}

  @Post('create')
  createCollection(@Body('name') name: string) {
    return this.service.createCollection(name);
  }

  @Post(':name/document')
  insertDocument(@Param('name') name: string, @Body() body: any) {
    return this.service.insertDocument(name, body);
  }

  @Get(':name/all')
  fetchAll(@Param('name') name: string) {
    return this.service.fetchAll(name);
  }

  @Get(':name/latest')
  fetchLatest(@Param('name') name: string) {
    return this.service.fetchLatest(name);
  }
}
