const {
    Box, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, CircularProgress, Chip, Tooltip
} = MaterialUI;

function ExecutionLogs({ refreshKey }) {
    const [logs, setLogs] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [expandedRow, setExpandedRow] = React.useState(null);

    React.useEffect(() => {
        fetch('/api/task-logs')
            .then(res => res.json())
            .then(data => { setLogs(data); setLoading(false); })
            .catch(err => { console.error("Failed to fetch logs:", err); setLoading(false); });
    }, [refreshKey]);

    const getStatusChip = (status) => {
        const colorMap = { 'success': 'success', 'SUCCESS': 'success', 'failure': 'error', 'FAILURE': 'error', 'PENDING': 'warning', 'QUEUED': 'info', 'in_progress': 'warning' };
        return <Chip label={status} color={colorMap[status] || 'default'} size="small" />;
    };

    const formatPayload = (payload) => {
        try { return JSON.stringify(JSON.parse(payload), null, 2); }
        catch { return payload || 'N/A'; }
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">Execution Logs</Typography>
                <Typography variant="caption" color="textSecondary">
                    ⚠️ Model, Tokens, and Cost are simulated — no real LLM is connected yet
                </Typography>
            </Box>
            <TableContainer component={Paper} sx={{ bgcolor: '#2d3047' }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell>Task ID</TableCell>
                            <TableCell>Agent</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell>
                                <Tooltip title="Simulated — no real LLM connected"><span>Model *</span></Tooltip>
                            </TableCell>
                            <TableCell>
                                <Tooltip title="Simulated"><span>Tokens *</span></Tooltip>
                            </TableCell>
                            <TableCell>
                                <Tooltip title="Simulated"><span>Cost *</span></Tooltip>
                            </TableCell>
                            <TableCell>Duration</TableCell>
                            <TableCell>Time</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {logs.map((row) => (
                            <React.Fragment key={row.task_id}>
                                <TableRow hover onClick={() => setExpandedRow(expandedRow === row.task_id ? null : row.task_id)} sx={{ cursor: 'pointer' }}>
                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8em' }}>{row.task_id.substring(0, 12)}...</TableCell>
                                    <TableCell>{row.agent_name}</TableCell>
                                    <TableCell>{getStatusChip(row.status)}</TableCell>
                                    <TableCell sx={{ fontSize: '0.8em', color: '#a0a0a0' }}>{row.primary_model_used || '-'}</TableCell>
                                    <TableCell sx={{ color: '#a0a0a0' }}>{row.token_usage || '-'}</TableCell>
                                    <TableCell sx={{ color: '#a0a0a0' }}>{row.estimated_cost ? `$${row.estimated_cost.toFixed(4)}` : '-'}</TableCell>
                                    <TableCell>{row.duration_ms ? `${row.duration_ms}ms` : '-'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.8em' }}>{new Date(row.start_time).toLocaleTimeString()}</TableCell>
                                </TableRow>
                                {expandedRow === row.task_id && (
                                    <TableRow>
                                        <TableCell colSpan={8} sx={{ bgcolor: '#1e202f', p: 0 }}>
                                            <Box sx={{ p: 2 }}>
                                                <Typography variant="subtitle2" color="primary" gutterBottom>📥 Request</Typography>
                                                <Paper sx={{ p: 1.5, bgcolor: '#27293d', mb: 2 }}>
                                                    <pre style={{ fontSize: '0.85em', color: '#e0e0e0', margin: 0, whiteSpace: 'pre-wrap' }}>{formatPayload(row.request_payload)}</pre>
                                                </Paper>
                                                <Typography variant="subtitle2" color={row.status === 'success' ? 'secondary' : 'error'} gutterBottom>
                                                    {row.status === 'success' ? '📤 Result' : '❌ Error'}
                                                </Typography>
                                                <Paper sx={{ p: 1.5, bgcolor: '#27293d' }}>
                                                    <pre style={{ fontSize: '0.85em', color: '#e0e0e0', margin: 0, whiteSpace: 'pre-wrap' }}>{formatPayload(row.response_payload)}</pre>
                                                </Paper>
                                            </Box>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </React.Fragment>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
