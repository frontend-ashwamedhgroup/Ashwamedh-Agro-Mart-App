import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "../../components/shop/ScreenHeader";
import { CardListSkeleton } from "../../components/shop/Skeletons";
import { ErrorView, MessageView, RefreshFailedNotice } from "../../components/shop/StateViews";
import { useAsync } from "../../hooks/useAsync";
import {
  fetchNotifications,
  markNotificationRead,
  type FarmerNotification,
} from "../../services/shop/notifications";
import { useTheme } from "../../theme";

/** Routes for the known `target_type`s; anything else only shows the message. */
function openTarget(item: FarmerNotification) {
  const id = item.target_id;
  switch (item.target_type) {
    case "order":
    case "delivery":
    case "payment":
      if (id != null) {
        router.push({
          pathname: "/(protected)/order/[id]",
          params: { id: String(id) },
        });
      }
      break;
    case "diagnosis":
      if (id != null) {
        router.push({
          pathname: "/(protected)/crop-doctor/[id]",
          params: { id: String(id) },
        });
      } else {
        router.push("/(protected)/(tabs)/diagnosis");
      }
      break;
    default:
      break;
  }
}

export default function NotificationsScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { data, isLoading, error, reload } = useAsync(fetchNotifications, []);
  const [readIds, setReadIds] = useState<Set<number>>(new Set());

  const isUnread = (item: FarmerNotification) =>
    item.status === "unread" && !readIds.has(item.id);

  const onPress = (item: FarmerNotification) => {
    if (isUnread(item)) {
      setReadIds((previous) => new Set(previous).add(item.id));
      markNotificationRead(item.id).catch((markError: unknown) => {
        console.error("Failed to mark notification read:", markError);
        setReadIds((previous) => {
          const next = new Set(previous);
          next.delete(item.id);
          return next;
        });
      });
    }
    openTarget(item);
  };

  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t("notifications.title")} />
      {isLoading && !data ? (
        <CardListSkeleton />
      ) : !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : (
        <>
        <RefreshFailedNotice error={error} onRetry={reload} />
        <FlatList
          data={data}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={styles.list}
          onRefresh={reload}
          refreshing={isLoading}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <MessageView
              title={t("notifications.empty")}
              message={t("notifications.emptyMsg")}
            />
          }
          renderItem={({ item }) => {
            const unread = isUnread(item);
            return (
              <Pressable
                accessibilityRole="button"
                onPress={() => onPress(item)}
                style={[
                  styles.card,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: unread
                      ? theme.colors.primary
                      : theme.colors.border,
                  },
                ]}
              >
                <View style={styles.row}>
                  <Text
                    style={[styles.category, { color: theme.colors.textMuted }]}
                  >
                    {t(`notifications.${item.category}`, {
                      defaultValue: item.category,
                    })}
                  </Text>
                  {unread ? (
                    <View
                      style={[
                        styles.dot,
                        { backgroundColor: theme.colors.primary },
                      ]}
                    />
                  ) : null}
                </View>
                <Text
                  style={[
                    styles.title,
                    {
                      color: theme.colors.text,
                      fontWeight: unread ? "700" : "500",
                    },
                  ]}
                >
                  {item.title}
                </Text>
                <Text style={{ color: theme.colors.textSecondary }}>
                  {item.message}
                </Text>
                {item.created_at ? (
                  <Text style={[styles.time, { color: theme.colors.textMuted }]}>
                    {new Date(item.created_at).toLocaleString()}
                  </Text>
                ) : null}
              </Pressable>
            );
          }}
        />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  list: { flexGrow: 1, gap: 12, padding: 20, paddingTop: 4, paddingBottom: 30 },
  card: { borderRadius: 16, borderWidth: 1, gap: 4, padding: 16 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  category: { fontSize: 12, fontWeight: "600", textTransform: "uppercase" },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 16 },
  time: { fontSize: 12, marginTop: 4 },
});
