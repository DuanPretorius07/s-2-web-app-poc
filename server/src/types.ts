export interface JWTPayload {
  userId: string;
  clientId: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

export interface RateRequest {
  contact: {
    fullName: string;
    email: string;
    phone?: string;
  };
  origin: {
    countryCode: string;
    postalCode: string;
    state?: string;
    city?: string;
  };
  destination: {
    countryCode: string;
    postalCode: string;
    state?: string;
    city?: string;
  };
  shipment: {
    shipDate?: string;
    pieces: number;
    totalWeight: number;
    weightUnit: 'LB' | 'KG';
    dimensions?: {
      length: number;
      width: number;
      height: number;
      dimUnit: 'IN' | 'CM';
    };
    description?: string;
  };
  accessorials: {
    residentialDelivery: boolean;
    liftgatePickup: boolean;
    liftgateDelivery: boolean;
    insidePickup: boolean;
    insideDelivery: boolean;
    limitedAccessPickup: boolean;
    limitedAccessDelivery: boolean;
  };
  hubspotContext?: {
    contactId?: string;
    dealId?: string;
    email?: string;
    firstname?: string;
    lastname?: string;
  };
}

export interface NormalizedRate {
  rateId?: string;
  carrierName: string;
  serviceName: string;
  transitDays?: number;
  totalCost: number;
  currency: string;
  rawJson?: any;
}

export interface BookingRequest {
  quoteId: string;
  selectedRateId: string;
}
