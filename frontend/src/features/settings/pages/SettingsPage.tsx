import { Button, Modal, Skeleton, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useQueryClient } from '@tanstack/react-query';
import {
  IconAlertTriangle,
  IconBell,
  IconDatabase,
  IconEye,
  IconFlask,
  IconInfoCircle,
  IconKeyboard,
  IconPencil,
  IconUsers,
} from '@tabler/icons-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  SettingRow,
  SettingSelect,
  SettingSwitch,
} from '../components/SettingControls';
import {
  useSettingsQuery,
  useUpdateSettingsMutation,
} from '../hooks/useSettingsQueries';
import {
  AUTOSAVE_OPTIONS,
  EXPORT_FORMAT_OPTIONS,
  FONT_SIZE_OPTIONS,
  LINE_HEIGHT_OPTIONS,
  NOTIFICATION_SETTINGS,
  SETTINGS_NAV,
  SHORTCUTS,
} from '../settings.copy';
import type {
  AccessibilityPreferences,
  PartialUserSettings,
  SettingsCategory,
  SettingsSectionId,
  UserSettings,
} from '../types/settings.types';
import { applyAccessibilityPreferences } from '../utils/accessibilityPreferences';
import {
  isBrowserNotificationSupported,
  requestBrowserNotificationPermission,
} from '../utils/browserNotifications';
import { clearFlowDocsLocalCache } from '../utils/clearLocalCache';
import styles from './SettingsPage.module.css';

const NAV_ICONS: Record<SettingsSectionId, ReactNode> = {
  editor: <IconPencil size={16} />,
  collaboration: <IconUsers size={16} />,
  notifications: <IconBell size={16} />,
  privacy: <IconEye size={16} />,
  data: <IconDatabase size={16} />,
  accessibility: <IconEye size={16} />,
  shortcuts: <IconKeyboard size={16} />,
  experimental: <IconFlask size={16} />,
  danger: <IconAlertTriangle size={16} />,
};

type SaveUiStatus = 'idle' | 'saving' | 'saved' | 'error';

function InfoNote({
  children,
  danger,
}: {
  children: ReactNode;
  danger?: boolean;
}) {
  return (
    <div
      className={`${styles.infoNote} ${danger ? styles.infoNoteDanger : ''}`}
      role="note"
    >
      <IconInfoCircle size={16} className={styles.infoNoteIcon} aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function ShortcutKeys({ keys }: { keys: string }) {
  const parts = keys.split('+').map((p) => p.trim());
  return (
    <span className={styles.shortcutKeys}>
      {parts.map((part) => (
        <kbd key={part} className={styles.kbd}>
          {part}
        </kbd>
      ))}
    </span>
  );
}

function SaveStatusPill({ status }: { status: SaveUiStatus }) {
  const labels: Record<SaveUiStatus, string> = {
    idle: 'Otomatik kaydediliyor',
    saving: 'Kaydediliyor…',
    saved: 'Kaydedildi',
    error: 'Kaydedilemedi',
  };

  const classMap: Record<SaveUiStatus, string> = {
    idle: styles.statusPillIdle,
    saving: styles.statusPillSaving,
    saved: styles.statusPillSaved,
    error: styles.statusPillError,
  };

  return (
    <div
      className={`${styles.statusPill} ${classMap[status]}`}
      role="status"
      aria-live="polite"
    >
      <span className={styles.statusDot} aria-hidden />
      {labels[status]}
    </div>
  );
}

function SettingsSection({
  id,
  icon,
  title,
  description,
  danger,
  infoNote,
  children,
}: {
  id: SettingsSectionId;
  icon: ReactNode;
  title: string;
  description: string;
  danger?: boolean;
  infoNote?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      id={`settings-${id}`}
      className={`${styles.sectionCard} ${danger ? styles.sectionCardDanger : ''}`}
    >
      <div className={styles.sectionHeader}>
        <div
          className={`${styles.sectionIcon} ${danger ? styles.sectionIconDanger : ''}`}
        >
          {icon}
        </div>
        <div>
          <h2 className={styles.sectionTitle}>{title}</h2>
          <p className={styles.sectionDescription}>{description}</p>
        </div>
      </div>
      {infoNote}
      {children}
    </section>
  );
}

function useSaveStatus(
  update: ReturnType<typeof useUpdateSettingsMutation>,
): SaveUiStatus {
  const [status, setStatus] = useState<SaveUiStatus>('idle');
  const lastSubmittedAt = useRef(0);

  useEffect(() => {
    if (update.isPending) {
      setStatus('saving');
    }
  }, [update.isPending]);

  useEffect(() => {
    if (update.isError) {
      setStatus('error');
    }
  }, [update.isError, update.failureCount]);

  useEffect(() => {
    if (!update.isSuccess || update.submittedAt === 0) {
      return;
    }
    if (update.submittedAt === lastSubmittedAt.current) {
      return;
    }
    lastSubmittedAt.current = update.submittedAt;
    setStatus('saved');
    const timer = window.setTimeout(() => setStatus('idle'), 2500);
    return () => window.clearTimeout(timer);
  }, [update.isSuccess, update.submittedAt]);

  return status;
}

function useSettingsUpdater(
  update: ReturnType<typeof useUpdateSettingsMutation>,
) {
  const patch = useCallback(
    <K extends SettingsCategory>(category: K, partial: Partial<UserSettings[K]>) => {
      update.mutate({ [category]: partial } as PartialUserSettings);
    },
    [update],
  );

  return { patch, isPending: update.isPending };
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useSettingsQuery();
  const update = useUpdateSettingsMutation();
  const { patch, isPending } = useSettingsUpdater(update);
  const saveStatus = useSaveStatus(update);
  const [activeSection, setActiveSection] = useState<SettingsSectionId>('editor');
  const [cacheModalOpen, setCacheModalOpen] = useState(false);
  const [cacheClearing, setCacheClearing] = useState(false);

  const patchAccessibility = useCallback(
    (partial: Partial<AccessibilityPreferences>) => {
      if (!data) return;
      const next = { ...data.accessibilityPreferences, ...partial };
      applyAccessibilityPreferences(next);
      patch('accessibilityPreferences', partial);
    },
    [data, patch],
  );

  const handleBrowserNotificationToggle = useCallback(
    async (enabled: boolean) => {
      if (!enabled) {
        patch('notificationPreferences', { browserNotifications: false });
        return;
      }
      if (!isBrowserNotificationSupported()) {
        notifications.show({
          color: 'orange',
          title: 'Desteklenmiyor',
          message: 'Tarayıcınız masaüstü bildirimlerini desteklemiyor.',
        });
        return;
      }
      const granted = await requestBrowserNotificationPermission();
      if (!granted) {
        notifications.show({
          color: 'orange',
          title: 'İzin gerekli',
          message:
            'Bildirimler için tarayıcı izni vermeniz gerekiyor. Ayar kapalı bırakıldı.',
        });
        patch('notificationPreferences', { browserNotifications: false });
        return;
      }
      patch('notificationPreferences', { browserNotifications: true });
    },
    [patch],
  );

  const handleConfirmClearCache = useCallback(async () => {
    setCacheClearing(true);
    try {
      const result = await clearFlowDocsLocalCache(queryClient);
      setCacheModalOpen(false);
      if (result.errors.length > 0) {
        notifications.show({
          color: 'orange',
          title: 'Kısmen temizlendi',
          message: 'Bazı yerel veriler temizlenemedi.',
        });
      } else {
        notifications.show({
          color: 'violet',
          title: 'Yerel önbellek temizlendi',
          message: `${result.clearedCount} öğe temizlendi. Oturumunuz korundu.`,
          autoClose: 3000,
        });
      }
    } catch {
      notifications.show({
        color: 'red',
        title: 'Temizlenemedi',
        message: 'Bazı yerel veriler temizlenemedi.',
      });
    } finally {
      setCacheClearing(false);
    }
  }, [queryClient]);

  const scrollToSection = (id: SettingsSectionId) => {
    document.getElementById(`settings-${id}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
    setActiveSection(id);
  };

  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    for (const item of SETTINGS_NAV) {
      const el = document.getElementById(`settings-${item.id}`);
      if (!el) continue;
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              setActiveSection(item.id);
            }
          }
        },
        { rootMargin: '-20% 0px -60% 0px', threshold: 0 },
      );
      observer.observe(el);
      observers.push(observer);
    }
    return () => observers.forEach((o) => o.disconnect());
  }, [data]);

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <Skeleton height={120} radius="lg" mb="lg" />
          <div className={styles.layout}>
            <Skeleton height={400} radius="lg" />
            <Skeleton height={800} radius="lg" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className={styles.page}>
        <div className={styles.errorCard}>
          <h2 className={styles.errorTitle}>Ayarlar yüklenemedi</h2>
          <p className={styles.errorText}>
            Bağlantınızı kontrol edip tekrar deneyin.
          </p>
          <Button variant="light" color="violet" onClick={() => void refetch()}>
            Yeniden dene
          </Button>
        </div>
      </div>
    );
  }

  const ed = data.editorPreferences;
  const col = data.collaborationPreferences;
  const notif = data.notificationPreferences;
  const priv = data.privacyPreferences;
  const storage = data.dataStoragePreferences;
  const a11y = data.accessibilityPreferences;
  const exp = data.experimentalPreferences;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.headerCard}>
          <div className={styles.headerInner}>
            <div className={styles.headerText}>
              <h1 className={styles.pageTitle}>Ayarlar</h1>
              <p className={styles.pageDescription}>
                Editör davranışları, işbirliği, bildirim ve erişilebilirlik
                tercihlerinizi yönetin.
              </p>
            </div>
            <SaveStatusPill status={saveStatus} />
          </div>
        </header>

        <div className={styles.layout}>
          <aside className={styles.navAside}>
            <nav className={styles.navCard} aria-label="Ayarlar bölümleri">
            {SETTINGS_NAV.map((item) => (
              <button
                key={item.id}
                type="button"
                className={[
                  styles.navItem,
                  activeSection === item.id ? styles.navItemActive : '',
                  item.danger ? styles.navItemDanger : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => scrollToSection(item.id)}
              >
                <span className={styles.navItemIcon} aria-hidden>
                  {NAV_ICONS[item.id]}
                </span>
                {item.label}
              </button>
            ))}
            </nav>
          </aside>

          <div className={styles.sections}>
            <SettingsSection
              id="editor"
              icon={<IconPencil size={20} />}
              title="Editör Tercihleri"
              description="Kaydetme aralığı, görünüm ve editör araç çubuğu davranışları."
            >
              <SettingRow
                title="Otomatik kaydetme"
                description="Değişikliklerin sunucuya gönderilme sıklığı."
              >
                <SettingSelect
                  value={ed.autosaveInterval}
                  disabled={isPending}
                  data={[...AUTOSAVE_OPTIONS]}
                  onChange={(v) => patch('editorPreferences', { autosaveInterval: v })}
                />
              </SettingRow>
              <SettingRow
                title="Gerçek zamanlı imleçleri göster"
                description="İşbirlikçilerin imleç konumlarını canlı görüntüler."
              >
                <SettingSwitch
                  checked={ed.showCollaboratorCursors}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('editorPreferences', { showCollaboratorCursors: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Yorum vurgularını göster"
                description="Yorum yapılan metin bölgelerini editörde vurgular."
              >
                <SettingSwitch
                  checked={ed.showCommentHighlights}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('editorPreferences', { showCommentHighlights: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Yazım denetimi"
                description="Tarayıcı yazım denetimini editörde kullanır."
              >
                <SettingSwitch
                  checked={ed.spellcheck}
                  disabled={isPending}
                  onChange={(v) => patch('editorPreferences', { spellcheck: v })}
                />
              </SettingRow>
              <SettingRow
                title="Kompakt araç çubuğu"
                description="Daha az dikey alan kaplayan sıkı toolbar düzeni."
              >
                <SettingSwitch
                  checked={ed.compactToolbar}
                  disabled={isPending}
                  onChange={(v) => patch('editorPreferences', { compactToolbar: v })}
                />
              </SettingRow>
              <SettingRow
                title="Markdown kısayolları"
                description="**kalın** ve benzeri sözdizimini otomatik biçimlendirir."
              >
                <SettingSwitch
                  checked={ed.markdownShortcuts}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('editorPreferences', { markdownShortcuts: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Otomatik bağlantı algılama"
                description="Yazdığınız URL’leri tıklanabilir bağlantıya dönüştürür."
              >
                <SettingSwitch
                  checked={ed.autoLinkDetection}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('editorPreferences', { autoLinkDetection: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Otomatik içindekiler"
                description="Başlıklardan doküman içindekiler tablosu oluşturur."
              >
                <SettingSwitch
                  checked={ed.autoToc}
                  disabled={isPending}
                  onChange={(v) => patch('editorPreferences', { autoToc: v })}
                />
              </SettingRow>
              <SettingRow
                title="Yazı boyutu"
                description="Editör metninin varsayılan görüntüleme boyutu."
              >
                <SettingSelect
                  value={ed.fontSize}
                  disabled={isPending}
                  data={[...FONT_SIZE_OPTIONS]}
                  onChange={(v) => patch('editorPreferences', { fontSize: v })}
                />
              </SettingRow>
              <SettingRow
                title="Satır aralığı"
                description="Paragraflar arası dikey boşluk yoğunluğu."
              >
                <SettingSelect
                  value={ed.lineHeight}
                  disabled={isPending}
                  data={[...LINE_HEIGHT_OPTIONS]}
                  onChange={(v) => patch('editorPreferences', { lineHeight: v })}
                />
              </SettingRow>
            </SettingsSection>

            <SettingsSection
              id="collaboration"
              icon={<IconUsers size={20} />}
              title="İşbirliği"
              description="Ortak düzenleme, presence ve gerçek zamanlı geri bildirimler."
            >
              <SettingRow
                title="Presence görünürlüğü"
                description="Kimlerin dokümanda olduğunu gösterir."
              >
                <SettingSwitch
                  checked={col.showPresence}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('collaborationPreferences', { showPresence: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Yazıyor göstergesi"
                description="Bir işbirlikçi yazarken kısa animasyon gösterir."
              >
                <SettingSwitch
                  checked={col.showTypingIndicator}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('collaborationPreferences', { showTypingIndicator: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Katılım bildirimleri"
                description="Birisi dokümana katıldığında kısa bildirim."
              >
                <SettingSwitch
                  checked={col.showJoinNotifications}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('collaborationPreferences', { showJoinNotifications: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Gerçek zamanlı animasyonlar"
                description="Senkron ve presence için hafif hareket efektleri."
              >
                <SettingSwitch
                  checked={col.realtimeAnimations}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('collaborationPreferences', { realtimeAnimations: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Çevrimiçi durum noktaları"
                description="Kullanıcı listesinde çevrimiçi/çevrimdışı göstergeleri."
              >
                <SettingSwitch
                  checked={col.showOnlineStatus}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('collaborationPreferences', { showOnlineStatus: v })
                  }
                />
              </SettingRow>
            </SettingsSection>

            <SettingsSection
              id="notifications"
              icon={<IconBell size={20} />}
              title="Bildirimler"
              description="Hangi olaylar için uyarı alacağınızı seçin."
            >
              {NOTIFICATION_SETTINGS.map((item) => (
                <SettingRow
                  key={item.key}
                  title={item.title}
                  description={item.description}
                >
                  <SettingSwitch
                    checked={notif[item.key]}
                    disabled={isPending}
                    onChange={(v) => {
                      if (item.key === 'browserNotifications') {
                        void handleBrowserNotificationToggle(v);
                        return;
                      }
                      patch('notificationPreferences', { [item.key]: v });
                    }}
                  />
                </SettingRow>
              ))}
            </SettingsSection>

            <SettingsSection
              id="privacy"
              icon={<IconEye size={20} />}
              title="Gizlilik"
              description="Görünürlük, bahsetme ve profil paylaşım tercihleri."
            >
              <SettingRow
                title="Çevrimiçi durumumu göster"
                description="Workspace üyeleri çevrimiçi olduğunuzu görebilir."
              >
                <SettingSwitch
                  checked={priv.showOnlineStatus}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('privacyPreferences', { showOnlineStatus: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Son görülmeyi göster"
                description="Son aktif olduğunuz zamanı paylaşır."
              >
                <SettingSwitch
                  checked={priv.showLastSeen}
                  disabled={isPending}
                  onChange={(v) => patch('privacyPreferences', { showLastSeen: v })}
                />
              </SettingRow>
              <SettingRow
                title="Bahsetmeye izin ver"
                description="Diğer kullanıcıların sizi @ ile etiketlemesine izin verir."
              >
                <SettingSwitch
                  checked={priv.allowMentions}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('privacyPreferences', { allowMentions: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Profilimi çalışma alanında göster"
                description="Üyeler profil kartınızı workspace içinde görebilir."
              >
                <SettingSwitch
                  checked={priv.showProfileToWorkspace}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('privacyPreferences', { showProfileToWorkspace: v })
                  }
                />
              </SettingRow>
            </SettingsSection>

            <SettingsSection
              id="data"
              icon={<IconDatabase size={20} />}
              title="Veri ve Depolama"
              description="Dışa aktarma, yedekleme ve medya saklama tercihleri."
              infoNote={
                <InfoNote>
                  Medya depolama kullanımı demo ortamında gerçek zamanlı
                  hesaplanmaz.
                </InfoNote>
              }
            >
              <SettingRow
                title="Varsayılan dışa aktarma formatı"
                description="Dokümanları dışa aktarırken kullanılacak dosya türü."
              >
                <SettingSelect
                  value={storage.defaultExportFormat}
                  disabled={isPending}
                  data={[...EXPORT_FORMAT_OPTIONS]}
                  onChange={(v) =>
                    patch('dataStoragePreferences', { defaultExportFormat: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Otomatik yedekleme"
                description="Düzenlemeleri arka planda yedek kopya olarak saklar."
              >
                <SettingSwitch
                  checked={storage.autoBackup}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('dataStoragePreferences', { autoBackup: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Görsel sıkıştırma"
                description="Yüklenen görselleri depolama için optimize eder."
              >
                <SettingSwitch
                  checked={storage.imageCompression}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('dataStoragePreferences', { imageCompression: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Orijinal yüklemeleri sakla"
                description="Sıkıştırılmış kopyanın yanında orijinal dosyayı tutar."
              >
                <SettingSwitch
                  checked={storage.keepOriginalUploads}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('dataStoragePreferences', { keepOriginalUploads: v })
                  }
                />
              </SettingRow>
              <div className={styles.storageBar} aria-hidden>
                <div className={styles.storageBarFill} />
              </div>
            </SettingsSection>

            <SettingsSection
              id="accessibility"
              icon={<IconEye size={20} />}
              title="Erişilebilirlik"
              description="Hareket, kontrast ve okunabilirlik ayarları."
            >
              <SettingRow
                title="Hareketi azalt"
                description="Animasyon ve geçiş efektlerini sınırlar."
              >
                <SettingSwitch
                  checked={a11y.reducedMotion}
                  disabled={isPending}
                  onChange={(v) => patchAccessibility({ reducedMotion: v })}
                />
              </SettingRow>
              <SettingRow
                title="Yüksek kontrast"
                description="Metin ve arayüz öğelerinde daha güçlü kontrast."
              >
                <SettingSwitch
                  checked={a11y.highContrast}
                  disabled={isPending}
                  onChange={(v) => patchAccessibility({ highContrast: v })}
                />
              </SettingRow>
              <SettingRow
                title="Büyük yazı"
                description="Arayüz ve editörde daha büyük varsayılan yazı boyutu."
              >
                <SettingSwitch
                  checked={a11y.largerText}
                  disabled={isPending}
                  onChange={(v) => patchAccessibility({ largerText: v })}
                />
              </SettingRow>
              <SettingRow
                title="Belirgin odak çizgileri"
                description="Klavye ile gezinirken odak halkasını güçlendirir."
              >
                <SettingSwitch
                  checked={a11y.visibleFocus}
                  disabled={isPending}
                  onChange={(v) => patchAccessibility({ visibleFocus: v })}
                />
              </SettingRow>
            </SettingsSection>

            <SettingsSection
              id="shortcuts"
              icon={<IconKeyboard size={20} />}
              title="Klavye Kısayolları"
              description="Sık kullanılan editör kısayolları referansı."
            >
              <ul className={styles.shortcutGrid}>
                {SHORTCUTS.map((s) => (
                  <li key={s.keys} className={styles.shortcutItem}>
                    <span className={styles.shortcutAction}>{s.action}</span>
                    <ShortcutKeys keys={s.keys} />
                  </li>
                ))}
              </ul>
              <Button
                className={styles.comingSoonBtn}
                variant="light"
                color="violet"
                disabled
              >
                Kısayolları özelleştirme yakında.
              </Button>
            </SettingsSection>

            <SettingsSection
              id="experimental"
              icon={<IconFlask size={20} />}
              title="Deneysel Özellikler"
              description="Beta özellikler; varsayılan olarak kapalıdır."
              infoNote={
                <InfoNote>
                  Beta özellikler varsayılan olarak kapalıdır ve üretim
                  davranışını etkilemez.
                </InfoNote>
              }
            >
              <SettingRow
                title="Yazım önerileri (beta)"
                description="Doküman yapısına göre basit okunabilirlik ipuçları gösterir."
              >
                <SettingSwitch
                  checked={exp.smartSuggestions}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('experimentalPreferences', { smartSuggestions: v })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Gelişmiş senkron tanılama (beta)"
                description="Geliştiriciler için ek senkronizasyon günlükleri."
              >
                <SettingSwitch
                  checked={exp.advancedSyncDiagnostics}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('experimentalPreferences', {
                      advancedSyncDiagnostics: v,
                    })
                  }
                />
              </SettingRow>
              <SettingRow
                title="Yüzen araç çubuğu (beta)"
                description="Seçime göre konumlanan deneysel toolbar."
              >
                <SettingSwitch
                  checked={exp.floatingToolbarBeta}
                  disabled={isPending}
                  onChange={(v) =>
                    patch('experimentalPreferences', { floatingToolbarBeta: v })
                  }
                />
              </SettingRow>
            </SettingsSection>

            <SettingsSection
              id="danger"
              icon={<IconAlertTriangle size={20} />}
              title="Tehlikeli Bölge"
              description="Geri alınamaz veya hassas işlemler — demo sürümünde sınırlı."
              danger
              infoNote={
                <InfoNote danger>
                  Bu bölüm demo sürümünde gerçek veri silme işlemi yapmaz.
                </InfoNote>
              }
            >
              <SettingRow
                title="Yerel editör önbelleğini sıfırla"
                description="Bu tarayıcıdaki geçici FlowDocs önbelleğini temizler; sunucu verileri korunur."
              >
                <Button
                  variant="outline"
                  color="red"
                  size="sm"
                  onClick={() => setCacheModalOpen(true)}
                >
                  Sıfırla
                </Button>
              </SettingRow>
              <SettingRow
                title="Kurtarma araçları"
                description="Yalnızca yönetici ve geliştirme ortamında CLI üzerinden kullanılabilir."
              >
                <Button variant="subtle" color="gray" size="sm" disabled>
                  Yönetici gerekli
                </Button>
              </SettingRow>
              <SettingRow
                title="Hesabı sil"
                description="Demo sürümünde kapalı — kalıcı hesap silme yapılmaz."
              >
                <Button variant="filled" color="red" size="sm" disabled>
                  Demo sürümünde kapalı
                </Button>
              </SettingRow>
            </SettingsSection>
          </div>
        </div>
      </div>

      <Modal
        opened={cacheModalOpen}
        onClose={() => !cacheClearing && setCacheModalOpen(false)}
        title="Yerel önbelleği temizle?"
        centered
      >
        <Text size="sm" c="dimmed" mb="lg">
          Bu işlem yalnızca bu tarayıcıdaki geçici FlowDocs önbelleğini temizler.
          Sunucudaki dokümanlarınız silinmez. Oturumunuz açık kalır.
        </Text>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button
            variant="default"
            onClick={() => setCacheModalOpen(false)}
            disabled={cacheClearing}
          >
            İptal
          </Button>
          <Button
            color="red"
            loading={cacheClearing}
            onClick={() => void handleConfirmClearCache()}
          >
            Temizle
          </Button>
        </div>
      </Modal>
    </div>
  );
}
