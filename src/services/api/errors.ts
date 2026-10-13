/**
 * Central API error handling: classifies any thrown value, turns it into a
 * localized, user-friendly message, and validates response shapes so a bad
 * payload becomes a clean error instead of a render crash.
 */
import { isAxiosError, isCancel } from "axios";
import {
  addNetworkStateListener,
  getNetworkStateAsync,
  type NetworkState,
} from "expo-network";

import i18n from "../../i18n";

export type ErrorKind =
  | "offline" // the device has no connection
  | "unreachable" // connected, but the server did not answer (stopped / down)
  | "timeout"
  | "server" // HTTP 5xx
  | "unauthorized"
  | "forbidden"
  | "notFound"
  | "rateLimited"
  | "validation" // other 4xx (400, 409, 422, ...)
  | "invalidResponse"
  | "cancelled"
  | "unknown";

/** Thrown when a response succeeds but does not have the expected shape. */
export class InvalidResponseError extends Error {
  constructor(detail = "Unexpected response shape.") {
    super(detail);
    this.name = "InvalidResponseError";
  }
}

// --- device connectivity ------------------------------------------------------

let deviceOffline = false;

function applyNetworkState(state: NetworkState): void {
  deviceOffline = state.isConnected === false || state.isInternetReachable === false;
}

getNetworkStateAsync().then(applyNetworkState, () => undefined);
addNetworkStateListener(applyNetworkState);

export function isDeviceOffline(): boolean {
  return deviceOffline;
}

// --- classification -----------------------------------------------------------

export function classifyError(error: unknown): ErrorKind {
  if (isCancel(error)) return "cancelled";
  if (error instanceof InvalidResponseError) return "invalidResponse";

  if (isAxiosError(error)) {
    const status = error.response?.status;
    if (status === undefined) {
      if (error.code === "ECONNABORTED" || error.code === "ETIMEDOUT") return "timeout";
      return deviceOffline ? "offline" : "unreachable";
    }
    if (status === 401) return "unauthorized";
    if (status === 403) return "forbidden";
    if (status === 404) return "notFound";
    if (status === 429) return "rateLimited";
    if (status >= 500) return "server";
    return "validation";
  }
  return "unknown";
}

/** True when the request never got an HTTP response (offline, down, timed out). */
export function isConnectionError(error: unknown): boolean {
  const kind = classifyError(error);
  return kind === "offline" || kind === "unreachable" || kind === "timeout";
}

/** Whether trying the same request again could plausibly succeed. */
export function isRetryableError(error: unknown): boolean {
  return isConnectionError(error) || classifyError(error) === "server";
}

// --- messages -----------------------------------------------------------------

function readServerMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined;
  const body: unknown = error.response?.data;
  // A string body is usually an HTML error page from a proxy; never show it.
  if (!body || typeof body !== "object") return undefined;

  const { message, detail, errors } = body as Record<string, unknown>;
  for (const candidate of [message, detail]) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  if (errors && typeof errors === "object") {
    for (const value of Object.values(errors)) {
      const first = Array.isArray(value) ? value[0] : value;
      if (typeof first === "string" && first.trim()) return first.trim();
    }
  }
  return undefined;
}

function isCredentialRequest(error: unknown): boolean {
  const url = isAxiosError(error) ? (error.config?.url ?? "").toLowerCase() : "";
  return url.includes("auth/login") || url.includes("auth/otp");
}

const MESSAGE_KEY: Record<ErrorKind, string> = {
  offline: "network.offline",
  unreachable: "network.serverDown",
  timeout: "network.timeout",
  server: "network.serverError",
  unauthorized: "network.sessionExpired",
  forbidden: "network.forbidden",
  notFound: "network.notFound",
  rateLimited: "network.tooManyRequests",
  validation: "network.unknown",
  invalidResponse: "network.invalidResponse",
  cancelled: "network.unknown",
  unknown: "network.unknown",
};

/**
 * A localized message that is safe to show. The backend's own message is used
 * only for client errors (where it explains what to fix), never for 5xx.
 */
export function getErrorMessage(error: unknown, fallback?: string): string {
  const kind = classifyError(error);

  if (kind === "validation" || kind === "forbidden" || kind === "notFound") {
    const serverMessage = readServerMessage(error);
    if (serverMessage) return serverMessage;
  }
  if (kind === "unauthorized" && isCredentialRequest(error)) {
    const serverMessage = readServerMessage(error);
    if (serverMessage) return serverMessage;
  }
  if (kind === "unknown" && error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  if (kind === "validation" || kind === "unknown") {
    return fallback || i18n.t(MESSAGE_KEY[kind]);
  }
  return i18n.t(MESSAGE_KEY[kind]);
}

// --- response validation ------------------------------------------------------

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Unwraps `{ success, message, data }`, rejecting anything that is not that shape. */
export function unwrapEnvelope<T>(envelope: unknown): T {
  if (!isRecord(envelope) || typeof envelope.success !== "boolean") {
    throw new InvalidResponseError("Response is not an API envelope.");
  }
  if (!envelope.success) {
    throw new Error(typeof envelope.message === "string" ? envelope.message : "");
  }
  if (envelope.data === null || envelope.data === undefined) {
    throw new InvalidResponseError("Response has no data.");
  }
  return envelope.data as T;
}

/** An array field from a response; a missing or wrong-typed one is invalid. */
export function requireArray(value: unknown, what: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new InvalidResponseError(`${what} is not a list.`);
  }
  return value;
}

/** Keeps only list entries that pass `isValid`, so one bad record cannot break a screen. */
export function parseList<T>(
  value: unknown,
  what: string,
  isValid: (entry: unknown) => entry is T,
): T[] {
  return requireArray(value, what).filter(isValid);
}
