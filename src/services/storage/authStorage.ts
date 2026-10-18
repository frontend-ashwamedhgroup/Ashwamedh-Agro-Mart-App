import { asyncStorage } from "./asyncStorage";
import { secureStorage } from "./secureStorage";

const AUTH_TOKEN_KEY = "authToken";

export type AuthUser = {
  id: number;
  mobile_number: string;
  email: string;
  full_name?: string;
  account_type: string;
  is_active: boolean;
};

export type TokenData = {
  access: string;
  refresh: string;
  user: AuthUser;
};

export const authStorage = {
  // =========================
  // TOKEN (JSON OBJECT)
  // =========================
  async getToken<T = TokenData>(): Promise<T | null> {
    try {
      const tokenData = await secureStorage.getItem(AUTH_TOKEN_KEY);
      return tokenData ? JSON.parse(tokenData) : null;
    } catch (error) {
      console.error("❌ Failed to parse token data:", error);
      await secureStorage.removeItem(AUTH_TOKEN_KEY);
      return null;
    }
  },

  async setToken(token: TokenData): Promise<void> {
    await secureStorage.setItem(AUTH_TOKEN_KEY, JSON.stringify(token));
  },

  async removeToken(): Promise<void> {
    await secureStorage.removeItem(AUTH_TOKEN_KEY);
  },

  // =========================
  // LOGOUT / CLEAR
  // =========================
  async clearAll(): Promise<void> {
    // SecureStore has no "clear all"; the auth token is its only key.
    // Run both so a failure in one doesn't leave the other populated.
    const results = await Promise.allSettled([
      this.removeToken(),
      asyncStorage.clearAll(),
    ]);
    const failed = results.find(
      (result): result is PromiseRejectedResult => result.status === "rejected",
    );
    if (failed) {
      throw failed.reason;
    }
  },
};
