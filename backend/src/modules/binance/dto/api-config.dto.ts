import { IsString, IsIn, MinLength } from 'class-validator';

export class SaveApiConfigDto {
  @IsString() @MinLength(10)
  apiKey: string;

  @IsString() @MinLength(10)
  secretKey: string;

  @IsIn(['TESTNET', 'LIVE'])
  tradingMode: 'TESTNET' | 'LIVE';
}

export class ChangeModeDto {
  @IsIn(['TESTNET', 'LIVE'])
  mode: 'TESTNET' | 'LIVE';

  @IsString()
  confirm: string;
}
