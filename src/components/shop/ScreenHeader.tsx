import { SymbolView } from "expo-symbols";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useCart } from "../../context/CartContext";
import { useTheme } from "../../theme";

type Props = {
  title: string;
  /** Shows a cart shortcut with the item count on the right. */
  showCart?: boolean;
};

export function ScreenHeader({ title, showCart = false }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { itemCount } = useCart();
  return (
    <View style={styles.header}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t("shopping.searchBack")}
        onPress={() => router.back()}
        hitSlop={8}
        style={styles.back}
      >
        <SymbolView
          name={{ ios: "chevron.left", android: "arrow_back", web: "arrow_back" }}
          tintColor={theme.colors.text}
          size={24}
          accessible={false}
        />
      </Pressable>
      <Text numberOfLines={1} style={[styles.title, { color: theme.colors.text }]}>
        {title}
      </Text>
      {showCart ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("navigation.cart")}
          onPress={() => router.push("/(protected)/(tabs)/cart")}
          hitSlop={8}
          style={styles.cart}
        >
          <SymbolView
            name={{ ios: "cart", android: "shopping_cart", web: "shopping_cart" }}
            tintColor={theme.colors.text}
            size={26}
            accessible={false}
          />
          {itemCount > 0 ? (
            <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
              <Text style={[styles.badgeText, { color: theme.colors.onPrimary }]}>
                {itemCount > 99 ? "99+" : itemCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: "center",
    flexDirection: "row",
    gap: 14,
    paddingBottom: 14,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  back: { alignItems: "center", height: 40, justifyContent: "center", width: 32 },
  title: { flex: 1, fontSize: 22, fontWeight: "700" },
  cart: { alignItems: "center", height: 40, justifyContent: "center", width: 40 },
  badge: {
    alignItems: "center",
    borderRadius: 9,
    height: 18,
    justifyContent: "center",
    minWidth: 18,
    paddingHorizontal: 4,
    position: "absolute",
    right: 0,
    top: 2,
  },
  badgeText: { fontSize: 10, fontWeight: "700" },
});
