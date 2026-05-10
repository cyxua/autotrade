import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { BinanceService } from './binance.service';
import { encrypt, maskApiKey } from '../../common/utils/crypto.util';
import { SaveApiConfigDto, ChangeModeDto } from './dto/api-config.dto';

@Injectable()
export class ApiSettingsService {
  constructor(private prisma: PrismaService, private binance: BinanceService, private config: ConfigService) {}

  async getConfig(userId: string) {
    const cfg = await this.prisma.apiConfig.findUnique({ where: { userId } });
    if (!cfg) return { configured: false };
    return { configured: true, apiKey: maskApiKey(cfg.apiKey), hasSecret: true, tradingMode: cfg.tradingMode, isConnected: cfg.isConnected, lastCheckedAt: cfg.lastCheckedAt };
  }

  async saveConfig(userId: string, dto: SaveApiConfigDto) {
    const encKey = this.config.get<string>('ENCRYPTION_KEY') ?? '';
    if (!encKey || encKey.length !== 64) throw new BadRequestException('서버 암호화 키가 설정되지 않았습니다.');
    const { encrypted, iv, tag } = encrypt(dto.secretKey, encKey);
    await this.prisma.apiConfig.upsert({
      where: { userId },
      update: { apiKey: dto.apiKey, encryptedSecret: encrypted, secretIv: iv, secretTag: tag, tradingMode: dto.tradingMode as any, isConnected: false },
      create: { userId, apiKey: dto.apiKey, encryptedSecret: encrypted, secretIv: iv, secretTag: tag, tradingMode: dto.tradingMode as any },
    });
    return { apiKey: maskApiKey(dto.apiKey), tradingMode: dto.tradingMode };
  }

  async testConnection(userId: string) {
    await this.binance.loadApiConfig(userId);
    const ok = await this.binance.ping();
    let canTrade = false;
    let errorMsg: string | null = null;
    if (ok) {
      try { const acc = await this.binance.getAccount(); canTrade = acc.canTrade ?? false; }
      catch (err: any) { errorMsg = err.message; }
    }
    await this.prisma.apiConfig.update({ where: { userId }, data: { isConnected: ok && canTrade, lastCheckedAt: new Date(), lastErrorMsg: errorMsg } });
    if (!ok) throw new BadRequestException({ code: 'API_CONNECTION_FAILED', message: 'Binance API 연결 실패' });
    return { connected: true, canTrade, accountType: 'USDT-M FUTURES', permissions: ['FUTURES'] };
  }

  async changeMode(userId: string, dto: ChangeModeDto) {
    if (dto.mode === 'LIVE' && dto.confirm !== 'LIVE') {
      throw new BadRequestException({ code: 'LIVE_MODE_CONFIRM', message: 'confirm 필드에 "LIVE"를 입력하세요.' });
    }
    await this.prisma.apiConfig.update({ where: { userId }, data: { tradingMode: dto.mode as any, isConnected: false } });
    return { tradingMode: dto.mode };
  }
}
