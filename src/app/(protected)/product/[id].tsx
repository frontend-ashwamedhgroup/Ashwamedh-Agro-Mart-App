import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { QuantityStepper } from "../../../components/shop/QuantityStepper";
import { ScreenHeader } from "../../../components/shop/ScreenHeader";
import { ProductDetailSkeleton } from "../../../components/shop/Skeletons";
import { ErrorView, RefreshFailedNotice } from "../../../components/shop/StateViews";
import { useCart } from "../../../context/CartContext";
import { useAsync } from "../../../hooks/useAsync";
import { useSingleFlight } from "../../../hooks/useSingleFlight";
import { useProductImageSource } from "../../../hooks/useProductImageSource";
import { fetchProduct } from "../../../services/shop/api";
import type { Product } from "../../../services/shop/types";
import { useTheme } from "../../../theme";
import { formatPrice } from "../../../utils/money";

export default function ProductDetailScreen() {
  const { theme } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: product, isLoading, error, reload } = useAsync(
    () => fetchProduct(id),
    [id],
  );

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={product?.name ?? ""} showCart />
      {isLoading && !product ? (
        <ProductDetailSkeleton />
      ) : !product ? (
        <ErrorView message={error} onRetry={reload} />
      ) : (
        <>
          <RefreshFailedNotice error={error} onRetry={reload} />
          <ProductBody product={product} onRefresh={reload} refreshing={isLoading} />
        </>
      )}
    </SafeAreaView>
  );
}

/** API text fields can be null or empty; treat anything that is not a non-blank string as missing. */
function textOf(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function ProductBody({
  product,
  onRefresh,
  refreshing,
}: {
  product: Product;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { addProduct, cart } = useCart();
  const imageSource = useProductImageSource(product);
  const defaultPacking = product.packings.find((p) => p.is_default) ?? product.packings[0];
  const [packingId, setPackingId] = useState<number | undefined>(defaultPacking?.id);
  const [quantity, setQuantity] = useState(1);
  const [isAdding, setIsAdding] = useState(false);
  const singleFlight = useSingleFlight();

  // Keyed by URI so a refreshed product with a new image URL gets another chance to load.
  const [failedImageUri, setFailedImageUri] = useState<string>();
  const imageFailed = imageSource !== undefined && failedImageUri === imageSource.uri;

  const packing = product.packings.find((p) => p.id === packingId);
  // A packing's own price/stock wins; a null packing price must not borrow another packing's.
  const unitPrice = packing ? packing.unit_price : product.unit_price;
  const currency = packing?.currency ?? product.currency;
  const inStock = Boolean(packing ? packing.in_stock : product.in_stock);
  const onHand = Number(packing?.quantity_on_hand ?? product.quantity_on_hand);
  const available = Number.isFinite(onHand) ? onHand : 0;
  const canBuy = inStock && unitPrice !== null && unitPrice !== undefined;
  const total = unitPrice ? Number(unitPrice) * quantity : null;
  const saleUnit = textOf(packing?.sale_unit) || textOf(product.sale_unit);

  const detailFields = [
    ["category", product.category_name],
    ["saleUnit", saleUnit],
    ["presentation", product.presentation],
    ["activeIngredient", product.active_ingredient],
    ["formulation", product.formulation],
    ["concentration", product.concentration],
    ["cellCount", product.minimum_viable_cell_count],
    ["cropRecommendation", product.crop_recommendation],
    ["targetPests", product.target_pests],
    ["modeOfAction", product.mode_of_action],
    ["applicationMethod", product.application_method],
    ["applicationRate", product.application_rate],
    ["applicationStage", product.application_stage],
    ["compatibility", product.compatibility],
    ["benefits", product.benefits],
  ] as const;
  const detailRows = detailFields
    .map(([key, value]) => ({
      key,
      label: t(`shopping.detail${key[0].toUpperCase()}${key.slice(1)}`),
      value: textOf(value),
    }))
    .filter((row) => row.value);

  const handleAdd = () =>
    singleFlight(async () => {
      setIsAdding(true);
      try {
        await addProduct(product, { packingId, quantity });
        Alert.alert(t("shopping.addedToCart"), undefined, [
          { text: t("shopping.keepShopping"), style: "cancel" },
          { text: t("shopping.viewCart"), onPress: () => router.dismissTo("/(protected)/(tabs)/cart") },
        ]);
      } catch (error: unknown) {
        Alert.alert(
          t("shopping.addError"),
          (error instanceof Error && error.message) || t("shopping.tryAgain"),
        );
      } finally {
        setIsAdding(false);
      }
    });

  const inCart = cart?.items.some((item) => item.product_id === product.id);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl onRefresh={onRefresh} refreshing={refreshing} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.imageWrap, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          {imageSource && !imageFailed ? (
            <Image
              source={imageSource}
              style={styles.image}
              contentFit="contain"
              transition={180}
              onError={() => setFailedImageUri(imageSource.uri)}
            />
          ) : (
            <View style={styles.imageFallback}>
              <Ionicons name="image-outline" size={56} color={theme.colors.textMuted} />
            </View>
          )}
        </View>

        <View style={styles.block}>
          {textOf(product.brand) ? (
            <Text style={[styles.brand, { color: theme.colors.textSecondary }]}>{textOf(product.brand)}</Text>
          ) : null}
          <Text style={[styles.name, { color: theme.colors.text }]}>{product.name}</Text>
          <Text style={[styles.price, { color: theme.colors.text }]}>
            {unitPrice ? formatPrice(unitPrice, currency) : t("shopping.priceUnavailable")}
          </Text>
          <Text style={{ color: inStock ? theme.colors.success : theme.colors.error, fontWeight: "600" }}>
            {inStock ? t("shopping.inStock") : t("shopping.outOfStock")}
          </Text>
        </View>

        {product.packings.length > 1 ? (
          <View style={styles.block}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t("shopping.packSize")}</Text>
            <View style={styles.chips}>
              {product.packings.map((option) => {
                const selected = option.id === packingId;
                return (
                  <Pressable
                    key={option.id}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      setPackingId(option.id);
                      setQuantity(1);
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? theme.colors.primary : theme.colors.surface,
                        borderColor: selected ? theme.colors.primary : theme.colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? theme.colors.onPrimary : theme.colors.text, fontWeight: "600" }}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : textOf(defaultPacking?.label) ? (
          <View style={styles.block}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t("shopping.packSize")}</Text>
            <Text style={{ color: theme.colors.textSecondary }}>{textOf(defaultPacking?.label)}</Text>
          </View>
        ) : null}

        {textOf(product.description) ? (
          <View style={styles.block}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t("shopping.description")}</Text>
            <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{textOf(product.description)}</Text>
          </View>
        ) : null}

        {detailRows.length > 0 ? (
          <View style={styles.block}>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>{t("shopping.detailDetails")}</Text>
            {detailRows.map((row) => (
              <View key={row.key} style={[styles.detailRow, { borderBottomColor: theme.colors.border }]}>
                <Text style={[styles.detailLabel, { color: theme.colors.text }]}>{row.label}</Text>
                <Text style={[styles.description, { color: theme.colors.textSecondary }]}>{row.value}</Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={[styles.sku, { color: theme.colors.textMuted }]}>
          {t("shopping.sku")}: {textOf(product.sku) || t("shopping.notAvailable")}
        </Text>
      </ScrollView>

      <View style={[styles.bar, { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border }]}>
        <QuantityStepper
          value={quantity}
          min={1}
          max={Math.max(1, Math.floor(available))}
          onChange={setQuantity}
          disabled={!canBuy}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ disabled: !canBuy || isAdding }}
          disabled={!canBuy || isAdding}
          onPress={handleAdd}
          style={[styles.addButton, { backgroundColor: theme.colors.primary, opacity: canBuy ? 1 : 0.4 }]}
        >
          {isAdding ? (
            <ActivityIndicator color={theme.colors.onPrimary} />
          ) : (
            <Text style={[styles.addText, { color: theme.colors.onPrimary }]}>
              {inCart ? t("shopping.addMore") : t("shopping.addToCart")}
              {total !== null ? ` · ${formatPrice(total, currency)}` : ""}
            </Text>
          )}
        </Pressable>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: 20, padding: 20, paddingTop: 4, paddingBottom: 28 },
  imageWrap: { borderRadius: 16, borderWidth: 1, height: 240, overflow: "hidden" },
  image: { height: "100%", width: "100%" },
  imageFallback: { alignItems: "center", flex: 1, justifyContent: "center" },
  block: { gap: 6 },
  brand: { fontSize: 13, fontWeight: "600" },
  name: { fontSize: 22, fontWeight: "700", lineHeight: 28 },
  price: { fontSize: 24, fontWeight: "800" },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  description: { fontSize: 14, lineHeight: 21 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { borderRadius: 20, borderWidth: 1, minHeight: 40, paddingHorizontal: 16, justifyContent: "center" },
  detailRow: { borderBottomWidth: StyleSheet.hairlineWidth, gap: 2, paddingVertical: 8 },
  detailLabel: { fontSize: 13, fontWeight: "700" },
  sku: { fontSize: 12 },
  bar: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  addButton: { alignItems: "center", borderRadius: 14, flex: 1, justifyContent: "center", minHeight: 50 },
  addText: { fontSize: 15, fontWeight: "700" },
});
