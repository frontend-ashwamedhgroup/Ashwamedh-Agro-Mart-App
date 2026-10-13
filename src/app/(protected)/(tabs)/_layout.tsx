import { useIsFocused } from "expo-router";
import { NativeTabs } from "expo-router/unstable-native-tabs";
import { useTranslation } from "react-i18next";
import { Platform } from "react-native";

import { useCart } from "../../../context/CartContext";
import { useTheme } from "../../../theme";

// iOS only auto-insets the first scroll view; these screens (pinned checkout
// bar, two scrolling panes) handle the tab bar inset via <TabScreenBody>.
const manualInsets = Platform.OS === "ios";

export default function TabsLayout() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { itemCount } = useCart();
  // On iOS, a pushed modal/formSheet (e.g. the location flow) naturally
  // covers the UITabBar. On Android the native bottom nav bar is a
  // persistent view that otherwise stays rendered on top of those screens,
  // hiding their bottom content (sheet buttons, etc.) behind it — so hide it
  // explicitly whenever this tabs screen isn't the focused one.
  const isFocused = useIsFocused();

  return (
    <NativeTabs
      hidden={Platform.OS === "android" && !isFocused}
      backgroundColor={theme.colors.surface}
      tintColor={theme.colors.primary}
      iconColor={{
        default: theme.colors.textMuted,
        selected: theme.colors.primary,
      }}
      labelStyle={{
        default: { color: theme.colors.textMuted },
        selected: { color: theme.colors.primary },
      }}
      labelVisibilityMode="labeled"
    >
      <NativeTabs.Trigger name="dashboard">
        <NativeTabs.Trigger.Label>
          {t("navigation.home")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "house", selected: "house.fill" }}
          md={{ default: "home", selected: "home_filled" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="categories" disableAutomaticContentInsets={manualInsets}>
        <NativeTabs.Trigger.Label>
          {t("navigation.categories")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "square.grid.2x2", selected: "square.grid.2x2.fill" }}
          md={{ default: "category", selected: "category" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="diagnosis">
        <NativeTabs.Trigger.Label>
          {t("navigation.diagnosis")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "leaf", selected: "leaf.fill" }}
          md={{ default: "eco", selected: "eco" }}
        />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="cart" disableAutomaticContentInsets={manualInsets}>
        <NativeTabs.Trigger.Label>
          {t("navigation.cart")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "cart", selected: "cart.fill" }}
          md={{ default: "shopping_cart", selected: "shopping_cart" }}
        />
        <NativeTabs.Trigger.Badge hidden={itemCount === 0}>
          {String(itemCount)}
        </NativeTabs.Trigger.Badge>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>
          {t("navigation.account")}
        </NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: "person.crop.circle", selected: "person.crop.circle.fill" }}
          md={{ default: "person", selected: "person" }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
