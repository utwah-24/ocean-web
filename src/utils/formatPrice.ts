/**
 * Formats a price value as Tanzanian Shillings (Tshs)
 * @param price - The price value as a string or number
 * @returns Formatted price string (e.g., "Tshs 10,000")
 */
export function formatPrice(price: string | number | null | undefined): string {
  const raw =
    typeof price === 'string'
      ? parseFloat(price)
      : typeof price === 'number'
        ? price
        : 0;

  const numPrice = Number.isFinite(raw) ? raw : 0;

  return `Tshs ${numPrice.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

