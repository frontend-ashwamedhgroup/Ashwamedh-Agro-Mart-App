// src/contexts/authContext.tsx
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { authStorage, AuthUser, TokenData } from "../services/storage/authStorage";
import apiClient, { setClientAuthHandlers } from "../services/api/client";

type ApiEnvelope<T> = {
  success: boolean;
  message: string;
  data: T | null;
  errors: unknown;
};

type AuthContextType = {
  token: string | null;
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (tokenData: TokenData) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const logoutPromiseRef = useRef<Promise<void> | null>(null);

  const clearLocalSession = useCallback(async () => {
    try {
      await authStorage.clearAll();
    } finally {
      setToken(null);
      setUser(null);
    }
  }, []);

  const performLogout = useCallback(
    async (sessionExpired: boolean) => {
      if (logoutPromiseRef.current) {
        return logoutPromiseRef.current;
      }

      const logoutTask = (async () => {
        if (!sessionExpired) {
          try {
            const currentSession = await authStorage.getToken();

            if (currentSession?.refresh) {
              await apiClient.post("/api/v1/auth/logout/", {
                refresh: currentSession.refresh,
              });
            }
          } catch (error: unknown) {
            console.warn(
              "Backend logout failed; clearing the local session anyway:",
              error,
            );
          }
        }

        await clearLocalSession();
      })();

      logoutPromiseRef.current = logoutTask;

      try {
        await logoutTask;
      } finally {
        if (logoutPromiseRef.current === logoutTask) {
          logoutPromiseRef.current = null;
        }
      }
    },
    [clearLocalSession],
  );

  useEffect(() => {
    setClientAuthHandlers({
      onTokenRefreshed: setToken,
      onSessionExpired: () => performLogout(true),
    });

    return () => {
      setClientAuthHandlers(null);
    };
  }, [performLogout]);

  // ✅ Load token ONCE when app starts
  useEffect(() => {
    let isMounted = true;

    const bootstrapAuth = async () => {
      try {
        const storedTokenData = await authStorage.getToken();

        if (isMounted && storedTokenData?.access) {
          setToken(storedTokenData.access);
          setUser(storedTokenData.user);

          try {
            const response = await apiClient.get<
              ApiEnvelope<{ user: AuthUser }>
            >("/api/v1/auth/me/");
            const currentUser = response.data.data?.user;

            if (isMounted && response.data.success && currentUser) {
              setUser(currentUser);
            } else {
              console.warn(
                "The current-user response did not include a user object.",
              );
            }
          } catch (validationError: unknown) {
            // Keep the local session on network errors; the API client clears it
            // when the refresh token is invalid or the retried request is unauthorized.
            console.warn(
              "Could not validate the saved session with the API:",
              validationError,
            );
          }
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
    setUser(tokenData.user);
  };

  const logout = useCallback(() => performLogout(false), [performLogout]);

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
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
