const { Box, Tabs, Tab, Badge } = MaterialUI;

function MainContent({ events, refreshKey, selectedAgent, notifications, onClearNotifications, isDark }) {
    const [activeTab, setActiveTab] = React.useState(0);
    const tabBg = isDark ? '#27293d' : '#ffffff';

    return (
        <Box component="main" sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: tabBg }}>
                <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)}>
                    <Tab label="Dashboard" />
                    <Tab label="Task Results" />
                    <Tab label="Memory" />
                    <Tab label="Execution Logs" />
                    <Tab label={<Badge badgeContent={notifications.length} color="warning" max={99}>Notifications</Badge>} />
                    <Tab label={<Badge badgeContent={events.length} color="primary" max={99}>System Events</Badge>} />
                </Tabs>
            </Box>
            <Box sx={{ flexGrow: 1, p: 2, overflowY: 'auto' }}>
                {activeTab === 0 && <Dashboard refreshKey={refreshKey} />}
                {activeTab === 1 && <SimpleView selectedAgent={selectedAgent} />}
                {activeTab === 2 && <Memory selectedAgent={selectedAgent} />}
                {activeTab === 3 && <ExecutionLogs refreshKey={refreshKey} />}
                {activeTab === 4 && <Notifications notifications={notifications} onClear={onClearNotifications} />}
                {activeTab === 5 && <SystemLogs events={events} />}
            </Box>
        </Box>
    );
}
