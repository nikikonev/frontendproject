/* idb.js — Vanilla IndexedDB wrapper (global) */
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

            function normalizeCurrency(c) {
                if (!c) return 'USD';
                var up = String(c).toUpperCase().trim();
                return up === 'EUR' ? 'EURO' : up; // assignment uses EURO key
            }

            function addCost(cost) {
                if (!cost || typeof cost !== 'object') {
                    return Promise.reject(new Error('cost must be an object'));
                }
                var now = new Date();
                var sum = Number(cost.sum);
                if (!isFinite(sum)) return Promise.reject(new Error('sum must be a number'));
                var currency = normalizeCurrency(cost.currency || cost.curency || 'USD'); // tolerate "curency" typo from sample
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

            function setRates(ratesObj) {
                // Example: { USD:1, GBP:1.8, EURO:0.7, ILS:3.4 }
                if (!ratesObj || typeof ratesObj !== 'object') {
                    return Promise.reject(new Error('rates must be an object'));
                }
                return withStore('readwrite', function (s) {
                    s.rates.put({ id: 'latest', updatedAt: Date.now(), rates: ratesObj });
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

            // Convert using USD-per-1-unit-of-currency semantics (assignment style).
            // Example rates: { USD:1, GBP:1.8, EURO:0.7, ILS:3.4 } => 1 GBP = 1.8 USD
            // Formula: amount_in_target = (amount * USD_per_FROM) / USD_per_TO
            function convertAmount(sum, from, to, rates) {
                if (!rates) return Number(sum);
                from = normalizeCurrency(from);
                to = normalizeCurrency(to);
                var rFrom = Number(rates[from]);
                var rTo = Number(rates[to]);
                if (!isFinite(rFrom) || !isFinite(rTo)) return Number(sum); // if missing, fall back to raw sum
                return (Number(sum) * rFrom) / rTo; // FROM -> USD -> TO
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
                                    // Keep original amounts & currencies per spec
                                    items.push({
                                        sum: v.sum,
                                        currency: v.currency,
                                        category: v.category,
                                        description: v.description,
                                        Date: { day: v.day }
                                    });
                                    cursor.continue();
                                } else {
                                    // finished
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
