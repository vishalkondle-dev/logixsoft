export function createMockOrder(params: {
  orderId: string;
  amountInPaise: number;
  merchantName?: string;
  vpa?: string;
}) {
  const merchantName = encodeURIComponent(params.merchantName || 'Demo Merchant');
  const vpa = params.vpa || 'demomerchant@upi';
  const amountRupees = (params.amountInPaise / 100).toFixed(2);
  const note = encodeURIComponent(`Order ${params.orderId}`);

  // Standard NPCI UPI URI scheme specification
  const upiString = `upi://pay?pa=${vpa}&pn=${merchantName}&am=${amountRupees}&tr=${params.orderId}&cu=INR&tn=${note}`;

  return {
    success: true,
    providerTransactionId: `MOCK_TXN_${Date.now()}`,
    upiString,
  };
}

export function createMockMandate(params: {
  mandateId: string;
  recurringAmountInPaise: number;
  maxAmountInPaise: number;
  frequency: string;
  merchantName?: string;
  vpa?: string;
}) {
  const merchantName = encodeURIComponent(params.merchantName || 'Logixsoft Merchant');
  const vpa = params.vpa || 'autopay@logixsoft';
  const recurringAmountRupees = (params.recurringAmountInPaise / 100).toFixed(2);
  const maxAmountRupees = (params.maxAmountInPaise / 100).toFixed(2);
  const note = encodeURIComponent(`Mandate ${params.mandateId}`);

  // NPCI UPI AutoPay Recurring Mandate URI specification
  const upiString = `upi://mandate?pa=${vpa}&pn=${merchantName}&mc=5812&tr=${params.mandateId}&am=${recurringAmountRupees}&cu=INR&recur=${params.frequency}&rule=MAX&cap=${maxAmountRupees}&tn=${note}`;

  return {
    success: true,
    providerSubscriptionId: `MOCK_SUB_${Date.now()}`,
    upiString,
  };
}


