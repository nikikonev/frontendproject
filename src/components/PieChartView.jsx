import { useEffect, useMemo, useState } from 'react';
import { Stack, TextField, MenuItem, Alert } from '@mui/material';
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer } from 'recharts';
import PieChartRoundedIcon from '@mui/icons-material/PieChartRounded';
import { openCostsDB } from '../libs/idb.module.js';
import SectionCard from './ui/SectionCard';

function displayCurrency(code) { return String(code || '').toUpperCase() === 'EUR' ? 'EURO' : code; }
function two(n) { return (Math.round(n * 100) / 100).toFixed(2); }

export default function PieChartView() {
    const now = new Date();
    const [api, setApi] = useState(null);
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
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
            const rep = await api.getReport(year, month, base);
            // Aggregate by category in selected base currency:
            const rates = await api.getLatestRates();
            const buckets = new Map();
            for (const it of rep.costs || []) {
                const v = api.convert(it.sum, it.currency, rep.total.currency, rates);
                buckets.set(it.category, (buckets.get(it.category) || 0) + v);
            }
            const arr = [...buckets.entries()].map(([name, value]) => ({ name, value: Math.round(value * 100) / 100 }));
            setData(arr);
        } catch (e) {
            setErr(e?.message || 'Failed to build pie data');
        }
    }

    useEffect(() => { load(); /* eslint-disable-next-line */ }, [api, year, month, base]);

    const years = useMemo(() => {
        const y = now.getFullYear();
        return [y - 1, y, y + 1];
    }, [now]);

    return (
        <SectionCard title="Costs by Category" icon={<PieChartRoundedIcon />}>
            <Stack spacing={2}>
                <Stack direction="row" spacing={2}>
                    <TextField select label="Year" value={year} onChange={e => setYear(Number(e.target.value))} sx={{ minWidth: 120 }}>
                        {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                    </TextField>
                    <TextField select label="Month" value={month} onChange={e => setMonth(Number(e.target.value))} sx={{ minWidth: 120 }}>
                        {Array.from({ length: 12 }, (_, i) => i + 1).map(m =>
                            <MenuItem key={m} value={m}>{m.toString().padStart(2, '0')}</MenuItem>
                        )}
                    </TextField>
                    <TextField select label="Currency" value={base} onChange={e => setBase(e.target.value)} sx={{ minWidth: 140 }}>
                        {['USD', 'ILS', 'GBP', 'EURO'].map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                    </TextField>
                </Stack>

                {err && <Alert severity="error">{err}</Alert>}

                <div style={{ width: '100%', height: 320 }}>
                    <ResponsiveContainer>
                        <PieChart>
                            <Pie data={data} dataKey="value" nameKey="name" outerRadius={110} label={({ name, value }) => `${name}: ${two(value)} ${displayCurrency(base)}`}>
                                {data.map((_, i) => <Cell key={i} />)}
                            </Pie>
                            <RTooltip formatter={(v) => two(v)} />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </Stack>
        </SectionCard>
    );
}
