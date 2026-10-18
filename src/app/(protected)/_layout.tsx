import { Stack } from "expo-router";

import { DETAILS_SHEET_DETENTS } from "../../components/location/utils";
import { CartProvider } from "../../context/CartContext";
import { LocationProvider } from "../../context/LocationContext";

export default function ProtectedLayout() {
  return (
    <LocationProvider>
      <CartProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="orders" />
        <Stack.Screen name="notifications" />
        <Stack.Screen name="wishlist" />
        <Stack.Screen name="products" />
        <Stack.Screen name="product/[id]" />
        <Stack.Screen name="checkout" />
        {/* Swiping back would return to an already-ordered checkout. */}
        <Stack.Screen name="order-success" options={{ gestureEnabled: false }} />
        <Stack.Screen name="order/[id]" />
        <Stack.Screen name="invoice/[id]" />
        <Stack.Screen name="crop-doctor/new" />
        <Stack.Screen name="crop-doctor/[id]" />
        <Stack.Screen name="crop-doctor/checkout" />

        {/* Delivery location flow: select -> map -> details sheet. */}
        {/* Closes only via its close icon; swiping down must not dismiss it. */}
        <Stack.Screen
          name="location"
          options={{ presentation: "modal", gestureEnabled: false }}
        />
        <Stack.Screen
          name="location-map"
          options={{ presentation: "fullScreenModal" }}
        />
        <Stack.Screen
          name="delivery-details"
          options={{
            presentation: "formSheet",
            // Always up while the map is shown; see location-map.tsx.
            gestureEnabled: false,
            // Single fixed height; the form scrolls inside it.
            sheetAllowedDetents: [...DETAILS_SHEET_DETENTS],
            sheetInitialDetentIndex: 0,
            // Keep the map above the sheet usable while it is up.
            sheetLargestUndimmedDetentIndex: 0,
            sheetGrabberVisible: false,
            sheetCornerRadius: 24,
          }}
        />
      </Stack>
      </CartProvider>
    </LocationProvider>
  );
}
