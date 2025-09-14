import { useRef, useState, useCallback } from 'react';
import {
    Container, AppBar, Toolbar, Typography, Button, Box,
    Fab, Zoom, useScrollTrigger, Tooltip, Paper
} from '@mui/material';
import KeyboardArrowUpRoundedIcon from '@mui/icons-material/KeyboardArrowUpRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';

import AddCostForm from './components/AddCostForm';
import ReportView from './components/ReportView';
import PieChartView from './components/PieChartView';
import BarChartView from './components/BarChartView';
import SettingsDialog from './components/SettingsDialog';

export default function App() {
    const [open, setOpen] = useState(false);
    const [tick, setTick] = useState(0);

    const appBarRef = useRef(null);
    const addRef = useRef(null);
    const reportRef = useRef(null);
    const pieRef = useRef(null);
    const barRef = useRef(null);

    const sections = [
        { ref: addRef, label: 'Add Cost' },
        { ref: reportRef, label: 'Report' },
        { ref: pieRef, label: 'Pie Chart' },
        { ref: barRef, label: 'Bar Chart' },
    ];

    const smoothScrollTo = useCallback((el) => {
        if (!el) return;
        const headerHeight = appBarRef.current ? appBarRef.current.offsetHeight : 0;
        const rect = el.getBoundingClientRect();
        const absoluteTop = window.scrollY + rect.top;
        window.scrollTo({ top: absoluteTop - headerHeight - 12, behavior: 'smooth' });
    }, []);

    const backToTopTrigger = useScrollTrigger({ threshold: 160 });

    return (
        <>
            {/* FROSTED APP BAR */}
            <AppBar ref={appBarRef} position="sticky" color="transparent" elevation={0}>
                <Toolbar sx={{ gap: 1 }}>
                    <Typography variant="h6" sx={{ mr: 2 }}>
                        Cost Manager
                    </Typography>

                    {/* Nav buttons */}
                    <Box sx={{ display: 'flex', gap: 1, flexGrow: 1, flexWrap: 'wrap' }}>
                        {sections.map(({ ref, label }) => (
                            <Button
                                key={label}
                                size="small"
                                color="inherit"
                                onClick={() => smoothScrollTo(ref.current)}
                                sx={{ opacity: 0.9, '&:hover': { opacity: 1 } }}
                            >
                                {label}
                            </Button>
                        ))}
                    </Box>

                    {/* Settings */}
                    <Tooltip title="Settings">
                        <Button
                            color="inherit"
                            onClick={() => setOpen(true)}
                            startIcon={<SettingsRoundedIcon />}
                        >
                            Settings
                        </Button>
                    </Tooltip>
                </Toolbar>
            </AppBar>

            {/* CONTENT */}
            <Box sx={{ py: 4, background: 'transparent' }}>
                <Container maxWidth="lg">
                    <Paper
                        variant="frostedShell"
                        elevation={0}
                        sx={{
                            p: { xs: 2, sm: 3, md: 4 },
                            borderRadius: 3,
                            border: '1px solid rgba(255,255,255,0.18)',
                            // ❌ removed backgroundColor:'transparent' so the shell renders its subtle texture
                        }}
                    >
                        <Box ref={addRef} sx={{ mb: 4 }}>
                            <AddCostForm onAdded={() => setTick((x) => x + 1)} />
                        </Box>

                        <Box ref={reportRef} sx={{ mb: 4 }}>
                            <ReportView key={`report-${tick}`} />
                        </Box>

                        <Box ref={pieRef} sx={{ mb: 4 }}>
                            <PieChartView key={`pie-${tick}`} />
                        </Box>

                        <Box ref={barRef}>
                            <BarChartView key={`bar-${tick}`} />
                        </Box>
                    </Paper>
                </Container>
            </Box>

            {/* FAB back to top */}
            <Zoom in={backToTopTrigger}>
                <Box sx={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1300 }}>
                    <Fab
                        color="primary"
                        size="medium"
                        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    >
                        <KeyboardArrowUpRoundedIcon />
                    </Fab>
                </Box>
            </Zoom>

            {/* Settings dialog */}
            <SettingsDialog
                open={open}
                onClose={() => setOpen(false)}
                onSaved={() => setTick((x) => x + 1)}
            />
        </>
    );
}
