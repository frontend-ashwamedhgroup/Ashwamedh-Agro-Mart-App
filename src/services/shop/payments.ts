// Razorpay online payment for a placed order.
//
// Flow: backend creates the Razorpay order (the amount comes from the server)
// -> native checkout sheet -> backend verifies the signature. Only the server's
// webhook marks the invoice paid; the client never decides that a payment succeeded.
import { AppState, DeviceEventEmitter } from "react-native";
import RazorpayCheckout from "react-native-razorpay";

import type { ApiEnvelope } from "../../components/location/types";
import apiClient from "../api/client";
import { isRetryableError } from "../api/errors";

const PAYMENTS = "/api/v1/farmer/payments/razorpay";

/** Public key id only. The key secret must never ship in the app. */
const ENV_KEY_ID = process.env.EXPO_PUBLIC_RAZORPAY_KEY_ID;

/** Test logging. Filter the Metro/logcat output on "[Payment]". Signatures are masked. */
export function logPayment(step: string, details?: unknown): void {
  console.log(`[Payment] ${step}`, details === undefined ? "" : JSON.stringify(details, null, 2));
}

const mask = (value: string) => (value.length > 8 ? `${value.slice(0, 4)}…${value.slice(-4)}` : "***");

export type RazorpayOrder = {
  keyId: string;
  razorpayOrderId: string;
  /** Smallest currency unit (paise for INR). */
  amount: number;
  currency: string;
};

export type RazorpaySuccess = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

export type PayerInfo = { name?: string; email?: string; contact?: string };

export class PaymentCancelledError extends Error {
  constructor() {
    super("Payment cancelled");
    this.name = "PaymentCancelledError";
  }
}

type Loose = Record<string, unknown>;

function str(value: unknown): string | undefined {
  return typeof value === "string" && value ? value : undefined;
}

/** The backend wraps the Razorpay order in different shapes; accept them all. */
function parseRazorpayOrder(data: Loose): RazorpayOrder {
  const nested = (data.razorpay_order ?? data.razorpay ?? data.payment ?? data) as Loose;
  // `order_id` is our own numeric order id; the Razorpay order id is a string like "order_xxx".
  const razorpayOrderId =
    str(nested.gateway_order_id) ?? str(nested.razorpay_order_id) ?? str(data.gateway_order_id) ?? str(data.razorpay_order_id);
  const keyId = str(nested.key_id) ?? str(nested.key) ?? str(data.key_id) ?? str(data.key) ?? ENV_KEY_ID;
  const amount = Number(nested.amount ?? data.amount);
  if (!razorpayOrderId || !keyId || !Number.isFinite(amount)) {
    throw new Error("Unexpected payment response from server.");
  }
  return {
    keyId,
    razorpayOrderId,
    amount,
    currency: str(nested.currency) ?? str(data.currency) ?? "INR",
  };
}

function describeError(error: unknown) {
  const e = error as { message?: string; response?: { status?: number; data?: unknown } };
  return { message: e?.message, status: e?.response?.status, body: e?.response?.data };
}

export async function createRazorpayOrder(orderId: number | string): Promise<RazorpayOrder> {
  logPayment("create order → request", { order_id: Number(orderId), envKeyPresent: !!ENV_KEY_ID });
  try {
    const { data } = await apiClient.post<ApiEnvelope<Loose>>(`${PAYMENTS}/order/`, {
      order_id: Number(orderId),
    });
    logPayment("create order ← response", data);
    if (!data.success || data.data === null) throw new Error(data.message);
    const parsed = parseRazorpayOrder(data.data);
    logPayment("create order parsed", { ...parsed, keyId: mask(parsed.keyId) });
    return parsed;
  } catch (error) {
    logPayment("create order ✗ failed", describeError(error));
    throw error;
  }
}

export async function verifyRazorpayPayment(
  result: RazorpaySuccess,
): Promise<void> {
  const body = {
    razorpay_order_id: result.razorpay_order_id,
    razorpay_payment_id: result.razorpay_payment_id,
    razorpay_signature: result.razorpay_signature,
  };
  logPayment("verify → request", { ...body, razorpay_signature: mask(body.razorpay_signature) });
  try {
    const { data } = await apiClient.post<ApiEnvelope<unknown>>(`${PAYMENTS}/verify/`, body);
    logPayment("verify ← response", data);
    if (!data.success) throw new Error(data.message);
  } catch (error) {
    logPayment("verify ✗ failed", describeError(error));
    throw error;
  }
}

// Razorpay Android codes: 0 = network error, 2 = user cancelled; iOS cancel is 2 as well.
const CANCEL_CODE = 2;

function openCheckout(
  order: RazorpayOrder,
  title: string,
  description: string,
  payer: PayerInfo,
  color: string,
): Promise<RazorpaySuccess> {
  logPayment("checkout sheet → open", {
    order_id: order.razorpayOrderId,
    amount: order.amount,
    currency: order.currency,
    key: mask(order.keyId),
  });
  // Diagnostics only: log the raw native events and app state while the sheet is up,
  // so a missing "← success" log can be told apart from an event that never arrived.
  const subs = [
    DeviceEventEmitter.addListener("Razorpay::PAYMENT_SUCCESS", (e) => logPayment("RAW native event PAYMENT_SUCCESS", e && { ...e, razorpay_signature: mask(String(e.razorpay_signature ?? "")) })),
    DeviceEventEmitter.addListener("Razorpay::PAYMENT_ERROR", (e) => logPayment("RAW native event PAYMENT_ERROR", e)),
    AppState.addEventListener("change", (state) => logPayment("app state", state)),
  ];
  return RazorpayCheckout.open({
    key: order.keyId,
    order_id: order.razorpayOrderId,
    amount: order.amount,
    currency: order.currency,
    name: title,
    description,
    prefill: payer,
    theme: { color },
  })
    .then((result: RazorpaySuccess) => {
      logPayment("checkout sheet ← success", {
        razorpay_payment_id: result.razorpay_payment_id,
        razorpay_order_id: result.razorpay_order_id,
        razorpay_signature: mask(result.razorpay_signature ?? ""),
      });
      return result;
    })
    .finally(() => subs.forEach((sub) => sub.remove()))
    .catch((error: { code?: number; description?: string }) => {
    logPayment("checkout sheet ✗ error", error);
    if (error?.code === CANCEL_CODE) throw new PaymentCancelledError();
    throw new Error(error?.description || "Payment failed");
  }) as Promise<RazorpaySuccess>;
}

/** Payments the farmer completed in Razorpay whose server verification has not succeeded yet. */
const paidAwaitingVerification = new Map<string, RazorpaySuccess>();

/**
 * Runs the whole online payment for an order. Resolves once the server has
 * verified the payment; throws PaymentCancelledError if the farmer backs out.
 */
export async function payForOrder(
  orderId: number | string,
  options: { title: string; description: string; payer?: PayerInfo; color: string },
): Promise<void> {
  const key = String(orderId);
  // The farmer already paid but verification failed (e.g. the connection
  // dropped): re-verify the same payment instead of opening Razorpay again,
  // which would charge them twice.
  let result = paidAwaitingVerification.get(key);
  if (!result) {
    const order = await createRazorpayOrder(orderId);
    result = await openCheckout(order, options.title, options.description, options.payer ?? {}, options.color);
    paidAwaitingVerification.set(key, result);
  }
  logPayment("pay: sheet finished, verifying with server", { orderId });
  try {
    await verifyRazorpayPayment(result);
  } catch (error) {
    // Keep the payment for a re-verify only when the failure may be transient;
    // a server rejection will not change on retry.
    if (!isRetryableError(error)) paidAwaitingVerification.delete(key);
    throw error;
  }
  paidAwaitingVerification.delete(key);
  logPayment("pay: verified", { orderId });
}
