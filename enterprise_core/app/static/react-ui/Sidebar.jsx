const {
    Typography, Button, TextField, List, ListItem,
    CircularProgress, Box, Select, MenuItem, FormControl, Chip, Divider,
    Dialog, DialogTitle, DialogContent, DialogActions, FormGroup, FormControlLabel,
    Checkbox, InputLabel
} = MaterialUI;

const PERSONA_TEMPLATES = [
    { name: "Custom Agent", description: "", tools: [], role_description: "" },
    { name: "HR & Recruitment Agent", description: "Expert in hiring, candidate screening, resume parsing, and workforce planning", tools: ["resume_analysis", "candidate_ranking"], role_description: "Manages recruitment pipeline and candidate evaluation" },
    { name: "Supply Chain Agent", description: "Expert in inventory management, supply chain optimization, and demand planning", tools: ["inventory_check", "demand_forecasting"], role_description: "Optimizes supply chain operations and inventory levels" },
    { name: "Financial Operations Agent", description: "Expert in financial forecasting, invoice processing, and audit compliance", tools: ["financial_forecasting", "invoice_processing", "audit_log_check"], role_description: "Manages financial operations and compliance" },
    { name: "Communications Agent", description: "Handles email communications, report generation, and stakeholder notifications", tools: ["email_sender", "report_generator"], role_description: "Manages internal and external communications" },
    { name: "General Purpose Agent", description: "Handles general queries, routing, and basic assistance", tools: ["chat", "help"], role_description: "First point of contact for unclassified requests" },
];

function AddAgentDialog({ open, onClose, onAgentCreated }) {
    const [name, setName] = React.useState('');
    const [description, setDescription] = React.useState('');
    const [selectedTools, setSelectedTools] = React.useState([]);
    const [availableTools, setAvailableTools] = React.useState([]);
    const [template, setTemplate] = React.useState('');
    const [roleDescription, setRoleDescription] = React.useState('');
    const [saving, setSaving] = React.useState(false);
    const [error, setError] = React.useState('');

    React.useEffect(() => {
        if (open) fetch('/api/tools').then(r => r.json()).then(setAvailableTools).catch(console.error);
    }, [open]);

    const handleTemplateChange = (e) => {
        const tpl = PERSONA_TEMPLATES.find(t => t.name === e.target.value);
        if (tpl && tpl.name !== "Custom Agent") {
            setTemplate(e.target.value); setName(tpl.name); setDescription(tpl.description);
            setSelectedTools(tpl.tools); setRoleDescription(tpl.role_description);
        } else { setTemplate('Custom Agent'); setName(''); setDescription(''); setSelectedTools([]); setRoleDescription(''); }
    };

    const handleToolToggle = (toolName) => {
        setSelectedTools(prev => prev.includes(toolName) ? prev.filter(t => t !== toolName) : [...prev, toolName]);
    };

    const handleSave = async () => {
        if (!name.trim()) { setError('Agent name is required'); return; }
        if (!description.trim()) { setError('Description is required'); return; }
        setError(''); setSaving(true);
        try {
            const response = await fetch('/api/agents', { method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: name.trim(), description: description.trim(), tool_names: selectedTools }) });
            if (!response.ok) throw new Error((await response.json()).detail || 'Failed');
            onAgentCreated(await response.json()); resetForm(); onClose();
        } catch (err) { setError(err.message); } finally { setSaving(false); }
    };

    const resetForm = () => { setName(''); setDescription(''); setSelectedTools([]); setTemplate(''); setRoleDescription(''); setError(''); };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth PaperProps={{ sx: { bgcolor: '#2d3047' } }}>
            <DialogTitle>Add New AI Agent</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
                    <FormControl fullWidth size="small">
                        <InputLabel>Start from template</InputLabel>
                        <Select value={template} onChange={handleTemplateChange} label="Start from template">
                            {PERSONA_TEMPLATES.map(t => <MenuItem key={t.name} value={t.name}>{t.name}</MenuItem>)}
                        </Select>
                    </FormControl>
                    <Divider sx={{ borderColor: '#43455c' }} />
                    <TextField label="Agent Name" value={name} onChange={(e) => setName(e.target.value)} fullWidth size="small" required placeholder="e.g. Data Analytics Agent" />
                    <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} fullWidth size="small" multiline rows={2} required placeholder="e.g. Expert in data analysis, visualization" />
                    <TextField label="Role Description (Persona)" value={roleDescription} onChange={(e) => setRoleDescription(e.target.value)} fullWidth size="small" multiline rows={2} placeholder="Detailed persona instructions for LLM reasoning" />
                    <Divider sx={{ borderColor: '#43455c' }} />
                    <Typography variant="subtitle2">Assign Tools</Typography>
                    <Box sx={{ maxHeight: 180, overflowY: 'auto', border: '1px solid #43455c', borderRadius: 1, p: 1 }}>
                        <FormGroup>
                            {availableTools.map(tool => (
                                <FormControlLabel key={tool.name} control={<Checkbox checked={selectedTools.includes(tool.name)} onChange={() => handleToolToggle(tool.name)} size="small" />}
                                    label={<Box><Typography variant="body2">{tool.name}</Typography><Typography variant="caption" color="textSecondary">{tool.description}</Typography></Box>} />
                            ))}
                        </FormGroup>
                    </Box>
                    {selectedTools.length > 0 && <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                        {selectedTools.map(t => <Chip key={t} label={t} size="small" color="primary" onDelete={() => handleToolToggle(t)} />)}
                    </Box>}
                    {error && <Typography color="error" variant="body2">{error}</Typography>}
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={() => { resetForm(); onClose(); }}>Cancel</Button>
                <Button onClick={handleSave} variant="contained" disabled={saving}>{saving ? <CircularProgress size={20} /> : 'Create Agent'}</Button>
            </DialogActions>
        </Dialog>
    );
}

function Sidebar({ selectedAgent, setSelectedAgent, currentUser, setCurrentUser, onTaskSubmit, isDark, setIsDark }) {
    const [agents, setAgents] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [task, setTask] = React.useState('');
    const [addDialogOpen, setAddDialogOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [categoryTab, setCategoryTab] = React.useState(0);

    React.useEffect(() => {
        fetch('/api/agents').then(r => r.json()).then(d => { setAgents(d); setLoading(false); }).catch(() => setLoading(false));
    }, []);

    const handleTaskSubmit = () => {
        if (!task.trim()) { alert("Please describe the task."); return; }
        const agentName = selectedAgent || (agents.length > 0 ? agents[0].name : 'General Assistant');
        if (!selectedAgent && agents.length > 0) setSelectedAgent(agents[0].name);
        onTaskSubmit(task, agentName);
        setTask('');
    };

    const handleAgentCreated = (newAgent) => { setAgents(prev => [...prev, newAgent]); setSelectedAgent(newAgent.name); };

    const sidebarBg  = isDark ? '#131524' : '#f1f5f9';
    const borderColor = isDark ? '#1e2030' : '#e2e8f0';
    const inputBg    = isDark ? '#1a1c2e' : '#ffffff';
    const labelColor = isDark ? '#6c7293' : '#64748b';
    const textColor  = isDark ? '#c8cce8' : '#1e293b';
    const subText    = isDark ? '#8a8eb5' : '#64748b';
    const footerBg   = isDark ? '#0b0d1a' : '#e2e8f0';

    const categories = ['All', 'HR', 'Finance', 'Supply', 'Comms', 'Custom'];

    const filteredAgents = agents.filter(a =>
        !search || a.name.toLowerCase().includes(search.toLowerCase())
    );

    const agentColors = ['#4a90e2','#2ecc71','#e74c3c','#f39c12','#9b59b6','#1abc9c','#e67e22','#3498db'];
    const getColor    = (name) => agentColors[name.length % agentColors.length];
    const getInitials = (name) => name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    // Deterministic simulated performance per agent (seeded by name)
    const getPerf = (agent) => {
        const h = agent.name.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        const rate   = 45 + (h % 50);
        const change = -12 + (h % 25);
        return { rate, change, isUp: change >= 0 };
    };

    return (
        <Box sx={{
            width: 320, minWidth: 320,
            bgcolor: sidebarBg,
            display: 'flex', flexDirection: 'column',
            borderRight: `1px solid ${borderColor}`,
            overflow: 'hidden'
        }}>
            {/* ── Header ── */}
            <Box sx={{ p: '12px 16px', borderBottom: `1px solid ${borderColor}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    {/* Brand */}
                    <Box>
                        <Typography sx={{
                            fontWeight: 900, fontSize: '1.55em', letterSpacing: 1, lineHeight: 1,
                            background: 'linear-gradient(135deg, #4a90e2, #9b59b6, #e74c3c)',
                            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent'
                        }}>
                            GENi
                        </Typography>

                        {/* Sub-header: G E N each individually underscored — one line */}
                        <Box component="div" sx={{ mt: 0.4, fontSize: '0.78em', letterSpacing: 0.3, lineHeight: 1.4, whiteSpace: 'nowrap' }}>
                            <span style={{ borderBottom: '2px solid #4a90e2', paddingBottom: '1px', fontWeight: 800, color: '#4a90e2' }}>G</span>
                            <span style={{ color: subText }}>lobal </span>
                            <span style={{ borderBottom: '2px solid #9b59b6', paddingBottom: '1px', fontWeight: 800, color: '#9b59b6' }}>E</span>
                            <span style={{ color: subText }}>nterprise </span>
                            <span style={{ borderBottom: '2px solid #e74c3c', paddingBottom: '1px', fontWeight: 800, color: '#e74c3c' }}>N</span>
                            <span style={{ color: subText }}>eural - intelligence</span>
                        </Box>
                    </Box>

                    {/* Controls */}
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Button size="small" onClick={() => setIsDark(!isDark)}
                            sx={{ minWidth: 28, p: 0.5, fontSize: '1em' }}>
                            {isDark ? '☀️' : '🌙'}
                        </Button>
                        <FormControl size="small" sx={{ minWidth: 80 }}>
                            <Select value={currentUser} onChange={(e) => setCurrentUser(e.target.value)}
                                sx={{ fontSize: '0.7em', height: 28, '.MuiOutlinedInput-notchedOutline': { borderColor } }}>
                                <MenuItem value="viewer_user">Viewer</MenuItem>
                                <MenuItem value="analyst_user">Analyst</MenuItem>
                                <MenuItem value="admin_user">Admin</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </Box>

                {/* Search bar */}
                <TextField
                    placeholder="Search for agents to deploy..."
                    size="small" fullWidth value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    sx={{ mt: 1.5, '& .MuiOutlinedInput-root': { bgcolor: inputBg, fontSize: '0.8em' } }}
                    InputProps={{ startAdornment: <span style={{ marginRight: 6, color: labelColor }}>🔍</span> }}
                />
            </Box>

            {/* ── Category tabs + section header ── */}
            <Box sx={{ px: 1.5, pt: 1, pb: 0.5, borderBottom: `1px solid ${borderColor}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.8 }}>
                    <Typography sx={{ fontWeight: 700, color: labelColor, letterSpacing: 1.5, fontSize: '0.62em', textTransform: 'uppercase' }}>
                        AI Workforce
                    </Typography>
                    <Button size="small" variant="outlined" onClick={() => setAddDialogOpen(true)}
                        sx={{ fontSize: '0.65em', minWidth: 'auto', borderColor: '#4a90e2', color: '#4a90e2', py: 0.2, px: 0.8 }}>
                        + ADD
                    </Button>
                </Box>
                <Box sx={{
                    display: 'flex', gap: 0.5, pb: 0.5,
                    overflowX: 'auto', flexWrap: 'nowrap',
                    '&::-webkit-scrollbar': { height: 2 },
                    '&::-webkit-scrollbar-thumb': { bgcolor: '#4a5568', borderRadius: 1 }
                }}>
                    {categories.map((cat, i) => (
                        <Box key={cat} onClick={() => setCategoryTab(i)}
                            sx={{
                                px: 1, py: 0.35, borderRadius: 1, cursor: 'pointer',
                                fontSize: '0.66em', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0,
                                bgcolor: categoryTab === i ? '#4a90e2' : (isDark ? '#1e2030' : '#e2e8f0'),
                                color: categoryTab === i ? '#fff' : labelColor,
                                transition: 'all 0.15s',
                            }}>
                            {cat}
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* ── Agent list (watchlist style) ── */}
            <Box sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>
                ) : filteredAgents.length === 0 ? (
                    <Box sx={{ p: 2, textAlign: 'center' }}>
                        <Typography variant="body2" color="textSecondary">No agents found</Typography>
                    </Box>
                ) : (
                    <List sx={{ py: 0 }} dense>
                        {filteredAgents.map((agent) => {
                            const perf = getPerf(agent);
                            const color = getColor(agent.name);
                            const isSel = selectedAgent === agent.name;
                            return (
                                <ListItem key={agent.name} button onClick={() => setSelectedAgent(agent.name)}
                                    sx={{
                                        py: 1, px: 1.5,
                                        borderLeft: isSel ? `3px solid ${color}` : '3px solid transparent',
                                        bgcolor: isSel ? (isDark ? '#1a2040' : '#dbeafe') : 'transparent',
                                        borderBottom: `1px solid ${borderColor}`,
                                        '&:hover': { bgcolor: isDark ? '#1a1c2e' : '#f0f4ff' }
                                    }}>
                                    {/* Avatar circle */}
                                    <Box sx={{
                                        width: 34, height: 34, borderRadius: '50%', bgcolor: color,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        mr: 1.2, flexShrink: 0
                                    }}>
                                        <Typography sx={{ color: '#fff', fontSize: '0.68em', fontWeight: 800 }}>
                                            {getInitials(agent.name)}
                                        </Typography>
                                    </Box>

                                    {/* Name + tools */}
                                    <Box sx={{ flexGrow: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontSize: '0.82em', fontWeight: 600, color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {agent.name}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.64em', color: labelColor }}>
                                            {agent.tools ? `${agent.tools.length} tools` : 'No tools'} · AI Core
                                        </Typography>
                                    </Box>

                                    {/* Performance */}
                                    <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                        <Typography sx={{ fontSize: '0.82em', fontWeight: 700, color: perf.isUp ? '#2ecc71' : '#e74c3c' }}>
                                            {perf.rate}%
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.63em', color: perf.isUp ? '#2ecc71' : '#e74c3c' }}>
                                            {perf.isUp ? '▲' : '▼'} {Math.abs(perf.change)}%
                                        </Typography>
                                    </Box>
                                </ListItem>
                            );
                        })}
                    </List>
                )}
            </Box>

            {/* ── Column footer ── */}
            <Box sx={{
                px: 1.5, py: 0.8, borderTop: `1px solid ${borderColor}`,
                display: 'flex', justifyContent: 'space-between',
                bgcolor: footerBg
            }}>
                <Typography sx={{ fontSize: '0.63em', color: labelColor, fontWeight: 600 }}>Agent Name</Typography>
                <Box sx={{ display: 'flex', gap: 2 }}>
                    <Typography sx={{ fontSize: '0.63em', color: labelColor, fontWeight: 600 }}>Rate</Typography>
                    <Typography sx={{ fontSize: '0.63em', color: labelColor, fontWeight: 600 }}>Chg%</Typography>
                    <Typography sx={{ fontSize: '0.63em', color: labelColor }}>⚙</Typography>
                </Box>
            </Box>

            {/* ── Dispatch Task ── */}
            <Box sx={{ borderTop: `1px solid ${borderColor}`, p: 1.5, bgcolor: footerBg }}>
                <Typography sx={{ fontWeight: 700, color: labelColor, letterSpacing: 1.5, display: 'block', mb: 0.8, fontSize: '0.6em', textTransform: 'uppercase' }}>
                    Dispatch Task
                </Typography>
                {selectedAgent && <Chip label={selectedAgent} size="small" color="primary" sx={{ mb: 0.8, fontSize: '0.7em' }} />}
                <TextField multiline rows={2} fullWidth placeholder="Describe the task..."
                    value={task} onChange={(e) => setTask(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTaskSubmit(); } }}
                    variant="outlined" size="small"
                    sx={{ mb: 0.8, '& .MuiOutlinedInput-root': { bgcolor: inputBg, fontSize: '0.8em' } }} />
                <Button variant="contained" fullWidth onClick={handleTaskSubmit} size="small"
                    sx={{ background: 'linear-gradient(135deg, #4a90e2, #6c5ce7)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, fontSize: '0.75em' }}>
                    Execute Task
                </Button>
            </Box>

            <AddAgentDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} onAgentCreated={handleAgentCreated} />
        </Box>
    );
}
