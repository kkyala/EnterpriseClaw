const { Box, Typography, Badge } = MaterialUI;

function MainContent({ events, refreshKey, selectedAgent, notifications, onClearNotifications, isDark }) {
    const [activeTab, setActiveTab] = React.useState(0);
    const [analytics, setAnalytics] = React.useState(null);
    const [time, setTime] = React.useState(new Date());

    // Live clock
    React.useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Analytics for the ticker bar
    React.useEffect(() => {
        fetch('/api/analytics').then(r => r.json()).then(setAnalytics).catch(() => { });
    }, [refreshKey]);

    const navBg = isDark ? '#0d0f1e' : '#1a3a6e';
    const tickerBg = isDark ? '#0b0d1a' : '#152d58';
    const borderNav = 'rgba(255,255,255,0.08)';

    const navItems = [
        { label: 'Dashboard', id: 0, icon: '📊' },
        { label: 'Tasks', id: 1, icon: '⚡' },
        { label: 'Memory', id: 2, icon: '🧠' },
        { label: 'Exec Logs', id: 3, icon: '📋' },
        { label: 'Skills', id: 7, icon: '🎯' },
        { label: 'Workflows', id: 8, icon: '🔄' },
        { label: 'Schedule', id: 9, icon: '📅' },
        { label: 'Groups', id: 10, icon: '👥' },
        { label: 'Integrations', id: 11, icon: '🔌' },
        { label: 'Comms', id: 6, icon: '💬' },
        { label: `Alerts${notifications.length > 0 ? ` (${notifications.length})` : ''}`, id: 4, icon: '🔔' },
        { label: `Events${events.length > 0 ? ` (${events.length})` : ''}`, id: 5, icon: '📡' },
    ];

    // Count orchestrator events for comms badge
    const orchEventCount = events.filter(e =>
        e.event_type && (e.event_type.startsWith('ORCHESTRATOR_') || e.event_type.startsWith('AGENT_MESSAGE'))
    ).length;

    const tickerItems = analytics ? [
        { label: 'Tasks Today', value: analytics.kpis?.tasks_today ?? 0, color: '#4a90e2', dir: '▲' },
        { label: 'Success Rate', value: `${(analytics.kpis?.success_rate ?? 0).toFixed(1)}%`, color: (analytics.kpis?.success_rate ?? 0) >= 70 ? '#2ecc71' : '#e74c3c', dir: (analytics.kpis?.success_rate ?? 0) >= 70 ? '▲' : '▼' },
        { label: 'Cost Today', value: `$${(analytics.kpis?.cost_today ?? 0).toFixed(2)}`, color: '#f39c12', dir: '▲' },
        { label: 'Sys Events', value: events.length, color: '#1abc9c', dir: '▲' },
        { label: 'Agent Comms', value: orchEventCount, color: '#9b59b6', dir: orchEventCount > 0 ? '▲' : '●' },
        { label: 'Active WS', value: 'Connected', color: '#2ecc71', dir: '●' },
    ] : [];

    return (
        <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* ── Top Navigation Bar ── */}
            <Box sx={{
                bgcolor: navBg,
                display: 'flex', alignItems: 'stretch', justifyContent: 'space-between',
                borderBottom: `1px solid ${borderNav}`,
                minHeight: 46, flexShrink: 0, overflow: 'hidden'
            }}>
                {/* Nav items — scrollable if needed */}
                <Box sx={{ display: 'flex', alignItems: 'stretch', overflowX: 'auto', '&::-webkit-scrollbar': { height: 0 } }}>
                    {navItems.map((item) => (
                        <Box key={item.id} onClick={() => setActiveTab(item.id)}
                            sx={{
                                px: 1.2, display: 'flex', alignItems: 'center', gap: 0.4,
                                cursor: 'pointer', position: 'relative',
                                color: activeTab === item.id ? '#4a90e2' : 'rgba(255,255,255,0.65)',
                                fontWeight: activeTab === item.id ? 700 : 400,
                                fontSize: '0.78em', whiteSpace: 'nowrap', flexShrink: 0,
                                userSelect: 'none', transition: 'color 0.15s',
                                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' },
                                ...(activeTab === item.id ? {
                                    '&::after': {
                                        content: '""', position: 'absolute', bottom: 0, left: 0, right: 0,
                                        height: 2, bgcolor: '#4a90e2', borderRadius: '2px 2px 0 0'
                                    }
                                } : {})
                            }}>
                            {item.label}
                            {item.id === 6 && orchEventCount > 0 && (
                                <Box sx={{
                                    width: 16, height: 16, borderRadius: '50%',
                                    bgcolor: '#9b59b6', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.6em', color: '#fff', fontWeight: 700
                                }}>
                                    {orchEventCount > 9 ? '9+' : orchEventCount}
                                </Box>
                            )}
                        </Box>
                    ))}
                </Box>

                {/* Right controls — always visible, flex-shrink 0 */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, pr: 2, flexShrink: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: '#2ecc71', boxShadow: '0 0 5px #2ecc71' }} />
                        <Typography sx={{ color: '#2ecc71', fontSize: '0.72em', fontWeight: 700 }}>Live</Typography>
                    </Box>
                    <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72em', fontFamily: 'monospace' }}>
                        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC
                    </Typography>
                    <Typography onClick={() => setActiveTab(4)}
                        sx={{ color: notifications.length > 0 ? '#f39c12' : 'rgba(255,255,255,0.45)', fontSize: '1em', cursor: 'pointer' }}>
                        🔔{notifications.length > 0 && <span style={{ fontSize: '0.6em', verticalAlign: 'top', color: '#e74c3c' }}>{notifications.length}</span>}
                    </Typography>
                    <Box sx={{ width: 26, height: 26, borderRadius: '50%', bgcolor: '#4a90e2', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                        <Typography sx={{ color: '#fff', fontSize: '0.65em', fontWeight: 800 }}>KK</Typography>
                    </Box>
                </Box>
            </Box>

            {/* ── Metrics Ticker Bar ── */}
            <Box sx={{
                bgcolor: tickerBg,
                display: 'flex', alignItems: 'center',
                borderBottom: `1px solid ${borderNav}`,
                minHeight: 32, flexShrink: 0,
                overflowX: 'auto', '&::-webkit-scrollbar': { height: 0 }
            }}>
                {tickerItems.length === 0 ? (
                    <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.7em', px: 2 }}>
                        Loading metrics…
                    </Typography>
                ) : tickerItems.map((item, i) => (
                    <React.Fragment key={i}>
                        <Box sx={{ px: 3, display: 'flex', alignItems: 'center', gap: 1.5, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            <Typography sx={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.7em' }}>{item.label}</Typography>
                            <Typography sx={{ color: item.color, fontSize: '0.74em', fontWeight: 700 }}>{item.dir} {item.value}</Typography>
                        </Box>
                        {i < tickerItems.length - 1 && <Box sx={{ width: 1, height: 16, bgcolor: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />}
                    </React.Fragment>
                ))}
            </Box>

            {/* ── Content row: center + right panel ── */}
            <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Center content */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, minWidth: 0 }}>
                    {activeTab === 0 && <Dashboard refreshKey={refreshKey} isDark={isDark} onNavigate={id => setActiveTab(id)} />}
                    {activeTab === 1 && <SimpleView selectedAgent={selectedAgent} isDark={isDark} />}
                    {activeTab === 2 && <Memory selectedAgent={selectedAgent} isDark={isDark} />}
                    {activeTab === 3 && <ExecutionLogs refreshKey={refreshKey} isDark={isDark} />}
                    {activeTab === 4 && <Notifications notifications={notifications} onClear={onClearNotifications} isDark={isDark} />}
                    {activeTab === 5 && <SystemLogs events={events} isDark={isDark} />}
                    {activeTab === 6 && <AgentComm refreshKey={refreshKey} isDark={isDark} events={events} />}
                    {activeTab === 7 && <Skills isDark={isDark} refreshKey={refreshKey} />}
                    {activeTab === 8 && <Workflows isDark={isDark} refreshKey={refreshKey} />}
                    {activeTab === 9 && <ScheduledTasks isDark={isDark} refreshKey={refreshKey} />}
                    {activeTab === 10 && <AgentGroups isDark={isDark} refreshKey={refreshKey} />}
                    {activeTab === 11 && <Integrations isDark={isDark} refreshKey={refreshKey} />}
                </Box>

                {/* Right panel — only on Dashboard tab */}
                {activeTab === 0 && <RightPanel refreshKey={refreshKey} isDark={isDark} />}
            </Box>
        </Box>
    );
}
