/**
 * The farmer's shopping cart (api: /farmer/shop/cart/). The server owns prices
 * and totals, so every mutation replaces the local cart with the response.
 */

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { getApiErrorMessage } from "../hooks/useFarmerAddresses";
import {
  addCartItem,
  clearCart as clearCartRequest,
  fetchCart,
  removeCartItem,
  updateCartItem,
} from "../services/shop/api";
import type { Cart, Product } from "../services/shop/types";
import { useAuth } from "./AuthContext";

type CartContextType = {
  cart: Cart | null;
  /** Total quantity of lines in the cart (for the tab badge). */
  itemCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Adds one `quantity` of the product's default (or given) packing. */
  addProduct: (
    product: Product,
    options?: { packingId?: number; quantity?: number },
  ) => Promise<void>;
  setQuantity: (itemId: number, quantity: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  clear: () => Promise<void>;
  /** Replaces the cart after checkout empties it. */
  reset: () => void;
};

const CartContext = createContext<CartContextType | null>(null);

function toQuantity(value: number): string {
  return value.toFixed(3);
}

// Cart mutations return the whole cart, so they must apply in the order they
// were made; otherwise a slow earlier response could overwrite a newer one.
let mutationQueue: Promise<unknown> = Promise.resolve();

/**
 * Runs a cart mutation after the previous one finishes. Throws an Error
 * carrying a user-friendly message; the local cart is untouched on failure.
 */
function run<T>(action: () => Promise<T>): Promise<T> {
  const attempt = async () => {
    try {
      return await action();
    } catch (error: unknown) {
      throw new Error(getApiErrorMessage(error));
    }
  };
  const result = mutationQueue.then(attempt, attempt);
  mutationQueue = result.catch(() => undefined);
  return result;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [loadedCart, setCart] = useState<Cart | null>(null);
  const cart = isAuthenticated ? loadedCart : null;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshing = useRef(false);

  const refresh = useCallback(async () => {
    if (refreshing.current) return;
    refreshing.current = true;
    setIsLoading(true);
    setError(null);
    try {
      setCart(await fetchCart());
    } catch (loadError: unknown) {
      // The previously loaded cart (if any) stays on screen.
      console.error("Failed to load cart:", loadError);
      setError(getApiErrorMessage(loadError));
    } finally {
      refreshing.current = false;
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }
    let cancelled = false;
    fetchCart()
      .then((loaded) => {
        if (!cancelled) {
          setCart(loaded);
          setError(null);
        }
      })
      .catch((loadError: unknown) => {
        console.error("Failed to load cart:", loadError);
        if (!cancelled) setError(getApiErrorMessage(loadError));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const addProduct = useCallback<CartContextType["addProduct"]>(
    async (product, options) => {
      const packing =
        product.packings.find((p) => p.id === options?.packingId) ??
        product.packings.find((p) => p.is_default);
      setCart(
        await run(() =>
          addCartItem({
            product_id: product.id,
            packing_id: packing?.id ?? null,
            quantity: toQuantity(options?.quantity ?? 1),
          }),
        ),
      );
    },
    [],
  );

  const setQuantity = useCallback(
    async (itemId: number, quantity: number) => {
      setCart(await run(() => updateCartItem(itemId, toQuantity(quantity))));
    },
    [],
  );

  const removeItem = useCallback(async (itemId: number) => {
    setCart(await run(() => removeCartItem(itemId)));
  }, []);

  const clear = useCallback(async () => {
    setCart(await run(() => clearCartRequest()));
  }, []);

  const reset = useCallback(() => {
    void refresh();
  }, [refresh]);

  const itemCount = useMemo(
    () => cart?.items.reduce((sum, item) => sum + Math.ceil(Number(item.quantity)), 0) ?? 0,
    [cart],
  );

  const value = useMemo(
    () => ({
      cart,
      itemCount,
      isLoading,
      error,
      refresh,
      addProduct,
      setQuantity,
      removeItem,
      clear,
      reset,
    }),
    [cart, itemCount, isLoading, error, refresh, addProduct, setQuantity, removeItem, clear, reset],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used inside CartProvider.");
  }
  return context;
}
