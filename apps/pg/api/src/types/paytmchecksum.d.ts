declare module 'paytmchecksum' {
  export default class PaytmChecksum {
    static generateSignature(params: Record<string, any> | string, key: string): Promise<string>;
    static verifySignature(params: Record<string, any> | string, key: string, checksum: string): boolean;
    static generateSignatureByString(params: string, key: string): Promise<string>;
    static verifySignatureByString(params: string, key: string, checksum: string): boolean;
  }
}

