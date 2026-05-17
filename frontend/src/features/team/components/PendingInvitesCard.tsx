import { Badge, Button, Group, Skeleton } from '@mantine/core';
import type { TeamInvite } from '../types/team.types';
import { formatTeamDateTime, inviteStatusLabel } from '../team.utils';
import { RoleBadge } from './RoleBadge';
import styles from '../pages/TeamPage.module.css';

type PendingInvitesCardProps = {
  invites: TeamInvite[];
  loading: boolean;
  cancellingId: string | null;
  acceptingId: string | null;
  showDemoAccept: boolean;
  onCancel: (inviteId: string) => void;
  onAcceptDemo: (inviteId: string) => void;
};

export function PendingInvitesCard({
  invites,
  loading,
  cancellingId,
  acceptingId,
  showDemoAccept,
  onCancel,
  onAcceptDemo,
}: PendingInvitesCardProps) {
  const pendingCount = invites.length;

  return (
    <section
      className={`${styles.card} ${pendingCount > 0 ? styles.pendingInvitesCard : ''}`}
    >
      <div className={styles.cardHeader}>
        <Group justify="space-between" align="flex-start" wrap="nowrap">
          <div>
            <h2 className={styles.cardTitle}>Bekleyen Davetler</h2>
            <p className={styles.cardSubtitle}>
              Davet kabul edilmeden üye listesine eklenmez
            </p>
          </div>
          {pendingCount > 0 ? (
            <Badge className={styles.pendingCountBadge} size="lg">
              {pendingCount}
            </Badge>
          ) : null}
        </Group>
      </div>

      <div className={styles.cardBody}>
        {loading ? (
          <Skeleton height={100} radius={14} />
        ) : pendingCount === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyIcon} aria-hidden>
              ✉️
            </span>
            Bekleyen davet bulunmuyor.
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>E-posta</th>
                  <th>Rol</th>
                  <th>Durum</th>
                  <th>Oluşturulma</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {invites.map((invite) => (
                  <tr key={invite.id}>
                    <td>{invite.email}</td>
                    <td>
                      <RoleBadge role={invite.role} />
                    </td>
                    <td>
                      <span className={styles.badgePending}>
                        {inviteStatusLabel(invite.status)}
                      </span>
                    </td>
                    <td>{formatTeamDateTime(invite.createdAt)}</td>
                    <td>
                      <Group gap="xs" justify="flex-end" wrap="nowrap">
                        {showDemoAccept ? (
                          <Button
                            size="xs"
                            variant="light"
                            className={styles.demoAcceptBtn}
                            loading={acceptingId === invite.id}
                            onClick={() => onAcceptDemo(invite.id)}
                          >
                            Daveti kabul edildi olarak ekle
                          </Button>
                        ) : null}
                        <Button
                          size="xs"
                          variant="subtle"
                          className={styles.dangerBtn}
                          loading={cancellingId === invite.id}
                          disabled={acceptingId === invite.id}
                          onClick={() => onCancel(invite.id)}
                        >
                          İptal Et
                        </Button>
                      </Group>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
