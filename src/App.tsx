import React from 'react';
import {
  Alert, AppBar, Avatar, Box, Button, Card, CardContent, Chip, CircularProgress,
  Dialog, DialogActions, DialogContent, DialogTitle, Divider, Drawer, FormControl,
  IconButton, InputLabel, LinearProgress, List, ListItemButton, ListItemIcon,
  ListItemText, MenuItem, Paper, Select, Snackbar, Stack, Switch, TextField,
  Toolbar, Typography, useMediaQuery, useTheme,
} from '@mui/material';
import DashboardRounded from '@mui/icons-material/DashboardRounded';
import CableRounded from '@mui/icons-material/CableRounded';
import FactCheckRounded from '@mui/icons-material/FactCheckRounded';
import FolderOpenRounded from '@mui/icons-material/FolderOpenRounded';
import AdminPanelSettingsRounded from '@mui/icons-material/AdminPanelSettingsRounded';
import LightModeRounded from '@mui/icons-material/LightModeRounded';
import DarkModeRounded from '@mui/icons-material/DarkModeRounded';
import MenuRounded from '@mui/icons-material/MenuRounded';
import AddRounded from '@mui/icons-material/AddRounded';
import SearchRounded from '@mui/icons-material/SearchRounded';
import ShieldRounded from '@mui/icons-material/ShieldRounded';
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded';
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded';
import MemoryRounded from '@mui/icons-material/MemoryRounded';
import LogoutRounded from '@mui/icons-material/LogoutRounded';
import { api, hashFile, readUsbDevices, type Feature, type RepairRecord, type Session } from './api';

type Page = 'home' | 'devices' | 'records' | 'firmware' | 'admin';
const drawerWidth = 252;
const featureNames: Record<string, { label: string; description: string }> = {
  device_check: { label: 'Device checkup', description: 'USB identity and a clear technician check list.' },
  repair_records: { label: 'Repair records', description: 'Save and review real service notes in Cloudflare.' },
  firmware_check: { label: 'Firmware file check', description: 'Check a local file and compare its SHA-256 fingerprint.' },
};
const navigation: Array<{ page: Page; label: string; icon: React.ReactNode; feature?: string }> = [
  { page: 'home', label: 'Overview', icon: <DashboardRounded /> },
  { page: 'devices', label: 'Device checkup', icon: <CableRounded />, feature: 'device_check' },
  { page: 'records', label: 'Repair records', icon: <FactCheckRounded />, feature: 'repair_records' },
  { page: 'firmware', label: 'Firmware file check', icon: <FolderOpenRounded />, feature: 'firmware_check' },
];

export default function App({ mode, onToggleTheme }: { mode: 'light' | 'dark'; onToggleTheme: () => void }) {
  const theme = useTheme();
  const compact = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileNav, setMobileNav] = React.useState(false);
  const [page, setPage] = React.useState<Page>('home');
  const [session, setSession] = React.useState<Session | null>(null);
  const [initialized, setInitialized] = React.useState(true);
  const [features, setFeatures] = React.useState<Feature[]>([]);
  const [records, setRecords] = React.useState<RepairRecord[]>([]);
  const [busy, setBusy] = React.useState(true);
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');

  const reload = React.useCallback(async () => {
    setBusy(true); setError('');
    try {
      const auth = await api.authStatus();
      setInitialized(auth.initialized);
      if (!auth.initialized) { setSession(null); setFeatures([]); return; }
      const state = await api.session();
      setSession(state.session); setFeatures(state.features);
      if (state.features.some(feature => feature.key === 'repair_records' && feature.enabled)) {
        const result = await api.records(); setRecords(result.records);
      }
    } catch (reason) {
      if (reason instanceof Error && reason.message.includes('Sign-in is required')) { setSession(null); setError(''); }
      else setError(reason instanceof Error ? reason.message : 'Could not reach the service.');
    }
    finally { setBusy(false); }
  }, []);
  React.useEffect(() => { void reload(); }, [reload]);

  const enabled = (key: string) => features.find(item => item.key === key)?.enabled ?? true;
  const visibleNav = navigation.filter(item => !item.feature || enabled(item.feature));
  const go = (next: Page) => { setPage(next); setMobileNav(false); setError(''); };
  const saveRecord = async (record: Pick<RepairRecord, 'device' | 'issue' | 'work' | 'outcome'>) => {
    const created = await api.createRecord(record); setRecords(current => [created.record, ...current]); setNotice('Repair note saved.');
  };

  const navContents = <Box className="nav-content">
    <Box className="brand-lockup"><Avatar className="brand-mark">G</Avatar><Box><Typography fontWeight={800}>GeloTech</Typography><Typography variant="caption" color="text.secondary">TECHNICIAN WORKSPACE</Typography></Box></Box>
    <Typography className="nav-label" variant="overline">WORKSPACE</Typography>
    <List disablePadding>{visibleNav.map(item => <ListItemButton key={item.page} selected={page === item.page} onClick={() => go(item.page)} className="nav-item"><ListItemIcon>{item.icon}</ListItemIcon><ListItemText primary={item.label} /></ListItemButton>)}</List>
    {session?.isAdmin && <><Typography className="nav-label admin-label" variant="overline">OWNER</Typography><List disablePadding><ListItemButton selected={page === 'admin'} onClick={() => go('admin')} className="nav-item"><ListItemIcon><AdminPanelSettingsRounded /></ListItemIcon><ListItemText primary="Admin controls" /></ListItemButton></List></>}
    <Box className="nav-footer"><ShieldRounded fontSize="small" /><Typography variant="caption">Private technician workspace</Typography></Box>
  </Box>;

  const title = page === 'home' ? 'Overview' : page === 'devices' ? 'Device checkup' : page === 'records' ? 'Repair records' : page === 'firmware' ? 'Firmware file check' : 'Admin controls';
  if (!busy && !session) return <AuthGate initialized={initialized} serviceError={error} onRetry={() => void reload()} onAuthenticated={state => { setSession(state.session); setFeatures(state.features); setError(''); void reload(); }} />;
  return <Box className="app-shell">
    {compact ? <Drawer open={mobileNav} onClose={() => setMobileNav(false)} PaperProps={{ className: 'drawer-paper' }}>{navContents}</Drawer> : <Drawer variant="permanent" PaperProps={{ className: 'drawer-paper desktop-drawer' }}>{navContents}</Drawer>}
    <Box className="main-column" sx={{ ml: compact ? 0 : `${drawerWidth}px` }}>
      <AppBar position="sticky" color="inherit" elevation={0} className="topbar"><Toolbar className="topbar-inner">
        {compact && <IconButton aria-label="Open menu" onClick={() => setMobileNav(true)}><MenuRounded /></IconButton>}
        <Box className="topbar-title"><Typography variant="caption" color="text.secondary">TECHNICIAN WORKSPACE</Typography><Typography variant="h6" fontWeight={750}>{title}</Typography></Box>
        <Box flexGrow={1} />
        <IconButton aria-label={`Switch to ${mode === 'dark' ? 'light' : 'dark'} mode`} onClick={onToggleTheme}>{mode === 'dark' ? <LightModeRounded /> : <DarkModeRounded />}</IconButton>
        {session && <IconButton aria-label="Sign out" onClick={async () => { try { await api.logout(); } finally { setSession(null); setPage('home'); } }}><LogoutRounded /></IconButton>}
        <Avatar className="user-avatar">{session?.email?.[0]?.toUpperCase() || 'T'}</Avatar>
      </Toolbar></AppBar>
      <Box component="main" className="page-content">
        {error && <Alert severity="error" action={<Button color="inherit" size="small" onClick={() => void reload()}>Retry</Button>} className="error-banner">{error}</Alert>}
        {busy && <LinearProgress className="loading-line" />}
        {page === 'home' && <Dashboard records={records} go={go} enabled={enabled} session={session} busy={busy} />}
        {page === 'devices' && enabled('device_check') && <DeviceCheck onError={setError} onNotice={setNotice} />}
        {page === 'records' && enabled('repair_records') && <Records records={records} onSave={saveRecord} />}
        {page === 'firmware' && enabled('firmware_check') && <FirmwareCheck />}
        {page === 'admin' && session?.isAdmin && <AdminPanel features={features} onFeatureChange={async (key, value) => {
          try { const result = await api.setFeature(key, value); setFeatures(current => current.map(item => item.key === key ? result.feature : item)); setNotice('Website setting updated.'); }
          catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not update this setting.'); }
        }} />}
        {!busy && page !== 'home' && ((page === 'admin' && !session?.isAdmin) || (page !== 'admin' && !enabled(navigation.find(item => item.page === page)?.feature || ''))) && <Alert severity="info">This area is turned off by the site owner or is not available to your account.</Alert>}
        <Box className="page-footnote"><Typography variant="caption">Device actions that can erase data or change security settings are not offered from this browser workspace.</Typography></Box>
      </Box>
    </Box>
    <Snackbar open={Boolean(notice)} autoHideDuration={3500} onClose={() => setNotice('')} message={notice} />
  </Box>;
}

function Dashboard({ records, go, enabled, session, busy }: { records: RepairRecord[]; go: (page: Page) => void; enabled: (key: string) => boolean; session: Session | null; busy: boolean }) {
  const active = records.filter(record => record.outcome !== 'completed').length;
  return <Stack spacing={3}>
    <Box className="welcome-row"><Box><Typography variant="h4" fontWeight={800}>Good to have you here{session?.email ? `, ${session.email.split('@')[0]}` : ''}.</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Choose a check, save the work you did, and keep each repair easy to follow.</Typography></Box><Chip icon={<ShieldRounded />} label="Secure workspace" color="success" variant="outlined" /></Box>
    <Box className="stat-grid">
      <StatCard label="Repair notes" value={busy ? '—' : records.length} detail="Saved service records" icon={<FactCheckRounded />} />
      <StatCard label="Still in progress" value={busy ? '—' : active} detail="Repairs to follow up" icon={<MemoryRounded />} />
      <StatCard label="Tools available" value={Object.keys(featureNames).filter(enabled).length} detail="Enabled for your workspace" icon={<CheckCircleRounded />} />
    </Box>
    <Box><Box className="section-heading"><Box><Typography variant="h5" fontWeight={750}>Start a task</Typography><Typography color="text.secondary">Small, clear steps to help with the next device on your bench.</Typography></Box></Box>
      <Box className="tool-grid">
        {enabled('device_check') && <ToolCard icon={<CableRounded />} title="Check a connected device" description="See what your browser can identify over USB, then work through a safe checklist." action="Open device checkup" onClick={() => go('devices')} />}
        {enabled('repair_records') && <ToolCard icon={<FactCheckRounded />} title="Write a repair note" description="Record the device, reported problem, work completed, and current outcome." action="Open repair records" onClick={() => go('records')} />}
        {enabled('firmware_check') && <ToolCard icon={<FolderOpenRounded />} title="Check a firmware file" description="Calculate its SHA-256 fingerprint in your browser and compare it with a trusted value." action="Check a file" onClick={() => go('firmware')} />}
      </Box>
    </Box>
    <Alert severity="info" icon={<ShieldRounded />}>Your device files stay on this device during checks. Repair notes are stored in the private Cloudflare workspace.</Alert>
  </Stack>;
}

function StatCard({ label, value, detail, icon }: { label: string; value: number | string; detail: string; icon: React.ReactNode }) {
  return <Card><CardContent className="stat-content"><Avatar className="stat-icon">{icon}</Avatar><Box><Typography variant="body2" color="text.secondary">{label}</Typography><Typography variant="h4" fontWeight={800}>{value}</Typography><Typography variant="caption" color="text.secondary">{detail}</Typography></Box></CardContent></Card>;
}

function ToolCard({ icon, title, description, action, onClick }: { icon: React.ReactNode; title: string; description: string; action: string; onClick: () => void }) {
  return <Card className="tool-card"><CardContent><Avatar className="tool-icon">{icon}</Avatar><Typography variant="h6" fontWeight={750} sx={{ mt: 2 }}>{title}</Typography><Typography color="text.secondary" sx={{ minHeight: 52, mt: .5 }}>{description}</Typography><Button endIcon={<SearchRounded />} onClick={onClick} sx={{ mt: 1, px: 0 }}>{action}</Button></CardContent></Card>;
}

function PageIntro({ eyebrow, title, text, children }: { eyebrow: string; title: string; text: string; children?: React.ReactNode }) {
  return <Box className="page-intro"><Box><Typography variant="overline" color="primary">{eyebrow}</Typography><Typography variant="h4" fontWeight={800}>{title}</Typography><Typography color="text.secondary" sx={{ mt: .75, maxWidth: 760 }}>{text}</Typography></Box>{children}</Box>;
}

function DeviceCheck({ onError, onNotice }: { onError: (message: string) => void; onNotice: (message: string) => void }) {
  const [devices, setDevices] = React.useState<Array<{ name: string; vendorId: number; productId: number }>>([]);
  const [scanning, setScanning] = React.useState(false);
  const [checked, setChecked] = React.useState<string[]>([]);
  const [hasScanned, setHasScanned] = React.useState(false);
  const checks = [
    ['authorization', 'Confirm the customer asked for this service', 'Make sure you have permission before connecting or changing a device.'],
    ['backup', 'Ask about a current backup', 'Check whether the customer has a safe copy of important photos and files.'],
    ['condition', 'Write down the device condition', 'Record visible damage, moisture concerns, and any warning shown on screen.'],
    ['power', 'Check power and cable', 'Use a known-good cable and power source before diagnosing a connection issue.'],
  ];
  const scan = async () => {
    setScanning(true); onError(''); setHasScanned(true);
    try { const result = await readUsbDevices(); setDevices(result); onNotice(result.length ? 'USB check finished. Only device names and IDs were read.' : 'No USB device was selected.'); }
    catch (reason) { onError(reason instanceof Error ? reason.message : 'Could not check USB devices.'); }
    finally { setScanning(false); }
  };
  return <Stack spacing={3}>
    <PageIntro eyebrow="SAFE FIRST STEPS" title="Device checkup" text="This check helps you confirm the connection and prepare a clear repair. It only reads the USB device name and ID the browser is allowed to see." />
    <Card><CardContent><Box className="panel-heading"><Avatar className="tool-icon"><CableRounded /></Avatar><Box flex={1}><Typography variant="h6" fontWeight={750}>Check USB connection</Typography><Typography color="text.secondary">Your browser will ask before it reads a USB device. No commands are sent to the phone.</Typography></Box><Button variant="contained" onClick={() => void scan()} disabled={scanning}>{scanning ? <CircularProgress size={20} color="inherit" /> : 'Choose USB device'}</Button></Box>
      {!hasScanned && <Typography className="subtle-note">Use Chrome or Edge on a computer with a secure website connection for USB device details.</Typography>}
      {hasScanned && devices.length === 0 && !scanning && <Alert severity="info" sx={{ mt: 2 }}>No device was selected. You can still use the preparation checklist below.</Alert>}
      {devices.map((device, index) => <Paper className="device-row" key={`${device.vendorId}-${device.productId}-${index}`}><Avatar className="device-avatar"><MemoryRounded /></Avatar><Box><Typography fontWeight={700}>{device.name}</Typography><Typography variant="body2" color="text.secondary">USB ID {device.vendorId.toString(16).padStart(4, '0')}:{device.productId.toString(16).padStart(4, '0')}</Typography></Box><Chip size="small" color="success" label="Visible to browser" /></Paper>)}
    </Card>
    <Card><CardContent><Typography variant="h6" fontWeight={750}>Before you begin</Typography><Typography color="text.secondary" sx={{ mb: 1.5 }}>Tick each step as you complete it. This checklist does not change your device.</Typography>
      <Stack divider={<Divider flexItem />}>
        {checks.map(([key, title, description]) => <Box className="check-row" key={key}><Switch checked={checked.includes(key)} onChange={event => setChecked(current => event.target.checked ? [...current, key] : current.filter(item => item !== key))} inputProps={{ 'aria-label': title }} /><Box><Typography fontWeight={650}>{title}</Typography><Typography variant="body2" color="text.secondary">{description}</Typography></Box></Box>)}
      </Stack>
      <Alert severity={checked.length === checks.length ? 'success' : 'warning'} sx={{ mt: 2 }}>{checked.length === checks.length ? 'Preparation complete. You can write the repair note when you are ready.' : `${checks.length - checked.length} preparation step${checks.length - checked.length === 1 ? '' : 's'} left.`}</Alert>
    </CardContent></Card>
    <Alert severity="warning" icon={<ErrorOutlineRounded />}>This browser tool cannot read Android system details, run ADB, unlock a bootloader, or perform a restore. Those desktop-only or high-impact steps need the supported technician app and a separate safety check.</Alert>
  </Stack>;
}

function Records({ records, onSave }: { records: RepairRecord[]; onSave: (record: Pick<RepairRecord, 'device' | 'issue' | 'work' | 'outcome'>) => Promise<void> }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [draft, setDraft] = React.useState({ device: '', issue: '', work: '', outcome: 'open' as RepairRecord['outcome'] });
  const [formError, setFormError] = React.useState('');
  const filtered = records.filter(record => `${record.device} ${record.issue} ${record.work}`.toLowerCase().includes(query.toLowerCase()));
  const submit = async () => {
    if (draft.device.trim().length < 2 || draft.issue.trim().length < 4 || draft.work.trim().length < 4) { setFormError('Add a device name and a little detail about the problem and work.'); return; }
    setSaving(true); setFormError('');
    try { await onSave({ ...draft, device: draft.device.trim(), issue: draft.issue.trim(), work: draft.work.trim() }); setDraft({ device: '', issue: '', work: '', outcome: 'open' }); setOpen(false); }
    catch (reason) { setFormError(reason instanceof Error ? reason.message : 'Could not save this note.'); }
    finally { setSaving(false); }
  };
  return <Stack spacing={3}>
    <PageIntro eyebrow="SERVICE HISTORY" title="Repair records" text="Keep a useful record of each device, what was reported, and the work you completed. Notes are saved to your private service workspace."><Button variant="contained" startIcon={<AddRounded />} onClick={() => setOpen(true)}>New repair note</Button></PageIntro>
    <Paper className="filters-bar"><SearchRounded color="action" /><TextField fullWidth size="small" variant="standard" placeholder="Search device, problem, or work done" value={query} onChange={event => setQuery(event.target.value)} InputProps={{ disableUnderline: true }} /><Typography variant="body2" color="text.secondary">{filtered.length} {filtered.length === 1 ? 'record' : 'records'}</Typography></Paper>
    {filtered.length === 0 ? <Paper className="empty-state"><Avatar className="empty-icon"><FactCheckRounded /></Avatar><Typography variant="h6" fontWeight={750}>{records.length ? 'No matching notes' : 'No repair notes yet'}</Typography><Typography color="text.secondary">{records.length ? 'Try a shorter search.' : 'Create your first note to keep the work easy to follow.'}</Typography>{!records.length && <Button startIcon={<AddRounded />} variant="outlined" onClick={() => setOpen(true)} sx={{ mt: 1 }}>Create a repair note</Button>}</Paper> : <Stack spacing={1.5}>{filtered.map(record => <Card key={record.id}><CardContent className="record-content"><Box flex={1}><Box className="record-title"><Typography variant="h6" fontWeight={750}>{record.device}</Typography><StatusChip status={record.outcome} /></Box><Typography fontWeight={650} sx={{ mt: 1 }}>Reported: {record.issue}</Typography><Typography color="text.secondary" sx={{ mt: .5 }}>{record.work}</Typography><Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1.25 }}>{new Date(record.createdAt).toLocaleString()}</Typography></Box></CardContent></Card>)}</Stack>}
    <Dialog open={open} onClose={() => !saving && setOpen(false)} fullWidth maxWidth="sm"><DialogTitle>New repair note</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <TextField label="Device or model" required value={draft.device} onChange={event => setDraft({ ...draft, device: event.target.value })} placeholder="For example, Galaxy A54" />
      <TextField label="What problem did the customer report?" required multiline minRows={2} value={draft.issue} onChange={event => setDraft({ ...draft, issue: event.target.value })} />
      <TextField label="What did you check or do?" required multiline minRows={3} value={draft.work} onChange={event => setDraft({ ...draft, work: event.target.value })} />
      <FormControl><InputLabel>Repair status</InputLabel><Select label="Repair status" value={draft.outcome} onChange={event => setDraft({ ...draft, outcome: event.target.value as RepairRecord['outcome'] })}><MenuItem value="open">Not started</MenuItem><MenuItem value="in_progress">In progress</MenuItem><MenuItem value="completed">Completed</MenuItem></Select></FormControl>
      {formError && <Alert severity="error">{formError}</Alert>}
      <Alert severity="info">Do not include passwords, account recovery codes, or unnecessary personal details in repair notes.</Alert>
    </Stack></DialogContent><DialogActions><Button onClick={() => setOpen(false)} disabled={saving}>Cancel</Button><Button onClick={() => void submit()} variant="contained" disabled={saving}>{saving ? 'Saving…' : 'Save note'}</Button></DialogActions></Dialog>
  </Stack>;
}

function StatusChip({ status }: { status: RepairRecord['outcome'] }) {
  const label = status === 'completed' ? 'Completed' : status === 'in_progress' ? 'In progress' : 'Not started';
  return <Chip size="small" label={label} color={status === 'completed' ? 'success' : status === 'in_progress' ? 'warning' : 'default'} variant="outlined" />;
}

function FirmwareCheck() {
  const [file, setFile] = React.useState<File | null>(null);
  const [expected, setExpected] = React.useState('');
  const [digest, setDigest] = React.useState('');
  const [checking, setChecking] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [error, setError] = React.useState('');
  const result = digest && expected.trim() ? digest.toLowerCase() === expected.trim().toLowerCase() : '';
  const pick = (value?: File) => { setFile(value || null); setDigest(''); setError(''); };
  const verify = async () => {
    if (!file) { setError('Choose a file from your device first.'); return; }
    if (file.size > 8 * 1024 * 1024 * 1024) { setError('This file is larger than the 8 GB browser limit for this check.'); return; }
    setChecking(true); setError('');
    try { setProgress(0); setDigest(await hashFile(file, setProgress)); }
    catch { setError('This browser could not read the file. Try another browser or file.'); }
    finally { setChecking(false); }
  };
  return <Stack spacing={3}>
    <PageIntro eyebrow="LOCAL FILE CHECK" title="Firmware file check" text="Pick a firmware file to calculate its SHA-256 fingerprint. The file is read in your browser and is not uploaded to the website." />
    <Card><CardContent><Stack spacing={2.5}>
      <Box className="upload-zone"><input id="firmware-file" type="file" onChange={event => pick(event.target.files?.[0])} /><Avatar className="upload-icon"><FolderOpenRounded /></Avatar><Typography variant="h6" fontWeight={750}>{file ? file.name : 'Choose a firmware file'}</Typography><Typography color="text.secondary">File stays on this device. Maximum size: 8 GB.</Typography><label htmlFor="firmware-file"><Button variant="outlined" component="span">Browse files</Button></label></Box>
      {file && <Paper className="file-facts"><Typography><b>File:</b> {file.name}</Typography><Typography><b>Size:</b> {(file.size / 1024 / 1024).toFixed(2)} MB</Typography><Typography><b>Last changed:</b> {new Date(file.lastModified).toLocaleString()}</Typography></Paper>}
      <TextField label="Trusted SHA-256 fingerprint (optional)" helperText="Copy this from a trusted manufacturer or source page. A match checks the file bytes; it does not prove the source is safe." value={expected} onChange={event => setExpected(event.target.value)} fullWidth />
      <Button variant="contained" onClick={() => void verify()} disabled={checking || !file}>{checking ? 'Checking file…' : 'Calculate SHA-256'}</Button>
      {checking && <LinearProgress variant="determinate" value={progress} />}
      {error && <Alert severity="error">{error}</Alert>}
      {digest && <Paper className="hash-result"><Typography variant="body2" color="text.secondary">SHA-256 fingerprint</Typography><Typography className="hash-value" onClick={() => void navigator.clipboard?.writeText(digest)} title="Select to copy">{digest}</Typography>{expected.trim() && <Alert severity={result ? 'success' : 'error'}>{result ? 'The file matches the fingerprint you entered.' : 'The file does not match that fingerprint. Do not use it until you confirm the correct value.'}</Alert>}</Paper>}
    </Stack></CardContent></Card>
    <Alert severity="warning" icon={<ErrorOutlineRounded />}>A matching fingerprint only confirms the file is unchanged from the value you entered. Get firmware from a source you trust and confirm it matches the exact model and region before any restore.</Alert>
  </Stack>;
}

function AdminPanel({ features, onFeatureChange }: { features: Feature[]; onFeatureChange: (key: string, enabled: boolean) => Promise<void> }) {
  const [pending, setPending] = React.useState('');
  const items = features.filter(feature => featureNames[feature.key]);
  return <Stack spacing={3}><PageIntro eyebrow="OWNER SETTINGS" title="Admin controls" text="Choose which website tools technicians can see. Changes are checked again by the server, so hiding a button is not the only access control." />
    <Alert severity="info" icon={<ShieldRounded />}>These settings apply to everyone using this workspace. Your admin access is verified by Cloudflare on each request.</Alert>
    <Card><CardContent><Stack divider={<Divider flexItem />}>{items.map(feature => <Box className="feature-row" key={feature.key}><Box flex={1}><Typography fontWeight={750}>{featureNames[feature.key]?.label || feature.label}</Typography><Typography color="text.secondary">{featureNames[feature.key]?.description || feature.description}</Typography></Box><Switch checked={feature.enabled} disabled={pending === feature.key} onChange={async event => { setPending(feature.key); await onFeatureChange(feature.key, event.target.checked); setPending(''); }} inputProps={{ 'aria-label': `Enable ${feature.label}` }} /></Box>)}</Stack></CardContent></Card>
    {!items.length && <Alert severity="warning">No website tools have been configured yet.</Alert>}
  </Stack>;
}

function AuthGate({ initialized, serviceError, onRetry, onAuthenticated }: { initialized: boolean; serviceError: string; onRetry: () => void; onAuthenticated: (state: { session: Session; features: Feature[] }) => void }) {
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [bootstrapSecret, setBootstrapSecret] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState('');
  const submit = async () => {
    setBusy(true); setError('');
    try {
      const result = initialized ? await api.login(email, password) : await api.bootstrap(email, password, bootstrapSecret);
      onAuthenticated(result);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Sign-in could not be completed.'); }
    finally { setBusy(false); }
  };
  return <Box className="auth-page"><Card className="auth-card"><CardContent><Box className="brand-lockup auth-brand"><Avatar className="brand-mark">G</Avatar><Box><Typography fontWeight={800}>GeloTech</Typography><Typography variant="caption" color="text.secondary">PRIVATE TECHNICIAN WORKSPACE</Typography></Box></Box>
    <Typography variant="h4" fontWeight={800}>{initialized ? 'Welcome back' : 'Set up your owner account'}</Typography>
    <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>{initialized ? 'Sign in to view repair notes and technician tools.' : 'Create the private admin account configured for this website.'}</Typography>
    {serviceError && <Alert severity="warning" action={<Button color="inherit" size="small" onClick={onRetry}>Retry</Button>} sx={{ mb: 2 }}>{serviceError}</Alert>}
    <Stack spacing={2}>
      <TextField autoComplete="username" type="email" label="Owner email" value={email} onChange={event => setEmail(event.target.value)} />
      <TextField autoComplete={initialized ? 'current-password' : 'new-password'} type="password" label={initialized ? 'Password' : 'Create a password'} helperText={!initialized ? 'Use at least 14 characters.' : undefined} value={password} onChange={event => setPassword(event.target.value)} />
      {!initialized && <TextField type="password" autoComplete="off" label="One-time setup code" helperText="The site owner sets this private code in Cloudflare before the first sign-in." value={bootstrapSecret} onChange={event => setBootstrapSecret(event.target.value)} />}
      {error && <Alert severity="error">{error}</Alert>}
      <Button variant="contained" onClick={() => void submit()} disabled={busy || !email || !password || (!initialized && !bootstrapSecret)}>{busy ? 'Please wait…' : initialized ? 'Sign in' : 'Create owner account'}</Button>
    </Stack>
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 3 }}>Your password is checked by the Cloudflare service. This workspace does not offer public account sign-up.</Typography>
  </CardContent></Card></Box>;
}
