const {
    Card, Typography, Button, TextField, List, ListItem, ListItemText,
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

    const sidebarBg = isDark ? '#1a1c2e' : '#f1f5f9';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const hoverBg = isDark ? '#222438' : '#e2e8f0';
    const selectedBg = isDark ? '#252740' : '#dbeafe';
    const inputBg = isDark ? '#252740' : '#ffffff';
    const labelColor = isDark ? '#6c7293' : '#64748b';
    const dispatchBg = isDark ? '#1e2030' : '#e2e8f0';

    return (
        <Box sx={{
            width: 340, minWidth: 340, bgcolor: sidebarBg,
            display: 'flex', flexDirection: 'column',
            borderRight: `1px solid ${borderColor}`
        }}>
            {/* Header */}
            <Box sx={{ p: 2, borderBottom: `1px solid ${borderColor}` }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.5, background: 'linear-gradient(135deg, #4a90e2, #9b59b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>GENi</Typography>
                        <Typography variant="body2" sx={{ color: labelColor, fontSize: '0.75em', display: 'block', mt: 0.3 }}>
                            Global Enterprise Neural <span style={{ textDecoration: 'underline', textDecorationColor: '#4a90e2', fontWeight: 600 }}>Intelligence</span>
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                        <Button size="small" onClick={() => setIsDark(!isDark)}
                            sx={{ minWidth: 32, fontSize: '1em', p: 0.5 }}>
                            {isDark ? '☀️' : '🌙'}
                        </Button>
                        <FormControl size="small">
                            <Select value={currentUser} onChange={(e) => setCurrentUser(e.target.value)}
                                sx={{ fontSize: '0.75em', '.MuiOutlinedInput-notchedOutline': { borderColor } }}>
                                <MenuItem value="viewer_user">Viewer</MenuItem>
                                <MenuItem value="analyst_user">Analyst</MenuItem>
                                <MenuItem value="admin_user">Admin</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </Box>
            </Box>

            {/* Agent List */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 2, py: 1.5 }}>
                    <Typography variant="overline" sx={{ fontWeight: 700, color: labelColor, letterSpacing: 1.5 }}>AI WORKFORCE</Typography>
                    <Button size="small" variant="outlined" onClick={() => setAddDialogOpen(true)}
                        sx={{ fontSize: '0.7em', minWidth: 'auto', borderColor: '#4a90e2', color: '#4a90e2', py: 0.3, px: 1 }}>+ ADD</Button>
                </Box>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', minHeight: 0 }}>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress size={24} /></Box>
                    ) : (
                        <List sx={{ py: 0 }}>
                            {agents.map((agent) => (
                                <ListItem button key={agent.name} selected={selectedAgent === agent.name}
                                    onClick={() => setSelectedAgent(agent.name)}
                                    sx={{ py: 1.5, px: 2,
                                        borderLeft: selectedAgent === agent.name ? '3px solid #4a90e2' : '3px solid transparent',
                                        '&.Mui-selected': { bgcolor: selectedBg }, '&:hover': { bgcolor: hoverBg } }}>
                                    <ListItemText
                                        primary={<Typography variant="body2" sx={{ fontWeight: 600 }}>{agent.name}</Typography>}
                                        secondary={
                                            <React.Fragment>
                                                <Typography variant="caption" sx={{ color: labelColor, display: 'block', mb: 0.5 }}>{agent.description}</Typography>
                                                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.3 }}>
                                                    {agent.tools && agent.tools.map(tool => (
                                                        <Chip key={tool.name} label={tool.name} size="small"
                                                            sx={{ fontSize: '0.6em', height: 18, bgcolor: isDark ? '#2d3047' : '#e2e8f0', color: isDark ? '#8a8eb5' : '#475569' }} />
                                                    ))}
                                                </Box>
                                            </React.Fragment>
                                        }
                                    />
                                </ListItem>
                            ))}
                        </List>
                    )}
                </Box>
            </Box>

            {/* Dispatch Task */}
            <Box sx={{ borderTop: `1px solid ${borderColor}`, p: 2, bgcolor: dispatchBg }}>
                <Typography variant="overline" sx={{ fontWeight: 700, color: labelColor, letterSpacing: 1.5, display: 'block', mb: 1 }}>DISPATCH TASK</Typography>
                {selectedAgent && <Chip label={selectedAgent} size="small" color="primary" sx={{ mb: 1, fontSize: '0.75em' }} />}
                <TextField multiline rows={2} fullWidth placeholder="Describe the task..."
                    value={task} onChange={(e) => setTask(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleTaskSubmit(); } }}
                    variant="outlined" size="small"
                    sx={{ mb: 1, '& .MuiOutlinedInput-root': { bgcolor: inputBg } }} />
                <Button variant="contained" fullWidth onClick={handleTaskSubmit}
                    sx={{ background: 'linear-gradient(135deg, #4a90e2, #6c5ce7)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>
                    Execute Task
                </Button>
            </Box>

            <AddAgentDialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} onAgentCreated={handleAgentCreated} />
        </Box>
    );
}
