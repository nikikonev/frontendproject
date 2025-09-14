/* idb.js — Vanilla IndexedDB wrapper (global, fixed math + EUR normalization) */
(function (global) {
    'use strict';

    // Promisify an IDBRequest
    function reqToPromise(req) {
        return new Promise(function (resolve, reject) {
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error); };
        });
    }

    function openCostsDB(databaseName, databaseVersion) {
        if (typeof databaseName !== 'string') {
            return Promise.reject(new Error('databaseName must be a string'));
        }
        var version = Number(databaseVersion) || 1;
        var openReq = indexedDB.open(databaseName, version);

        // Create / upgrade schema
        openReq.onupgradeneeded = function (e) {
            var db = e.target.result;
            if (!db.objectStoreNames.contains('costs')) {
                var costs = db.createObjectStore('costs', { keyPath: 'id', autoIncrement: true });
                costs.createIndex('by_year_month', ['year', 'month'], { unique: false });
                costs.createIndex('by_category', 'category', { unique: false });
            }
            if (!db.objectStoreNames.contains('rates')) {
                db.createObjectStore('rates', { keyPath: 'id' });
            }
        };

        return reqToPromise(openReq).then(function (db) {
            function withStore(mode, cb) {
                return new Promise(function (resolve, reject) {
                    var tx = db.transaction(['costs', 'rates'], mode);
                    var stores = { costs: tx.objectStore('costs'), rates: tx.objectStore('rates') };
                    var out = cb(stores);
                    tx.oncomplete = function () { resolve(out); };
                    tx.onerror = function () { reject(tx.error); };
                });
            }

            // ---- Currency + Rates normalization -----------------------------------
            function normalizeCurrency(c) {
                if (!c) return 'USD';
                var up = String(c).toUpperCase().trim();
                // Canonical: use EUR everywhere; accept EURO as alias
                if (up === 'EURO') return 'EUR';
                return up;
            }

            function normalizeRatesObject(obj) {
                if (!obj || typeof obj !== 'object') return obj;

                // Wrapped { base, rates }
                if (obj.rates && typeof obj.rates === 'object') {
                    var copy = { base: obj.base, rates: Object.assign({}, obj.rates) };
                    if (copy.base && String(copy.base).toUpperCase() === 'EURO') copy.base = 'EUR';
                    if (copy.rates.EURO != null && copy.rates.EUR == null) {
                        copy.rates.EUR = copy.rates.EURO;
                        delete copy.rates.EURO;
                    }
                    return copy;
                }

                // Flat map
                var map = Object.assign({}, obj);
                if (map.EURO != null && map.EUR == null) {
                    map.EUR = map.EURO;
                    delete map.EURO;
                }
                return map;
            }

            // ---- Public API: costs -------------------------------------------------
            function addCost(cost) {
                if (!cost || typeof cost !== 'object') {
                    return Promise.reject(new Error('cost must be an object'));
                }
                var now = new Date();
                var sum = Number(cost.sum);
                if (!isFinite(sum)) return Promise.reject(new Error('sum must be a number'));
                var currency = normalizeCurrency(cost.currency || cost.curency || 'USD'); // tolerate "curency" typo
                var category = String(cost.category || 'General');
                var description = String(cost.description || '');

                var record = {
                    sum: sum,
                    currency: currency,
                    category: category,
                    description: description,
                    ts: now.getTime(),
                    year: now.getFullYear(),
                    month: now.getMonth() + 1,
                    day: now.getDate()
                };

                return withStore('readwrite', function (s) {
                    s.costs.add(record);
                    // Return shape per spec: the newly added cost item (without date fields)
                    return {
                        sum: record.sum,
                        currency: record.currency,
                        category: record.category,
                        description: record.description
                    };
                });
            }

            // ---- Public API: rates -------------------------------------------------
            function setRates(ratesObj) {
                if (!ratesObj || typeof ratesObj !== 'object') {
                    return Promise.reject(new Error('rates must be an object'));
                }
                var normalized = normalizeRatesObject(ratesObj);
                return withStore('readwrite', function (s) {
                    s.rates.put({ id: 'latest', updatedAt: Date.now(), rates: normalized });
                    return true;
                });
            }

            function getLatestRates() {
                return withStore('readonly', function (s) {
                    var req = s.rates.get('latest');
                    return reqToPromise(req).then(function (row) {
                        return row && row.rates ? row.rates : null; // explicit: no rates saved
                    });
                });
            }

            // ---- Conversion (shape-aware, correct math) ---------------------------
            // Supports:
            //  A) flat map with USD=1 (C_per_USD), e.g. { USD:1, ILS:3.4, EUR:0.7 }
            //  B) wrapped { base:'USD', rates:{...} } where rates[X] = X_per_base
            //
            // Correct formula for both shapes:
            //   amount_in_to = amount * (rate[to] / rate[from])
            function convertAmount(sum, from, to, rates) {
                var amount = Number(sum);
                if (!isFinite(amount) || !rates) return amount;

                // Wrapped { base, rates }
                if (rates && typeof rates === 'object' && rates.rates && typeof rates.rates === 'object') {
                    var tableW = rates.rates;
                    var base = (rates.base || 'USD').toUpperCase();
                    var fW = normalizeCurrency(from);
                    var tW = normalizeCurrency(to);
                    var rFromW = Number(fW === base ? 1 : tableW[fW]);
                    var rToW   = Number(tW === base ? 1 : tableW[tW]);
                    if (!isFinite(rFromW) || !isFinite(rToW)) return amount;
                    var vW = amount * (rToW / rFromW);
                    return Math.round((vW + Number.EPSILON) * 100) / 100;
                }

                // Flat map (your current public/rates.json)
                var table = rates;
                var f = normalizeCurrency(from);
                var t = normalizeCurrency(to);

                function get(k) {
                    if (table[k] != null) return Number(table[k]);
                    if (k === 'EUR' && table['EURO'] != null) return Number(table['EURO']); // legacy alias
                    return NaN;
                }

                var rFrom = get(f);
                var rTo   = get(t);
                if (!isFinite(rFrom) || !isFinite(rTo)) return amount;

                var v = amount * (rTo / rFrom); // ✅ correct for C_per_USD (USD:1)
                return Math.round((v + Number.EPSILON) * 100) / 100;
            }

            function getReport(year, month, currency) {
                var y = Number(year), m = Number(month);
                var cur = normalizeCurrency(currency || 'USD');
                if (!isFinite(y) || !isFinite(m)) {
                    return Promise.reject(new Error('year and month must be numbers'));
                }

                return getLatestRates().then(function (rates) {
                    return withStore('readonly', function (s) {
                        var idx = s.costs.index('by_year_month');
                        var KR = (typeof IDBKeyRange !== 'undefined' ? IDBKeyRange : (self && self.IDBKeyRange));
                        var range = KR.only([y, m]);
                        var cursorReq = idx.openCursor(range);

                        return new Promise(function (resolve, reject) {
                            var items = [];
                            cursorReq.onerror = function () { reject(cursorReq.error); };
                            cursorReq.onsuccess = function (ev) {
                                var cursor = ev.target.result;
                                if (cursor) {
                                    var v = cursor.value;
                                    items.push({
                                        sum: v.sum,
                                        currency: v.currency,
                                        category: v.category,
                                        description: v.description,
                                        Date: { day: v.day }
                                    });
                                    cursor.continue();
                                } else {
                                    var totalNum = items.reduce(function (acc, it) {
                                        return acc + convertAmount(it.sum, it.currency, cur, rates);
                                    }, 0);
                                    var report = {
                                        year: y,
                                        month: m,
                                        costs: items,
                                        total: { currency: cur, total: Math.round(totalNum * 100) / 100 }
                                    };
                                    resolve(report);
                                }
                            };
                        });
                    });
                });
            }

            return {
                addCost: addCost,
                getReport: getReport,
                setRates: setRates
            };
        });
    }

    // expose global "idb" with openCostsDB
    global.idb = { openCostsDB: openCostsDB };

})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
