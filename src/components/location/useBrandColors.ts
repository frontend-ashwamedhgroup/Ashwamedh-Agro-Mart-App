import { useTheme } from "../../theme";

/**
 * Green accent used by the location flow. The app theme is monochrome, so the
 * accent lives here instead of being added to the global palette.
 */
export function useBrandColors() {
  const { mode } = useTheme();

  return mode === "dark"
    ? { brand: "#4CC37A", brandSoft: "#142B1D", onBrand: "#06210F" }
    : { brand: "#1B7F3E", brandSoft: "#E8F5EC", onBrand: "#FFFFFF" };
}
