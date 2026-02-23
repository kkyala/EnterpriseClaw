const {
    Box, Typography, List, ListItem, ListItemText, Paper, CircularProgress, Divider, Chip
} = MaterialUI;

function Memory({ selectedAgent }) {
    const [memories, setMemories] = React.useState([]);
    const [loading, setLoading] = React.useState(false);

    React.useEffect(() => {
        if (!selectedAgent) return;
        setLoading(true);
        fetch(`/api/memories/${encodeURIComponent(selectedAgent)}`)
            .then(res => res.json())
            .then(data => { setMemories(data); setLoading(false); })
            .catch(err => { console.error("Failed to fetch memories:", err); setLoading(false); });
    }, [selectedAgent]);

    if (!selectedAgent) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                <Typography color="textSecondary">Select an agent to view their memory</Typography>
            </Box>
        );
    }

    if (loading) return <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box>;

    return (
        <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Typography variant="h6">Agent Memory</Typography>
                <Chip label={selectedAgent} color="primary" size="small" />
            </Box>

            {memories.length === 0 ? (
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                    <Typography color="textSecondary">No memory entries for {selectedAgent} yet.</Typography>
                    <Typography variant="caption" color="textSecondary">Memories are created as agents process tasks.</Typography>
                </Paper>
            ) : (
                <Paper sx={{ bgcolor: '#2d3047' }}>
                    <List>
                        {memories.map((mem, i) => (
                            <React.Fragment key={mem.id}>
                                <ListItem>
                                    <ListItemText
                                        primary={
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Chip label={mem.role} size="small"
                                                    color={mem.role === 'user' ? 'primary' : 'secondary'} />
                                                <Typography variant="caption" color="textSecondary">
                                                    {new Date(mem.timestamp).toLocaleString()}
                                                </Typography>
                                            </Box>
                                        }
                                        secondary={mem.content}
                                    />
                                </ListItem>
                                {i < memories.length - 1 && <Divider />}
                            </React.Fragment>
                        ))}
                    </List>
                </Paper>
            )}
        </Box>
    );
}
