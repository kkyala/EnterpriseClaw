const {
    Box, Typography, Card, CardContent, CircularProgress, Chip, Paper, Divider,
    TextField, Button, Tooltip, LinearProgress, Select, MenuItem, FormControl, InputLabel
} = MaterialUI;

/* ═══════════════════════════════════════════════════════════════════════
   AGENT COMMUNICATION TAB
   ═══════════════════════════════════════════════════════════════════════
   Sub-views:
     0 — Message Explorer  (inter-agent messages per task)
     1 — Task Trees        (orchestration hierarchy viewer)
     2 — Live Agents       (active execution states)
   ═══════════════════════════════════════════════════════════════════════ */

function AgentComm({ refreshKey, isDark, events }) {
    const [subTab, setSubTab] = React.useState(0);
    const [tasks, setTasks] = React.useState([]);
    const [agents, setAgents] = React.useState([]);
    const [liveStates, setLiveStates] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selectedTask, setSelectedTask] = React.useState(null);
    const [messages, setMessages] = React.useState([]);
    const [taskTree, setTaskTree] = React.useState(null);
    const [msgLoading, setMsgLoad] = React.useState(false);
    const [treeLoading, setTreeLoad] = React.useState(false);
    const [search, setSearch] = React.useState('');

    const bg = isDark ? '#1e2030' : '#ffffff';
    const cardBg = isDark ? '#161826' : '#f8fafc';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const labelColor = isDark ? '#6c7293' : '#64748b';
    const textColor = isDark ? '#c8cce8' : '#1e293b';
    const headBg = isDark ? '#0b0d1a' : '#e8edf5';
    const accentBlue = '#4a90e2';
    const accentGreen = '#2ecc71';
    const accentPurple = '#9b59b6';

    const agentColors = ['#4a90e2', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22', '#3498db', '#6c5ce7', '#00cec9'];
    const getAgentColor = name => agentColors[(name || '').length % agentColors.length];
    const getInit = n => (n || '').split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    // ── Data loading ──
    const loadTasks = React.useCallback(() => {
        setLoading(true);
        Promise.all([
            fetch('/api/task-logs').then(r => r.json()),
            fetch('/api/agents').then(r => r.json()),
        ]).then(([t, a]) => {
            setTasks(t);
            setAgents(a);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, []);

    const loadLiveStates = React.useCallback(() => {
        fetch('/api/agent-states').then(r => r.json()).then(setLiveStates).catch(() => { });
    }, []);

    React.useEffect(() => {
        loadTasks();
        loadLiveStates();
    }, [refreshKey]);

    // Auto-refresh live states every 3s
    React.useEffect(() => {
        const timer = setInterval(loadLiveStates, 3000);
        return () => clearInterval(timer);
    }, []);

    // ── Load messages for a specific task ──
    const loadMessages = async (taskId) => {
        setMsgLoad(true);
        setSelectedTask(taskId);
        try {
            const res = await fetch(`/api/agent-messages/${taskId}`);
            const data = await res.json();
            setMessages(data);
        } catch { setMessages([]); }
        setMsgLoad(false);
    };

    // ── Load task tree ──
    const loadTaskTree = async (taskId) => {
        setTreeLoad(true);
        setSelectedTask(taskId);
        try {
            const res = await fetch(`/api/task-tree/${taskId}`);
            const data = await res.json();
            setTaskTree(data);
        } catch { setTaskTree(null); }
        setTreeLoad(false);
    };

    // ── Filter orchestrated tasks (tasks with sub-tasks or delegation) ──
    const orchestratedTasks = tasks.filter(t => {
        try {
            const payload = JSON.parse(t.request_payload || '{}');
            return !payload.parent_task_id; // Only root tasks
        } catch { return true; }
    });

    const filteredTasks = orchestratedTasks.filter(t =>
    (!search || t.agent_name.toLowerCase().includes(search.toLowerCase())
        || t.task_id.toLowerCase().includes(search.toLowerCase()))
    );

    // Message-type coloring
    const msgTypeColor = (type) => {
        const MAP = {
            delegate: '#f39c12', result: '#2ecc71', broadcast: '#9b59b6',
            info: '#4a90e2', query: '#1abc9c', error: '#e74c3c',
        };
        return MAP[type] || '#6c7293';
    };

    const msgTypeIcon = (type) => {
        const MAP = {
            delegate: '📤', result: '✅', broadcast: '📡',
            info: 'ℹ️', query: '❓', error: '❌',
        };
        return MAP[type] || '💬';
    };

    const statusChip = (status) => {
        const MAP = {
            success: { color: '#2ecc71', bg: '#2ecc7118', label: '✓ Success' },
            SUCCESS: { color: '#2ecc71', bg: '#2ecc7118', label: '✓ Success' },
            failure: { color: '#e74c3c', bg: '#e74c3c18', label: '✗ Failed' },
            FAILURE: { color: '#e74c3c', bg: '#e74c3c18', label: '✗ Failed' },
            QUEUED: { color: '#4a90e2', bg: '#4a90e218', label: '⏳ Queued' },
            PENDING: { color: '#f39c12', bg: '#f39c1218', label: '⏳ Pending' },
            partial_success: { color: '#f39c12', bg: '#f39c1218', label: '⚠ Partial' },
            in_progress: { color: '#f39c12', bg: '#f39c1218', label: '▶ Running' },
        };
        const s = MAP[status] || { color: '#6c7293', bg: '#6c729318', label: status };
        return (
            <Chip size="small" label={s.label}
                sx={{ bgcolor: s.bg, color: s.color, fontWeight: 700, fontSize: '0.68em', height: 22, border: `1px solid ${s.color}44` }} />
        );
    };

    // ── Orchestrator event stats from real-time events ──
    const orchEvents = (events || []).filter(e =>
        e.event_type && (e.event_type.startsWith('ORCHESTRATOR_') || e.event_type.startsWith('EXEC_') || e.event_type.startsWith('AGENT_MESSAGE'))
    );

    const SUB_TABS = [
        { id: 0, label: '💬 Messages', icon: '💬', count: messages.length },
        { id: 1, label: '🌳 Task Trees', icon: '🌳', count: orchestratedTasks.length },
        { id: 2, label: '⚡ Live Agents', icon: '⚡', count: liveStates.length },
    ];

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>;

    return (
        <Box>
            {/* ── Header ── */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1em', color: textColor }}>
                        Agent Communication Hub
                    </Typography>
                    <Chip label={`${orchEvents.length} events`} size="small"
                        sx={{ bgcolor: '#9b59b618', color: '#9b59b6', fontSize: '0.68em', height: 22 }} />
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button size="small" variant="outlined" onClick={() => { loadTasks(); loadLiveStates(); }}
                        sx={{ fontSize: '0.72em', height: 30 }}>
                        🔄 Refresh
                    </Button>
                </Box>
            </Box>

            {/* ── Stats row ── */}
            <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
                {[
                    { label: 'Total Tasks', value: tasks.length, color: textColor, icon: '📋' },
                    { label: 'Orchestrated', value: orchestratedTasks.length, color: accentPurple, icon: '🎯' },
                    { label: 'Active Agents', value: liveStates.length, color: accentGreen, icon: '⚡' },
                    { label: 'Bus Messages', value: orchEvents.filter(e => e.event_type === 'AGENT_MESSAGE_SENT').length, color: '#f39c12', icon: '💬' },
                    { label: 'Delegations', value: orchEvents.filter(e => e.event_type === 'ORCHESTRATOR_SUB_TASK_STARTED').length, color: '#1abc9c', icon: '📤' },
                ].map((s, i) => (
                    <Box key={i} sx={{ px: 2, py: 0.9, bgcolor: bg, border: `1px solid ${borderColor}`, borderRadius: 1, textAlign: 'center', minWidth: 90, position: 'relative', overflow: 'hidden' }}>
                        <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, bgcolor: s.color, opacity: 0.6 }} />
                        <Typography sx={{ fontWeight: 700, fontSize: '1.15em', color: s.color }}>{s.icon} {s.value}</Typography>
                        <Typography sx={{ fontSize: '0.65em', color: labelColor }}>{s.label}</Typography>
                    </Box>
                ))}
            </Box>

            {/* ── Sub Tab Navigation ── */}
            <Box sx={{ display: 'flex', gap: 0.5, mb: 2, borderBottom: `1px solid ${borderColor}`, pb: 0 }}>
                {SUB_TABS.map(tab => (
                    <Box key={tab.id} onClick={() => setSubTab(tab.id)}
                        sx={{
                            px: 2, py: 1, cursor: 'pointer', position: 'relative',
                            color: subTab === tab.id ? accentBlue : labelColor,
                            fontWeight: subTab === tab.id ? 700 : 400,
                            fontSize: '0.82em', transition: 'color 0.15s',
                            '&:hover': { color: textColor },
                            ...(subTab === tab.id ? {
                                '&::after': {
                                    content: '""', position: 'absolute', bottom: -1, left: 0, right: 0,
                                    height: 2, bgcolor: accentBlue, borderRadius: '2px 2px 0 0'
                                }
                            } : {})
                        }}>
                        {tab.label}
                    </Box>
                ))}
            </Box>

            {/* ═══════════ SUB-TAB 0: MESSAGE EXPLORER ═══════════ */}
            {subTab === 0 && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {/* Left: Task list */}
                    <Box sx={{ width: 320, flexShrink: 0 }}>
                        <TextField placeholder="Search tasks…" size="small" value={search}
                            onChange={e => setSearch(e.target.value)} fullWidth
                            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { fontSize: '0.8em' } }}
                            InputProps={{ startAdornment: <span style={{ marginRight: 6, color: labelColor }}>🔍</span> }}
                        />
                        <Box sx={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
                            {filteredTasks.length === 0 ? (
                                <Box sx={{ p: 3, textAlign: 'center' }}>
                                    <Typography sx={{ fontSize: '1.5em', mb: 1 }}>📭</Typography>
                                    <Typography sx={{ color: labelColor, fontSize: '0.82em' }}>No tasks found</Typography>
                                </Box>
                            ) : filteredTasks.slice(0, 50).map(task => {
                                const isSelected = selectedTask === task.task_id;
                                const req = (() => { try { return JSON.parse(task.request_payload || '{}'); } catch { return {}; } })();
                                return (
                                    <Box key={task.task_id} onClick={() => loadMessages(task.task_id)}
                                        sx={{
                                            p: 1.2, mb: 0.8, borderRadius: 1, cursor: 'pointer',
                                            bgcolor: isSelected ? `${accentBlue}18` : 'transparent',
                                            border: `1px solid ${isSelected ? accentBlue : borderColor}`,
                                            transition: 'all 0.15s',
                                            '&:hover': { bgcolor: `${accentBlue}0a`, border: `1px solid ${accentBlue}66` },
                                        }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: getAgentColor(task.agent_name), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                                    <Typography sx={{ color: '#fff', fontSize: '0.55em', fontWeight: 800 }}>{getInit(task.agent_name)}</Typography>
                                                </Box>
                                                <Typography sx={{ fontSize: '0.76em', fontWeight: 600, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 150 }}>
                                                    {task.agent_name}
                                                </Typography>
                                            </Box>
                                            {statusChip(task.status)}
                                        </Box>
                                        <Typography sx={{ fontSize: '0.7em', color: labelColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {req.task || task.task_id.substring(0, 12) + '…'}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.6em', color: labelColor, mt: 0.3 }}>
                                            {new Date(task.start_time).toLocaleString()}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>

                    {/* Right: Message detail */}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        {!selectedTask ? (
                            <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${borderColor}`, borderRadius: 2 }}>
                                <Typography sx={{ fontSize: '2.5em', mb: 1 }}>💬</Typography>
                                <Typography sx={{ color: labelColor, fontSize: '0.9em', fontWeight: 600 }}>Select a task to view inter-agent messages</Typography>
                                <Typography sx={{ color: labelColor, fontSize: '0.75em', mt: 0.5 }}>Messages show the communication flow between agents during orchestration</Typography>
                            </Box>
                        ) : msgLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
                        ) : messages.length === 0 ? (
                            <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${borderColor}`, borderRadius: 2 }}>
                                <Typography sx={{ fontSize: '2em', mb: 1 }}>📭</Typography>
                                <Typography sx={{ color: labelColor, fontSize: '0.85em' }}>No inter-agent messages for this task</Typography>
                                <Typography sx={{ color: labelColor, fontSize: '0.72em', mt: 0.5 }}>Single-agent tasks may not produce delegation messages</Typography>
                            </Box>
                        ) : (
                            <Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
                                    <Typography sx={{ fontSize: '0.85em', fontWeight: 700, color: textColor }}>
                                        {messages.length} Messages — <span style={{ fontFamily: 'monospace', color: accentBlue }}>{selectedTask.substring(0, 12)}…</span>
                                    </Typography>
                                </Box>
                                <Box sx={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
                                    {messages.map((msg, i) => (
                                        <Box key={i} sx={{
                                            display: 'flex', gap: 1.5, mb: 1.5, position: 'relative',
                                            '&::before': i < messages.length - 1 ? {
                                                content: '""', position: 'absolute', left: 17, top: 40, bottom: -12,
                                                width: 2, bgcolor: borderColor
                                            } : {}
                                        }}>
                                            {/* Timeline dot */}
                                            <Box sx={{
                                                width: 36, height: 36, borderRadius: '50%',
                                                bgcolor: `${msgTypeColor(msg.type)}20`, border: `2px solid ${msgTypeColor(msg.type)}`,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, zIndex: 1
                                            }}>
                                                <Typography sx={{ fontSize: '0.85em' }}>{msgTypeIcon(msg.type)}</Typography>
                                            </Box>

                                            {/* Message card */}
                                            <Card sx={{ flexGrow: 1, bgcolor: cardBg, border: `1px solid ${borderColor}`, borderLeft: `3px solid ${msgTypeColor(msg.type)}` }}>
                                                <CardContent sx={{ py: 1.2, px: 1.5, '&:last-child': { pb: 1.2 } }}>
                                                    {/* Header */}
                                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                                            <Chip label={msg.sender} size="small"
                                                                sx={{ bgcolor: getAgentColor(msg.sender), color: '#fff', fontWeight: 700, fontSize: '0.66em', height: 20 }} />
                                                            <Typography sx={{ color: labelColor, fontSize: '0.8em' }}>→</Typography>
                                                            <Chip label={msg.receiver} size="small"
                                                                sx={{ bgcolor: `${getAgentColor(msg.receiver)}22`, color: getAgentColor(msg.receiver), fontWeight: 700, fontSize: '0.66em', height: 20, border: `1px solid ${getAgentColor(msg.receiver)}44` }} />
                                                        </Box>
                                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                            <Chip label={msg.type} size="small"
                                                                sx={{ bgcolor: `${msgTypeColor(msg.type)}18`, color: msgTypeColor(msg.type), fontWeight: 600, fontSize: '0.64em', height: 18 }} />
                                                            <Typography sx={{ fontSize: '0.62em', color: labelColor }}>
                                                                {new Date(msg.timestamp).toLocaleTimeString()}
                                                            </Typography>
                                                        </Box>
                                                    </Box>

                                                    {/* Content */}
                                                    {msg.content && (
                                                        <Paper sx={{ p: 1, bgcolor: isDark ? '#0d0f1e' : '#f0f4ff', border: `1px solid ${borderColor}`, mt: 0.5 }}>
                                                            <pre style={{ fontSize: '0.72em', color: isDark ? '#a8b4e0' : '#334', margin: 0, whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 120, overflow: 'auto' }}>
                                                                {typeof msg.content === 'object' ? JSON.stringify(msg.content, null, 2) : msg.content}
                                                            </pre>
                                                        </Paper>
                                                    )}
                                                </CardContent>
                                            </Card>
                                        </Box>
                                    ))}
                                </Box>
                            </Box>
                        )}
                    </Box>
                </Box>
            )}

            {/* ═══════════ SUB-TAB 1: TASK TREES ═══════════ */}
            {subTab === 1 && (
                <Box sx={{ display: 'flex', gap: 2 }}>
                    {/* Left: Task list */}
                    <Box sx={{ width: 320, flexShrink: 0 }}>
                        <TextField placeholder="Search tasks…" size="small" value={search}
                            onChange={e => setSearch(e.target.value)} fullWidth
                            sx={{ mb: 1.5, '& .MuiOutlinedInput-root': { fontSize: '0.8em' } }}
                            InputProps={{ startAdornment: <span style={{ marginRight: 6, color: labelColor }}>🔍</span> }}
                        />
                        <Box sx={{ maxHeight: 'calc(100vh - 360px)', overflowY: 'auto' }}>
                            {filteredTasks.slice(0, 50).map(task => {
                                const isSelected = selectedTask === task.task_id;
                                const req = (() => { try { return JSON.parse(task.request_payload || '{}'); } catch { return {}; } })();
                                return (
                                    <Box key={task.task_id} onClick={() => loadTaskTree(task.task_id)}
                                        sx={{
                                            p: 1.2, mb: 0.8, borderRadius: 1, cursor: 'pointer',
                                            bgcolor: isSelected ? `${accentPurple}18` : 'transparent',
                                            border: `1px solid ${isSelected ? accentPurple : borderColor}`,
                                            transition: 'all 0.15s',
                                            '&:hover': { bgcolor: `${accentPurple}0a` },
                                        }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
                                            <Typography sx={{ fontSize: '0.76em', fontWeight: 600, color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>
                                                {task.agent_name}
                                            </Typography>
                                            {statusChip(task.status)}
                                        </Box>
                                        <Typography sx={{ fontSize: '0.68em', color: labelColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {req.task || task.task_id.substring(0, 12) + '…'}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>

                    {/* Right: Tree view */}
                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                        {!selectedTask ? (
                            <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${borderColor}`, borderRadius: 2 }}>
                                <Typography sx={{ fontSize: '2.5em', mb: 1 }}>🌳</Typography>
                                <Typography sx={{ color: labelColor, fontSize: '0.9em', fontWeight: 600 }}>Select a task to view its execution tree</Typography>
                                <Typography sx={{ color: labelColor, fontSize: '0.75em', mt: 0.5 }}>See how the Orchestrator decomposed and delegated the task</Typography>
                            </Box>
                        ) : treeLoading ? (
                            <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}><CircularProgress /></Box>
                        ) : !taskTree ? (
                            <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${borderColor}`, borderRadius: 2 }}>
                                <Typography sx={{ fontSize: '2em', mb: 1 }}>🍃</Typography>
                                <Typography sx={{ color: labelColor, fontSize: '0.85em' }}>No tree data available</Typography>
                                <Typography sx={{ color: labelColor, fontSize: '0.72em', mt: 0.5 }}>This task may not have been processed by the Orchestrator yet</Typography>
                            </Box>
                        ) : (
                            <Box>
                                <Typography sx={{ fontSize: '0.85em', fontWeight: 700, color: textColor, mb: 1.5 }}>
                                    Execution Tree — <span style={{ fontFamily: 'monospace', color: accentPurple }}>{selectedTask.substring(0, 12)}…</span>
                                </Typography>
                                <TaskTreeNode node={taskTree} depth={0} isDark={isDark} borderColor={borderColor}
                                    cardBg={cardBg} textColor={textColor} labelColor={labelColor}
                                    getAgentColor={getAgentColor} getInit={getInit} statusChip={statusChip} />
                            </Box>
                        )}
                    </Box>
                </Box>
            )}

            {/* ═══════════ SUB-TAB 2: LIVE AGENTS ═══════════ */}
            {subTab === 2 && (
                <Box>
                    {liveStates.length === 0 ? (
                        <Box sx={{ p: 5, textAlign: 'center', border: `1px dashed ${borderColor}`, borderRadius: 2 }}>
                            <Typography sx={{ fontSize: '2.5em', mb: 1 }}>😴</Typography>
                            <Typography sx={{ color: labelColor, fontSize: '0.9em', fontWeight: 600 }}>No agents are currently executing tasks</Typography>
                            <Typography sx={{ color: labelColor, fontSize: '0.75em', mt: 0.5 }}>Submit a task to see agents working in real-time</Typography>
                        </Box>
                    ) : (
                        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 2 }}>
                            {liveStates.map((state, i) => {
                                const progress = state.max_steps > 0 ? (state.current_step / state.max_steps) * 100 : 0;
                                const stateColorMap = {
                                    thinking: '#4a90e2', acting: '#f39c12', delegating: '#9b59b6',
                                    observing: '#1abc9c', complete: '#2ecc71', failed: '#e74c3c',
                                };
                                const stateColor = stateColorMap[state.status] || '#6c7293';

                                return (
                                    <Card key={i} sx={{
                                        bgcolor: cardBg, border: `1px solid ${borderColor}`,
                                        borderTop: `3px solid ${stateColor}`,
                                        transition: 'box-shadow 0.2s',
                                        '&:hover': { boxShadow: isDark ? '0 6px 24px rgba(0,0,0,0.4)' : '0 6px 20px rgba(0,0,0,0.1)' }
                                    }}>
                                        <CardContent sx={{ py: 1.5, px: 2, '&:last-child': { pb: 1.5 } }}>
                                            {/* Agent info */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                    <Box sx={{
                                                        width: 32, height: 32, borderRadius: '50%',
                                                        bgcolor: getAgentColor(state.agent_name),
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        boxShadow: `0 0 8px ${getAgentColor(state.agent_name)}44`,
                                                    }}>
                                                        <Typography sx={{ color: '#fff', fontSize: '0.6em', fontWeight: 800 }}>
                                                            {getInit(state.agent_name)}
                                                        </Typography>
                                                    </Box>
                                                    <Box>
                                                        <Typography sx={{ fontSize: '0.82em', fontWeight: 700, color: textColor }}>
                                                            {state.agent_name}
                                                        </Typography>
                                                        <Typography sx={{ fontSize: '0.62em', color: labelColor, fontFamily: 'monospace' }}>
                                                            {state.task_id.substring(0, 12)}…
                                                        </Typography>
                                                    </Box>
                                                </Box>
                                                <Chip label={state.status} size="small"
                                                    sx={{
                                                        bgcolor: `${stateColor}18`, color: stateColor,
                                                        fontWeight: 700, fontSize: '0.68em', height: 22,
                                                        border: `1px solid ${stateColor}44`,
                                                        animation: state.status === 'thinking' ? 'pulse 1.5s infinite' : 'none',
                                                    }} />
                                            </Box>

                                            {/* Progress */}
                                            <Box sx={{ mb: 1 }}>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.3 }}>
                                                    <Typography sx={{ fontSize: '0.68em', color: labelColor }}>
                                                        Step {state.current_step} / {state.max_steps}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '0.68em', color: stateColor, fontWeight: 600 }}>
                                                        {progress.toFixed(0)}%
                                                    </Typography>
                                                </Box>
                                                <LinearProgress variant="determinate" value={progress}
                                                    sx={{
                                                        height: 4, borderRadius: 2,
                                                        bgcolor: `${stateColor}18`,
                                                        '& .MuiLinearProgress-bar': { bgcolor: stateColor, borderRadius: 2 }
                                                    }} />
                                            </Box>

                                            {/* Last update */}
                                            <Typography sx={{ fontSize: '0.6em', color: labelColor }}>
                                                Updated: {state.updated_at ? new Date(state.updated_at).toLocaleTimeString() : '—'}
                                            </Typography>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </Box>
                    )}

                    {/* Recent Orchestrator Events (real-time feed) */}
                    <Box sx={{ mt: 3 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.9em', color: textColor, mb: 1.5 }}>
                            🔴 Live Event Feed
                        </Typography>
                        <Box sx={{ maxHeight: 300, overflowY: 'auto', border: `1px solid ${borderColor}`, borderRadius: 1.5 }}>
                            {orchEvents.length === 0 ? (
                                <Box sx={{ p: 3, textAlign: 'center' }}>
                                    <Typography sx={{ color: labelColor, fontSize: '0.82em' }}>No orchestration events yet</Typography>
                                </Box>
                            ) : orchEvents.slice(0, 50).map((evt, i) => {
                                const evtColors = {
                                    ORCHESTRATOR_STARTED: '#9b59b6', ORCHESTRATOR_COMPLETED: '#2ecc71',
                                    ORCHESTRATOR_ANALYZING: '#f39c12', ORCHESTRATOR_PLAN_READY: '#4a90e2',
                                    ORCHESTRATOR_SUB_TASK_STARTED: '#1abc9c', ORCHESTRATOR_SUB_TASK_COMPLETED: '#2ecc71',
                                    EXEC_LOOP_STARTED: '#4a90e2', EXEC_STEP_THINKING: '#6c5ce7',
                                    EXEC_STEP_ACTING: '#f39c12', EXEC_STEP_FINAL: '#2ecc71',
                                    AGENT_MESSAGE_SENT: '#e67e22', AGENT_BROADCAST: '#9b59b6',
                                };
                                const evtColor = evtColors[evt.event_type] || '#6c7293';
                                return (
                                    <Box key={i} sx={{
                                        display: 'flex', alignItems: 'center', gap: 1.5, px: 2, py: 0.8,
                                        borderBottom: `1px solid ${borderColor}`,
                                        '&:hover': { bgcolor: `${evtColor}08` }, transition: 'bgcolor 0.1s',
                                    }}>
                                        <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: evtColor, flexShrink: 0, boxShadow: `0 0 4px ${evtColor}` }} />
                                        <Typography sx={{ fontSize: '0.72em', fontWeight: 600, color: evtColor, minWidth: 200, flexShrink: 0, fontFamily: 'monospace' }}>
                                            {evt.event_type}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.68em', color: labelColor, flexGrow: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {evt.task_id ? `task: ${evt.task_id.substring(0, 8)}…` : ''}{' '}
                                            {evt.agent_name || evt.persona_name || evt.target_agent || ''}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.6em', color: labelColor, flexShrink: 0, fontFamily: 'monospace' }}>
                                            {evt.timestamp ? new Date(evt.timestamp * 1000).toLocaleTimeString() : ''}
                                        </Typography>
                                    </Box>
                                );
                            })}
                        </Box>
                    </Box>
                </Box>
            )}
        </Box>
    );
}

/* ── TaskTreeNode — recursive tree renderer ── */
function TaskTreeNode({ node, depth, isDark, borderColor, cardBg, textColor, labelColor, getAgentColor, getInit, statusChip }) {
    const [open, setOpen] = React.useState(depth < 2);
    if (!node) return null;

    const isRoot = depth === 0;
    const hasChildren = node.sub_tasks && node.sub_tasks.length > 0;
    const indent = depth * 32;
    const lineColor = isDark ? '#2d3047' : '#d0d8e0';

    // Handle both flat and nested tree formats
    const taskId = node.task_id || '';
    const agentName = node.agent_name || '';
    const status = node.status || '';
    const durationMs = node.duration_ms || 0;
    const delegatedBy = node.delegated_by || '';

    return (
        <Box>
            <Box sx={{
                display: 'flex', alignItems: 'center', gap: 1, ml: `${indent}px`,
                mb: 1, position: 'relative',
            }}>
                {/* Connection line */}
                {depth > 0 && (
                    <Box sx={{
                        position: 'absolute', left: -16, top: '50%', width: 12, height: 2, bgcolor: lineColor
                    }} />
                )}

                {/* Expand/collapse */}
                {hasChildren && (
                    <Box onClick={() => setOpen(!open)} sx={{
                        width: 20, height: 20, borderRadius: '50%', bgcolor: isDark ? '#2d3047' : '#e2e8f0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                        fontSize: '0.65em', color: labelColor, flexShrink: 0, transition: 'transform 0.2s',
                        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
                        '&:hover': { bgcolor: isDark ? '#3d4057' : '#d2d8e0' },
                    }}>
                        ▶
                    </Box>
                )}
                {!hasChildren && <Box sx={{ width: 20, flexShrink: 0 }} />}

                {/* Node card */}
                <Card sx={{
                    flexGrow: 1, bgcolor: cardBg, border: `1px solid ${borderColor}`,
                    borderLeft: `3px solid ${getAgentColor(agentName)}`,
                    ...(isRoot ? { boxShadow: isDark ? '0 4px 16px rgba(0,0,0,0.3)' : '0 4px 12px rgba(0,0,0,0.1)' } : {}),
                }}>
                    <CardContent sx={{ py: 1, px: 1.5, '&:last-child': { pb: 1 } }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                <Box sx={{ width: 24, height: 24, borderRadius: '50%', bgcolor: getAgentColor(agentName), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    <Typography sx={{ color: '#fff', fontSize: '0.5em', fontWeight: 800 }}>{getInit(agentName)}</Typography>
                                </Box>
                                <Box>
                                    <Typography sx={{ fontSize: '0.78em', fontWeight: 600, color: textColor }}>{agentName}</Typography>
                                    <Typography sx={{ fontSize: '0.58em', color: labelColor, fontFamily: 'monospace' }}>
                                        {taskId.substring(0, 12)}… {delegatedBy ? `← ${delegatedBy}` : isRoot ? '(root)' : ''}
                                    </Typography>
                                </Box>
                            </Box>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                {durationMs > 0 && (
                                    <Typography sx={{ fontSize: '0.68em', color: labelColor }}>{durationMs}ms</Typography>
                                )}
                                {statusChip(status)}
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            </Box>

            {/* Children */}
            {open && hasChildren && (
                <Box sx={{
                    ml: `${indent + 10}px`, pl: 2,
                    borderLeft: `2px solid ${lineColor}`,
                }}>
                    {node.sub_tasks.map((child, i) => (
                        <TaskTreeNode key={child.task_id || i} node={child} depth={depth + 1}
                            isDark={isDark} borderColor={borderColor} cardBg={cardBg}
                            textColor={textColor} labelColor={labelColor}
                            getAgentColor={getAgentColor} getInit={getInit} statusChip={statusChip} />
                    ))}
                </Box>
            )}
        </Box>
    );
}
