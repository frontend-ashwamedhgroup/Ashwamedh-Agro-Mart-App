import type { ApiEnvelope } from "../../components/location/types";
import apiClient from "../api/client";
import { isRecord, parseList, unwrapEnvelope } from "../api/errors";

export type NotificationCategory =
  | "order"
  | "diagnosis"
  | "delivery"
  | "payment"
  | "support"
  | "system";

export type FarmerNotification = {
  id: number;
  title: string;
  message: string;
  category: NotificationCategory | string;
  status: "unread" | "read";
  /** With `target_id`, the deep link. Unknown types must be ignored. */
  target_type?: string | null;
  target_id?: number | string | null;
  read_at?: string | null;
  created_at?: string;
};

/** The list is not paginated (api.md §6.12); newest first when timestamps exist. */
export async function fetchNotifications(): Promise<FarmerNotification[]> {
  const { data } = await apiClient.get<
    ApiEnvelope<{ results: FarmerNotification[] }>
  >("/api/v1/farmer/notifications/");

  const results = parseList(
    unwrapEnvelope<{ results: unknown }>(data).results,
    "Notifications",
    (entry): entry is FarmerNotification =>
      isRecord(entry) && typeof entry.id === "number",
  );

  return results.sort(
    (a, b) =>
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime(),
  );
}

export async function markNotificationRead(id: number): Promise<void> {
  await apiClient.patch(`/api/v1/farmer/notifications/${id}/read/`);
}
