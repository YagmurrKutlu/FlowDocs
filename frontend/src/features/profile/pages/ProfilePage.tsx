import { Button, Select, Skeleton, Switch } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  IconBolt,
  IconDeviceLaptop,
  IconDeviceMobile,
  IconEdit,
  IconFileText,
  IconKey,
  IconLink,
  IconMessage,
  IconPencil,
  IconShare,
  IconShield,
  IconUpload,
  IconUserPlus,
} from '@tabler/icons-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ProfileEditModal } from '../components/ProfileEditModal';
import {
  useMyProfileQuery,
  useRevokeAllProfileSessionsMutation,
  useRevokeProfileSessionMutation,
  useUpdateProfileAppearanceMutation,
  useUpdateProfileMutation,
  useUpdateProfileNotificationsMutation,
} from '../hooks/useProfileQueries';
import type { ProfileActivity, ProfileSession } from '../types/profile.types';
import { formatStatNumber, initialsFromName, workspaceInitial } from '../utils/profileUtils';
import styles from './ProfilePage.module.css';

function showComingSoon(message: string) {
  notifications.show({
    color: 'blue',
    title: 'Yakında',
    message,
  });
}

function ActivityIcon({ type, color }: { type: string; color: string }) {
  const iconProps = { size: 18, color };
  switch (type) {
    case 'share':
      return <IconLink {...iconProps} />;
    case 'create':
      return <IconFileText {...iconProps} />;
    case 'upload':
      return <IconUpload {...iconProps} />;
    case 'invite':
      return <IconUserPlus {...iconProps} />;
    case 'comment':
      return <IconMessage {...iconProps} />;
    default:
      return <IconPencil {...iconProps} />;
  }
}

function isMobileSession(session: ProfileSession): boolean {
  return session.os === 'iOS' || session.os === 'Android';
}

function workspaceAvatarColor(name: string): string {
  const palette = ['#4F83FF', '#8B85D4', '#34D399', '#F59E0B', '#EC4899'];
  const code = name.charCodeAt(0) ?? 0;
  return palette[code % palette.length]!;
}

function ProfileCard({
  title,
  action,
  actionVariant = 'default',
  children,
}: {
  title: string;
  action?: {
    label: string;
    onClick: () => void;
    actionVariant?: 'default' | 'danger';
  };
  actionVariant?: 'default' | 'danger';
  children: React.ReactNode;
}) {
  return (
    <section className={`${styles.profileCard} ${styles.card}`}>
      <header className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>{title}</h2>
        {action ? (
          <button
            type="button"
            className={
              actionVariant === 'danger'
                ? `${styles.cardAction} ${styles.cardActionDanger}`
                : styles.cardAction
            }
            onClick={action.onClick}
          >
            {action.label}
          </button>
        ) : null}
      </header>
      <div className={styles.cardBody}>{children}</div>
    </section>
  );
}

export function ProfilePage() {
  const navigate = useNavigate();
  const [editOpen, setEditOpen] = useState(false);
  const profileQuery = useMyProfileQuery();
  const updateProfile = useUpdateProfileMutation();
  const updateNotifications = useUpdateProfileNotificationsMutation();
  const updateAppearance = useUpdateProfileAppearanceMutation();
  const revokeSession = useRevokeProfileSessionMutation();
  const revokeAllSessions = useRevokeAllProfileSessionsMutation();

  if (profileQuery.isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Skeleton className={`${styles.heroCard} ${styles.skeletonHero}`} />
          <div className={styles.mainGrid}>
            <Skeleton className={`${styles.profileCard} ${styles.skeletonCard}`} />
            <Skeleton className={`${styles.profileCard} ${styles.skeletonCard}`} />
          </div>
        </div>
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <p className={styles.emptyText}>Profil yüklenemedi. Lütfen sayfayı yenileyin.</p>
        </div>
      </div>
    );
  }

  const data = profileQuery.data;
  const { user, stats } = data;

  const defaultBio =
    user.bio ??
    'FlowDocs üzerinde gerçek zamanlı işbirliği ve doküman yönetimi ile çalışıyorum.';

  const defaultSkills =
    user.skills.length > 0
      ? user.skills
      : ['React', 'NestJS', 'WebSocket', 'CRDT / Yjs', 'PostgreSQL', 'MinIO', 'TypeScript'];

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Hero */}
        <section className={styles.heroCard}>
          <div className={styles.cover}>
            <div className={styles.coverGrid} aria-hidden />
            <Button
              size="xs"
              variant="default"
              className={`${styles.coverEditBtn} ${styles.glassBtn}`}
              leftSection={<IconEdit size={14} />}
              onClick={() =>
                showComingSoon('Kapak düzenleme yakında eklenecek.')
              }
            >
              Kapağı Düzenle
            </Button>
          </div>

          <div className={styles.heroBody}>
            <div className={styles.heroTopRow}>
              <div className={styles.avatarWrap}>
                <div
                  className={styles.avatar}
                  style={
                    user.avatarUrl
                      ? {
                          backgroundImage: `url(${user.avatarUrl})`,
                          backgroundSize: 'cover',
                        }
                      : undefined
                  }
                >
                  {!user.avatarUrl ? initialsFromName(user.displayName) : null}
                </div>
                <span className={styles.onlineDot} aria-label="Çevrimiçi" />
              </div>

              <div className={styles.heroActions}>
                <Button
                  className={styles.glassBtn}
                  variant="default"
                  leftSection={<IconPencil size={16} />}
                  onClick={() => setEditOpen(true)}
                >
                  Profili Düzenle
                </Button>
                <Button
                  className={styles.glassBtn}
                  variant="default"
                  leftSection={<IconShare size={16} />}
                  onClick={() =>
                    showComingSoon('Profil paylaşımı yakında eklenecek.')
                  }
                >
                  Paylaş
                </Button>
              </div>
            </div>

            <div className={styles.heroInfo}>
              <h1 className={styles.displayName}>{user.displayName}</h1>
              <div className={styles.metaRow}>
                <span className={styles.roleBadge}>
                  <IconBolt size={12} />
                  {user.role === 'admin' ? 'Admin' : 'User'}
                </span>
                <span>{user.email}</span>
                {user.location ? <span>· {user.location}</span> : null}
              </div>
              {user.title ? (
                <p className={styles.bio} style={{ marginBottom: 8, color: '#c8cce0' }}>
                  {user.title}
                </p>
              ) : null}
              <p className={styles.bio}>{defaultBio}</p>
              <div className={styles.skills}>
                {defaultSkills.map((skill) => (
                  <span key={skill} className={styles.skillChip}>
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div className={styles.statsRow}>
              <div className={styles.statItem}>
                <div className={styles.statValue}>
                  {formatStatNumber(stats.documentCount)}
                </div>
                <div className={styles.statLabel}>Doküman</div>
              </div>
              <div className={styles.statItem}>
                <div className={`${styles.statValue} ${styles.statValueGreen}`}>
                  {formatStatNumber(stats.syncCount)}
                </div>
                <div className={styles.statLabel}>Senkronizasyon</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>
                  {formatStatNumber(stats.workspaceCount)}
                </div>
                <div className={styles.statLabel}>Çalışma Alanı</div>
              </div>
              <div className={styles.statItem}>
                <div className={styles.statValue}>
                  {formatStatNumber(stats.collaborationCount)}
                </div>
                <div className={styles.statLabel}>İşbirliği</div>
              </div>
              <div className={styles.statItem}>
                <div className={`${styles.statValue} ${styles.statValueBlue}`}>
                  {formatStatNumber(stats.totalEdits)}
                </div>
                <div className={styles.statLabel}>Toplam Düzenleme</div>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.mainGrid}>
          {/* Left column */}
          <div className={styles.column}>
            <ProfileCard
              title="Son Aktiviteler"
              action={{
                label: 'Tümünü Gör',
                onClick: () => showComingSoon('Aktivite geçmişi yakında eklenecek.'),
              }}
            >
              {data.recentActivities.length === 0 ? (
                <p className={styles.emptyText}>Henüz aktivite yok.</p>
              ) : (
                <ul className={styles.activityList}>
                  {data.recentActivities.map((activity: ProfileActivity) => (
                    <li
                      key={activity.id}
                      className={styles.activityItem}
                      role={activity.documentId ? 'button' : undefined}
                      tabIndex={activity.documentId ? 0 : undefined}
                      onClick={() => {
                        if (activity.documentId) {
                          navigate(`/documents/${activity.documentId}`);
                        }
                      }}
                      onKeyDown={(event) => {
                        if (
                          activity.documentId &&
                          (event.key === 'Enter' || event.key === ' ')
                        ) {
                          navigate(`/documents/${activity.documentId}`);
                        }
                      }}
                    >
                      <div
                        className={styles.activityIcon}
                        style={{ background: `${activity.iconColor}22` }}
                      >
                        <ActivityIcon type={activity.icon} color={activity.iconColor} />
                      </div>
                      <div>
                        <p className={styles.activityTitle}>{activity.title}</p>
                        <span className={styles.activityTime}>{activity.timeLabel}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ProfileCard>

            <ProfileCard
              title="Dokümanlarım"
              action={{
                label: 'Tümünü Gör →',
                onClick: () => navigate('/documents'),
              }}
            >
              {data.documents.length === 0 ? (
                <p className={styles.emptyText}>Henüz doküman yok.</p>
              ) : (
                <ul className={styles.rowList}>
                  {data.documents.map((doc) => (
                    <li
                      key={doc.id}
                      className={styles.rowItem}
                      onClick={() => navigate(`/documents/${doc.id}`)}
                    >
                      <div className={styles.rowIcon}>
                        <IconFileText size={20} />
                      </div>
                      <div className={styles.rowMain}>
                        <p className={styles.rowTitle}>{doc.title}</p>
                        <p className={styles.rowSub}>
                          {doc.workspaceName} · {doc.memberCount} kullanıcı
                        </p>
                      </div>
                      <div className={styles.rowEnd}>
                        <div className={styles.rowTime}>{doc.timeLabel}</div>
                        {doc.status === 'live' ? (
                          <span className={styles.statusLive}>
                            <span className={styles.statusLiveDot} />
                            {doc.statusLabel}
                          </span>
                        ) : (
                          <span className={styles.statusOffline}>{doc.statusLabel}</span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </ProfileCard>

            <ProfileCard
              title="Güvenlik"
              action={{
                label: 'Ayarla',
                onClick: () => showComingSoon('Güvenlik ayarları yakında eklenecek.'),
              }}
            >
              <div className={styles.securityRow}>
                <div className={styles.rowIcon}>
                  <IconKey size={20} />
                </div>
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>{data.security.jwtAuth.label}</p>
                  <p className={styles.rowSub}>{data.security.jwtAuth.detail}</p>
                </div>
                <span className={`${styles.statusPill} ${styles.statusPillGreen}`}>
                  <span className={styles.statusLiveDot} />
                  Aktif
                </span>
              </div>
              <div className={styles.securityRow}>
                <div className={styles.rowIcon}>
                  <IconShield size={20} />
                </div>
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>{data.security.twoFactor.label}</p>
                  <p className={styles.rowSub}>{data.security.twoFactor.detail}</p>
                </div>
                <span className={`${styles.statusPill} ${styles.statusPillAmber}`}>
                  Kurulmadı
                </span>
              </div>
              <div className={styles.securityRow}>
                <div className={styles.rowIcon}>
                  <IconDeviceMobile size={20} />
                </div>
                <div className={styles.rowMain}>
                  <p className={styles.rowTitle}>{data.security.sessionsSummary.label}</p>
                  <p className={styles.rowSub}>{data.security.sessionsSummary.detail}</p>
                </div>
                <Button
                  size="xs"
                  variant="default"
                  className={`${styles.manageBtn} ${styles.glassBtn}`}
                  onClick={() => showComingSoon('Oturum yönetimi yakında eklenecek.')}
                >
                  Yönet
                </Button>
              </div>
            </ProfileCard>

            <ProfileCard
              title="Aktif Oturumlar"
              action={
                data.sessions.length > 1
                  ? {
                      label: 'Tümünü Kapat',
                      onClick: () => revokeAllSessions.mutate(),
                      actionVariant: 'danger',
                    }
                  : undefined
              }
            >
              {data.sessions.length === 0 ? (
                <div className={styles.sessionsEmpty}>
                  <p className={styles.sessionsEmptyTitle}>Aktif oturum yok</p>
                  <p className={styles.sessionsEmptyHint}>
                    Bu hesap için kayıtlı oturum bulunamadı. Yeni bir giriş yaptığınızda
                    burada görünür.
                  </p>
                </div>
              ) : (
                <ul className={styles.rowList}>
                  {data.sessions.map((session) => (
                    <li key={session.id} className={styles.rowItem}>
                      <div className={styles.rowIcon}>
                        {isMobileSession(session) ? (
                          <IconDeviceMobile size={20} />
                        ) : (
                          <IconDeviceLaptop size={20} />
                        )}
                      </div>
                      <div className={styles.rowMain}>
                        <p className={styles.rowTitle}>
                          {session.deviceLabel || session.device}
                          {session.isCurrent ? (
                            <span className={styles.sessionCurrentBadge}>Mevcut</span>
                          ) : null}
                        </p>
                        <p className={styles.rowSub}>
                          {session.location} · {session.ipMasked} · {session.lastActiveLabel}
                        </p>
                      </div>
                      {!session.isCurrent ? (
                        <button
                          type="button"
                          className={styles.cardAction}
                          onClick={() => revokeSession.mutate(session.id)}
                          disabled={revokeSession.isPending}
                        >
                          İptal Et
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </ProfileCard>
          </div>

          {/* Right column */}
          <div className={styles.column}>
            <ProfileCard title="Bildirimler">
              {(
                [
                  {
                    key: 'editNotifications' as const,
                    label: 'Düzenleme Bildirimleri',
                    hint: 'Paylaşılan doküman düzenlendiğinde',
                  },
                  {
                    key: 'commentNotifications' as const,
                    label: 'Yorum Bildirimleri',
                    hint: 'Yorumlarınıza yanıt geldiğinde',
                  },
                  {
                    key: 'userJoinedNotifications' as const,
                    label: 'Kullanıcı Katıldı',
                    hint: 'Bir kullanıcı dokümana katıldığında',
                  },
                  {
                    key: 'emailSummary' as const,
                    label: 'E-posta Özeti',
                    hint: 'Haftalık aktivite özeti',
                  },
                ] as const
              ).map((item) => (
                <div key={item.key} className={styles.settingRow}>
                  <div>
                    <p className={styles.settingLabel}>{item.label}</p>
                    <p className={styles.settingHint}>{item.hint}</p>
                  </div>
                  <Switch
                    checked={data.notifications[item.key]}
                    disabled={updateNotifications.isPending}
                    onChange={(event) => {
                      updateNotifications.mutate({
                        [item.key]: event.currentTarget.checked,
                      });
                    }}
                    color="violet"
                    size="md"
                  />
                </div>
              ))}
            </ProfileCard>

            <ProfileCard
              title="Çalışma Alanları"
              action={{
                label: '+ Yeni',
                onClick: () => showComingSoon('Yeni çalışma alanı yakında eklenecek.'),
              }}
            >
              {data.workspaces.length === 0 ? (
                <p className={styles.emptyText}>Henüz çalışma alanı yok.</p>
              ) : (
                <ul className={styles.rowList}>
                  {data.workspaces.map((ws) => (
                    <li key={ws.id} className={styles.rowItem}>
                      <div
                        className={styles.wsAvatar}
                        style={{ background: workspaceAvatarColor(ws.name) }}
                      >
                        {workspaceInitial(ws.name)}
                      </div>
                      <div className={styles.rowMain}>
                        <p className={styles.rowTitle}>{ws.name}</p>
                        <p className={styles.rowSub}>
                          {ws.memberCount} üye · {ws.documentCount} doküman
                        </p>
                      </div>
                      <span
                        className={
                          ws.role === 'OWNER'
                            ? styles.roleBadgeOwner
                            : styles.roleBadgeEditor
                        }
                      >
                        {ws.role === 'OWNER' ? '👑 ' : '✎ '}
                        {ws.roleLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </ProfileCard>

            <ProfileCard title="Görünüm & Dil">
              <div className={styles.settingRow}>
                <p className={styles.settingLabel}>Dil</p>
                <Select
                  className={styles.selectField}
                  value={data.appearance.language}
                  data={[
                    { value: 'tr', label: 'TR Türkçe' },
                    { value: 'en', label: 'EN English' },
                  ]}
                  onChange={(value) => {
                    if (value) {
                      updateAppearance.mutate({
                        language: value as 'tr' | 'en',
                      });
                    }
                  }}
                  disabled={updateAppearance.isPending}
                />
              </div>
              <div className={styles.settingRow}>
                <p className={styles.settingLabel}>Yazı Tipi</p>
                <Select
                  className={styles.selectField}
                  value={data.appearance.fontFamily}
                  data={[
                    { value: 'Geist (Varsayılan)', label: 'Geist (Varsayılan)' },
                    { value: 'Inter', label: 'Inter' },
                    { value: 'System UI', label: 'System UI' },
                  ]}
                  onChange={(value) => {
                    if (value) {
                      updateAppearance.mutate({ fontFamily: value });
                    }
                  }}
                  disabled={updateAppearance.isPending}
                />
              </div>
            </ProfileCard>
          </div>
        </div>
      </div>

      <ProfileEditModal
        opened={editOpen}
        onClose={() => setEditOpen(false)}
        user={user}
        loading={updateProfile.isPending}
        onSubmit={(values) => {
          updateProfile.mutate(values, {
            onSuccess: () => setEditOpen(false),
          });
        }}
      />
    </div>
  );
}
