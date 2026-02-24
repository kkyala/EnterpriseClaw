const {
    Box, Typography, CircularProgress, Chip, Divider,
    Select, MenuItem, FormControl, InputLabel, Button, TextField, Paper
} = MaterialUI;

function Memory({ selectedAgent, isDark }) {
    const [agents, setAgents]     = React.useState([]);
    const [agent, setAgent]       = React.useState('');
    const [memories, setMemories] = React.useState([]);
    const [loading, setLoading]   = React.useState(false);
    const [roleFilter, setRole]   = React.useState('all');
    const scrollRef               = React.useRef(null);

    const bg          = isDark ? '#1e2030' : '#ffffff';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const labelColor  = isDark ? '#6c7293' : '#64748b';
    const textColor   = isDark ? '#c8cce8' : '#1e293b';

    // Fetch agent list on mount
    React.useEffect(() => {
        fetch('/api/agents').then(r => r.json()).then(d => {
            setAgents(d);
            const initial = selectedAgent || (d.length > 0 ? d[0].name : '');
            setAgent(initial);
        }).catch(console.error);
    }, []);

    // Sync with sidebar selection
    React.useEffect(() => {
        if (selectedAgent) setAgent(selectedAgent);
    }, [selectedAgent]);

    // Fetch memories when agent changes
    React.useEffect(() => {
        if (!agent) return;
        setLoading(true);
        fetch(`/api/memories/${encodeURIComponent(agent)}`)
            .then(r => r.json())
            .then(d => { setMemories(d); setLoading(false); })
            .catch(() => setLoading(false));
    }, [agent]);

    // Auto-scroll to bottom when memories load
    React.useEffect(() => {
        if (scrollRef.current && memories.length > 0) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [memories]);

    const ROLES = ['all', 'user', 'assistant', 'system'];
    const ROLE_STYLE = {
        user:      { bg: '#4a90e2', label: 'User',   bubble: isDark ? '#1a2540' : '#dbeafe', border: '#4a90e244' },
        assistant: { bg: '#2ecc71', label: 'Agent',  bubble: isDark ? '#1a3020' : '#dcfce7', border: '#2ecc7144' },
        system:    { bg: '#9b59b6', label: 'System', bubble: isDark ? '#21153a' : '#f3e8ff', border: '#9b59b644' },
    };

    const filtered = roleFilter === 'all' ? memories : memories.filter(m => m.role === roleFilter);
    const counts   = {};
    ROLES.forEach(r => { counts[r] = r === 'all' ? memories.length : memories.filter(m => m.role === r).length; });

    const agentColors = ['#4a90e2','#2ecc71','#e74c3c','#f39c12','#9b59b6','#1abc9c'];
    const agentColor  = agents.length > 0 ? agentColors[agent.length % agentColors.length] : '#4a90e2';
    const agentInit   = agent ? agent.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??';

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    {agent && (
                        <Box sx={{
                            width: 36, height: 36, borderRadius: '50%', bgcolor: agentColor,
                            display: 'flex', alignItems: 'center', justifyContent: 'center'
                        }}>
                            <Typography sx={{ color: '#fff', fontSize: '0.7em', fontWeight: 800 }}>{agentInit}</Typography>
                        </Box>
                    )}
                    <Box>
                        <Typography sx={{ fontWeight: 700, fontSize: '1.1em', color: textColor, lineHeight: 1 }}>
                            Agent Memory Store
                        </Typography>
                        {agent && (
                            <Typography sx={{ fontSize: '0.72em', color: labelColor }}>{agent}</Typography>
                        )}
                    </Box>
                </Box>
                <FormControl size="small" sx={{ minWidth: 220 }}>
                    <InputLabel>Select Agent</InputLabel>
                    <Select value={agent} onChange={e => setAgent(e.target.value)} label="Select Agent">
                        {agents.map(a => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
                    </Select>
                </FormControl>
            </Box>

            {!agent ? (
                <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <Typography sx={{ fontSize: '3em', mb: 1 }}>🧠</Typography>
                    <Typography sx={{ color: labelColor }}>Select an agent above to view their memory</Typography>
                </Box>
            ) : loading ? (
                <Box sx={{ flexGrow: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    <CircularProgress />
                </Box>
            ) : (
                <>
                    {/* Memory stats + role filter */}
                    <Box sx={{ display: 'flex', gap: 0.8, mb: 1.5, flexWrap: 'wrap', flexShrink: 0 }}>
                        {ROLES.map(r => (
                            <Box key={r} onClick={() => setRole(r)}
                                sx={{
                                    px: 1.3, py: 0.4, borderRadius: 1, cursor: 'pointer',
                                    fontSize: '0.72em', fontWeight: 600,
                                    display: 'flex', alignItems: 'center', gap: 0.5,
                                    bgcolor: roleFilter === r ? (ROLE_STYLE[r]?.bg || '#4a90e2') : (isDark ? '#1e2030' : '#e2e8f0'),
                                    color: roleFilter === r ? '#fff' : labelColor,
                                    border: `1px solid ${roleFilter === r ? 'transparent' : borderColor}`,
                                    transition: 'all 0.15s',
                                }}>
                                {r === 'all' ? '🗃 All' : r === 'user' ? '👤 User' : r === 'assistant' ? '🤖 Agent' : '⚙️ System'}
                                <span style={{
                                    background: 'rgba(255,255,255,0.2)', borderRadius: 4,
                                    padding: '0 5px', fontSize: '0.88em', minWidth: 18, textAlign: 'center'
                                }}>
                                    {counts[r]}
                                </span>
                            </Box>
                        ))}
                        <Button size="small" onClick={() => {
                            setLoading(true);
                            fetch(`/api/memories/${encodeURIComponent(agent)}`).then(r => r.json()).then(d => { setMemories(d); setLoading(false); });
                        }} sx={{ ml: 'auto', fontSize: '0.7em', height: 28 }} variant="outlined">
                            🔄 Refresh
                        </Button>
                    </Box>

                    {/* Memory conversation / empty state */}
                    {filtered.length === 0 ? (
                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px solid ${borderColor}`, borderRadius: 1.5 }}>
                            <Typography sx={{ fontSize: '2.5em', mb: 1 }}>📭</Typography>
                            <Typography sx={{ color: labelColor, fontWeight: 600 }}>
                                {memories.length === 0
                                    ? `No memory entries for ${agent} yet.`
                                    : `No ${roleFilter} messages.`}
                            </Typography>
                            <Typography sx={{ color: labelColor, fontSize: '0.8em', mt: 0.5 }}>
                                Memories are created as the agent processes tasks.
                            </Typography>
                        </Box>
                    ) : (
                        <Box ref={scrollRef} sx={{
                            flexGrow: 1, overflowY: 'auto',
                            border: `1px solid ${borderColor}`, borderRadius: 1.5,
                            p: 2, bgcolor: isDark ? '#0d0f1e' : '#f8fafc',
                            display: 'flex', flexDirection: 'column', gap: 1.2
                        }}>
                            {filtered.map((mem, i) => {
                                const style   = ROLE_STYLE[mem.role] || { bg: '#888', label: mem.role, bubble: isDark ? '#1e2030' : '#f5f5f5', border: '#88888844' };
                                const isRight = mem.role === 'assistant';
                                const initials = style.label.substring(0, 1);

                                return (
                                    <Box key={mem.id || i} sx={{
                                        display: 'flex', gap: 1,
                                        flexDirection: isRight ? 'row-reverse' : 'row',
                                        alignItems: 'flex-end'
                                    }}>
                                        {/* Avatar */}
                                        <Box sx={{
                                            width: 28, height: 28, borderRadius: '50%', bgcolor: style.bg,
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            flexShrink: 0, fontSize: '0.65em', color: '#fff', fontWeight: 800, mb: 0.3
                                        }}>
                                            {initials}
                                        </Box>
                                        {/* Bubble */}
                                        <Box sx={{
                                            maxWidth: '72%', p: '10px 14px',
                                            bgcolor: style.bubble,
                                            border: `1px solid ${style.border}`,
                                            borderRadius: isRight ? '14px 4px 14px 14px' : '4px 14px 14px 14px',
                                        }}>
                                            <Typography sx={{ fontSize: '0.84em', color: textColor, lineHeight: 1.55 }}>
                                                {mem.content}
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.62em', color: labelColor, mt: 0.5 }}>
                                                {style.label} · {new Date(mem.timestamp).toLocaleString()}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}
                </>
            )}
        </Box>
    );
}
