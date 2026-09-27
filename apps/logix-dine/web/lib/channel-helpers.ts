export interface ChannelMeta {
  code: 'SWIGGY' | 'ZOMATO' | 'ONDC' | 'MAGICPIN' | string;
  name: string;
  color: string;
  isAggregator: boolean;
  tag?: string;
}

/**
 * Extracts normalized aggregator channel metadata (Swiggy, Zomato, ONDC, Magicpin)
 * from order and delivery records.
 */
export function getOrderChannel(
  order?: { tableNo?: string | null; orderType?: string | null } | null,
  delivery?: { deliveryProvider?: string | null; deliveryMode?: string | null } | null
): ChannelMeta | null {
  const provider = (delivery?.deliveryProvider || '').toUpperCase().trim();
  const tableNo = (order?.tableNo || '').trim();
  const tableUpper = tableNo.toUpperCase();

  // Extract display tag like #SW-8819, #ZOM-5521, etc.
  const tagMatch = tableNo.match(/#([A-Za-z0-9_-]+)/);
  const tag = tagMatch ? tagMatch[0] : undefined;

  if (provider === 'SWIGGY' || tableUpper.startsWith('SWIGGY')) {
    return { code: 'SWIGGY', name: 'Swiggy', color: 'orange', isAggregator: true, tag };
  }
  if (provider === 'ZOMATO' || tableUpper.startsWith('ZOMATO')) {
    return { code: 'ZOMATO', name: 'Zomato', color: 'red', isAggregator: true, tag };
  }
  if (provider === 'ONDC' || tableUpper.startsWith('ONDC')) {
    return { code: 'ONDC', name: 'ONDC', color: 'blue', isAggregator: true, tag };
  }
  if (provider === 'MAGICPIN' || tableUpper.startsWith('MAGICPIN')) {
    return { code: 'MAGICPIN', name: 'Magicpin', color: 'violet', isAggregator: true, tag };
  }
  if (delivery?.deliveryMode === 'THIRD_PARTY') {
    return {
      code: provider || '3PL',
      name: provider || '3PL Delivery',
      color: 'cyan',
      isAggregator: true,
      tag,
    };
  }

  return null;
}
