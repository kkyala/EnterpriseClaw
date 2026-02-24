const {
    Box, Typography, Grid, Card, CardContent, CircularProgress, Chip, LinearProgress,
    Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField,
    Select, MenuItem, FormControl, InputLabel, Snackbar, Alert
} = MaterialUI;

/* ─────────────────────── Create Task Dialog ─────────────────────── */
function DashCreateTaskDialog({ open, onClose, agents, isDark, onQueued }) {
    const [task, setTask] = React.useState('');
    const [agent, setAgent] = React.useState('');
    const [busy, setBusy] = React.useState(false);
    const [err, setErr] = React.useState('');

    React.useEffect(() => {
        if (open && agents.length > 0 && !agent) setAgent(agents[0].name);
        if (open) { setTask(''); setErr(''); }
    }, [open, agents]);

    const submit = async () => {
        if (!task.trim()) { setErr('Please describe the task.'); return; }
        setBusy(true); setErr('');
        try {
            const r = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task: task.trim(), persona_name: agent, tenant_id: 'acme_corp', source: 'dashboard' })
            });
            if (!r.ok) throw new Error((await r.json()).detail || 'Request failed');
            const d = await r.json();
            onQueued && onQueued(d);
            onClose();
        } catch (e) { setErr(e.message); }
        finally { setBusy(false); }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { bgcolor: isDark ? '#2d3047' : '#fff' } }}>
            <DialogTitle sx={{ fontWeight: 700 }}>🚀 Create New Task</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Select Agent</InputLabel>
                        <Select value={agent} onChange={e => setAgent(e.target.value)} label="Select Agent">
                            {agents.map(a => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <TextField
                        label="Task Description" value={task}
                        onChange={e => setTask(e.target.value)}
                        multiline rows={4} fullWidth size="small"
                        placeholder="Describe what you want the agent to do…"
                        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) submit(); }}
                        helperText="Ctrl+Enter to submit quickly"
                        autoFocus
                    />
                    {err && <Typography color="error" variant="body2">{err}</Typography>}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={busy}>Cancel</Button>
                <Button onClick={submit} variant="contained" disabled={busy || !task.trim()}>
                    {busy ? <><CircularProgress size={16} sx={{ mr: 1 }} /> Queuing…</> : 'Execute Task'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/* ─────────────────────── Workflow Dialog (placeholder) ─────────────────────── */
function WorkflowDialog({ open, onClose, isDark }) {
    const WORKFLOWS = [
        { name: 'Full Compliance Audit', steps: ['Compliance Officer', 'Finance Automation Agent', 'Communications Agent'], icon: '🔍' },
        { name: 'Hiring Pipeline', steps: ['Recruitment Agent', 'Communications Agent'], icon: '👥' },
        { name: 'Financial Close', steps: ['Finance Automation Agent', 'Communications Agent'], icon: '💰' },
        { name: 'Supply Chain Review', steps: ['Manufacturing Optimization Agent', 'Finance Automation Agent'], icon: '📦' },
    ];
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { bgcolor: isDark ? '#2d3047' : '#fff' } }}>
            <DialogTitle sx={{ fontWeight: 700 }}>🔄 Run Workflow — Multi-Agent Pipeline</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
                    {WORKFLOWS.map((wf, i) => (
                        <Box key={i} sx={{
                            p: 1.5, border: `1px solid ${isDark ? '#43455c' : '#e2e8f0'}`, borderRadius: 1.5,
                            cursor: 'pointer', '&:hover': { border: '1px solid #4a90e2', bgcolor: '#4a90e210' }
                        }}>
                            <Typography sx={{ fontWeight: 600, mb: 0.5 }}>{wf.icon} {wf.name}</Typography>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                {wf.steps.map((s, j) => (
                                    <React.Fragment key={j}>
                                        <Chip label={s} size="small" sx={{ fontSize: '0.65em', height: 20 }} />
                                        {j < wf.steps.length - 1 && <Typography sx={{ color: '#6c7293', alignSelf: 'center', fontSize: '0.8em' }}>→</Typography>}
                                    </React.Fragment>
                                ))}
                            </Box>
                        </Box>
                    ))}
                    <Typography variant="caption" color="textSecondary">
                        Select a workflow to run via the Agentic Orchestrator with automatic task decomposition.
                    </Typography>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

/* ─────────────────────── Dashboard ─────────────────────── */
function Dashboard({ refreshKey, isDark, onNavigate }) {
    const [analytics, setAnalytics] = React.useState(null);
    const [agents, setAgents] = React.useState([]);
    const [logs, setLogs] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [wsTab, setWsTab] = React.useState('all');   // My Workspace filter
    const [trendTab, setTrendTab] = React.useState(0);
    const [showTask, setShowTask] = React.useState(false);
    const [showWF, setShowWF] = React.useState(false);
    const [toast, setToast] = React.useState(null);
    const volumeRef = React.useRef(null);
    const statusRef = React.useRef(null);
    const chartRefs = React.useRef({});

    const load = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/analytics').then(r => r.json()),
            fetch('/api/agents').then(r => r.json()),
            fetch('/api/task-logs').then(r => r.json())
        ]).then(([a, ag, l]) => {
            setAnalytics(a); setAgents(ag); setLogs(l); setLoading(false);
        }).catch(() => setLoading(false));
    };

    React.useEffect(load, [refreshKey]);

    // Charts
    React.useEffect(() => {
        if (!analytics) return;
        if (volumeRef.current) {
            if (chartRefs.current.vol) chartRefs.current.vol.destroy();
            chartRefs.current.vol = new Chart(volumeRef.current.getContext('2d'), {
                type: 'line',
                data: {
                    labels: analytics.daily_volume.map(d => d.date),
                    datasets: [{
                        label: 'Tasks', data: analytics.daily_volume.map(d => d.task_count),
                        borderColor: '#4a90e2', backgroundColor: 'rgba(74,144,226,0.12)',
                        fill: true, tension: 0.4, pointRadius: 3, pointBackgroundColor: '#4a90e2'
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { labels: { color: isDark ? '#aaa' : '#555', font: { size: 11 } } } },
                    scales: {
                        x: { ticks: { color: isDark ? '#666' : '#888' }, grid: { color: isDark ? '#1e2030' : '#e8edf5' } },
                        y: { ticks: { color: isDark ? '#666' : '#888' }, grid: { color: isDark ? '#1e2030' : '#e8edf5' } }
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
                    datasets: [{
                        data: analytics.status_distribution.map(s => s.count),
                        backgroundColor: ['#2ecc71', '#e74c3c', '#f39c12', '#3498db', '#9b59b6']
                    }]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom', labels: { color: isDark ? '#aaa' : '#555', font: { size: 10 }, boxWidth: 12, padding: 8 } } }
                }
            });
        }
    }, [analytics, isDark]);

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;
    if (!analytics) return <Typography color="error">Failed to load analytics.</Typography>;

    const agentColors = ['#4a90e2', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#3498db'];
    const getColor = n => agentColors[n.length % agentColors.length];
    const getInit = n => n.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    /* ── Compute agent stats ── */
    const agentStats = (() => {
        const stats = {};
        agents.forEach(a => { stats[a.name] = { total: 0, success: 0, failed: 0, totalDur: 0 }; });
        logs.forEach(l => {
            if (!stats[l.agent_name]) stats[l.agent_name] = { total: 0, success: 0, failed: 0, totalDur: 0 };
            stats[l.agent_name].total++;
            if (['success', 'SUCCESS'].includes(l.status)) stats[l.agent_name].success++;
            else stats[l.agent_name].failed++;
            stats[l.agent_name].totalDur += (l.duration_ms || 0);
        });
        return Object.entries(stats).map(([name, s]) => ({
            name, ...s,
            rate: s.total > 0 ? (s.success / s.total) * 100 : 0,
            avgDur: s.total > 0 ? Math.round(s.totalDur / s.total) : 0,
            change: +(((name.length * 7) % 25) - 10).toFixed(1)
        }));
    })();

    const activeCount = agentStats.filter(a => a.total > 0).length;
    const avgResp = (() => {
        const v = logs.filter(l => l.duration_ms > 0);
        return v.length > 0 ? Math.round(v.reduce((a, l) => a + l.duration_ms, 0) / v.length) : 0;
    })();

    /* ── My Workspace filter ── */
    const filterLogs = tab => {
        if (tab === 'all') return logs;
        if (tab === 'running') return logs.filter(l => ['PENDING', 'QUEUED', 'in_progress'].includes(l.status));
        if (tab === 'completed') return logs.filter(l => ['success', 'SUCCESS'].includes(l.status));
        if (tab === 'failed') return logs.filter(l => ['failure', 'FAILURE'].includes(l.status));
        return logs;
    };
    const wsLogs = filterLogs(wsTab);
    const wsSuccess = wsLogs.filter(l => ['success', 'SUCCESS'].includes(l.status)).length;
    const wsRate = wsLogs.length > 0 ? (wsSuccess / wsLogs.length) * 100 : analytics.kpis.success_rate;
    const wsCost = wsLogs.reduce((s, l) => s + (l.estimated_cost || 0), 0);

    /* ── Trending ── */
    const getTrend = () => {
        const base = [...agentStats];
        if (trendTab === 0) return base.filter(a => a.total > 0).sort((a, b) => b.total - a.total).slice(0, 6);
        if (trendTab === 1) return base.sort((a, b) => b.rate - a.rate).slice(0, 6);
        if (trendTab === 2) return base.sort((a, b) => b.total - a.total).slice(0, 6);
        return base.slice(0, 6);
    };
    const trending = getTrend();

    const cardBg = isDark ? '#1e2030' : '#ffffff';
    const cardBdr = isDark ? '#2d3047' : '#e2e8f0';
    const labelClr = isDark ? '#6c7293' : '#64748b';
    const textClr = isDark ? '#c8cce8' : '#1e293b';
    const trendBg = isDark ? '#161826' : '#f1f5f9';

    const WS_TABS = [
        { id: 'all', label: 'All' },
        { id: 'running', label: 'Running' },
        { id: 'completed', label: 'Completed' },
        { id: 'failed', label: 'Failed' },
    ];
    const TREND_TABS = ['Active', 'Top Rate', 'Most Tasks', 'Recent'];

    /* ── Quick actions ── */
    const quickActions = [
        { icon: '🤖', label: 'Execute Agent', sub: 'Run AI agents', color: '#4a90e2', action: () => setShowTask(true) },
        { icon: '📅', label: 'Schedule Task', sub: 'Cron & one-shot', color: '#2ecc71', action: () => onNavigate && onNavigate(9) },
        { icon: '🔄', label: 'Workflows', sub: 'Build pipelines', color: '#9b59b6', action: () => onNavigate && onNavigate(8) },
        { icon: '🎯', label: 'Skills', sub: 'Manage capabilities', color: '#1abc9c', action: () => onNavigate && onNavigate(7) },
        { icon: '👥', label: 'Agent Groups', sub: 'Team management', color: '#f39c12', action: () => onNavigate && onNavigate(10) },
        { icon: '💬', label: 'Agent Comms', sub: 'Inter-agent messages', color: '#e74c3c', action: () => onNavigate && onNavigate(6) },
    ];

    return (
        <Box>
            {/* ── My Workspace ── */}
            <Card sx={{ mb: 2, bgcolor: cardBg, border: `1px solid ${cardBdr}` }}>
                <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '1em', color: textClr }}>My Workspace</Typography>
                            {WS_TABS.map(t => (
                                <Box key={t.id} onClick={() => setWsTab(t.id)}
                                    sx={{
                                        px: 1.2, py: 0.3, borderRadius: 1, cursor: 'pointer',
                                        fontSize: '0.72em', fontWeight: wsTab === t.id ? 700 : 400,
                                        bgcolor: wsTab === t.id ? '#4a90e2' : 'transparent',
                                        color: wsTab === t.id ? '#fff' : labelClr,
                                        border: wsTab !== t.id ? `1px solid ${cardBdr}` : 'none',
                                        transition: 'all 0.15s',
                                    }}>
                                    {t.label}
                                </Box>
                            ))}
                        </Box>
                    </Box>

                    {/* KPI row */}
                    <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
                        {[
                            { label: 'Total Tasks', value: wsLogs.length, color: textClr },
                            { label: 'Success', value: wsSuccess, color: '#2ecc71' },
                            { label: 'Overall Rate', value: `${wsRate.toFixed(1)}%`, color: wsRate >= 70 ? '#2ecc71' : '#e74c3c' },
                            { label: "Today's Cost", value: `$${Math.max(analytics.kpis.cost_today, wsCost).toFixed(2)}`, color: '#f39c12' },
                        ].map((kpi, i) => (
                            <Grid item xs={3} key={i}>
                                <Box>
                                    <Typography sx={{ fontSize: '0.72em', color: labelClr, mb: 0.2 }}>{kpi.label}</Typography>
                                    <Typography sx={{ fontWeight: 700, fontSize: '1.28em', color: kpi.color }}>{kpi.value}</Typography>
                                </Box>
                            </Grid>
                        ))}
                    </Grid>

                    {/* Status bar */}
                    <Box sx={{ display: 'flex', gap: 3, pt: 1, borderTop: `1px solid ${cardBdr}`, alignItems: 'center', flexWrap: 'wrap' }}>
                        <Typography sx={{ fontSize: '0.78em', color: labelClr }}>
                            Active Tasks: <span style={{ color: '#4a90e2', fontWeight: 700 }}>{wsLogs.filter(l => ['PENDING', 'QUEUED', 'in_progress'].includes(l.status)).length}</span>
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
                            <Box onClick={() => setShowTask(true)} sx={{
                                px: 2, py: 0.55, bgcolor: '#4a90e2', borderRadius: 1,
                                cursor: 'pointer', fontSize: '0.78em', fontWeight: 700, color: '#fff',
                                '&:hover': { bgcolor: '#357abf' }, userSelect: 'none'
                            }}>
                                + New Task
                            </Box>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* ── Two-column layout ── */}
            <Grid container spacing={2}>
                {/* Left column: Execute/Deploy + Charts */}
                <Grid item xs={7}>
                    {/* Execute / Deploy AI Agents */}
                    <Card sx={{ mb: 2, bgcolor: cardBg, border: `1px solid ${cardBdr}` }}>
                        <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.9em', color: textClr, mb: 1.5 }}>
                                Execute / Deploy AI Agents
                            </Typography>
                            <Grid container spacing={1}>
                                {quickActions.map((qa, i) => (
                                    <Grid item xs={4} key={i}>
                                        <Box onClick={qa.action} sx={{
                                            display: 'flex', alignItems: 'center', gap: 1.2, p: 1.2,
                                            border: `1px solid ${cardBdr}`, borderRadius: 1.5,
                                            cursor: 'pointer', transition: 'all 0.15s',
                                            userSelect: 'none',
                                            '&:hover': { border: `1px solid ${qa.color}`, bgcolor: `${qa.color}18`, transform: 'translateY(-1px)' }
                                        }}>
                                            <Box sx={{
                                                width: 36, height: 36, borderRadius: 1.5,
                                                bgcolor: `${qa.color}20`, display: 'flex', alignItems: 'center',
                                                justifyContent: 'center', fontSize: '1.2em', flexShrink: 0
                                            }}>
                                                {qa.icon}
                                            </Box>
                                            <Box>
                                                <Typography sx={{ fontSize: '0.78em', fontWeight: 600, color: textClr, lineHeight: 1.2 }}>
                                                    {qa.label}
                                                </Typography>
                                                <Typography sx={{ fontSize: '0.63em', color: labelClr }}>{qa.sub}</Typography>
                                            </Box>
                                        </Box>
                                    </Grid>
                                ))}
                            </Grid>

                            {/* Orchestrator Status Banner */}
                            <Box onClick={() => onNavigate && onNavigate(6)} sx={{
                                mt: 1.5, p: 1.2, border: `1px solid ${cardBdr}`, borderRadius: 1.5,
                                display: 'flex', alignItems: 'center', gap: 1.5, cursor: 'pointer',
                                transition: 'all 0.15s',
                                background: isDark ? 'linear-gradient(135deg, #1e2030, #2d1f4e)' : 'linear-gradient(135deg, #f8fafc, #f0e6ff)',
                                '&:hover': { border: '1px solid #9b59b6', bgcolor: '#9b59b610' }
                            }}>
                                <Typography sx={{ fontSize: '1.2em' }}>🎯</Typography>
                                <Box>
                                    <Typography sx={{ fontSize: '0.8em', fontWeight: 600, color: textClr }}>Agentic Orchestrator</Typography>
                                    <Typography sx={{ fontSize: '0.67em', color: labelClr }}>
                                        Tasks auto-decompose into sub-agents · ReAct reasoning · inter-agent communication
                                    </Typography>
                                </Box>
                                <Chip label="Live" size="small"
                                    sx={{ ml: 'auto', bgcolor: '#2ecc71', color: '#fff', fontSize: '0.65em', height: 20, fontWeight: 700 }} />
                                <Typography sx={{ color: labelClr, fontSize: '0.9em' }}>›</Typography>
                            </Box>
                        </CardContent>
                    </Card>

                    {/* Mini charts */}
                    <Grid container spacing={2}>
                        <Grid item xs={7}>
                            <Card sx={{ bgcolor: cardBg, border: `1px solid ${cardBdr}` }}>
                                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Typography sx={{ fontSize: '0.8em', fontWeight: 600, color: textClr, mb: 1 }}>Task Volume</Typography>
                                    <Box sx={{ position: 'relative', height: 160 }}>
                                        <canvas ref={volumeRef} style={{ maxHeight: 160 }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                        <Grid item xs={5}>
                            <Card sx={{ bgcolor: cardBg, border: `1px solid ${cardBdr}` }}>
                                <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                                    <Typography sx={{ fontSize: '0.8em', fontWeight: 600, color: textClr, mb: 1 }}>Status Distribution</Typography>
                                    <Box sx={{ position: 'relative', height: 160 }}>
                                        <canvas ref={statusRef} style={{ maxHeight: 160 }} />
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    </Grid>
                </Grid>

                {/* Right column: Trending Agents */}
                <Grid item xs={5}>
                    <Card sx={{ bgcolor: cardBg, border: `1px solid ${cardBdr}` }}>
                        <CardContent sx={{ pb: '12px !important', pt: 1.5, px: 2 }}>
                            <Typography sx={{ fontWeight: 700, fontSize: '0.9em', color: textClr, mb: 1 }}>
                                Trending Agents
                            </Typography>

                            <Box sx={{ display: 'flex', gap: 0.5, mb: 1.5, overflowX: 'auto', '&::-webkit-scrollbar': { height: 2 } }}>
                                {TREND_TABS.map((t, i) => (
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

                            {trending.length === 0 ? (
                                <Box sx={{ py: 4, textAlign: 'center' }}>
                                    <Typography sx={{ fontSize: '2em', mb: 1 }}>📊</Typography>
                                    <Typography sx={{ color: labelClr, fontSize: '0.82em' }}>
                                        No trending data yet — submit some tasks!
                                    </Typography>
                                </Box>
                            ) : trending.map((agent, i) => {
                                const color = getColor(agent.name);
                                const isUp = agent.change >= 0;
                                return (
                                    <Box key={i} sx={{
                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                        py: 1, borderBottom: `1px solid ${cardBdr}`,
                                        cursor: 'pointer',
                                        '&:hover': { bgcolor: trendBg, mx: -1, px: 1, borderRadius: 1 },
                                        '&:last-child': { borderBottom: 'none' }
                                    }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.2, minWidth: 0 }}>
                                            <Box sx={{ width: 34, height: 34, borderRadius: '50%', bgcolor: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                <Typography sx={{ color: '#fff', fontSize: '0.65em', fontWeight: 800 }}>{getInit(agent.name)}</Typography>
                                            </Box>
                                            <Box sx={{ minWidth: 0 }}>
                                                <Typography sx={{ fontSize: '0.82em', fontWeight: 600, color: textClr, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 140 }}>
                                                    {agent.name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '0.64em', color: labelClr }}>
                                                    {agent.total} tasks · {agent.avgDur}ms avg
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                            <Typography sx={{ fontSize: '0.85em', fontWeight: 700, color: textClr }}>
                                                {agent.rate.toFixed(1)}%
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.64em', color: isUp ? '#2ecc71' : '#e74c3c' }}>
                                                {isUp ? '+' : ''}{agent.change}% {isUp ? '▲' : '▼'}
                                            </Typography>
                                        </Box>
                                        <Box sx={{
                                            width: 22, height: 22, borderRadius: '50%',
                                            bgcolor: isUp ? '#2ecc71' : '#e74c3c',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center', ml: 0.8, flexShrink: 0
                                        }}>
                                            <Typography sx={{ color: '#fff', fontSize: '0.6em', fontWeight: 800 }}>
                                                {isUp ? '+' : '–'}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </CardContent>
                    </Card>
                </Grid>
            </Grid>

            {/* ── Dialogs ── */}
            <DashCreateTaskDialog
                open={showTask} onClose={() => setShowTask(false)}
                agents={agents} isDark={isDark}
                onQueued={d => {
                    setToast({ severity: 'info', msg: `Task queued (${d.task_id.substring(0, 8)}…) — waiting for result` });
                    setTimeout(() => load(), 2000);
                }}
            />
            <WorkflowDialog open={showWF} onClose={() => setShowWF(false)} isDark={isDark} />

            <Snackbar open={!!toast} autoHideDuration={4000} onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                {toast && (
                    <Alert onClose={() => setToast(null)} severity={toast.severity} sx={{ maxWidth: 480 }}>
                        {toast.msg}
                    </Alert>
                )}
            </Snackbar>
        </Box>
    );
}
