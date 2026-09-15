import PaytmChecksum from 'paytmchecksum';

export interface PaytmConfig {
  merchantId: string;
  merchantKey: string;
  website: string;
  env: 'STAGING' | 'PROD';
}

const PAYTM_HOSTS = {
  STAGING: 'https://securegw-stage.paytm.in',
  PROD: 'https://securegw.paytm.in',
};

export function getPaytmHost(env: 'STAGING' | 'PROD'): string {
  return PAYTM_HOSTS[env] || PAYTM_HOSTS.STAGING;
}

export async function generatePaytmChecksum(
  params: Record<string, any> | string,
  merchantKey: string
): Promise<string> {
  const body = typeof params === 'string' ? params : JSON.stringify(params);
  return await PaytmChecksum.generateSignature(body, merchantKey);
}

export async function verifyPaytmChecksum(
  params: Record<string, any> | string,
  checksum: string,
  merchantKey: string
): Promise<boolean> {
  const body = typeof params === 'string' ? params : JSON.stringify(params);
  return PaytmChecksum.verifySignature(body, merchantKey, checksum);
}

export async function createPaytmOrder(
  config: PaytmConfig,
  params: {
    orderId: string;
    amountInPaise: number;
    customerId: string;
    callbackUrl: string;
    vpa?: string;
    merchantName?: string;
  }
) {
  const host = getPaytmHost(config.env);
  const endpoint = `/theia/api/v1/initiateTransaction?mid=${config.merchantId}&orderId=${params.orderId}`;
  const url = `${host}${endpoint}`;

  const body = {
    requestType: 'Payment',
    mid: config.merchantId,
    websiteName: config.website || 'DEFAULT',
    orderId: params.orderId,
    callbackUrl: params.callbackUrl,
    txnAmount: {
      value: (params.amountInPaise / 100).toFixed(2),
      currency: 'INR',
    },
    userInfo: {
      custId: params.customerId,
    },
  };

  const bodyString = JSON.stringify(body);
  const checksum = await generatePaytmChecksum(bodyString, config.merchantKey);

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      head: {
        signature: checksum,
      },
      body,
    }),
  });

  const data = (await res.json()) as any;
  const txnToken = data.body?.txnToken;

  if (!txnToken) {
    throw new Error(data.body?.resultInfo?.resultMsg || 'Failed to initiate Paytm transaction');
  }

  // Paytm dynamic UPI QR string format using merchant's configured VPA or Paytm MID
  const vpa = params.vpa || `${config.merchantId}@paytm`;
  const name = encodeURIComponent(params.merchantName || 'Paytm Merchant');
  const amountStr = (params.amountInPaise / 100).toFixed(2);
  const upiString = `upi://pay?pa=${vpa}&pn=${name}&am=${amountStr}&tr=${params.orderId}&cu=INR&tn=${encodeURIComponent(`Order ${params.orderId}`)}`;

  return {
    success: true,
    providerTransactionId: txnToken,
    upiString,
    rawResponse: data,
  };
}

export async function checkPaytmStatus(
  config: PaytmConfig,
  orderId: string
) {
  const host = getPaytmHost(config.env);
  const endpoint = `/v5/order/status`;
  const url = `${host}${endpoint}`;

  const body = {
    mid: config.merchantId,
    orderId,
  };

  const bodyString = JSON.stringify(body);
  const checksum = await generatePaytmChecksum(bodyString, config.merchantKey);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        head: {
          signature: checksum,
        },
        body,
      }),
    });

    const data = (await res.json()) as any;
    const resultStatus = data.body?.resultInfo?.resultStatus;
    const resultCode = data.body?.resultInfo?.resultCode;

    if (resultStatus === 'TXN_SUCCESS') {
      return {
        status: 'SUCCESS',
        providerReferenceId: data.body?.txnId,
        bankReferenceNo: data.body?.bankTxnId,
        raw: data,
      };
    }

    // Only mark as FAILED if Paytm explicitly confirms a real failure on an existing transaction
    // Code 334 is "Invalid Order Id" (e.g. order created via direct UPI QR string and waiting for customer to pay or webhook)
    // Code 2005 / CMER-IP101 / 403 are unrecorded or credential mismatches
    // These MUST NOT fail the order - they should stay PENDING waiting for webhook or counter confirmation
    if (resultStatus === 'TXN_FAILURE' && resultCode !== '334') {
      return {
        status: 'FAILED',
        providerReferenceId: data.body?.txnId,
        bankReferenceNo: data.body?.bankTxnId,
        raw: data,
      };
    }

    // Default to PENDING for any unrecorded, in-progress, or dynamic QR fallback transaction
    return {
      status: 'PENDING',
      raw: data,
    };
  } catch (err: any) {
    return {
      status: 'PENDING',
      raw: { error: err.message },
    };
  }
}

