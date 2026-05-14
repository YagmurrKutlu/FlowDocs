export interface DocumentEditorShellPresenceActivity {
  id: string;
  actorName: string;
  /** Shown after the bold actor name (e.g. " dokümanı güncelledi"). */
  summary: string;
  timeLabel: string;
  actorUserId?: string;
}

export interface PresenceActivityLiveUser {
  userId: string;
  fullName: string;
}

export interface PresenceActivityLiveCursor {
  userId: string;
  anchorOffset: number;
  focusOffset: number;
  updatedAt: string;
}

/** Infer "yazıyor" when remote cursor payload was refreshed recently (UI only). */
export const LIVE_PRESENCE_CURSOR_RECENT_MS = 4500;

/** Max rate for recomputing live SON AKTİVİTE rows (does not affect editor / cursors). */
export const PRESENCE_ACTIVITY_UI_THROTTLE_MS = 1000;

/** Ephemeral SON AKTİVİTE lines from live presence only (no DB, no fake business events). */
export function buildLivePresenceActivities(
  activeUsers: ReadonlyArray<PresenceActivityLiveUser>,
  remoteCursors: ReadonlyArray<PresenceActivityLiveCursor>,
): DocumentEditorShellPresenceActivity[] {
  const seen = new Set<string>();
  const out: DocumentEditorShellPresenceActivity[] = [];
  const now = Date.now();

  for (const u of activeUsers) {
    if (seen.has(u.userId)) continue;
    seen.add(u.userId);

    let c: PresenceActivityLiveCursor | undefined;
    for (let i = 0; i < remoteCursors.length; i += 1) {
      if (remoteCursors[i]!.userId === u.userId) {
        c = remoteCursors[i]!;
        break;
      }
    }

    let summary: string;
    let timeLabel: string;

    if (!c) {
      summary = ' dokümanı inceliyor';
      timeLabel = 'şu anda';
    } else if (c.anchorOffset !== c.focusOffset) {
      summary = ' dokümanı düzenliyor';
      timeLabel = 'şu anda';
    } else {
      const t = Date.parse(c.updatedAt);
      const recent = !Number.isNaN(t) && now - t < LIVE_PRESENCE_CURSOR_RECENT_MS;
      if (recent) {
        summary = ' yazıyor';
        timeLabel = 'şu anda';
      } else {
        summary = ' dokümanı inceliyor';
        timeLabel = 'az önce';
      }
    }

    out.push({
      id: `live-presence-${u.userId}`,
      actorName: u.fullName,
      summary,
      timeLabel,
      actorUserId: u.userId,
    });
  }

  return out;
}

export function presenceActivityFeedsEqual(
  a: readonly DocumentEditorShellPresenceActivity[],
  b: readonly DocumentEditorShellPresenceActivity[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.id !== y.id ||
      x.actorName !== y.actorName ||
      x.summary !== y.summary ||
      x.timeLabel !== y.timeLabel ||
      (x.actorUserId ?? '') !== (y.actorUserId ?? '')
    ) {
      return false;
    }
  }
  return true;
}
