import { Badge, Group, Text, Title } from '@mantine/core';
import { useLocation } from 'react-router-dom';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  '/dashboard': {
    title: 'Anasayfa',
    subtitle: 'Tüm dokümanlarınız',
  },
  '/documents': {
    title: 'Dokümanlar',
    subtitle: 'Erişebildiğiniz tüm dokümanlar.',
  },
  '/profile': {
    title: 'Profil',
    subtitle: 'Hesap bilgileriniz, aktiviteler ve tercihler.',
  },
  '/settings': {
    title: 'Ayarlar',
    subtitle: 'FlowDocs deneyimini ve editör tercihlerini yönetin.',
  },
};

export function Topbar() {
  const location = useLocation();
  const path = location.pathname;

  let page =
    pageTitles[path] ?? {
      title: 'FlowDocs',
      subtitle: 'Ortak çalışma alanı.',
    };

  if (path.startsWith('/documents/') && path !== '/documents') {
    page = {
      title: 'Doküman',
      subtitle: 'Doküman detayı ve düzenleme.',
    };
  }

  return (
    <Group justify="space-between" px="lg" py="md" h="100%" align="center">
      <div>
        <Title order={3}>{page.title}</Title>
        <Text c="dimmed" size="sm">
          {page.subtitle}
        </Text>
      </div>

      <Badge color="blue" variant="light">
        FlowDocs
      </Badge>
    </Group>
  );
}
