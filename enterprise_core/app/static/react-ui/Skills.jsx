const {
    Box, Typography, Card, CardContent, Chip, Button, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
    InputLabel, IconButton, CircularProgress, Grid, Switch, FormControlLabel,
    Tooltip, LinearProgress
} = MaterialUI;

const SKILL_CATEGORIES = [
    { key: 'all', label: '🗃 All', color: '#4a90e2' },
    { key: 'reasoning', label: '🧠 Reasoning', color: '#9b59b6' },
    { key: 'analysis', label: '📊 Analysis', color: '#2ecc71' },
    { key: 'communication', label: '💬 Communication', color: '#f39c12' },
    { key: 'coding', label: '💻 Coding', color: '#e74c3c' },
    { key: 'general', label: '⚙️ General', color: '#1abc9c' },
];

const PROFICIENCY_LEVELS = ['basic', 'intermediate', 'expert'];
const PROFICIENCY_COLORS = { basic: '#f39c12', intermediate: '#4a90e2', expert: '#2ecc71' };
const PROFICIENCY_ICONS = { basic: '⭐', intermediate: '⭐⭐', expert: '⭐⭐⭐' };

function Skills({ isDark, refreshKey }) {
    const [skills, setSkills] = React.useState([]);
    const [agents, setAgents] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [categoryFilter, setCategoryFilter] = React.useState('all');
    const [search, setSearch] = React.useState('');
    const [createOpen, setCreateOpen] = React.useState(false);
    const [assignOpen, setAssignOpen] = React.useState(false);
    const [selectedSkill, setSelectedSkill] = React.useState(null);
    const [newSkill, setNewSkill] = React.useState({ name: '', description: '', category: 'general', proficiency_level: 'intermediate' });
    const [assignAgent, setAssignAgent] = React.useState('');

    const bg = isDark ? '#1e2030' : '#ffffff';
    const cardBg = isDark ? '#252840' : '#f8fafc';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const textColor = isDark ? '#c8cce8' : '#1e293b';
    const labelColor = isDark ? '#6c7293' : '#64748b';

    const loadData = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/skills').then(r => r.json()),
            fetch('/api/agents').then(r => r.json()),
        ]).then(([s, a]) => {
            setSkills(s);
            setAgents(a);
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    React.useEffect(loadData, [refreshKey]);

    const filtered = skills.filter(s => {
        if (categoryFilter !== 'all' && s.category !== categoryFilter) return false;
        if (search && !s.name.toLowerCase().includes(search.toLowerCase()) && !s.description?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const handleCreate = () => {
        fetch('/api/skills', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newSkill)
        }).then(r => {
            if (r.ok) {
                setCreateOpen(false);
                setNewSkill({ name: '', description: '', category: 'general', proficiency_level: 'intermediate' });
                loadData();
            }
        });
    };

    const handleAssign = () => {
        if (!assignAgent || !selectedSkill) return;
        fetch(`/api/agents/${encodeURIComponent(assignAgent)}/skills`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify([selectedSkill.name])
        }).then(r => {
            if (r.ok) { setAssignOpen(false); setAssignAgent(''); loadData(); }
        });
    };

    const handleDelete = (skillId) => {
        if (!confirm('Delete this skill?')) return;
        fetch(`/api/skills/${skillId}`, { method: 'DELETE' }).then(() => loadData());
    };

    const handleUnassign = (agentName, skillName) => {
        fetch(`/api/agents/${encodeURIComponent(agentName)}/skills/${encodeURIComponent(skillName)}`, { method: 'DELETE' })
            .then(() => loadData());
    };

    const catCounts = {};
    SKILL_CATEGORIES.forEach(c => {
        catCounts[c.key] = c.key === 'all' ? skills.length : skills.filter(s => s.category === c.key).length;
    });

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
                <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.3em', color: textColor, display: 'flex', alignItems: 'center', gap: 1 }}>
                        🎯 Skills Registry
                    </Typography>
                    <Typography sx={{ fontSize: '0.78em', color: labelColor }}>
                        {skills.length} skills registered · {skills.reduce((acc, s) => acc + (s.agent_count || 0), 0)} agent assignments
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="Search skills..." value={search} onChange={e => setSearch(e.target.value)}
                        sx={{ width: 220, '& .MuiOutlinedInput-root': { fontSize: '0.82em' } }} />
                    <Button variant="contained" size="small" onClick={() => setCreateOpen(true)}
                        sx={{ textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #4a90e2, #9b59b6)', fontSize: '0.82em' }}>
                        + New Skill
                    </Button>
                </Box>
            </Box>

            {/* Category Filter */}
            <Box sx={{ display: 'flex', gap: 0.8, mb: 2, flexWrap: 'wrap', flexShrink: 0 }}>
                {SKILL_CATEGORIES.map(c => (
                    <Box key={c.key} onClick={() => setCategoryFilter(c.key)}
                        sx={{
                            px: 1.5, py: 0.5, borderRadius: 1.5, cursor: 'pointer',
                            fontSize: '0.75em', fontWeight: 600,
                            display: 'flex', alignItems: 'center', gap: 0.5,
                            bgcolor: categoryFilter === c.key ? c.color : (isDark ? '#1e2030' : '#e2e8f0'),
                            color: categoryFilter === c.key ? '#fff' : labelColor,
                            border: `1px solid ${categoryFilter === c.key ? 'transparent' : borderColor}`,
                            transition: 'all 0.15s', '&:hover': { transform: 'translateY(-1px)' }
                        }}>
                        {c.label}
                        <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '0 6px', fontSize: '0.9em' }}>
                            {catCounts[c.key]}
                        </span>
                    </Box>
                ))}
            </Box>

            {/* Skills Grid */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {filtered.length === 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60%' }}>
                        <Typography sx={{ fontSize: '3em', mb: 1 }}>🎯</Typography>
                        <Typography sx={{ color: labelColor, fontWeight: 600 }}>No skills found</Typography>
                        <Typography sx={{ color: labelColor, fontSize: '0.8em' }}>Try adjusting your filters or create a new skill.</Typography>
                    </Box>
                ) : (
                    <Grid container spacing={1.5}>
                        {filtered.map(skill => {
                            const catInfo = SKILL_CATEGORIES.find(c => c.key === skill.category) || SKILL_CATEGORIES[5];
                            return (
                                <Grid item xs={12} sm={6} md={4} key={skill.id}>
                                    <Card sx={{
                                        bgcolor: cardBg, border: `1px solid ${borderColor}`, borderRadius: 2,
                                        transition: 'all 0.2s', cursor: 'pointer',
                                        '&:hover': { borderColor: catInfo.color, transform: 'translateY(-2px)', boxShadow: `0 4px 20px ${catInfo.color}22` },
                                        position: 'relative', overflow: 'visible',
                                    }}>
                                        {/* Category color stripe */}
                                        <Box sx={{ height: 3, background: `linear-gradient(90deg, ${catInfo.color}, ${catInfo.color}88)`, borderRadius: '8px 8px 0 0' }} />
                                        <CardContent sx={{ p: '14px !important', '&:last-child': { pb: '14px !important' } }}>
                                            {/* Top row: name + actions */}
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                                <Box sx={{ flex: 1, minWidth: 0 }}>
                                                    <Typography sx={{ fontWeight: 700, fontSize: '0.92em', color: textColor, lineHeight: 1.2, mb: 0.3 }}>
                                                        {skill.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '0.72em', color: labelColor, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                                        {skill.description}
                                                    </Typography>
                                                </Box>
                                                <Box sx={{ display: 'flex', gap: 0.3, ml: 1 }}>
                                                    <Tooltip title="Assign to Agent">
                                                        <Box onClick={(e) => { e.stopPropagation(); setSelectedSkill(skill); setAssignOpen(true); }}
                                                            sx={{ cursor: 'pointer', fontSize: '0.85em', p: 0.3, borderRadius: 1, '&:hover': { bgcolor: isDark ? '#2d3047' : '#e2e8f0' } }}>🔗</Box>
                                                    </Tooltip>
                                                    <Tooltip title="Delete">
                                                        <Box onClick={(e) => { e.stopPropagation(); handleDelete(skill.id); }}
                                                            sx={{ cursor: 'pointer', fontSize: '0.85em', p: 0.3, borderRadius: 1, '&:hover': { bgcolor: '#e74c3c33' } }}>🗑</Box>
                                                    </Tooltip>
                                                </Box>
                                            </Box>

                                            {/* Chips row */}
                                            <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                                                <Chip label={catInfo.label} size="small"
                                                    sx={{ height: 20, fontSize: '0.65em', fontWeight: 600, bgcolor: `${catInfo.color}22`, color: catInfo.color, border: `1px solid ${catInfo.color}44` }} />
                                                <Chip label={`${PROFICIENCY_ICONS[skill.proficiency_level] || '⭐'} ${skill.proficiency_level}`} size="small"
                                                    sx={{ height: 20, fontSize: '0.65em', fontWeight: 600, bgcolor: `${PROFICIENCY_COLORS[skill.proficiency_level]}22`, color: PROFICIENCY_COLORS[skill.proficiency_level] }} />
                                            </Box>

                                            {/* Agent assignments */}
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                                <Typography sx={{ fontSize: '0.68em', color: labelColor, fontWeight: 600 }}>
                                                    {skill.agent_count || 0} agent{(skill.agent_count || 0) !== 1 ? 's' : ''}:
                                                </Typography>
                                                {(skill.agents || []).slice(0, 3).map(a => (
                                                    <Chip key={a} label={a.split(' ')[0]} size="small"
                                                        onDelete={() => handleUnassign(a, skill.name)}
                                                        sx={{ height: 18, fontSize: '0.6em', bgcolor: isDark ? '#1e2030' : '#e2e8f0' }} />
                                                ))}
                                                {(skill.agents || []).length > 3 && (
                                                    <Typography sx={{ fontSize: '0.62em', color: labelColor }}>+{skill.agents.length - 3} more</Typography>
                                                )}
                                            </Box>
                                        </CardContent>
                                    </Card>
                                </Grid>
                            );
                        })}
                    </Grid>
                )}
            </Box>

            {/* ── Create Skill Dialog ── */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth
                PaperProps={{ sx: { bgcolor: isDark ? '#252840' : '#fff', borderRadius: 2 } }}>
                <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05em', borderBottom: `1px solid ${borderColor}`, pb: 1.5 }}>
                    🎯 Create New Skill
                </DialogTitle>
                <DialogContent sx={{ pt: '16px !important' }}>
                    <TextField fullWidth label="Skill Name" value={newSkill.name} onChange={e => setNewSkill({ ...newSkill, name: e.target.value })}
                        size="small" sx={{ mb: 2 }} placeholder="e.g. data_analysis" />
                    <TextField fullWidth label="Description" value={newSkill.description} onChange={e => setNewSkill({ ...newSkill, description: e.target.value })}
                        size="small" multiline rows={2} sx={{ mb: 2 }} />
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel>Category</InputLabel>
                            <Select value={newSkill.category} onChange={e => setNewSkill({ ...newSkill, category: e.target.value })} label="Category">
                                {SKILL_CATEGORIES.filter(c => c.key !== 'all').map(c => (
                                    <MenuItem key={c.key} value={c.key}>{c.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel>Proficiency</InputLabel>
                            <Select value={newSkill.proficiency_level} onChange={e => setNewSkill({ ...newSkill, proficiency_level: e.target.value })} label="Proficiency">
                                {PROFICIENCY_LEVELS.map(p => (
                                    <MenuItem key={p} value={p}>{PROFICIENCY_ICONS[p]} {p.charAt(0).toUpperCase() + p.slice(1)}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCreateOpen(false)} size="small">Cancel</Button>
                    <Button onClick={handleCreate} variant="contained" size="small" disabled={!newSkill.name.trim()}
                        sx={{ textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #4a90e2, #9b59b6)' }}>
                        Create Skill
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Assign to Agent Dialog ── */}
            <Dialog open={assignOpen} onClose={() => setAssignOpen(false)} maxWidth="xs" fullWidth
                PaperProps={{ sx: { bgcolor: isDark ? '#252840' : '#fff', borderRadius: 2 } }}>
                <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05em', borderBottom: `1px solid ${borderColor}`, pb: 1.5 }}>
                    🔗 Assign "{selectedSkill?.name}" to Agent
                </DialogTitle>
                <DialogContent sx={{ pt: '16px !important' }}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Select Agent</InputLabel>
                        <Select value={assignAgent} onChange={e => setAssignAgent(e.target.value)} label="Select Agent">
                            {agents.filter(a => !(selectedSkill?.agents || []).includes(a.name)).map(a => (
                                <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setAssignOpen(false)} size="small">Cancel</Button>
                    <Button onClick={handleAssign} variant="contained" size="small" disabled={!assignAgent}
                        sx={{ textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #2ecc71, #1abc9c)' }}>
                        Assign
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
