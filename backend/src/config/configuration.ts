export default () => ({
  NODE_ENV: process.env.NODE_ENV ?? 'development',
  PORT: parseInt(process.env.PORT ?? '4000', 10),
  FRONTEND_URL: process.env.FRONTEND_URL ?? 'http://localhost:3000',
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  JWT_SECRET: process.env.JWT_SECRET ?? 'change_this_secret',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN ?? '24h',
  REFRESH_TOKEN_SECRET: process.env.REFRESH_TOKEN_SECRET ?? 'change_this_refresh_secret',
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY ?? '',
  DEFAULT_TRADING_MODE: process.env.DEFAULT_TRADING_MODE ?? 'testnet',
  TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN ?? '',
  TELEGRAM_CHAT_ID: process.env.TELEGRAM_CHAT_ID ?? '',
});
