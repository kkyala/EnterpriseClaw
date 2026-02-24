const { Box, Typography, Badge } = MaterialUI;

function MainContent({ events, refreshKey, selectedAgent, notifications, onClearNotifications, isDark }) {
    const [activeTab, setActiveTab]   = React.useState(0);
    const [analytics, setAnalytics]   = React.useState(null);
    const [time, setTime]             = React.useState(new Date());

    // Live clock
    React.useEffect(() => {
        const t = setInterval(() => setTime(new Date()), 1000);
        return () => clearInterval(t);
    }, []);

    // Analytics for the ticker bar
    React.useEffect(() => {
        fetch('/api/analytics').then(r => r.json()).then(setAnalytics).catch(() => {});
    }, [refreshKey]);

    const navBg     = isDark ? '#0d0f1e' : '#1a3a6e';
    const tickerBg  = isDark ? '#0b0d1a' : '#152d58';
    const borderNav = 'rgba(255,255,255,0.08)';

    const navItems = [
        { label: 'Dashboard',                        id: 0 },
        { label: 'Tasks',                            id: 1 },
        { label: 'Memory',                           id: 2 },
        { label: 'Exec Logs',                        id: 3 },
        { label: `Alerts${notifications.length > 0 ? ` (${notifications.length})` : ''}`, id: 4 },
        { label: `Events${events.length       > 0 ? ` (${events.length})`       : ''}`, id: 5 },
    ];

    const tickerItems = analytics ? [
        { label: 'Tasks Today',  value: analytics.kpis?.tasks_today ?? 0,            color: '#4a90e2', dir: '▲' },
        { label: 'Success Rate', value: `${(analytics.kpis?.success_rate ?? 0).toFixed(1)}%`, color: (analytics.kpis?.success_rate ?? 0) >= 70 ? '#2ecc71' : '#e74c3c', dir: (analytics.kpis?.success_rate ?? 0) >= 70 ? '▲' : '▼' },
        { label: 'Cost Today',   value: `$${(analytics.kpis?.cost_today  ?? 0).toFixed(2)}`,  color: '#f39c12', dir: '▲' },
        { label: 'Sys Events',   value: events.length,                                color: '#1abc9c', dir: '▲' },
        { label: 'Alerts',       value: notifications.length,                         color: notifications.length > 0 ? '#e74c3c' : '#6c7293', dir: notifications.length > 0 ? '▲' : '▼' },
        { label: 'Active WS',    value: 'Connected',                                  color: '#2ecc71', dir: '●' },
    ] : [];

    return (
        <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>

            {/* ── Top Navigation Bar (Dhan-style) ── */}
            <Box sx={{
                bgcolor: navBg,
                display: 'flex', alignItems: 'stretch', justifyContent: 'space-between',
                borderBottom: `1px solid ${borderNav}`,
                minHeight: 48, flexShrink: 0
            }}>
                {/* Nav items */}
                <Box sx={{ display: 'flex', alignItems: 'stretch' }}>
                    {navItems.map((item) => (
                        <Box key={item.id} onClick={() => setActiveTab(item.id)}
                            sx={{
                                px: 2.5, display: 'flex', alignItems: 'center',
                                cursor: 'pointer', position: 'relative',
                                color: activeTab === item.id ? '#4a90e2' : 'rgba(255,255,255,0.65)',
                                fontWeight: activeTab === item.id ? 700 : 400,
                                fontSize: '0.84em',
                                userSelect: 'none',
                                transition: 'color 0.15s',
                                '&:hover': { color: '#fff', bgcolor: 'rgba(255,255,255,0.05)' },
                                ...(activeTab === item.id ? {
                                    '&::after': {
                                        content: '""', position: 'absolute', bottom: 0, left: 0, right: 0,
                                        height: 2, bgcolor: '#4a90e2', borderRadius: '2px 2px 0 0'
                                    }
                                } : {})
                            }}>
                            {item.label}
                        </Box>
                    ))}
                </Box>

                {/* Right controls */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, pr: 2.5 }}>
                    {/* Live dot */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.6 }}>
                        <Box sx={{
                            width: 8, height: 8, borderRadius: '50%', bgcolor: '#2ecc71',
                            boxShadow: '0 0 6px #2ecc71'
                        }} />
                        <Typography sx={{ color: '#2ecc71', fontSize: '0.74em', fontWeight: 700 }}>Live</Typography>
                    </Box>

                    {/* Time */}
                    <Typography sx={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.74em', fontFamily: 'monospace', letterSpacing: 0.5 }}>
                        {time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })} UTC
                    </Typography>

                    {/* Notification + avatar icons */}
                    <Typography sx={{ color: 'rgba(255,255,255,0.55)', fontSize: '1.05em', cursor: 'pointer', '&:hover': { color: '#fff' } }}>
                        🔔
                    </Typography>
                    <Box sx={{
                        width: 28, height: 28, borderRadius: '50%', bgcolor: '#4a90e2',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer'
                    }}>
                        <Typography sx={{ color: '#fff', fontSize: '0.7em', fontWeight: 800 }}>KK</Typography>
                    </Box>
                </Box>
            </Box>

            {/* ── Metrics Ticker Bar (index bar style) ── */}
            <Box sx={{
                bgcolor: tickerBg,
                display: 'flex', alignItems: 'center',
                borderBottom: `1px solid ${borderNav}`,
                minHeight: 34, flexShrink: 0,
                overflowX: 'auto', '&::-webkit-scrollbar': { height: 2 }
            }}>
                {tickerItems.length === 0 ? (
                    <Typography sx={{ color: 'rgba(255,255,255,0.3)', fontSize: '0.72em', px: 2 }}>
                        Loading metrics…
                    </Typography>
                ) : tickerItems.map((item, i) => (
                    <React.Fragment key={i}>
                        <Box sx={{ px: 2, display: 'flex', alignItems: 'center', gap: 1, whiteSpace: 'nowrap', flexShrink: 0 }}>
                            <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72em' }}>
                                {item.label}
                            </Typography>
                            <Typography sx={{ color: item.color, fontSize: '0.76em', fontWeight: 700 }}>
                                {item.dir} {item.value}
                            </Typography>
                        </Box>
                        {i < tickerItems.length - 1 && (
                            <Box sx={{ width: 1, height: 18, bgcolor: 'rgba(255,255,255,0.1)', flexShrink: 0 }} />
                        )}
                    </React.Fragment>
                ))}
            </Box>

            {/* ── Content row: center + right panel ── */}
            <Box sx={{ flexGrow: 1, display: 'flex', overflow: 'hidden' }}>
                {/* Center content */}
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2, minWidth: 0 }}>
                    {activeTab === 0 && <Dashboard refreshKey={refreshKey} isDark={isDark} />}
                    {activeTab === 1 && <SimpleView selectedAgent={selectedAgent} />}
                    {activeTab === 2 && <Memory selectedAgent={selectedAgent} />}
                    {activeTab === 3 && <ExecutionLogs refreshKey={refreshKey} />}
                    {activeTab === 4 && <Notifications notifications={notifications} onClear={onClearNotifications} />}
                    {activeTab === 5 && <SystemLogs events={events} />}
                </Box>

                {/* Right panel — only on Dashboard tab */}
                {activeTab === 0 && <RightPanel refreshKey={refreshKey} isDark={isDark} />}
            </Box>
        </Box>
    );
}
