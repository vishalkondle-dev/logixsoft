import { relayStore } from './index';
import { generateEd25519KeyPair } from '../crypto/ed25519';
import type { OutletCatalog } from '@logixsoft/relay-schema';

export async function seedRelayDatabase(outletId = 'outlet_default') {
  const ondcKeys = generateEd25519KeyPair();

  // 1. Swiggy Integration
  await relayStore.saveOutletIntegration({
    outletId,
    channelCode: 'SWIGGY',
    merchantStoreId: 'swiggy_rest_94821',
    credentials: {
      isLive: false,
      apiKey: 'swiggy_pos_key_test_7788',
      apiSecret: 'swiggy_webhook_secret_xyz123',
      webhookSecret: 'swiggy_webhook_secret_xyz123',
      baseUrl: 'https://api.swiggy.com',
    },
    isOnline: true,
    autoAcceptOrders: false,
    defaultPrepMinutes: 20,
    channelPriceMarkupPercent: 15.0,
  });

  // 2. Zomato Integration
  await relayStore.saveOutletIntegration({
    outletId,
    channelCode: 'ZOMATO',
    merchantStoreId: 'zomato_res_55123',
    credentials: {
      isLive: false,
      apiKey: 'zomato_partner_v2_key_8899',
      apiSecret: 'zomato_webhook_secret_abc456',
      webhookSecret: 'zomato_webhook_secret_abc456',
      baseUrl: 'https://api.zomato.com',
    },
    isOnline: true,
    autoAcceptOrders: false,
    defaultPrepMinutes: 25,
    channelPriceMarkupPercent: 20.0,
  });

  // 3. Magicpin Integration
  await relayStore.saveOutletIntegration({
    outletId,
    channelCode: 'MAGICPIN',
    merchantStoreId: 'magicpin_store_3321',
    credentials: {
      isLive: false,
      apiKey: 'magicpin_api_key_5544',
      apiSecret: 'magicpin_secret_7711',
      webhookSecret: 'magicpin_secret_7711',
      baseUrl: 'https://api.magicpin.in',
    },
    isOnline: true,
    autoAcceptOrders: false,
    defaultPrepMinutes: 20,
    channelPriceMarkupPercent: 10.0,
  });

  // 4. ONDC Beckn Integration
  await relayStore.saveOutletIntegration({
    outletId,
    channelCode: 'ONDC',
    merchantStoreId: 'ondc_bpp_seller_001',
    credentials: {
      subscriberId: 'bpp.logixsoft.in',
      uniqueKeyId: 'key-1',
      signingPrivateKey: ondcKeys.privateKeyPem,
      signingPublicKey: ondcKeys.publicKeyPem,
      signingPublicKeyBase64: ondcKeys.publicKeyBase64,
      bppUri: 'https://relay.logixsoft.in/onboard/beckn/bpp',
    },
    isOnline: true,
    autoAcceptOrders: true,
    defaultPrepMinutes: 15,
    channelPriceMarkupPercent: 0.0, // 0% on ONDC open network
  });

  // 5. Ownly Direct Integration
  await relayStore.saveOutletIntegration({
    outletId,
    channelCode: 'OWNLY',
    merchantStoreId: 'ownly_store_101',
    credentials: {
      apiKey: 'ownly_api_key_direct_991',
      webhookSecret: 'ownly_secret_991',
    },
    isOnline: true,
    autoAcceptOrders: true,
    defaultPrepMinutes: 15,
    channelPriceMarkupPercent: 0.0,
  });

  // 6. Toing Direct Integration
  await relayStore.saveOutletIntegration({
    outletId,
    channelCode: 'TOING',
    merchantStoreId: 'toing_agent_202',
    credentials: {
      apiKey: 'toing_voice_api_key_882',
      webhookSecret: 'toing_secret_882',
    },
    isOnline: true,
    autoAcceptOrders: true,
    defaultPrepMinutes: 15,
    channelPriceMarkupPercent: 0.0,
  });

  // Seed Canonical Menu Catalog
  const catalog: OutletCatalog = {
    outletId,
    name: 'Logix Dine Flagship Kitchen',
    operatingHours: [
      { day: 'MONDAY', openTime: '08:00', closeTime: '23:30', isOpen: true },
      { day: 'TUESDAY', openTime: '08:00', closeTime: '23:30', isOpen: true },
      { day: 'WEDNESDAY', openTime: '08:00', closeTime: '23:30', isOpen: true },
      { day: 'THURSDAY', openTime: '08:00', closeTime: '23:30', isOpen: true },
      { day: 'FRIDAY', openTime: '08:00', closeTime: '23:59', isOpen: true },
      { day: 'SATURDAY', openTime: '08:00', closeTime: '23:59', isOpen: true },
      { day: 'SUNDAY', openTime: '08:00', closeTime: '23:59', isOpen: true },
    ],
    slotTimings: [
      { slotName: 'Breakfast', startTime: '08:00', endTime: '11:30', isAvailable: true },
      { slotName: 'Lunch & Dinner', startTime: '11:30', endTime: '23:30', isAvailable: true },
    ],
    packagingCharges: {
      itemLevelDefault: 15,
      orderLevelDefault: 25,
      maxPackagingCharge: 120,
    },
    taxSlabs: [
      { id: 'tax_gst_5', name: 'GST 5%', ratePercent: 5.0, cgstPercent: 2.5, sgstPercent: 2.5, igstPercent: 0 },
    ],
    channelMarkupSettings: [
      { channelCode: 'SWIGGY', markupPercent: 15.0, roundingMode: 'ROUND' },
      { channelCode: 'ZOMATO', markupPercent: 20.0, roundingMode: 'ROUND' },
      { channelCode: 'MAGICPIN', markupPercent: 10.0, roundingMode: 'ROUND' },
      { channelCode: 'ONDC', markupPercent: 0.0, roundingMode: 'ROUND' },
    ],
    categories: [
      {
        id: 'cat_biryani',
        name: 'Biryanis & Rice Bowls',
        description: 'Dum cooked aromatic basmati rice specialties',
        sortOrder: 1,
        isActive: true,
        items: [
          {
            id: 'item_hyd_dum_biryani',
            title: 'Hyderabadi Chicken Dum Biryani',
            description: 'Slow-cooked in sealed handi with rich saffron and whole spices',
            foodType: 'NON_VEG',
            basePrice: 320,
            taxes: [{ taxId: 'tax_gst_5', ratePercent: 5.0 }],
            packagingFee: 20,
            imageUrls: ['https://images.logixsoft.in/dishes/chicken_biryani.jpg'],
            is86ed: false,
            variantGroups: [
              {
                id: 'vg_portion',
                name: 'Portion Size',
                minSelections: 1,
                maxSelections: 1,
                variants: [
                  { id: 'var_regular', name: 'Regular (Serves 1)', priceModifier: 0, isDefault: true, is86ed: false },
                  { id: 'var_jumbo', name: 'Jumbo (Serves 2-3)', priceModifier: 280, isDefault: false, is86ed: false },
                ],
              },
            ],
            addonGroups: [
              {
                id: 'ag_sides',
                name: 'Extra Sides',
                minSelections: 0,
                maxSelections: 3,
                addons: [
                  { id: 'addon_extra_salan', name: 'Extra Mirchi Ka Salan', price: 40, is86ed: false },
                  { id: 'addon_extra_raita', name: 'Burani Garlic Raita', price: 35, is86ed: false },
                  { id: 'addon_boiled_egg', name: 'Extra Boiled Egg', price: 20, is86ed: false },
                ],
              },
            ],
            channelOverrides: {},
          },
          {
            id: 'item_paneer_biryani',
            title: 'Paneer Makhani Dum Biryani',
            description: 'Fresh malai paneer marinated in curd and fresh ground herbs',
            foodType: 'VEG',
            basePrice: 280,
            taxes: [{ taxId: 'tax_gst_5', ratePercent: 5.0 }],
            packagingFee: 20,
            imageUrls: ['https://images.logixsoft.in/dishes/paneer_biryani.jpg'],
            is86ed: false,
            variantGroups: [],
            addonGroups: [],
            channelOverrides: {},
          },
        ],
      },
      {
        id: 'cat_starters',
        name: 'Tandoori Starters & Kebabs',
        description: 'Charcoal grilled clay oven appetisers',
        sortOrder: 2,
        isActive: true,
        items: [
          {
            id: 'item_chicken_tikka',
            title: 'Classic Chicken Tikka (6 Pcs)',
            description: 'Tender chicken thighs spiced with Kashmiri degi mirch and mustard oil',
            foodType: 'NON_VEG',
            basePrice: 290,
            taxes: [{ taxId: 'tax_gst_5', ratePercent: 5.0 }],
            packagingFee: 15,
            imageUrls: ['https://images.logixsoft.in/dishes/chicken_tikka.jpg'],
            is86ed: false,
            variantGroups: [],
            addonGroups: [],
            channelOverrides: {},
          },
          {
            id: 'item_dahi_ke_kebab',
            title: 'Dahi Ke Kebab (4 Pcs)',
            description: 'Hung curd patties infused with cardamom, cilantro, and green chilies',
            foodType: 'VEG',
            basePrice: 240,
            taxes: [{ taxId: 'tax_gst_5', ratePercent: 5.0 }],
            packagingFee: 15,
            imageUrls: ['https://images.logixsoft.in/dishes/dahi_kebab.jpg'],
            is86ed: false,
            variantGroups: [],
            addonGroups: [],
            channelOverrides: {},
          },
        ],
      },
    ],
  };

  await relayStore.saveOutletMenu(outletId, 'Flagship Master Menu', catalog);

  return { outletId, ondcKeys };
}
