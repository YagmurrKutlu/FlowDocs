import type { SettingsSectionId } from './types/settings.types';

export const SETTINGS_NAV: {
  id: SettingsSectionId;
  label: string;
  danger?: boolean;
}[] = [
  { id: 'editor', label: 'Editör' },
  { id: 'collaboration', label: 'İşbirliği' },
  { id: 'notifications', label: 'Bildirimler' },
  { id: 'privacy', label: 'Gizlilik' },
  { id: 'data', label: 'Veri ve Depolama' },
  { id: 'accessibility', label: 'Erişilebilirlik' },
  { id: 'shortcuts', label: 'Klavye Kısayolları' },
  { id: 'experimental', label: 'Deneysel Özellikler' },
  { id: 'danger', label: 'Tehlikeli Bölge', danger: true },
];

export const AUTOSAVE_OPTIONS = [
  { value: 'instant', label: 'Anında' },
  { value: '5s', label: '5 saniye' },
  { value: '15s', label: '15 saniye' },
] as const;

export const FONT_SIZE_OPTIONS = [
  { value: 'small', label: 'Küçük' },
  { value: 'medium', label: 'Orta' },
  { value: 'large', label: 'Büyük' },
] as const;

export const LINE_HEIGHT_OPTIONS = [
  { value: 'compact', label: 'Sıkı' },
  { value: 'comfortable', label: 'Rahat' },
  { value: 'spacious', label: 'Geniş' },
] as const;

export const EXPORT_FORMAT_OPTIONS = [
  { value: 'pdf', label: 'PDF — Taşınabilir belge' },
  { value: 'docx', label: 'DOCX — Word uyumlu' },
  { value: 'html', label: 'HTML — Web sayfası' },
  { value: 'markdown', label: 'Markdown — Düz metin işaretleme' },
] as const;

export const SHORTCUTS = [
  { keys: 'Ctrl+B', action: 'Kalın (Bold)' },
  { keys: 'Ctrl+I', action: 'İtalik (Italic)' },
  { keys: 'Ctrl+K', action: 'Bağlantı (Link)' },
  { keys: 'Ctrl+Shift+7', action: 'Numaralı liste' },
  { keys: 'Ctrl+Shift+8', action: 'Madde işaretli liste' },
  { keys: 'Shift+Enter', action: 'Yeni satır' },
] as const;

export const NOTIFICATION_SETTINGS: {
  key:
    | 'comments'
    | 'mentions'
    | 'shares'
    | 'workspaceInvites'
    | 'emailDigest'
    | 'browserNotifications'
    | 'soundNotifications';
  title: string;
  description: string;
}[] = [
  {
    key: 'comments',
    title: 'Yorum bildirimleri',
    description: 'Dokümanlarınızdaki yeni yorumlar için uyarı alın.',
  },
  {
    key: 'mentions',
    title: 'Bahsetme bildirimleri',
    description: 'Birisi sizi @ ile etiketlediğinde bildirim gösterilir.',
  },
  {
    key: 'shares',
    title: 'Paylaşım bildirimleri',
    description: 'Doküman paylaşıldığında veya erişim değiştiğinde haberdar olun.',
  },
  {
    key: 'workspaceInvites',
    title: 'Çalışma alanı davetleri',
    description: 'Yeni workspace davetlerini kaçırmayın.',
  },
  {
    key: 'emailDigest',
    title: 'E-posta özeti',
    description: 'Periyodik aktivite özetini e-posta ile alın.',
  },
  {
    key: 'browserNotifications',
    title: 'Tarayıcı bildirimleri',
    description: 'Masaüstü tarayıcı bildirimlerini etkinleştirin.',
  },
  {
    key: 'soundNotifications',
    title: 'Sesli bildirimler',
    description: 'Önemli olaylarda kısa ses uyarısı çalın.',
  },
];
