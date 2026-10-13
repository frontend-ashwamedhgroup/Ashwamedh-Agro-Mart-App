import type * as Location from "expo-location";

import type {
  AddressDraft,
  Coordinate,
  FarmerAddress,
  LocationSelection,
} from "./types";

export const EMPTY_DRAFT: AddressDraft = {
  address_type: "home",
  address_line1: "",
  village: "",
  city: "",
  district: "",
  state: "",
  postal_code: "",
};

/** Used only until a saved address, a search result or the GPS gives a point. */
export const INDIA_CENTER: Coordinate = {
  latitude: 20.5937,
  longitude: 78.9629,
};

export function joinParts(parts: (string | null | undefined)[]): string {
  return parts
    .map((part) => part?.trim())
    .filter((part, index, all): part is string =>
      Boolean(part) && all.indexOf(part) === index,
    )
    .join(", ");
}

/** "Village, City, District" — the short area name shown in headers. */
export function getAreaLabel(
  address: Partial<Pick<FarmerAddress, "village" | "city" | "district">>,
): string {
  return joinParts([address.village, address.city, address.district]);
}

/**
 * The text shown for the chosen location: the farmer's own details first
 * (plot / house no.), then the village and city, e.g. "Plot 12, Nipani, Kolhapur".
 */
export function getDisplayLabel(
  address: Partial<
    Pick<FarmerAddress, "address_line1" | "village" | "city" | "district">
  >,
): string {
  return (
    joinParts([address.address_line1, address.village, address.city]) ||
    getAreaLabel(address)
  );
}

export function getAddressTitle(address: Partial<FarmerAddress>): string {
  return (
    address.address_line1?.trim() ||
    address.village?.trim() ||
    address.city?.trim() ||
    address.label?.trim() ||
    ""
  );
}

export function getAddressSubtitle(address: Partial<FarmerAddress>): string {
  return joinParts([
    address.village,
    address.city,
    address.district,
    address.state,
    address.postal_code,
  ]);
}

export function selectionFromAddress(
  address: Partial<FarmerAddress>,
): LocationSelection {
  const latitude = Number(address.latitude);
  const longitude = Number(address.longitude);
  const hasCoordinate =
    address.latitude != null &&
    address.longitude != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  return {
    label: getDisplayLabel(address),
    address,
    coordinate: hasCoordinate ? { latitude, longitude } : undefined,
  };
}

/**
 * Area fields for a reverse-geocoded pin. Replaces the previous area values so
 * moving the pin never leaves a stale city or PIN code behind; the farmer's
 * own "address details" text and address type are kept.
 */
export function applyGeocodedAddress(
  draft: AddressDraft,
  place: Location.LocationGeocodedAddress | null,
): AddressDraft {
  const city = place?.city ?? place?.subregion ?? "";

  return {
    ...draft,
    village: place?.subregion && place.subregion !== city ? place.subregion : "",
    city,
    district: place?.district ?? place?.subregion ?? place?.city ?? "",
    state: place?.region ?? "",
    postal_code: place?.postalCode ?? "",
  };
}

/** Short place name for a reverse-geocoded point, e.g. "Sahajanand Nagar". */
export function getPlaceTitle(
  place: Location.LocationGeocodedAddress | null,
): string {
  return (
    place?.name?.trim() ||
    place?.street?.trim() ||
    place?.district?.trim() ||
    place?.city?.trim() ||
    ""
  );
}

export function getPlaceSubtitle(
  place: Location.LocationGeocodedAddress | null,
): string {
  return joinParts([place?.city, place?.district, place?.region]);
}

export function isDraftComplete(draft: AddressDraft): boolean {
  return Boolean(
    draft.city.trim() &&
      draft.district.trim() &&
      draft.state.trim() &&
      draft.postal_code.trim(),
  );
}

export function isValidPostalCode(value: string): boolean {
  return /^\d{6}$/.test(value.trim());
}

/**
 * Detent of the delivery-details form sheet: a single fixed height covering
 * this fraction of the screen (the form scrolls inside it). The map screen pads
 * itself by the same fraction so the pin sits in the visible map area.
 */
export const DETAILS_SHEET_DETENTS = [0.58] as const;
