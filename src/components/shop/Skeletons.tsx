// Loading placeholders that mirror the real screens' layouts. Everything pulses
// together from one shared animation so a screen reads as a single shimmer.
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useTheme } from "../../theme";

const PulseContext = createContext<Animated.Value | null>(null);

/** Wraps a skeleton screen: provides the shared pulse and busy semantics. */
function SkeletonRoot({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const [pulse] = useState(() => new Animated.Value(0));

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled || reduce) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulse, {
            toValue: 0,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [pulse]);

  return (
    <PulseContext.Provider value={pulse}>
      <View accessibilityState={{ busy: true }} style={style}>
        {children}
      </View>
    </PulseContext.Provider>
  );
}

export function SkeletonBlock({
  width = "100%",
  height,
  radius = 8,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { theme } = useTheme();
  const pulse = useContext(PulseContext);
  const opacity = pulse
    ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] })
    : 0.7;
  return (
    <Animated.View
      style={[
        { backgroundColor: theme.colors.border, borderRadius: radius, height, opacity, width },
        style,
      ]}
    />
  );
}

function CardShell({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Matches ProductCard's grid cell. */
function ProductCardSkeleton() {
  return (
    <CardShell style={styles.gridCell}>
      <SkeletonBlock height={120} radius={0} />
      <View style={styles.cardBody}>
        <SkeletonBlock height={14} />
        <SkeletonBlock height={14} width="65%" />
        <SkeletonBlock height={12} width="45%" />
      </View>
      <View style={styles.cardFooter}>
        <SkeletonBlock height={16} width={64} />
        <SkeletonBlock height={34} width={56} radius={10} />
      </View>
    </CardShell>
  );
}

/** Two-column grid of product cards; `count` should be even. */
export function ProductGridSkeleton({
  count = 6,
  padded = true,
}: {
  count?: number;
  padded?: boolean;
}) {
  return (
    <SkeletonRoot style={[styles.grid, padded && styles.gridPadded]}>
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </SkeletonRoot>
  );
}

/** Right-hand pane of the categories screen. */
export function CategoryPaneSkeleton() {
  return (
    <SkeletonRoot style={styles.pane}>
      <SkeletonBlock height={20} width="50%" />
      <View style={styles.tileRow}>
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={styles.tile}>
            <SkeletonBlock radius={14} style={styles.tileImage} />
            <SkeletonBlock height={12} width="80%" style={styles.tileLabel} />
          </View>
        ))}
      </View>
    </SkeletonRoot>
  );
}

/** Whole categories body: rail + pane. */
export function CategoriesSkeleton() {
  const { theme } = useTheme();
  return (
    <SkeletonRoot style={styles.categories}>
      <View
        style={[
          styles.rail,
          { backgroundColor: theme.colors.surface, borderRightColor: theme.colors.border },
        ]}
      >
        {Array.from({ length: 6 }, (_, i) => (
          <View key={i} style={styles.railItem}>
            <SkeletonBlock height={52} width={52} radius={26} />
            <SkeletonBlock height={10} width={44} />
          </View>
        ))}
      </View>
      <View style={styles.flex}>
        <CategoryPaneSkeleton />
      </View>
    </SkeletonRoot>
  );
}

/** Cart lines plus the pinned summary. */
export function CartSkeleton() {
  const { theme } = useTheme();
  return (
    <SkeletonRoot style={styles.flex}>
      <View style={styles.cartList}>
        {Array.from({ length: 3 }, (_, i) => (
          <CardShell key={i} style={styles.cartItem}>
            <View style={styles.rowBetween}>
              <View style={styles.cartText}>
                <SkeletonBlock height={15} width="70%" />
                <SkeletonBlock height={12} width="45%" />
              </View>
              <SkeletonBlock height={15} width={56} />
            </View>
            <View style={styles.rowBetween}>
              <SkeletonBlock height={36} width={110} radius={10} />
              <SkeletonBlock height={14} width={52} />
            </View>
          </CardShell>
        ))}
      </View>
      <View
        style={[
          styles.summary,
          { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        ]}
      >
        <View style={styles.rowBetween}>
          <SkeletonBlock height={14} width={70} />
          <SkeletonBlock height={14} width={60} />
        </View>
        <View style={styles.rowBetween}>
          <SkeletonBlock height={18} width={50} />
          <SkeletonBlock height={18} width={70} />
        </View>
        <SkeletonBlock height={52} radius={14} style={styles.summaryButton} />
      </View>
    </SkeletonRoot>
  );
}

/** Product detail: image, title block, pack chips, description and add bar. */
export function ProductDetailSkeleton() {
  const { theme } = useTheme();
  return (
    <SkeletonRoot style={styles.flex}>
      <View style={styles.detail}>
        <SkeletonBlock height={240} radius={16} />
        <View style={styles.block}>
          <SkeletonBlock height={13} width={90} />
          <SkeletonBlock height={24} width="80%" />
          <SkeletonBlock height={26} width={110} />
          <SkeletonBlock height={14} width={70} />
        </View>
        <View style={styles.block}>
          <SkeletonBlock height={16} width={90} />
          <View style={styles.chips}>
            <SkeletonBlock height={40} width={84} radius={20} />
            <SkeletonBlock height={40} width={84} radius={20} />
            <SkeletonBlock height={40} width={84} radius={20} />
          </View>
        </View>
        <View style={styles.block}>
          <SkeletonBlock height={16} width={110} />
          <SkeletonBlock height={13} />
          <SkeletonBlock height={13} />
          <SkeletonBlock height={13} width="60%" />
        </View>
        <View style={styles.block}>
          <SkeletonBlock height={16} width={130} />
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={styles.detailRow}>
              <SkeletonBlock height={13} width={100} />
              <SkeletonBlock height={13} width={row % 2 ? "70%" : "90%"} />
            </View>
          ))}
        </View>
      </View>
      <View
        style={[
          styles.bar,
          { backgroundColor: theme.colors.surface, borderTopColor: theme.colors.border },
        ]}
      >
        <SkeletonBlock height={40} width={110} radius={10} />
        <SkeletonBlock height={50} radius={14} style={styles.flex} />
      </View>
    </SkeletonRoot>
  );
}

/** Generic stacked cards, used for the orders list and order detail. */
export function CardListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <SkeletonRoot style={styles.cardList}>
      {Array.from({ length: count }, (_, i) => (
        <CardShell key={i} style={styles.listCard}>
          <View style={styles.rowBetween}>
            <SkeletonBlock height={16} width={110} />
            <SkeletonBlock height={16} width={64} />
          </View>
          <SkeletonBlock height={13} width="55%" />
          <SkeletonBlock height={13} width="80%" />
        </CardShell>
      ))}
    </SkeletonRoot>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  gridCell: { flexGrow: 1, width: "48%" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridPadded: { padding: 20, paddingTop: 6 },
  cardBody: { gap: 8, padding: 12, paddingBottom: 10 },
  cardFooter: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 12,
  },
  categories: { flex: 1, flexDirection: "row" },
  rail: { borderRightWidth: StyleSheet.hairlineWidth, width: 92 },
  railItem: { alignItems: "center", gap: 8, paddingVertical: 14 },
  pane: { gap: 16, padding: 16 },
  tileRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: { flexGrow: 1, gap: 6, width: "46%" },
  tileImage: { aspectRatio: 1 },
  tileLabel: { alignSelf: "center" },
  cartList: { flex: 1, gap: 12, padding: 20, paddingTop: 8 },
  cartItem: { gap: 12, padding: 14 },
  cartText: { flex: 1, gap: 8 },
  rowBetween: { alignItems: "center", flexDirection: "row", gap: 12, justifyContent: "space-between" },
  summary: { borderTopWidth: StyleSheet.hairlineWidth, gap: 12, padding: 20 },
  summaryButton: { marginTop: 4 },
  detail: { flex: 1, gap: 20, padding: 20, paddingTop: 4 },
  block: { gap: 8 },
  chips: { flexDirection: "row", gap: 10 },
  detailRow: { gap: 6, paddingVertical: 4 },
  bar: {
    alignItems: "center",
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  cardList: { gap: 12, padding: 20, paddingTop: 8 },
  listCard: { gap: 10, padding: 16 },
});
