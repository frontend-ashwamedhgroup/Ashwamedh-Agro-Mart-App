import { useMemo } from "react";

import { useAuth } from "../context/AuthContext";
import apiClient from "../services/api/client";
import type { Product } from "../services/shop/types";

/**
 * `image.content_url` is an absolute URL from the API; a relative path is
 * resolved against the configured API base as a fallback.
 */
function resolveImageUrl(contentUrl: string): string | undefined {
  const trimmed = contentUrl.trim();
  if (!trimmed) {
    return undefined;
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  const base = String(apiClient.defaults.baseURL ?? "").replace(/\/+$/, "");
  return `${base}/${trimmed.replace(/^\/+/, "")}`;
}

/**
 * The product image endpoint needs the bearer token, so expo-image gets it as a
 * header. Returns undefined when the product has no image.
 */
export function useProductImageSource(product: Pick<Product, "image">) {
  const { token } = useAuth();
  const contentUrl = product.image?.content_url;

  return useMemo(() => {
    const uri = typeof contentUrl === "string" ? resolveImageUrl(contentUrl) : undefined;
    if (!uri) {
      return undefined;
    }
    return {
      uri,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    };
  }, [contentUrl, token]);
}
