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

