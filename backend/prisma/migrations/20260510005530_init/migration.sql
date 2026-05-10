-- CreateEnum
CREATE TYPE "TradingMode" AS ENUM ('TESTNET', 'LIVE');

-- CreateEnum
CREATE TYPE "MarginType" AS ENUM ('ISOLATED', 'CROSSED');

-- CreateEnum
CREATE TYPE "PositionSide" AS ENUM ('LONG', 'SHORT', 'BOTH');

-- CreateEnum
CREATE TYPE "OrderSide" AS ENUM ('BUY', 'SELL');

-- CreateEnum
CREATE TYPE "OrderType" AS ENUM ('MARKET', 'LIMIT', 'STOP_MARKET', 'TAKE_PROFIT_MARKET', 'TRAILING_STOP_MARKET');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'NEW', 'PARTIALLY_FILLED', 'FILLED', 'CANCELED', 'REJECTED', 'EXPIRED', 'ERROR');

-- CreateEnum
CREATE TYPE "StrategyType" AS ENUM ('MA_CROSS', 'RSI_EXTREME', 'BOLLINGER_BREAKOUT', 'HIGH_LOW_BREAKOUT', 'VOLUME_SPIKE');

-- CreateEnum
CREATE TYPE "Timeframe" AS ENUM ('m1', 'm5', 'm15', 'h1', 'h4');

-- CreateEnum
CREATE TYPE "EngineStatus" AS ENUM ('RUNNING', 'STOPPED', 'EMERGENCY_STOPPED', 'PAUSED_DAILY_LOSS', 'PAUSED_CONSEC_LOSS');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARN', 'ERROR', 'DEBUG');

-- CreateEnum
CREATE TYPE "NotificationEvent" AS ENUM ('ENGINE_START', 'ENGINE_STOP', 'ENGINE_EMERGENCY_STOP', 'ORDER_FILLED', 'POSITION_OPEN', 'POSITION_CLOSE_TP', 'POSITION_CLOSE_SL', 'POSITION_CLOSE_MANUAL', 'DAILY_LOSS_LIMIT', 'CONSEC_LOSS_STOP', 'API_ERROR', 'RISK_BLOCKED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "loginFailCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKey" TEXT NOT NULL,
    "encryptedSecret" TEXT NOT NULL,
    "secretIv" TEXT NOT NULL,
    "secretTag" TEXT NOT NULL,
    "tradingMode" "TradingMode" NOT NULL DEFAULT 'TESTNET',
    "isConnected" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckedAt" TIMESTAMP(3),
    "lastErrorMsg" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "api_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engine_states" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "EngineStatus" NOT NULL DEFAULT 'STOPPED',
    "startedAt" TIMESTAMP(3),
    "stoppedAt" TIMESTAMP(3),
    "stopReason" TEXT,
    "dailyPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dailyTrades" INTEGER NOT NULL DEFAULT 0,
    "dailyLossDate" TIMESTAMP(3),
    "consecLossCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "engine_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "strategies" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "StrategyType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "symbol" TEXT NOT NULL,
    "timeframe" "Timeframe" NOT NULL DEFAULT 'm15',
    "positionSizeUsdt" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "leverage" INTEGER NOT NULL DEFAULT 5,
    "marginType" "MarginType" NOT NULL DEFAULT 'ISOLATED',
    "allowLong" BOOLEAN NOT NULL DEFAULT true,
    "allowShort" BOOLEAN NOT NULL DEFAULT true,
    "takeProfitPct" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "stopLossPct" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "trailingStopPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxPositions" INTEGER NOT NULL DEFAULT 1,
    "maxDailyLoss" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "maxDailyTrades" INTEGER NOT NULL DEFAULT 10,
    "stopOnConsecLoss" INTEGER NOT NULL DEFAULT 3,
    "params" JSONB NOT NULL DEFAULT '{}',
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "winTrades" INTEGER NOT NULL DEFAULT 0,
    "totalPnl" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastSignalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "binanceOrderId" TEXT,
    "clientOrderId" TEXT,
    "symbol" TEXT NOT NULL,
    "side" "OrderSide" NOT NULL,
    "positionSide" "PositionSide" NOT NULL,
    "orderType" "OrderType" NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION,
    "stopPrice" DOUBLE PRECISION,
    "avgFillPrice" DOUBLE PRECISION,
    "filledQty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leverage" INTEGER NOT NULL,
    "marginType" "MarginType" NOT NULL,
    "realizedPnl" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION,
    "commissionAsset" TEXT DEFAULT 'USDT',
    "entryReason" TEXT,
    "exitReason" TEXT,
    "positionId" TEXT,
    "errorMessage" TEXT,
    "filledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "symbol" TEXT NOT NULL,
    "positionSide" "PositionSide" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "entryPrice" DOUBLE PRECISION NOT NULL,
    "exitPrice" DOUBLE PRECISION,
    "quantity" DOUBLE PRECISION NOT NULL,
    "leverage" INTEGER NOT NULL,
    "marginType" "MarginType" NOT NULL,
    "realizedPnl" DOUBLE PRECISION,
    "unrealizedPnl" DOUBLE PRECISION,
    "commission" DOUBLE PRECISION,
    "takeProfitPrice" DOUBLE PRECISION,
    "stopLossPrice" DOUBLE PRECISION,
    "trailingStopPct" DOUBLE PRECISION,
    "entryReason" TEXT,
    "exitReason" TEXT,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maxPositionRatioPct" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "maxTotalPositionRatioPct" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "maxLeverage" INTEGER NOT NULL DEFAULT 10,
    "minLiqDistancePct" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "maxDailyLossUsdt" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "maxDailyTrades" INTEGER NOT NULL DEFAULT 50,
    "consecutiveLossStop" INTEGER NOT NULL DEFAULT 3,
    "volatilityPausePct" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "volatilityPauseMinutes" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "risk_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scanner_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "intervalMinutes" INTEGER NOT NULL DEFAULT 5,
    "topNByVolume" INTEGER NOT NULL DEFAULT 20,
    "topNByTradeCount" INTEGER NOT NULL DEFAULT 20,
    "minPriceChangePct" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "maxSpreadPct" DOUBLE PRECISION NOT NULL DEFAULT 0.1,
    "minVolumeUsdt" DOUBLE PRECISION NOT NULL DEFAULT 1000000,
    "symbolPool" JSONB NOT NULL DEFAULT '["BTCUSDT","ETHUSDT","SOLUSDT","BNBUSDT","XRPUSDT","DOGEUSDT"]',
    "excludeSymbols" JSONB NOT NULL DEFAULT '[]',
    "lastResult" JSONB,
    "lastScannedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scanner_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_configs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "telegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "botToken" TEXT,
    "chatId" TEXT,
    "enabledEvents" JSONB NOT NULL DEFAULT '{"ENGINE_START":true,"ENGINE_STOP":true,"ENGINE_EMERGENCY_STOP":true,"ORDER_FILLED":true,"POSITION_OPEN":true,"POSITION_CLOSE_TP":true,"POSITION_CLOSE_SL":true,"DAILY_LOSS_LIMIT":true,"CONSEC_LOSS_STOP":true,"API_ERROR":true}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "event" "NotificationEvent" NOT NULL,
    "message" TEXT NOT NULL,
    "success" BOOLEAN NOT NULL,
    "errorMsg" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "level" "LogLevel" NOT NULL,
    "module" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_block_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyId" TEXT,
    "symbol" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "detail" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_block_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backtests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "strategyType" "StrategyType" NOT NULL,
    "strategyParams" JSONB NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" "Timeframe" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "initialCapital" DOUBLE PRECISION NOT NULL,
    "finalCapital" DOUBLE PRECISION,
    "totalReturnPct" DOUBLE PRECISION,
    "winRate" DOUBLE PRECISION,
    "totalTrades" INTEGER,
    "winTrades" INTEGER,
    "lossTrades" INTEGER,
    "avgWin" DOUBLE PRECISION,
    "avgLoss" DOUBLE PRECISION,
    "profitFactor" DOUBLE PRECISION,
    "maxDrawdownPct" DOUBLE PRECISION,
    "sharpeRatio" DOUBLE PRECISION,
    "totalFee" DOUBLE PRECISION,
    "feeRate" DOUBLE PRECISION NOT NULL DEFAULT 0.0004,
    "slippagePct" DOUBLE PRECISION NOT NULL DEFAULT 0.0005,
    "tradeLog" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "errorMsg" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backtests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "candle_caches" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "timeframe" "Timeframe" NOT NULL,
    "openTime" TIMESTAMP(3) NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "closeTime" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "candle_caches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "api_configs_userId_key" ON "api_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "engine_states_userId_key" ON "engine_states"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_binanceOrderId_key" ON "orders"("binanceOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "orders_clientOrderId_key" ON "orders"("clientOrderId");

-- CreateIndex
CREATE INDEX "orders_userId_createdAt_idx" ON "orders"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "orders_symbol_createdAt_idx" ON "orders"("symbol", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "orders_strategyId_idx" ON "orders"("strategyId");

-- CreateIndex
CREATE INDEX "positions_userId_status_idx" ON "positions"("userId", "status");

-- CreateIndex
CREATE INDEX "positions_symbol_status_idx" ON "positions"("symbol", "status");

-- CreateIndex
CREATE UNIQUE INDEX "risk_configs_userId_key" ON "risk_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "scanner_configs_userId_key" ON "scanner_configs"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_configs_userId_key" ON "notification_configs"("userId");

-- CreateIndex
CREATE INDEX "notification_logs_userId_sentAt_idx" ON "notification_logs"("userId", "sentAt" DESC);

-- CreateIndex
CREATE INDEX "system_logs_userId_createdAt_idx" ON "system_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "system_logs_level_createdAt_idx" ON "system_logs"("level", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "risk_block_logs_userId_createdAt_idx" ON "risk_block_logs"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "backtests_userId_createdAt_idx" ON "backtests"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "candle_caches_symbol_timeframe_openTime_idx" ON "candle_caches"("symbol", "timeframe", "openTime" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "candle_caches_symbol_timeframe_openTime_key" ON "candle_caches"("symbol", "timeframe", "openTime");

-- AddForeignKey
ALTER TABLE "api_configs" ADD CONSTRAINT "api_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engine_states" ADD CONSTRAINT "engine_states_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "strategies" ADD CONSTRAINT "strategies_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_positionId_fkey" FOREIGN KEY ("positionId") REFERENCES "positions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "strategies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_configs" ADD CONSTRAINT "risk_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scanner_configs" ADD CONSTRAINT "scanner_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_configs" ADD CONSTRAINT "notification_configs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "system_logs" ADD CONSTRAINT "system_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "backtests" ADD CONSTRAINT "backtests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
