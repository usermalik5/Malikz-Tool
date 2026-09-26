import React from 'react';
import ReactDOM from 'react-dom/client';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import App from './App';
import './styles.css';

function Root() {
  const [mode, setMode] = React.useState<'light' | 'dark'>(() =>
    localStorage.getItem('malikz-theme') === 'light' ? 'light' : 'dark',
  );
  const theme = React.useMemo(() => createTheme({
    palette: {
      mode,
      primary: { main: mode === 'dark' ? '#83b7ff' : '#145db8' },
      secondary: { main: '#18a999' },
      background: mode === 'dark' ? { default: '#101827', paper: '#172235' } : { default: '#f3f6fb', paper: '#ffffff' },
      success: { main: '#23866d' }, warning: { main: '#b86a0c' }, error: { main: '#c44d55' },
    },
    typography: { fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', button: { textTransform: 'none', fontWeight: 650 } },
    shape: { borderRadius: 14 },
    components: {
      MuiButton: { styleOverrides: { root: { borderRadius: 10, minHeight: 42 } } },
      MuiCard: { styleOverrides: { root: { backgroundImage: 'none', border: `1px solid ${mode === 'dark' ? '#27364b' : '#e4eaf2'}`, boxShadow: '0 8px 30px rgba(14, 30, 52, .06)' } } },
    },
  }), [mode]);
  const changeMode = () => setMode(value => {
    const next = value === 'dark' ? 'light' : 'dark';
    localStorage.setItem('malikz-theme', next);
    return next;
  });
  return <ThemeProvider theme={theme}><CssBaseline /><App mode={mode} onToggleTheme={changeMode} /></ThemeProvider>;
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><Root /></React.StrictMode>);
