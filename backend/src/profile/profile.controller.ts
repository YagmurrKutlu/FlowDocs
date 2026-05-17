import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { UpdateAppearanceDto } from './dto/update-appearance.dto';
import { UpdateNotificationsDto } from './dto/update-notifications.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ProfileService } from './profile.service';

@Controller('profile')
@UseGuards(JwtAuthGuard)
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get('me')
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.getMyProfile(user.id, user.sessionId);
  }

  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateProfileDto,
  ) {
    return this.profileService.updateProfile(user.id, user.sessionId, payload);
  }

  @Patch('notifications')
  updateNotifications(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateNotificationsDto,
  ) {
    return this.profileService.updateNotifications(user.id, payload);
  }

  @Patch('appearance')
  updateAppearance(
    @CurrentUser() user: AuthenticatedUser,
    @Body() payload: UpdateAppearanceDto,
  ) {
    return this.profileService.updateAppearance(user.id, payload);
  }

  @Delete('sessions/:sessionId')
  revokeSession(
    @CurrentUser() user: AuthenticatedUser,
    @Param('sessionId') sessionId: string,
  ) {
    return this.profileService.revokeSession(
      user.id,
      user.sessionId,
      sessionId,
    );
  }

  @Post('sessions/revoke-all')
  revokeAllSessions(@CurrentUser() user: AuthenticatedUser) {
    return this.profileService.revokeAllOtherSessions(user.id, user.sessionId);
  }
}
