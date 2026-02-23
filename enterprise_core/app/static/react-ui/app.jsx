const {
    CssBaseline, ThemeProvider, createTheme, Box, Snackbar, Alert, IconButton, Typography
} = MaterialUI;

const darkTheme = createTheme({
    palette: {
        mode: 'dark',
        primary: { main: '#4a90e2' },
        secondary: { main: '#2ecc71' },
        error: { main: '#e74c3c' },
        warning: { main: '#f39c12' },
        background: { default: '#1e202f', paper: '#2d3047' },
    },
    typography: { fontFamily: 'Roboto, Segoe UI, sans-serif' },
    components: { MuiCard: { styleOverrides: { root: { border: '1px solid #43455c' } } } }
});

const lightTheme = createTheme({
    palette: {
        mode: 'light',
        primary: { main: '#2563eb' },
        secondary: { main: '#059669' },
        error: { main: '#dc2626' },
        warning: { main: '#d97706' },
        background: { default: '#f8fafc', paper: '#ffffff' },
        text: { primary: '#1e293b', secondary: '#64748b' },
    },
    typography: { fontFamily: 'Roboto, Segoe UI, sans-serif' },
    components: { MuiCard: { styleOverrides: { root: { border: '1px solid #e2e8f0' } } } }
});

function App() {
    const [isDark, setIsDark] = React.useState(true);
    const [selectedAgent, setSelectedAgent] = React.useState(null);
    const [currentUser, setCurrentUser] = React.useState('analyst_user');
    const [events, setEvents] = React.useState([]);
    const [toast, setToast] = React.useState(null);
    const [notifications, setNotifications] = React.useState([]);
    const [refreshKey, setRefreshKey] = React.useState(0);
    const sessionId = React.useRef(`session_${Date.now()}`);

    const theme = isDark ? darkTheme : lightTheme;

    const addNotification = (severity, message) => {
        setNotifications(prev => [{ severity, message, time: new Date().toLocaleString() }, ...prev]);
        setToast({ severity, message });
    };

    React.useEffect(() => {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${wsProtocol}//${window.location.host}/ws/events`);
        ws.onopen = () => console.log('[WS] Connected');
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                setEvents(prev => [data, ...prev].slice(0, 200));
                if (data.event_type === 'TASK_COMPLETED') {
                    addNotification('success', `Task completed via ${data.tool_name || 'tool'} (task:${(data.task_id || '').substring(0, 8)})`);
                    setRefreshKey(prev => prev + 1);
                } else if (data.event_type === 'TASK_FAILED') {
                    addNotification('error', `Task failed: ${data.error || 'unknown'} (task:${(data.task_id || '').substring(0, 8)})`);
                    setRefreshKey(prev => prev + 1);
                }
            } catch (e) { console.error('[WS] Parse error:', e); }
        };
        ws.onclose = () => console.log('[WS] Disconnected');
        return () => ws.close();
    }, []);

    const pollForResult = async (taskId) => {
        for (let i = 0; i < 15; i++) {
            await new Promise(r => setTimeout(r, 1000));
            try {
                const logs = await (await fetch('/api/task-logs')).json();
                const task = logs.find(l => l.task_id === taskId);
                if (task && task.status !== 'QUEUED' && task.status !== 'PENDING') return task;
            } catch {} 
        }
        return null;
    };

    const handleTaskSubmit = async (task, agentName) => {
        try {
            const response = await fetch('/api/tasks', {
                method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Username': currentUser },
                body: JSON.stringify({ task, tenant_id: 'acme_corp', persona_name: agentName, session_id: sessionId.current, source: 'dashboard' })
            });
            if (!response.ok) throw new Error((await response.json()).detail || 'Error');
            const result = await response.json();
            addNotification('info', `Task queued for ${agentName} (${result.task_id.substring(0, 8)}...)`);
            const taskResult = await pollForResult(result.task_id);
            if (taskResult) {
                if (taskResult.status === 'success') {
                    try { const p = JSON.parse(taskResult.response_payload); addNotification('success', `${agentName}: ${p.message || p.status || 'Completed'}`); }
                    catch { addNotification('success', `Task completed by ${agentName}`); }
                } else { addNotification('error', `Task failed for ${agentName}`); }
                setRefreshKey(prev => prev + 1);
            }
        } catch (error) { addNotification('error', `Failed: ${error.message}`); }
    };

    // Update scrollbar colors based on theme
    React.useEffect(() => {
        document.documentElement.style.setProperty('--scrollbar-track', isDark ? '#1e202f' : '#f1f5f9');
        document.documentElement.style.setProperty('--scrollbar-thumb', isDark ? '#4a5568' : '#94a3b8');
        document.body.style.backgroundColor = isDark ? '#1e202f' : '#f8fafc';
    }, [isDark]);

    return (
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <Box sx={{ display: 'flex', height: 'calc(100vh - 3px)', overflow: 'hidden' }}>
                <Sidebar selectedAgent={selectedAgent} setSelectedAgent={setSelectedAgent}
                    currentUser={currentUser} setCurrentUser={setCurrentUser} onTaskSubmit={handleTaskSubmit}
                    isDark={isDark} setIsDark={setIsDark} />
                <MainContent events={events} refreshKey={refreshKey} selectedAgent={selectedAgent}
                    notifications={notifications} onClearNotifications={() => setNotifications([])} isDark={isDark} />
            </Box>
            <Snackbar open={!!toast} autoHideDuration={5000} onClose={() => setToast(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                {toast && <Alert onClose={() => setToast(null)} severity={toast.severity} sx={{ width: '100%', maxWidth: 500 }}>{toast.message}</Alert>}
            </Snackbar>
        </ThemeProvider>
    );
}

ReactDOM.render(<App />, document.getElementById('root'));
