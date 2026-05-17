import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamService } from './team.service';

describe('TeamService', () => {
  let service: TeamService;

  const prismaMock = {
    workspace: { findUnique: jest.fn(), create: jest.fn() },
    $transaction: jest.fn(),
    workspaceMember: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      groupBy: jest.fn(),
    },
    workspaceInvite: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    document: { findMany: jest.fn(), groupBy: jest.fn() },
    user: { findFirst: jest.fn(), findUnique: jest.fn() },
    activityLog: { findMany: jest.fn(), create: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(TeamService);
  });

  it('creates workspace and assigns owner', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue(null);
    prismaMock.workspace.findUnique.mockResolvedValue(null);
    prismaMock.$transaction.mockImplementation(async (fn) =>
      fn({
        workspace: {
          create: jest.fn().mockResolvedValue({
            id: 'ws-new',
            name: 'Demo Takımı',
            updatedAt: new Date('2026-01-02'),
            _count: { members: 1, documents: 0 },
          }),
        },
        activityLog: { create: jest.fn().mockResolvedValue({}) },
      }),
    );

    const result = await service.createWorkspace('user-1', {
      name: 'Demo Takımı',
    });

    expect(result.workspace.id).toBe('ws-new');
    expect(result.workspace.role).toBe(WorkspaceRole.OWNER);
    expect(result.workspace.memberCount).toBe(1);
  });

  it('blocks duplicate workspace name for same user', async () => {
    prismaMock.workspaceMember.findFirst.mockResolvedValue({ id: 'm1' });

    await expect(
      service.createWorkspace('user-1', { name: 'Demo Takımı' }),
    ).rejects.toThrow('Bu isimde bir çalışma alanınız zaten var.');
  });

  it('returns overview for member workspaces', async () => {
    prismaMock.workspaceMember.findMany.mockResolvedValue([
      {
        role: WorkspaceRole.OWNER,
        workspace: {
          id: 'ws-1',
          name: 'Acme',
          updatedAt: new Date('2026-01-01'),
          _count: { members: 2, documents: 3 },
        },
      },
    ]);
    prismaMock.workspaceMember.groupBy.mockResolvedValue([
      { workspaceId: 'ws-1', _count: { _all: 2 } },
    ]);
    prismaMock.document.groupBy.mockResolvedValue([
      { workspaceId: 'ws-1', _count: { _all: 3 } },
    ]);

    const result = await service.getOverview('user-1');

    expect(result.workspaces).toHaveLength(1);
    expect(result.currentWorkspace?.id).toBe('ws-1');
    expect(result.stats.totalWorkspaces).toBe(1);
    expect(result.stats.activeCollaborators).toBeNull();
  });

  it('forbids invite creation for non-owner', async () => {
    prismaMock.workspace.findUnique.mockResolvedValue({ id: 'ws-1' });
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.EDITOR,
    });

    await expect(
      service.createInvite('user-1', 'ws-1', {
        email: 'a@b.com',
        role: WorkspaceRole.EDITOR,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('creates pending invite for owner', async () => {
    prismaMock.workspace.findUnique.mockResolvedValue({ id: 'ws-1' });
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
    });
    prismaMock.user.findUnique.mockResolvedValue({
      email: 'owner@b.com',
    });
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.workspaceInvite.findFirst.mockResolvedValue(null);
    prismaMock.workspaceInvite.create.mockResolvedValue({
      id: 'inv-1',
      email: 'a@b.com',
      role: WorkspaceRole.EDITOR,
      status: 'PENDING',
      createdAt: new Date(),
    });
    prismaMock.activityLog.create.mockResolvedValue({});

    const result = await service.createInvite('user-1', 'ws-1', {
      email: 'a@b.com',
      role: WorkspaceRole.EDITOR,
    });

    expect(result.invite.id).toBe('inv-1');
  });

  it('blocks invite when email is already a workspace member', async () => {
    prismaMock.workspace.findUnique.mockResolvedValue({ id: 'ws-1' });
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
    });
    prismaMock.user.findUnique.mockResolvedValue({ email: 'owner@b.com' });
    prismaMock.user.findFirst.mockResolvedValue({ id: 'user-2' });

    await expect(
      service.createInvite('user-1', 'ws-1', {
        email: 'member@b.com',
        role: WorkspaceRole.VIEWER,
      }),
    ).rejects.toThrow('Bu kullanıcı zaten bu çalışma alanının üyesi.');
  });

  it('blocks self-invite', async () => {
    prismaMock.workspace.findUnique.mockResolvedValue({ id: 'ws-1' });
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
    });
    prismaMock.user.findUnique.mockResolvedValue({ email: 'owner@b.com' });

    await expect(
      service.createInvite('user-1', 'ws-1', {
        email: 'owner@b.com',
        role: WorkspaceRole.EDITOR,
      }),
    ).rejects.toThrow('Kendinizi tekrar davet edemezsiniz.');
  });

  it('accepts pending invite as member when user exists (demo)', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    prismaMock.workspace.findUnique.mockResolvedValue({ id: 'ws-1' });
    prismaMock.workspaceMember.findUnique
      .mockResolvedValueOnce({ role: WorkspaceRole.OWNER })
      .mockResolvedValueOnce(null);
    prismaMock.workspaceInvite.findFirst.mockResolvedValue({
      id: 'inv-1',
      workspaceId: 'ws-1',
      email: 'member@b.com',
      role: WorkspaceRole.EDITOR,
      status: 'PENDING',
    });
    prismaMock.user.findFirst.mockResolvedValue({
      id: 'user-2',
      fullName: 'Member',
      email: 'member@b.com',
    });
    prismaMock.$transaction.mockImplementation(async (fn) =>
      fn({
        workspaceMember: {
          create: jest.fn().mockResolvedValue({
            id: 'm-new',
            userId: 'user-2',
            role: WorkspaceRole.EDITOR,
            createdAt: new Date(),
            user: {
              fullName: 'Member',
              email: 'member@b.com',
              sessions: [],
            },
          }),
        },
        workspaceInvite: {
          update: jest.fn().mockResolvedValue({
            id: 'inv-1',
            email: 'member@b.com',
            role: WorkspaceRole.EDITOR,
            status: 'ACCEPTED',
            createdAt: new Date(),
            acceptedAt: new Date(),
          }),
        },
        activityLog: { create: jest.fn().mockResolvedValue({}) },
      }),
    );

    const result = await service.acceptInviteDemo('user-1', 'ws-1', 'inv-1');

    expect(result.member.userId).toBe('user-2');
    expect(result.invite.status).toBe('ACCEPTED');

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('rejects demo accept when user email is not registered', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    prismaMock.workspace.findUnique.mockResolvedValue({ id: 'ws-1' });
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
    });
    prismaMock.workspaceInvite.findFirst.mockResolvedValue({
      id: 'inv-1',
      workspaceId: 'ws-1',
      email: 'ghost@b.com',
      role: WorkspaceRole.VIEWER,
      status: 'PENDING',
    });
    prismaMock.user.findFirst.mockResolvedValue(null);

    await expect(
      service.acceptInviteDemo('user-1', 'ws-1', 'inv-1'),
    ).rejects.toThrow('Bu e-postaya ait kayıtlı kullanıcı bulunamadı.');

    process.env.NODE_ENV = originalNodeEnv;
  });

  it('blocks duplicate pending invite', async () => {
    prismaMock.workspace.findUnique.mockResolvedValue({ id: 'ws-1' });
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
    });
    prismaMock.user.findUnique.mockResolvedValue({ email: 'owner@b.com' });
    prismaMock.user.findFirst.mockResolvedValue(null);
    prismaMock.workspaceInvite.findFirst.mockResolvedValue({ id: 'inv-existing' });

    await expect(
      service.createInvite('user-1', 'ws-1', {
        email: 'a@b.com',
        role: WorkspaceRole.VIEWER,
      }),
    ).rejects.toThrow('Bu e-posta için bekleyen bir davet zaten var.');
  });

  it('prevents demoting the last owner', async () => {
    prismaMock.workspace.findUnique.mockResolvedValue({ id: 'ws-1' });
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
    });
    prismaMock.workspaceMember.findFirst.mockResolvedValue({
      id: 'mem-1',
      userId: 'owner-2',
      role: WorkspaceRole.OWNER,
    });
    prismaMock.workspaceMember.count.mockResolvedValue(1);

    await expect(
      service.updateMemberRole('user-1', 'ws-1', 'mem-1', {
        role: WorkspaceRole.EDITOR,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('prevents removing the last owner', async () => {
    prismaMock.workspace.findUnique.mockResolvedValue({ id: 'ws-1' });
    prismaMock.workspaceMember.findUnique.mockResolvedValue({
      role: WorkspaceRole.OWNER,
    });
    prismaMock.workspaceMember.findFirst.mockResolvedValue({
      id: 'mem-1',
      userId: 'owner-2',
      role: WorkspaceRole.OWNER,
    });
    prismaMock.workspaceMember.count.mockResolvedValue(1);

    await expect(
      service.removeMember('user-1', 'ws-1', 'mem-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws 404 when workspace missing for member assert', async () => {
    prismaMock.workspace.findUnique.mockResolvedValue(null);

    await expect(
      service.assertWorkspaceMember('user-1', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
