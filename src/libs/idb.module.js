/* idb.module.js — React/ESM wrapper around IndexedDB (EURO-consistent) */

const DB_DEFAULT_NAME = 'costsdb';
const DB_VERSION = 1;
const COSTS_STORE = 'costs';
const RATES_STORE = 'rates';

// Utilities
function promisifyRequest(req) {
    return new Promise((resolve, reject) => {
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('IndexedDB error'));
    });
}

function withStore(db, storeName, mode, fn) {
    return new Promise((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const res = fn(store, tx);
        tx.oncomplete = () => resolve(res);
        tx.onerror = () => reject(tx.error || new Error('Transaction failed'));
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
}

// Keep the symbol EURO everywhere (brief requires USD, ILS, GBP, EURO)
export function normalizeCurrency(c) {
    const u = String(c ?? '').toUpperCase();
    if (u === 'EUR') return 'EURO';
    return u;
}

/**
 * openCostsDB(databaseName?: string, databaseVersion?: number)
 * Resolves to an API with: addCost, getReport, setRates, getLatestRates, convert, normalizeCurrency
 */
export function openCostsDB(databaseName = DB_DEFAULT_NAME, databaseVersion = DB_VERSION) {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(databaseName, Number(databaseVersion) || DB_VERSION);

        req.onupgradeneeded = (e) => {
            const db = e.target.result;

            // costs store
            if (!db.objectStoreNames.contains(COSTS_STORE)) {
                const store = db.createObjectStore(COSTS_STORE, { keyPath: 'id', autoIncrement: true });
                store.createIndex('by_year_month', ['year', 'month'], { unique: false });
                store.createIndex('by_category', 'category', { unique: false });
                store.createIndex('by_ts', 'ts', { unique: false });
            }

            // rates store
            if (!db.objectStoreNames.contains(RATES_STORE)) {
                db.createObjectStore(RATES_STORE, { keyPath: 'id' });
            }
        };

        req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
        req.onsuccess = async () => {
            const db = req.result;

            // API
            const api = {
                /**
                 * addCost({ sum:number, currency:string, category:string, description:string })
                 * Returns the inserted cost (only the 4 fields), per brief.
                 */
                async addCost(cost) {
                    const now = new Date();
                    const record = {
                        sum: Number(cost.sum),
                        currency: normalizeCurrency(cost.currency),
                        category: String(cost.category),
                        description: String(cost.description),
                        ts: now.getTime(),
                        year: now.getFullYear(),
                        month: now.getMonth() + 1,
                        day: now.getDate(),
                    };
                    await withStore(db, COSTS_STORE, 'readwrite', (store) => {
                        store.add(record);
                    });
                    // Return only the required fields
                    return {
                        sum: record.sum,
                        currency: record.currency,
                        category: record.category,
                        description: record.description,
                    };
                },

                /**
                 * getReport(year:number, month:number, currency:string)
                 * Returns { year, month, costs: [...], total: { currency, total } }
                 */
                async getReport(year, month, currency) {
                    const base = normalizeCurrency(currency);
                    const items = [];
                    await withStore(db, COSTS_STORE, 'readonly', (store) => {
                        const idx = store.index('by_year_month');
                        const range = IDBKeyRange.only([Number(year), Number(month)]);
                        const req2 = idx.openCursor(range);
                        req2.onsuccess = (ev) => {
                            const cursor = ev.target.result;
                            if (cursor) {
                                const v = cursor.value;
                                items.push({
                                    sum: v.sum,
                                    currency: v.currency,
                                    category: v.category,
                                    description: v.description,
                                    Date: { day: v.day },
                                });
                                cursor.continue();
                            }
                        };
                    });

                    // Compute total in selected base currency
                    const rates = await this.getLatestRates();
                    const total = items.reduce((acc, it) => {
                        return acc + this.convert(it.sum, it.currency, base, rates);
                    }, 0);

                    return {
                        year: Number(year),
                        month: Number(month),
                        costs: items,
                        total: { currency: base, total: Math.round(total * 100) / 100 },
                    };
                },

                /**
                 * setRates({ USD, GBP, EURO, ILS })
                 * Stores a single "latest" rates row under id='latest'
                 */
                async setRates(r) {
                    const payload = {
                        id: 'latest',
                        USD: Number(r.USD ?? 1),
                        GBP: Number(r.GBP ?? 1),
                        EURO: Number(r.EURO ?? 1), // keep EURO, not EUR
                        ILS: Number(r.ILS ?? 1),
                        ts: Date.now(),
                    };
                    await withStore(db, RATES_STORE, 'readwrite', (store) => {
                        store.put(payload);
                    });
                    return payload;
                },

                /**
                 * getLatestRates() -> { USD, GBP, EURO, ILS }
                 * Returns safe defaults (1) if none saved yet.
                 */
                async getLatestRates() {
                    const row = await withStore(db, RATES_STORE, 'readonly', (store) => promisifyRequest(store.get('latest')));
                    if (row && typeof row === 'object') {
                        return {
                            USD: Number(row.USD ?? 1),
                            GBP: Number(row.GBP ?? 1),
                            EURO: Number(row.EURO ?? 1),
                            ILS: Number(row.ILS ?? 1),
                        };
                    }
                    return { USD: 1, GBP: 1, EURO: 1, ILS: 1 };
                },

                /**
                 * convert(amount:number, from:string, to:string, rates)
                 * Assumes rates are relative (same base). If equal currency, returns amount.
                 */
                convert(amount, from, to, rates) {
                    const f = normalizeCurrency(from);
                    const t = normalizeCurrency(to);
                    if (!rates) {
                        throw new Error('Rates are required for conversion');
                    }
                    if (f === t) return Number(amount) || 0;

                    // Convert via a fixed base. Here we treat the numeric values as exchange
                    // factors relative to a conceptual base; using cross-rate math:
                    // amount_in_to = amount * (rate_to / rate_from).
                    const rateFrom = Number(rates[f]);
                    const rateTo = Number(rates[t]);
                    if (!Number.isFinite(rateFrom) || !Number.isFinite(rateTo) || rateFrom <= 0) {
                        throw new Error(`Invalid rates for conversion ${f} -> ${t}`);
                    }
                    const val = (Number(amount) || 0) * (rateTo / rateFrom);
                    return Math.round(val * 100) / 100;
                },
            };

            resolve(api);
        };
    });
}
