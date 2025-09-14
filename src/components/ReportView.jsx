import { useEffect, useMemo, useState } from 'react';
import {
    Box, Paper, MenuItem, Stack, TextField, Typography, IconButton, Tooltip, Alert
} from '@mui/material';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { CURRENCIES } from '../utils/currencies';
import { openCostsDB } from '../libs/idb.module.js';
import SectionCard from './ui/SectionCard';

function two(n) { return (Math.round(n * 100) / 100).toFixed(2); }

export default function ReportView() {
    const now = new Date();
    const [api, setApi] = useState(null);
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [base, setBase] = useState('USD');
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState({ currency: base, total: 0 });
    const [err, setErr] = useState('');
    const [copied, setCopied] = useState(false);

    useEffect(() => { openCostsDB().then(setApi).catch(e => setErr(String(e))); }, []);

    const norm = (c) => (c === 'EUR' ? 'EURO' : c);
    const convert = (sum, from, to, rates) => {
        if (!rates) return sum;
        const rFrom = rates[norm(from)], rTo = rates[norm(to)];
        if (!isFinite(rFrom) || !isFinite(rTo)) return sum;
        // Convert: amount * (USD_per_from / USD_per_to)
        return (sum * rFrom) / rTo;
    };

    useEffect(() => {
        if (!api) return;
        setErr('');
        (async () => {
            try {
                const rep = await api.getReport(year, month, base);

                // safe rates read (in case store isn't there yet)
                let rates = { USD: 1 };
                try {
                    const db = await new Promise((res, rej) => {
                        const r = indexedDB.open('costsdb', 1);
                        r.onsuccess = () => res(r.result);
                        r.onerror = () => rej(r.error);
                    });
                    const tx = db.transaction('rates', 'readonly');
                    const store = tx.objectStore('rates');
                    const row = await new Promise((res, rej) => {
                        const rq = store.get('latest');
                        rq.onsuccess = () => res(rq.result);
                        rq.onerror = () => rej(rq.error);
                    });
                    if (row?.rates) rates = row.rates;
                } catch {}

                const enhanced = rep.costs.map(it => ({
                    ...it,
                    converted: convert(it.sum, it.currency, base, rates),
                    date: new Date(it.year || new Date().getFullYear(), (it.month || new Date().getMonth() + 1) - 1, it.Date?.day || new Date().getDate())
                }));

                setRows(enhanced);
                setTotal(rep.total || { currency: base, total: 0 });
            } catch (e) {
                setErr(String(e?.message || e));
            }
        })();
    }, [api, year, month, base]);

    const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);

    const csv = useMemo(() => {
        const header = ['Date','Description','Category','Original','Converted'];
        const body = rows.map(r => [
            r.date ? new Date(r.date).toISOString().slice(0,10) : '',
            (r.description ?? '').replaceAll('\t',' ').replaceAll('\n',' '),
            r.category ?? '',
            `${two(r.sum)} ${r.currency}`,
            r.converted != null ? `${two(r.converted)} ${base}` : ''
        ].join('\t'));
        return [header.join('\t'), ...body].join('\n');
    }, [rows, base]);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(csv);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
        } catch {}
    };

    return (
        <SectionCard
            title="Monthly Report"
            subheader="Original and converted amounts, by month"
            icon={<AssessmentRoundedIcon sx={{ color: 'primary.main' }} />}
            action={
                <Tooltip title="Copy table (TSV)">
                    <IconButton size="small" onClick={handleCopy}>
                        <ContentCopyRoundedIcon fontSize="small" />
                    </IconButton>
                </Tooltip>
            }
        >
            {/* Filters */}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center" sx={{ mb: 2 }}>
                <TextField
                    select label="Year" value={year} onChange={e => setYear(Number(e.target.value))}
                    sx={{ width: { xs: '100%', sm: 140 } }}
                >
                    {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </TextField>
                <TextField
                    select label="Month" value={month} onChange={e => setMonth(Number(e.target.value))}
                    sx={{ width: { xs: '100%', sm: 140 } }}
                >
                    {months.map(m => <MenuItem key={m} value={m}>{m.toString().padStart(2, '0')}</MenuItem>)}
                </TextField>
                <TextField
                    select label="Base currency" value={base} onChange={e => setBase(e.target.value)}
                    sx={{ width: { xs: '100%', sm: 180 } }}
                >
                    {CURRENCIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
            </Stack>

            {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

            {/* Light grey frosted TABLE — even more transparent */}
            <Paper
                elevation={0}
                sx={{
                    width: '100%',
                    overflowX: 'auto',
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(255,255,255,0.025)',
                    backdropFilter: 'blur(8px) saturate(120%)',
                    WebkitBackdropFilter: 'blur(8px) saturate(120%)',
                }}
            >
                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                    <Box component="thead" sx={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
                        <Box component="tr">
                            {['Date','Description','Category','Original',`Converted (${base})`].map((h,i) => (
                                <Box
                                    key={i}
                                    component="th"
                                    sx={{
                                        textAlign: 'left',
                                        p: '10px 14px',
                                        fontWeight: 700,
                                        borderBottom: '1px solid rgba(255,255,255,0.10)',
                                        color: '#f5f5f5',
                                    }}
                                >
                                    {h}
                                </Box>
                            ))}
                        </Box>
                    </Box>
                    <Box component="tbody">
                        {rows.map((r, idx) => {
                            const d = r.date ? new Date(r.date).toLocaleDateString() : '';
                            return (
                                <Box
                                    key={idx}
                                    component="tr"
                                    sx={{
                                        backgroundColor: idx % 2 === 0
                                            ? 'rgba(255,255,255,0.025)'
                                            : 'rgba(255,255,255,0.04)',
                                        '&:hover': { backgroundColor: 'rgba(255,255,255,0.07)' },
                                    }}
                                >
                                    <Box component="td" sx={{ p: '10px 14px', color: '#eee' }}>{d}</Box>
                                    <Box component="td" sx={{ p: '10px 14px', color: '#eee' }}>{r.description ?? ''}</Box>
                                    <Box component="td" sx={{ p: '10px 14px', color: '#eee' }}>{r.category ?? ''}</Box>
                                    <Box component="td" sx={{ p: '10px 14px', color: '#eee' }}>{two(r.sum)} {r.currency}</Box>
                                    <Box component="td" sx={{ p: '10px 14px', color: '#eee' }}>
                                        {r.converted != null ? `${two(r.converted)} ${base}` : ''}
                                    </Box>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Paper>

            {/* Frosted footer total — same transparency system as table */}
            <Paper
                elevation={0}
                sx={{
                    mt: 2,
                    px: 2,
                    py: 1.25,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 1,
                    borderRadius: 2,
                    border: '1px solid rgba(255,255,255,0.08)',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    backdropFilter: 'blur(8px) saturate(120%)',
                    WebkitBackdropFilter: 'blur(8px) saturate(120%)',
                }}
            >
                <Typography sx={{ fontWeight: 700, color: '#f5f5f5' }}>
                    Total:&nbsp;{two(total.total)}&nbsp;{total.currency}
                </Typography>
            </Paper>

            {copied && <Alert severity="success" sx={{ mt: 1 }}>Copied!</Alert>}
        </SectionCard>
    );
}
