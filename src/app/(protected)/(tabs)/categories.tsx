// Two-pane category browser: category rail on the left, products of the
// selected category as compact tiles on the right.
import { Image } from "expo-image";
import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { TabScreenBody } from "../../../components/shop/TabScreenBody";
import { CategoriesSkeleton, CategoryPaneSkeleton } from "../../../components/shop/Skeletons";
import { ErrorView, MessageView, RefreshFailedNotice } from "../../../components/shop/StateViews";
import { useAsync } from "../../../hooks/useAsync";
import { useProductImageSource } from "../../../hooks/useProductImageSource";
import { fetchCategories, fetchProducts } from "../../../services/shop/api";
import type { Category, Product } from "../../../services/shop/types";
import { useTheme } from "../../../theme";

const RAIL_WIDTH = 92;

export default function CategoriesScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { data, isLoading, error, reload } = useAsync(fetchCategories, []);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const selected =
    data?.find((category) => category.id === selectedId) ?? data?.[0] ?? null;

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>
          {t("navigation.categories")}
        </Text>
      </View>

      <TabScreenBody>
      {isLoading && !data ? (
        <CategoriesSkeleton />
      ) : !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : data.length === 0 ? (
        <MessageView
          title={t("shopping.noCategories")}
          actionLabel={t("shopping.retry")}
          onAction={reload}
        />
      ) : (
        // overflow hidden keeps both scrolling panes inside this box so they
        // never draw over the tab bar below.
        <View style={styles.body}>
          <ScrollView
            style={[
              styles.rail,
              {
                backgroundColor: theme.colors.surface,
                borderRightColor: theme.colors.border,
              },
            ]}
            contentContainerStyle={styles.railContent}
            showsVerticalScrollIndicator={false}
          >
            {data.map((category) => (
              <RailItem
                key={category.id}
                category={category}
                active={category.id === selected?.id}
                onPress={() => setSelectedId(category.id)}
              />
            ))}
          </ScrollView>

          {selected ? <CategoryPane category={selected} /> : null}
        </View>
      )}
      </TabScreenBody>
    </SafeAreaView>
  );
}

function RailItem({
  category,
  active,
  onPress,
}: {
  category: Category;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[
        styles.railItem,
        active && { backgroundColor: theme.colors.background },
      ]}
    >
      <View
        style={[
          styles.railIndicator,
          { backgroundColor: active ? theme.colors.primary : "transparent" },
        ]}
      />
      <View
        style={[
          styles.railBadge,
          {
            backgroundColor: active ? theme.colors.primary : theme.colors.background,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <Text
          style={[
            styles.railBadgeText,
            { color: active ? theme.colors.onPrimary : theme.colors.textSecondary },
          ]}
        >
          {category.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <Text
        numberOfLines={2}
        style={[
          styles.railLabel,
          {
            color: active ? theme.colors.primary : theme.colors.textSecondary,
            fontWeight: active ? "700" : "500",
          },
        ]}
      >
        {category.name}
      </Text>
    </Pressable>
  );
}

function CategoryPane({ category }: { category: Category }) {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { data, isLoading, error, reload } = useAsync(
    () => fetchProducts({ category: category.slug }),
    [category.slug],
  );

  return (
    <View style={styles.pane}>
      {isLoading && !data ? (
        <CategoryPaneSkeleton />
      ) : !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : (
        <>
        <RefreshFailedNotice error={error} onRetry={reload} />
        <FlatList
          key={category.slug}
          data={data}
          keyExtractor={(product) => String(product.id)}
          numColumns={2}
          columnWrapperStyle={styles.tileRow}
          contentContainerStyle={styles.paneContent}
          showsVerticalScrollIndicator={false}
          onRefresh={reload}
          refreshing={isLoading}
          ListHeaderComponent={
            <View style={styles.paneHeader}>
              <Text
                numberOfLines={1}
                style={[styles.paneTitle, { color: theme.colors.text }]}
              >
                {category.name}
              </Text>
              {/* <Pressable
                accessibilityRole="button"
                onPress={() =>
                  router.push({
                    pathname: "/(protected)/products",
                    params: { category: category.slug, title: category.name },
                  })
                }
                hitSlop={8}
              >
                <Text style={[styles.viewAll, { color: theme.colors.primary }]}>
                  {t("shopping.viewAll")}
                </Text>
              </Pressable> */}
            </View>
          }
          ListEmptyComponent={
            <MessageView
              title={t("shopping.noProducts")}
              message={t("shopping.noProductsHint")}
            />
          }
          renderItem={({ item }) => <ProductTile product={item} />}
        />
        </>
      )}
    </View>
  );
}

function ProductTile({ product }: { product: Product }) {
  const { theme } = useTheme();
  const imageSource = useProductImageSource(product);

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
      style={styles.tile}
    >
      <View
        style={[
          styles.tileImage,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        ]}
      >
        {imageSource ? (
          <Image source={imageSource} style={styles.image} contentFit="cover" />
        ) : null}
      </View>
      <Text
        numberOfLines={2}
        style={[styles.tileName, { color: theme.colors.text }]}
      >
        {product.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  title: { fontSize: 24, fontWeight: "700" },
  searchLink: { fontSize: 14, fontWeight: "600" },
  body: { flex: 1, flexDirection: "row", overflow: "hidden" },
  rail: {
    borderRightWidth: StyleSheet.hairlineWidth,
    flexGrow: 0,
    width: RAIL_WIDTH,
  },
  railContent: { paddingBottom: 24 },
  railItem: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 14,
  },
  railIndicator: {
    borderRadius: 2,
    bottom: 12,
    left: 0,
    position: "absolute",
    top: 12,
    width: 4,
  },
  railBadge: {
    alignItems: "center",
    borderRadius: 26,
    borderWidth: 1,
    height: 52,
    justifyContent: "center",
    width: 52,
  },
  railBadgeText: { fontSize: 22, fontWeight: "700" },
  railLabel: { fontSize: 12, textAlign: "center" },
  pane: { flex: 1 },
  paneContent: { flexGrow: 1, gap: 16, padding: 16, paddingBottom: 24 },
  paneHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  paneTitle: { flex: 1, fontSize: 18, fontWeight: "700" },
  viewAll: { fontSize: 13, fontWeight: "600", marginLeft: 8 },
  tileRow: { gap: 12 },
  tile: { flex: 1, gap: 6, maxWidth: "50%" },
  tileImage: {
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
    width: "100%",
  },
  image: { height: "100%", width: "100%" },
  tileName: { fontSize: 12, fontWeight: "500", lineHeight: 16, textAlign: "center" },
});
