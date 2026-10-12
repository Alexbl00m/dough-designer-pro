import { createRoot } from 'react-dom/client'
import App from './App.tsx'
// Self-hosted, so the app reads the same on every device and needs no font CDN.
import '@fontsource-variable/geist'
import './index.css'

createRoot(document.getElementById("root")!).render(<App />);
