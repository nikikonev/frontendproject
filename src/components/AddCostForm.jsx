import { useEffect, useState } from 'react';
import {
    Box, Button, MenuItem, TextField, Stack, Typography, Snackbar, Alert, InputAdornment, IconButton, Tooltip
} from '@mui/material';
import AddCircleRoundedIcon from '@mui/icons-material/AddCircleRounded';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { CURRENCIES } from '../utils/currencies';
import { openCostsDB } from '../libs/idb.module.js';
import SectionCard from './ui/SectionCard';

export default function AddCostForm({ onAdded }) {
    const [api, setApi] = useState(null);
    const [form, setForm] = useState({ sum:'', currency:'USD', category:'Food', description:'' });
    const [msg, setMsg] = useState('');
    const [toast, setToast] = useState('');

    useEffect(()=>{ (async () => setApi(await openCostsDB('costsdb',1)))(); },[]);

    const onSubmit = async (e) => {
        e.preventDefault();
        if (!api) return;
        const sum = Number(form.sum);
        if (!isFinite(sum) || sum <= 0) { setMsg('Sum must be a positive number'); return; }
        const out = await api.addCost({ ...form, sum });
        setMsg('');
        setToast(`Added ${out.sum} ${out.currency} (${out.category})`);
        setForm({ sum:'', currency:form.currency, category:form.category, description:'' });
        onAdded?.();
    };

    return (
        <>
            <SectionCard
                title="Add Cost"
                subheader="Record a new expense item"
                icon={<AddCircleRoundedIcon sx={{ color: 'primary.main' }} />}
                action={
                    <Tooltip title="Base currency is USD. Set your Exchange Rates URL in Settings.">
                        <IconButton color="inherit" size="small"><InfoOutlinedIcon fontSize="small" /></IconButton>
                    </Tooltip>
                }
            >
                <Box component="form" onSubmit={onSubmit}>
                    <Stack direction={{ xs:'column', sm:'row' }} spacing={2} sx={{ flexWrap:'wrap' }}>
                        <TextField
                            label="Sum"
                            type="number"
                            value={form.sum}
                            onChange={e=>setForm(f=>({...f,sum:e.target.value}))}
                            required
                            sx={{ width: { xs: '100%', sm: 180 } }}
                            InputProps={{
                                startAdornment: <InputAdornment position="start">{form.currency}</InputAdornment>
                            }}
                        />
                        <TextField
                            label="Currency"
                            select
                            value={form.currency}
                            onChange={e=>setForm(f=>({...f,currency:e.target.value}))}
                            sx={{ width: { xs: '100%', sm: 160 } }}
                            InputLabelProps={{ shrink: true }}
                        >
                            {CURRENCIES.map(c=> <MenuItem key={c} value={c}>{c}</MenuItem>)}
                        </TextField>
                        <TextField
                            label="Category"
                            value={form.category}
                            onChange={e=>setForm(f=>({...f,category:e.target.value}))}
                            sx={{ width: { xs: '100%', sm: 220 } }}
                        />
                        <TextField
                            label="Description"
                            value={form.description}
                            onChange={e=>setForm(f=>({...f,description:e.target.value}))}
                            fullWidth
                            sx={{ minWidth: 240, flex: 1 }}
                        />
                        <Button type="submit" variant="contained" sx={{ height: 56 }}>Add</Button>
                    </Stack>
                </Box>
                {msg && <Typography sx={{ mt:2 }} color="warning.main">{msg}</Typography>}
            </SectionCard>

            <Snackbar
                open={!!toast}
                autoHideDuration={2500}
                onClose={()=>setToast('')}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
            >
                <Alert onClose={()=>setToast('')} severity="success" variant="filled">
                    {toast}
                </Alert>
            </Snackbar>
        </>
    );
}
