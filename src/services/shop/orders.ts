import type { ApiEnvelope } from "../../components/location/types";
import apiClient from "../api/client";
import {
  InvalidResponseError,
  isRecord,
  parseList,
  unwrapEnvelope,
} from "../api/errors";
import type { OrderItem } from "./types";

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "packed"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";

export type OrderAddress = {
  id: number;
  label?: string;
  address_line1: string;
  address_line2?: string;
  village?: string;
  city?: string;
  district?: string;
  state?: string;
  postal_code?: string;
};

export type FarmerOrder = {
  id: number;
  status: OrderStatus;
  currency: string;
  subtotal: string;
  delivery_fee: string;
  total: string;
  note: string;
  farmer_name?: string;
  farmer_mobile?: string;
  diagnosis_id?: number | null;
  source_quote_id?: number | null;
  delivery_address?: OrderAddress | null;
  items: (OrderItem & { id?: number; product_id?: number })[];
  created_at: string;
  updated_at?: string;
};

export type Invoice = {
  id: number;
  order_id: number;
  branch_id?: number;
  invoice_code: string;
  payment_method: "ONLINE" | "COD" | string;
  payment_reference?: string;
  notes?: string;
  due_date?: string | null;
  status: "unpaid" | "partial" | "paid" | "refunded";
  total: string;
  amount_received: string;
  outstanding_amount: string;
  currency: string;
  farmer_name?: string;
  farmer_mobile?: string;
};

export type DeliveryStatus =
  | "scheduled"
  | "assigned"
  | "picked_up"
  | "in_transit"
  | "delivered"
  | "failed"
  | "cancelled";

export type Delivery = {
  id: number;
  order_id: number;
  branch_id?: number;
  total?: string;
  delivery_fee?: string;
  delivery_code: string;
  status: DeliveryStatus;
  driver_name?: string | null;
  vehicle_registration?: string | null;
  vehicle_number?: string | null;
  /** Handoff code the farmer gives the driver on arrival. */
  delivery_otp?: string | null;
  pickup_eta?: string | null;
  delivery_eta?: string | null;
  dispatched_at?: string | null;
  delivered_at?: string | null;
  notes?: string;
  order_status?: OrderStatus;
  assigned_to?: number | null;
  vehicle_id?: number | null;
  created_at?: string;
  updated_at?: string;
};

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  return unwrapEnvelope<T>(envelope);
}

/** Single objects live under a named key; tolerate the bare object too. */
function pick<T>(data: Record<string, unknown>, key: string): T {
  const value = data[key] ?? data;
  if (!isRecord(value)) {
    throw new InvalidResponseError(`${key} is missing or malformed.`);
  }
  return value as T;
}

const isRecordWithId = (value: unknown): value is Record<string, unknown> & { id: number } =>
  isRecord(value) && typeof value.id === "number";

function normalizeOrder(order: FarmerOrder): FarmerOrder {
  return { ...order, items: Array.isArray(order.items) ? order.items : [] };
}

export async function fetchOrders(): Promise<FarmerOrder[]> {
  const { data } = await apiClient.get<ApiEnvelope<{ results: FarmerOrder[] }>>(
    "/api/v1/farmer/orders/",
  );
  // Newest first; the API does not guarantee an order.
  const orders = parseList(unwrap(data).results, "Orders", isRecordWithId) as unknown as FarmerOrder[];
  return orders
    .map(normalizeOrder)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

export async function fetchOrder(id: number | string): Promise<FarmerOrder> {
  const { data } = await apiClient.get<ApiEnvelope<Record<string, unknown>>>(
    `/api/v1/farmer/orders/${id}/`,
  );
  const order = pick<FarmerOrder>(unwrap(data), "order");
  if (typeof order.id !== "number") {
    throw new InvalidResponseError("Order is missing an id.");
  }
  return normalizeOrder(order);
}

export async function fetchPayment(id: number | string): Promise<Invoice> {
  const { data } = await apiClient.get<ApiEnvelope<Record<string, unknown>>>(
    `/api/v1/farmer/payments/${id}/`,
  );
  return pick<Invoice>(unwrap(data), "payment");
}

/**
 * Razorpay's verify call only accepts the signature; the server marks the
 * invoice paid when its webhook arrives. Polls the invoice until it is paid and
 * returns false if that has not happened within the wait.
 */
export async function waitForPaid(
  orderId: number | string,
  { attempts = 10, intervalMs = 2500 }: { attempts?: number; intervalMs?: number } = {},
): Promise<boolean> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      if ((await fetchPayment(orderId)).status === "paid") return true;
    } catch {
      // A transient failure just means we look again.
    }
    if (i < attempts - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

/** An online order stays pending and unpaid until the webhook confirms the payment. */
export function awaitingOnlinePayment(
  order: Pick<FarmerOrder, "status">,
  payment: Pick<Invoice, "status" | "payment_method"> | null,
): boolean {
  return (
    !!payment &&
    payment.payment_method !== "COD" &&
    payment.status === "unpaid" &&
    order.status === "pending"
  );
}

/** Online invoices open once paid; cash invoices once the order is confirmed. */
export function canViewInvoice(
  order: Pick<FarmerOrder, "status">,
  payment: Pick<Invoice, "status" | "payment_method"> | null,
): boolean {
  if (!payment || order.status === "cancelled") return false;
  return payment.payment_method === "COD"
    ? order.status !== "pending"
    : payment.status === "paid";
}

export async function fetchDeliveries(): Promise<Delivery[]> {
  const { data } = await apiClient.get<ApiEnvelope<{ results: Delivery[] }>>(
    "/api/v1/farmer/deliveries/",
  );
  return parseList(unwrap(data).results, "Deliveries", isRecordWithId) as unknown as Delivery[];
}

export const TRACKING_STEPS: OrderStatus[] = [
  "pending",
  "confirmed",
  "packed",
  "out_for_delivery",
  "delivered",
];

/**
 * The backend moves the delivery without moving the order (a delivery can be
 * `in_transit` while the order is still `pending`), so tracking takes the
 * furthest stage reported by either record.
 */
export function trackingStatus(
  order: Pick<FarmerOrder, "status">,
  delivery?: Pick<Delivery, "status"> | null,
): OrderStatus {
  if (order.status === "cancelled" || delivery?.status === "cancelled") return "cancelled";
  const fromDelivery: Partial<Record<DeliveryStatus, OrderStatus>> = {
    picked_up: "out_for_delivery",
    in_transit: "out_for_delivery",
    delivered: "delivered",
  };
  const candidate = delivery ? fromDelivery[delivery.status] : undefined;
  if (!candidate) return order.status;
  return TRACKING_STEPS.indexOf(candidate) > TRACKING_STEPS.indexOf(order.status)
    ? candidate
    : order.status;
}

export async function fetchDelivery(id: number | string): Promise<Delivery> {
  const { data } = await apiClient.get<ApiEnvelope<Record<string, unknown>>>(
    `/api/v1/farmer/deliveries/${id}/`,
  );
  return pick<Delivery>(unwrap(data), "delivery");
}
