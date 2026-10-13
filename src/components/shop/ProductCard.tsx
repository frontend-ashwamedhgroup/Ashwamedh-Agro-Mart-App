import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";

import { useCart } from "../../context/CartContext";
import { useSingleFlight } from "../../hooks/useSingleFlight";
import { useProductImageSource } from "../../hooks/useProductImageSource";
import type { Product } from "../../services/shop/types";
import { useTheme } from "../../theme";
import { formatPrice } from "../../utils/money";

type Props = {
  product: Product;
  /** Fixed width for horizontal lists; defaults to a 2-column grid cell. */
  width?: number;
};

export function ProductCard({ product, width }: Props) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { addProduct } = useCart();
  const imageSource = useProductImageSource(product);
  const [isAdding, setIsAdding] = useState(false);
  const singleFlight = useSingleFlight();

  const canBuy = product.in_stock && product.unit_price !== null;
  const defaultPacking = product.packings.find((p) => p.is_default);
  const price = defaultPacking?.unit_price ?? product.unit_price;

  const handleAdd = () =>
    singleFlight(async () => {
      setIsAdding(true);
      try {
        await addProduct(product);
      } catch (error: unknown) {
        Alert.alert(
          t("shopping.addError"),
          (error instanceof Error && error.message) || t("shopping.tryAgain"),
        );
      } finally {
        setIsAdding(false);
      }
    });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={product.name}
      onPress={() =>
        router.push({
          pathname: "/(protected)/product/[id]",
          params: { id: String(product.id) },
        })
      }
      style={[
        styles.card,
        width ? { width, flexGrow: 0 } : styles.gridCell,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
      ]}
    >
      <View style={[styles.imageWrap, { backgroundColor: theme.colors.background }]}>
        {imageSource ? (
          <Image
            source={imageSource}
            style={styles.image}
            contentFit="cover"
            transition={180}
          />
        ) : null}
        {!product.in_stock ? (
          <View style={styles.stockBadge}>
            <Text style={styles.stockBadgeText}>{t("shopping.outOfStock")}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text numberOfLines={2} style={[styles.name, { color: theme.colors.text }]}>
          {product.name}
        </Text>
        <Text numberOfLines={1} style={[styles.meta, { color: theme.colors.textSecondary }]}>
          {[product.brand, defaultPacking?.label ?? product.presentation]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
        <Text style={[styles.price, { color: theme.colors.text }]}>
          {price ? formatPrice(price, product.currency) : t("shopping.priceUnavailable")}
        </Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("shopping.addToCart")}
          accessibilityState={{ disabled: !canBuy || isAdding }}
          disabled={!canBuy || isAdding}
          onPress={handleAdd}
          hitSlop={6}
          style={[
            styles.addButton,
            { backgroundColor: theme.colors.primary, opacity: canBuy ? 1 : 0.4 },
          ]}
        >
          {isAdding ? (
            <ActivityIndicator size="small" color={theme.colors.onPrimary} />
          ) : (
            <Text style={[styles.addButtonText, { color: theme.colors.onPrimary }]}>
              {t("shopping.add")}
            </Text>
          )}
        </Pressable>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  gridCell: { width: "48%", flexGrow: 1 },
  imageWrap: { height: 120, width: "100%" },
  image: { height: "100%", width: "100%" },
  stockBadge: {
    backgroundColor: "rgba(0,0,0,0.65)",
    borderRadius: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    position: "absolute",
    top: 8,
  },
  stockBadgeText: { color: "#fff", fontSize: 11, fontWeight: "600" },
  body: { gap: 3, padding: 12, paddingBottom: 10 },
  name: { fontSize: 14, fontWeight: "600", lineHeight: 19, minHeight: 38 },
  meta: { fontSize: 12 },
  footer: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
  },
  price: { flexShrink: 1, fontSize: 15, fontWeight: "700" },
  addButton: {
    alignItems: "center",
    borderRadius: 10,
    justifyContent: "center",
    minHeight: 34,
    minWidth: 56,
    paddingHorizontal: 12,
  },
  addButtonText: { fontSize: 13, fontWeight: "700" },
});
