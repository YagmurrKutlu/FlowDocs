export interface DocumentConfig {
  snapshotInterval: number;
}

export default (): { document: DocumentConfig } => ({
  document: {
    snapshotInterval: Number(process.env.DOCUMENT_SNAPSHOT_INTERVAL ?? 25),
  },
});
