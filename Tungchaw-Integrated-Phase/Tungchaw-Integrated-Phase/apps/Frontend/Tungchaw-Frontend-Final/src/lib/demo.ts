import type { Business, ResourceRow } from './types';

export const demoBusiness: Business = {
  id: 'demo-business',
  name: 'Tungchaw General Store',
  code: 'TGS001',
  status: 'ACTIVE',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  branches: [
    {
      id: 'demo-branch',
      name: 'Main Branch',
      code: 'MAIN',
      address: 'Champhai, Mizoram',
    },
  ],
};

const d = (
  id: string,
  values: Record<string, unknown>,
): ResourceRow => ({
  id,
  ...values,
});

/**
 * Keep the old demo shape so existing pages still compile.
 * Because VITE_DEMO_MODE=false, this data should not be used
 * as a fallback for real backend failures.
 */
export const demo: Record<string, ResourceRow[]> = {
  products: [
    d('p1', {
      name: 'Rice 25 kg',
      sku: 'RICE-25',
      barcode: '890100000001',
      category: 'Groceries',
      stock: 18,
      sellingPrice: 1450,
      costPrice: 1280,
      status: 'Active',
    }),
    d('p2', {
      name: 'Cooking Oil 1 L',
      sku: 'OIL-1L',
      barcode: '890100000002',
      category: 'Groceries',
      stock: 6,
      sellingPrice: 165,
      costPrice: 148,
      status: 'Low stock',
    }),
    d('p3', {
      name: 'Paracetamol 500 mg',
      sku: 'PCM-500',
      barcode: '890100000003',
      category: 'Healthcare',
      stock: 82,
      sellingPrice: 32,
      costPrice: 21,
      status: 'Active',
    }),
    d('p4', {
      name: 'USB-C Cable',
      sku: 'USB-C-1M',
      barcode: '890100000004',
      category: 'Accessories',
      stock: 0,
      sellingPrice: 299,
      costPrice: 170,
      status: 'Out of stock',
    }),
  ],

  categories: [
    d('c1', {
      name: 'Groceries',
      code: 'GROC',
      products: 42,
      status: 'Active',
    }),
    d('c2', {
      name: 'Healthcare',
      code: 'HLTH',
      products: 18,
      status: 'Active',
    }),
    d('c3', {
      name: 'Accessories',
      code: 'ACC',
      products: 25,
      status: 'Active',
    }),
  ],

  brands: [
    d('b1', {
      name: 'Local',
      code: 'LOCAL',
      products: 31,
      status: 'Active',
    }),
    d('b2', {
      name: 'Tata',
      code: 'TATA',
      products: 7,
      status: 'Active',
    }),
    d('b3', {
      name: 'Generic',
      code: 'GEN',
      products: 22,
      status: 'Active',
    }),
  ],

  units: [
    d('u1', {
      name: 'Piece',
      shortName: 'pcs',
      status: 'Active',
    }),
    d('u2', {
      name: 'Kilogram',
      shortName: 'kg',
      status: 'Active',
    }),
    d('u3', {
      name: 'Litre',
      shortName: 'L',
      status: 'Active',
    }),
  ],

  customers: [
    d('cu1', {
      name: 'Lalrinpuii',
      phone: '9862000001',
      balance: 1250,
      totalSales: 18320,
      status: 'Active',
    }),
    d('cu2', {
      name: 'Zothanmawia',
      phone: '9862000002',
      balance: 0,
      totalSales: 7900,
      status: 'Active',
    }),
    d('cu3', {
      name: 'Walk-in Customer',
      phone: '—',
      balance: 0,
      totalSales: 44200,
      status: 'Active',
    }),
  ],

  suppliers: [
    d('s1', {
      name: 'Mizoram Wholesale',
      phone: '9862100001',
      balance: 8400,
      totalPurchases: 128000,
      status: 'Active',
    }),
    d('s2', {
      name: 'Champhai Distributors',
      phone: '9862100002',
      balance: 0,
      totalPurchases: 76100,
      status: 'Active',
    }),
  ],

  sales: [
    d('sa1', {
      invoiceNumber: 'INV-1048',
      customer: 'Walk-in Customer',
      total: 1840,
      paymentStatus: 'Paid',
      status: 'Completed',
      createdAt: 'Today, 12:42 PM',
    }),
    d('sa2', {
      invoiceNumber: 'INV-1047',
      customer: 'Lalrinpuii',
      total: 960,
      paymentStatus: 'Partial',
      status: 'Completed',
      createdAt: 'Today, 11:18 AM',
    }),
    d('sa3', {
      invoiceNumber: 'INV-1046',
      customer: 'Zothanmawia',
      total: 320,
      paymentStatus: 'Paid',
      status: 'Completed',
      createdAt: 'Today, 10:01 AM',
    }),
  ],

  purchases: [
    d('pu1', {
      purchaseNumber: 'PUR-203',
      supplier: 'Mizoram Wholesale',
      total: 28400,
      paymentStatus: 'Partial',
      status: 'Received',
      createdAt: '26 Jul 2026',
    }),
    d('pu2', {
      purchaseNumber: 'PUR-202',
      supplier: 'Champhai Distributors',
      total: 12600,
      paymentStatus: 'Paid',
      status: 'Received',
      createdAt: '24 Jul 2026',
    }),
  ],

  expenses: [
    d('e1', {
      description: 'Shop electricity',
      category: 'Utilities',
      amount: 2900,
      paymentMethod: 'Cash',
      date: '27 Jul 2026',
    }),
    d('e2', {
      description: 'Delivery charge',
      category: 'Transport',
      amount: 750,
      paymentMethod: 'Cash',
      date: '26 Jul 2026',
    }),
    d('e3', {
      description: 'Internet bill',
      category: 'Utilities',
      amount: 899,
      paymentMethod: 'UPI',
      date: '25 Jul 2026',
    }),
  ],

  employees: [
    d('em1', {
      name: 'Vanlalruata',
      phone: '9862200001',
      role: 'Owner',
      branch: 'All branches',
      status: 'Active',
    }),
    d('em2', {
      name: 'Lalhmingmawia',
      phone: '9862200002',
      role: 'Cashier',
      branch: 'Main Branch',
      status: 'Active',
    }),
    d('em3', {
      name: 'Zonunmawii',
      phone: '9862200003',
      role: 'Manager',
      branch: 'Main Branch',
      status: 'Invited',
    }),
  ],

  branches: [
    d('br1', {
      name: 'Main Branch',
      code: 'MAIN',
      phone: '9862300001',
      address: 'Champhai, Mizoram',
      status: 'Active',
    }),
  ],

  devices: [
    d('dv1', {
      name: 'Main Counter PC',
      type: 'Windows',
      employee: 'Vanlalruata',
      lastSeen: 'Now',
      status: 'Approved',
    }),
    d('dv2', {
      name: 'Owner Android',
      type: 'Android',
      employee: 'Vanlalruata',
      lastSeen: '12 minutes ago',
      status: 'Approved',
    }),
    d('dv3', {
      name: 'Unknown Android',
      type: 'Android',
      employee: 'Lalhmingmawia',
      lastSeen: 'Pending',
      status: 'Approval needed',
    }),
  ],

  roles: [
    d('r1', {
      name: 'Owner',
      members: 1,
      permissions: 'All permissions',
      status: 'System',
    }),
    d('r2', {
      name: 'Manager',
      members: 1,
      permissions: '34 permissions',
      status: 'Customizable',
    }),
    d('r3', {
      name: 'Cashier',
      members: 1,
      permissions: '12 permissions',
      status: 'Customizable',
    }),
  ],

  returns: [
    d('re1', {
      returnNumber: 'SR-019',
      reference: 'INV-1029',
      party: 'Walk-in Customer',
      total: 320,
      status: 'Completed',
      createdAt: '26 Jul 2026',
    }),
  ],

  transfers: [
    d('t1', {
      transferNumber: 'TR-007',
      from: 'Main Branch',
      to: 'Branch 2',
      items: 4,
      status: 'Completed',
      createdAt: '25 Jul 2026',
    }),
  ],

  adjustments: [
    d('a1', {
      reference: 'ADJ-031',
      reason: 'Damaged item',
      items: 2,
      quantity: '-3',
      status: 'Completed',
      createdAt: '27 Jul 2026',
    }),
  ],

  purchaseReturns: [],
  salesReturns: [],
  expenseCategories: [],
  inventoryAdjustments: [],
  stockTransfers: [],
  inventoryBatches: [],
  permissions: [],
  notifications: [],
};

export default demo;