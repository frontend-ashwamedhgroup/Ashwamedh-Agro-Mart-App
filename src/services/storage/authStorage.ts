import { secureStorage } from "./secureStorage";

const AUTH_TOKEN_KEY = "authToken";

export type TokenData = {
  access: string;
  refresh: string;
  user_name: string;
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
    await this.removeToken();
  },
};
