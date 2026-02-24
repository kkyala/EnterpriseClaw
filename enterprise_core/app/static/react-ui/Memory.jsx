const {
    Box, Typography, CircularProgress, Chip, Divider,
    Select, MenuItem, FormControl, InputLabel, Button, TextField, Paper,
    Dialog, DialogTitle, DialogContent, DialogActions, Grid, Tooltip
} = MaterialUI;

const KNOWLEDGE_TYPES = ['all', 'skill_result', 'tool_usage', 'pattern', 'preference', 'fact'];
const KT_ICONS = { skill_result: '🎯', tool_usage: '🔧', pattern: '📐', preference: '💡', fact: '📋' };
const KT_COLORS = { skill_result: '#9b59b6', tool_usage: '#2ecc71', pattern: '#f39c12', preference: '#e74c3c', fact: '#4a90e2' };

function Memory({ selectedAgent, isDark }) {
    const [agents, setAgents] = React.useState([]);
    const [agent, setAgent] = React.useState('');
    const [memories, setMemories] = React.useState([]);
    const [knowledge, setKnowledge] = React.useState([]);
    const [loading, setLoading] = React.useState(false);
    const [roleFilter, setRole] = React.useState('all');
    const [kTypeFilter, setKTypeFilter] = React.useState('all');
    const [kSearch, setKSearch] = React.useState('');
    const [viewMode, setViewMode] = React.useState('conversations'); // 'conversations' | 'knowledge'
    const [addKnowledgeOpen, setAddKnowledgeOpen] = React.useState(false);
    const [newKnowledge, setNewKnowledge] = React.useState({
        knowledge_type: 'fact', topic: '', content: '', confidence: 0.8
    });
    const scrollRef = React.useRef(null);

    const bg = isDark ? '#1e2030' : '#ffffff';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const labelColor = isDark ? '#6c7293' : '#64748b';
    const textColor = isDark ? '#c8cce8' : '#1e293b';
    const cardBg = isDark ? '#252840' : '#f8fafc';

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

    // Fetch memories and knowledge when agent changes
    React.useEffect(() => {
        if (!agent) return;
        setLoading(true);
        Promise.all([
            fetch(`/api/memories/${encodeURIComponent(agent)}`).then(r => r.ok ? r.json() : []).catch(() => []),
            fetch(`/api/agent-knowledge?agent_name=${encodeURIComponent(agent)}`).then(r => r.ok ? r.json() : []).catch(() => []),
        ]).then(([m, k]) => {
            setMemories(m);
            setKnowledge(k);
            setLoading(false);
        }).catch(() => setLoading(false));
    }, [agent]);

    // Auto-scroll to bottom when memories load
    React.useEffect(() => {
        if (scrollRef.current && memories.length > 0 && viewMode === 'conversations') {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [memories, viewMode]);

    const ROLES = ['all', 'user', 'assistant', 'system'];
    const ROLE_STYLE = {
        user: { bg: '#4a90e2', label: 'User', bubble: isDark ? '#1a2540' : '#dbeafe', border: '#4a90e244' },
        assistant: { bg: '#2ecc71', label: 'Agent', bubble: isDark ? '#1a3020' : '#dcfce7', border: '#2ecc7144' },
        system: { bg: '#9b59b6', label: 'System', bubble: isDark ? '#21153a' : '#f3e8ff', border: '#9b59b644' },
    };

    const filtered = roleFilter === 'all' ? memories : memories.filter(m => m.role === roleFilter);
    const counts = {};
    ROLES.forEach(r => { counts[r] = r === 'all' ? memories.length : memories.filter(m => m.role === r).length; });

    // Knowledge filtering
    const filteredKnowledge = knowledge
        .filter(k => kTypeFilter === 'all' || k.knowledge_type === kTypeFilter)
        .filter(k => !kSearch || k.topic?.toLowerCase().includes(kSearch.toLowerCase()) || k.content?.toLowerCase().includes(kSearch.toLowerCase()));

    const agentColors = ['#4a90e2', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c'];
    const agentColor = agents.length > 0 ? agentColors[agent.length % agentColors.length] : '#4a90e2';
    const agentInit = agent ? agent.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase() : '??';

    const handleAddKnowledge = () => {
        if (!agent || !newKnowledge.topic.trim() || !newKnowledge.content.trim()) return;
        fetch('/api/agent-knowledge', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newKnowledge, agent_name: agent })
        }).then(r => {
            if (r.ok) {
                setAddKnowledgeOpen(false);
                setNewKnowledge({ knowledge_type: 'fact', topic: '', content: '', confidence: 0.8 });
                // Refresh knowledge
                fetch(`/api/agent-knowledge?agent_name=${encodeURIComponent(agent)}`)
                    .then(r => r.json()).then(setKnowledge).catch(() => { });
            }
        });
    };

    const handleDeleteKnowledge = (id) => {
        fetch(`/api/agent-knowledge/${id}`, { method: 'DELETE' }).then(() => {
            setKnowledge(prev => prev.filter(k => k.id !== id));
        });
    };

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
                            Agent Memory & Knowledge
                        </Typography>
                        {agent && (
                            <Typography sx={{ fontSize: '0.72em', color: labelColor }}>
                                {agent} · {memories.length} memories · {knowledge.length} knowledge items
                            </Typography>
                        )}
                    </Box>
                </Box>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {/* View mode toggle */}
                    <Box sx={{ display: 'flex', borderRadius: 1.5, overflow: 'hidden', border: `1px solid ${borderColor}` }}>
                        {[
                            { key: 'conversations', label: '💬 Memory', count: memories.length },
                            { key: 'knowledge', label: '🧠 Knowledge', count: knowledge.length },
                        ].map(v => (
                            <Box key={v.key} onClick={() => setViewMode(v.key)}
                                sx={{
                                    px: 1.3, py: 0.4, cursor: 'pointer',
                                    fontSize: '0.75em', fontWeight: 600,
                                    bgcolor: viewMode === v.key ? '#4a90e2' : 'transparent',
                                    color: viewMode === v.key ? '#fff' : labelColor,
                                    display: 'flex', alignItems: 'center', gap: 0.5,
                                }}>
                                {v.label}
                                <span style={{
                                    background: 'rgba(255,255,255,0.2)', borderRadius: 4,
                                    padding: '0 5px', fontSize: '0.88em',
                                }}>{v.count}</span>
                            </Box>
                        ))}
                    </Box>
                    <FormControl size="small" sx={{ minWidth: 200 }}>
                        <InputLabel>Select Agent</InputLabel>
                        <Select value={agent} onChange={e => setAgent(e.target.value)} label="Select Agent">
                            {agents.map(a => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                </Box>
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
            ) : viewMode === 'conversations' ? (
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
                                const style = ROLE_STYLE[mem.role] || { bg: '#888', label: mem.role, bubble: isDark ? '#1e2030' : '#f5f5f5', border: '#88888844' };
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
            ) : (
                /* ═══ Knowledge View ═══ */
                <>
                    {/* Knowledge filter bar */}
                    <Box sx={{ display: 'flex', gap: 0.8, mb: 1.5, flexWrap: 'wrap', flexShrink: 0, alignItems: 'center' }}>
                        {KNOWLEDGE_TYPES.map(t => (
                            <Box key={t} onClick={() => setKTypeFilter(t)}
                                sx={{
                                    px: 1.3, py: 0.4, borderRadius: 1, cursor: 'pointer',
                                    fontSize: '0.72em', fontWeight: 600,
                                    bgcolor: kTypeFilter === t ? (KT_COLORS[t] || '#4a90e2') : (isDark ? '#1e2030' : '#e2e8f0'),
                                    color: kTypeFilter === t ? '#fff' : labelColor,
                                    border: `1px solid ${kTypeFilter === t ? 'transparent' : borderColor}`,
                                }}>
                                {t === 'all' ? '🗃 All' : `${KT_ICONS[t]} ${t.replace('_', ' ')}`}
                            </Box>
                        ))}
                        <TextField size="small" placeholder="Search knowledge..." value={kSearch}
                            onChange={e => setKSearch(e.target.value)}
                            sx={{ ml: 'auto', width: 180, '& .MuiOutlinedInput-root': { fontSize: '0.82em' } }} />
                        <Button size="small" variant="contained" onClick={() => setAddKnowledgeOpen(true)}
                            sx={{ textTransform: 'none', fontWeight: 700, fontSize: '0.75em', background: 'linear-gradient(135deg, #4a90e2, #9b59b6)' }}>
                            + Add Knowledge
                        </Button>
                    </Box>

                    {/* Knowledge cards */}
                    {filteredKnowledge.length === 0 ? (
                        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: `1px solid ${borderColor}`, borderRadius: 1.5 }}>
                            <Typography sx={{ fontSize: '2.5em', mb: 1 }}>🧠</Typography>
                            <Typography sx={{ color: labelColor, fontWeight: 600 }}>No knowledge entries yet</Typography>
                            <Typography sx={{ color: labelColor, fontSize: '0.8em', mt: 0.5 }}>
                                Knowledge is accumulated as agents learn from tasks and tool usage.
                            </Typography>
                        </Box>
                    ) : (
                        <Box sx={{ flexGrow: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {filteredKnowledge.map(k => {
                                const kColor = KT_COLORS[k.knowledge_type] || '#4a90e2';
                                const kIcon = KT_ICONS[k.knowledge_type] || '📋';
                                return (
                                    <Box key={k.id} sx={{
                                        bgcolor: cardBg, border: `1px solid ${borderColor}`, borderRadius: 1.5,
                                        borderLeft: `3px solid ${kColor}`, p: '10px 14px',
                                        transition: 'all 0.15s',
                                        '&:hover': { borderColor: kColor },
                                    }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <Box sx={{ flex: 1, minWidth: 0 }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8, mb: 0.3 }}>
                                                    <Typography sx={{ fontWeight: 700, fontSize: '0.88em', color: textColor }}>
                                                        {kIcon} {k.topic}
                                                    </Typography>
                                                    <Chip label={k.knowledge_type.replace('_', ' ')} size="small"
                                                        sx={{ height: 18, fontSize: '0.6em', fontWeight: 600, bgcolor: `${kColor}22`, color: kColor }} />
                                                </Box>
                                                <Typography sx={{ fontSize: '0.78em', color: textColor, lineHeight: 1.5, mt: 0.3 }}>
                                                    {k.content}
                                                </Typography>
                                            </Box>
                                            <Tooltip title="Delete">
                                                <Box onClick={() => handleDeleteKnowledge(k.id)}
                                                    sx={{ cursor: 'pointer', fontSize: '0.75em', ml: 1, flexShrink: 0, '&:hover': { color: '#e74c3c' } }}>✕</Box>
                                            </Tooltip>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 1.5, mt: 0.8 }}>
                                            <Typography sx={{ fontSize: '0.65em', color: labelColor }}>
                                                Confidence: <strong style={{ color: k.confidence >= 0.7 ? '#2ecc71' : '#f39c12' }}>
                                                    {(k.confidence * 100).toFixed(0)}%
                                                </strong>
                                            </Typography>
                                            <Typography sx={{ fontSize: '0.65em', color: labelColor }}>
                                                Used: <strong>{k.usage_count}×</strong>
                                            </Typography>
                                            {k.source_task_id && (
                                                <Typography sx={{ fontSize: '0.65em', color: labelColor }}>
                                                    Source: <strong>{k.source_task_id.substring(0, 8)}…</strong>
                                                </Typography>
                                            )}
                                            <Typography sx={{ fontSize: '0.65em', color: labelColor, ml: 'auto' }}>
                                                {new Date(k.created_at).toLocaleDateString()}
                                            </Typography>
                                        </Box>
                                    </Box>
                                );
                            })}
                        </Box>
                    )}

                    {/* Add Knowledge Dialog */}
                    <Dialog open={addKnowledgeOpen} onClose={() => setAddKnowledgeOpen(false)} maxWidth="sm" fullWidth
                        PaperProps={{ sx: { bgcolor: isDark ? '#252840' : '#fff', borderRadius: 2 } }}>
                        <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05em', borderBottom: `1px solid ${borderColor}`, pb: 1.5 }}>
                            🧠 Add Knowledge for {agent}
                        </DialogTitle>
                        <DialogContent sx={{ pt: '16px !important' }}>
                            <FormControl fullWidth size="small" sx={{ mb: 2 }}>
                                <InputLabel>Knowledge Type</InputLabel>
                                <Select value={newKnowledge.knowledge_type} label="Knowledge Type"
                                    onChange={e => setNewKnowledge({ ...newKnowledge, knowledge_type: e.target.value })}>
                                    {KNOWLEDGE_TYPES.filter(t => t !== 'all').map(t => (
                                        <MenuItem key={t} value={t}>{KT_ICONS[t]} {t.replace('_', ' ')}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <TextField fullWidth label="Topic" value={newKnowledge.topic}
                                onChange={e => setNewKnowledge({ ...newKnowledge, topic: e.target.value })}
                                size="small" sx={{ mb: 2 }} placeholder="e.g. Invoice Processing, Compliance Rules" />
                            <TextField fullWidth label="Content" value={newKnowledge.content}
                                onChange={e => setNewKnowledge({ ...newKnowledge, content: e.target.value })}
                                size="small" multiline rows={3} sx={{ mb: 2 }}
                                placeholder="The knowledge content the agent should remember..." />
                            <TextField fullWidth label="Confidence (0.0–1.0)" type="number"
                                value={newKnowledge.confidence}
                                onChange={e => setNewKnowledge({ ...newKnowledge, confidence: parseFloat(e.target.value) || 0.5 })}
                                size="small" inputProps={{ step: 0.1, min: 0, max: 1 }} />
                        </DialogContent>
                        <DialogActions sx={{ px: 3, pb: 2 }}>
                            <Button onClick={() => setAddKnowledgeOpen(false)} size="small">Cancel</Button>
                            <Button onClick={handleAddKnowledge} variant="contained" size="small"
                                disabled={!newKnowledge.topic.trim() || !newKnowledge.content.trim()}
                                sx={{ textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #4a90e2, #9b59b6)' }}>
                                Save Knowledge
                            </Button>
                        </DialogActions>
                    </Dialog>
                </>
            )}
        </Box>
    );
}
