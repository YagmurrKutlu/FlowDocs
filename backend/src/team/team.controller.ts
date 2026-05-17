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
import { CreateTeamWorkspaceDto } from './dto/create-team-workspace.dto';
import { CreateWorkspaceInviteDto } from './dto/create-workspace-invite.dto';
import { UpdateWorkspaceMemberRoleDto } from './dto/update-workspace-member-role.dto';
import { TeamService } from './team.service';

@Controller('team')
@UseGuards(JwtAuthGuard)
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: AuthenticatedUser) {
    return this.teamService.getOverview(user.id);
  }

  @Post('workspaces')
  createWorkspace(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CreateTeamWorkspaceDto,
  ) {
    return this.teamService.createWorkspace(user.id, body);
  }

  @Get('workspaces/:workspaceId/members')
  listMembers(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.teamService.listMembers(user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/documents')
  listDocuments(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.teamService.listDocuments(user.id, workspaceId);
  }

  @Get('workspaces/:workspaceId/invites')
  listInvites(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.teamService.listInvites(user.id, workspaceId);
  }

  @Post('workspaces/:workspaceId/invites')
  createInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Body() body: CreateWorkspaceInviteDto,
  ) {
    return this.teamService.createInvite(user.id, workspaceId, body);
  }

  @Post('workspaces/:workspaceId/invites/:inviteId/accept-demo')
  acceptInviteDemo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.teamService.acceptInviteDemo(user.id, workspaceId, inviteId);
  }

  @Delete('workspaces/:workspaceId/invites/:inviteId')
  cancelInvite(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('inviteId') inviteId: string,
  ) {
    return this.teamService.cancelInvite(user.id, workspaceId, inviteId);
  }

  @Patch('workspaces/:workspaceId/members/:memberId/role')
  updateMemberRole(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
    @Body() body: UpdateWorkspaceMemberRoleDto,
  ) {
    return this.teamService.updateMemberRole(
      user.id,
      workspaceId,
      memberId,
      body,
    );
  }

  @Delete('workspaces/:workspaceId/members/:memberId')
  removeMember(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.teamService.removeMember(user.id, workspaceId, memberId);
  }

  @Get('workspaces/:workspaceId/activity')
  getActivity(
    @CurrentUser() user: AuthenticatedUser,
    @Param('workspaceId') workspaceId: string,
  ) {
    return this.teamService.getActivity(user.id, workspaceId);
  }
}
