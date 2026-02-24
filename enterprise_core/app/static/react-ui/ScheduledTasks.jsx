const {
    Box, Typography, Card, CardContent, Chip, Button, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
    InputLabel, CircularProgress, Grid, Tooltip, Switch, FormControlLabel,
    Checkbox, ListItemText, OutlinedInput
} = MaterialUI;

const STATUS_STYLES = {
    active: { bg: '#2ecc7122', color: '#2ecc71', icon: '🟢' },
    paused: { bg: '#f39c1222', color: '#f39c12', icon: '⏸' },
    completed: { bg: '#4a90e222', color: '#4a90e2', icon: '✅' },
    failed: { bg: '#e74c3c22', color: '#e74c3c', icon: '❌' },
};

function ScheduledTasks({ isDark, refreshKey }) {
    const [tasks, setTasks] = React.useState([]);
    const [agents, setAgents] = React.useState([]);
    const [skills, setSkills] = React.useState([]);
    const [tools, setTools] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [statusFilter, setStatusFilter] = React.useState('all');
    const [newTask, setNewTask] = React.useState({
        name: '', description: '', task_description: '',
        cron_expression: '', scheduled_at: '',
        assigned_agents: [], auto_route: true,
        required_skills: [], required_tools: [],
        repeat_count: 0, created_by: 'dashboard'
    });

    const cardBg = isDark ? '#252840' : '#f8fafc';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const textColor = isDark ? '#c8cce8' : '#1e293b';
    const labelColor = isDark ? '#6c7293' : '#64748b';

    const loadData = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/scheduled-tasks').then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
            fetch('/api/agents').then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
            fetch('/api/skills').then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
            fetch('/api/tools').then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
        ]).then(([t, a, s, tl]) => { setTasks(t); setAgents(a); setSkills(s); setTools(tl); setLoading(false); })
            .catch(() => setLoading(false));
    };

    React.useEffect(loadData, [refreshKey]);

    const filtered = tasks.filter(t => statusFilter === 'all' || t.status === statusFilter);

    const handleCreate = () => {
        const payload = {
            ...newTask,
            assigned_agents: JSON.stringify(newTask.assigned_agents),
            required_skills: JSON.stringify(newTask.required_skills),
            required_tools: JSON.stringify(newTask.required_tools),
            auto_route: newTask.auto_route ? 1 : 0,
            scheduled_at: newTask.scheduled_at || null,
            cron_expression: newTask.cron_expression || null,
        };
        fetch('/api/scheduled-tasks', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(r => {
            if (r.ok) { setCreateOpen(false); loadData(); }
        });
    };

    const handleToggleStatus = (taskId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'paused' : 'active';
        fetch(`/api/scheduled-tasks/${taskId}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        }).then(() => loadData());
    };

    const handleDelete = (taskId) => {
        if (!confirm('Delete this scheduled task?')) return;
        fetch(`/api/scheduled-tasks/${taskId}`, { method: 'DELETE' }).then(() => loadData());
    };

    const formatDate = (isoStr) => {
        if (!isoStr) return '—';
        const d = new Date(isoStr);
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
                <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.3em', color: textColor, display: 'flex', alignItems: 'center', gap: 1 }}>
                        📅 Scheduled Tasks
                    </Typography>
                    <Typography sx={{ fontSize: '0.78em', color: labelColor }}>
                        {tasks.length} scheduled · {tasks.filter(t => t.status === 'active').length} active · {tasks.reduce((a, t) => a + t.runs_completed, 0)} completed runs
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    {/* Status filter */}
                    <Box sx={{ display: 'flex', gap: 0.5 }}>
                        {['all', 'active', 'paused', 'completed'].map(s => (
                            <Box key={s} onClick={() => setStatusFilter(s)}
                                sx={{
                                    px: 1.2, py: 0.4, borderRadius: 1.5, cursor: 'pointer',
                                    fontSize: '0.72em', fontWeight: 600,
                                    bgcolor: statusFilter === s ? '#4a90e2' : (isDark ? '#1e2030' : '#e2e8f0'),
                                    color: statusFilter === s ? '#fff' : labelColor,
                                }}>
                                {s.charAt(0).toUpperCase() + s.slice(1)}
                            </Box>
                        ))}
                    </Box>
                    <Button variant="contained" size="small" onClick={() => setCreateOpen(true)}
                        sx={{ textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #3498db, #2ecc71)', fontSize: '0.82em' }}>
                        + Schedule Task
                    </Button>
                </Box>
            </Box>

            {/* Tasks Grid */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%' }}>
                        <Typography sx={{ fontSize: '3em', mb: 1 }}>📅</Typography>
                        <Typography sx={{ color: labelColor, fontWeight: 600 }}>No scheduled tasks</Typography>
                    </Box>
                ) : (
                    <Grid container spacing={1.5}>
                        {filtered.map(task => {
                            const stStyle = STATUS_STYLES[task.status] || STATUS_STYLES.active;
                            return (
                                <Grid item xs={12} md={6} key={task.id}>
                                    <Card sx={{
                                        bgcolor: cardBg, border: `1px solid ${borderColor}`, borderRadius: 2,
                                        transition: 'all 0.2s',
                                        '&:hover': { borderColor: stStyle.color, transform: 'translateY(-2px)' },
                                        borderLeft: `3px solid ${stStyle.color}`,
                                    }}>
                                        <CardContent sx={{ p: '14px !important', '&:last-child': { pb: '14px !important' } }}>
                                            {/* Top row */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography sx={{ fontWeight: 700, fontSize: '0.92em', color: textColor, lineHeight: 1.2 }}>
                                                        {stStyle.icon} {task.name}
                                                    </Typography>
                                                    {task.description && (
                                                        <Typography sx={{ fontSize: '0.7em', color: labelColor, mt: 0.3 }}>{task.description}</Typography>
                                                    )}
                                                </Box>
                                                <Box sx={{ display: 'flex', gap: 0.3 }}>
                                                    <Tooltip title={task.status === 'active' ? 'Pause' : 'Resume'}>
                                                        <Box onClick={() => handleToggleStatus(task.id, task.status)}
                                                            sx={{ cursor: 'pointer', fontSize: '0.85em', p: 0.3, borderRadius: 1, '&:hover': { bgcolor: isDark ? '#2d3047' : '#e2e8f0' } }}>
                                                            {task.status === 'active' ? '⏸' : '▶'}
                                                        </Box>
                                                    </Tooltip>
                                                    <Tooltip title="Delete">
                                                        <Box onClick={() => handleDelete(task.id)}
                                                            sx={{ cursor: 'pointer', fontSize: '0.85em', p: 0.3, borderRadius: 1, '&:hover': { bgcolor: '#e74c3c33' } }}>🗑</Box>
                                                    </Tooltip>
                                                </Box>
                                            </Box>

                                            {/* Task description */}
                                            <Box sx={{ bgcolor: isDark ? '#1e2030' : '#f0f2f5', borderRadius: 1, p: 1, mb: 1 }}>
                                                <Typography sx={{ fontSize: '0.72em', color: textColor, fontStyle: 'italic' }}>
                                                    "{task.task_description?.substring(0, 150)}{(task.task_description?.length || 0) > 150 ? '…' : ''}"
                                                </Typography>
                                            </Box>

                                            {/* Schedule info */}
                                            <Box sx={{ display: 'flex', gap: 1.5, mb: 1, flexWrap: 'wrap' }}>
                                                {task.cron_expression && (
                                                    <Typography sx={{ fontSize: '0.68em', color: labelColor }}>
                                                        🔄 <strong>Cron:</strong> {task.cron_expression}
                                                    </Typography>
                                                )}
                                                <Typography sx={{ fontSize: '0.68em', color: labelColor }}>
                                                    📅 <strong>Next:</strong> {formatDate(task.next_run_at)}
                                                </Typography>
                                                <Typography sx={{ fontSize: '0.68em', color: labelColor }}>
                                                    ✅ <strong>Runs:</strong> {task.runs_completed}/{task.repeat_count || '∞'}
                                                </Typography>
                                            </Box>

                                            {/* Agent assignments */}
                                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                                {task.auto_route ? (
                                                    <Chip label="🎯 Auto-Routed" size="small"
                                                        sx={{ height: 20, fontSize: '0.62em', fontWeight: 600, bgcolor: '#1abc9c22', color: '#1abc9c' }} />
                                                ) : null}
                                                {(task.assigned_agents || []).map(a => (
                                                    <Chip key={a} label={`🤖 ${a}`} size="small"
                                                        sx={{ height: 20, fontSize: '0.62em', fontWeight: 600, bgcolor: '#4a90e222', color: '#4a90e2' }} />
                                                ))}
                                                {(task.required_skills || []).map(s => (
                                                    <Chip key={s} label={`🎯 ${s}`} size="small"
                                                        sx={{ height: 20, fontSize: '0.62em', fontWeight: 600, bgcolor: '#9b59b622', color: '#9b59b6' }} />
                                                ))}
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </Box>

            {/* ── Create Scheduled Task Dialog ── */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="md" fullWidth
                PaperProps={{ sx: { bgcolor: isDark ? '#252840' : '#fff', borderRadius: 2 } }}>
                <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05em', borderBottom: `1px solid ${borderColor}`, pb: 1.5 }}>
                    📅 Schedule New Task
                </DialogTitle>
                <DialogContent sx={{ pt: '16px !important' }}>
                    <Grid container spacing={2}>
                        <Grid item xs={6}>
                            <TextField fullWidth label="Task Name" value={newTask.name}
                                onChange={e => setNewTask({ ...newTask, name: e.target.value })}
                                size="small" placeholder="e.g. Daily Compliance Check" />
                        </Grid>
                        <Grid item xs={6}>
                            <TextField fullWidth label="Description" value={newTask.description}
                                onChange={e => setNewTask({ ...newTask, description: e.target.value })}
                                size="small" />
                        </Grid>
                        <Grid item xs={12}>
                            <TextField fullWidth label="Task Description (what the agent should do)" value={newTask.task_description}
                                onChange={e => setNewTask({ ...newTask, task_description: e.target.value })}
                                size="small" multiline rows={2} placeholder="Review all invoices from this week for compliance violations..." />
                        </Grid>

                        {/* Scheduling */}
                        <Grid item xs={4}>
                            <TextField fullWidth label="Cron Expression" value={newTask.cron_expression}
                                onChange={e => setNewTask({ ...newTask, cron_expression: e.target.value })}
                                size="small" placeholder="0 9 * * MON-FRI" helperText="Leave empty for one-time" />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField fullWidth label="Schedule At" type="datetime-local"
                                value={newTask.scheduled_at}
                                onChange={e => setNewTask({ ...newTask, scheduled_at: e.target.value })}
                                size="small" InputLabelProps={{ shrink: true }} />
                        </Grid>
                        <Grid item xs={4}>
                            <TextField fullWidth label="Repeat Count (0=infinite)" type="number"
                                value={newTask.repeat_count}
                                onChange={e => setNewTask({ ...newTask, repeat_count: parseInt(e.target.value) || 0 })}
                                size="small" />
                        </Grid>

                        {/* Agent assignment */}
                        <Grid item xs={12}>
                            <FormControlLabel
                                control={<Switch checked={newTask.auto_route}
                                    onChange={e => setNewTask({ ...newTask, auto_route: e.target.checked, assigned_agents: [] })} />}
                                label={<Typography sx={{ fontSize: '0.85em', fontWeight: 600 }}>🎯 Auto-route to best agent</Typography>}
                            />
                        </Grid>

                        {!newTask.auto_route && (
                            <Grid item xs={12}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Assign Agents (multi-select)</InputLabel>
                                    <Select multiple value={newTask.assigned_agents} label="Assign Agents (multi-select)"
                                        onChange={e => setNewTask({ ...newTask, assigned_agents: e.target.value })}
                                        input={<OutlinedInput label="Assign Agents (multi-select)" />}
                                        renderValue={(sel) => sel.join(', ')}>
                                        {agents.map(a => (
                                            <MenuItem key={a.name} value={a.name}>
                                                <Checkbox checked={newTask.assigned_agents.includes(a.name)} size="small" />
                                                <ListItemText primary={a.name} />
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Grid>
                        )}

                        {/* Required skills */}
                        <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Required Skills</InputLabel>
                                <Select multiple value={newTask.required_skills} label="Required Skills"
                                    onChange={e => setNewTask({ ...newTask, required_skills: e.target.value })}
                                    input={<OutlinedInput label="Required Skills" />}
                                    renderValue={(sel) => sel.join(', ')}>
                                    {skills.map(s => (
                                        <MenuItem key={s.name} value={s.name}>
                                            <Checkbox checked={newTask.required_skills.includes(s.name)} size="small" />
                                            <ListItemText primary={s.name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                        <Grid item xs={6}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Required Tools</InputLabel>
                                <Select multiple value={newTask.required_tools} label="Required Tools"
                                    onChange={e => setNewTask({ ...newTask, required_tools: e.target.value })}
                                    input={<OutlinedInput label="Required Tools" />}
                                    renderValue={(sel) => sel.join(', ')}>
                                    {tools.map(t => (
                                        <MenuItem key={t.name} value={t.name}>
                                            <Checkbox checked={newTask.required_tools.includes(t.name)} size="small" />
                                            <ListItemText primary={t.name} />
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Grid>
                    </Grid>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCreateOpen(false)} size="small">Cancel</Button>
                    <Button onClick={handleCreate} variant="contained" size="small"
                        disabled={!newTask.name.trim() || !newTask.task_description.trim()}
                        sx={{ textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #3498db, #2ecc71)' }}>
                        Schedule Task
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
