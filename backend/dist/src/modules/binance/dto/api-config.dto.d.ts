export declare class SaveApiConfigDto {
    apiKey: string;
    secretKey: string;
    tradingMode: 'TESTNET' | 'LIVE';
}
export declare class ChangeModeDto {
    mode: 'TESTNET' | 'LIVE';
    confirm: string;
}
