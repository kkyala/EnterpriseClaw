const {
    Box, Typography, Card, CardContent, Chip, Button, Dialog, DialogTitle,
    DialogContent, DialogActions, TextField, Select, MenuItem, FormControl,
    InputLabel, IconButton, CircularProgress, Grid, Divider, Tooltip,
    Stepper, Step, StepLabel, StepContent, Paper
} = MaterialUI;

const STEP_TYPES = [
    { key: 'agent', label: '🤖 Agent', color: '#4a90e2', desc: 'Execute via an agent' },
    { key: 'tool', label: '🔧 Tool', color: '#2ecc71', desc: 'Run a specific tool' },
    { key: 'skill', label: '🎯 Skill', color: '#9b59b6', desc: 'Apply a skill capability' },
    { key: 'condition', label: '🔀 Condition', color: '#f39c12', desc: 'Branch based on condition' },
    { key: 'delay', label: '⏱ Delay', color: '#e74c3c', desc: 'Wait before next step' },
];

const STEP_TYPE_ICONS = { agent: '🤖', tool: '🔧', skill: '🎯', condition: '🔀', delay: '⏱' };
const STEP_TYPE_COLORS = { agent: '#4a90e2', tool: '#2ecc71', skill: '#9b59b6', condition: '#f39c12', delay: '#e74c3c' };

function Workflows({ isDark, refreshKey }) {
    const [workflows, setWorkflows] = React.useState([]);
    const [agents, setAgents] = React.useState([]);
    const [skills, setSkills] = React.useState([]);
    const [tools, setTools] = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [selected, setSelected] = React.useState(null);
    const [createOpen, setCreateOpen] = React.useState(false);
    const [addStepOpen, setAddStepOpen] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [newWf, setNewWf] = React.useState({ name: '', description: '' });
    const [newStep, setNewStep] = React.useState({ name: '', step_type: 'agent', config: {}, on_success: 'next', on_failure: 'abort' });

    const bg = isDark ? '#1e2030' : '#ffffff';
    const cardBg = isDark ? '#252840' : '#f8fafc';
    const borderColor = isDark ? '#2d3047' : '#e2e8f0';
    const textColor = isDark ? '#c8cce8' : '#1e293b';
    const labelColor = isDark ? '#6c7293' : '#64748b';

    const loadData = () => {
        setLoading(true);
        Promise.all([
            fetch('/api/workflows').then(r => r.json()),
            fetch('/api/agents').then(r => r.json()),
            fetch('/api/skills').then(r => r.json()),
            fetch('/api/tools').then(r => r.json()),
        ]).then(([w, a, s, t]) => {
            setWorkflows(w);
            setAgents(a);
            setSkills(s);
            setTools(t);
            if (selected) {
                const updated = w.find(wf => wf.id === selected.id);
                if (updated) setSelected(updated);
            }
            setLoading(false);
        }).catch(() => setLoading(false));
    };

    React.useEffect(loadData, [refreshKey]);

    const filtered = workflows.filter(w =>
        !search || w.name.toLowerCase().includes(search.toLowerCase()) || w.description?.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreate = () => {
        fetch('/api/workflows', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...newWf, steps: [], created_by: 'dashboard' })
        }).then(r => { if (r.ok) { setCreateOpen(false); setNewWf({ name: '', description: '' }); loadData(); } });
    };

    const handleAddStep = () => {
        if (!selected) return;
        const stepOrder = (selected.steps?.length || 0) + 1;
        const payload = {
            step_order: stepOrder,
            name: newStep.name,
            step_type: newStep.step_type,
            config: JSON.stringify(newStep.config),
            on_success: newStep.on_success,
            on_failure: newStep.on_failure,
        };
        fetch(`/api/workflows/${selected.id}/steps`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        }).then(r => {
            if (r.ok) {
                setAddStepOpen(false);
                setNewStep({ name: '', step_type: 'agent', config: {}, on_success: 'next', on_failure: 'abort' });
                loadData();
            }
        });
    };

    const handleDeleteStep = (stepId) => {
        fetch(`/api/workflow-steps/${stepId}`, { method: 'DELETE' }).then(() => loadData());
    };

    const handleDeleteWorkflow = (wfId) => {
        if (!confirm('Delete this workflow and all its steps?')) return;
        fetch(`/api/workflows/${wfId}`, { method: 'DELETE' }).then(() => {
            setSelected(null);
            loadData();
        });
    };

    const handleRunWorkflow = (wfId) => {
        fetch(`/api/workflows/${wfId}/run`, { method: 'POST' })
            .then(r => r.json())
            .then(data => {
                alert(`Workflow queued! Task ID: ${data.task_id}`);
                loadData();
            });
    };

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
                        ⚡ Workflow Builder
                    </Typography>
                    <Typography sx={{ fontSize: '0.78em', color: labelColor }}>
                        {workflows.length} workflows · {workflows.reduce((a, w) => a + (w.step_count || 0), 0)} total steps
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="Search workflows..." value={search} onChange={e => setSearch(e.target.value)}
                        sx={{ width: 200, '& .MuiOutlinedInput-root': { fontSize: '0.82em' } }} />
                    <Button variant="contained" size="small" onClick={() => setCreateOpen(true)}
                        sx={{ textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #f39c12, #e74c3c)', fontSize: '0.82em' }}>
                        + New Workflow
                    </Button>
                </Box>
            </Box>

            {/* Two-column layout */}
            <Box sx={{ display: 'flex', gap: 2, flexGrow: 1, overflow: 'hidden' }}>
                {/* Left: Workflow list */}
                <Box sx={{ width: 320, flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {filtered.length === 0 ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexGrow: 1 }}>
                            <Typography sx={{ fontSize: '2.5em', mb: 1 }}>⚡</Typography>
                            <Typography sx={{ color: labelColor, fontWeight: 600, fontSize: '0.88em' }}>No workflows yet</Typography>
                        </Box>
                    ) : filtered.map(wf => (
                        <Card key={wf.id} onClick={() => setSelected(wf)}
                            sx={{
                                bgcolor: selected?.id === wf.id ? (isDark ? '#2a2d50' : '#eff6ff') : cardBg,
                                border: `1px solid ${selected?.id === wf.id ? '#4a90e2' : borderColor}`,
                                borderRadius: 2, cursor: 'pointer', transition: 'all 0.15s',
                                '&:hover': { borderColor: '#4a90e2', transform: 'translateX(2px)' },
                            }}>
                            <CardContent sx={{ p: '12px !important', '&:last-child': { pb: '12px !important' } }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <Box sx={{ flex: 1, minWidth: 0 }}>
                                        <Typography sx={{ fontWeight: 700, fontSize: '0.88em', color: textColor, lineHeight: 1.2 }}>
                                            ⚡ {wf.name}
                                        </Typography>
                                        <Typography sx={{ fontSize: '0.7em', color: labelColor, mt: 0.3, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                                            {wf.description}
                                        </Typography>
                                    </Box>
                                    <Chip label={`${wf.step_count || 0} steps`} size="small"
                                        sx={{ height: 20, fontSize: '0.62em', fontWeight: 600, bgcolor: '#4a90e222', color: '#4a90e2' }} />
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                                    {(wf.steps || []).slice(0, 4).map((s, i) => (
                                        <Box key={i} sx={{ fontSize: '0.7em', color: labelColor, display: 'flex', alignItems: 'center', gap: 0.3 }}>
                                            {STEP_TYPE_ICONS[s.step_type] || '⚙️'}
                                            {i < Math.min(3, (wf.steps || []).length - 1) && <span style={{ color: isDark ? '#43455c' : '#cbd5e1' }}>→</span>}
                                        </Box>
                                    ))}
                                </Box>
                            </CardContent>
                        </Card>
                    ))}
                </Box>

                {/* Right: Workflow Detail */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', border: `1px solid ${borderColor}`, borderRadius: 2, bgcolor: isDark ? '#0d0f1e' : '#f8fafc' }}>
                    {!selected ? (
                        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                            <Typography sx={{ fontSize: '3em', mb: 1 }}>⚡</Typography>
                            <Typography sx={{ color: labelColor, fontWeight: 600 }}>Select a workflow to view its steps</Typography>
                            <Typography sx={{ color: labelColor, fontSize: '0.8em', mt: 0.5 }}>Or create a new workflow to get started.</Typography>
                        </Box>
                    ) : (
                        <Box sx={{ p: 2.5 }}>
                            {/* Workflow header */}
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                                <Box>
                                    <Typography sx={{ fontWeight: 800, fontSize: '1.15em', color: textColor }}>⚡ {selected.name}</Typography>
                                    <Typography sx={{ fontSize: '0.78em', color: labelColor }}>{selected.description}</Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 0.8 }}>
                                    <Button size="small" variant="outlined" onClick={() => setAddStepOpen(true)}
                                        sx={{ textTransform: 'none', fontSize: '0.75em', fontWeight: 600 }}>
                                        + Add Step
                                    </Button>
                                    <Button size="small" variant="contained" onClick={() => handleRunWorkflow(selected.id)}
                                        sx={{ textTransform: 'none', fontSize: '0.75em', fontWeight: 700, background: 'linear-gradient(135deg, #2ecc71, #1abc9c)' }}>
                                        ▶ Run
                                    </Button>
                                    <Tooltip title="Delete Workflow">
                                        <Box onClick={() => handleDeleteWorkflow(selected.id)}
                                            sx={{ cursor: 'pointer', fontSize: '1em', p: 0.5, borderRadius: 1, display: 'flex', alignItems: 'center', '&:hover': { bgcolor: '#e74c3c33' } }}>🗑</Box>
                                    </Tooltip>
                                </Box>
                            </Box>

                            {/* Step Timeline */}
                            {(!selected.steps || selected.steps.length === 0) ? (
                                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 6 }}>
                                    <Typography sx={{ fontSize: '2em', mb: 1 }}>📝</Typography>
                                    <Typography sx={{ color: labelColor, fontWeight: 600 }}>No steps yet</Typography>
                                    <Typography sx={{ color: labelColor, fontSize: '0.8em' }}>Add steps to build your workflow pipeline.</Typography>
                                </Box>
                            ) : (
                                <Box sx={{ position: 'relative' }}>
                                    {selected.steps.map((step, idx) => {
                                        const sColor = STEP_TYPE_COLORS[step.step_type] || '#4a90e2';
                                        const config = step.config || {};
                                        return (
                                            <Box key={step.id || idx} sx={{ display: 'flex', mb: 1.5 }}>
                                                {/* Timeline connector */}
                                                <Box sx={{ width: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
                                                    <Box sx={{
                                                        width: 28, height: 28, borderRadius: '50%', bgcolor: sColor,
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        fontSize: '0.8em', color: '#fff', fontWeight: 800, flexShrink: 0,
                                                        boxShadow: `0 0 12px ${sColor}44`,
                                                    }}>
                                                        {step.step_order}
                                                    </Box>
                                                    {idx < selected.steps.length - 1 && (
                                                        <Box sx={{ width: 2, flexGrow: 1, bgcolor: isDark ? '#2d3047' : '#e2e8f0', mt: 0.5 }} />
                                                    )}
                                                </Box>
                                                {/* Step card */}
                                                <Card sx={{
                                                    flexGrow: 1, ml: 1.5, bgcolor: cardBg,
                                                    border: `1px solid ${borderColor}`, borderRadius: 1.5,
                                                    borderLeft: `3px solid ${sColor}`,
                                                }}>
                                                    <CardContent sx={{ p: '10px 14px !important', '&:last-child': { pb: '10px !important' } }}>
                                                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                                <Typography sx={{ fontWeight: 700, fontSize: '0.88em', color: textColor }}>
                                                                    {STEP_TYPE_ICONS[step.step_type]} {step.name}
                                                                </Typography>
                                                                <Chip label={step.step_type} size="small"
                                                                    sx={{ height: 18, fontSize: '0.6em', fontWeight: 600, bgcolor: `${sColor}22`, color: sColor }} />
                                                            </Box>
                                                            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                                                <Chip label={`✓ ${step.on_success}`} size="small" sx={{ height: 16, fontSize: '0.55em', bgcolor: '#2ecc7122', color: '#2ecc71' }} />
                                                                <Chip label={`✗ ${step.on_failure}`} size="small" sx={{ height: 16, fontSize: '0.55em', bgcolor: '#e74c3c22', color: '#e74c3c' }} />
                                                                <Tooltip title="Delete Step">
                                                                    <Box onClick={() => handleDeleteStep(step.id)}
                                                                        sx={{ cursor: 'pointer', fontSize: '0.75em', ml: 0.5, '&:hover': { color: '#e74c3c' } }}>✕</Box>
                                                                </Tooltip>
                                                            </Box>
                                                        </Box>
                                                        {/* Config details */}
                                                        <Box sx={{ mt: 0.5, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                                                            {config.agent_name && (
                                                                <Typography sx={{ fontSize: '0.7em', color: labelColor }}>
                                                                    🤖 <strong>{config.agent_name}</strong>
                                                                </Typography>
                                                            )}
                                                            {config.tool_name && (
                                                                <Typography sx={{ fontSize: '0.7em', color: labelColor }}>
                                                                    🔧 <strong>{config.tool_name}</strong>
                                                                </Typography>
                                                            )}
                                                            {config.skill_name && (
                                                                <Typography sx={{ fontSize: '0.7em', color: labelColor }}>
                                                                    🎯 <strong>{config.skill_name}</strong>
                                                                </Typography>
                                                            )}
                                                            {config.task && (
                                                                <Typography sx={{ fontSize: '0.68em', color: labelColor, fontStyle: 'italic' }}>
                                                                    "{config.task.substring(0, 80)}{config.task.length > 80 ? '…' : ''}"
                                                                </Typography>
                                                            )}
                                                        </Box>
                                                    </CardContent>
                                                </Card>
                                            </Box>
                                        );
                                    })}
                                </Box>
                            )}
                        </Box>
                    )}
                </Box>
            </Box>

            {/* ── Create Workflow Dialog ── */}
            <Dialog open={createOpen} onClose={() => setCreateOpen(false)} maxWidth="sm" fullWidth
                PaperProps={{ sx: { bgcolor: isDark ? '#252840' : '#fff', borderRadius: 2 } }}>
                <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05em', borderBottom: `1px solid ${borderColor}`, pb: 1.5 }}>
                    ⚡ Create New Workflow
                </DialogTitle>
                <DialogContent sx={{ pt: '16px !important' }}>
                    <TextField fullWidth label="Workflow Name" value={newWf.name} onChange={e => setNewWf({ ...newWf, name: e.target.value })}
                        size="small" sx={{ mb: 2 }} placeholder="e.g. Monthly Audit Pipeline" />
                    <TextField fullWidth label="Description" value={newWf.description} onChange={e => setNewWf({ ...newWf, description: e.target.value })}
                        size="small" multiline rows={2} placeholder="What does this workflow accomplish?" />
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setCreateOpen(false)} size="small">Cancel</Button>
                    <Button onClick={handleCreate} variant="contained" size="small" disabled={!newWf.name.trim()}
                        sx={{ textTransform: 'none', fontWeight: 700, background: 'linear-gradient(135deg, #f39c12, #e74c3c)' }}>
                        Create Workflow
                    </Button>
                </DialogActions>
            </Dialog>

            {/* ── Add Step Dialog ── */}
            <Dialog open={addStepOpen} onClose={() => setAddStepOpen(false)} maxWidth="sm" fullWidth
                PaperProps={{ sx: { bgcolor: isDark ? '#252840' : '#fff', borderRadius: 2 } }}>
                <DialogTitle sx={{ fontWeight: 700, fontSize: '1.05em', borderBottom: `1px solid ${borderColor}`, pb: 1.5 }}>
                    ➕ Add Step to "{selected?.name}"
                </DialogTitle>
                <DialogContent sx={{ pt: '16px !important' }}>
                    <TextField fullWidth label="Step Name" value={newStep.name} onChange={e => setNewStep({ ...newStep, name: e.target.value })}
                        size="small" sx={{ mb: 2 }} placeholder="e.g. Parse Resume Data" />

                    {/* Step type selector */}
                    <Typography sx={{ fontSize: '0.78em', fontWeight: 600, color: labelColor, mb: 0.8 }}>Step Type</Typography>
                    <Box sx={{ display: 'flex', gap: 0.8, mb: 2, flexWrap: 'wrap' }}>
                        {STEP_TYPES.map(st => (
                            <Box key={st.key} onClick={() => setNewStep({ ...newStep, step_type: st.key, config: {} })}
                                sx={{
                                    px: 1.3, py: 0.6, borderRadius: 1.5, cursor: 'pointer',
                                    fontSize: '0.75em', fontWeight: 600,
                                    bgcolor: newStep.step_type === st.key ? st.color : (isDark ? '#1e2030' : '#e2e8f0'),
                                    color: newStep.step_type === st.key ? '#fff' : labelColor,
                                    border: `1px solid ${newStep.step_type === st.key ? 'transparent' : borderColor}`,
                                    transition: 'all 0.15s',
                                }}>
                                {st.label}
                            </Box>
                        ))}
                    </Box>

                    {/* Dynamic config based on step type */}
                    {newStep.step_type === 'agent' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Agent</InputLabel>
                                <Select value={newStep.config.agent_name || ''} label="Agent"
                                    onChange={e => setNewStep({ ...newStep, config: { ...newStep.config, agent_name: e.target.value } })}>
                                    {agents.map(a => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <TextField fullWidth label="Task Description" size="small" multiline rows={2}
                                value={newStep.config.task || ''} onChange={e => setNewStep({ ...newStep, config: { ...newStep.config, task: e.target.value } })} />
                        </Box>
                    )}
                    {newStep.step_type === 'tool' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Tool</InputLabel>
                                <Select value={newStep.config.tool_name || ''} label="Tool"
                                    onChange={e => setNewStep({ ...newStep, config: { ...newStep.config, tool_name: e.target.value } })}>
                                    {tools.map(t => <MenuItem key={t.name} value={t.name}>{t.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel>Executing Agent</InputLabel>
                                <Select value={newStep.config.agent_name || ''} label="Executing Agent"
                                    onChange={e => setNewStep({ ...newStep, config: { ...newStep.config, agent_name: e.target.value } })}>
                                    {agents.map(a => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Box>
                    )}
                    {newStep.step_type === 'skill' && (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                            <FormControl fullWidth size="small">
                                <InputLabel>Skill</InputLabel>
                                <Select value={newStep.config.skill_name || ''} label="Skill"
                                    onChange={e => setNewStep({ ...newStep, config: { ...newStep.config, skill_name: e.target.value } })}>
                                    {skills.map(s => <MenuItem key={s.name} value={s.name}>{s.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                                <InputLabel>Executing Agent</InputLabel>
                                <Select value={newStep.config.agent_name || ''} label="Executing Agent"
                                    onChange={e => setNewStep({ ...newStep, config: { ...newStep.config, agent_name: e.target.value } })}>
                                    {agents.map(a => <MenuItem key={a.name} value={a.name}>{a.name}</MenuItem>)}
                                </Select>
                            </FormControl>
                        </Box>
                    )}

                    {/* Success / Failure handlers */}
                    <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                        <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel>On Success</InputLabel>
                            <Select value={newStep.on_success} label="On Success" onChange={e => setNewStep({ ...newStep, on_success: e.target.value })}>
                                <MenuItem value="next">→ Next Step</MenuItem>
                                <MenuItem value="end">✓ End</MenuItem>
                            </Select>
                        </FormControl>
                        <FormControl size="small" sx={{ flex: 1 }}>
                            <InputLabel>On Failure</InputLabel>
                            <Select value={newStep.on_failure} label="On Failure" onChange={e => setNewStep({ ...newStep, on_failure: e.target.value })}>
                                <MenuItem value="abort">✗ Abort</MenuItem>
                                <MenuItem value="skip">⏭ Skip</MenuItem>
                                <MenuItem value="retry">🔄 Retry</MenuItem>
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions sx={{ px: 3, pb: 2 }}>
                    <Button onClick={() => setAddStepOpen(false)} size="small">Cancel</Button>
                    <Button onClick={handleAddStep} variant="contained" size="small" disabled={!newStep.name.trim()}
                        sx={{ textTransform: 'none', fontWeight: 700, background: `linear-gradient(135deg, ${STEP_TYPE_COLORS[newStep.step_type]}, ${STEP_TYPE_COLORS[newStep.step_type]}cc)` }}>
                        Add Step
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
