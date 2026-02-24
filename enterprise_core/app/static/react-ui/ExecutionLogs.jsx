const {
    Box, Typography, Table, TableBody, TableCell, TableContainer,
    TableHead, TableRow, Paper, CircularProgress, Chip,
    TextField, Select, MenuItem, FormControl, InputLabel, Button, Tooltip
} = MaterialUI;

function ExecutionLogs({ refreshKey, isDark }) {
    const [logs, setLogs] = React.useState([]);
    const [agents, setAgents] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [expanded, setExpanded] = React.useState(null);
    const [statusF, setStatusF] = React.useState('all');
    const [agentF, setAgentF] = React.useState('all');
    const [search, setSearch] = React.useState('');
    const [sortCol, setSortCol] = React.useState('time');
    const [sortDir, setSortDir] = React.useState('desc');

    const load = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/task-logs').then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
            fetch('/api/agents').then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
        ]).then(([l, a]) => { setLogs(l); setAgents(a); setLoading(false); })
            .catch(() => setLoading(false));
    };

    React.useEffect(load, [refreshKey]);

    const bg = isDark ? '#1e2030' : '#ffffff';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const labelColor = isDark ? '#6c7293' : '#64748b';
    const textColor = isDark ? '#c8cce8' : '#1e293b';
    const tableBg = isDark ? '#131524' : '#f8fafc';
    const headBg = isDark ? '#0b0d1a' : '#e8edf5';
    const rowHover = isDark ? '#1a1c2e' : '#f0f4ff';
    const expandBg = isDark ? '#0d0f1e' : '#f0f4f8';

    const STATUS_COLORS = {
        success: { chip: 'success', text: '#2ecc71' },
        SUCCESS: { chip: 'success', text: '#2ecc71' },
        failure: { chip: 'error', text: '#e74c3c' },
        FAILURE: { chip: 'error', text: '#e74c3c' },
        PENDING: { chip: 'warning', text: '#f39c12' },
        QUEUED: { chip: 'info', text: '#4a90e2' },
        in_progress: { chip: 'warning', text: '#f39c12' },
    };

    const matchStatus = (log, f) => {
        if (f === 'all') return true;
        if (f === 'success') return ['success', 'SUCCESS'].includes(log.status);
        if (f === 'failure') return ['failure', 'FAILURE'].includes(log.status);
        if (f === 'pending') return ['PENDING', 'QUEUED', 'in_progress'].includes(log.status);
        return true;
    };

    const filtered = logs.filter(l =>
        matchStatus(l, statusF) &&
        (agentF === 'all' || l.agent_name === agentF) &&
        (!search || l.agent_name.toLowerCase().includes(search.toLowerCase())
            || l.task_id.toLowerCase().includes(search.toLowerCase()))
    ).sort((a, b) => {
        let cmp = 0;
        if (sortCol === 'time') cmp = new Date(a.start_time) - new Date(b.start_time);
        if (sortCol === 'duration') cmp = (a.duration_ms || 0) - (b.duration_ms || 0);
        if (sortCol === 'status') cmp = a.status.localeCompare(b.status);
        if (sortCol === 'agent') cmp = a.agent_name.localeCompare(b.agent_name);
        return sortDir === 'desc' ? -cmp : cmp;
    });

    const stats = {
        total: filtered.length,
        success: filtered.filter(l => ['success', 'SUCCESS'].includes(l.status)).length,
        failed: filtered.filter(l => ['failure', 'FAILURE'].includes(l.status)).length,
        pending: filtered.filter(l => ['PENDING', 'QUEUED', 'in_progress'].includes(l.status)).length,
        avgDur: (() => {
            const valid = filtered.filter(l => l.duration_ms > 0);
            return valid.length > 0 ? Math.round(valid.reduce((a, l) => a + l.duration_ms, 0) / valid.length) : 0;
        })()
    };

    const toggleSort = col => {
        if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        else { setSortCol(col); setSortDir('desc'); }
    };

    const sortIcon = col => sortCol === col ? (sortDir === 'desc' ? ' ▼' : ' ▲') : '';

    const durColor = ms => ms > 2000 ? '#e74c3c' : ms > 800 ? '#f39c12' : '#2ecc71';

    const fmtPayload = p => {
        try { return JSON.stringify(JSON.parse(p), null, 2); } catch { return p || 'N/A'; }
    };

    const exportCSV = () => {
        const header = ['Task ID', 'Agent', 'Status', 'Duration(ms)', 'Model', 'Time'];
        const rows = filtered.map(l => [
            l.task_id, `"${l.agent_name}"`, l.status, l.duration_ms || '',
            l.primary_model_used || '', new Date(l.start_time).toLocaleString()
        ]);
        const csv = [header, ...rows].map(r => r.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `geni_exec_logs_${Date.now()}.csv`; a.click();
        URL.revokeObjectURL(url);
    };

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

    const SortCell = ({ col, children }) => (
        <TableCell onClick={() => toggleSort(col)}
            sx={{ fontWeight: 700, fontSize: '0.72em', color: labelColor, textTransform: 'uppercase', letterSpacing: 0.8, cursor: 'pointer', userSelect: 'none', bgcolor: headBg, whiteSpace: 'nowrap' }}>
            {children}{sortIcon(col)}
        </TableCell>
    );

    return (
        <Box>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '1.1em', color: textColor }}>
                    Execution Audit Log
                </Typography>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Tooltip title="Export filtered logs as CSV">
                        <Button size="small" variant="outlined" onClick={exportCSV}
                            sx={{ fontSize: '0.72em', height: 30 }}>
                            📥 Export CSV
                        </Button>
                    </Tooltip>
                    <Button size="small" variant="outlined" onClick={load}
                        sx={{ fontSize: '0.72em', height: 30 }}>
                        🔄 Refresh
                    </Button>
                </Box>
            </Box>

            {/* Stats row */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                {[
                    { label: 'Total', value: stats.total, color: textColor },
                    { label: '✅ Success', value: stats.success, color: '#2ecc71' },
                    { label: '❌ Failed', value: stats.failed, color: '#e74c3c' },
                    { label: '⏳ Pending', value: stats.pending, color: '#f39c12' },
                    { label: '⚡ Avg Dur', value: `${stats.avgDur}ms`, color: '#4a90e2' },
                ].map((s, i) => (
                    <Box key={i} sx={{ px: 2, py: 0.9, bgcolor: bg, border: `1px solid ${borderColor}`, borderRadius: 1, textAlign: 'center', minWidth: 80 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.15em', color: s.color }}>{s.value}</Typography>
                        <Typography sx={{ fontSize: '0.65em', color: labelColor }}>{s.label}</Typography>
                    </Box>
                ))}
            </Box>

            {/* Filter bar */}
            <Box sx={{ display: 'flex', gap: 1.2, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                <TextField placeholder="Search task ID or agent…" size="small" value={search}
                    onChange={e => setSearch(e.target.value)}
                    sx={{ flexGrow: 1, maxWidth: 280, '& .MuiOutlinedInput-root': { fontSize: '0.8em' } }}
                    InputProps={{ startAdornment: <span style={{ marginRight: 6, color: labelColor }}>🔍</span> }} />
                <FormControl size="small" sx={{ minWidth: 130 }}>
                    <InputLabel sx={{ fontSize: '0.8em' }}>Status</InputLabel>
                    <Select value={statusF} onChange={e => setStatusF(e.target.value)} label="Status" sx={{ fontSize: '0.8em' }}>
                        <MenuItem value="all">All Status</MenuItem>
                        <MenuItem value="success">✅ Success</MenuItem>
                        <MenuItem value="failure">❌ Failure</MenuItem>
                        <MenuItem value="pending">⏳ Pending</MenuItem>
                    </Select>
                </FormControl>
                <FormControl size="small" sx={{ minWidth: 170 }}>
                    <InputLabel sx={{ fontSize: '0.8em' }}>Agent</InputLabel>
                    <Select value={agentF} onChange={e => setAgentF(e.target.value)} label="Agent" sx={{ fontSize: '0.8em' }}>
                        <MenuItem value="all">All Agents</MenuItem>
                        {agents.map(a => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
                    </Select>
                </FormControl>
                <Typography sx={{ ml: 'auto', fontSize: '0.75em', color: labelColor }}>
                    {filtered.length} of {logs.length} records
                </Typography>
            </Box>

            {/* Table */}
            <TableContainer component={Paper}
                sx={{ bgcolor: tableBg, border: `1px solid ${borderColor}`, borderRadius: 1.5 }}>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72em', color: labelColor, textTransform: 'uppercase', letterSpacing: 0.8, bgcolor: headBg }}>
                                Task ID
                            </TableCell>
                            <SortCell col="agent">Agent</SortCell>
                            <SortCell col="status">Status</SortCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72em', color: labelColor, textTransform: 'uppercase', letterSpacing: 0.8, bgcolor: headBg }}>
                                <Tooltip title="Simulated — no real LLM connected in this demo">
                                    <span>Model ℹ</span>
                                </Tooltip>
                            </TableCell>
                            <SortCell col="duration">Duration</SortCell>
                            <SortCell col="time">Time</SortCell>
                            <TableCell sx={{ fontWeight: 700, fontSize: '0.72em', color: labelColor, textTransform: 'uppercase', letterSpacing: 0.8, bgcolor: headBg }} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} sx={{ textAlign: 'center', py: 5, color: labelColor }}>
                                    No logs match your filters.
                                </TableCell>
                            </TableRow>
                        ) : filtered.map(row => {
                            const isExp = expanded === row.task_id;
                            const sc = STATUS_COLORS[row.status] || {};
                            return (
                                <React.Fragment key={row.task_id}>
                                    <TableRow hover onClick={() => setExpanded(isExp ? null : row.task_id)}
                                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: rowHover }, bgcolor: isExp ? (isDark ? '#161826' : '#f4f8ff') : 'transparent' }}>
                                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.75em', color: '#4a90e2' }}>
                                            {row.task_id.substring(0, 8)}…
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.82em', color: textColor }}>{row.agent_name}</TableCell>
                                        <TableCell>
                                            <Chip label={row.status} size="small" color={sc.chip || 'default'}
                                                sx={{ fontSize: '0.68em', height: 20 }} />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.75em', color: labelColor }}>
                                            {row.primary_model_used || '—'}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.82em', fontWeight: 600, color: row.duration_ms ? durColor(row.duration_ms) : labelColor }}>
                                            {row.duration_ms ? `${row.duration_ms}ms` : '—'}
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.75em', color: labelColor, whiteSpace: 'nowrap' }}>
                                            {new Date(row.start_time).toLocaleTimeString()}
                                        </TableCell>
                                        <TableCell sx={{ color: labelColor, fontSize: '0.85em', textAlign: 'right' }}>
                                            <span style={{ transition: 'transform 0.2s', display: 'inline-block', transform: isExp ? 'rotate(180deg)' : 'none' }}>▾</span>
                                        </TableCell>
                                    </TableRow>

                                    {isExp && (
                                        <TableRow>
                                            <TableCell colSpan={7} sx={{ bgcolor: expandBg, p: 0 }}>
                                                <Box sx={{ p: 2 }}>
                                                    <Box sx={{ display: 'flex', gap: 2, mb: 1 }}>
                                                        <Typography sx={{ fontSize: '0.68em', color: labelColor, fontFamily: 'monospace' }}>
                                                            Full ID: {row.task_id}
                                                        </Typography>
                                                        {row.token_usage && (
                                                            <Chip label={`Tokens: ${row.token_usage}`} size="small"
                                                                sx={{ fontSize: '0.65em', height: 20 }} />
                                                        )}
                                                        {row.estimated_cost && (
                                                            <Chip label={`Cost: $${row.estimated_cost.toFixed(4)}`} size="small"
                                                                sx={{ fontSize: '0.65em', height: 20 }} />
                                                        )}
                                                    </Box>
                                                    <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                                                        <Box>
                                                            <Typography sx={{ fontSize: '0.7em', fontWeight: 700, color: '#4a90e2', letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.6 }}>
                                                                📥 Request
                                                            </Typography>
                                                            <Paper sx={{ p: 1.5, bgcolor: isDark ? '#0d0f1e' : '#f8fafc', border: `1px solid ${borderColor}` }}>
                                                                <pre style={{ fontSize: '0.8em', color: isDark ? '#c8cce8' : '#334', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                                                    {fmtPayload(row.request_payload)}
                                                                </pre>
                                                            </Paper>
                                                        </Box>
                                                        <Box>
                                                            <Typography sx={{ fontSize: '0.7em', fontWeight: 700, color: ['success', 'SUCCESS'].includes(row.status) ? '#2ecc71' : '#e74c3c', letterSpacing: 0.8, textTransform: 'uppercase', mb: 0.6 }}>
                                                                {['success', 'SUCCESS'].includes(row.status) ? '📤 Result' : '❌ Error'}
                                                            </Typography>
                                                            <Paper sx={{ p: 1.5, bgcolor: isDark ? '#0d0f1e' : '#f8fafc', border: `1px solid ${borderColor}` }}>
                                                                <pre style={{ fontSize: '0.8em', color: isDark ? '#c8cce8' : '#334', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                                                                    {fmtPayload(row.response_payload)}
                                                                </pre>
                                                            </Paper>
                                                        </Box>
                                                    </Box>
                                                </Box>
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </React.Fragment>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
}
