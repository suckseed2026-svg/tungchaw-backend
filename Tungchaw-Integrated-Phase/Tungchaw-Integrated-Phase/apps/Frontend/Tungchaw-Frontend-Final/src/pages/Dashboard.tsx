import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  PackageSearch,
  Plus,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Badge, Button, Card, Money, PageHeader } from '../components/ui';
import { request } from '../lib/api';

type DashboardProps = {
  businessId: string;
  branchId?: string | null;
  ownerName?: string | null;
  go: (path: string) => void;
};

type SummaryResponse = {
  currency?: string;
  today?: {
    salesAmount?: string | number;
    salesCount?: number;
    purchasesAmount?: string | number;
    purchasesCount?: number;
    grossProfit?: string | number;
  };
  inventory?: {
    valueAtCost?: string | number;
    retailValue?: string | number;
    totalQuantity?: string | number;
    lowStockRows?: number;
    outOfStockRows?: number;
  };
  totals?: {
    activeProducts?: number;
    activeCustomers?: number;
    activeSuppliers?: number;
    activeBranches?: number;
  };
};

type SalesTrendPoint = {
  date: string;
  salesAmount: string | number;
  salesCount: number;
  grossProfit: string | number;
};

type RecentSale = {
  id: string;
  saleNumber: string;
  saleDate: string;
  totalAmount: string | number;
  paymentStatus: string;
  branchName: string;
  customerName?: string | null;
};

type SalesResponse = {
  currency?: string;
  trend?: SalesTrendPoint[];
  recentSales?: RecentSale[];
};

type LowStockItem = {
  branchId: string;
  branchName: string;
  productId: string;
  productName: string;
  productCode: string;
  quantity: string | number;
  reorderLevel: string | number;
};

type InventoryResponse = {
  currency?: string;
  totals?: {
    inventoryValue?: string | number;
    retailValue?: string | number;
    potentialMargin?: string | number;
    totalQuantity?: string | number;
    lowStockRows?: number;
    outOfStockRows?: number;
  };
  lowStock?: LowStockItem[];
};

type DashboardData = {
  summary: SummaryResponse;
  sales: SalesResponse;
  inventory: InventoryResponse;
};

const emptyData: DashboardData = {
  summary: {},
  sales: { trend: [], recentSales: [] },
  inventory: { lowStock: [] },
};

function numberValue(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function shortDay(date: string): string {
  const parsed = new Date(`${date}T00:00:00`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString('en-US', { weekday: 'short' });
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function queryString(branchId?: string | null, days?: number): string {
  const query = new URLSearchParams();
  if (branchId) query.set('branchId', branchId);
  if (days) query.set('days', String(days));
  const value = query.toString();
  return value ? `?${value}` : '';
}

export default function Dashboard({
  businessId,
  branchId,
  ownerName,
  go,
}: DashboardProps) {
  const [data, setData] = useState<DashboardData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const branchQuery = queryString(branchId);
      const salesQuery = queryString(branchId, 7);
      const [summary, sales, inventory] = await Promise.all([
        request<SummaryResponse>(
          `/businesses/${businessId}/dashboard/summary${branchQuery}`,
          { businessId },
        ),
        request<SalesResponse>(
          `/businesses/${businessId}/dashboard/sales${salesQuery}`,
          { businessId },
        ),
        request<InventoryResponse>(
          `/businesses/${businessId}/dashboard/inventory${branchQuery}`,
          { businessId },
        ),
      ]);

      setData({ summary, sales, inventory });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Unable to load the dashboard right now.',
      );
    } finally {
      setLoading(false);
    }
  }, [branchId, businessId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const trend = useMemo(
    () =>
      (data.sales.trend ?? []).map((point) => ({
        day: shortDay(point.date),
        date: point.date,
        sales: numberValue(point.salesAmount),
        profit: numberValue(point.grossProfit),
        transactions: point.salesCount,
      })),
    [data.sales.trend],
  );

  const weekSales = trend.reduce((total, point) => total + point.sales, 0);
  const todaySales = numberValue(data.summary.today?.salesAmount);
  const grossProfit = numberValue(data.summary.today?.grossProfit);
  const purchases = numberValue(data.summary.today?.purchasesAmount);
  const lowStockCount =
    data.inventory.totals?.lowStockRows ??
    data.summary.inventory?.lowStockRows ??
    0;
  const outOfStockCount =
    data.inventory.totals?.outOfStockRows ??
    data.summary.inventory?.outOfStockRows ??
    0;
  const recentSales = data.sales.recentSales ?? [];
  const lowStock = data.inventory.lowStock ?? [];
  const displayName = ownerName?.trim().split(/\s+/)[0] || 'Owner';

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${displayName}`}
        subtitle="Here is what is happening in your business today."
        actions={
          <>
            <Button variant="secondary" onClick={() => void loadDashboard()}>
              <RefreshCw size={17} /> Refresh
            </Button>
            <Button variant="secondary">
              <CalendarDays size={17} /> Today
            </Button>
            <Button onClick={() => go('/pos')}>
              <Plus size={17} /> New sale
            </Button>
          </>
        }
      />

      {error ? (
        <Card>
          <div className="empty-state">
            <TriangleAlert size={28} />
            <h3>Dashboard could not be loaded</h3>
            <p>{error}</p>
            <Button onClick={() => void loadDashboard()}>
              <RefreshCw size={17} /> Try again
            </Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="metric-grid">
            <Card className="metric">
              <div><span>Today&apos;s sales</span><ShoppingCart /></div>
              <strong>{loading ? '—' : <Money value={todaySales} />}</strong>
              <small className="up">
                <ArrowUpRight /> {data.summary.today?.salesCount ?? 0} completed sales
              </small>
            </Card>

            <Card className="metric">
              <div><span>Gross profit</span><ArrowUpRight /></div>
              <strong>{loading ? '—' : <Money value={grossProfit} />}</strong>
              <small>Profit from today&apos;s completed sales</small>
            </Card>

            <Card className="metric">
              <div><span>Purchases today</span><ArrowDownRight /></div>
              <strong>{loading ? '—' : <Money value={purchases} />}</strong>
              <small>{data.summary.today?.purchasesCount ?? 0} received purchases</small>
            </Card>

            <Card className="metric">
              <div><span>Low stock</span><TriangleAlert /></div>
              <strong>{loading ? '—' : `${lowStockCount} products`}</strong>
              <small className="warn-text">{outOfStockCount} products are out of stock</small>
            </Card>
          </div>

          <div className="dashboard-grid">
            <Card className="chart-card">
              <div className="card-head">
                <div><h3>Sales this week</h3><p>Daily completed sales</p></div>
                <strong>{loading ? '—' : <Money value={weekSales} />}</strong>
              </div>

              {trend.length > 0 ? (
                <ResponsiveContainer width="100%" height={270}>
                  <AreaChart data={trend}>
                    <defs>
                      <linearGradient id="dashboardSalesFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="currentColor" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="currentColor" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="day" axisLine={false} tickLine={false} />
                    <YAxis axisLine={false} tickLine={false} />
                    <Tooltip
                      formatter={(value) => [
                        `₹${numberValue(value).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
                        'Sales',
                      ]}
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.date ?? ''}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="currentColor"
                      strokeWidth={2}
                      fill="url(#dashboardSalesFill)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="empty-state">
                  <ShoppingCart size={28} />
                  <h3>No sales yet</h3>
                  <p>Completed sales will appear in this chart.</p>
                  <Button onClick={() => go('/pos')}><Plus size={17} /> Start a sale</Button>
                </div>
              )}
            </Card>

            <Card className="quick-card">
              <div className="card-head"><div><h3>Quick actions</h3><p>Common daily tasks</p></div></div>
              <button onClick={() => go('/pos')}>
                <ShoppingCart />
                <span><b>Start a new sale</b><small>Open the point of sale</small></span>
                <ChevronRight />
              </button>
              <button onClick={() => go('/products')}>
                <PackageSearch />
                <span><b>Add or find a product</b><small>Manage catalogue and stock</small></span>
                <ChevronRight />
              </button>
              <button onClick={() => go('/purchases')}>
                <Plus />
                <span><b>Record a purchase</b><small>Receive stock from supplier</small></span>
                <ChevronRight />
              </button>
            </Card>
          </div>

          <div className="dashboard-grid lower">
            <Card>
              <div className="card-head">
                <div><h3>Recent sales</h3><p>Latest completed transactions</p></div>
                <button onClick={() => go('/sales')}>View all</button>
              </div>
              {recentSales.length > 0 ? (
                <div className="activity-list">
                  {recentSales.slice(0, 5).map((sale) => (
                    <div key={sale.id}>
                      <div className="activity-icon"><ShoppingCart /></div>
                      <span>
                        <b>{sale.saleNumber}</b>
                        <small>{sale.customerName || 'Walk-in Customer'}</small>
                      </span>
                      <strong><Money value={numberValue(sale.totalAmount)} /></strong>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state compact">
                  <p>No completed sales yet.</p>
                </div>
              )}
            </Card>

            <Card>
              <div className="card-head">
                <div><h3>Stock attention</h3><p>Products needing action</p></div>
                <button onClick={() => go('/products')}>View inventory</button>
              </div>
              {lowStock.length > 0 ? (
                <div className="attention-list">
                  {lowStock.slice(0, 5).map((item) => {
                    const quantity = numberValue(item.quantity);
                    const reorderLevel = numberValue(item.reorderLevel);
                    return (
                      <div key={`${item.branchId}-${item.productId}`}>
                        <span>
                          <b>{item.productName}</b>
                          <small>{quantity} remaining · Reorder at {reorderLevel}</small>
                        </span>
                        <Badge tone={quantity <= 0 ? 'bad' : 'warn'}>
                          {quantity <= 0 ? 'Out of stock' : 'Low stock'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state compact">
                  <p>No products currently need stock attention.</p>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
