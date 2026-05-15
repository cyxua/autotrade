export default () => {
  const isProd = process.env.NODE_ENV === 'production';

  if (isProd) {
    const required = ['JWT_SECRET', 'REFRESH_TOKEN_SECRET', 'DATABASE_URL', 'ENCRYPTION_KEY'];
    for (const key of required) {
      if (!process.env[key]) {
        throw new Error(`[CONFIG] 필수 환경변수 누락: ${key} (production 모드에서 필수)`);
      }
    }
    if ((process.env.JWT_SECRET?.length ?? 0) < 32) {
      throw new Error('[CONFIG] JWT_SECRET는 32자 이상 랜덤값이어야 합니다');
    }
  }

  return {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    PORT: parseInt(process.env.PORT ?? '4000', 10),
    FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    DATABASE_URL: process.env.DATABASE_URL,
    REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
    JWT_SECRET: process.env.JWT_SECRET ?? (isProd ? '' : 'dev-only-not-for-production'),
    JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '24h',
    REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET ?? (isProd ? '' : 'dev-only-refresh'),
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? '',
    DEFAULT_TRADING_MODE: process.env.DEFAULT_TRADING_MODE ?? 'testnet',
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
    TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',
  };
};
