import { IsString, IsBoolean, IsNumber, IsInt, IsOptional, IsObject, Min, Max } from 'class-validator';

export class CreateStrategyDto {
  @IsString() name: string;
  @IsString() @IsOptional() type?: string;   // 기본값 RULE_BASED (service에서 처리)
  @IsString() symbol: string;
  @IsString() timeframe: string;
  @IsNumber() @Min(1) positionSizeUsdt: number;
  @IsInt() @Min(1) @Max(125) leverage: number;
  @IsString() marginType: string;
  @IsBoolean() allowLong: boolean;
  @IsBoolean() allowShort: boolean;
  @IsNumber() @Min(0.1) takeProfitPct: number;
  @IsNumber() @Min(0.1) stopLossPct: number;
  @IsNumber() @Min(0) trailingStopPct: number;
  @IsInt() @Min(1) maxPositions: number;
  @IsNumber() @Min(0) maxDailyLoss: number;
  @IsInt() @Min(1) maxDailyTrades: number;
  @IsInt() @Min(1) stopOnConsecLoss: number;
  @IsObject() @IsOptional() params?: Record<string, any>;
}

export class UpdateStrategyDto extends CreateStrategyDto {}
