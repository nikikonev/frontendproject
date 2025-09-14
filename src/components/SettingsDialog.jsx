import * as React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Stack, TextField, Typography, Alert, MenuItem
} from '@mui/material';
import { CURRENCIES } from '../utils/currencies';

export default function SettingsDialog({ open, onClose, onSaved }) {
    const [settings, setSettings] = React.useState({
        ratesURL: localStorage.getItem('ratesURL') || '',
        baseCurrency: localStorage.getItem('baseCurrency') || 'USD'
    });
    const [message, setMessage] = React.useState('');

    const handleSave = async () => {
        try {
            localStorage.setItem('ratesURL', settings.ratesURL);
            localStorage.setItem('baseCurrency', settings.baseCurrency);

            if (settings.ratesURL) {
                const response = await fetch(settings.ratesURL, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`Failed to fetch rates: ${response.status}`);
                }
                const rates = await response.json();

                // Accept EUR or EURO, USD & GBP & ILS required
                const hasUSD = rates.USD != null;
                const hasGBP = rates.GBP != null;
                const eur = rates.EUR ?? rates.EURO;
                const hasEUR = eur != null;
                const hasILS = rates.ILS != null;
                if (!hasUSD || !hasGBP || !hasEUR || !hasILS) {
                    throw new Error('Invalid rates format. Expected keys: USD, GBP, EUR (or EURO), ILS');
                }

                // Normalize to EUR before saving
                const normalized = { ...rates, EUR: eur };
                delete normalized.EURO;

                const { openCostsDB } = await import('../libs/idb.module.js');
                const db = await openCostsDB();
                await db.setRates(normalized);
            }

            setMessage('Settings saved successfully!');
            setTimeout(() => {
                setMessage('');
                onSaved?.();
                onClose();
            }, 1000);
        } catch (error) {
            setMessage(`Error: ${error.message}`);
        }
    };

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Settings</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <Typography variant="body2" sx={{ opacity: 0.8 }}>
                        Configure exchange rates and default currency.
                    </Typography>

                    <TextField
                        label="Exchange Rates URL"
                        value={settings.ratesURL}
                        onChange={e => setSettings({ ...settings, ratesURL: e.target.value })}
                        placeholder="https://example.com/rates.json"
                        fullWidth
                        helperText="URL should return JSON like: {USD:1, GBP:1.8, EUR:0.7, ILS:3.4} (EUR or EURO accepted)"
                    />

                    <TextField
                        label="Default Base Currency"
                        select
                        value={settings.baseCurrency}
                        onChange={e => setSettings({ ...settings, baseCurrency: e.target.value })}
                        sx={{ minWidth: 200 }}
                    >
                        {CURRENCIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>

                    {message && (
                        <Alert severity={message.startsWith('Error') ? 'error' : 'success'}>
                            {message}
                        </Alert>
                    )}
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Cancel</Button>
                <Button variant="contained" onClick={handleSave}>Save</Button>
            </DialogActions>
        </Dialog>
    );
}
