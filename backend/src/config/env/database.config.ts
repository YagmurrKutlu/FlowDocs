export interface DatabaseConfig {
  url: string;
}

export default (): { database: DatabaseConfig } => ({
  database: {
    url: process.env.DATABASE_URL ?? '',
  },
});
