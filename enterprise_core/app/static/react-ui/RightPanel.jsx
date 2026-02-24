const { Box, Typography, Divider, CircularProgress } = MaterialUI;

function RightPanel({ refreshKey, isDark }) {
    const [agents, setAgents]   = React.useState([]);
    const [logs, setLogs]       = React.useState([]);
    const [loading, setLoading] = React.useState(true);
    const [moverTab, setMoverTab] = React.useState(0); // 0=Top, 1=Low, 2=Active

    React.useEffect(() => {
        Promise.all([
            fetch('/api/agents').then(r => r.json()),
            fetch('/api/task-logs').then(r => r.json())
        ]).then(([ag, lg]) => {
            setAgents(ag); setLogs(lg); setLoading(false);
        }).catch(() => setLoading(false));
    }, [refreshKey]);

    const bg          = isDark ? '#131524' : '#f1f5f9';
    const borderColor = isDark ? '#1e2030' : '#e2e8f0';
    const labelColor  = isDark ? '#6c7293' : '#64748b';
    const textColor   = isDark ? '#c8cce8' : '#1e293b';

    const agentColors = ['#4a90e2','#2ecc71','#e74c3c','#f39c12','#9b59b6','#1abc9c','#e67e22','#3498db'];
    const getColor    = (name) => agentColors[name.length % agentColors.length];
    const getInitials = (name) => name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();

    const computeStats = () => {
        const stats = {};
        agents.forEach(a => { stats[a.name] = { total: 0, success: 0, failed: 0 }; });
        logs.forEach(l => {
            if (!stats[l.agent_name]) stats[l.agent_name] = { total: 0, success: 0, failed: 0 };
            stats[l.agent_name].total++;
            if (l.status === 'success') stats[l.agent_name].success++;
            else stats[l.agent_name].failed++;
        });
        return Object.entries(stats).map(([name, s]) => ({
            name, ...s, rate: s.total > 0 ? (s.success / s.total) * 100 : 0
        }));
    };

    const getMovers = () => {
        const stats = computeStats();
        if (moverTab === 0) return [...stats].sort((a, b) => b.rate  - a.rate ).slice(0, 6);
        if (moverTab === 1) return [...stats].sort((a, b) => a.rate  - b.rate ).slice(0, 6);
        return             [...stats].sort((a, b) => b.total - a.total).slice(0, 6);
    };

    const featuredWorkflows = [
        { name: 'Full Compliance Audit', desc: 'HIPAA + SOC2 + GDPR pipeline', cost: '250K tokens', color: '#4a90e2' },
        { name: 'KYC + Fraud Check',     desc: 'Banking verification workflow',  cost: '100K tokens', color: '#2ecc71' },
        { name: 'Supply Chain Optimizer',desc: 'Demand forecast + inventory',    cost: '150K tokens', color: '#f39c12' },
        { name: 'HR Recruitment Suite',  desc: 'Resume parsing + ranking',       cost: '80K tokens',  color: '#9b59b6' },
    ];

    const movers = loading ? [] : getMovers();
    const moverLabels = ['🏆 Top', '📉 Low', '⚡ Active'];

    return (
        <Box sx={{
            width: 280, minWidth: 280,
            bgcolor: bg,
            borderLeft: `1px solid ${borderColor}`,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden'
        }}>
            {/* ── Agent Movers ── */}
            <Box sx={{ p: '12px 14px 6px', flexShrink: 0 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88em', color: textColor, mb: 1 }}>
                    Agent Movers
                </Typography>

                {/* Tab pills */}
                <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
                    {moverLabels.map((label, i) => (
                        <Box key={i} onClick={() => setMoverTab(i)}
                            sx={{
                                px: 1, py: 0.4, borderRadius: 1, cursor: 'pointer',
                                fontSize: '0.66em', fontWeight: 600, whiteSpace: 'nowrap',
                                bgcolor: moverTab === i ? '#4a90e2' : (isDark ? '#1e2030' : '#e2e8f0'),
                                color: moverTab === i ? '#fff' : labelColor,
                                transition: 'all 0.15s',
                                '&:hover': { opacity: 0.85 }
                            }}>
                            {label}
                        </Box>
                    ))}
                </Box>

                {/* Column header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', px: 0.5, mb: 0.3 }}>
                    <Typography sx={{ fontSize: '0.62em', color: labelColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Agent</Typography>
                    <Typography sx={{ fontSize: '0.62em', color: labelColor, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>Rate / Tasks</Typography>
                </Box>
            </Box>

            {/* Agent rows */}
            <Box sx={{ maxHeight: 260, overflowY: 'auto', px: 1.5, flexShrink: 0 }}>
                {loading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                        <CircularProgress size={20} />
                    </Box>
                ) : movers.length === 0 ? (
                    <Typography sx={{ fontSize: '0.75em', color: labelColor, textAlign: 'center', py: 2 }}>
                        No agent data yet
                    </Typography>
                ) : movers.map((agent, i) => {
                    const color = getColor(agent.name);
                    const isUp  = agent.rate >= 70;
                    return (
                        <Box key={i} sx={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            py: 0.9, borderBottom: `1px solid ${borderColor}`
                        }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                                <Box sx={{
                                    width: 28, height: 28, borderRadius: '50%', bgcolor: color,
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                                }}>
                                    <Typography sx={{ color: '#fff', fontSize: '0.58em', fontWeight: 800 }}>
                                        {getInitials(agent.name)}
                                    </Typography>
                                </Box>
                                <Typography sx={{
                                    fontSize: '0.76em', color: textColor, fontWeight: 500,
                                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                                }}>
                                    {agent.name.replace(' Agent', '').replace(' Operations', '')}
                                </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                                <Typography sx={{ fontSize: '0.8em', fontWeight: 700, color: isUp ? '#2ecc71' : '#e74c3c' }}>
                                    {agent.rate.toFixed(1)}%
                                </Typography>
                                <Typography sx={{ fontSize: '0.62em', color: labelColor }}>
                                    {isUp ? '▲' : '▼'} {agent.total} tasks
                                </Typography>
                            </Box>
                        </Box>
                    );
                })}
                <Typography sx={{
                    fontSize: '0.7em', color: '#4a90e2', textAlign: 'right',
                    py: 0.8, cursor: 'pointer', '&:hover': { opacity: 0.75 }
                }}>
                    view all →
                </Typography>
            </Box>

            <Divider sx={{ borderColor: isDark ? '#1e2030' : '#e2e8f0' }} />

            {/* ── Featured Workflows ── */}
            <Box sx={{ p: '12px 14px', flexGrow: 1, overflowY: 'auto' }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.88em', color: textColor, mb: 1 }}>
                    Featured Workflows
                </Typography>
                {featuredWorkflows.map((wf, i) => (
                    <Box key={i} sx={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
                        py: 0.9, borderBottom: `1px solid ${borderColor}`,
                        cursor: 'pointer', '&:hover': { opacity: 0.85 }
                    }}>
                        <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start', minWidth: 0 }}>
                            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: wf.color, mt: 0.8, flexShrink: 0 }} />
                            <Box>
                                <Typography sx={{ fontSize: '0.76em', fontWeight: 600, color: textColor, lineHeight: 1.3 }}>
                                    {wf.name}
                                </Typography>
                                <Typography sx={{ fontSize: '0.63em', color: labelColor }}>{wf.desc}</Typography>
                            </Box>
                        </Box>
                        <Typography sx={{ fontSize: '0.63em', color: '#4a90e2', fontWeight: 600, whiteSpace: 'nowrap', ml: 1, mt: 0.3 }}>
                            from {wf.cost}
                        </Typography>
                    </Box>
                ))}
            </Box>
        </Box>
    );
}
