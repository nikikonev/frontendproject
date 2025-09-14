export function formatCurrency(amount, currency = 'USD') {
    try {
        const code = String(currency).toUpperCase().trim();
        // canonicalize: accept EURO but display as EUR
        const cur = code === 'EURO' ? 'EUR' : code;

        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: cur,
            maximumFractionDigits: 2,
        }).format(Number(amount) || 0);
    } catch {
        return String(amount);
    }
}
