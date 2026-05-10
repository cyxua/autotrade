import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  constructor(private prisma: PrismaService) {}

  async send(userId: string, event: string, message: string): Promise<void> {
    try {
      const cfg = await this.prisma.notificationConfig.findUnique({ where: { userId } });
      if (!cfg?.telegramEnabled || !cfg.botToken || !cfg.chatId) return;
      const events = cfg.enabledEvents as Record<string, boolean>;
      if (events[event] === false) return;
      const { default: TelegramBot } = await import('node-telegram-bot-api');
      const bot = new TelegramBot(cfg.botToken, { polling: false });
      await bot.sendMessage(cfg.chatId, message, { parse_mode: 'Markdown' });
      await this.prisma.notificationLog.create({ data: { userId, event: event as any, message, success: true } });
    } catch (err: any) {
      this.logger.error(`Telegram 발송 실패 [${event}]: ${err.message}`);
    }
  }
}
