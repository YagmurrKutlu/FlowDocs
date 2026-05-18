import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedUser } from '../auth/interfaces/authenticated-user.interface';
import { ListSharedByMeQueryDto } from './dto/list-shared-by-me-query.dto';
import { ListSharedWithMeQueryDto } from './dto/list-shared-with-me-query.dto';
import { SharedService } from './shared.service';

@Controller('shared')
@UseGuards(JwtAuthGuard)
export class SharedController {
  constructor(private readonly sharedService: SharedService) {}

  @Get('summary')
  getSummary(@CurrentUser() user: AuthenticatedUser) {
    return this.sharedService.getSummary(user.id);
  }

  @Get('with-me')
  listWithMe(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSharedWithMeQueryDto,
  ) {
    return this.sharedService.listWithMe(user.id, query);
  }

  @Get('by-me')
  listByMe(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListSharedByMeQueryDto,
  ) {
    return this.sharedService.listByMe(user.id, query);
  }

  @Delete('with-me/:documentId')
  leaveWithMe(
    @CurrentUser() user: AuthenticatedUser,
    @Param('documentId') documentId: string,
  ) {
    return this.sharedService.leaveWithMe(user.id, documentId);
  }
}
