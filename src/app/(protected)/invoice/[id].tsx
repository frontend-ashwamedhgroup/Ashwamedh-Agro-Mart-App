// In-app invoice view. Read-only: built from the order and its payment record.
import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { ScreenHeader } from "../../../components/shop/ScreenHeader";
import { CardListSkeleton } from "../../../components/shop/Skeletons";
import { ErrorView, MessageView } from "../../../components/shop/StateViews";
import { useAsync } from "../../../hooks/useAsync";
import { canViewInvoice, fetchOrder, fetchPayment } from "../../../services/shop/orders";
import { useTheme } from "../../../theme";
import { formatPrice, formatQuantity } from "../../../utils/money";

export default function InvoiceScreen() {
  const { theme } = useTheme();
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();

  const { data, isLoading, error, reload } = useAsync(
    async () => {
      const [order, payment] = await Promise.all([fetchOrder(id), fetchPayment(id)]);
      return { order, payment };
    },
    [id],
  );

  const card = { backgroundColor: theme.colors.surface, borderColor: theme.colors.border };
  const name = data?.payment.farmer_name ?? data?.order.farmer_name;
  const mobile = data?.payment.farmer_mobile ?? data?.order.farmer_mobile;

  return (
    <SafeAreaView
      edges={["top", "left", "right", "bottom"]}
      style={[styles.safeArea, { backgroundColor: theme.colors.background }]}
    >
      <ScreenHeader title={t("shopping.invoice")} />
      {isLoading && !data ? (
        <CardListSkeleton count={3} />
      ) : !data ? (
        <ErrorView message={error} onRetry={reload} />
      ) : !canViewInvoice(data.order, data.payment) ? (
        <MessageView title={t("shopping.invoiceUnavailable")} />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={[styles.box, card]}>
            <Text style={[styles.brand, { color: theme.colors.text }]}>{t("shopping.appName")}</Text>
            <View style={styles.line}>
              <Text style={{ color: theme.colors.textMuted }}>{t("shopping.invoiceCode")}</Text>
              <Text style={{ color: theme.colors.text, fontWeight: "600" }}>{data.payment.invoice_code}</Text>
            </View>
            <View style={styles.line}>
              <Text style={{ color: theme.colors.textMuted }}>{t("shopping.orderNumber", { id: data.order.id })}</Text>
              <Text style={{ color: theme.colors.textSecondary }}>
                {new Date(data.order.created_at).toLocaleDateString()}
              </Text>
            </View>
            <View style={styles.line}>
              <Text style={{ color: theme.colors.textMuted }}>{t("shopping.paymentMethod")}</Text>
              <Text style={{ color: theme.colors.textSecondary }}>
                {data.payment.payment_method === "COD" ? t("shopping.payCod") : t("shopping.payOnline")}
              </Text>
            </View>
            <View style={styles.line}>
              <Text style={{ color: theme.colors.textMuted }}>{t("shopping.payment")}</Text>
              <Text style={{ color: theme.colors.success, fontWeight: "700" }}>
                {t(`shopping.paymentStatus.${data.payment.status}`, { defaultValue: data.payment.status })}
              </Text>
            </View>
          </View>

          {name || mobile ? (
            <View style={[styles.box, card]}>
              <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>{t("shopping.billedTo")}</Text>
              {name ? <Text style={{ color: theme.colors.text, fontWeight: "600" }}>{name}</Text> : null}
              {mobile ? <Text style={{ color: theme.colors.textSecondary }}>{mobile}</Text> : null}
              {data.order.delivery_address ? (
                <Text style={{ color: theme.colors.textSecondary, lineHeight: 20 }}>
                  {[
                    data.order.delivery_address.address_line1,
                    data.order.delivery_address.village,
                    data.order.delivery_address.city,
                    data.order.delivery_address.district,
                    data.order.delivery_address.state,
                    data.order.delivery_address.postal_code,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </Text>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.box, card]}>
            {data.order.items.map((line, index) => (
              <View key={line.id ?? index} style={styles.item}>
                <View style={styles.line}>
                  <Text numberOfLines={2} style={[styles.itemName, { color: theme.colors.text }]}>
                    {line.product_name}
                    {line.packing_label ? ` (${line.packing_label})` : ""}
                  </Text>
                  <Text style={{ color: theme.colors.text }}>{formatPrice(line.line_total, data.order.currency)}</Text>
                </View>
                <Text style={{ color: theme.colors.textMuted, fontSize: 12 }}>
                  {t("shopping.qty")} {formatQuantity(line.quantity)} × {formatPrice(line.unit_price, data.order.currency)}
                </Text>
              </View>
            ))}
            <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
            <View style={styles.line}>
              <Text style={{ color: theme.colors.textSecondary }}>{t("shopping.subtotal")}</Text>
              <Text style={{ color: theme.colors.text }}>{formatPrice(data.order.subtotal, data.order.currency)}</Text>
            </View>
            {Number(data.order.delivery_fee) > 0 ? (
              <View style={styles.line}>
                <Text style={{ color: theme.colors.textSecondary }}>{t("shopping.deliveryFee")}</Text>
                <Text style={{ color: theme.colors.text }}>{formatPrice(data.order.delivery_fee, data.order.currency)}</Text>
              </View>
            ) : null}
            <View style={styles.line}>
              <Text style={[styles.totalText, { color: theme.colors.text }]}>{t("shopping.total")}</Text>
              <Text style={[styles.totalText, { color: theme.colors.text }]}>
                {formatPrice(data.payment.total, data.payment.currency)}
              </Text>
            </View>
            {Number(data.payment.amount_received) > 0 ? (
              <View style={styles.line}>
                <Text style={{ color: theme.colors.textSecondary }}>{t("shopping.received")}</Text>
                <Text style={{ color: theme.colors.text }}>
                  {formatPrice(data.payment.amount_received, data.payment.currency)}
                </Text>
              </View>
            ) : null}
            {Number(data.payment.outstanding_amount) > 0 ? (
              <View style={styles.line}>
                <Text style={{ color: theme.colors.textSecondary }}>{t("shopping.outstanding")}</Text>
                <Text style={{ color: theme.colors.text }}>
                  {formatPrice(data.payment.outstanding_amount, data.payment.currency)}
                </Text>
              </View>
            ) : null}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { gap: 12, padding: 20, paddingTop: 4, paddingBottom: 32 },
  box: { borderRadius: 14, borderWidth: 1, gap: 8, padding: 14 },
  brand: { fontSize: 18, fontWeight: "800" },
  line: { flexDirection: "row", gap: 12, justifyContent: "space-between" },
  item: { gap: 2 },
  itemName: { flex: 1, fontWeight: "600" },
  divider: { height: StyleSheet.hairlineWidth },
  totalText: { fontSize: 16, fontWeight: "700" },
});
