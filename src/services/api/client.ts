import axios, {
  AxiosError,
  InternalAxiosRequestConfig,
  isAxiosError,
  isCancel,
} from "axios";

import { authStorage } from "../storage/authStorage";
import { classifyError } from "./errors";

const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!configuredApiUrl) {
  throw new Error("EXPO_PUBLIC_API_URL is not configured.");
}

const API_URL = configuredApiUrl.endsWith("/")
  ? configuredApiUrl
  : `${configuredApiUrl}/`;

if (__DEV__) {
  console.log(`[API] Base URL: ${API_URL}`);
}

const API_PREFIX = "api/v1/";
const REFRESH_PATH = `${API_PREFIX}auth/token/refresh/`;
// Without a timeout a stalled connection leaves spinners running forever.
const REQUEST_TIMEOUT_MS = 20_000;
// Safe (idempotent) requests are retried this many times on transient failures.
const MAX_AUTO_RETRIES = 2;
const RETRY_DELAYS_MS = [500, 1500];

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown;
};

type RefreshedTokens = {
  access: string;
  refresh: string;
};

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _authRetry?: boolean;
  _retryCount?: number;
};

type ClientAuthHandlers = {
  onTokenRefreshed: (accessToken: string) => void;
  onSessionExpired: () => Promise<void>;
};

let authHandlers: ClientAuthHandlers | null = null;
let refreshPromise: Promise<string> | null = null;

export function setClientAuthHandlers(
  handlers: ClientAuthHandlers | null,
): void {
  authHandlers = handlers;
}

const apiClient = axios.create({
  baseURL: API_URL,
  timeout: REQUEST_TIMEOUT_MS,
  headers: {
    "Content-Type": "application/json",
  },
});

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      const currentSession = await authStorage.getToken();

      if (!currentSession?.refresh) {
        throw new Error("No refresh token is available.");
      }

      const response = await axios.post<ApiEnvelope<RefreshedTokens>>(
        `${API_URL}${REFRESH_PATH}`,
        { refresh: currentSession.refresh },
        {
          headers: { "Content-Type": "application/json" },
          timeout: REQUEST_TIMEOUT_MS,
        },
      );
      const tokens = response.data.data;

      if (!response.data.success || !tokens?.access || !tokens.refresh) {
        throw new Error(
          response.data.message || "The token refresh response was invalid.",
        );
      }

      await authStorage.setToken({
        ...currentSession,
        access: tokens.access,
        refresh: tokens.refresh,
      });

      authHandlers?.onTokenRefreshed(tokens.access);
      return tokens.access;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

function isRefreshOrLogoutRequest(url: string): boolean {
  const normalizedUrl = url.toLowerCase();
  return (
    normalizedUrl.includes("auth/token/refresh") ||
    normalizedUrl.includes("auth/logout") ||
    normalizedUrl.includes("auth/otp/request") ||
    normalizedUrl.includes("auth/otp/verify")
  );
}

/**
 * Only an explicit rejection of the refresh token ends the session. A network
 * failure, timeout or 5xx says nothing about the token, so the farmer stays
 * signed in and the request simply fails.
 */
function isRefreshRejection(error: unknown): boolean {
  if (!isAxiosError(error)) return true; // no refresh token / malformed response
  const status = error.response?.status;
  return status === 400 || status === 401 || status === 403;
}

function canAutoRetry(
  error: AxiosError,
  config: RetriableRequestConfig,
): boolean {
  if (isCancel(error) || (config.method ?? "get").toLowerCase() !== "get") {
    return false;
  }
  if ((config._retryCount ?? 0) >= MAX_AUTO_RETRIES) return false;
  const kind = classifyError(error);
  const status = error.response?.status;
  // Timeouts are not retried: the wait is already long, the user can Retry.
  return (
    kind === "unreachable" ||
    (kind === "server" && (status === 502 || status === 503 || status === 504))
  );
}

async function expireSession(): Promise<void> {
  if (!authHandlers) {
    await authStorage.clearAll();
    return;
  }

  try {
    await authHandlers.onSessionExpired();
  } catch (error: unknown) {
    console.error("Failed to clear the expired session:", error);
    await authStorage.clearAll();
  }
}

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const session = await authStorage.getToken();

    if (session?.access) {
      config.headers.set("Authorization", `Bearer ${session.access}`);
    }

    if (__DEV__) {
      console.log(
        `[API] ${(config.method ?? "get").toUpperCase()} ${axios.getUri(config)}`,
      );
      console.log(`[API] Access token: ${session?.access ?? "none"}`);
    }

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (originalRequest && canAutoRetry(error, originalRequest)) {
      const attempt = originalRequest._retryCount ?? 0;
      originalRequest._retryCount = attempt + 1;
      await new Promise((resolve) =>
        setTimeout(resolve, RETRY_DELAYS_MS[attempt] ?? 1500),
      );
      return apiClient(originalRequest);
    }

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      isRefreshOrLogoutRequest(originalRequest.url ?? "")
    ) {
      return Promise.reject(error);
    }

    if (originalRequest._authRetry) {
      await expireSession();
      return Promise.reject(error);
    }

    originalRequest._authRetry = true;

    let accessToken: string;
    try {
      const session = await authStorage.getToken();
      const requestToken = originalRequest.headers.get("Authorization");

      // A concurrent request may already have refreshed this request's token.
      accessToken =
        session?.access && requestToken !== `Bearer ${session.access}`
          ? session.access
          : await refreshAccessToken();
    } catch (refreshError: unknown) {
      if (isRefreshRejection(refreshError)) {
        await expireSession();
      }
      return Promise.reject(refreshError);
    }

    // Outside the try block: a failure of the retried request (for example a
    // dropped connection) must not be mistaken for a failed token refresh.
    originalRequest.headers.set("Authorization", `Bearer ${accessToken}`);
    return apiClient(originalRequest);
  },
);

export default apiClient;
