import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    MenuItem,
    Button,
    Stack,
    Typography,
} from '@mui/material';
import { openCostsDB } from '../libs/idb.module.js'; // <-- add this import

// Minimal helper to coerce numbers safely
function toNum(v, fallback = 1) {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * SettingsDialog
 * Props:
 * - open: boolean
 * - onClose: () => void
 * - onSaved?: () => void
 * - api?: object with setRates(normalized), optional now (we lazy-init if missing)
 */
export default function SettingsDialog({ open, onClose, onSaved, api }) {
    const [ratesUrl, setRatesUrl] = useState('');
    const [baseCurrency, setBaseCurrency] = useState('USD');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState('');

    // Keep a resolved API here (from prop or from lazy open)
    const apiRef = useRef(null);

    // Load saved prefs each time dialog opens
    useEffect(() => {
        if (!open) return;
        setErr('');
        const savedUrl = localStorage.getItem('ratesUrl') || '/rates.json';
        const savedBase = localStorage.getItem('baseCurrency') || 'USD';
        setRatesUrl(savedUrl);
        setBaseCurrency(savedBase);
    }, [open]);

    // Ensure we have an API (use prop if provided; otherwise open our own once)
    useEffect(() => {
        let cancelled = false;

        async function ensureApi() {
            try {
                if (api && typeof api.setRates === 'function') {
                    apiRef.current = api;
                    return;
                }
                // Lazily open our own if missing
                const localApi = await openCostsDB(); // uses defaults
                if (!cancelled) apiRef.current = localApi;
            } catch (e) {
                if (!cancelled) setErr(e?.message || 'Failed to init database API.');
            }
        }

        if (open) ensureApi();
        return () => { cancelled = true; };
    }, [open, api]);

    async function handleSave() {
        setErr('');
        setBusy(true);
        try {
            // Persist the preferences
            localStorage.setItem('ratesUrl', ratesUrl);
            localStorage.setItem('baseCurrency', baseCurrency);

            // Fetch rates JSON (avoid stale cache)
            const res = await fetch(ratesUrl, { mode: 'cors', cache: 'no-store' });
            if (!res.ok) throw new Error(`Failed to fetch rates: HTTP ${res.status}`);
            const raw = await res.json();

            // Accept either flat or wrapped under { rates: { ... } }
            const src = (raw && typeof raw.rates === 'object' && raw.rates) ? raw.rates : raw;

            // Normalize keys exactly as the brief requires: USD, ILS, GBP, EURO
            // Accept EUR (maps to EURO) and lowercase keys.
            const normalized = {
                USD: toNum(src.USD ?? src.usd ?? 1),
                GBP: toNum(src.GBP ?? src.gbp ?? 1),
                EURO: toNum(src.EURO ?? src.EUR ?? src.euro ?? 1),
                ILS: toNum(src.ILS ?? src.ils ?? 1),
            };

            const realApi = apiRef.current;
            if (!realApi || typeof realApi.setRates !== 'function') {
                throw new Error('API not available: setRates missing.');
            }

            await realApi.setRates(normalized);

            onSaved?.();
            onClose?.();
        } catch (e) {
            setErr(e?.message || 'Unknown error while saving settings.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Settings</DialogTitle>
            <DialogContent>
                <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField
                        label="Rates JSON URL"
                        value={ratesUrl}
                        onChange={(e) => setRatesUrl(e.target.value)}
                        helperText="URL that returns a JSON with keys: USD, GBP, EURO (or EUR), ILS"
                        fullWidth
                    />
                    <TextField
                        select
                        label="Default currency"
                        value={baseCurrency}
                        onChange={(e) => setBaseCurrency(e.target.value)}
                        fullWidth
                    >
                        {['USD', 'ILS', 'GBP', 'EURO'].map((c) => (
                            <MenuItem key={c} value={c}>{c}</MenuItem>
                        ))}
                    </TextField>

                    {err ? (
                        <Typography variant="body2" color="error">
                            {err}
                        </Typography>
                    ) : null}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={busy}>
                    Save
                </Button>
            </DialogActions>
        </Dialog>
    );
}
