import { useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';
import { Button, Field, Select } from '../components/ui';
import { createBranch, createBusiness, login, register } from '../lib/api';
import type { AuthState, Business, SessionUser } from '../lib/types';

type View = 'welcome' | 'login' | 'register' | 'join' | 'business';

type AuthProps = {
  onAuth: (session: AuthState) => void;
  initialView?: View;
  existingSession?: AuthState | null;
};

const industries = [
  ['GENERAL_RETAIL', 'General retail'],
  ['GROCERY', 'Grocery store'],
  ['PHARMACY', 'Pharmacy'],
  ['HARDWARE', 'Hardware store'],
  ['MOBILE_ELECTRONICS', 'Mobile / electronics shop'],
  ['CLOTHING', 'Clothing store'],
  ['RESTAURANT', 'Restaurant / food business'],
];

function cleanCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 30);
}

export default function Auth({ onAuth, initialView = 'welcome', existingSession = null }: AuthProps) {
  const [view, setView] = useState<View>(initialView);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    name: existingSession?.user?.name || '',
    email: existingSession?.user?.email || '',
    phone: existingSession?.user?.phone || '',
    password: '',
    confirmPassword: '',
    businessName: '',
    businessCode: '',
    industry: 'GENERAL_RETAIL',
    address: '',
    branchName: 'Main Branch',
    branchCode: 'MAIN',
    inviteCode: '',
  });

  const patch = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  const go = (next: View) => {
    setError('');
    setView(next);
  };

  async function submitLogin(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const auth = await login(form.email, form.password);
      onAuth({ ...auth, business: null, branch: null, membership: null });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  }

  async function submitRegister(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (form.password !== form.confirmPassword) throw new Error('Passwords do not match');
      await register({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      const auth = await login(form.email, form.password);
      onAuth({ ...auth, business: null, branch: null, membership: null });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create account');
    } finally {
      setBusy(false);
    }
  }

  async function submitBusiness(event: FormEvent) {
    event.preventDefault();
    if (!existingSession?.accessToken || !existingSession.user) {
      setError('Your session is missing. Sign in again and continue business setup.');
      return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await createBusiness({
        name: form.businessName.trim(),
        code: cleanCode(form.businessCode),
        industry: form.industry,
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      });

      let branch = null;
      try {
        branch = await createBranch(result.business.id, {
          name: form.branchName.trim(),
          code: cleanCode(form.branchCode),
          phone: form.phone.trim() || undefined,
          address: form.address.trim() || undefined,
        });
      } catch (branchError) {
        setError(
          `Business was created, but the first branch could not be created: ${
            branchError instanceof Error ? branchError.message : 'Unknown error'
          }`,
        );
      }

      const business: Business = {
        ...result.business,
        branches: branch ? [branch] : [],
      };

      onAuth({
        ...existingSession,
        user: existingSession.user as SessionUser,
        business,
        branch,
        membership: {
          membershipId: result.membership.id,
          membershipStatus: result.membership.status,
          isOwner: result.membership.isOwner,
          business,
          roles: [result.ownerRole],
        },
      });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to create business');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-shell">
      <section className="auth-story">
        <div className="auth-brand"><div className="logo-mark">T</div><strong>Tungchaw</strong></div>
        <div className="story-copy">
          <span className="eyebrow">BUILT FOR LOCAL BUSINESS</span>
          <h1>Run the whole shop from one dependable workspace.</h1>
          <p>Sales, stock, purchases, expenses, employees and reports—clear enough for daily use, powerful enough to grow with your business.</p>
          <div className="story-points">
            <span><ShieldCheck />Owner has full control</span>
            <span><Store />Works for every retail business</span>
            <span><Users />Simple for teams of any size</span>
          </div>
        </div>
        <small>© 2026 Tungchaw Business Suite</small>
      </section>

      <section className="auth-panel">
        <div className="auth-box">
          {view !== 'welcome' && view !== 'business' && (
            <button className="back-link" onClick={() => go('welcome')}>
              <ArrowLeft /> Back
            </button>
          )}

          {view === 'welcome' && (
            <>
              <span className="eyebrow">WELCOME TO TUNGCHAW</span>
              <h2>How would you like to continue?</h2>
              <p className="muted">Choose the option that matches your business.</p>
              <div className="choice-list">
                <button className="choice primary-choice" onClick={() => go('register')}>
                  <span><Building2 /><b>Create a new business</b><small>Set up Tungchaw as the owner</small></span><ArrowRight />
                </button>
                <button className="choice" onClick={() => go('join')}>
                  <span><Users /><b>Join an existing business</b><small>Use an invitation from your owner</small></span><ArrowRight />
                </button>
                <button className="choice" onClick={() => go('login')}>
                  <span><LockKeyhole /><b>Sign in</b><small>Continue to your existing workspace</small></span><ArrowRight />
                </button>
              </div>
            </>
          )}

          {view === 'login' && (
            <form onSubmit={submitLogin}>
              <span className="eyebrow">WELCOME BACK</span>
              <h2>Sign in to Tungchaw</h2>
              <p className="muted">Use the registered email address linked to your account.</p>
              <Field label="Email address" type="email" value={form.email} onChange={(e) => patch('email', e.target.value)} required autoFocus />
              <label className="field"><span>Password</span><div className="password">
                <input type={show ? 'text' : 'password'} value={form.password} onChange={(e) => patch('password', e.target.value)} required minLength={12} />
                <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? <EyeOff /> : <Eye />}</button>
              </div></label>
              {error && <div className="form-error">{error}</div>}
              <Button disabled={busy}>{busy ? 'Signing in...' : 'Sign in'} <ArrowRight size={17} /></Button>
              <button className="text-link" type="button">Forgot password?</button>
            </form>
          )}

          {view === 'register' && (
            <form onSubmit={submitRegister}>
              <span className="eyebrow">OWNER SETUP — STEP 1 OF 2</span>
              <h2>Create your owner account</h2>
              <p className="muted">After this, Tungchaw will ask you to create the business workspace.</p>
              <div className="form-grid">
                <Field label="Your full name" value={form.name} onChange={(e) => patch('name', e.target.value)} required />
                <Field label="Phone number" value={form.phone} onChange={(e) => patch('phone', e.target.value)} />
              </div>
              <Field label="Email address" type="email" value={form.email} onChange={(e) => patch('email', e.target.value)} required />
              <div className="form-grid">
                <Field label="Password" type="password" value={form.password} onChange={(e) => patch('password', e.target.value)} required minLength={12} />
                <Field label="Confirm password" type="password" value={form.confirmPassword} onChange={(e) => patch('confirmPassword', e.target.value)} required minLength={12} />
              </div>
              <p className="muted">Use at least 12 characters with uppercase, lowercase, a number and a special character.</p>
              {error && <div className="form-error">{error}</div>}
              <Button disabled={busy}>{busy ? 'Creating account...' : 'Create account'} <ArrowRight size={17} /></Button>
            </form>
          )}

          {view === 'business' && (
            <form onSubmit={submitBusiness}>
              <span className="eyebrow">OWNER SETUP — STEP 2 OF 2</span>
              <h2>Create your business workspace</h2>
              <p className="muted">The owner automatically receives full access to every Tungchaw module.</p>
              <Field label="Business name" value={form.businessName} onChange={(e) => {
                patch('businessName', e.target.value);
                if (!form.businessCode) patch('businessCode', cleanCode(e.target.value.replace(/\s+/g, '-')));
              }} required autoFocus />
              <div className="form-grid">
                <Field label="Business code" value={form.businessCode} onChange={(e) => patch('businessCode', cleanCode(e.target.value))} required minLength={2} maxLength={30} />
                <Select label="Business type" value={form.industry} onChange={(e) => patch('industry', e.target.value)}>
                  {industries.map(([value, label]) => <option value={value} key={value}>{label}</option>)}
                </Select>
              </div>
              <Field label="Address (optional)" value={form.address} onChange={(e) => patch('address', e.target.value)} />
              <div className="form-grid">
                <Field label="First branch name" value={form.branchName} onChange={(e) => patch('branchName', e.target.value)} required />
                <Field label="Branch code" value={form.branchCode} onChange={(e) => patch('branchCode', cleanCode(e.target.value))} required minLength={2} maxLength={30} />
              </div>
              {error && <div className="form-error">{error}</div>}
              <Button disabled={busy}>{busy ? 'Setting up Tungchaw...' : 'Create business'} <ArrowRight size={17} /></Button>
            </form>
          )}

          {view === 'join' && (
            <form onSubmit={(event) => { event.preventDefault(); setError('Employee invitation activation is not yet exposed by the current backend.'); }}>
              <span className="eyebrow">EMPLOYEE ACCESS</span>
              <h2>Join your business</h2>
              <p className="muted">Enter the invitation information sent by your owner.</p>
              <Field label="Invitation code" value={form.inviteCode} onChange={(e) => patch('inviteCode', e.target.value)} required />
              <Field label="Phone number" value={form.phone} onChange={(e) => patch('phone', e.target.value)} required />
              {error && <div className="form-error">{error}</div>}
              <Button>Continue <ArrowRight size={17} /></Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
