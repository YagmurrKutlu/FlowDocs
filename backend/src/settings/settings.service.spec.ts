import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from './settings.service';
import { DEFAULT_USER_SETTINGS } from './settings.types';

describe('SettingsService', () => {
  let service: SettingsService;

  const prismaMock = {
    userProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(SettingsService);
  });

  it('returns default settings when profile has no stored settings', async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: 'user-1',
      settings: null,
      notificationSettings: null,
    });

    const result = await service.getMySettings('user-1');

    expect(result).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('returns defaults when settings JSON is an array (invalid shape)', async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: 'user-1',
      settings: ['bad'],
      notificationSettings: null,
    });

    const result = await service.getMySettings('user-1');

    expect(result).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('returns defaults when prisma throws on load', async () => {
    prismaMock.userProfile.findUnique.mockRejectedValue(
      new Error('column UserProfile.settings does not exist'),
    );

    const result = await service.getMySettings('user-1');

    expect(result).toEqual(DEFAULT_USER_SETTINGS);
  });

  it('merges partial editorPreferences on patch', async () => {
    prismaMock.userProfile.findUnique
      .mockResolvedValueOnce({
        userId: 'user-1',
        settings: { editorPreferences: { compactToolbar: true } },
        notificationSettings: null,
      })
      .mockResolvedValueOnce({
        userId: 'user-1',
        settings: {
          editorPreferences: {
            compactToolbar: true,
            autosaveInterval: '15s',
          },
        },
        notificationSettings: null,
      });
    prismaMock.userProfile.update.mockResolvedValue({});

    const result = await service.updateMySettings('user-1', {
      editorPreferences: { autosaveInterval: '15s' },
    });

    expect(prismaMock.userProfile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: expect.objectContaining({
        settings: expect.objectContaining({
          editorPreferences: expect.objectContaining({
            compactToolbar: true,
            autosaveInterval: '15s',
          }),
        }),
      }),
    });
    expect(result.editorPreferences.autosaveInterval).toBe('15s');
    expect(result.editorPreferences.compactToolbar).toBe(true);
  });

  it('maps notificationPreferences to notificationSettings column', async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: 'user-1',
      settings: null,
      notificationSettings: {
        commentNotifications: true,
        editNotifications: false,
        userJoinedNotifications: true,
        emailSummary: false,
      },
    });
    prismaMock.userProfile.update.mockResolvedValue({});

    await service.updateMySettings('user-1', {
      notificationPreferences: { comments: false, browserNotifications: true },
    });

    expect(prismaMock.userProfile.update).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      data: {
        notificationSettings: expect.objectContaining({
          commentNotifications: false,
          browserNotifications: true,
        }),
      },
    });
  });

  it('reads notificationPreferences from legacy notificationSettings keys', async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: 'user-1',
      settings: null,
      notificationSettings: {
        commentNotifications: false,
        editNotifications: true,
        userJoinedNotifications: false,
        emailSummary: true,
      },
    });

    const result = await service.getMySettings('user-1');

    expect(result.notificationPreferences).toMatchObject({
      comments: false,
      shares: true,
      workspaceInvites: false,
      emailDigest: true,
    });
  });

  it('ignores null boolean overrides in stored collaboration preferences', async () => {
    prismaMock.userProfile.findUnique.mockResolvedValue({
      userId: 'user-1',
      settings: {
        collaborationPreferences: { showPresence: null },
      },
      notificationSettings: null,
    });

    const result = await service.getMySettings('user-1');

    expect(result.collaborationPreferences.showPresence).toBe(true);
  });
});
