export function formatCurrency(amount, currency = 'USD') {
    try {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency === 'EURO' ? 'EUR' : currency,
            maximumFractionDigits: 2,
        }).format(Number(amount) || 0);
    } catch {
        return String(amount);
    }
}
