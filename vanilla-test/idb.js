// vanilla-test/idb.js — Vanilla (global) IndexedDB wrapper (EURO-consistent)
(function (global) {
    'use strict';

    var DB_DEFAULT_NAME = 'costsdb';
    var DB_VERSION = 1;
    var COSTS_STORE = 'costs';
    var RATES_STORE = 'rates';

    function promisifyRequest(req) {
        return new Promise(function (resolve, reject) {
            req.onsuccess = function () { resolve(req.result); };
            req.onerror = function () { reject(req.error || new Error('IndexedDB error')); };
        });
    }

    function withStore(db, storeName, mode, fn) {
        return new Promise(function (resolve, reject) {
            var tx = db.transaction(storeName, mode);
            var store = tx.objectStore(storeName);
            var res = fn(store, tx);
            tx.oncomplete = function () { resolve(res); };
            tx.onerror = function () { reject(tx.error || new Error('Transaction failed')); };
            tx.onabort = function () { reject(tx.error || new Error('Transaction aborted')); };
        });
    }

    function normalizeCurrency(c) {
        var u = String(c || '').toUpperCase();
        if (u === 'EUR') return 'EURO';
        return u;
    }

    function openCostsDB(databaseName, databaseVersion) {
        return new Promise(function (resolve, reject) {
            var name = typeof databaseName === 'string' ? databaseName : DB_DEFAULT_NAME;
            var version = Number(databaseVersion) || DB_VERSION;

            var req = indexedDB.open(name, version);

            req.onupgradeneeded = function (e) {
                var db = e.target.result;

                if (!db.objectStoreNames.contains(COSTS_STORE)) {
                    var store = db.createObjectStore(COSTS_STORE, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('by_year_month', ['year', 'month'], { unique: false });
                    store.createIndex('by_category', 'category', { unique: false });
                    store.createIndex('by_ts', 'ts', { unique: false });
                }

                if (!db.objectStoreNames.contains(RATES_STORE)) {
                    db.createObjectStore(RATES_STORE, { keyPath: 'id' });
                }
            };

            req.onerror = function () { reject(req.error || new Error('Failed to open IndexedDB')); };
            req.onsuccess = function () {
                var db = req.result;

                var api = {
                    addCost: function (cost) {
                        var now = new Date();
                        var record = {
                            sum: Number(cost.sum),
                            currency: normalizeCurrency(cost.currency),
                            category: String(cost.category),
                            description: String(cost.description),
                            ts: now.getTime(),
                            year: now.getFullYear(),
                            month: now.getMonth() + 1,
                            day: now.getDate(),
                        };
                        return withStore(db, COSTS_STORE, 'readwrite', function (store) {
                            store.add(record);
                        }).then(function () {
                            return {
                                sum: record.sum,
                                currency: record.currency,
                                category: record.category,
                                description: record.description,
                            };
                        });
                    },

                    getReport: function (year, month, currency) {
                        var base = normalizeCurrency(currency);
                        var items = [];
                        return withStore(db, COSTS_STORE, 'readonly', function (store) {
                            var idx = store.index('by_year_month');
                            var range = IDBKeyRange.only([Number(year), Number(month)]);
                            var req2 = idx.openCursor(range);
                            req2.onsuccess = function (ev) {
                                var cursor = ev.target.result;
                                if (cursor) {
                                    var v = cursor.value;
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
                        }).then(function () {
                            return api.getLatestRates().then(function (rates) {
                                var total = items.reduce(function (acc, it) {
                                    return acc + api.convert(it.sum, it.currency, base, rates);
                                }, 0);
                                return {
                                    year: Number(year),
                                    month: Number(month),
                                    costs: items,
                                    total: { currency: base, total: Math.round(total * 100) / 100 },
                                };
                            });
                        });
                    },

                    setRates: function (r) {
                        var payload = {
                            id: 'latest',
                            USD: Number(r.USD || 1),
                            GBP: Number(r.GBP || 1),
                            EURO: Number(r.EURO || 1),
                            ILS: Number(r.ILS || 1),
                            ts: Date.now(),
                        };
                        return withStore(db, RATES_STORE, 'readwrite', function (store) {
                            store.put(payload);
                        }).then(function () { return payload; });
                    },

                    getLatestRates: function () {
                        return withStore(db, RATES_STORE, 'readonly', function (store) {
                            return promisifyRequest(store.get('latest'));
                        }).then(function (row) {
                            if (row && typeof row === 'object') {
                                return {
                                    USD: Number(row.USD || 1),
                                    GBP: Number(row.GBP || 1),
                                    EURO: Number(row.EURO || 1),
                                    ILS: Number(row.ILS || 1),
                                };
                            }
                            return { USD: 1, GBP: 1, EURO: 1, ILS: 1 };
                        });
                    },

                    convert: function (amount, from, to, rates) {
                        var f = normalizeCurrency(from);
                        var t = normalizeCurrency(to);
                        if (!rates) throw new Error('Rates are required for conversion');
                        if (f === t) return Number(amount) || 0;
                        var rateFrom = Number(rates[f]);
                        var rateTo = Number(rates[t]);
                        if (!isFinite(rateFrom) || !isFinite(rateTo) || rateFrom <= 0) {
                            throw new Error('Invalid rates for conversion ' + f + ' -> ' + t);
                        }
                        var val = (Number(amount) || 0) * (rateTo / rateFrom);
                        return Math.round(val * 100) / 100;
                    },

                    normalizeCurrency: normalizeCurrency,
                };

                resolve(api);
            };
        });
    }

    // Expose global `idb` as required by the brief
    global.idb = {
        openCostsDB: openCostsDB,
    };
})(typeof window !== 'undefined' ? window : globalThis);
