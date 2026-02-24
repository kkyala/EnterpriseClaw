const { Box, Typography, Card, CardContent, TextField, Button, Grid, Switch, FormControlLabel } = MaterialUI;

function Integrations({ isDark }) {
    const textColor = isDark ? '#c8cce8' : '#1e293b';
    const labelColor = isDark ? '#6c7293' : '#64748b';
    const cardBg = isDark ? '#252840' : '#f8fafc';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';

    const integrations = [
        {
            title: 'Email (SMTP)', icon: '📧',
            desc: 'Configure SMTP for agents to send and receive emails.',
            fields: ['SMTP Host', 'Port', 'Username', 'Password']
        },
        {
            title: 'PDF Generator', icon: '📄',
            desc: 'Configure PDF rendering service, templates, and output directory.',
            fields: ['Service URL', 'API Key', 'Output Path']
        },
        {
            title: 'External API Webhooks', icon: '🔌',
            desc: 'Provide credentials for third-party endpoints used by Skills and Tools.',
            fields: ['Webhook URL', 'Auth Token', 'Timeout (ms)']
        },
        {
            title: 'Slack / Discord', icon: '💬',
            desc: 'Connect your agent comms to external chat apps via Webhooks.',
            fields: ['Channel Webhook URL', 'Bot Token']
        }
    ];

    return (
        <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ mb: 3, flexShrink: 0 }}>
                <Typography sx={{ fontWeight: 800, fontSize: '1.3em', color: textColor, display: 'flex', alignItems: 'center', gap: 1 }}>
                    🔌 System Integrations
                </Typography>
                <Typography sx={{ fontSize: '0.78em', color: labelColor }}>
                    Configure external services, APIs, and tool connections for your agents.
                </Typography>
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                <Grid container spacing={2}>
                    {integrations.map((ing, i) => (
                        <Grid item xs={12} md={6} xl={4} key={i}>
                            <Card sx={{
                                bgcolor: cardBg, border: `1px solid ${borderColor}`, borderRadius: 2,
                                transition: 'all 0.15s', '&:hover': { borderColor: '#4a90e2' }
                            }}>
                                <CardContent sx={{ p: '20px !important' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                                        <Box sx={{
                                            width: 40, height: 40, borderRadius: '50%', bgcolor: 'rgba(74, 144, 226, 0.1)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2em'
                                        }}>
                                            {ing.icon}
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: '1em', color: textColor }}>
                                                {ing.title}
                                            </Typography>
                                            <FormControlLabel
                                                control={<Switch size="small" defaultChecked={i === 0} />}
                                                label={<Typography sx={{ fontSize: '0.7em', color: labelColor }}>Enabled</Typography>}
                                            />
                                        </Box>
                                    </Box>
                                    <Typography sx={{ fontSize: '0.8em', color: labelColor, mb: 3, minHeight: 40 }}>
                                        {ing.desc}
                                    </Typography>

                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                        {ing.fields.map((field, j) => (
                                            <TextField
                                                key={j}
                                                label={field}
                                                size="small"
                                                fullWidth
                                                type={field.toLowerCase().includes('password') || field.toLowerCase().includes('token') ? 'password' : 'text'}
                                                InputLabelProps={{ style: { fontSize: '0.85em' } }}
                                                InputProps={{ style: { fontSize: '0.85em' } }}
                                            />
                                        ))}
                                    </Box>

                                    <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                                        <Button size="small" variant="outlined" sx={{ textTransform: 'none', fontWeight: 600, fontSize: '0.75em' }}>Test Connection</Button>
                                        <Button size="small" variant="contained" sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75em', background: 'linear-gradient(135deg, #4a90e2, #9b59b6)' }}>Save Config</Button>
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}
                </Grid>
            </Box>
        </Box>
    );
}
