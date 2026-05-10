import { Module } from '@nestjs/common';
import { FuturesService } from './futures.service';
import { FuturesController } from './futures.controller';

@Module({
  providers: [FuturesService],
  controllers: [FuturesController],
  exports: [FuturesService],
})
export class FuturesModule {}
