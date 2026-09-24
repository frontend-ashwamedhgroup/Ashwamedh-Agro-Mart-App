// src/contexts/authContext.tsx
import React, { createContext, useContext, useEffect, useState } from "react";
import { authStorage, TokenData } from "../services/storage/authStorage";

type AuthContextType = {
  token: string | null;
  userName: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (tokenData: TokenData) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // ✅ Load token ONCE when app starts
  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      try {
        const storedTokenData = await authStorage.getToken();

        if (isMounted && storedTokenData?.access) {
          setToken(storedTokenData.access);
          setUserName(storedTokenData.user_name);
        }
      } catch (error) {
        console.error("❌ Failed to load auth token", error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void bootstrapAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  // ✅ Login: store JSON token + update state
  const login = async (tokenData: TokenData) => {
    await authStorage.setToken(tokenData);
    setToken(tokenData.access);
    setUserName(tokenData.user_name);
  };

  // ✅ Logout: clear stored auth before resetting session state
  const logout = async () => {
    await authStorage.clearAll();
    setToken(null);
    setUserName(null);
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        userName,
        isLoading,
        isAuthenticated: Boolean(token),
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ✅ Hook to consume auth anywhere
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
