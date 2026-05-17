import { ActionIcon, Select, Skeleton, Tooltip } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import type { TeamMember, WorkspaceRole } from '../types/team.types';
import { formatTeamDate, formatTeamDateTime } from '../team.utils';
import { RoleBadge } from './RoleBadge';
import styles from '../pages/TeamPage.module.css';

type TeamMembersCardProps = {
  members: TeamMember[];
  pendingInviteCount: number;
  loading: boolean;
  isOwner: boolean;
  currentUserId: string | undefined;
  roleUpdatingId: string | null;
  removingId: string | null;
  onRoleChange: (memberId: string, role: WorkspaceRole) => void;
  onRemove: (memberId: string) => void;
};

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Sahip' },
  { value: 'ADMIN', label: 'Yönetici' },
  { value: 'EDITOR', label: 'Editör' },
  { value: 'VIEWER', label: 'İzleyici' },
];

export function TeamMembersCard({
  members,
  pendingInviteCount,
  loading,
  isOwner,
  currentUserId,
  roleUpdatingId,
  removingId,
  onRoleChange,
  onRemove,
}: TeamMembersCardProps) {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Ekip Üyeleri</h2>
        <p className={styles.cardSubtitle}>Üyeleri ve rollerini yönetin</p>
      </div>

      <div className={styles.cardBody}>
      {loading ? (
        <Skeleton height={160} radius={14} />
      ) : members.length === 0 ? (
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon} aria-hidden>
            👥
          </span>
          Bu ekipte henüz üye yok.
        </div>
      ) : (
        <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Üye</th>
              <th>Rol</th>
              <th>Durum</th>
              <th>Katılma</th>
              <th>Son aktivite</th>
              {isOwner ? <th>İşlemler</th> : null}
            </tr>
          </thead>
          <tbody>
            {members.map((member) => {
              const isSelf = member.userId === currentUserId;
              const canEdit = isOwner && !isSelf;

              return (
                <tr key={member.id}>
                  <td>
                    <div className={styles.memberCell}>
                      <span className={styles.memberName}>{member.name}</span>
                      <span className={styles.memberEmail}>{member.email}</span>
                    </div>
                  </td>
                  <td>
                    {canEdit ? (
                      <Select
                        size="xs"
                        value={member.role}
                        data={ROLE_OPTIONS}
                        disabled={roleUpdatingId === member.id}
                        onChange={(v) =>
                          v && onRoleChange(member.id, v as WorkspaceRole)
                        }
                        w={120}
                      />
                    ) : (
                      <RoleBadge role={member.role} />
                    )}
                  </td>
                  <td>Bilinmiyor</td>
                  <td>{formatTeamDate(member.joinedAt)}</td>
                  <td>{formatTeamDateTime(member.lastActiveAt)}</td>
                  {isOwner ? (
                    <td>
                      <Tooltip
                        label={
                          canEdit
                            ? 'Üyeyi çıkar'
                            : 'Kendi hesabınızı çıkaramazsınız'
                        }
                      >
                        <ActionIcon
                          variant="subtle"
                          color="red"
                          disabled={!canEdit || removingId === member.id}
                          onClick={() => onRemove(member.id)}
                          aria-label="Üyeyi çıkar"
                        >
                          <IconTrash size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
      {pendingInviteCount > 0 ? (
        <p className={styles.membersPendingNote}>
          Bekleyen davetler üyeliğe dönüşmeden ekip üyeleri listesinde görünmez.
        </p>
      ) : null}
      </div>
    </section>
  );
}
