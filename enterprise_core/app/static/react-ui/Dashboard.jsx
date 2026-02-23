const {
    Box, Typography, Grid, Card, CardContent, CircularProgress, Chip, LinearProgress, Avatar
} = MaterialUI;

function Dashboard({ refreshKey }) {
    const [analytics, setAnalytics] = React.useState(null);
    const [agents, setAgents] = React.useState([]);
    const [logs, setLogs] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const volumeCanvasRef = React.useRef(null);
    const statusCanvasRef = React.useRef(null);
    const agentCanvasRef = React.useRef(null);
    const chartRefs = React.useRef({});

    React.useEffect(() => {
        Promise.all([
            fetch('/api/analytics').then(r => r.json()),
            fetch('/api/agents').then(r => r.json()),
            fetch('/api/task-logs').then(r => r.json())
        ]).then(([a, ag, l]) => {
            setAnalytics(a); setAgents(ag); setLogs(l); setLoading(false);
        }).catch(() => setLoading(false));
    }, [refreshKey]);

    // Compute agent stats
    const getAgentStats = () => {
        const stats = {};
        agents.forEach(a => { stats[a.name] = { total: 0, success: 0, failed: 0, totalDuration: 0 }; });
        logs.forEach(l => {
            if (!stats[l.agent_name]) stats[l.agent_name] = { total: 0, success: 0, failed: 0, totalDuration: 0 };
            stats[l.agent_name].total++;
            if (l.status === 'success') stats[l.agent_name].success++;
            else stats[l.agent_name].failed++;
            stats[l.agent_name].totalDuration += (l.duration_ms || 0);
        });
        return Object.entries(stats).map(([name, s]) => ({
            name, ...s, successRate: s.total > 0 ? ((s.success / s.total) * 100) : 0,
            avgDuration: s.total > 0 ? Math.round(s.totalDuration / s.total) : 0
        })).sort((a, b) => b.total - a.total);
    };

    React.useEffect(() => {
        if (!analytics) return;
        // Volume chart
        if (volumeCanvasRef.current) {
            if (chartRefs.current.volume) chartRefs.current.volume.destroy();
            chartRefs.current.volume = new Chart(volumeCanvasRef.current.getContext('2d'), {
                type: 'line', data: {
                    labels: analytics.daily_volume.map(d => d.date),
                    datasets: [{ label: 'Tasks', data: analytics.daily_volume.map(d => d.task_count),
                        borderColor: '#4a90e2', backgroundColor: 'rgba(74,144,226,0.1)', fill: true, tension: 0.4 }]
                }, options: { responsive: true, plugins: { legend: { labels: { color: '#ccc' } } },
                    scales: { x: { ticks: { color: '#888' }, grid: { color: '#2d3047' } }, y: { ticks: { color: '#888' }, grid: { color: '#2d3047' } } } }
            });
        }
        // Status chart
        if (statusCanvasRef.current) {
            if (chartRefs.current.status) chartRefs.current.status.destroy();
            chartRefs.current.status = new Chart(statusCanvasRef.current.getContext('2d'), {
                type: 'doughnut', data: {
                    labels: analytics.status_distribution.map(s => s.status),
                    datasets: [{ data: analytics.status_distribution.map(s => s.count),
                        backgroundColor: ['#2ecc71', '#e74c3c', '#f39c12', '#3498db', '#9b59b6'] }]
                }, options: { responsive: true, plugins: { legend: { position: 'bottom', labels: { color: '#ccc' } } } }
            });
        }
        // Agent performance chart
        if (agentCanvasRef.current && logs.length > 0) {
            const agentStats = getAgentStats();
            if (chartRefs.current.agent) chartRefs.current.agent.destroy();
            chartRefs.current.agent = new Chart(agentCanvasRef.current.getContext('2d'), {
                type: 'bar', data: {
                    labels: agentStats.map(a => a.name.split(' ')[0]),
                    datasets: [
                        { label: 'Success', data: agentStats.map(a => a.success), backgroundColor: '#2ecc71' },
                        { label: 'Failed', data: agentStats.map(a => a.failed), backgroundColor: '#e74c3c' }
                    ]
                }, options: { responsive: true, plugins: { legend: { labels: { color: '#ccc' } } },
                    scales: { x: { stacked: true, ticks: { color: '#888' }, grid: { color: '#2d3047' } },
                        y: { stacked: true, ticks: { color: '#888' }, grid: { color: '#2d3047' } } } }
            });
        }
    }, [analytics, logs]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;
    if (!analytics) return <Typography>Failed to load analytics.</Typography>;

    const agentStats = getAgentStats();
    const activeAgents = agentStats.filter(a => a.total > 0).length;
    const avgResponseTime = logs.length > 0 ? Math.round(logs.filter(l => l.duration_ms > 0).reduce((a, l) => a + l.duration_ms, 0) / Math.max(logs.filter(l => l.duration_ms > 0).length, 1)) : 0;

    const getAgentColor = (name) => {
        const colors = ['#4a90e2', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#3498db'];
        return colors[name.length % colors.length];
    };

    return (
        <Box>
            {/* KPI Row */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                {[
                    { value: analytics.kpis.tasks_today, label: 'Tasks Today', color: '#4a90e2' },
                    { value: `${analytics.kpis.success_rate.toFixed(0)}%`, label: 'Success Rate', color: analytics.kpis.success_rate >= 50 ? '#2ecc71' : '#e74c3c' },
                    { value: `$${analytics.kpis.cost_today.toFixed(2)}`, label: 'Cost Today', color: '#f39c12' },
                    { value: activeAgents, label: 'Active Agents', color: '#9b59b6' },
                    { value: `${avgResponseTime}ms`, label: 'Avg Response', color: '#1abc9c' },
                    { value: agents.length, label: 'Total Agents', color: '#3498db' },
                ].map((kpi, i) => (
                    <Grid item xs={2} key={i}>
                        <Card sx={{ textAlign: 'center', borderTop: `3px solid ${kpi.color}` }}>
                            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Typography variant="h4" sx={{ fontWeight: 700, color: kpi.color }}>{kpi.value}</Typography>
                                <Typography variant="caption" color="textSecondary">{kpi.label}</Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>

            {/* Charts Row */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={5}><Card><CardContent><Typography variant="subtitle2" gutterBottom>Task Volume</Typography><canvas ref={volumeCanvasRef}></canvas></CardContent></Card></Grid>
                <Grid item xs={3}><Card><CardContent><Typography variant="subtitle2" gutterBottom>Status Distribution</Typography><canvas ref={statusCanvasRef}></canvas></CardContent></Card></Grid>
                <Grid item xs={4}><Card><CardContent><Typography variant="subtitle2" gutterBottom>Agent Performance</Typography><canvas ref={agentCanvasRef}></canvas></CardContent></Card></Grid>
            </Grid>

            {/* Agent Accomplishment Cards */}
            <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>Agent Accomplishments</Typography>
            <Grid container spacing={2}>
                {agentStats.map(agent => (
                    <Grid item xs={4} key={agent.name}>
                        <Card sx={{ borderLeft: `4px solid ${getAgentColor(agent.name)}` }}>
                            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{agent.name}</Typography>
                                    <Chip label={`${agent.total} tasks`} size="small" sx={{ height: 22, fontSize: '0.7em' }} />
                                </Box>
                                <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                                    <Typography variant="caption" sx={{ color: '#2ecc71' }}>✓ {agent.success}</Typography>
                                    <Typography variant="caption" sx={{ color: '#e74c3c' }}>✗ {agent.failed}</Typography>
                                    <Typography variant="caption" color="textSecondary">⏱ {agent.avgDuration}ms</Typography>
                                </Box>
                                <LinearProgress variant="determinate" value={agent.successRate}
                                    sx={{ height: 6, borderRadius: 3, bgcolor: '#2d3047',
                                        '& .MuiLinearProgress-bar': { bgcolor: agent.successRate >= 70 ? '#2ecc71' : agent.successRate >= 40 ? '#f39c12' : '#e74c3c' } }} />
                                <Typography variant="caption" color="textSecondary" sx={{ mt: 0.5, display: 'block' }}>
                                    {agent.successRate.toFixed(0)}% success rate
                                </Typography>
                            </CardContent>
                        </Card>
                    </Grid>
                ))}
            </Grid>
        </Box>
    );
}
