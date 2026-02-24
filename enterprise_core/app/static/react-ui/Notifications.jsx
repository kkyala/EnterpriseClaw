const { Box, Typography, Chip, Divider, Button } = MaterialUI;

function Notifications({ notifications, onClear, isDark }) {
    const [filter, setFilter]       = React.useState('all');
    const [dismissed, setDismissed] = React.useState(new Set());

    const bg          = isDark ? '#1e2030' : '#ffffff';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const labelColor  = isDark ? '#6c7293' : '#64748b';
    const textColor   = isDark ? '#c8cce8' : '#1e293b';

    const SEV_META = {
        success: { icon: '✅', color: '#2ecc71', label: 'Success' },
        error:   { icon: '❌', color: '#e74c3c', label: 'Error'   },
        warning: { icon: '⚠️', color: '#f39c12', label: 'Warning' },
        info:    { icon: 'ℹ️', color: '#4a90e2', label: 'Info'    },
    };

    const dismiss = n => setDismissed(prev => new Set([...prev, n.time + n.message]));

    const visible  = notifications.filter(n => !dismissed.has(n.time + n.message));
    const filtered = filter === 'all' ? visible : visible.filter(n => n.severity === filter);

    const counts = { all: visible.length };
    Object.keys(SEV_META).forEach(sev => { counts[sev] = visible.filter(n => n.severity === sev).length; });

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1em', color: textColor }}>
                        Alerts &amp; Notifications
                    </Typography>
                    <Box sx={{
                        px: 1.2, py: 0.2, borderRadius: 1, bgcolor: visible.length > 0 ? '#e74c3c' : (isDark ? '#1e2030' : '#e2e8f0'),
                        fontSize: '0.72em', fontWeight: 700, color: visible.length > 0 ? '#fff' : labelColor
                    }}>
                        {visible.length} unread
                    </Box>
                </Box>
                <Button size="small" variant="outlined" onClick={onClear}
                    sx={{ fontSize: '0.72em', height: 28 }}>
                    Clear All
                </Button>
            </Box>

            {/* Severity filter pills */}
            <Box sx={{ display: 'flex', gap: 0.8, mb: 2, flexWrap: 'wrap' }}>
                {/* All pill */}
                <Box onClick={() => setFilter('all')}
                    sx={{
                        px: 1.5, py: 0.5, borderRadius: 1, cursor: 'pointer',
                        fontSize: '0.76em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.6,
                        bgcolor: filter === 'all' ? '#4a90e2' : (isDark ? '#1e2030' : '#e2e8f0'),
                        color: filter === 'all' ? '#fff' : labelColor,
                        border: `1px solid ${filter === 'all' ? 'transparent' : borderColor}`,
                        transition: 'all 0.15s',
                    }}>
                    🔔 All
                    <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '0 5px', fontSize: '0.88em' }}>
                        {counts.all}
                    </span>
                </Box>

                {Object.entries(SEV_META).map(([sev, meta]) => (
                    <Box key={sev} onClick={() => setFilter(sev)}
                        sx={{
                            px: 1.5, py: 0.5, borderRadius: 1, cursor: 'pointer',
                            fontSize: '0.76em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.6,
                            bgcolor: filter === sev ? meta.color : (isDark ? '#1e2030' : '#e2e8f0'),
                            color: filter === sev ? '#fff' : labelColor,
                            border: `1px solid ${filter === sev ? 'transparent' : borderColor}`,
                            transition: 'all 0.15s',
                        }}>
                        {meta.icon} {meta.label}
                        {counts[sev] > 0 && (
                            <span style={{ background: 'rgba(255,255,255,0.22)', borderRadius: 4, padding: '0 5px', fontSize: '0.88em' }}>
                                {counts[sev]}
                            </span>
                        )}
                    </Box>
                ))}
            </Box>

            {/* Notification list */}
            {filtered.length === 0 ? (
                <Box sx={{ p: 5, textAlign: 'center', border: `1px solid ${borderColor}`, borderRadius: 1.5 }}>
                    <Typography sx={{ fontSize: '2.5em', mb: 1 }}>🔔</Typography>
                    <Typography sx={{ color: labelColor }}>
                        {visible.length === 0
                            ? 'No alerts yet. Submit a task to see results here.'
                            : `No ${filter} alerts.`}
                    </Typography>
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.8 }}>
                    {filtered.map((n, i) => {
                        const meta = SEV_META[n.severity] || { icon: '📌', color: '#6c7293', label: 'Alert' };
                        return (
                            <Box key={i} sx={{
                                display: 'flex', gap: 1.5, alignItems: 'flex-start',
                                p: 1.5, bgcolor: bg,
                                border: `1px solid ${borderColor}`,
                                borderLeft: `4px solid ${meta.color}`,
                                borderRadius: '0 8px 8px 0',
                                transition: 'opacity 0.2s',
                            }}>
                                <Typography sx={{ fontSize: '1.25em', mt: 0.1, flexShrink: 0 }}>
                                    {meta.icon}
                                </Typography>
                                <Box sx={{ flexGrow: 1 }}>
                                    <Typography sx={{ fontSize: '0.86em', color: textColor, lineHeight: 1.4 }}>
                                        {n.message}
                                    </Typography>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.4 }}>
                                        <Chip label={meta.label} size="small"
                                            sx={{ bgcolor: `${meta.color}22`, color: meta.color, border: `1px solid ${meta.color}44`, fontSize: '0.62em', height: 18 }} />
                                        <Typography sx={{ fontSize: '0.68em', color: labelColor }}>
                                            {n.time}
                                        </Typography>
                                    </Box>
                                </Box>
                                <Box onClick={() => dismiss(n)}
                                    sx={{ cursor: 'pointer', color: labelColor, '&:hover': { color: '#e74c3c' }, px: 0.5, fontSize: '0.9em', flexShrink: 0, mt: 0.2 }}>
                                    ✕
                                </Box>
                            </Box>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}
