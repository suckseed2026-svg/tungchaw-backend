import { useEffect, useState, type ReactNode } from 'react';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import POS from './pages/POS';
import Reports from './pages/Reports';
import ResourcePage, { type ResourceConfig } from './pages/ResourcePage';
import Settings from './pages/Settings';
import Shell from './components/Shell';
import { branches, businesses, clearSession, readSession, writeSession } from './lib/api';
import type { AuthState } from './lib/types';

const emptySession: AuthState = {
  accessToken: null,
  refreshToken: null,
  user: null,
  business: null,
  branch: null,
  membership: null,
};

const configs: Record<string, ResourceConfig> = {
  '/products': { key: 'products', title: 'Products', subtitle: 'Manage products, prices, barcodes and stock.', fields: [{ key: 'name', label: 'Product name', required: true }, { key: 'sku', label: 'SKU' }, { key: 'barcode', label: 'Barcode' }, { key: 'sellingPrice', label: 'Selling price', type: 'number' }, { key: 'costPrice', label: 'Cost price', type: 'number' }] },
  '/categories': { key: 'categories', title: 'Categories', subtitle: 'Organize products into clear groups.' },
  '/brands': { key: 'brands', title: 'Brands', subtitle: 'Maintain product brands used in your catalogue.' },
  '/units': { key: 'units', title: 'Units', subtitle: 'Configure selling and purchase measurement units.', fields: [{ key: 'name', label: 'Unit name', required: true }, { key: 'shortName', label: 'Short name', required: true }] },
  '/customers': { key: 'customers', title: 'Customers', subtitle: 'Manage customer details, balances and sales history.', fields: [{ key: 'name', label: 'Customer name', required: true }, { key: 'phone', label: 'Phone number' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'address', label: 'Address' }] },
  '/suppliers': { key: 'suppliers', title: 'Suppliers', subtitle: 'Manage suppliers, purchases and outstanding balances.', fields: [{ key: 'name', label: 'Supplier name', required: true }, { key: 'phone', label: 'Phone number' }, { key: 'email', label: 'Email', type: 'email' }, { key: 'address', label: 'Address' }] },
  '/sales': { key: 'sales', title: 'Sales History', subtitle: 'Review completed, draft and cancelled sales.', createLabel: 'New sale' },
  '/sales-returns': { key: 'returns', title: 'Sales Returns', subtitle: 'Track refunds and returned items.', endpoint: '/businesses/:businessId/sales-returns' },
  '/purchases': { key: 'purchases', title: 'Purchases', subtitle: 'Record supplier purchases and receive stock.', fields: [{ key: 'supplierId', label: 'Supplier ID', required: true }, { key: 'invoiceNumber', label: 'Supplier invoice' }, { key: 'notes', label: 'Notes' }] },
  '/purchase-returns': { key: 'returns', title: 'Purchase Returns', subtitle: 'Track items returned to suppliers.', endpoint: '/businesses/:businessId/purchase-returns' },
  '/expenses': { key: 'expenses', title: 'Expenses', subtitle: 'Record and review business spending.', fields: [{ key: 'description', label: 'Description', required: true }, { key: 'amount', label: 'Amount', type: 'number', required: true }, { key: 'expenseCategoryId', label: 'Expense category ID' }, { key: 'date', label: 'Date', type: 'date' }] },
  '/adjustments': { key: 'adjustments', title: 'Stock Adjustments', subtitle: 'Record damaged, missing or corrected stock.', endpoint: 'inventory-adjustments' },
  '/transfers': { key: 'transfers', title: 'Stock Transfers', subtitle: 'Move stock safely between branches.', endpoint: 'stock-transfers' },
  '/batches': { key: 'products', title: 'Expiry & Batches', subtitle: 'Monitor batch quantities and expiry dates.', endpoint: 'inventory-batches' },
  '/employees': { key: 'employees', title: 'Employees', subtitle: 'Invite staff and manage their access.', endpoint: '/businesses/:businessId/employees' },
  '/branches': { key: 'branches', title: 'Branches', subtitle: 'Manage business locations and branch details.', endpoint: '/businesses/:businessId/branches' },
  '/devices': { key: 'devices', title: 'Devices', subtitle: 'Approve trusted computers and Android devices.', endpoint: '/businesses/:businessId/devices' },
  '/roles': { key: 'roles', title: 'Roles & Permissions', subtitle: 'Control what employees can see and do.', endpoint: '/businesses/:businessId/roles' },
};

function currentPath() {
  return location.hash.slice(1) || '/dashboard';
}

export default function App() {
  const [session, setSession] = useState<AuthState>(() => readSession());
  const [path, setPath] = useState(currentPath());
  const [loadingContext, setLoadingContext] = useState(Boolean(session.accessToken && !session.business));
  const [contextError, setContextError] = useState('');

  useEffect(() => {
    const handleHashChange = () => setPath(currentPath());
    addEventListener('hashchange', handleHashChange);
    return () => removeEventListener('hashchange', handleHashChange);
  }, []);

  useEffect(() => {
    if (!session.accessToken || session.business) return;
    let cancelled = false;

    (async () => {
      setLoadingContext(true);
      setContextError('');
      try {
        const memberships = await businesses();
        if (cancelled) return;

        if (memberships.length === 0) {
          setLoadingContext(false);
          return;
        }

        const membership = memberships[0];
        const availableBranches = await branches(membership.business.id).catch(() => []);
        if (cancelled) return;

        const business = { ...membership.business, branches: availableBranches };
        const next: AuthState = {
          ...session,
          business,
          branch: availableBranches[0] || null,
          membership: { ...membership, business },
        };
        setSession(next);
        writeSession(next);
      } catch (reason) {
        if (!cancelled) setContextError(reason instanceof Error ? reason.message : 'Unable to load your business');
      } finally {
        if (!cancelled) setLoadingContext(false);
      }
    })();

    return () => { cancelled = true; };
  }, [session.accessToken, session.business]);

  const go = (nextPath: string) => { location.hash = nextPath; };
  const authenticate = (next: AuthState) => {
    setSession(next);
    writeSession(next);
    if (next.business) go('/dashboard');
  };
  const logout = () => {
    clearSession();
    setSession(emptySession);
    setContextError('');
    location.hash = '';
  };

  if (!session.accessToken) return <Auth onAuth={authenticate} />;

  if (loadingContext) {
    return <div className="auth-shell"><section className="auth-story"/><section className="auth-panel"><div className="auth-box"><span className="eyebrow">TUNGCHAW</span><h2>Loading your workspace…</h2><p className="muted">Checking your business access and branches.</p></div></section></div>;
  }

  if (contextError) {
    return <div className="auth-shell"><section className="auth-story"/><section className="auth-panel"><div className="auth-box"><span className="eyebrow">WORKSPACE ERROR</span><h2>We could not load Tungchaw</h2><div className="form-error">{contextError}</div><button className="btn primary" onClick={() => location.reload()}>Try again</button><button className="text-link" onClick={logout}>Sign out</button></div></section></div>;
  }

  if (!session.business) {
    return <Auth onAuth={authenticate} initialView="business" existingSession={session} />;
  }

  const businessId = session.business.id;
  let page: ReactNode;
  if (path === '/dashboard') page = <Dashboard businessId={businessId} branchId={session.branch?.id} ownerName={session.user?.name} go={go} />;
  else if (path === '/pos') page = <POS />;
  else if (path === '/reports') page = <Reports />;
  else if (path === '/settings') page = <Settings />;
  else if (configs[path]) page = <ResourcePage config={configs[path]} businessId={businessId} />;
  else page = <Dashboard businessId={businessId} branchId={session.branch?.id} ownerName={session.user?.name} go={go} />;

  return <Shell session={session} path={path} go={go} logout={logout}>{page}</Shell>;
}
