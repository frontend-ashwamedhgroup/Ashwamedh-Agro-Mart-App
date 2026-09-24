// Home dashboard for agricultural shopping, crop diagnosis, and nearby stores.
import { Image } from "expo-image";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useAuth } from "../../context/AuthContext";
import { useTheme } from "../../theme";

const categories = [
  {
    name: "Seeds",
    image:
      "https://images.unsplash.com/photo-1586201375761-83865001e31c?auto=format&fit=crop&w=240&q=80",
  },
  {
    name: "Fertilizers",
    image:
      "https://images.unsplash.com/photo-1615811361523-6bd03d7748e7?auto=format&fit=crop&w=240&q=80",
  },
  {
    name: "Crop Protection",
    image:
      "https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=240&q=80",
  },
  {
    name: "Irrigation",
    image:
      "https://images.unsplash.com/photo-1563514227147-6d2ff665a6a0?auto=format&fit=crop&w=240&q=80",
  },
  {
    name: "Equipment",
    image:
      "https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=240&q=80",
  },
];

const shops = [
  {
    name: "Shree Ganesh Krishi Kendra",
    distance: "1.8 km away",
    rating: "4.8 (120+)",
    delivery: "⚡ 2-Hr Delivery",
    badge: "Verified Partner",
    products: "Seeds, Fertilizers & Pesticides",
    stock: "In stock: Urea, Seeds",
  },
  {
    name: "Kisan Seva Kendra",
    distance: "3.4 km away",
    rating: "4.7 (85+)",
    delivery: "Same-Day Delivery",
    badge: "Trusted Seller",
    products: "Bio-Fertilizers & Equipment",
    stock: "In stock: Bio-NPK, DAP",
  },
];

const products = [
  {
    name: "Urea 46% Nitrogen\n(Neem Coated, 45kg)",
    seller: "Kisan Vikas Agri Kendra",
    price: "₹266.50",
    image:
      "https://images.unsplash.com/photo-1589923188900-85dae523342b?auto=format&fit=crop&w=600&q=85",
  },
  {
    name: "Coragen Insecticide\n(60ml)",
    seller: "Guru Nanak Pesticides",
    price: "₹780.00",
    image:
      "https://images.unsplash.com/photo-1599583863916-e7a3aa4e9028?auto=format&fit=crop&w=600&q=85",
  },
];

const navItems = [
  { label: "Home", icon: "⌂" },
  { label: "Orders", icon: "◇" },
  { label: "Cart", icon: "🛒" },
  { label: "Profile", icon: "♙" },
];

export default function DashboardScreen() {
  const { userName, logout } = useAuth();
  const { theme } = useTheme();
  const [search, setSearch] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const user = userName?.trim() || "Ramesh Patel";

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      await logout();
    } catch {
      setIsLoggingOut(false);
      Alert.alert("Logout failed", "Please try again.");
    }
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles.page}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.greetingWrap}>
            <Text style={[styles.greeting, { color: theme.colors.text }]}>
              Namaskar, {user} <Text style={styles.wave}>👋</Text>
            </Text>
            <Text
              style={[styles.location, { color: theme.colors.textSecondary }]}
            >
              ⌖ My Farm, Shirur
            </Text>
          </View>

          <View style={styles.headerActions}>
            <Pressable
              accessibilityLabel="Notifications"
              style={[
                styles.iconButton,
                { backgroundColor: theme.colors.surface },
              ]}
            >
              <Text style={styles.headerIcon}>♟</Text>
              <View style={styles.notificationDot} />
            </Pressable>
            <Pressable
              accessibilityLabel="Logout"
              accessibilityRole="button"
              onPress={handleLogout}
              disabled={isLoggingOut}
              style={[
                styles.logoutButton,
                { backgroundColor: theme.colors.primary },
              ]}
            >
              {isLoggingOut ? (
                <ActivityIndicator
                  size="small"
                  color={theme.colors.onPrimary}
                />
              ) : (
                <Text
                  style={[styles.logoutText, { color: theme.colors.onPrimary }]}
                >
                  Logout
                </Text>
              )}
            </Pressable>
          </View>
        </View>

        <View
          style={[
            styles.searchBox,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <Text style={[styles.searchIcon, { color: theme.colors.text }]}>
            ⌕
          </Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search seeds, fertilizers, products..."
            placeholderTextColor={theme.colors.textSecondary}
            style={[styles.searchInput, { color: theme.colors.text }]}
          />
          <Text style={[styles.micIcon, { color: theme.colors.textSecondary }]}>
            ♩
          </Text>
        </View>

        <SectionHeader title="Shop by Category" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryList}
        >
          {categories.map((category) => (
            <Pressable key={category.name} style={styles.categoryItem}>
              <View
                style={[
                  styles.categoryImageWrap,
                  { backgroundColor: theme.colors.surface },
                ]}
              >
                <Image
                  source={category.image}
                  style={styles.categoryImage}
                  contentFit="cover"
                  transition={180}
                />
              </View>
              <Text
                numberOfLines={1}
                style={[styles.categoryName, { color: theme.colors.text }]}
              >
                {category.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View
          style={[
            styles.doctorCard,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[styles.diagnosisPill, { borderColor: theme.colors.border }]}
          >
            <View
              style={[styles.pillDot, { backgroundColor: theme.colors.text }]}
            />
            <Text style={[styles.pillText, { color: theme.colors.text }]}>
              SMART DIAGNOSIS
            </Text>
          </View>
          <Text style={[styles.doctorTitle, { color: theme.colors.text }]}>
            AI Crop Doctor
          </Text>
          <Text
            style={[styles.doctorCopy, { color: theme.colors.textSecondary }]}
          >
            Identify crop problems using a photo
          </Text>
          <Pressable
            style={[
              styles.primaryButton,
              { backgroundColor: theme.colors.primary },
            ]}
          >
            <Text
              style={[
                styles.primaryButtonText,
                { color: theme.colors.onPrimary },
              ]}
            >
              ▣ Check My Crop
            </Text>
          </Pressable>
        </View>

        <SectionHeader title="Nearby Agri Shops" />
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.shopList}
        >
          {shops.map((shop) => (
            <View
              key={shop.name}
              style={[
                styles.shopCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <View style={styles.shopHeader}>
                <View
                  style={[
                    styles.storeIconWrap,
                    { borderColor: theme.colors.border },
                  ]}
                >
                  <Text style={styles.storeIcon}>▤</Text>
                </View>
                <View style={styles.shopHeading}>
                  <Text
                    numberOfLines={1}
                    style={[styles.shopName, { color: theme.colors.text }]}
                  >
                    {shop.name}
                  </Text>
                  <Text
                    style={[
                      styles.shopMeta,
                      { color: theme.colors.textSecondary },
                    ]}
                  >
                    {shop.distance} • ★ {shop.rating}
                  </Text>
                </View>
              </View>
              <View style={styles.badgeRow}>
                <Text
                  style={[
                    styles.badge,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  {shop.delivery}
                </Text>
                <Text
                  style={[
                    styles.badge,
                    {
                      color: theme.colors.text,
                      borderColor: theme.colors.border,
                    },
                  ]}
                >
                  {shop.badge}
                </Text>
              </View>
              <Text
                numberOfLines={1}
                style={[
                  styles.shopProducts,
                  { color: theme.colors.textSecondary },
                ]}
              >
                {shop.products}
              </Text>
              <View
                style={[
                  styles.shopFooter,
                  { borderTopColor: theme.colors.border },
                ]}
              >
                <Text
                  style={[styles.stock, { color: theme.colors.textSecondary }]}
                >
                  {shop.stock}
                </Text>
                <Pressable
                  style={[
                    styles.smallButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.smallButtonText,
                      { color: theme.colors.onPrimary },
                    ]}
                  >
                    View Shop
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </ScrollView>

        <SectionHeader title="Popular Products" showAction={false} />
        <View style={styles.productGrid}>
          {products.map((product) => (
            <View
              key={product.name}
              style={[
                styles.productCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <Image
                source={product.image}
                style={styles.productImage}
                contentFit="cover"
                transition={180}
              />
              <Text style={[styles.productName, { color: theme.colors.text }]}>
                {product.name}
              </Text>
              <Text
                numberOfLines={1}
                style={[styles.seller, { color: theme.colors.textSecondary }]}
              >
                {product.seller}
              </Text>
              <View
                style={[
                  styles.productFooter,
                  { borderTopColor: theme.colors.border },
                ]}
              >
                <Text style={[styles.price, { color: theme.colors.text }]}>
                  {product.price}
                </Text>
                <Pressable
                  style={[
                    styles.addButton,
                    { backgroundColor: theme.colors.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.addButtonText,
                      { color: theme.colors.onPrimary },
                    ]}
                  >
                    + Add
                  </Text>
                </Pressable>
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            backgroundColor: theme.colors.surface,
            borderTopColor: theme.colors.border,
          },
        ]}
      >
        {navItems.map((item, index) => {
          const active = index === 0;
          const color = active ? theme.colors.text : theme.colors.textMuted;
          return (
            <Pressable key={item.label} style={styles.navItem}>
              <Text style={[styles.navIcon, { color }]}>{item.icon}</Text>
              <Text style={[styles.navLabel, { color }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

function SectionHeader({
  title,
  showAction = true,
}: {
  title: string;
  showAction?: boolean;
}) {
  const { theme } = useTheme();

  return (
    <View style={styles.sectionHeader}>
      <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      {showAction ? (
        <Pressable>
          <Text style={[styles.viewAll, { color: theme.colors.text }]}>
            View All
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  page: { paddingHorizontal: 20, paddingBottom: 112 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 8,
    marginBottom: 20,
  },
  greetingWrap: { flex: 1, paddingRight: 12 },
  greeting: { fontSize: 24, lineHeight: 29, fontWeight: "700" },
  wave: { fontSize: 22 },
  location: { fontSize: 14, marginTop: 3 },
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
  searchIcon: { fontSize: 28, width: 34 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  micIcon: { fontSize: 22, marginLeft: 8 },
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
  categoryImage: { width: "100%", height: "100%" },
  categoryName: { width: 100, textAlign: "center", fontSize: 14 },
  doctorCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 24,
    marginBottom: 38,
  },
  diagnosisPill: {
    width: 176,
    minHeight: 27,
    borderWidth: 1,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  pillDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8 },
  pillText: { fontSize: 12, fontWeight: "600" },
  doctorTitle: { fontSize: 25, fontWeight: "700", marginBottom: 6 },
  doctorCopy: { fontSize: 16, marginLeft: -3, marginBottom: 22 },
  primaryButton: {
    height: 56,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
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
  productGrid: { flexDirection: "row", gap: 12 },
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
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 82,
    borderTopWidth: 1,
    flexDirection: "row",
    paddingBottom: 8,
  },
  navItem: { flex: 1, alignItems: "center", justifyContent: "center" },
  navIcon: { height: 30, fontSize: 27, fontWeight: "700" },
  navLabel: { fontSize: 12, marginTop: 3 },
});
