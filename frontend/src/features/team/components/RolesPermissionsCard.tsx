import styles from '../pages/TeamPage.module.css';

export function RolesPermissionsCard() {
  return (
    <section className={styles.card}>
      <div className={styles.cardHeader}>
        <h2 className={styles.cardTitle}>Roller ve İzinler</h2>
        <p className={styles.cardSubtitle}>FlowDocs işbirliği modeli</p>
      </div>
      <div className={styles.cardBody}>
      <ul className={styles.permissionsList}>
        <li>
          <strong>Sahip:</strong> Üye davet eder, rol değiştirir, üye çıkarır, doküman
          yönetir.
        </li>
        <li>
          <strong>Editör:</strong> Doküman düzenler, yorum ekler, dosya yükler.
        </li>
        <li>
          <strong>İzleyici:</strong> Doküman okur, export alır, mesaj gönderebilir.
        </li>
      </ul>
      </div>
    </section>
  );
}
