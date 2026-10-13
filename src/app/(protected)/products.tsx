// Product list with search: every product, or one category. Also the target of
// the home search box (opened with `focus=1` so the keyboard comes up).
import { SymbolView } from "expo-symbols";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ProductCard } from "../../components/shop/ProductCard";
import { ScreenHeader } from "../../components/shop/ScreenHeader";
import { ProductGridSkeleton } from "../../components/shop/Skeletons";
import { ErrorView, MessageView, RefreshFailedNotice } from "../../components/shop/StateViews";
import { useAsync } from "../../hooks/useAsync";
import { fetchProducts } from "../../services/shop/api";
import { useTheme } from "../../theme";

const SEARCH_DEBOUNCE_MS = 350;

export default function ProductsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { category, title, focus } = useLocalSearchParams<{
    category?: string;
    title?: string;
    focus?: string;
  }>();

  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");

  // Debounced server-side search (name, brand, SKU, description).
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const { data, isLoading, error, reload } = useAsync(
    () => fetchProducts({ category, search }),
    [category, search],
  );

  const isSearching = search !== "";

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={title || t("shopping.allProducts")} showCart />

      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <SymbolView
          name={{ ios: "magnifyingglass", android: "search", web: "search" }}
          tintColor={theme.colors.textSecondary}
          size={22}
          accessible={false}
        />
        <TextInput
          accessibilityLabel={t("shopping.searchHint")}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={focus === "1"}
          onChangeText={setQuery}
          placeholder={t("shopping.searchHint")}
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="search"
          style={[styles.searchInput, { color: theme.colors.text }]}
          value={query}
        />
        {query.length > 0 ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("shopping.clearSearch")}
            onPress={() => setQuery("")}
            hitSlop={8}
            style={styles.clearButton}
          >
            <SymbolView
              name={{ ios: "xmark.circle.fill", android: "cancel", web: "cancel" }}
              tintColor={theme.colors.textMuted}
              size={20}
              accessible={false}
            />
          </Pressable>
        ) : null}
      </View>

      {isLoading && !data ? (
        <ProductGridSkeleton count={8} />
      ) : error !== null && !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : (
        <>
        <RefreshFailedNotice error={error} onRetry={reload} />
        <FlatList
          data={data}
          keyExtractor={(product) => String(product.id)}
          numColumns={2}
          columnWrapperStyle={styles.row}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => <ProductCard product={item} />}
          onRefresh={reload}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <MessageView
              title={
                isSearching ? t("shopping.searchNoResults") : t("shopping.noProducts")
              }
              message={
                isSearching
                  ? t("shopping.searchTryAnother")
                  : t("shopping.noProductsHint")
              }
            />
          }
        />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  searchBox: {
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 12,
    minHeight: 50,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 16, minHeight: 48, paddingVertical: 0 },
  clearButton: {
    alignItems: "center",
    height: 36,
    justifyContent: "center",
    width: 32,
  },
  list: { flexGrow: 1, gap: 12, padding: 20, paddingTop: 6, paddingBottom: 32 },
  row: { gap: 12 },
});
