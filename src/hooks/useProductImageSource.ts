import { useMemo } from "react";

import { useAuth } from "../context/AuthContext";
import apiClient from "../services/api/client";
import type { Product } from "../services/shop/types";

/**
 * The product image endpoint needs the bearer token, so expo-image gets it as a
 * header. Returns undefined when the product has no image.
 */
export function useProductImageSource(product: Pick<Product, "image">) {
  const { token } = useAuth();
  const contentUrl = product.image?.content_url;

  return useMemo(() => {
    if (!contentUrl) {
      return undefined;
    }
    const base = String(apiClient.defaults.baseURL ?? "").replace(/\/$/, "");
    return {
      uri: `${base}${contentUrl}`,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    };
  }, [contentUrl, token]);
}
