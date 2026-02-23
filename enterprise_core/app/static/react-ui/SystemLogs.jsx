const {
    Box, Typography, Paper, Chip
} = MaterialUI;

function SystemLogs({ events }) {
    const getEventColor = (type) => {
        const map = {
            'TASK_QUEUED': 'info', 'TASK_STARTED': 'warning', 'TOOL_EXECUTED': 'secondary',
            'TASK_COMPLETED': 'success', 'TASK_FAILED': 'error'
        };
        return map[type] || 'default';
    };

    return (
        <Box>
            <Typography variant="h6" gutterBottom>Real-Time System Events</Typography>
            <Typography variant="caption" color="textSecondary" gutterBottom component="div" sx={{ mb: 2 }}>
                Live event stream via WebSocket — {events.length} events captured
            </Typography>

            {events.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="textSecondary">No events yet. Submit a task to see real-time events.</Typography>
                </Paper>
            ) : (
                <Paper sx={{ bgcolor: '#1e202f', p: 1, maxHeight: '70vh', overflowY: 'auto' }}>
                    {events.map((event, i) => (
                        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', p: 1, borderBottom: '1px solid #2d3047', fontFamily: 'monospace', fontSize: '0.85em' }}>
                            <Chip label={event.event_type || 'EVENT'} color={getEventColor(event.event_type)} size="small" sx={{ minWidth: 130 }} />
                            <Typography variant="caption" color="textSecondary" sx={{ minWidth: 80 }}>
                                {event.timestamp ? new Date(event.timestamp * 1000).toLocaleTimeString() : ''}
                            </Typography>
                            <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.85em', color: '#a0a0a0', wordBreak: 'break-all' }}>
                                {event.task_id ? `task:${event.task_id.substring(0, 8)}` : ''}
                                {event.tool_name ? ` tool:${event.tool_name}` : ''}
                                {event.persona_name ? ` agent:${event.persona_name}` : ''}
                                {event.error ? ` error:${event.error}` : ''}
                                {event.status ? ` status:${event.status}` : ''}
                            </Typography>
                        </Box>
                    ))}
                </Paper>
            )}
        </Box>
    );
}
