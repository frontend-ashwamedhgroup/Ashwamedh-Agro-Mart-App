import apiClient from "../api/client";
import type { ApiEnvelope } from "../../components/location/types";
import { SHOP_BRANCH_ID } from "../../config/branch";
import {
  InvalidResponseError,
  isRecord,
  parseList,
  unwrapEnvelope,
} from "../api/errors";
import type {
  Cart,
  Category,
  CheckoutInput,
  CheckoutResult,
  Product,
  ProductFilters,
} from "./types";

const CATALOG = "/api/v1/farmer/catalog";
const CART = "/api/v1/farmer/shop/cart";

function unwrap<T>(envelope: ApiEnvelope<T>): T {
  return unwrapEnvelope<T>(envelope);
}

const isCategory = (value: unknown): value is Category =>
  isRecord(value) && typeof value.id === "number" && typeof value.name === "string";

const isProduct = (value: unknown): value is Product =>
  isRecord(value) &&
  typeof value.id === "number" &&
  typeof value.name === "string";

/** Fills optional collections so UI code can rely on them being arrays. */
function normalizeProduct(product: Product): Product {
  return {
    ...product,
    packings: Array.isArray(product.packings) ? product.packings : [],
  };
}

function parseProduct(value: unknown): Product {
  if (!isProduct(value)) {
    throw new InvalidResponseError("Product is missing or malformed.");
  }
  return normalizeProduct(value);
}

function parseCart(value: unknown): Cart {
  if (!isRecord(value) || !Array.isArray(value.items)) {
    throw new InvalidResponseError("Cart is missing or malformed.");
  }
  return {
    ...(value as unknown as Cart),
    items: value.items.filter(
      (item): item is Cart["items"][number] =>
        isRecord(item) && typeof item.id === "number",
    ),
  };
}

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await apiClient.get<ApiEnvelope<{ results: Category[] }>>(
    `${CATALOG}/categories/`,
  );
  return parseList(unwrap(data).results, "Categories", isCategory);
}

export async function fetchProducts(
  filters: ProductFilters = {},
  signal?: AbortSignal,
): Promise<Product[]> {
  const params: Record<string, string | number> = {
    branch_id: SHOP_BRANCH_ID,
  };
  if (filters.category !== undefined) params.category = filters.category;
  if (filters.product_type) params.product_type = filters.product_type;
  if (filters.search?.trim()) params.search = filters.search.trim();

  const { data } = await apiClient.get<ApiEnvelope<{ results: Product[] }>>(
    `${CATALOG}/products/`,
    { params, signal },
  );
  return parseList(unwrap(data).results, "Products", isProduct).map(
    normalizeProduct,
  );
}

export async function fetchProduct(id: number | string): Promise<Product> {
  const { data } = await apiClient.get<ApiEnvelope<{ product: Product }>>(
    `${CATALOG}/products/${id}/`,
    { params: { branch_id: SHOP_BRANCH_ID } },
  );
  return parseProduct(unwrap(data).product);
}

export async function fetchCart(): Promise<Cart> {
  const { data } = await apiClient.get<ApiEnvelope<{ cart: Cart }>>(`${CART}/`);
  return parseCart(unwrap(data).cart);
}

export async function addCartItem(input: {
  product_id: number;
  packing_id?: number | null;
  quantity: string;
}): Promise<Cart> {
  const { data } = await apiClient.post<ApiEnvelope<{ cart: Cart }>>(
    `${CART}/items/`,
    {
      branch_id: SHOP_BRANCH_ID,
      product_id: input.product_id,
      ...(input.packing_id ? { packing_id: input.packing_id } : {}),
      quantity: input.quantity,
    },
  );
  return parseCart(unwrap(data).cart);
}

export async function updateCartItem(
  itemId: number,
  quantity: string,
): Promise<Cart> {
  const { data } = await apiClient.patch<ApiEnvelope<{ cart: Cart }>>(
    `${CART}/items/${itemId}/`,
    { quantity },
  );
  return parseCart(unwrap(data).cart);
}

export async function removeCartItem(itemId: number): Promise<Cart> {
  const { data } = await apiClient.delete<ApiEnvelope<{ cart: Cart }>>(
    `${CART}/items/${itemId}/`,
  );
  return parseCart(unwrap(data).cart);
}

export async function clearCart(): Promise<Cart> {
  const { data } = await apiClient.delete<ApiEnvelope<{ cart: Cart }>>(`${CART}/`);
  return parseCart(unwrap(data).cart);
}

export async function checkoutCart(
  input: CheckoutInput,
): Promise<CheckoutResult> {
  const { data } = await apiClient.post<ApiEnvelope<CheckoutResult>>(
    `${CART}/checkout/`,
    input,
  );
  const result = unwrap(data);
  if (!isRecord(result) || !isRecord(result.order) || typeof result.order.id !== "number") {
    throw new InvalidResponseError("Checkout did not return an order.");
  }
  return result;
}
