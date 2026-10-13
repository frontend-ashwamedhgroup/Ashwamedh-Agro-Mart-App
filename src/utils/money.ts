/** Formats an API decimal string (e.g. "650.00") as a price like "₹650.00". */
export function formatPrice(
  amount: string | number | null | undefined,
  currency: string | null = "INR",
): string {
  if (amount === null || amount === undefined || amount === "") {
    return "";
  }
  const value = Number(amount);
  if (!Number.isFinite(value)) {
    return "";
  }
  const symbol = !currency || currency === "INR" ? "₹" : `${currency} `;
  return `${symbol}${value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** "2.000" -> "2", "1.500" -> "1.5". */
export function formatQuantity(quantity: string | number): string {
  const value = Number(quantity);
  return Number.isFinite(value) ? String(value) : String(quantity);
}
