// src/libs/idb.module.js

/**
 * IndexedDB helper for Costs + Exchange Rates
 * Fixes:
 *  - Currency normalization: canonicalizes "EURO" -> "EUR"
 *  - Correct conversion math for C_per_USD tables (USD:1)
 *  - Works with both flat maps and { base, rates } shapes
 */

export async function openCostsDB(databaseName = 'costsdb', databaseVersion = 1) {
    // --- Small helpers ---------------------------------------------------------
    function reqToPromise(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    // Canonicalize currency codes used throughout the app
    function normalizeCurrency(c) {
        if (!c) return 'USD';
        const up = String(c).toUpperCase().trim();
        // Canonical form: "EUR" (not "EURO")
        if (up === 'EURO') return 'EUR';
        return up;
    }

    // Normalize incoming rates once when saving so our DB stays consistent
    function normalizeRatesObject(obj) {
        if (!obj || typeof obj !== 'object') return obj;

        // Wrapped { base, rates }
        if (obj.rates && typeof obj.rates === 'object') {
            const copy = { ...obj, rates: { ...obj.rates } };
            // Map EURO -> EUR inside rates
            if (copy.rates.EURO != null && copy.rates.EUR == null) {
                copy.rates.EUR = copy.rates.EURO;
                delete copy.rates.EURO;
            }
            // Canonicalize base as well
            if (copy.base && String(copy.base).toUpperCase() === 'EURO') copy.base = 'EUR';
            return copy;
        }

        // Flat map
        const map = { ...obj };
        if (map.EURO != null && map.EUR == null) {
            map.EUR = map.EURO;
            delete map.EURO;
        }
        return map;
    }

    // --- Open / upgrade DB -----------------------------------------------------
    const openReq = indexedDB.open(databaseName, Number(databaseVersion) || 1);
    openReq.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('costs')) {
            const costs = db.createObjectStore('costs', { keyPath: 'id', autoIncrement: true });
            costs.createIndex('by_year_month', ['year', 'month'], { unique: false });
            costs.createIndex('by_category', 'category', { unique: false });
        }
        if (!db.objectStoreNames.contains('rates')) {
            db.createObjectStore('rates', { keyPath: 'id' });
        }
    };

    const db = await reqToPromise(openReq);

    function withStore(mode, cb) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(['costs', 'rates'], mode);
            const stores = { costs: tx.objectStore('costs'), rates: tx.objectStore('rates') };
            const out = cb(stores);
            tx.oncomplete = () => resolve(out);
            tx.onerror = () => reject(tx.error);
        });
    }

    // --- Rates CRUD ------------------------------------------------------------
    async function setRates(rates) {
        const normalized = normalizeRatesObject(rates);
        return withStore('readwrite', (s) =>
            s.rates.put({ id: 'latest', updatedAt: Date.now(), rates: normalized })
        );
    }

    async function getLatestRates() {
        return withStore('readonly', async (s) => (await reqToPromise(s.rates.get('latest')))?.rates || null);
    }

    async function fetchRatesFromURL() {
        const url = localStorage.getItem('ratesURL');
        if (!url) return null;
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`rates fetch failed ${res.status}`);
        const json = await res.json();
        await setRates(json); // normalize on save
        return json;
    }

    async function ensureRates() {
        let rates = await getLatestRates();
        if (!rates) {
            try { rates = await fetchRatesFromURL(); } catch { /* ignore */ }
        }
        return rates; // can be null
    }

    // --- Conversion ------------------------------------------------------------
    /**
     * Convert amount FROM -> TO
     * Supports:
     *  A) Flat map with USD=1 (C_per_USD), e.g. { USD:1, ILS:3.4, EUR:0.7 }
     *  B) Wrapped { base:'USD', rates:{...} } where rates[X] = X_per_base
     *
     * For both shapes, the correct formula is:
     *   value = amount * (rate[to] / rate[from])
     */
    function convert(amount, from, to, rates) {
        if (!isFinite(amount) || !rates) return amount;

        // Wrapped shape: { base, rates }
        if (rates && typeof rates === 'object' && rates.rates && typeof rates.rates === 'object') {
            const table = rates.rates;
            const base = (rates.base || 'USD').toUpperCase();
            const f = normalizeCurrency(from);
            const t = normalizeCurrency(to);

            const rFrom = Number(f === base ? 1 : table[f]);
            const rTo = Number(t === base ? 1 : table[t]);
            if (!isFinite(rFrom) || !isFinite(rTo)) return amount;

            const value = amount * (rTo / rFrom);
            return Math.round((value + Number.EPSILON) * 100) / 100;
        }

        // Flat map (your current public/rates.json)
        const table = rates;
        const f = normalizeCurrency(from);
        const t = normalizeCurrency(to);

        // Support legacy 'EURO' key just in case older data sneaks in
        const get = (k) => {
            if (table[k] != null) return Number(table[k]);
            if (k === 'EUR' && table['EURO'] != null) return Number(table['EURO']);
            return NaN;
        };

        const rFrom = get(f);
        const rTo = get(t);
        if (!isFinite(rFrom) || !isFinite(rTo)) return amount;

        const value = amount * (rTo / rFrom); // ✅ correct for C_per_USD (USD=1)
        return Math.round((value + Number.EPSILON) * 100) / 100;
    }

    // --- Costs API -------------------------------------------------------------
    async function addCost(cost) {
        const now = new Date();
        const rec = {
            sum: Number(cost.sum),
            currency: normalizeCurrency(cost.currency || cost.curency || 'USD'),
            category: String(cost.category || 'General'),
            description: String(cost.description || ''),
            ts: now.getTime(),
            year: now.getFullYear(),
            month: now.getMonth() + 1,
            day: now.getDate()
        };
        if (!isFinite(rec.sum)) throw new Error('sum must be a number');
        return withStore('readwrite', (s) => s.costs.add(rec))
            .then(() => ({ sum: rec.sum, currency: rec.currency, category: rec.category, description: rec.description }));
    }

    async function getReport(year, month, currency) {
        const y = Number(year), m = Number(month);
        const cur = normalizeCurrency(currency || 'USD');

        const rates = await ensureRates(); // may be null if not set / failed to fetch

        const items = await withStore('readonly', async (s) => {
            const idx = s.costs.index('by_year_month');
            const req = idx.openCursor(IDBKeyRange.only([y, m]));
            const out = [];
            return await new Promise((resolve, reject) => {
                req.onerror = () => reject(req.error);
                req.onsuccess = (e) => {
                    const cursor = e.target.result;
                    if (cursor) {
                        const v = cursor.value;
                        out.push({
                            sum: v.sum,
                            currency: v.currency,
                            category: v.category,
                            description: v.description,
                            Date: { day: v.day }
                        });
                        cursor.continue();
                    } else resolve(out);
                };
            });
        });

        // Convert each row exactly once into the requested currency, then sum
        const totalNum = items.reduce(
            (acc, it) => acc + (rates ? convert(it.sum, it.currency, cur, rates) : it.sum),
            0
        );
        const total = Math.round(totalNum * 100) / 100;

        return { year: y, month: m, costs: items, total: { currency: cur, total } };
    }

    // Keep public API same as before
    return { addCost, getReport, setRates };
}
