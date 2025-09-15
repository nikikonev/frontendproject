import { useEffect, useMemo, useState } from 'react';
import {
    Box, Paper, MenuItem, Stack, TextField, Typography, Alert
} from '@mui/material';
import AssessmentRoundedIcon from '@mui/icons-material/AssessmentRounded';
import { openCostsDB } from '../libs/idb.module.js';
import SectionCard from './ui/SectionCard';

function two(n) { return (Math.round(n * 100) / 100).toFixed(2); }
function displayCurrency(code) { return String(code || '').toUpperCase() === 'EUR' ? 'EURO' : code; }

export default function ReportView() {
    const now = new Date();
    const [api, setApi] = useState(null);
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const savedBase = typeof window !== 'undefined'
        ? (localStorage.getItem('baseCurrency') || 'USD')
        : 'USD';
    const [base, setBase] = useState(savedBase);
    const [rows, setRows] = useState([]);
    const [total, setTotal] = useState({ currency: base, total: 0 });
    const [err, setErr] = useState('');

    useEffect(() => {
        let alive = true;
        openCostsDB().then((db) => { if (alive) setApi(db); })
            .catch((e) => setErr(e?.message || 'Failed to open DB'));
        return () => { alive = false; };
    }, []);

    async function load() {
        if (!api) return;
        try {
            setErr('');
            const rep = await api.getReport(year, month, base);
            setRows(rep.costs || []);
            setTotal(rep.total || { currency: base, total: 0 });
        } catch (e) {
            setErr(e?.message || 'Failed to load report');
        }
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [api, year, month, base]);

    const years = useMemo(() => {
        const y = now.getFullYear();
        return [y - 1, y, y + 1];
    }, [now]);

    return (
        <SectionCard
            title="Monthly Report"
            icon={<AssessmentRoundedIcon />}
        >
            <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                    <TextField
                        select label="Year" value={year} onChange={e => setYear(Number(e.target.value))}
                        sx={{ minWidth: 120 }}
                    >
                        {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </TextField>
                    <TextField
                        select label="Month" value={month} onChange={e => setMonth(Number(e.target.value))}
                        sx={{ minWidth: 120 }}
                    >
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
                            <MenuItem key={m} value={m}>{m.toString().padStart(2, '0')}</MenuItem>
                        )}
                    </TextField>
                    <TextField
                        select label="Currency" value={base} onChange={e => setBase(e.target.value)}
                        sx={{ minWidth: 140 }}
                    >
                        {['USD', 'ILS', 'GBP', 'EURO'].map(c =>
                            <MenuItem key={c} value={c}>{c}</MenuItem>
                        )}
                    </TextField>
                </Stack>

                {err && <Alert severity="error">{err}</Alert>}

                <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>
                        Total: {two(total.total || 0)} {displayCurrency(total.currency)}
                    </Typography>

                    {/* Force strict LTR column order */}
                    <Box dir="ltr">
                        <Box
                            component="table"
                            dir="ltr"
                            sx={{ width: '100%', borderCollapse: 'collapse' }}
                        >
                            <thead dir="ltr">
                            <tr>
                                <th style={{ textAlign: 'left', padding: '6px' }}>Day</th>
                                <th style={{ textAlign: 'left', padding: '6px' }}>Category</th>
                                <th style={{ textAlign: 'left', padding: '6px' }}>Description</th>
                                <th style={{ textAlign: 'left', padding: '6px' }}>Sum</th>
                                <th style={{ textAlign: 'left', padding: '6px' }}>Currency</th>
                            </tr>
                            </thead>
                            <tbody dir="ltr">
                            {rows.map((r, i) => (
                                <tr key={i}>
                                    <td style={{ padding: '6px' }}>{r.Date?.day ?? ''}</td>
                                    <td style={{ padding: '6px' }}>{r.category}</td>
                                    <td style={{ padding: '6px' }}>{r.description}</td>
                                    <td style={{ padding: '6px' }}>{two(r.sum)}</td>
                                    <td style={{ padding: '6px' }}>{displayCurrency(r.currency)}</td>
                                </tr>
                            ))}
                            </tbody>
                        </Box>
                    </Box>
                </Paper>
            </Stack>
        </SectionCard>
    );
}
