import { Controller, Post, Body, Get } from '@nestjs/common';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Post()
  async create(@Body() createLeadDto: any) {
    return this.leadsService.create(createLeadDto);
  }

  @Get()
  async findAll() {
    return this.leadsService.findAll();
  }
}
