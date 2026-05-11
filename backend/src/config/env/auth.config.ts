export interface AuthConfig {
  jwtSecret: string;
  jwtExpiresIn: string;
}

export default (): { auth: AuthConfig } => ({
  auth: {
    jwtSecret: process.env.JWT_SECRET ?? '',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '1h',
  },
});
