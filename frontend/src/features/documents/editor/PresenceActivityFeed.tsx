import { Box, Group, Text } from '@mantine/core';
import { memo, useEffect, useState, type MutableRefObject } from 'react';
import editorShell from './DocumentEditorShell.module.css';
import { presenceGradIndexForActor, presenceGradientCss } from './documentPresenceGradients';
import {
  buildLivePresenceActivities,
  presenceActivityFeedsEqual,
  PRESENCE_ACTIVITY_UI_THROTTLE_MS,
  type DocumentEditorShellPresenceActivity,
} from './presenceActivityUtils';

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ''}${parts[1]![0] ?? ''}`.toUpperCase();
}

export interface PresenceActivityLiveSourceSnapshot {
  activeUsers: ReadonlyArray<{ userId: string; fullName: string }>;
  remoteCursors: ReadonlyArray<{
    userId: string;
    anchorOffset: number;
    focusOffset: number;
    updatedAt: string;
  }>;
}

export interface PresenceActivityFeedProps {
  presenceActivitiesProp?: DocumentEditorShellPresenceActivity[] | undefined;
  /** Updated every parent render; stable ref identity so this subtree can skip re-render on cursor churn. */
  presenceLiveSourceRef: MutableRefObject<PresenceActivityLiveSourceSnapshot>;
}

function PresenceActivityFeedInner({
  presenceActivitiesProp,
  presenceLiveSourceRef,
}: PresenceActivityFeedProps) {
  const hasPropFeed = Boolean(presenceActivitiesProp && presenceActivitiesProp.length > 0);
  const [liveDisplayed, setLiveDisplayed] = useState<DocumentEditorShellPresenceActivity[]>(() =>
    hasPropFeed ? [] : buildLivePresenceActivities(
      presenceLiveSourceRef.current.activeUsers,
      presenceLiveSourceRef.current.remoteCursors,
    ),
  );

  useEffect(() => {
    if (hasPropFeed) return;

    const tick = () => {
      const { activeUsers, remoteCursors } = presenceLiveSourceRef.current;
      const next = buildLivePresenceActivities(activeUsers, remoteCursors);
      setLiveDisplayed((prev) => (presenceActivityFeedsEqual(prev, next) ? prev : next));
    };

    tick();
    const id = window.setInterval(tick, PRESENCE_ACTIVITY_UI_THROTTLE_MS);
    return () => window.clearInterval(id);
  }, [hasPropFeed, presenceLiveSourceRef]);

  const displayed = hasPropFeed ? presenceActivitiesProp! : liveDisplayed;

  return (
    <>
      <Text className={`${editorShell.presenceSectionLabel} ${editorShell.presenceSectionLabelSpaced}`}>
        SON AKTİVİTE
      </Text>
      <Box
        className={
          displayed.length === 0
            ? `${editorShell.activityStack} ${editorShell.activityStackEmpty}`
            : editorShell.activityStack
        }
      >
        {displayed.length === 0 ? (
          <Text size="sm" className={editorShell.presenceMuted}>
            Son aktivite yok
          </Text>
        ) : (
          displayed.map((row, i) => (
            <Box key={row.id} className={editorShell.activityRow}>
              <Group gap={10} wrap="nowrap" align="flex-start">
                <Box
                  className={editorShell.presenceAvatarSm}
                  style={{
                    background: presenceGradientCss(presenceGradIndexForActor(row.actorUserId, i)),
                  }}
                  aria-hidden
                >
                  {initialsFromName(row.actorName)}
                </Box>
                <Box style={{ flex: 1, minWidth: 0 }}>
                  <Text size="sm" className={editorShell.activityLineText}>
                    <Text component="span" fw={700} c="#e8eaf5">
                      {row.actorName}
                    </Text>
                    <Text component="span" className={editorShell.presenceMuted}>
                      {row.summary}
                    </Text>
                  </Text>
                  <Text size="xs" className={editorShell.presenceMuted}>
                    {row.timeLabel}
                  </Text>
                </Box>
              </Group>
            </Box>
          ))
        )}
      </Box>
    </>
  );
}

function presenceActivityFeedPropsAreEqual(
  prev: PresenceActivityFeedProps,
  next: PresenceActivityFeedProps,
): boolean {
  return (
    prev.presenceActivitiesProp === next.presenceActivitiesProp &&
    prev.presenceLiveSourceRef === next.presenceLiveSourceRef
  );
}

export const PresenceActivityFeed = memo(PresenceActivityFeedInner, presenceActivityFeedPropsAreEqual);
