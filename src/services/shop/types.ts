export type Category = {
  id: number;
  name: string;
  slug: string;
  description: string;
};

export type ProductImage = {
  content_type: string;
  width: number;
  height: number;
  content_url: string;
};

export type ProductPacking = {
  id: number;
  label: string;
  sale_unit: string;
  is_default: boolean;
  unit_price: string | null;
  currency: string | null;
  quantity_on_hand: string;
  in_stock: boolean;
};

export type Product = {
  id: number;
  sku: string;
  name: string;
  brand: string;
  description: string;
  product_type: string;
  category_id: number;
  category_name: string;
  category_slug: string;
  sale_unit: string;
  presentation: string;
  formulation: string;
  active_ingredient: string;
  concentration: string;
  crop_recommendation: string;
  target_pests: string;
  mode_of_action: string;
  application_method: string;
  application_rate: string;
  application_stage: string;
  compatibility: string;
  benefits: string;
  minimum_viable_cell_count: string;
  crop_guidance: unknown[];
  image: ProductImage | null;
  packings: ProductPacking[];
  branch_id: number;
  /** Null when the branch has no single active price. */
  unit_price: string | null;
  currency: string | null;
  quantity_on_hand: string;
  in_stock: boolean;
};

export type CartItem = {
  id: number;
  product_id: number;
  packing_id: number | null;
  product_name: string;
  sku: string;
  sale_unit: string;
  packing_label: string;
  presentation: string;
  quantity: string;
  unit_price: string;
  line_total: string;
  currency: string;
  quantity_on_hand: string;
  in_stock: boolean;
};

export type Cart = {
  id: number;
  branch_id: number | null;
  currency: string;
  subtotal: string;
  total: string;
  items: CartItem[];
};

export type PaymentMethod = "ONLINE" | "COD";

export type CheckoutInput = {
  address_id: number | string;
  note?: string;
  payment_method?: PaymentMethod;
};

export type OrderItem = {
  product_name: string;
  packing_label: string;
  sku: string;
  quantity: string;
  sale_unit: string;
  unit_price: string;
  line_total: string;
};

export type Order = {
  id: number;
  status: string;
  items: OrderItem[];
};

export type CheckoutResult = {
  order: Order;
  payment: unknown | null;
};

export type ProductFilters = {
  category?: string | number;
  product_type?: string;
  search?: string;
};
