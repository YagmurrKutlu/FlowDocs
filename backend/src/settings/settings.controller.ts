import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { SettingsService } from './settings.service';

@Controller('settings')
@UseGuards(JwtAuthGuard)
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('me')
  getMySettings(@CurrentUser() user: AuthenticatedUser) {
    return this.settingsService.getMySettings(user.id);
  }

  @Patch('me')
  updateMySettings(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateSettingsDto,
  ) {
    return this.settingsService.updateMySettings(user.id, payload);
  }
}
