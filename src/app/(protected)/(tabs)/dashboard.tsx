// Home dashboard for agricultural shopping and crop diagnosis.
import { Ionicons } from "@expo/vector-icons";
import { SymbolView } from "expo-symbols";
import { router } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";

import { useAuth } from "../../../context/AuthContext";
import FarmerLocationPicker from "../../../components/location/FarmerLocationPicker";
import { useTheme } from "../../../theme";
import { ProductCard } from "../../../components/shop/ProductCard";
import { ProductGridSkeleton } from "../../../components/shop/Skeletons";
import {
  ErrorView,
  MessageView,
  RefreshFailedNotice,
} from "../../../components/shop/StateViews";
import { useAsync } from "../../../hooks/useAsync";
import { fetchProducts } from "../../../services/shop/api";
import { fetchNotifications } from "../../../services/shop/notifications";

export default function DashboardScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const { t } = useTranslation();
  const {
    data: products,
    isLoading: productsLoading,
    error: productsError,
    reload: reloadProducts,
  } = useAsync(() => fetchProducts(), []);

  const { data: notifications, reload: reloadNotifications } = useAsync(
    () => fetchNotifications().catch(() => []),
    [],
  );
  const refresh = () => Promise.all([reloadProducts(), reloadNotifications()]);
  const hasUnread = (notifications ?? []).some((n) => n.status === "unread");

  const displayName = user?.full_name?.trim() || user?.mobile_number?.trim() || "";

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        refreshControl={<RefreshControl onRefresh={refresh} refreshing={productsLoading} />}
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.greetingWrap}>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>
              {t("dashboard.greeting")}
            </Text>
            <Text style={[styles.wave, { color: theme.colors.text }]}>
              {displayName}{" "}
            </Text>
            <FarmerLocationPicker />
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t("notifications.open")}
            onPress={() => router.push("/(protected)/notifications")}
            style={[
              styles.iconButton,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <SymbolView
              name={{ ios: "bell", android: "notifications", web: "notifications" }}
              tintColor={theme.colors.text}
              size={24}
              accessible={false}
            />
            {hasUnread ? (
              <View
                style={[
                  styles.notificationDot,
                  { backgroundColor: theme.colors.error },
                ]}
              />
            ) : null}
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t("shopping.searchHint")}
          onPress={() =>
            router.push({
              pathname: "/(protected)/products",
              params: { focus: "1" },
            })
          }
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
          <Text
            numberOfLines={1}
            style={[styles.searchPrompt, { color: theme.colors.textSecondary }]}
          >
            {t("shopping.searchHint")}
          </Text>
        </Pressable>

        <View
          style={[
            styles.doctorCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.doctorTitle, { color: theme.colors.text }]}>
            {t("cropDoctor.title")}
          </Text>
          <Text
            style={[styles.doctorCopy, { color: theme.colors.textSecondary }]}
          >
            {t("cropDoctor.heroTitle")}
          </Text>
          <View style={styles.doctorSteps}>
            {(
              [
                ["camera-outline", "cropDoctor.how1Title"],
                ["scan-outline", "cropDoctor.how2Title"],
                ["pricetag-outline", "cropDoctor.how3Title"],
              ] as const
            ).map(([icon, key]) => (
              <View
                key={key}
                style={[
                  styles.doctorStep,
                  { backgroundColor: theme.colors.background },
                ]}
              >
                <Ionicons color={theme.colors.text} name={icon} size={16} />
                <Text
                  numberOfLines={1}
                  style={[styles.doctorStepText, { color: theme.colors.text }]}
                >
                  {t(key)}
                </Text>
              </View>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push("/(protected)/crop-doctor/new")}
            style={({ pressed }) => [
              styles.primaryButton,
              { backgroundColor: theme.colors.primary, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Ionicons color={theme.colors.onPrimary} name="camera" size={20} />
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.onPrimary },
              ]}
            >
              {t("cropDoctor.startNew")}
            </Text>
            <Ionicons
              color={theme.colors.onPrimary}
              name="arrow-forward"
              size={18}
            />
          </Pressable>
        </View>

        <SectionHeader
          title={t("shopping.exploreProducts")}
          onAction={() => router.push("/(protected)/products")}
        />
        {productsLoading && !products ? (
          <ProductGridSkeleton padded={false} />
        ) : !products ? (
          <View style={styles.stateBox}>
            <ErrorView message={productsError} onRetry={reloadProducts} />
          </View>
        ) : products.length === 0 ? (
          <View style={styles.stateBox}>
            <MessageView
              title={t("shopping.noProducts")}
              message={t("shopping.noProductsHint")}
            />
          </View>
        ) : (
          <>
            <RefreshFailedNotice flush error={productsError} onRetry={reloadProducts} />
            <View style={styles.productGrid}>
              {products.slice(0, 6).map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  onAction,
}: {
  title: string;
  onAction?: () => void;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      {onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction}>
          <Text style={[styles.viewAll, { color: theme.colors.text }]}>
            {t("shopping.viewAll")}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  stateBox: { minHeight: 220 },
  page: { paddingHorizontal: 20, paddingBottom: 24 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    marginBottom: 20,
  },
  greetingWrap: { flex: 1, paddingRight: 12 },
  greeting: { fontSize: 24, lineHeight: 29, fontWeight: "700" },
  wave: { fontSize: 22, fontWeight: "700" },
  shopNotice: { fontSize: 13, marginTop: -8, marginBottom: 14 },
  headerActions: { flexDirection: "row", gap: 12 },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  headerIcon: { fontSize: 23, color: "#111111" },
  notificationDot: {
    position: "absolute",
    right: 11,
    top: 10,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#111111",
  },
  logoutButton: {
    minWidth: 72,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  logoutText: { fontSize: 13, fontWeight: "700" },
  searchBox: {
    height: 58,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 32,
  },
  searchPrompt: { flex: 1, fontSize: 16, marginLeft: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 22, fontWeight: "700" },
  viewAll: { fontSize: 14, fontWeight: "600" },
  categoryList: { gap: 16, paddingRight: 20, paddingBottom: 36 },
  categoryItem: { width: 78, alignItems: "center" },
  categoryImageWrap: {
    width: 72,
    height: 72,
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 8,
  },
  categoryInitial: { fontSize: 28, fontWeight: "700" },
  categoryName: { width: 100, textAlign: "center", fontSize: 14 },
  doctorCard: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 20,
    marginBottom: 38,
  },
  doctorIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  doctorTitle: { fontSize: 25, fontWeight: "800", marginBottom: 6 },
  doctorCopy: { fontSize: 15, lineHeight: 21, marginBottom: 16 },
  doctorSteps: { flexDirection: "row", gap: 8, marginBottom: 20 },
  doctorStep: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 10,
  },
  doctorStepText: { flexShrink: 1, fontSize: 12, fontWeight: "600" },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  primaryButtonText: { fontSize: 17, fontWeight: "700" },
  shopList: { gap: 14, paddingRight: 20, paddingBottom: 38 },
  shopCard: { width: 344, borderWidth: 1, borderRadius: 16, padding: 16 },
  shopHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  storeIconWrap: {
    width: 48,
    height: 48,
    borderWidth: 1,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  storeIcon: { fontSize: 25 },
  shopHeading: { flex: 1 },
  shopName: { fontSize: 16, fontWeight: "700", marginBottom: 4 },
  shopMeta: { fontSize: 12 },
  badgeRow: { flexDirection: "row", gap: 8, marginBottom: 10 },
  badge: {
    flexShrink: 1,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 11,
    textAlign: "center",
  },
  shopProducts: { fontSize: 14, marginBottom: 16 },
  shopFooter: {
    minHeight: 51,
    borderTopWidth: 1,
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 12,
  },
  stock: { fontSize: 12, flex: 1, marginRight: 10 },
  smallButton: {
    height: 38,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  smallButtonText: { fontSize: 13, fontWeight: "700" },
  productGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  productCard: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderRadius: 14,
    padding: 12,
  },
  productImage: {
    width: "100%",
    aspectRatio: 1.2,
    borderRadius: 10,
    marginBottom: 12,
  },
  productName: {
    minHeight: 42,
    fontSize: 15,
    lineHeight: 19,
    fontWeight: "600",
  },
  seller: { fontSize: 11, marginTop: 6, marginBottom: 15 },
  productFooter: {
    borderTopWidth: 1,
    paddingTop: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 6,
  },
  price: { flexShrink: 1, fontSize: 18, fontWeight: "700" },
  addButton: {
    height: 40,
    borderRadius: 10,
    paddingHorizontal: 12,
    justifyContent: "center",
  },
  addButtonText: { fontSize: 14, fontWeight: "700" },
});
