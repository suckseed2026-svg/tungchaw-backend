import { BusinessIndustry } from '../../generated/prisma/enums';

export interface BusinessInventoryDefaults {
  defaultTrackStock: boolean;
  defaultTrackBatch: boolean;
  defaultTrackExpiry: boolean;
  defaultRequireBatchOnPurchase: boolean;
  defaultRequireExpiryOnPurchase: boolean;
  defaultBlockExpiredSale: boolean;
  defaultUseFefo: boolean;
  defaultTrackSerialNumber: boolean;
}

const BASE_DEFAULTS: BusinessInventoryDefaults = {
  defaultTrackStock: true,
  defaultTrackBatch: false,
  defaultTrackExpiry: false,
  defaultRequireBatchOnPurchase: false,
  defaultRequireExpiryOnPurchase: false,
  defaultBlockExpiredSale: false,
  defaultUseFefo: false,
  defaultTrackSerialNumber: false,
};

export function getBusinessInventoryDefaults(
  industry: BusinessIndustry,
): BusinessInventoryDefaults {
  switch (industry) {
    case BusinessIndustry.PHARMACY:
      return {
        ...BASE_DEFAULTS,
        defaultTrackBatch: true,
        defaultTrackExpiry: true,
        defaultRequireBatchOnPurchase: true,
        defaultRequireExpiryOnPurchase: true,
        defaultBlockExpiredSale: true,
        defaultUseFefo: true,
      };
    case BusinessIndustry.MOBILE_ELECTRONICS:
      return {
        ...BASE_DEFAULTS,
        defaultTrackSerialNumber: true,
      };
    case BusinessIndustry.COSMETICS:
    case BusinessIndustry.GROCERY:
      return {
        ...BASE_DEFAULTS,
        defaultTrackExpiry: true,
        defaultBlockExpiredSale: true,
        defaultUseFefo: true,
      };
    default:
      return { ...BASE_DEFAULTS };
  }
}
