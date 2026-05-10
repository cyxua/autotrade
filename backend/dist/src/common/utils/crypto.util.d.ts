export interface EncryptedData {
    encrypted: string;
    iv: string;
    tag: string;
}
export declare function encrypt(plainText: string, keyHex: string): EncryptedData;
export declare function decrypt(data: EncryptedData, keyHex: string): string;
export declare function maskApiKey(apiKey: string): string;
