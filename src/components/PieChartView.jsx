import { useEffect, useState } from 'react';
import { Box, MenuItem, Stack, TextField } from '@mui/material';
import PieChartRoundedIcon from '@mui/icons-material/PieChartRounded';
import {
    PieChart, Pie, Cell, Tooltip as RTooltip,
    ResponsiveContainer, Legend
} from 'recharts';
import { openCostsDB } from '../libs/idb.module.js';
import { CURRENCIES } from '../utils/currencies';
import SectionCard from './ui/SectionCard';

export default function PieChartView() {
    const now = new Date();
    const [api, setApi] = useState(null);
    const [year, setYear] = useState(now.getFullYear());
    const [month, setMonth] = useState(now.getMonth() + 1);
    const [base, setBase] = useState('USD');
    const [data, setData] = useState([]);

    useEffect(() => { openCostsDB().then(setApi).catch(console.error); }, []);

    useEffect(() => {
        if (!api) return;
        (async () => {
            try {
                const rep = await api.getReport(year, month, base);
                const rates = await api.getLatestRates();

                const byCat = new Map();
                for (const it of rep.costs) {
                    const converted = rates ? api.convert(it.sum, it.currency, base, rates) : it.sum;
                    const k = it.category || 'other';
                    byCat.set(k, (byCat.get(k) || 0) + converted);
                }
                setData(Array.from(byCat, ([name, value]) => ({ name, value })));
            } catch (error) {
                console.error('Error loading pie chart data:', error);
            }
        })();
    }, [api, year, month, base]);

    const years = Array.from({ length: 6 }, (_, i) => now.getFullYear() - i);

    return (
        <SectionCard
            title="Spending Breakdown"
            subheader="By category"
            icon={<PieChartRoundedIcon sx={{ color: 'primary.main' }} />}
        >
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 2 }}>
                <TextField select label="Year" value={year} onChange={e => setYear(Number(e.target.value))}
                           sx={{ width: { xs: '100%', sm: 140 } }}>
                    {years.map(y => <MenuItem key={y} value={y}>{y}</MenuItem>)}
                </TextField>
                <TextField select label="Month" value={month} onChange={e => setMonth(Number(e.target.value))}
                           sx={{ width: { xs: '100%', sm: 140 } }}>
                    {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <MenuItem key={m} value={m}>{String(m).padStart(2, '0')}</MenuItem>
                    ))}
                </TextField>
                <TextField select label="Base currency" value={base} onChange={e => setBase(e.target.value)}
                           sx={{ width: { xs: '100%', sm: 180 } }}>
                    {CURRENCIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
            </Stack>

            <Box sx={{ width: '100%', height: 320 }}>
                <ResponsiveContainer>
                    <PieChart>
                        <Pie data={data} dataKey="value" nameKey="name" innerRadius={64} outerRadius={110}>
                            {data.map((_, i) => <Cell key={i} />)}
                        </Pie>
                        <Legend wrapperStyle={{ color: 'rgba(255,255,255,0.82)' }} iconType="circle" />
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
                    </PieChart>
                </ResponsiveContainer>
            </Box>
        </SectionCard>
    );
}
