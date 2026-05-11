import { Controller, Get } from '@nestjs/common';
import { RealtimeService } from './realtime.service';

@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Get('status')
  status() {
    return this.realtimeService.getStatus();
  }
}
