// Default ledger groups for classification
export const LEDGER_GROUPS = {
  ASSETS: 'Assets',
  LIABILITIES: 'Liabilities',
  INCOME: 'Income',
  EXPENSES: 'Expenses'
};

export const LEDGER_SUBGROUPS = {
  CAPITAL: 'Capital Account',
  CASH: 'Cash-in-Hand',
  BANK: 'Bank Accounts',
  SUNDRY_DEBTORS: 'Sundry Debtors',
  SUNDRY_CREDITORS: 'Sundry Creditors',
  SALES: 'Sales Accounts',
  PURCHASE: 'Purchase Accounts',
  INDIRECT_EXPENSES: 'Indirect Expenses',
  DIRECT_EXPENSES: 'Direct Expenses',
  INDIRECT_INCOMES: 'Indirect Incomes'
};

// Map subgroups to primary groups
export const GROUP_MAP = {
  [LEDGER_SUBGROUPS.CAPITAL]: LEDGER_GROUPS.LIABILITIES,
  [LEDGER_SUBGROUPS.CASH]: LEDGER_GROUPS.ASSETS,
  [LEDGER_SUBGROUPS.BANK]: LEDGER_GROUPS.ASSETS,
  [LEDGER_SUBGROUPS.SUNDRY_DEBTORS]: LEDGER_GROUPS.ASSETS,
  [LEDGER_SUBGROUPS.SUNDRY_CREDITORS]: LEDGER_GROUPS.LIABILITIES,
  [LEDGER_SUBGROUPS.SALES]: LEDGER_GROUPS.INCOME,
  [LEDGER_SUBGROUPS.PURCHASE]: LEDGER_GROUPS.EXPENSES,
  [LEDGER_SUBGROUPS.INDIRECT_EXPENSES]: LEDGER_GROUPS.EXPENSES,
  [LEDGER_SUBGROUPS.DIRECT_EXPENSES]: LEDGER_GROUPS.EXPENSES,
  [LEDGER_SUBGROUPS.INDIRECT_INCOMES]: LEDGER_GROUPS.INCOME
};

export const BASE_LEDGERS = [
  { id: 'ledger-cash', name: 'Cash A/c', subgroup: LEDGER_SUBGROUPS.CASH, openingBalance: 0, balanceType: 'Dr' },
  { id: 'ledger-bank', name: 'Bank A/c', subgroup: LEDGER_SUBGROUPS.BANK, openingBalance: 0, balanceType: 'Dr' },
  { id: 'ledger-sales', name: 'Sales A/c', subgroup: LEDGER_SUBGROUPS.SALES, openingBalance: 0, balanceType: 'Cr' },
  { id: 'ledger-purchase', name: 'Purchase A/c', subgroup: LEDGER_SUBGROUPS.PURCHASE, openingBalance: 0, balanceType: 'Dr' }
];

export const DEFAULT_LEDGERS = [
  { id: 'ledger-capital', name: 'Capital Account', subgroup: LEDGER_SUBGROUPS.CAPITAL, openingBalance: 1000000, balanceType: 'Cr' },
  { id: 'ledger-cash', name: 'Cash A/c', subgroup: LEDGER_SUBGROUPS.CASH, openingBalance: 50000, balanceType: 'Dr' },
  { id: 'ledger-bank', name: 'HDFC Bank A/c', subgroup: LEDGER_SUBGROUPS.BANK, openingBalance: 450000, balanceType: 'Dr' },
  { id: 'ledger-sales', name: 'Sales A/c', subgroup: LEDGER_SUBGROUPS.SALES, openingBalance: 0, balanceType: 'Cr' },
  { id: 'ledger-purchase', name: 'Purchase A/c', subgroup: LEDGER_SUBGROUPS.PURCHASE, openingBalance: 0, balanceType: 'Dr' },
  { id: 'ledger-rent', name: 'Rent Expense A/c', subgroup: LEDGER_SUBGROUPS.INDIRECT_EXPENSES, openingBalance: 0, balanceType: 'Dr' },
  { id: 'ledger-office', name: 'Office Utilities A/c', subgroup: LEDGER_SUBGROUPS.INDIRECT_EXPENSES, openingBalance: 0, balanceType: 'Dr' },
  { id: 'ledger-customer-john', name: 'John Doe (Customer)', subgroup: LEDGER_SUBGROUPS.SUNDRY_DEBTORS, openingBalance: 15000, balanceType: 'Dr' },
  { id: 'ledger-customer-jane', name: 'Jane Smith (Customer)', subgroup: LEDGER_SUBGROUPS.SUNDRY_DEBTORS, openingBalance: 0, balanceType: 'Dr' },
  { id: 'ledger-supplier-apex', name: 'Apex Distributors', subgroup: LEDGER_SUBGROUPS.SUNDRY_CREDITORS, openingBalance: 25000, balanceType: 'Cr' },
  { id: 'ledger-supplier-zenith', name: 'Zenith Electronics', subgroup: LEDGER_SUBGROUPS.SUNDRY_CREDITORS, openingBalance: 0, balanceType: 'Cr' }
];

export const DEFAULT_STOCK_ITEMS = [
  { id: 'stock-laptop', name: 'Dell Vostro Laptop', unit: 'pcs', openingQty: 10, openingRate: 40000, purchaseRate: 40000, saleRate: 48000, gstRate: 18 },
  { id: 'stock-monitor', name: 'LG 24" IPS Monitor', unit: 'pcs', openingQty: 15, openingRate: 8500, purchaseRate: 8500, saleRate: 11000, gstRate: 18 },
  { id: 'stock-keyboard', name: 'Logitech Wireless Keyboard', unit: 'pcs', openingQty: 50, openingRate: 1000, purchaseRate: 1000, saleRate: 1500, gstRate: 12 },
  { id: 'stock-mouse', name: 'Logitech Wireless Mouse', unit: 'pcs', openingQty: 50, openingRate: 500, purchaseRate: 500, saleRate: 750, gstRate: 12 }
];

export const DEFAULT_TRANSACTIONS = [
  {
    id: 'tx-1',
    voucherNo: 'PUR-001',
    date: '2026-06-01',
    voucherType: 'Purchase',
    partyLedgerId: 'ledger-supplier-apex',
    items: [
      { stockItemId: 'stock-laptop', qty: 5, rate: 39000, gstRate: 18 },
      { stockItemId: 'stock-keyboard', qty: 10, rate: 950, gstRate: 12 }
    ],
    ledgerPostings: [
      { ledgerId: 'ledger-purchase', amount: 204500, type: 'Dr' },
      { ledgerId: 'ledger-supplier-apex', amount: 204500, type: 'Cr' }
    ],
    narration: 'Purchased laptops and keyboards from Apex Distributors.'
  },
  {
    id: 'tx-2',
    voucherNo: 'SAL-001',
    date: '2026-06-05',
    voucherType: 'Sales',
    partyLedgerId: 'ledger-customer-john',
    items: [
      { stockItemId: 'stock-laptop', qty: 2, rate: 48000, gstRate: 18 },
      { stockItemId: 'stock-mouse', qty: 5, rate: 750, gstRate: 12 }
    ],
    ledgerPostings: [
      { ledgerId: 'ledger-customer-john', amount: 99750, type: 'Dr' },
      { ledgerId: 'ledger-sales', amount: 99750, type: 'Cr' }
    ],
    narration: 'Sold 2 laptops and 5 mice to John Doe.'
  },
  {
    id: 'tx-3',
    voucherNo: 'PMT-001',
    date: '2026-06-10',
    voucherType: 'Payment',
    partyLedgerId: 'ledger-supplier-apex',
    items: [],
    ledgerPostings: [
      { ledgerId: 'ledger-supplier-apex', amount: 50000, type: 'Dr' },
      { ledgerId: 'ledger-bank', amount: 50000, type: 'Cr' }
    ],
    narration: 'Paid 50,000 to Apex Distributors via HDFC Bank check.'
  },
  {
    id: 'tx-4',
    voucherNo: 'RCT-001',
    date: '2026-06-12',
    voucherType: 'Receipt',
    partyLedgerId: 'ledger-customer-john',
    items: [],
    ledgerPostings: [
      { ledgerId: 'ledger-cash', amount: 30000, type: 'Dr' },
      { ledgerId: 'ledger-customer-john', amount: 30000, type: 'Cr' }
    ],
    narration: 'Received cash 30,000 from John Doe against outstanding balance.'
  },
  {
    id: 'tx-5',
    voucherNo: 'PMT-002',
    date: '2026-06-15',
    voucherType: 'Payment',
    partyLedgerId: 'ledger-rent',
    items: [],
    ledgerPostings: [
      { ledgerId: 'ledger-rent', amount: 12000, type: 'Dr' },
      { ledgerId: 'ledger-bank', amount: 12000, type: 'Cr' }
    ],
    narration: 'Paid office rent of 12,000 for June 2026 via HDFC Bank transfer.'
  }
];
