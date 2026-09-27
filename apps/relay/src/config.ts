import process from 'node:process';

export interface RelayConfig {
  port: number;
  nodeEnv: string;
  databaseUrl: string;
  masterEncryptionKey: string; // 32 bytes hex or string for AES-256-GCM
  dineApiUrl: string;
  dineFrontendUrl: string;
  waApiUrl: string;
  defaultOutletId: string;
  fastAckTimeoutMs: number;
  fanoutTimeoutMs: number;
}

export const config: RelayConfig = {
  port: Number(process.env.PORT || 3010),
  nodeEnv: process.env.NODE_ENV || 'development',
  databaseUrl: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/logixsoft',
  masterEncryptionKey:
    process.env.MASTER_ENCRYPTION_KEY ||
    '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', // 64 hex chars = 32 bytes
  dineApiUrl: process.env.DINE_API_URL || 'https://dine-api.logixsoft.in',
  dineFrontendUrl: process.env.DINE_FRONTEND_URL || 'https://dine.logixsoft.in',
  waApiUrl: process.env.WA_API_URL || 'https://wa.logixsoft.in',
  defaultOutletId: process.env.DEFAULT_OUTLET_ID || 'outlet_default',
  fastAckTimeoutMs: 300,
  fanoutTimeoutMs: 1500,
};
