const {
    Box, Typography, Card, CardContent, Chip, Button, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
    InputLabel, CircularProgress, Grid, Tooltip, Avatar, AvatarGroup
} = MaterialUI;

const GROUP_ICONS = ['🏢', '👥', '💼', '🔬', '🛡', '⚙️', '🎯', '📊'];
const AGENT_STATUS_COLORS = { online: '#2ecc71', busy: '#f39c12', offline: '#636e72' };

function AgentGroups({ isDark, refreshKey, onSwitchToComms }) {
    const [groups, setGroups] = React.useState([]);
    const [agents, setAgents] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [addMemberOpen, setAddMemberOpen] = React.useState(false);
    const [selectedGroup, setSelectedGroup] = React.useState(null);
    const [newGroup, setNewGroup] = React.useState({ name: '', description: '', color: '#4a90e2' });
    const [selectedAgent, setSelectedAgent] = React.useState('');

    const cardBg = isDark ? '#252840' : '#f8fafc';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const textColor = isDark ? '#c8cce8' : '#1e293b';
    const labelColor = isDark ? '#6c7293' : '#64748b';

    const loadData = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/agent-groups').then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
            fetch('/api/agents').then(r => r.json()).then(d => Array.isArray(d) ? d : []).catch(() => []),
        ]).then(([g, a]) => { setGroups(g); setAgents(a); setLoading(false); })
            .catch(() => setLoading(false));
    };

    React.useEffect(loadData, [refreshKey]);

    const handleCreate = () => {
        fetch('/api/agent-groups', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(newGroup)
        }).then(r => { if (r.ok) { setCreateOpen(false); setNewGroup({ name: '', description: '', color: '#4a90e2' }); loadData(); } });
    };

    const handleAddMember = () => {
        if (!selectedGroup || !selectedAgent) return;
        fetch(`/api/agent-groups/${selectedGroup.id}/members?agent_name=${encodeURIComponent(selectedAgent)}`, { method: 'POST' })
            .then(r => { if (r.ok) { setAddMemberOpen(false); setSelectedAgent(''); loadData(); } });
    };

    const handleRemoveMember = (groupId, agentName) => {
        fetch(`/api/agent-groups/${groupId}/members/${encodeURIComponent(agentName)}`, { method: 'DELETE' })
            .then(() => loadData());
    };

    const handleDeleteGroup = (groupId) => {
        if (!confirm('Delete this group?')) return;
        fetch(`/api/agent-groups/${groupId}`, { method: 'DELETE' }).then(() => loadData());
    };

    // Agents not in any group
    const assignedAgentNames = groups.flatMap(g => (g.members || []).map(m => m.name));
    const unassigned = agents.filter(a => !assignedAgentNames.includes(a.name));

    if (loading) {
        return <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 200px)' }}><CircularProgress /></Box>;
    }

    return (
        <Box sx={{ height: 'calc(100vh - 200px)', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexShrink: 0 }}>
                <Box>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.3em', color: textColor, display: 'flex', alignItems: 'center', gap: 1 }}>
                        👥 Agent Groups
                    </Typography>
                    <Typography sx={{ fontSize: '0.78em', color: labelColor }}>
                        {groups.length} groups · {agents.length} total agents · {unassigned.length} unassigned
                    </Typography>
                </Box>
                <Button variant="contained" size="small" onClick={() => setCreateOpen(true)}
                    sx={{ textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #4a90e2, #2ecc71)', fontSize: '0.82em' }}>
                    + New Group
                </Button>
            </Box>

            <Box sx={{ flexGrow: 1, overflowY: 'auto' }}>
                {/* Groups Grid */}
                <Grid container spacing={2}>
                    {groups.map((group, gi) => (
                        <Grid item xs={12} md={6} lg={4} key={group.id}>
                            <Card sx={{
                                bgcolor: cardBg, border: `1px solid ${borderColor}`, borderRadius: 2,
                                transition: 'all 0.2s', overflow: 'visible',
                                '&:hover': { borderColor: group.color, transform: 'translateY(-2px)', boxShadow: `0 4px 20px ${group.color}22` },
                            }}>
                                {/* Color header */}
                                <Box sx={{
                                    height: 8, background: `linear-gradient(135deg, ${group.color}, ${group.color}88)`,
                                    borderRadius: '8px 8px 0 0',
                                }} />
                                <CardContent sx={{ p: '14px !important', '&:last-child': { pb: '14px !important' } }}>
                                    {/* Group header */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box sx={{
                                                width: 36, height: 36, borderRadius: '50%', bgcolor: group.color,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: '1.1em', boxShadow: `0 0 12px ${group.color}44`,
                                            }}>
                                                {GROUP_ICONS[gi % GROUP_ICONS.length]}
                                            </Box>
                                            <Box>
                                                <Typography sx={{ fontWeight: 700, fontSize: '0.95em', color: textColor, lineHeight: 1.2 }}>
                                                    {group.name}
                                                </Typography>
                                                <Typography sx={{ fontSize: '0.7em', color: labelColor }}>
                                                    {group.member_count} member{group.member_count !== 1 ? 's' : ''}
                                                </Typography>
                                            </Box>
                                        </Box>
                                        <Box sx={{ display: 'flex', gap: 0.3 }}>
                                            <Tooltip title="Add Member">
                                                <Box onClick={() => { setSelectedGroup(group); setAddMemberOpen(true); }}
                                                    sx={{ cursor: 'pointer', fontSize: '0.85em', p: 0.3, borderRadius: 1, '&:hover': { bgcolor: isDark ? '#2d3047' : '#e2e8f0' } }}>➕</Box>
                                            </Tooltip>
                                            <Tooltip title="Delete Group">
                                                <Box onClick={() => handleDeleteGroup(group.id)}
                                                    sx={{ cursor: 'pointer', fontSize: '0.85em', p: 0.3, borderRadius: 1, '&:hover': { bgcolor: '#e74c3c33' } }}>🗑</Box>
                                            </Tooltip>
                                        </Box>
                                    </Box>

                                    {/* Description */}
                                    {group.description && (
                                        <Typography sx={{ fontSize: '0.72em', color: labelColor, mb: 1.5, lineHeight: 1.4 }}>
                                            {group.description}
                                        </Typography>
                                    )}

                                    {/* Members */}
                                    {(group.members || []).length === 0 ? (
                                        <Typography sx={{ fontSize: '0.72em', color: labelColor, fontStyle: 'italic' }}>No members yet</Typography>
                                    ) : (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                                            {(group.members || []).map(member => (
                                                <Box key={member.name} sx={{
                                                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                    px: 1.2, py: 0.5, borderRadius: 1,
                                                    bgcolor: isDark ? '#1e2030' : '#f0f2f5',
                                                }}>
                                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                                        <Box sx={{
                                                            width: 8, height: 8, borderRadius: '50%',
                                                            bgcolor: AGENT_STATUS_COLORS[member.status] || '#636e72',
                                                        }} />
                                                        <Typography sx={{ fontSize: '0.75em', color: textColor, fontWeight: 600 }}>
                                                            {member.name}
                                                        </Typography>
                                                    </Box>
                                                    <Box onClick={() => handleRemoveMember(group.id, member.name)}
                                                        sx={{ cursor: 'pointer', fontSize: '0.65em', color: labelColor, '&:hover': { color: '#e74c3c' } }}>✕</Box>
                                                </Box>
                                            ))}
                                        </Box>
                                    )}
                                </CardContent>
                            </Card>
                        </Grid>
                    ))}

                    {/* Unassigned agents card */}
                    {unassigned.length > 0 && (
                        <Grid item xs={12} md={6} lg={4}>
                            <Card sx={{
                                bgcolor: cardBg, border: `1px dashed ${borderColor}`, borderRadius: 2,
                                opacity: 0.8,
                            }}>
                                <Box sx={{ height: 8, background: 'linear-gradient(135deg, #636e72, #636e7288)', borderRadius: '8px 8px 0 0' }} />
                                <CardContent sx={{ p: '14px !important', '&:last-child': { pb: '14px !important' } }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                                        <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: '#636e72', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1em' }}>
                                            🚀
                                        </Box>
                                        <Box>
                                            <Typography sx={{ fontWeight: 700, fontSize: '0.95em', color: textColor }}>Unassigned</Typography>
                                            <Typography sx={{ fontSize: '0.7em', color: labelColor }}>{unassigned.length} agents</Typography>
                                        </Box>
                                    </Box>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.6 }}>
                                        {unassigned.map(a => (
                                            <Box key={a.name} sx={{
                                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                                px: 1.2, py: 0.5, borderRadius: 1, bgcolor: isDark ? '#1e2030' : '#f0f2f5',
                                            }}>
                                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.8 }}>
                                                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: AGENT_STATUS_COLORS[a.status] || '#636e72' }} />
                                                    <Typography sx={{ fontSize: '0.75em', color: textColor, fontWeight: 600 }}>{a.name}</Typography>
                                                </Box>
                                                <Typography sx={{ fontSize: '0.6em', color: labelColor, fontStyle: 'italic' }}>drag to group</Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    )}
                </Grid>
            </Box>

            {/* Create Group Dialog */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth
                PaperProps={{ sx: { bgcolor: isDark ? '#252840' : '#fff', borderRadius: 2 } }}>
                <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05em', borderBottom: `1px solid ${borderColor}`, pb: 1.5 }}>
                    👥 Create Agent Group
                </DialogTitle>
                <DialogContent sx={{ pt: '16px !important' }}>
                    <TextField fullWidth label="Group Name" value={newGroup.name} onChange={e => setNewGroup({ ...newGroup, name: e.target.value })}
                        size="small" sx={{ mb: 2 }} placeholder="e.g. Analytics Team" />
                    <TextField fullWidth label="Description" value={newGroup.description} onChange={e => setNewGroup({ ...newGroup, description: e.target.value })}
                        size="small" multiline rows={2} sx={{ mb: 2 }} />
                    <Typography sx={{ fontSize: '0.78em', fontWeight: 600, color: labelColor, mb: 0.8 }}>Group Color</Typography>
                    <Box sx={{ display: 'flex', gap: 0.8, flexWrap: 'wrap' }}>
                        {['#4a90e2', '#2ecc71', '#9b59b6', '#f39c12', '#e74c3c', '#1abc9c', '#3498db', '#e67e22'].map(c => (
                            <Box key={c} onClick={() => setNewGroup({ ...newGroup, color: c })}
                                sx={{
                                    width: 32, height: 32, borderRadius: '50%', bgcolor: c, cursor: 'pointer',
                                    border: `3px solid ${newGroup.color === c ? '#fff' : 'transparent'}`,
                                    boxShadow: newGroup.color === c ? `0 0 0 2px ${c}` : 'none',
                                    transition: 'all 0.15s',
                                }} />
                        ))}
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCreateOpen(false)} size="small">Cancel</Button>
                    <Button onClick={handleCreate} variant="contained" size="small" disabled={!newGroup.name.trim()}
                        sx={{ textTransform: 'none', fontWeight: 700, bgcolor: newGroup.color }}>
                        Create Group
                    </Button>
                </DialogActions>
            </Dialog>

            {/* Add Member Dialog */}
            <Dialog open={addMemberOpen} onClose={() => setAddMemberOpen(false)} maxWidth="xs" fullWidth
                PaperProps={{ sx: { bgcolor: isDark ? '#252840' : '#fff', borderRadius: 2 } }}>
                <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05em', borderBottom: `1px solid ${borderColor}`, pb: 1.5 }}>
                    ➕ Add Agent to "{selectedGroup?.name}"
                </DialogTitle>
                <DialogContent sx={{ pt: '16px !important' }}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Select Agent</InputLabel>
                        <Select value={selectedAgent} onChange={e => setSelectedAgent(e.target.value)} label="Select Agent">
                            {agents.filter(a => !(selectedGroup?.members || []).find(m => m.name === a.name)).map(a => (
                                <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setAddMemberOpen(false)} size="small">Cancel</Button>
                    <Button onClick={handleAddMember} variant="contained" size="small" disabled={!selectedAgent}
                        sx={{ textTransform: 'none', fontWeight: 700, bgcolor: selectedGroup?.color || '#4a90e2' }}>
                        Add Agent
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
