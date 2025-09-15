import { useEffect, useMemo, useState } from 'react';
import { Stack, TextField, MenuItem, Alert } from '@mui/material';
import BarChartRoundedIcon from '@mui/icons-material/BarChartRounded';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import { openCostsDB } from '../libs/idb.module.js';
import SectionCard from './ui/SectionCard';

function two(n) { return (Math.round(n * 100) / 100).toFixed(2); }
function displayCurrency(code) { return String(code || '').toUpperCase() === 'EUR' ? 'EURO' : code; }

export default function BarChartView() {
    const now = new Date();
    const [api, setApi] = useState(null);
    const [year, setYear] = useState(now.getFullYear());
    const savedBase = typeof window !== 'undefined'
        ? (localStorage.getItem('baseCurrency') || 'USD')
        : 'USD';
    const [base, setBase] = useState(savedBase);
    const [data, setData] = useState([]);
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
            const months = Array.from({ length: 12 }, (_, i) => i + 1);
            // Parallel fetch for snappier UI
            const reports = await Promise.all(months.map(m => api.getReport(year, m, base)));
            const arr = reports.map((rep, i) => ({
                month: String(i + 1).padStart(2, '0'),
                total: Math.round((rep.total?.total || 0) * 100) / 100,
            }));
            setData(arr);
        } catch (e) {
            setErr(e?.message || 'Failed to build bar data');
        }
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [api, year, base]);

    const years = useMemo(() => {
        const y = now.getFullYear();
        return [y - 1, y, y + 1];
    }, [now]);

    return (
        <SectionCard title="Totals by Month" icon={<BarChartRoundedIcon />}>
            <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                    <TextField select label="Year" value={year} onChange={e => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
                        {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </TextField>
                    <TextField select label="Currency" value={base} onChange={e => setBase(e.target.value)} sx={{ minWidth: 140 }}>
                        {['USD', 'ILS', 'GBP', 'EURO'].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                </Stack>

                {err && <Alert severity="error">{err}</Alert>}

                <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer>
                        <BarChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="month" />
                            <YAxis />
                            <RTooltip formatter={(v) => `${two(v)} ${displayCurrency(base)}`} />
                            <Bar dataKey="total" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Stack>
        </SectionCard>
    );
}
