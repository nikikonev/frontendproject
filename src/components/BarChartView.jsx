import { useEffect, useState } from 'react';
import { Box, MenuItem, Stack, TextField } from '@mui/material';
import InsertChartRoundedIcon from '@mui/icons-material/InsertChartRounded';
import {
    BarChart, Bar, XAxis, YAxis, Tooltip as RTooltip,
    ResponsiveContainer, Legend, CartesianGrid
} from 'recharts';
import { openCostsDB } from '../libs/idb.module.js';
import { CURRENCIES } from '../utils/currencies';
import SectionCard from './ui/SectionCard';

export default function BarChartView() {
    const now = new Date();
    const [api, setApi] = useState(null);
    const [year, setYear] = useState(now.getFullYear());
    const [base, setBase] = useState('USD');
    const [data, setData] = useState([]);

    useEffect(() => { openCostsDB().then(setApi).catch(console.error); }, []);

    useEffect(() => {
        if (!api) return;
        (async () => {
            const months = Array.from({ length: 12 }, (_, i) => i + 1);
            const out = [];
            for (const m of months) {
                const rep = await api.getReport(year, m, base);
                out.push({ month: String(m).padStart(2, '0'), total: rep.total?.total ?? 0 });
            }
            setData(out);
        })();
    }, [api, year, base]);

    const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

    return (
        <SectionCard
            title="Monthly Totals"
            subheader="Across the selected year"
            icon={<InsertChartRoundedIcon sx={{ color: 'primary.main' }} />}
        >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField select label="Year" value={year} onChange={e => setYear(Number(e.target.value))}
                           sx={{ width: { xs: '100%', sm: 140 } }}>
                    {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </TextField>
                <TextField select label="Base currency" value={base} onChange={e => setBase(e.target.value)}
                           sx={{ width: { xs: '100%', sm: 180 } }}>
                    {CURRENCIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
            </Stack>

            <Box sx={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                    <BarChart data={data}>
                        <CartesianGrid stroke="rgba(255,255,255,0.10)" strokeDasharray="3 3" />
                        <XAxis dataKey="month" stroke="rgba(255,255,255,0.72)" />
                        <YAxis stroke="rgba(255,255,255,0.72)" />
                        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.82)' }} />
                        <RTooltip
                            contentStyle={{
                                background: 'rgba(20,22,24,0.65)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                border: '1px solid rgba(255,255,255,0.10)',
                                borderRadius: 8,
                                color: '#fff',
                            }}
                            cursor={{ fill: 'rgba(255,255,255,0.06)' }}
                        />
                        <Bar dataKey="total" />
                    </BarChart>
                </ResponsiveContainer>
            </Box>
        </SectionCard>
    );
}
