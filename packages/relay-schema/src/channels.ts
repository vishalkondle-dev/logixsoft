import { z } from 'zod';

export const ChannelCodeSchema = z.enum([
  'SWIGGY',
  'ZOMATO',
  'MAGICPIN',
  'ONDC',
  'OWNLY',
  'TOING',
]);

export type ChannelCode = z.infer<typeof ChannelCodeSchema>;

export interface ChannelInfo {
  code: ChannelCode;
  name: string;
  type: 'MARKETPLACE' | 'OPEN_NETWORK' | 'DIRECT';
  supportsMenuSync: boolean;
  supportsStockUpdate: boolean;
  supportsStoreStatus: boolean;
  supportsDirectRider: boolean; // if false, requires 3PL or merchant fleet
}

export const CHANNEL_REGISTRY: Record<ChannelCode, ChannelInfo> = {
  SWIGGY: {
    code: 'SWIGGY',
    name: 'Swiggy POS Partner',
    type: 'MARKETPLACE',
    supportsMenuSync: true,
    supportsStockUpdate: true,
    supportsStoreStatus: true,
    supportsDirectRider: true,
  },
  ZOMATO: {
    code: 'ZOMATO',
    name: 'Zomato Food Partner v2',
    type: 'MARKETPLACE',
    supportsMenuSync: true,
    supportsStockUpdate: true,
    supportsStoreStatus: true,
    supportsDirectRider: true,
  },
  MAGICPIN: {
    code: 'MAGICPIN',
    name: 'Magicpin Delivery Hub',
    type: 'MARKETPLACE',
    supportsMenuSync: true,
    supportsStockUpdate: true,
    supportsStoreStatus: true,
    supportsDirectRider: true,
  },
  ONDC: {
    code: 'ONDC',
    name: 'ONDC Beckn Protocol v1.2 BPP',
    type: 'OPEN_NETWORK',
    supportsMenuSync: true,
    supportsStockUpdate: true,
    supportsStoreStatus: true,
    supportsDirectRider: false, // ONDC seller requires 3PL or self-delivery
  },
  OWNLY: {
    code: 'OWNLY',
    name: 'Ownly Direct Ordering',
    type: 'DIRECT',
    supportsMenuSync: true,
    supportsStockUpdate: true,
    supportsStoreStatus: true,
    supportsDirectRider: false,
  },
  TOING: {
    code: 'TOING',
    name: 'Toing Voice & Direct',
    type: 'DIRECT',
    supportsMenuSync: true,
    supportsStockUpdate: true,
    supportsStoreStatus: true,
    supportsDirectRider: false,
  },
};
