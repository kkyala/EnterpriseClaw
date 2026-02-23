const {
    Box, Typography, Paper, CircularProgress, Chip, Card, CardContent, Grid, Divider
} = MaterialUI;

function SimpleView({ selectedAgent }) {
    const [taskHistory, setTaskHistory] = React.useState([]);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        fetch('/api/task-logs').then(r => r.json()).then(d => { setTaskHistory(d); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    const formatResponse = (payload) => {
        try { const d = JSON.parse(payload); return d.error ? { type: 'error', content: d } : { type: 'success', content: d }; }
        catch { return { type: 'raw', content: payload || 'No response' }; }
    };

    const formatRequest = (payload) => {
        try { return JSON.parse(payload); } catch { return { task: payload }; }
    };

    const renderKV = (data) => (
        <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
                {Object.entries(data).map(([key, value]) => (
                    <Box component="tr" key={key}>
                        <Box component="td" sx={{ py: 0.5, pr: 2, verticalAlign: 'top', width: 160 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#a0c4ff', textTransform: 'uppercase', fontSize: '0.78em' }}>{key.replace(/_/g, ' ')}</Typography>
                        </Box>
                        <Box component="td" sx={{ py: 0.5 }}>
                            <Typography variant="body2">{typeof value === 'object' ? JSON.stringify(value) : String(value)}</Typography>
                        </Box>
                    </Box>
                ))}
            </tbody>
        </Box>
    );

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

    const filteredTasks = selectedAgent ? taskHistory.filter(t => t.agent_name === selectedAgent) : taskHistory;
    const successTasks = filteredTasks.filter(t => t.status === 'success');
    const failedTasks = filteredTasks.filter(t => t.status !== 'success');

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>Task Results</Typography>
                {selectedAgent && <Chip label={`Filtered: ${selectedAgent}`} color="primary" size="small" onDelete={() => {}} />}
            </Box>
            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                <Typography variant="body2" color="textSecondary">{filteredTasks.length} total</Typography>
                <Typography variant="body2" sx={{ color: '#2ecc71' }}>✓ {successTasks.length} success</Typography>
                <Typography variant="body2" sx={{ color: '#e74c3c' }}>✗ {failedTasks.length} failed</Typography>
            </Box>

            {filteredTasks.length === 0 ? (
                <Paper sx={{ p: 5, textAlign: 'center' }}>
                    <Typography variant="h6" color="textSecondary">No tasks found</Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>Submit a task using the sidebar to see results here.</Typography>
                </Paper>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                    {filteredTasks.map((task) => {
                        const request = formatRequest(task.request_payload);
                        const response = formatResponse(task.response_payload);
                        const isSuccess = task.status === 'success';
                        return (
                            <Card key={task.task_id} sx={{
                                borderRadius: 2,
                                borderLeft: `4px solid ${isSuccess ? '#2ecc71' : '#e74c3c'}`,
                                transition: 'transform 0.15s, box-shadow 0.15s',
                                '&:hover': { transform: 'translateY(-1px)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }
                            }}>
                                {/* Card Header */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2.5, pt: 2, pb: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        <Chip label={task.agent_name} size="small" sx={{ bgcolor: '#4a90e2', color: '#fff', fontWeight: 600, fontSize: '0.8em' }} />
                                        <Chip label={task.status.toUpperCase()} size="small" color={isSuccess ? 'success' : 'error'} sx={{ fontWeight: 600, fontSize: '0.75em' }} />
                                        {task.primary_model_used && <Typography variant="caption" color="textSecondary" sx={{ fontStyle: 'italic' }}>{task.primary_model_used}</Typography>}
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                        {task.duration_ms > 0 && <Chip label={`${task.duration_ms}ms`} size="small" variant="outlined" sx={{ height: 24 }} />}
                                        <Typography variant="caption" color="textSecondary">{new Date(task.start_time).toLocaleString()}</Typography>
                                    </Box>
                                </Box>

                                <CardContent sx={{ px: 2.5, pt: 1, pb: 2, '&:last-child': { pb: 2 } }}>
                                    {/* User Task */}
                                    <Box sx={{ mb: 2 }}>
                                        <Typography variant="overline" sx={{ color: '#4a90e2', fontWeight: 700, letterSpacing: 1.2 }}>USER TASK</Typography>
                                        <Typography variant="body1" sx={{ mt: 0.5, fontWeight: 500, fontSize: '1.05em' }}>{request.task || 'N/A'}</Typography>
                                    </Box>

                                    <Divider sx={{ mb: 2 }} />

                                    {/* Agent Response */}
                                    <Box>
                                        <Typography variant="overline" sx={{ color: isSuccess ? '#2ecc71' : '#e74c3c', fontWeight: 700, letterSpacing: 1.2 }}>
                                            {isSuccess ? 'AGENT RESPONSE' : 'ERROR DETAILS'}
                                        </Typography>
                                        <Box sx={{ mt: 1, p: 2, borderRadius: 1.5, bgcolor: isSuccess ? 'rgba(46,204,113,0.08)' : 'rgba(231,76,60,0.08)', border: `1px solid ${isSuccess ? 'rgba(46,204,113,0.2)' : 'rgba(231,76,60,0.2)'}` }}>
                                            {response.type === 'raw' ? (
                                                <Typography variant="body2">{response.content}</Typography>
                                            ) : (
                                                renderKV(response.content)
                                            )}
                                        </Box>
                                    </Box>

                                    {/* Footer */}
                                    <Typography variant="caption" color="textSecondary" sx={{ mt: 1.5, display: 'block', fontFamily: 'monospace', fontSize: '0.7em', opacity: 0.6 }}>
                                        {task.task_id}
                                    </Typography>
                                </CardContent>
                            </Card>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}
