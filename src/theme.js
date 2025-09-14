import { createTheme } from '@mui/material/styles';

const surface = '#0e1012';   // dark page background

const theme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#00bfa5' },
        secondary: { main: '#26c6da' },
        background: { default: surface, paper: surface },
        text: { primary: '#ffffff', secondary: 'rgba(255,255,255,0.72)' },
        divider: 'rgba(255,255,255,0.10)',
    },
    shape: { borderRadius: 16 },
    typography: {
        fontFamily: 'Inter, Roboto, Segoe UI, Arial, sans-serif',
        h6: { fontWeight: 700, letterSpacing: 0.2 },
        button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
        MuiAppBar: {
            styleOverrides: {
                colorTransparent: {
                    backdropFilter: 'blur(12px) saturate(120%)',
                    WebkitBackdropFilter: 'blur(12px) saturate(120%)',
                    backgroundColor: 'rgba(20,20,20,0.55)',
                    borderBottom: '1px solid rgba(255,255,255,0.12)',
                },
            },
        },
        MuiPaper: {
            variants: [
                // Inner medium-glass
                {
                    props: { variant: 'frosted' },
                    style: {
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        backgroundImage:
                            'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                        backdropFilter: 'blur(14px) saturate(120%)',
                        WebkitBackdropFilter: 'blur(14px) saturate(120%)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                        backgroundClip: 'padding-box',
                    },
                },
                // OUTER shell (no backdrop blur!) — slightly lighter with texture so inner cards have something to blur
                {
                    props: { variant: 'frostedShell' },
                    style: {
                        backgroundColor: 'rgba(10,12,14,0.38)',
                        backgroundImage: `
              radial-gradient(800px 500px at 12% 10%, rgba(0,191,165,0.08), transparent 60%),
              radial-gradient(700px 450px at 85% 30%, rgba(38,198,218,0.06), transparent 60%),
              linear-gradient(180deg, rgba(255,255,255,0.012), rgba(255,255,255,0.008))
            `,
                        // 👇 remove backdropFilter so children blur the page/texture, not another blur
                        border: '1px solid rgba(255,255,255,0.20)',
                        boxShadow: '0 12px 40px rgba(0,0,0,0.55)',
                        backgroundClip: 'padding-box',
                    },
                },
            ],
        },
        MuiCard: {
            variants: [
                {
                    props: { variant: 'frosted' },
                    style: {
                        backgroundColor: 'rgba(255,255,255,0.06)',
                        backgroundImage:
                            'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                        backdropFilter: 'blur(14px) saturate(120%)',
                        WebkitBackdropFilter: 'blur(14px) saturate(120%)',
                        border: '1px solid rgba(255,255,255,0.18)',
                        transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                        boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                        backgroundClip: 'padding-box',
                    },
                },
            ],
            styleOverrides: {
                root: {
                    '&:hover': {
                        transform: 'translateY(-3px)',
                        boxShadow: '0 16px 44px rgba(0,0,0,0.55)',
                        borderColor: 'rgba(255,255,255,0.24)',
                    },
                },
            },
        },
    },
});

export default theme;
