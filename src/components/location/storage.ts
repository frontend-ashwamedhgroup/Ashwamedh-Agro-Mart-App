import AsyncStorage from "@react-native-async-storage/async-storage";

import type { LocationSelection } from "./types";

const LOCATION_KEY = "@ashwamedhmart_browsing_location";
const RECENT_KEY = "@ashwamedhmart_recent_locations";
const MAX_RECENT = 5;

async function readJson<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch (error: unknown) {
    console.warn(`Could not read ${key}:`, error);
    return null;
  }
}

export async function loadSelection(): Promise<LocationSelection | null> {
  const stored = await readJson<LocationSelection>(LOCATION_KEY);
  return stored?.label ? stored : null;
}

export async function loadRecentSelections(): Promise<LocationSelection[]> {
  const stored = await readJson<LocationSelection[]>(RECENT_KEY);
  return Array.isArray(stored) ? stored.filter((item) => item?.label) : [];
}

/** Saves the active selection and pushes it to the top of the recent list. */
export async function saveSelection(
  selection: LocationSelection,
  recent: LocationSelection[],
): Promise<LocationSelection[]> {
  const nextRecent = [
    selection,
    ...recent.filter(
      (item) => item.label.toLowerCase() !== selection.label.toLowerCase(),
    ),
  ].slice(0, MAX_RECENT);

  await AsyncStorage.multiSet([
    [LOCATION_KEY, JSON.stringify(selection)],
    [RECENT_KEY, JSON.stringify(nextRecent)],
  ]);

  return nextRecent;
}
