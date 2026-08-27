import React, { useEffect, useState } from 'react';
import { pushStatus, enablePush, disablePush, sendTestPush } from '../utils/push';
import './PushSetup.css';

/**
 * "Avisos en este dispositivo" — the one place a person turns push on.
 *
 * Permission is requested from a click here and nowhere else. Each browser and
 * each device is its own subscription, so this card always talks about *this*
 * device, never about the account.
 */
export default function PushSetup() {
  const [st, setSt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [installable, setInstallable] = useState(Boolean(window.__zxInstallPrompt));

  const refresh = () => pushStatus().then(setSt).catch(() => setSt(null));

  useEffect(() => {
    refresh();
    const onInstallable = () => setInstallable(true);
    window.addEventListener('zx-installable', onInstallable);
    return () => window.removeEventListener('zx-installable', onInstallable);
  }, []);

  if (!st || !st.enabledOnServer) return null;

  const run = async (fn, ok) => {
    setBusy(true); setMsg(null);
    try {
      await fn();
      setMsg({ tone: 'ok', text: ok });
      await refresh();
    } catch (e) {
      setMsg({ tone: 'bad', text: e.message || 'No se pudo completar.' });
    } finally {
      setBusy(false);
    }
  };

  const install = async () => {
    const prompt = window.__zxInstallPrompt;
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') { window.__zxInstallPrompt = null; setInstallable(false); }
  };

  // iOS only delivers push to an app added to the home screen. Saying so beats
  // a button that fails.
  const needsInstall = st.ios && !st.installed;

  let state = 'off';
  if (!st.supported) state = 'unsupported';
  else if (needsInstall) state = 'install-first';
  else if (st.permission === 'denied') state = 'blocked';
  else if (st.subscribed && st.permission === 'granted') state = 'on';

  const COPY = {
    unsupported: 'Este navegador no admite avisos. Ábrelo en Chrome, Edge o Safari 16.4 o superior.',
    'install-first': 'Añade ZIONX a la pantalla de inicio para recibir avisos: toca Compartir y luego «Añadir a inicio».',
    blocked: 'Los avisos están bloqueados para este sitio. Actívalos en los ajustes del navegador y vuelve aquí.',
    on: 'Recibirás un aviso cuando una publicación falle o una conexión esté por expirar.',
    off: 'Actívalos para enterarte de una publicación fallida sin tener la app abierta.',
  };

  return (
    <div className={`zxpush ${state === 'on' ? 'is-on' : ''}`}>
      <div className="zxpush-mark" aria-hidden="true">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
      </div>

      <div className="zxpush-body">
        <div className="zxpush-title">
          Avisos en este dispositivo
          <span className={`zxpush-state ${state === 'on' ? 'on' : ''}`}>
            {state === 'on' ? 'Activos' : 'Apagados'}
          </span>
        </div>
        <p className="zxpush-sub">{COPY[state]}</p>
        {msg && <p className={`zxpush-msg ${msg.tone}`}>{msg.text}</p>}
      </div>

      <div className="zxpush-actions">
        {installable && state !== 'on' && (
          <button className="zxpush-btn" onClick={install} disabled={busy}>Instalar la app</button>
        )}
        {state === 'off' && (
          <button className="zxpush-btn solid" onClick={() => run(enablePush, 'Avisos activados en este dispositivo.')} disabled={busy}>
            {busy ? 'Activando…' : 'Activar avisos'}
          </button>
        )}
        {state === 'on' && (
          <>
            <button className="zxpush-btn" onClick={() => run(sendTestPush, 'Prueba enviada.')} disabled={busy}>Enviar prueba</button>
            <button className="zxpush-btn" onClick={() => run(disablePush, 'Avisos apagados en este dispositivo.')} disabled={busy}>Desactivar</button>
          </>
        )}
      </div>
    </div>
  );
}
