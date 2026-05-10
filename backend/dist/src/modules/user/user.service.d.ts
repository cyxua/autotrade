import { OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
export declare class UserService implements OnModuleInit {
    private prisma;
    private readonly logger;
    constructor(prisma: PrismaService);
    onModuleInit(): Promise<void>;
    findById(id: string): import(".prisma/client").Prisma.Prisma__UserClient<{
        email: string;
        id: string;
        passwordHash: string;
        loginFailCount: number;
        lockedUntil: Date | null;
        lastLoginAt: Date | null;
        createdAt: Date;
        updatedAt: Date;
    }, null, import("@prisma/client/runtime/library").DefaultArgs>;
}
