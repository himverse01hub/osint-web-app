import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '../lib/api';

type MfaState =
  | { phase: 'loading' }
  | { phase: 'error'; message: string }
  | { phase: 'idle'; mfaEnabled: boolean }
  | { phase: 'enrolling'; secret: string; otpauthUri: string; code: string; busy: boolean; message?: string }
  | { phase: 'disabling'; code: string; busy: boolean; message?: string };

const initial: MfaState = { phase: 'loading' };

/** Two-factor authentication enrollment and management (TOTP, RFC 6238). */
export const MfaSettings = () => {
  const [state, setState] = useState<MfaState>(initial);

  const load = useCallback(async () => {
    setState(initial);
    try {
      const response = await apiFetch('/api/auth/mfa');
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Failed to load MFA status');
      setState({ phase: 'idle', mfaEnabled: Boolean(data.mfaEnabled) });
    } catch (error) {
      setState({ phase: 'error', message: error instanceof Error ? error.message : 'Failed to load MFA status' });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const startSetup = async () => {
    try {
      const response = await apiFetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup' }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Setup failed');
      setState({ phase: 'enrolling', secret: data.secret, otpauthUri: data.otpauthUri, code: '', busy: false });
    } catch (error) {
      setState({ phase: 'error', message: error instanceof Error ? error.message : 'Setup failed' });
    }
  };

  const submitCode = async (action: 'enable' | 'disable') => {
    const code = state.phase === 'enrolling' || state.phase === 'disabling' ? state.code.trim() : '';
    if (code.length !== 6 || !/^\d+$/.test(code)) return;
    setState((prev) => (prev.phase === 'enrolling' || prev.phase === 'disabling' ? { ...prev, busy: true, message: undefined } : prev));
    try {
      const response = await apiFetch('/api/auth/mfa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, totp: code }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Verification failed');
      setState({ phase: 'idle', mfaEnabled: Boolean(data.mfaEnabled) });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Verification failed';
      setState((prev) => (prev.phase === 'enrolling' || prev.phase === 'disabling' ? { ...prev, busy: false, message } : { phase: 'error', message }));
    }
  };

  if (state.phase === 'loading') {
    return <section className="card p-6"><p className="text-sm text-police-400">Loading security settings…</p></section>;
  }
  if (state.phase === 'error') {
    return (
      <section className="card p-6">
        <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
        <p className="mt-2 text-sm text-red-400">{state.message}</p>
        <button className="btn-secondary mt-3 px-4 py-2" onClick={() => void load()}>Retry</button>
      </section>
    );
  }
  if (state.phase === 'enrolling') {
    return (
      <section className="card p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Enable Two-Factor Authentication</h2>
          <p className="mt-1 text-sm text-police-400">
            1. Add the secret below in Google Authenticator / Authy (&ldquo;Enter a setup key&rdquo;).<br />
            2. Enter the 6-digit code it shows to confirm enrollment.
          </p>
        </div>
        <div className="rounded border border-police-700 bg-police-900/60 p-3">
          <p className="text-xs uppercase tracking-wide text-police-400">Secret key</p>
          <p className="mt-1 font-mono text-sm text-accent-cyan break-all select-all">{state.secret}</p>
          <p className="mt-2 text-xs text-police-500 break-all">{state.otpauthUri}</p>
        </div>
        {state.message && <p className="text-sm text-red-400">{state.message}</p>}
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(event) => { event.preventDefault(); void submitCode('enable'); }}
        >
          <input
            className="input-field w-40 text-center font-mono tracking-[0.3em]"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="123456"
            value={state.code}
            onChange={(event) => setState({ ...state, code: event.target.value.replace(/\D/g, '') })}
          />
          <button className="btn-primary px-4 py-2" disabled={state.busy} type="submit">
            {state.busy ? 'Verifying…' : 'Confirm & Enable'}
          </button>
          <button className="btn-secondary px-4 py-2" type="button" onClick={() => void load()}>Cancel</button>
        </form>
      </section>
    );
  }
  if (state.phase === 'disabling') {
    return (
      <section className="card p-6 space-y-4">
        <h2 className="text-lg font-semibold text-white">Disable Two-Factor Authentication</h2>
        <p className="text-sm text-police-400">Enter a current authenticator code to confirm. This removes the stored secret.</p>
        {state.message && <p className="text-sm text-red-400">{state.message}</p>}
        <form
          className="flex flex-wrap items-center gap-3"
          onSubmit={(event) => { event.preventDefault(); void submitCode('disable'); }}
        >
          <input
            className="input-field w-40 text-center font-mono tracking-[0.3em]"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            value={state.code}
            onChange={(event) => setState({ ...state, code: event.target.value.replace(/\D/g, '') })}
          />
          <button className="btn-primary px-4 py-2" disabled={state.busy} type="submit">
            {state.busy ? 'Verifying…' : 'Confirm & Disable'}
          </button>
          <button className="btn-secondary px-4 py-2" type="button" onClick={() => void load()}>Cancel</button>
        </form>
      </section>
    );
  }
  return (
    <section className="card p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-white">Two-Factor Authentication</h2>
          <p className="mt-1 text-sm text-police-400">
            {state.mfaEnabled
              ? 'Enabled — sign-in requires your password plus a 6-digit authenticator code.'
              : 'Currently disabled. Add an authenticator app for stronger account protection.'}
          </p>
        </div>
        <span className={`rounded-full border px-3 py-1 text-xs font-medium ${state.mfaEnabled ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400' : 'border-police-600 bg-police-800/60 text-police-300'}`}>
          {state.mfaEnabled ? 'Active' : 'Inactive'}
        </span>
      </div>
      {state.mfaEnabled ? (
        <button className="btn-secondary mt-4 px-4 py-2" onClick={() => setState({ phase: 'disabling', code: '', busy: false })}>
          Disable MFA
        </button>
      ) : (
        <button className="btn-primary mt-4 px-4 py-2" onClick={() => void startSetup()}>
          Set Up Authenticator
        </button>
      )}
    </section>
  );
};

