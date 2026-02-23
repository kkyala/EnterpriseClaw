const {
    Box, Typography, Paper, Chip, IconButton, Divider, Button
} = MaterialUI;

function Notifications({ notifications, onClear }) {
    if (notifications.length === 0) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography color="textSecondary">No notifications yet. Submit a task to see results here.</Typography>
            </Box>
        );
    }

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Notifications ({notifications.length})</Typography>
                <Button size="small" variant="outlined" onClick={onClear}>Clear All</Button>
            </Box>

            <Paper sx={{ bgcolor: '#2d3047' }}>
                {notifications.map((n, i) => (
                    <React.Fragment key={i}>
                        <Box sx={{ p: 2, display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                            <Box sx={{ mt: 0.5 }}>
                                {n.severity === 'success' && <Chip label="✅" size="small" color="success" sx={{ minWidth: 40 }} />}
                                {n.severity === 'error' && <Chip label="❌" size="small" color="error" sx={{ minWidth: 40 }} />}
                                {n.severity === 'info' && <Chip label="ℹ️" size="small" color="info" sx={{ minWidth: 40 }} />}
                                {n.severity === 'warning' && <Chip label="⚠️" size="small" color="warning" sx={{ minWidth: 40 }} />}
                            </Box>
                            <Box sx={{ flexGrow: 1 }}>
                                <Typography variant="body2">{n.message}</Typography>
                                <Typography variant="caption" color="textSecondary">{n.time}</Typography>
                            </Box>
                        </Box>
                        {i < notifications.length - 1 && <Divider sx={{ borderColor: '#43455c' }} />}
                    </React.Fragment>
                ))}
            </Paper>
        </Box>
    );
}
