import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "../../theme";

export function LoadingView() {
  const { theme } = useTheme();
  return (
    <View style={styles.center} accessibilityState={{ busy: true }}>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

export function MessageView({
  title,
  message,
  actionLabel,
  onAction,
}: {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
      {message ? (
        <Text style={[styles.message, { color: theme.colors.textSecondary }]}>
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button"
          onPress={onAction}
          style={[styles.button, { backgroundColor: theme.colors.primary }]}
        >
          <Text style={[styles.buttonText, { color: theme.colors.onPrimary }]}>
            {actionLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function ErrorView({ message, onRetry }: { message?: string | null; onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <MessageView
      title={t("shopping.loadError")}
      message={message || undefined}
      actionLabel={t("shopping.retry")}
      onAction={onRetry}
    />
  );
}

/**
 * Slim banner for a failed refresh while older data is still on screen, so a
 * network blip never wipes a list the farmer was already looking at.
 */
export function RefreshFailedNotice({
  error,
  onRetry,
  flush = false,
}: {
  error?: string | null;
  onRetry: () => void;
  /** Drop the side margin when the parent already pads its content. */
  flush?: boolean;
}) {
  const { t } = useTranslation();
  const { theme } = useTheme();
  if (!error) return null;
  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.notice,
        flush && styles.noticeFlush,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.error },
      ]}
    >
      <Text style={[styles.noticeText, { color: theme.colors.text }]}>
        {t("network.refreshFailed")}
      </Text>
      <Pressable accessibilityRole="button" hitSlop={8} onPress={onRetry}>
        <Text style={{ color: theme.colors.primary, fontWeight: "700" }}>
          {t("shopping.retry")}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    marginHorizontal: 20,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  noticeFlush: { marginHorizontal: 0 },
  noticeText: { flex: 1, fontSize: 13, lineHeight: 18 },
  center: { alignItems: "center", flex: 1, gap: 8, justifyContent: "center", padding: 32 },
  title: { fontSize: 17, fontWeight: "700", textAlign: "center" },
  message: { fontSize: 14, lineHeight: 20, textAlign: "center" },
  button: { borderRadius: 12, marginTop: 12, paddingHorizontal: 22, paddingVertical: 12 },
  buttonText: { fontSize: 15, fontWeight: "700" },
});
