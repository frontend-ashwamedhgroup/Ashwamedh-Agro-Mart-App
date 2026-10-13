export type AddressType = "home" | "farm" | "other";

export type FarmerAddress = {
  id: number | string;
  address_type: AddressType;
  label: string;
  address_line1: string;
  address_line2?: string;
  village?: string;
  city: string;
  district: string;
  state: string;
  postal_code: string;
  latitude?: string | null;
  longitude?: string | null;
  is_default?: boolean;
  is_active?: boolean;
};

/** The editable fields of the "add address" form. */
export type AddressDraft = {
  address_type: AddressType;
  address_line1: string;
  village: string;
  city: string;
  district: string;
  state: string;
  postal_code: string;
};

export type Coordinate = {
  latitude: number;
  longitude: number;
};

/** The location the farmer is currently browsing and shopping for. */
export type LocationSelection = {
  label: string;
  address?: Partial<FarmerAddress>;
  coordinate?: Coordinate;
};

export type SearchResult = {
  label: string;
  coordinate: Coordinate;
};

export type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown;
};
