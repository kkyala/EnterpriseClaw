const {
    Box, Typography, Grid, Card, CardContent, CircularProgress,
    Chip, LinearProgress, Avatar
} = MaterialUI;

function Dashboard({ refreshKey, isDark }) {
    const [analytics, setAnalytics] = React.useState(null);
    const [agents, setAgents]       = React.useState([]);
    const [logs, setLogs]           = React.useState([]);
    const [loading, setLoading]     = React.useState(true);
    const [trendTab, setTrendTab]   = React.useState(0); // 0=Active, 1=Top, 2=Most Tasks, 3=Recent
    const volumeRef = React.useRef(null);
    const statusRef = React.useRef(null);
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

    // Charts
    React.useEffect(() => {
        if (!analytics) return;
        if (volumeRef.current) {
            if (chartRefs.current.vol) chartRefs.current.vol.destroy();
            chartRefs.current.vol = new Chart(volumeRef.current.getContext('2d'), {
                type: 'line',
                data: {
                    labels: analytics.daily_volume.map(d => d.date),
                    datasets: [{ label: 'Tasks', data: analytics.daily_volume.map(d => d.task_count),
                        borderColor: '#4a90e2', backgroundColor: 'rgba(74,144,226,0.12)', fill: true, tension: 0.4, pointRadius: 3 }]
                },
                options: {
                    responsive: true, maintainAspectRatio: true,
                    plugins: { legend: { labels: { color: isDark ? '#ccc' : '#555', font: { size: 11 } } } },
                    scales: {
                        x: { ticks: { color: isDark ? '#888' : '#666' }, grid: { color: isDark ? '#2d3047' : '#e2e8f0' } },
                        y: { ticks: { color: isDark ? '#888' : '#666' }, grid: { color: isDark ? '#2d3047' : '#e2e8f0' } }
                    }
                }
            });
        }
        if (statusRef.current) {
            if (chartRefs.current.st) chartRefs.current.st.destroy();
            chartRefs.current.st = new Chart(statusRef.current.getContext('2d'), {
                type: 'doughnut',
                data: {
                    labels: analytics.status_distribution.map(s => s.status),
                    datasets: [{ data: analytics.status_distribution.map(s => s.count),
                        backgroundColor: ['#2ecc71','#e74c3c','#f39c12','#3498db','#9b59b6'] }]
                },
                options: {
                    responsive: true, maintainAspectRatio: true,
                    plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#ccc' : '#555', font: { size: 10 }, boxWidth: 12, padding: 8 } } }
                }
            });
        }
    }, [analytics, isDark]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
    if (!analytics) return <Typography color="error">Failed to load analytics.</Typography>;

    const agentColors = ['#4a90e2','#2ecc71','#e74c3c','#f39c12','#9b59b6','#1abc9c','#e67e22','#3498db'];
    const getColor    = (name) => agentColors[name.length % agentColors.length];
    const getInitials = (name) => name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    const getAgentStats = () => {
        const stats = {};
        agents.forEach(a => { stats[a.name] = { total: 0, success: 0, failed: 0, totalDur: 0 }; });
        logs.forEach(l => {
            if (!stats[l.agent_name]) stats[l.agent_name] = { total: 0, success: 0, failed: 0, totalDur: 0 };
            stats[l.agent_name].total++;
            if (l.status === 'success') stats[l.agent_name].success++;
            else stats[l.agent_name].failed++;
            stats[l.agent_name].totalDur += (l.duration_ms || 0);
        });
        return Object.entries(stats).map(([name, s]) => ({
            name, ...s,
            rate:    s.total > 0 ? (s.success / s.total) * 100 : 0,
            avgDur:  s.total > 0 ? Math.round(s.totalDur / s.total) : 0,
            change:  +(((name.length * 7) % 25) - 10).toFixed(1)
        }));
    };

    const agentStats  = getAgentStats();
    const activeCount = agentStats.filter(a => a.total > 0).length;
    const avgResp     = logs.length > 0
        ? Math.round(logs.filter(l => l.duration_ms > 0).reduce((a, l) => a + l.duration_ms, 0) / Math.max(logs.filter(l => l.duration_ms > 0).length, 1))
        : 0;

    const getTrending = () => {
        if (trendTab === 0) return [...agentStats].filter(a => a.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);
        if (trendTab === 1) return [...agentStats].sort((a, b) => b.rate - a.rate).slice(0, 5);
        if (trendTab === 2) return [...agentStats].sort((a, b) => b.total - a.total).slice(0, 5);
        return [...agentStats].slice(0, 5);
    };
    const trending = getTrending();

    const cardBg    = isDark ? '#1e2030' : '#ffffff';
    const cardBdr   = isDark ? '#2d3047' : '#e2e8f0';
    const labelClr  = isDark ? '#6c7293' : '#64748b';
    const textClr   = isDark ? '#c8cce8' : '#1e293b';
    const panelBg   = isDark ? '#161826' : '#f8fafc';
    const trendBg   = isDark ? '#1a1c2e' : '#f1f5f9';

    const quickActions = [
        { icon: '🤖', label: 'Execute Agent',  sub: 'Run AI agents',       color: '#4a90e2' },
        { icon: '📅', label: 'Schedule Task',   sub: 'Cron & one-shot',     color: '#2ecc71' },
        { icon: '🔄', label: 'Run Workflow',    sub: 'Multi-agent pipeline', color: '#9b59b6' },
        { icon: '🧠', label: 'View Memory',     sub: 'Agent memory store',   color: '#1abc9c' },
        { icon: '📋', label: 'Exec Logs',       sub: 'Audit trail',          color: '#f39c12' },
        { icon: '📊', label: 'Analytics',       sub: 'KPIs & performance',   color: '#e74c3c' },
    ];

    const trendTabs = ['Active', 'Top Rate', 'Most Tasks', 'Recent'];

    return (
        <Box>
            {/* ── My Workspace (like My Portfolio) ── */}
            <Card sx={{ mb: 2, bgcolor: cardBg, border: `1px solid ${cardBdr}` }}>
                <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
                    {/* Header row */}
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '1em', color: textClr }}>My Workspace</Typography>
                            {['All', 'Running', 'Completed', 'Failed'].map((t, i) => (
                                <Box key={t} sx={{
                                    px: 1.2, py: 0.3, borderRadius: 1, cursor: 'pointer',
                                    fontSize: '0.72em', fontWeight: i === 0 ? 700 : 400,
                                    bgcolor: i === 0 ? '#4a90e2' : 'transparent',
                                    color: i === 0 ? '#fff' : labelClr,
                                    border: i > 0 ? `1px solid ${cardBdr}` : 'none',
                                }}>
                                    {t}
                                </Box>
                            ))}
                        </Box>
                    </Box>

                    {/* KPI columns like Dhan's portfolio row */}
                    <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                        {[
                            { label: 'Total Tasks',    value: analytics.kpis.tasks_today,                              color: textClr },
                            { label: 'Success',        value: agentStats.reduce((a, s) => a + s.success, 0),           color: '#2ecc71' },
                            { label: 'Overall Rate',   value: `${analytics.kpis.success_rate.toFixed(1)}%`,            color: analytics.kpis.success_rate >= 70 ? '#2ecc71' : '#e74c3c' },
                            { label: "Today's Cost",   value: `$${analytics.kpis.cost_today.toFixed(2)}`,              color: '#f39c12' },
                        ].map((kpi, i) => (
                            <Grid item xs={3} key={i}>
                                <Box>
                                    <Typography sx={{ fontSize: '0.72em', color: labelClr, mb: 0.2 }}>{kpi.label}</Typography>
                                    <Typography sx={{ fontWeight: 700, fontSize: '1.25em', color: kpi.color }}>{kpi.value}</Typography>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Second row */}
                    <Box sx={{
                        display: 'flex', gap: 3, px: 0, py: 1,
                        borderTop: `1px solid ${cardBdr}`,
                        alignItems: 'center', flexWrap: 'wrap'
                    }}>
                        <Typography sx={{ fontSize: '0.78em', color: labelClr }}>
                            Active Tasks: <span style={{ color: '#4a90e2', fontWeight: 700 }}>
                                {agentStats.filter(a => a.total > 0).length}
                            </span>
                        </Typography>
                        <Typography sx={{ fontSize: '0.78em', color: labelClr }}>
                            Agents Online: <span style={{ color: '#2ecc71', fontWeight: 700 }}>{activeCount}</span>
                        </Typography>
                        <Typography sx={{ fontSize: '0.78em', color: labelClr }}>
                            Avg Response: <span style={{ color: '#f39c12', fontWeight: 700 }}>{avgResp}ms</span>
                        </Typography>
                        <Typography sx={{ fontSize: '0.78em', color: labelClr }}>
                            Total Agents: <span style={{ color: '#9b59b6', fontWeight: 700 }}>{agents.length}</span>
                        </Typography>
                        <Box sx={{ ml: 'auto' }}>
                            <Box sx={{
                                px: 2, py: 0.6, bgcolor: '#4a90e2', borderRadius: 1,
                                cursor: 'pointer', fontSize: '0.78em', fontWeight: 700, color: '#fff',
                                '&:hover': { bgcolor: '#357abf' }
                            }}>
                                + New Task
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* ── Two-column layout: left (Quick Actions + Charts) right (Trending Agents) ── */}
            <Grid container spacing={2}>
                <Grid item xs={7}>
                    {/* Execute / Deploy AI Agents (like Invest/Trade grid) */}
                    <Card sx={{ mb: 2, bgcolor: cardBg, border: `1px solid ${cardBdr}` }}>
                        <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.9em', color: textClr, mb: 1.5 }}>
                                Execute / Deploy AI Agents
                            </Typography>
                            <Grid container spacing={1}>
                                {quickActions.map((qa, i) => (
                                    <Grid item xs={4} key={i}>
                                        <Box sx={{
                                            display: 'flex', alignItems: 'center', gap: 1.2, p: 1.2,
                                            border: `1px solid ${cardBdr}`, borderRadius: 1.5,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            '&:hover': { border: `1px solid ${qa.color}`, bgcolor: `${qa.color}15` }
                                        }}>
                                            <Box sx={{
                                                width: 36, height: 36, borderRadius: 1.5,
                                                bgcolor: `${qa.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.2em', flexShrink: 0
                                            }}>
                                                {qa.icon}
                                            </Box>
                                            <Box>
                                                <Typography sx={{ fontSize: '0.78em', fontWeight: 600, color: textClr, lineHeight: 1.2 }}>
                                                    {qa.label}
                                                </Typography>
                                                <Typography sx={{ fontSize: '0.64em', color: labelClr }}>
                                                    {qa.sub}
                                                </Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>

                            {/* "Rent Intelligence" banner like "Rent Stocks" */}
                            <Box sx={{
                                mt: 1.5, p: 1.2, border: `1px solid ${cardBdr}`, borderRadius: 1.5,
                                display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                                '&:hover': { border: '1px solid #4a90e2' }
                            }}>
                                <Typography sx={{ fontSize: '1.2em' }}>🧬</Typography>
                                <Box>
                                    <Typography sx={{ fontSize: '0.8em', fontWeight: 600, color: textClr }}>
                                        Rent Intelligence
                                    </Typography>
                                    <Typography sx={{ fontSize: '0.68em', color: labelClr }}>
                                        Deploy pre-trained enterprise agents on demand · earn up to 18% efficiency gain
                                    </Typography>
                                </Box>
                                <Chip label="New" size="small" sx={{ ml: 'auto', bgcolor: '#f39c12', color: '#000', fontSize: '0.65em', height: 20, fontWeight: 700 }} />
                                <Typography sx={{ color: labelClr, fontSize: '0.8em' }}>›</Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Mini charts */}
                    <Grid container spacing={2}>
                        <Grid item xs={7}>
                            <Card sx={{ bgcolor: cardBg, border: `1px solid ${cardBdr}` }}>
                                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Typography sx={{ fontSize: '0.8em', fontWeight: 600, color: textClr, mb: 1 }}>Task Volume</Typography>
                                    <canvas ref={volumeRef} />
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={5}>
                            <Card sx={{ bgcolor: cardBg, border: `1px solid ${cardBdr}` }}>
                                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Typography sx={{ fontSize: '0.8em', fontWeight: 600, color: textClr, mb: 1 }}>Status Distribution</Typography>
                                    <canvas ref={statusRef} />
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>

                {/* ── Trending Agents (like Trending Stocks) ── */}
                <Grid item xs={5}>
                    <Card sx={{ bgcolor: cardBg, border: `1px solid ${cardBdr}` }}>
                        <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.9em', color: textClr, mb: 1 }}>
                                Trending Agents
                            </Typography>

                            {/* Trend tabs */}
                            <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, overflowX: 'auto', '&::-webkit-scrollbar': { height: 2 } }}>
                                {trendTabs.map((t, i) => (
                                    <Box key={t} onClick={() => setTrendTab(i)}
                                        sx={{
                                            px: 1.2, py: 0.4, borderRadius: 1, cursor: 'pointer',
                                            fontSize: '0.7em', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                                            bgcolor: trendTab === i ? '#4a90e2' : trendBg,
                                            color: trendTab === i ? '#fff' : labelClr,
                                            transition: 'all 0.15s',
                                        }}>
                                        {t}
                                    </Box>
                                ))}
                            </Box>

                            {/* Trending agent rows */}
                            {trending.length === 0 ? (
                                <Typography sx={{ fontSize: '0.75em', color: labelClr, textAlign: 'center', py: 3 }}>
                                    No trending agents yet
                                </Typography>
                            ) : trending.map((agent, i) => {
                                const color  = getColor(agent.name);
                                const isUp   = agent.change >= 0;
                                return (
                                    <Box key={i} sx={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        py: 1, borderBottom: `1px solid ${cardBdr}`,
                                        cursor: 'pointer', '&:hover': { bgcolor: trendBg, mx: -1, px: 1, borderRadius: 1 }
                                    }}>
                                        {/* Avatar + name */}
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                                            <Box sx={{
                                                width: 34, height: 34, borderRadius: '50%', bgcolor: color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                            }}>
                                                <Typography sx={{ color: '#fff', fontSize: '0.65em', fontWeight: 800 }}>
                                                    {getInitials(agent.name)}
                                                </Typography>
                                            </Box>
                                            <Box>
                                                <Typography sx={{ fontSize: '0.82em', fontWeight: 600, color: textClr, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                                                    {agent.name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '0.65em', color: labelClr }}>
                                                    {agent.total} tasks · {agent.avgDur}ms avg
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* Rate + change */}
                                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                            <Typography sx={{ fontSize: '0.85em', fontWeight: 700, color: textClr }}>
                                                {agent.rate.toFixed(1)}%
                                            </Typography>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4, justifyContent: 'flex-end' }}>
                                                <Typography sx={{ fontSize: '0.65em', color: isUp ? '#2ecc71' : '#e74c3c' }}>
                                                    {isUp ? '+' : ''}{agent.change}% {isUp ? '▲' : '▼'}
                                                </Typography>
                                                <Box sx={{
                                                    width: 18, height: 18, borderRadius: '50%',
                                                    bgcolor: isUp ? '#2ecc71' : '#e74c3c',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'center', ml: 0.3
                                                }}>
                                                    <Typography sx={{ color: '#fff', fontSize: '0.55em', fontWeight: 800 }}>
                                                        {isUp ? '+' : '-'}
                                                    </Typography>
                                                </Box>
                                            </Box>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>
        </Box>
    );
}
