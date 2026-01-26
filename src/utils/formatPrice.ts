/**
 * Formats a price value as Tanzanian Shillings (Tshs)
 * @param price - The price value as a string or number
 * @returns Formatted price string (e.g., "Tshs 10,000")
 */
export function formatPrice(price: string | number): string {
  const numPrice = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(numPrice)) return 'Tshs 0';
  
  return `Tshs ${numPrice.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

