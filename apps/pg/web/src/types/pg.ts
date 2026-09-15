export type PaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'EXPIRED';

export type GatewayProvider = 'PAYTM' | 'MOCK';

export type GatewayEnvironment = 'STAGING' | 'PROD';

export interface PaymentOrder {
  id: string;
  orderId: string;
  merchantId: string;
  amount: number; // in paise (100 paise = ₹1.00)
  currency: string;
  status: PaymentStatus;
  provider: GatewayProvider;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  description?: string | null;
  upiString?: string | null;
  providerReferenceId?: string | null;
  bankReferenceNo?: string | null;
  paymentMode?: string | null;
  failureReason?: string | null;
  metadata?: string | null;
  expiresAt?: string | Date | null;
  paidAt?: string | Date | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ProviderCredential {
  id: string;
  userId: string;
  provider: GatewayProvider;
  isActive: boolean;
  merchantName?: string | null;
  vpa?: string | null;
  merchantId?: string | null;
  credentials: Record<string, any>;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface PgCredential {
  id: string;
  userId: string;
  activeProvider: GatewayProvider;
  paytmMerchantId?: string | null;
  paytmMerchantKey?: string | null;
  paytmWebsite?: string | null;
  paytmEnv: 'STAGING' | 'PROD';
  vpa?: string | null;
  merchantName?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface CreateOrderInput {
  amount?: number;
  amountInRupees?: number;
  amountInPaise?: number;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  returnUrl?: string;
}

export interface OrderPublicStatus {
  orderId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  merchantName: string;
  description?: string | null;
  upiString?: string | null;
  provider: GatewayProvider;
  expiresAt?: string | null;
  paidAt?: string | null;
  bankReferenceNo?: string | null;
  failureReason?: string | null;
  isMock: boolean;
}

export interface DashboardStats {
  totalRevenuePaise: number;
  todayRevenuePaise: number;
  totalOrdersCount: number;
  successOrdersCount: number;
  failedOrdersCount: number;
  pendingOrdersCount: number;
  successRatePercentage: number;
  activeProvider: GatewayProvider;
}
