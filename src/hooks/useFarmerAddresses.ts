import { useCallback, useRef, useState } from "react";

import type {
  AddressDraft,
  ApiEnvelope,
  Coordinate,
  FarmerAddress,
} from "../components/location/types";
import apiClient from "../services/api/client";
import {
  getErrorMessage,
  InvalidResponseError,
  isRecord,
} from "../services/api/errors";

const ADDRESSES_PATH = "/api/v1/farmer/addresses/";

/** Localized, user-friendly message for any API failure (see services/api/errors). */
export function getApiErrorMessage(error: unknown): string {
  return getErrorMessage(error);
}

type CreateAddressInput = {
  draft: AddressDraft;
  label: string;
  coordinate: Coordinate;
  isDefault: boolean;
};

/** Reads and creates the signed-in farmer's addresses (api.md §6.2). */
export function useFarmerAddresses() {
  const [addresses, setAddresses] = useState<FarmerAddress[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latestLoad = useRef(0);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    // Ignore a refresh while one is already running (no duplicate requests).
    if (inFlight.current) return;
    inFlight.current = true;
    const loadId = ++latestLoad.current;
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.get<
        ApiEnvelope<{ results: FarmerAddress[] }>
      >(ADDRESSES_PATH);
      const results = response.data?.data?.results;

      if (!response.data?.success) {
        throw new Error(response.data?.message);
      }
      if (!Array.isArray(results)) {
        throw new InvalidResponseError("Addresses are not a list.");
      }
      if (loadId === latestLoad.current) {
        setAddresses(
          results.filter(
            (address) => isRecord(address) && address.is_active !== false,
          ),
        );
      }
    } catch (loadError: unknown) {
      console.error("Failed to load farmer addresses:", loadError);
      if (loadId === latestLoad.current) {
        setError(getApiErrorMessage(loadError));
      }
    } finally {
      inFlight.current = false;
      if (loadId === latestLoad.current) {
        setIsLoading(false);
      }
    }
  }, []);

  const createAddress = useCallback(
    async ({ draft, label, coordinate, isDefault }: CreateAddressInput) => {
      const response = await apiClient.post<
        ApiEnvelope<{ address: FarmerAddress }>
      >(
        ADDRESSES_PATH,
        {
          address_type: draft.address_type,
          label,
          address_line1: draft.address_line1.trim(),
          address_line2: "",
          village: draft.village.trim(),
          city: draft.city.trim(),
          district: draft.district.trim(),
          state: draft.state.trim(),
          postal_code: draft.postal_code.trim(),
          latitude: coordinate.latitude.toFixed(6),
          longitude: coordinate.longitude.toFixed(6),
          is_default: isDefault,
          is_active: true,
        },
      );

      // A single object lives under a named key (api.md §3): data.address.
      const created = response.data?.data?.address;

      if (!response.data?.success) {
        throw new Error(response.data?.message);
      }
      if (!isRecord(created)) {
        throw new InvalidResponseError("Created address is missing.");
      }

      setAddresses((current) => [
        created,
        ...current.map((address) =>
          isDefault ? { ...address, is_default: false } : address,
        ),
      ]);
      return created;
    },
    [],
  );

  return { addresses, isLoading, error, refresh, createAddress };
}
