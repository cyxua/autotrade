"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var TradingHealthService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingHealthService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../prisma/prisma.service");
const binance_service_1 = require("../binance/binance.service");
const CRITICAL_REASONS = [
    'ENTRY_ORDER_UNPROTECTED', 'SL_ORDER_FAILED',
    'ENTRY_ORDER_STATUS_UNKNOWN', 'POSITION_STILL_OPEN', 'CLOSE_VERIFY_FAILED',
];
function isValidSlAlgo(o, positionAmt) {
    const orderType = o.orderType ?? o.type;
    if (orderType !== 'STOP_MARKET')
        return false;
    const cp = String(o.closePosition);
    if (cp !== 'true' && cp !== 'TRUE')
        return false;
    const valid = ['NEW', 'ACCEPTED', 'WORKING'];
    if (!valid.includes(o.algoStatus))
        return false;
    if (positionAmt > 0 && o.side !== 'SELL')
        return false;
    if (positionAmt < 0 && o.side !== 'BUY')
        return false;
    return true;
}
let TradingHealthService = TradingHealthService_1 = class TradingHealthService {
    prisma;
    binance;
    logger = new common_1.Logger(TradingHealthService_1.name);
    constructor(prisma, binance) {
        this.prisma = prisma;
        this.binance = binance;
    }
    async getTradingHealth(userId) {
        const fetchErrors = [];
        const [activeStrategies, recentBotOrders, recentRiskBlocks] = await Promise.all([
            this.prisma.strategy.findMany({
                where: { userId, enabled: true }, select: { symbol: true },
            }),
            this.prisma.order.findMany({
                where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
                select: { symbol: true },
            }),
            this.prisma.riskBlockLog.findMany({
                where: { userId }, orderBy: { createdAt: 'desc' }, take: 20,
                select: { symbol: true },
            }),
        ]);
        const strategySymbols = activeStrategies.map(s => s.symbol);
        const botOrderSymbols = recentBotOrders.map(o => o.symbol).filter(Boolean);
        const riskBlockSymbols = recentRiskBlocks.map(b => b.symbol).filter(Boolean);
        let apiLoaded = false;
        try {
            await this.binance.loadApiConfig(userId);
            apiLoaded = true;
        }
        catch (e) {
            fetchErrors.push(`API_CONFIG_LOAD_FAILED: ${e.message}`);
        }
        let positions = [];
        let positionSymbols = [];
        if (apiLoaded) {
            try {
                const raw = await this.binance.getPositionsStrict();
                positions = raw
                    .filter((p) => parseFloat(p.positionAmt) !== 0)
                    .map((p) => ({
                    symbol: p.symbol,
                    positionAmt: p.positionAmt,
                    entryPrice: p.entryPrice,
                    markPrice: p.markPrice,
                    unrealizedProfit: p.unRealizedProfit ?? p.unrealizedProfit ?? '0',
                    liquidationPrice: p.liquidationPrice,
                    leverage: p.leverage,
                    marginType: p.marginType,
                }));
                positionSymbols = positions.map(p => p.symbol);
            }
            catch (e) {
                fetchErrors.push(`POSITION_FETCH: ${e.message}`);
            }
        }
        const allSymbols = [...new Set([
                ...positionSymbols, ...strategySymbols,
                ...botOrderSymbols, ...riskBlockSymbols,
            ])];
        let openOrders = [];
        if (apiLoaded) {
            try {
                const raw = await this.binance.getOpenOrders();
                openOrders = raw.map((o) => ({
                    symbol: o.symbol,
                    orderId: o.orderId,
                    type: o.type,
                    side: o.side,
                    price: o.price,
                    quantity: o.origQty,
                    status: o.status,
                }));
            }
            catch (e) {
                fetchErrors.push(`OPEN_ORDERS_FETCH: ${e.message}`);
            }
        }
        let openAlgoOrders = [];
        if (apiLoaded) {
            try {
                if (allSymbols.length > 0) {
                    const results = await Promise.all(allSymbols.map(sym => this.binance.getOpenAlgoOrders(sym).catch(() => [])));
                    openAlgoOrders = results.flat().map((o) => ({
                        symbol: o.symbol,
                        algoId: o.algoId,
                        clientAlgoId: o.clientAlgoId,
                        type: o.orderType ?? o.type,
                        side: o.side,
                        triggerPrice: o.triggerPrice ?? o.stopPrice,
                        algoStatus: o.algoStatus,
                        closePosition: o.closePosition,
                    }));
                }
                else {
                    const raw = await this.binance.getOpenAlgoOrders();
                    openAlgoOrders = raw.map((o) => ({
                        symbol: o.symbol,
                        algoId: o.algoId,
                        clientAlgoId: o.clientAlgoId,
                        type: o.orderType ?? o.type,
                        side: o.side,
                        triggerPrice: o.triggerPrice ?? o.stopPrice,
                        algoStatus: o.algoStatus,
                        closePosition: o.closePosition,
                    }));
                }
            }
            catch (e) {
                fetchErrors.push(`ALGO_ORDERS_FETCH: ${e.message}`);
            }
        }
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const criticalCount = await this.prisma.riskBlockLog.count({
            where: {
                userId,
                reason: { in: CRITICAL_REASONS },
                createdAt: { gte: oneHourAgo },
            },
        });
        const hasOpenPosition = positions.length > 0;
        const hasOpenAlgoOrders = openAlgoOrders.length > 0;
        const hasUnprotectedPosition = positions.some(pos => {
            const posAmt = parseFloat(pos.positionAmt);
            return !openAlgoOrders.some(o => o.symbol === pos.symbol && isValidSlAlgo(o, posAmt));
        });
        const hasCriticalRiskBlock = criticalCount > 0;
        const isSafeToStartAutoTrade = !hasOpenPosition &&
            openOrders.length === 0 &&
            !hasOpenAlgoOrders &&
            !hasCriticalRiskBlock &&
            fetchErrors.length === 0;
        this.logger.debug(`[${userId}] TradingHealth: safe=${isSafeToStartAutoTrade}` +
            ` pos=${hasOpenPosition} orders=${openOrders.length}` +
            ` algo=${hasOpenAlgoOrders} critical=${hasCriticalRiskBlock}` +
            ` scanned=${allSymbols.length}`);
        return {
            flags: {
                isSafeToStartAutoTrade,
                hasOpenPosition,
                hasOpenOrders: openOrders.length > 0,
                hasOpenAlgoOrders,
                hasUnprotectedPosition,
                hasCriticalRiskBlock,
                criticalWindowMinutes: 60,
                scannedSymbols: allSymbols.length,
                fetchErrors,
            },
            positions,
            openOrders,
            openAlgoOrders,
        };
    }
};
exports.TradingHealthService = TradingHealthService;
exports.TradingHealthService = TradingHealthService = TradingHealthService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        binance_service_1.BinanceService])
], TradingHealthService);
//# sourceMappingURL=trading-health.service.js.map