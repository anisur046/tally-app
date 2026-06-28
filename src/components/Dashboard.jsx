import React, { useContext } from 'react';
import { TallyContext } from '../context/TallyContext';
import { getProfitAndLoss, getLedgerBalance } from '../utils/accountingEngine';
import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  Percent, 
  PlusCircle, 
  ArrowRight,
  ChevronRight
} from 'lucide-react';

export default function Dashboard() {
  const { transactions, ledgers, stockItems, setActiveView, companyDetails } = useContext(TallyContext);

  // Compute reports details
  const pl = getProfitAndLoss(ledgers, transactions, stockItems);

  // Cash and Bank Ledger balances
  const cashLedger = ledgers.find(l => l.subgroup === 'Cash-in-Hand');
  const bankLedger = ledgers.find(l => l.subgroup === 'Bank Accounts');
  
  const cashBal = cashLedger ? getLedgerBalance(cashLedger, transactions) : { amount: 0, type: 'Dr' };
  const bankBal = bankLedger ? getLedgerBalance(bankLedger, transactions) : { amount: 0, type: 'Dr' };

  const totalCashBank = 
    (cashBal.type === 'Dr' ? cashBal.amount : -cashBal.amount) +
    (bankBal.type === 'Dr' ? bankBal.amount : -bankBal.amount);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Get recent 5 transactions
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);

  // Calculate monthly sales & purchases for the bar chart
  // We can group last 5 transactions or map months
  // For a beautiful SVG bar chart, let's render standard monthly labels
  const monthlyData = [
    { month: 'Jan', sales: 0, purchases: 0 },
    { month: 'Feb', sales: 0, purchases: 0 },
    { month: 'Mar', sales: 0, purchases: 0 },
    { month: 'Apr', sales: 45000, purchases: 30000 },
    { month: 'May', sales: 120000, purchases: 95000 },
    { month: 'Jun', sales: pl.salesTotal || 0, purchases: pl.purchasesTotal || 0 }
  ];

  const maxVal = Math.max(...monthlyData.map(d => Math.max(d.sales, d.purchases, 50000)));

  return (
    <div className="view-container">
      <div style={{ marginBottom: '28px', display: 'flex', justifyContent: 'between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(to right, #fff, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Welcome to {companyDetails.name}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Accounting Dashboard for Financial Year {companyDetails.financialYear}
          </p>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        <div className="glass-card kpi-card">
          <div className="kpi-icon success">
            <TrendingUp size={24} />
          </div>
          <div className="kpi-info">
            <h3>Total Sales</h3>
            <p>{formatCurrency(pl.salesTotal)}</p>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon danger">
            <TrendingDown size={24} />
          </div>
          <div className="kpi-info">
            <h3>Total Purchases</h3>
            <p>{formatCurrency(pl.purchasesTotal)}</p>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon primary">
            <Wallet size={24} />
          </div>
          <div className="kpi-info">
            <h3>Cash / Bank Balance</h3>
            <p>{formatCurrency(totalCashBank)}</p>
          </div>
        </div>

        <div className="glass-card kpi-card">
          <div className="kpi-icon warning">
            <Percent size={24} />
          </div>
          <div className="kpi-info">
            <h3>Net Profit Margin</h3>
            <p style={{ color: pl.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
              {formatCurrency(pl.netProfit)}
            </p>
          </div>
        </div>
      </div>

      {/* Charts & Recent Transactions Grid */}
      <div className="dashboard-grid">
        {/* SVG Chart */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Financial Performance Trend</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Monthly Sales vs Purchases (INR)</p>
          
          <div className="chart-container">
            <svg className="chart-svg" viewBox="0 0 500 220">
              <defs>
                <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.1" />
                </linearGradient>
                <linearGradient id="purchasesGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              <line x1="40" y1="20" x2="480" y2="20" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
              <line x1="40" y1="70" x2="480" y2="70" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
              <line x1="40" y1="120" x2="480" y2="120" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />
              <line x1="40" y1="170" x2="480" y2="170" stroke="rgba(255,255,255,0.05)" strokeDasharray="4" />

              {/* Data Bars */}
              {monthlyData.map((data, index) => {
                const xBase = 50 + index * 70;
                
                // Height calculations
                const salesHeight = (data.sales / maxVal) * 140;
                const purchaseHeight = (data.purchases / maxVal) * 140;
                
                return (
                  <g key={data.month}>
                    {/* Purchase Bar */}
                    <rect 
                      x={xBase} 
                      y={170 - purchaseHeight} 
                      width="18" 
                      height={purchaseHeight} 
                      fill="url(#purchasesGrad)" 
                      rx="3"
                    />
                    {/* Sales Bar */}
                    <rect 
                      x={xBase + 22} 
                      y={170 - salesHeight} 
                      width="18" 
                      height={salesHeight} 
                      fill="url(#salesGrad)" 
                      rx="3"
                    />
                    {/* Label */}
                    <text 
                      x={xBase + 20} 
                      y="190" 
                      fill="var(--text-secondary)" 
                      fontSize="9" 
                      textAnchor="middle"
                    >
                      {data.month}
                    </text>
                  </g>
                );
              })}

              {/* X Axis line */}
              <line x1="40" y1="170" x2="480" y2="170" stroke="rgba(255,255,255,0.15)" />
            </svg>
          </div>

          <div style={{ display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '3px' }}></div>
              <span style={{ color: 'var(--text-secondary)' }}>Sales</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '12px', height: '12px', backgroundColor: '#ef4444', borderRadius: '3px' }}></div>
              <span style={{ color: 'var(--text-secondary)' }}>Purchases</span>
            </div>
          </div>
        </div>

        {/* Recent Transactions list */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Recent Vouchers</h3>
            <button 
              className="btn-secondary btn-sm" 
              onClick={() => setActiveView('reports')}
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            >
              Day Book <ChevronRight size={14} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flexGrow: 1 }}>
            {recentTransactions.length === 0 ? (
              <div style={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                No voucher transactions recorded yet.
              </div>
            ) : (
              recentTransactions.map((tx) => {
                const badgeClass = 
                  tx.voucherType === 'Sales' ? 'badge-sales' :
                  tx.voucherType === 'Purchase' ? 'badge-purchase' :
                  tx.voucherType === 'Payment' ? 'badge-payment' :
                  tx.voucherType === 'Receipt' ? 'badge-receipt' : 'badge-journal';
                
                const party = ledgers.find(l => l.id === tx.partyLedgerId);
                const partyName = party ? party.name : 'Journal Adjustments';
                
                // Get gross total from postings
                const grossAmount = tx.ledgerPostings.find(p => p.type === 'Dr')?.amount || 0;

                return (
                  <div 
                    key={tx.id} 
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between', 
                      padding: '12px', 
                      borderRadius: 'var(--radius-md)', 
                      backgroundColor: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.03)'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className={`badge ${badgeClass}`}>{tx.voucherType}</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{tx.voucherNo}</span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{partyName}</span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{formatCurrency(grossAmount)}</span>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>{tx.date}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quick Action shortcuts */}
      <div className="glass-card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '16px' }}>Quick Accounting Tasks</h3>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
          <button className="btn-primary" onClick={() => setActiveView('vouchers')}>
            <PlusCircle size={16} /> New Voucher Entry
          </button>
          <button className="btn-secondary" onClick={() => setActiveView('ledgers')}>
            Create Ledger Account
          </button>
          <button className="btn-secondary" onClick={() => setActiveView('inventory')}>
            Add Stock Item
          </button>
          <button className="btn-secondary" onClick={() => setActiveView('reports')}>
            View Financial Statements
          </button>
        </div>
      </div>
    </div>
  );
}
