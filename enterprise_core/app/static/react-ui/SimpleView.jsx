const {
    Box, Typography, Paper, CircularProgress, Chip, Card, CardContent, Divider,
    TextField, Select, MenuItem, FormControl, InputLabel, Button,
    Dialog, DialogTitle, DialogContent, DialogActions
} = MaterialUI;

/* ─────────────────────── Create Task Dialog ─────────────────────── */
function CreateTaskDialog({ open, onClose, defaultAgent, agents, isDark, onCreated }) {
    const [task, setTask] = React.useState('');
    const [agent, setAgent] = React.useState(defaultAgent || '');
    const [submitting, setSubmit] = React.useState(false);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        if (open) {
            setTask('');
            setError('');
            if (!agent && agents.length > 0) setAgent(agents[0].name);
        }
    }, [open]);

    React.useEffect(() => {
        if (defaultAgent) setAgent(defaultAgent);
    }, [defaultAgent]);

    const handleSubmit = async () => {
        if (!task.trim()) { setError('Please enter a task description.'); return; }
        if (!agent) { setError('Please select an agent.'); return; }
        setSubmit(true); setError('');
        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ task: task.trim(), persona_name: agent, tenant_id: 'acme_corp', source: 'dashboard' })
            });
            if (!res.ok) throw new Error((await res.json()).detail || 'Failed to queue task');
            const data = await res.json();
            onCreated && onCreated(data);
            onClose();
        } catch (e) {
            setError(e.message);
        } finally {
            setSubmit(false);
        }
    };

    const bg = isDark ? '#2d3047' : '#ffffff';

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth
            PaperProps={{ sx: { bgcolor: bg } }}>
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
                        onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }}
                        helperText="Ctrl+Enter to submit"
                    />
                    {error && <Typography color="error" variant="body2">{error}</Typography>}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={submitting}>Cancel</Button>
                <Button onClick={handleSubmit} variant="contained" disabled={submitting || !task.trim()}>
                    {submitting ? <><CircularProgress size={16} sx={{ mr: 1 }} /> Queuing…</> : 'Execute Task'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}

/* ─────────────────────── Tasks Tab ─────────────────────── */
function SimpleView({ selectedAgent, isDark }) {
    const [tasks, setTasks] = React.useState([]);
    const [agents, setAgents] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [statusTab, setStatusTab] = React.useState('all');
    const [agentFilter, setAgent_] = React.useState('all');
    const [search, setSearch] = React.useState('');
    const [expanded, setExpanded] = React.useState(null);
    const [showCreate, setCreate] = React.useState(false);
    const [refreshing, setRefresh] = React.useState(false);

    const load = React.useCallback((silent = false) => {
        if (!silent) setLoading(true);
        else setRefresh(true);
        fetch('/api/task-logs').then(r => r.json()).then(d => {
            setTasks(Array.isArray(d) ? d : []);
            setLoading(false);
            setRefresh(false);
        }).catch(() => { setLoading(false); setRefresh(false); });
    }, []);

    React.useEffect(() => {
        fetch('/api/agents').then(r => r.json()).then(setAgents);
        load();
    }, []);

    // Auto-refresh every 4s if there are pending/running tasks
    React.useEffect(() => {
        const hasPending = tasks.some(t => ['QUEUED', 'PENDING', 'in_progress'].includes(t.status));
        if (!hasPending) return;
        const timer = setInterval(() => load(true), 4000);
        return () => clearInterval(timer);
    }, [tasks]);

    const bg = isDark ? '#1e2030' : '#ffffff';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const labelColor = isDark ? '#6c7293' : '#64748b';
    const textColor = isDark ? '#c8cce8' : '#1e293b';

    const STATUS_TABS = [
        { id: 'all', label: 'All', color: '#4a90e2' },
        { id: 'queued', label: 'Queued', color: '#4a90e2' },
        { id: 'running', label: 'Running', color: '#f39c12' },
        { id: 'success', label: 'Completed', color: '#2ecc71' },
        { id: 'failure', label: 'Failed', color: '#e74c3c' },
    ];

    const statusMatch = (task, tabId) => {
        if (tabId === 'all') return true;
        if (tabId === 'queued') return ['QUEUED', 'PENDING'].includes(task.status);
        if (tabId === 'running') return task.status === 'in_progress';
        if (tabId === 'success') return ['success', 'SUCCESS'].includes(task.status);
        if (tabId === 'failure') return ['failure', 'FAILURE'].includes(task.status);
        return true;
    };

    const filtered = tasks.filter(t => {
        if (!statusMatch(t, statusTab)) return false;
        if (agentFilter !== 'all' && t.agent_name !== agentFilter) return false;
        if (search && !t.agent_name.toLowerCase().includes(search.toLowerCase())
            && !t.task_id.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const counts = {};
    STATUS_TABS.forEach(s => {
        counts[s.id] = s.id === 'all' ? tasks.length : tasks.filter(t => statusMatch(t, s.id)).length;
    });

    const formatPayload = p => {
        try { return JSON.stringify(JSON.parse(p), null, 2); } catch { return p || ''; }
    };

    const parseRequest = p => {
        try { return JSON.parse(p); } catch { return { task: p }; }
    };

    const parseResponse = p => {
        try { const d = JSON.parse(p); return d; } catch { return { message: p }; }
    };

    const statusColor = (s) => {
        if (['success', 'SUCCESS'].includes(s)) return '#2ecc71';
        if (['failure', 'FAILURE'].includes(s)) return '#e74c3c';
        if (s === 'in_progress') return '#f39c12';
        return '#4a90e2';
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1em', color: textColor }}>
                        Task Management
                    </Typography>
                    {refreshing && <CircularProgress size={16} />}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => load(true)} sx={{ fontSize: '0.72em', height: 30 }}>
                        🔄 Refresh
                    </Button>
                    <Button size="small" variant="contained" onClick={() => setCreate(true)}
                        sx={{ fontSize: '0.72em', height: 30, background: 'linear-gradient(135deg, #4a90e2, #6c5ce7)', fontWeight: 700 }}>
                        + New Task
                    </Button>
                </Box>
            </Box>

            {/* Status filter tabs */}
            <Box sx={{ display: 'flex', gap: 0.6, mb: 2, flexWrap: 'wrap' }}>
                {STATUS_TABS.map(tab => (
                    <Box key={tab.id} onClick={() => setStatusTab(tab.id)}
                        sx={{
                            px: 1.5, py: 0.5, borderRadius: 1, cursor: 'pointer',
                            fontSize: '0.76em', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.6,
                            bgcolor: statusTab === tab.id ? tab.color : (isDark ? '#1e2030' : '#e2e8f0'),
                            color: statusTab === tab.id ? '#fff' : labelColor,
                            border: `1px solid ${statusTab === tab.id ? 'transparent' : borderColor}`,
                            transition: 'all 0.15s',
                        }}>
                        {tab.label}
                        <span style={{
                            background: statusTab === tab.id ? 'rgba(255,255,255,0.22)' : (isDark ? '#2d3047' : '#d0d8e0'),
                            borderRadius: '50%', minWidth: 20, height: 20, padding: '0 4px',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85em'
                        }}>
                            {counts[tab.id]}
                        </span>
                    </Box>
                ))}
            </Box>

            {/* Filter bar */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                    placeholder="Search task ID or agent name…" size="small" value={search}
                    onChange={e => setSearch(e.target.value)}
                    sx={{ flexGrow: 1, maxWidth: 300, '& .MuiOutlinedInput-root': { fontSize: '0.8em' } }}
                    InputProps={{ startAdornment: <span style={{ marginRight: 6, color: labelColor }}>🔍</span> }}
                />
                <FormControl size="small" sx={{ minWidth: 180 }}>
                    <InputLabel sx={{ fontSize: '0.8em' }}>Filter by Agent</InputLabel>
                    <Select value={agentFilter} onChange={e => setAgent_(e.target.value)} label="Filter by Agent"
                        sx={{ fontSize: '0.8em' }}>
                        <MenuItem value="all">All Agents</MenuItem>
                        {agents.map(a => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <Typography sx={{ fontSize: '0.78em', color: labelColor, ml: 'auto' }}>
                    {filtered.length} of {tasks.length} tasks
                </Typography>
            </Box>

            {/* Task list */}
            {filtered.length === 0 ? (
                <Box sx={{ p: 5, textAlign: 'center', border: `1px solid ${borderColor}`, borderRadius: 1.5 }}>
                    <Typography sx={{ fontSize: '2em', mb: 1 }}>📋</Typography>
                    <Typography sx={{ color: labelColor, mb: 2 }}>
                        {tasks.length === 0
                            ? 'No tasks yet. Create one to get started.'
                            : 'No tasks match your current filters.'}
                    </Typography>
                    {tasks.length === 0 && (
                        <Button variant="contained" size="small" onClick={() => setCreate(true)}>
                            + Create First Task
                        </Button>
                    )}
                </Box>
            ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    {filtered.map(task => {
                        const req = parseRequest(task.request_payload);
                        const res = parseResponse(task.response_payload);
                        const isSuccess = ['success', 'SUCCESS'].includes(task.status);
                        const isPending = ['QUEUED', 'PENDING', 'in_progress'].includes(task.status);
                        const sColor = statusColor(task.status);
                        const isExp = expanded === task.task_id;

                        return (
                            <Card key={task.task_id} sx={{
                                bgcolor: bg, border: `1px solid ${borderColor}`,
                                borderLeft: `4px solid ${sColor}`,
                                transition: 'box-shadow 0.15s',
                                '&:hover': { boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.4)' : '0 4px 16px rgba(0,0,0,0.12)' }
                            }}>
                                {/* Card header row */}
                                <Box
                                    onClick={() => setExpanded(isExp ? null : task.task_id)}
                                    sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, pt: 1.5, pb: 1, cursor: 'pointer' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                        {/* Agent chip */}
                                        <Chip label={task.agent_name} size="small"
                                            sx={{ bgcolor: '#4a90e2', color: '#fff', fontWeight: 600, fontSize: '0.72em', height: 22 }} />
                                        {/* Status chip */}
                                        <Chip label={task.status} size="small"
                                            sx={{ bgcolor: `${sColor}22`, color: sColor, fontWeight: 700, fontSize: '0.7em', height: 22, border: `1px solid ${sColor}44` }} />
                                        {isPending && <CircularProgress size={14} sx={{ color: '#f39c12' }} />}
                                        {/* Task preview */}
                                        <Typography sx={{ fontSize: '0.84em', color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>
                                            {req.task || '—'}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexShrink: 0 }}>
                                        {task.duration_ms > 0 && (
                                            <Typography sx={{ fontSize: '0.72em', color: labelColor }}>
                                                {task.duration_ms}ms
                                            </Typography>
                                        )}
                                        <Typography sx={{ fontSize: '0.72em', color: labelColor }}>
                                            {new Date(task.start_time).toLocaleString()}
                                        </Typography>
                                        <Typography sx={{ color: labelColor, fontSize: '0.9em', transition: 'transform 0.2s', transform: isExp ? 'rotate(180deg)' : 'none' }}>
                                            ▾
                                        </Typography>
                                    </Box>
                                </Box>

                                {/* Expanded details */}
                                {isExp && (
                                    <CardContent sx={{ pt: 0, px: 2, '&:last-child': { pb: 2 } }}>
                                        <Divider sx={{ mb: 1.5, borderColor }} />

                                        {/* Task ID */}
                                        <Typography sx={{ fontSize: '0.65em', color: labelColor, fontFamily: 'monospace', mb: 1.5 }}>
                                            Task ID: {task.task_id}
                                        </Typography>

                                        {/* User task */}
                                        <Typography sx={{ fontSize: '0.7em', fontWeight: 700, color: '#4a90e2', letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.5 }}>
                                            📥 User Task
                                        </Typography>
                                        <Box sx={{ p: 1.5, bgcolor: isDark ? '#13162a' : '#f0f4ff', borderRadius: 1, border: `1px solid ${borderColor}`, mb: 1.5 }}>
                                            <Typography sx={{ fontSize: '0.85em', color: textColor }}>
                                                {req.task || '—'}
                                            </Typography>
                                        </Box>

                                        {/* Agent response */}
                                        <Typography sx={{ fontSize: '0.7em', fontWeight: 700, color: isSuccess ? '#2ecc71' : isPending ? '#f39c12' : '#e74c3c', letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.5 }}>
                                            {isSuccess ? '📤 Agent Response' : isPending ? '⏳ Processing…' : '❌ Error'}
                                        </Typography>
                                        <Box sx={{ p: 1.5, bgcolor: isDark ? '#0d1a0d' : '#f0fff0', borderRadius: 1, border: `1px solid ${isSuccess ? '#2ecc7144' : borderColor}` }}>
                                            {task.response_payload ? (
                                                <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
                                                    <tbody>
                                                        {Object.entries(res).map(([k, v]) => (
                                                            <Box component="tr" key={k}>
                                                                <Box component="td" sx={{ py: 0.3, pr: 2, verticalAlign: 'top', width: 140 }}>
                                                                    <Typography sx={{ fontSize: '0.72em', fontWeight: 700, color: '#a0c4ff', textTransform: 'uppercase' }}>
                                                                        {k.replace(/_/g, ' ')}
                                                                    </Typography>
                                                                </Box>
                                                                <Box component="td" sx={{ py: 0.3 }}>
                                                                    <Typography sx={{ fontSize: '0.82em', color: textColor }}>
                                                                        {typeof v === 'object' ? JSON.stringify(v) : String(v)}
                                                                    </Typography>
                                                                </Box>
                                                            </Box>
                                                        ))}
                                                    </tbody>
                                                </Box>
                                            ) : (
                                                <Typography sx={{ fontSize: '0.82em', color: labelColor, fontStyle: 'italic' }}>
                                                    Waiting for result…
                                                </Typography>
                                            )}
                                        </Box>
                                    </CardContent>
                                )}
                            </Card>
                        );
                    })}
                </Box>
            )}

            {/* Create Task Dialog */}
            <CreateTaskDialog
                open={showCreate}
                onClose={() => setCreate(false)}
                defaultAgent={selectedAgent}
                agents={agents}
                isDark={isDark}
                onCreated={() => setTimeout(() => load(true), 500)}
            />
        </Box>
    );
}
