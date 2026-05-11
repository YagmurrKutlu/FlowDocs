export interface AppConfig {
  nodeEnv: string;
  port: number;
  frontendUrl: string;
  /** Public base URL for API routes (e.g. http://localhost:4000/api) — used for browser-reachable media URLs. */
  publicApiUrl: string;
}

export default (): { app: AppConfig } => {
  const port = Number(process.env.PORT ?? 4000);
  const defaultPublicApi = `http://localhost:${port}/api`;
  return {
    app: {
      nodeEnv: process.env.NODE_ENV ?? 'development',
      port,
      frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:5173',
      publicApiUrl: process.env.API_PUBLIC_URL?.trim() || defaultPublicApi,
    },
  };
};
