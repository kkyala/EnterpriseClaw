const { Box, Typography, Button } = MaterialUI;

function SystemLogs({ events, isDark }) {
    const [filter, setFilter]       = React.useState('ALL');
    const [autoScroll, setAuto]     = React.useState(true);
    const [localEvents, setLocal]   = React.useState([]);
    const scrollRef                 = React.useRef(null);

    const bg          = isDark ? '#080a14' : '#f0f4f8';
    const borderColor = isDark ? '#1e2030' : '#e2e8f0';
    const labelColor  = isDark ? '#6c7293' : '#64748b';
    const textColor   = isDark ? '#c8cce8' : '#1e293b';
    const rowBorder   = isDark ? '#0d0f1e' : '#e0e8f0';

    const EVENT_TYPES = ['ALL', 'TASK_QUEUED', 'TASK_STARTED', 'TOOL_EXECUTED', 'TASK_COMPLETED', 'TASK_FAILED'];
    const EVENT_META = {
        TASK_QUEUED:    { color: '#4a90e2', icon: '⏳', short: 'QUEUED'    },
        TASK_STARTED:   { color: '#f39c12', icon: '▶️', short: 'STARTED'   },
        TOOL_EXECUTED:  { color: '#9b59b6', icon: '⚙️', short: 'TOOL'      },
        TASK_COMPLETED: { color: '#2ecc71', icon: '✅', short: 'COMPLETED' },
        TASK_FAILED:    { color: '#e74c3c', icon: '❌', short: 'FAILED'    },
    };

    // Merge incoming events
    React.useEffect(() => {
        if (events.length > localEvents.length) {
            setLocal(events);
        }
    }, [events]);

    // Auto-scroll to bottom of terminal
    React.useEffect(() => {
        if (autoScroll && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [localEvents, autoScroll]);

    const filtered = filter === 'ALL' ? localEvents : localEvents.filter(e => e.event_type === filter);

    const counts = { ALL: localEvents.length };
    EVENT_TYPES.slice(1).forEach(t => { counts[t] = localEvents.filter(e => e.event_type === t).length; });

    const fmtTime = ts => {
        if (!ts) return '--:--:--';
        return new Date(ts * 1000).toLocaleTimeString('en-US', { hour12: false });
    };

    return (
        <Box sx={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 200px)' }}>
            {/* Header row */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexShrink: 0 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '1.1em', color: textColor }}>
                        Real-Time System Events
                    </Typography>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#2ecc71', boxShadow: '0 0 6px #2ecc71' }} />
                    <Typography sx={{ fontSize: '0.78em', color: labelColor }}>
                        {localEvents.length} captured
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 0.8 }}>
                    <Button size="small" variant={autoScroll ? 'contained' : 'outlined'}
                        onClick={() => setAuto(!autoScroll)}
                        sx={{ fontSize: '0.68em', height: 28 }}>
                        {autoScroll ? '📌 Auto-scroll' : '⏸ Paused'}
                    </Button>
                    <Button size="small" variant="outlined"
                        onClick={() => setLocal([])}
                        sx={{ fontSize: '0.68em', height: 28 }}>
                        🗑 Clear
                    </Button>
                </Box>
            </Box>

            {/* Event type filter pills */}
            <Box sx={{ display: 'flex', gap: 0.6, mb: 1.5, flexWrap: 'wrap', flexShrink: 0 }}>
                {EVENT_TYPES.map(type => {
                    const meta = EVENT_META[type];
                    const active = filter === type;
                    return (
                        <Box key={type} onClick={() => setFilter(type)}
                            sx={{
                                px: 1.2, py: 0.4, borderRadius: 1, cursor: 'pointer',
                                fontSize: '0.68em', fontWeight: 600,
                                display: 'flex', alignItems: 'center', gap: 0.5,
                                bgcolor: active ? (meta?.color || '#4a90e2') : (isDark ? '#1e2030' : '#e2e8f0'),
                                color: active ? '#fff' : labelColor,
                                border: `1px solid ${active ? 'transparent' : borderColor}`,
                                transition: 'all 0.15s',
                            }}>
                            {meta?.icon} {meta?.short || 'ALL'}
                            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 4, padding: '0 4px', fontSize: '0.9em', minWidth: 18, textAlign: 'center' }}>
                                {counts[type] || 0}
                            </span>
                        </Box>
                    );
                })}
            </Box>

            {/* Terminal */}
            {filtered.length === 0 ? (
                <Box sx={{
                    flexGrow: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    border: `1px solid ${borderColor}`, borderRadius: 1.5,
                    bgcolor: bg, fontFamily: 'monospace'
                }}>
                    <Typography sx={{ fontSize: '2.5em', mb: 1 }}>📡</Typography>
                    <Typography sx={{ color: labelColor }}>
                        {localEvents.length === 0
                            ? 'Waiting for events… Submit a task to see the live event stream.'
                            : `No ${filter} events captured.`}
                    </Typography>
                </Box>
            ) : (
                <Box ref={scrollRef} sx={{
                    flexGrow: 1, overflowY: 'auto',
                    bgcolor: bg,
                    border: `1px solid ${borderColor}`,
                    borderRadius: 1.5,
                    p: '8px 10px',
                    fontFamily: 'monospace',
                }}>
                    {filtered.map((event, i) => {
                        const meta  = EVENT_META[event.event_type] || { color: '#888', icon: '•', short: 'EVENT' };
                        const ts    = fmtTime(event.timestamp);
                        const hasDetails = event.task_id || event.tool_name || event.persona_name || event.status || event.error;

                        return (
                            <Box key={i} sx={{
                                display: 'flex', gap: 1.2, alignItems: 'flex-start',
                                py: 0.55, borderBottom: `1px solid ${rowBorder}`,
                                '&:last-child': { borderBottom: 'none' },
                            }}>
                                {/* Timestamp */}
                                <Typography sx={{ fontSize: '0.7em', color: isDark ? '#3d4a60' : '#94a3b8', minWidth: 64, flexShrink: 0, mt: 0.2, fontFamily: 'monospace' }}>
                                    {ts}
                                </Typography>

                                {/* Event type badge */}
                                <Box sx={{
                                    px: 1, py: 0.1,
                                    borderRadius: 0.5,
                                    bgcolor: `${meta.color}18`,
                                    border: `1px solid ${meta.color}40`,
                                    color: meta.color,
                                    fontSize: '0.63em', fontWeight: 700,
                                    minWidth: 96, textAlign: 'center',
                                    whiteSpace: 'nowrap', flexShrink: 0, mt: 0.15
                                }}>
                                    {meta.icon} {meta.short}
                                </Box>

                                {/* Event details */}
                                {hasDetails && (
                                    <Typography component="span" sx={{ fontSize: '0.74em', color: isDark ? '#7a8baa' : '#475569', wordBreak: 'break-all', lineHeight: 1.55 }}>
                                        {event.task_id && (
                                            <span> <span style={{ color: isDark ? '#6ab0f5' : '#3b6bcc' }}>task:</span>
                                            <span style={{ color: isDark ? '#9bb5d4' : '#4a7ab5' }}>{event.task_id.substring(0, 8)}</span></span>
                                        )}
                                        {event.tool_name && (
                                            <span> <span style={{ color: '#c792ea' }}>tool:</span>
                                            <span style={{ color: isDark ? '#d3b8f0' : '#7c3aed' }}>{event.tool_name}</span></span>
                                        )}
                                        {event.persona_name && (
                                            <span> <span style={{ color: '#89ddff' }}>agent:</span>
                                            <span style={{ color: isDark ? '#b4e4ff' : '#0284c7' }}>{event.persona_name}</span></span>
                                        )}
                                        {event.status && (
                                            <span> <span style={{ color: labelColor }}>status:</span>
                                            <span style={{ color: ['success','completed'].includes((event.status || '').toLowerCase()) ? '#2ecc71' : '#e74c3c' }}>{event.status}</span></span>
                                        )}
                                        {event.error && (
                                            <span> <span style={{ color: '#e74c3c' }}>error:</span>
                                            <span style={{ color: '#ff8a8a' }}>{event.error}</span></span>
                                        )}
                                        {event.source && (
                                            <span> <span style={{ color: labelColor }}>src:</span>
                                            <span style={{ color: isDark ? '#aaa' : '#666' }}>{event.source}</span></span>
                                        )}
                                    </Typography>
                                )}
                            </Box>
                        );
                    })}
                </Box>
            )}
        </Box>
    );
}
