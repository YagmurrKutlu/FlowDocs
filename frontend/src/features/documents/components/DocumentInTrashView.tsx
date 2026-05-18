import { Button, Group } from '@mantine/core';
import { IconTrash } from '@tabler/icons-react';
import { useNavigate } from 'react-router-dom';
import styles from './DocumentInTrashView.module.css';

export function DocumentInTrashView() {
  const navigate = useNavigate();

  return (
    <section className={styles.panel}>
      <div className={styles.iconWrap} aria-hidden>
        <IconTrash size={28} stroke={1.5} />
      </div>
      <h1 className={styles.title}>Bu doküman çöp kutusunda</h1>
      <p className={styles.description}>
        Dokümanı görüntülemek için önce geri yüklemeniz gerekir.
      </p>
      <Group className={styles.actions} justify="center">
        <Button variant="light" color="violet" onClick={() => navigate('/trash')}>
          Çöp Kutusuna Git
        </Button>
        <Button variant="default" onClick={() => navigate('/documents')}>
          Dokümanlara Dön
        </Button>
      </Group>
    </section>
  );
}
