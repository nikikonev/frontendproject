import * as React from 'react';
import { Card, CardContent, CardHeader, Box, Typography } from '@mui/material';

export default function SectionCard({ title, subheader, icon, action, children }) {
    return (
        <Card
            elevation={0}
            sx={{
                /* Lighter, more transparent glass so the layered effect reads clearly */
                backgroundColor: 'rgba(255,255,255,0.035) !important',
                backgroundImage:
                    'linear-gradient(180deg, rgba(255,255,255,0.028), rgba(255,255,255,0.012)) !important',
                backdropFilter: 'blur(20px) saturate(135%)',
                WebkitBackdropFilter: 'blur(20px) saturate(135%)',
                border: '1px solid rgba(255,255,255,0.10)',
                boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                backgroundClip: 'padding-box',
                borderRadius: 2,
                overflow: 'hidden',

                transition: 'transform .18s ease, box-shadow .18s ease, border-color .18s ease',
                '&:hover': {
                    transform: 'translateY(-3px)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.50)',
                    borderColor: 'rgba(255,255,255,0.16)',
                },

                '& .MuiCardHeader-root, & .MuiCardContent-root': {
                    backgroundColor: 'transparent !important',
                },
            }}
        >
            <CardHeader
                title={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
                        {icon && <Box sx={{ display: 'grid', placeItems: 'center' }}>{icon}</Box>}
                        <Typography variant="h6">{title}</Typography>
                    </Box>
                }
                subheader={subheader}
                action={action}
                sx={{
                    pb: 0.5,
                    '& .MuiCardHeader-action': { alignSelf: 'center', m: 0, mr: 1 },
                }}
            />
            <CardContent sx={{ pt: 2 }}>
                <Box sx={{ background: 'transparent' }}>{children}</Box>
            </CardContent>
        </Card>
    );
}
