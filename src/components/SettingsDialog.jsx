import * as React from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Stack, TextField, Typography, Alert
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
            // Save settings to localStorage
            localStorage.setItem('ratesURL', settings.ratesURL);
            localStorage.setItem('baseCurrency', settings.baseCurrency);
            
            // Test the rates URL if provided
            if (settings.ratesURL) {
                const response = await fetch(settings.ratesURL, { cache: 'no-store' });
                if (!response.ok) {
                    throw new Error(`Failed to fetch rates: ${response.status}`);
                }
                const rates = await response.json();
                
                // Validate the rates structure
                if (!rates.USD || !rates.GBP || !rates.EURO || !rates.ILS) {
                    throw new Error('Invalid rates format. Expected: {USD: 1, GBP: 1.8, EURO: 0.7, ILS: 3.4}');
                }
                
                // Save rates to IndexedDB
                const { openCostsDB } = await import('../libs/idb.module.js');
                const db = await openCostsDB();
                await db.setRates(rates);
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
                        onChange={e => setSettings({...settings, ratesURL: e.target.value})}
                        placeholder="https://example.com/rates.json"
                        fullWidth
                        helperText="URL should return JSON with format: {USD: 1, GBP: 1.8, EURO: 0.7, ILS: 3.4}"
                    />
                    
                    <TextField
                        label="Default Base Currency"
                        select
                        value={settings.baseCurrency}
                        onChange={e => setSettings({...settings, baseCurrency: e.target.value})}
                        sx={{ minWidth: 200 }}
                    >
                        {CURRENCIES.map(currency => (
                            <option key={currency} value={currency}>{currency}</option>
                        ))}
                    </TextField>
                    
                    {message && (
                        <Alert severity={message.includes('Error') ? 'error' : 'success'}>
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
