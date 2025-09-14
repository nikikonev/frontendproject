export async function openCostsDB(databaseName = 'costsdb', databaseVersion = 1) {
    function reqToPromise(req) {
        return new Promise((resolve, reject) => {
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }
    function normalizeCurrency(c) {
        if (!c) return 'USD';
        const up = String(c).toUpperCase().trim();
        return up === 'EUR' ? 'EURO' : up; // assignment uses EURO key
    }

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
            const tx = db.transaction(['costs','rates'], mode);
            const stores = { costs: tx.objectStore('costs'), rates: tx.objectStore('rates') };
            const out = cb(stores);
            tx.oncomplete = () => resolve(out);
            tx.onerror = () => reject(tx.error);
        });
    }

    async function setRates(rates) {
        return withStore('readwrite', (s) =>
            s.rates.put({ id: 'latest', updatedAt: Date.now(), rates })
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
        await setRates(json);
        return json;
    }

    async function ensureRates() {
        let rates = await getLatestRates();
        if (!rates) {
            try { rates = await fetchRatesFromURL(); } catch { /* ignore */ }
        }
        return rates; // can be null
    }

    // Convert currency using rates where rates[currency] = USD per 1 unit of currency
    function convert(amount, from, to, rates) {
        if (!rates) return amount;
        const rf = Number(rates[normalizeCurrency(from)]);
        const rt = Number(rates[normalizeCurrency(to)]);
        if (!isFinite(rf) || !isFinite(rt)) return amount;
        // Convert: amount * (USD_per_from / USD_per_to)
        return (amount * rf) / rt;
    }


    async function addCost(cost) {
        const now = new Date();
        const rec = {
            sum: Number(cost.sum),
            currency: normalizeCurrency(cost.currency || cost.curency || 'USD'),
            category: String(cost.category || 'General'),
            description: String(cost.description || ''),
            ts: now.getTime(),
            year: now.getFullYear(),
            month: now.getMonth()+1,
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

        // If no rates, total is just raw sum in requested currency (no conversion)
        const totalNum = items.reduce((acc, it) => acc + (rates ? convert(it.sum, it.currency, cur, rates) : it.sum), 0);
        const total = Math.round(totalNum * 100) / 100;

        return { year: y, month: m, costs: items, total: { currency: cur, total } };
    }

    return { addCost, getReport, setRates };
}
