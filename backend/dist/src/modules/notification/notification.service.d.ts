import { PrismaService } from '../../prisma/prisma.service';
export declare class NotificationService {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    send(userId: string, event: string, message: string): Promise<void>;
}
