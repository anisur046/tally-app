import React, { useState, useContext } from 'react';
import { TallyContext } from '../context/TallyContext';
import { 
  getTrialBalance, 
  getProfitAndLoss, 
  getBalanceSheet, 
  calculateInventoryValuation 
} from '../utils/accountingEngine';
import { Trash2, Search, Calendar, FileText, Download, Printer, FileSpreadsheet, MessageSquare, Send, Check, X } from 'lucide-react';

export default function Reports() {
  const { ledgers, transactions, stockItems, deleteTransaction, companyDetails } = useContext(TallyContext);
  const [activeTab, setActiveTab] = useState('trial'); // trial, pl, bs, stock, daybook
  
  // Search & dates for Day Book
  const [dayBookSearch, setDayBookSearch] = useState('');
  const [dayBookFilterType, setDayBookFilterType] = useState('All');

  // Report Date Period State (defaults to start of current financial year to today)
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  // Voucher details & SMS states
  const [selectedVoucher, setSelectedVoucher] = useState(null);
  const [smsModalOpen, setSmsModalOpen] = useState(false);
  const [smsPhone, setSmsPhone] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsSuccess, setSmsSuccess] = useState(false);

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  const formatDateDisplay = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getPeriodString = (isCumulative = false) => {
    if (isCumulative) {
      return `As of ${toDate ? formatDateDisplay(toDate) : 'Present'}`;
    }
    const fromStr = fromDate ? formatDateDisplay(fromDate) : '1 Apr 2026';
    const toStr = toDate ? formatDateDisplay(toDate) : 'Present';
    return `Period: ${fromStr} to ${toStr}`;
  };

  const renderReportCompanyHeader = () => {
    return (
      <div className="report-company-header">
        <h1>{companyDetails.name}</h1>
        <p className="address">{companyDetails.address}</p>
        <p className="details">
          {companyDetails.gstin && <span><strong>GSTIN:</strong> {companyDetails.gstin}</span>}
          {companyDetails.phone && <span> | <strong>Phone:</strong> {companyDetails.phone}</span>}
          {companyDetails.email && <span> | <strong>Email:</strong> {companyDetails.email}</span>}
          {companyDetails.website && <span> | <strong>Website:</strong> {companyDetails.website}</span>}
        </p>
      </div>
    );
  };

  // 1. Trial Balance Data (Cumulative up to toDate)
  const tb = getTrialBalance(ledgers, transactions, fromDate, toDate);

  // 2. Profit & Loss Data (For the selected period)
  const pl = getProfitAndLoss(ledgers, transactions, stockItems, fromDate, toDate);

  // 3. Balance Sheet Data (Cumulative snapshot as of toDate)
  const bs = getBalanceSheet(ledgers, transactions, stockItems, fromDate, toDate);

  // 4. Stock Summary Valuation (Valued for the selected period)
  const { stockSummary } = calculateInventoryValuation(stockItems, transactions, fromDate, toDate);

  // 5. Day Book Filtration (Filtered by selected period range)
  const filteredDayBook = transactions
    .filter((tx) => {
      const party = ledgers.find((l) => l.id === tx.partyLedgerId);
      const partyName = party ? party.name : 'Journal Adjustments';
      const matchesSearch = 
        tx.voucherNo.toLowerCase().includes(dayBookSearch.toLowerCase()) ||
        partyName.toLowerCase().includes(dayBookSearch.toLowerCase()) ||
        tx.narration.toLowerCase().includes(dayBookSearch.toLowerCase());
      
      const matchesType = dayBookFilterType === 'All' || tx.voucherType === dayBookFilterType;

      const matchesDate = 
        (!fromDate || tx.date >= fromDate) && 
        (!toDate || tx.date <= toDate);

      return matchesSearch && matchesType && matchesDate;
    })
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  let totalPurchase = 0;
  let totalSale = 0;
  filteredDayBook.forEach((tx) => {
    const amount = tx.ledgerPostings[0]?.amount || 0;
    const isPurchaseSide = tx.voucherType === 'Purchase' || tx.voucherType === 'Payment' || (tx.voucherType === 'Journal' && tx.ledgerPostings[0]?.type === 'Dr');
    if (isPurchaseSide) {
      totalPurchase += amount;
    } else {
      totalSale += amount;
    }
  });

  // CSV Downloader Helper
  const downloadCSV = (filename, headers, rows) => {
    const formatCell = (val) => {
      if (val === null || val === undefined) return '';
      const str = String(val).replace(/"/g, '""');
      if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(formatCell).join(','),
      ...rows.map(row => row.map(formatCell).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const periodSuffix = `${fromDate || 'Start'}_to_${toDate || 'Present'}`;
    
    if (activeTab === 'trial') {
      const headers = ["Particulars (Ledger Name)", "Subgroup Group", "Debit Balance (Dr)", "Credit Balance (Cr)"];
      const rows = [
        ...tb.rows.map(row => [row.name, row.subgroup, row.dr || 0, row.cr || 0]),
        ["GRAND TOTAL", "", tb.totalDr, tb.totalCr]
      ];
      downloadCSV(`Trial_Balance_${periodSuffix}.csv`, headers, rows);
    } 
    else if (activeTab === 'pl') {
      const headers = ["Expenses / Debits", "Amount (Dr)", "Incomes / Credits", "Amount (Cr)"];
      
      // Pair trading accounts
      const tradingRows = [];
      const leftTrading = [
        { name: "Opening Stock", amount: pl.openingStockValue },
        { name: "Purchases A/c", amount: pl.purchasesTotal },
        { name: "Direct Expenses", amount: pl.directExpenses },
        ...(pl.grossProfit >= 0 ? [{ name: "Gross Profit c/o", amount: pl.grossProfit }] : [])
      ];
      const rightTrading = [
        { name: "Sales Accounts", amount: pl.salesTotal },
        { name: "Closing Stock Value", amount: pl.closingStockValue },
        ...(pl.grossProfit < 0 ? [{ name: "Gross Loss c/o", amount: Math.abs(pl.grossProfit) }] : [])
      ];
      
      const tradingLen = Math.max(leftTrading.length, rightTrading.length);
      for (let i = 0; i < tradingLen; i++) {
        tradingRows.push([
          leftTrading[i]?.name || "",
          leftTrading[i]?.amount || "",
          rightTrading[i]?.name || "",
          rightTrading[i]?.amount || ""
        ]);
      }
      tradingRows.push([
        "Total Direct Expenses",
        pl.openingStockValue + pl.purchasesTotal + pl.directExpenses + (pl.grossProfit >= 0 ? pl.grossProfit : 0),
        "Total Direct Incomes",
        pl.salesTotal + pl.closingStockValue + (pl.grossProfit < 0 ? Math.abs(pl.grossProfit) : 0)
      ]);

      // Pair indirect accounts
      const indirectRows = [];
      const leftIndirect = [
        ...pl.indirectExpenses.map(exp => ({ name: exp.name, amount: exp.amount })),
        ...(pl.netProfit >= 0 ? [{ name: "Net Profit Transferred to Capital", amount: pl.netProfit }] : [])
      ];
      const rightIndirect = [
        ...(pl.grossProfit >= 0 ? [{ name: "Gross Profit b/f", amount: pl.grossProfit }] : []),
        ...pl.indirectIncomes.map(inc => ({ name: inc.name, amount: inc.amount })),
        ...(pl.netProfit < 0 ? [{ name: "Net Loss", amount: Math.abs(pl.netProfit) }] : [])
      ];

      const indirectLen = Math.max(leftIndirect.length, rightIndirect.length);
      for (let i = 0; i < indirectLen; i++) {
        indirectRows.push([
          leftIndirect[i]?.name || "",
          leftIndirect[i]?.amount || "",
          rightIndirect[i]?.name || "",
          rightIndirect[i]?.amount || ""
        ]);
      }
      indirectRows.push([
        "Total Indirect Expenses",
        pl.indirectExpensesTotal + (pl.netProfit >= 0 ? pl.netProfit : 0),
        "Total Indirect Incomes",
        (pl.grossProfit >= 0 ? pl.grossProfit : 0) + pl.indirectIncomesTotal + (pl.netProfit < 0 ? Math.abs(pl.netProfit) : 0)
      ]);

      const rows = [
        ["DIRECT / TRADING ACCOUNT", "", "", ""],
        ...tradingRows,
        ["", "", "", ""],
        ["INDIRECT / INCOME STATEMENT", "", "", ""],
        ...indirectRows
      ];
      downloadCSV(`Profit_And_Loss_${periodSuffix}.csv`, headers, rows);
    } 
    else if (activeTab === 'bs') {
      const headers = ["Liabilities & Capital", "Amount (Liabilities)", "Assets", "Amount (Assets)"];
      const bsRows = [];
      
      const bsLen = Math.max(bs.liabilitiesList.length, bs.assetsList.length);
      for (let i = 0; i < bsLen; i++) {
        bsRows.push([
          bs.liabilitiesList[i]?.name || "",
          bs.liabilitiesList[i]?.amount || "",
          bs.assetsList[i]?.name || "",
          bs.assetsList[i]?.amount || ""
        ]);
      }
      bsRows.push([
        "Total Capital & Liabilities",
        bs.totalLiabilities,
        "Total Assets",
        bs.totalAssets
      ]);
      downloadCSV(`Balance_Sheet_${toDate || 'Present'}.csv`, headers, bsRows);
    } 
    else if (activeTab === 'stock') {
      const headers = ["Item Name", "Unit", "Opening Qty", "Inwards (Purchased)", "Outwards (Sold)", "Closing Qty", "Average Rate (INR)", "Closing Stock Value (INR)"];
      const rows = [
        ...Object.values(stockSummary).map(sum => [sum.name, sum.unit, sum.openingQty, sum.inwardsQty, sum.outwardsQty, sum.closingQty, sum.closingRate, sum.closingVal]),
        ["Total Inventory Value", "", "", "", "", "", "", pl.closingStockValue]
      ];
      downloadCSV(`Stock_Summary_${periodSuffix}.csv`, headers, rows);
    } 
    else if (activeTab === 'daybook') {
      const headers = ["Voucher Date", "Voucher No", "Voucher Type", "Account / Party Particulars", "Purchase Amount (Dr)", "Sale Amount (Cr)", "Narration"];
      const rows = [
        ...filteredDayBook.map(tx => {
          const party = ledgers.find((l) => l.id === tx.partyLedgerId);
          const partyName = party ? party.name : 'Journal Adjustments';
          const amount = tx.ledgerPostings[0]?.amount || 0;
          const isPurchaseSide = tx.voucherType === 'Purchase' || tx.voucherType === 'Payment' || (tx.voucherType === 'Journal' && tx.ledgerPostings[0]?.type === 'Dr');
          return [
            tx.date, 
            tx.voucherNo, 
            tx.voucherType, 
            partyName, 
            isPurchaseSide ? amount : '', 
            isPurchaseSide ? '' : amount, 
            tx.narration
          ];
        }),
        ["GRAND TOTAL", "", "", "", totalPurchase, totalSale, ""]
      ];
      downloadCSV(`Day_Book_${periodSuffix}.csv`, headers, rows);
    }
  };

  return (
    <div className="view-container">
      {/* Date Period Filter Bar */}
      <div className="glass-card no-print" style={{ padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Calendar size={18} style={{ color: '#818cf8' }} />
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Filter Report Period:</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>From:</label>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: '150px', height: '36px', padding: '6px 12px', fontSize: '0.85rem' }} 
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>To:</label>
            <input 
              type="date" 
              className="form-control" 
              style={{ width: '150px', height: '36px', padding: '6px 12px', fontSize: '0.85rem' }} 
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
            />
          </div>
          <button 
            type="button"
            className="btn-secondary" 
            style={{ height: '36px', padding: '0 16px', fontSize: '0.8rem', fontWeight: 600 }}
            onClick={() => {
              setFromDate('2026-04-01');
              setToDate(new Date().toISOString().split('T')[0]);
            }}
          >
            Reset Period
          </button>
        </div>
      </div>

      {/* Report selector tabs */}
      <div className="report-tabs no-print" style={{ marginTop: '0px' }}>
        <div className={`rtab ${activeTab === 'trial' ? 'active' : ''}`} onClick={() => setActiveTab('trial')}>Trial Balance</div>
        <div className={`rtab ${activeTab === 'pl' ? 'active' : ''}`} onClick={() => setActiveTab('pl')}>Profit & Loss A/c</div>
        <div className={`rtab ${activeTab === 'bs' ? 'active' : ''}`} onClick={() => setActiveTab('bs')}>Balance Sheet</div>
        <div className={`rtab ${activeTab === 'stock' ? 'active' : ''}`} onClick={() => setActiveTab('stock')}>Stock Summary</div>
        <div className={`rtab ${activeTab === 'daybook' ? 'active' : ''}`} onClick={() => setActiveTab('daybook')}>Day Book (Transactions)</div>
      </div>

      <div className={selectedVoucher ? "no-print" : ""}>
        {/* Trial Balance Report */}
        {activeTab === 'trial' && (
        <div className="glass-card">
          {renderReportCompanyHeader()}
          <div className="report-header">
            <div>
              <h2>Trial Balance Statement</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                {getPeriodString(false)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                className="btn-secondary no-print" 
                onClick={handlePrint}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <Printer size={16} /> Print Report
              </button>
              <button 
                className="btn-primary no-print" 
                onClick={handleExportCSV}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <FileSpreadsheet size={16} /> Export to Excel
              </button>
              {tb.isBalanced ? (
                <span className="badge badge-sales">Balanced A/c</span>
              ) : (
                <span className="badge badge-purchase">Unbalanced A/c Diff: {formatCurrency(Math.abs(tb.totalDr - tb.totalCr))}</span>
              )}
            </div>
          </div>

          <div className="table-wrapper">
            <table className="tally-table">
              <thead>
                <tr>
                  <th>Particulars (Ledger Name)</th>
                  <th>Subgroup Group</th>
                  <th className="text-right">Debit Balance (Dr)</th>
                  <th className="text-right">Credit Balance (Cr)</th>
                </tr>
              </thead>
              <tbody>
                {tb.rows.map((row) => (
                  <tr key={row.id}>
                    <td style={{ fontWeight: 600 }}>{row.name}</td>
                    <td><span className="badge badge-journal">{row.subgroup}</span></td>
                    <td className="text-right" style={{ fontFamily: 'monospace' }}>
                      {row.dr > 0 ? formatCurrency(row.dr) : ''}
                    </td>
                    <td className="text-right" style={{ fontFamily: 'monospace' }}>
                      {row.cr > 0 ? formatCurrency(row.cr) : ''}
                    </td>
                  </tr>
                ))}
                
                {/* Total Row */}
                <tr style={{ borderTop: '2px solid var(--border-color)', fontWeight: 800 }}>
                  <td>GRAND TOTAL</td>
                  <td></td>
                  <td className="text-right" style={{ fontFamily: 'monospace', color: 'var(--color-info)' }}>{formatCurrency(tb.totalDr)}</td>
                  <td className="text-right" style={{ fontFamily: 'monospace', color: 'var(--color-info)' }}>{formatCurrency(tb.totalCr)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Profit & Loss Report */}
      {activeTab === 'pl' && (
        <div className="glass-card">
          {renderReportCompanyHeader()}
          <div className="report-header">
            <div>
              <h2>Profit & Loss Account</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                {getPeriodString(false)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} className="no-print">
                <button 
                  className="btn-secondary" 
                  onClick={handlePrint}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                >
                  <Printer size={16} /> Print Report
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleExportCSV}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                >
                  <FileSpreadsheet size={16} /> Export to Excel
                </button>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Net Result:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: pl.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
                  {pl.netProfit >= 0 ? `Net Profit: ` : `Net Loss: `} {formatCurrency(Math.abs(pl.netProfit))}
                </div>
              </div>
            </div>
          </div>

          <div className="financial-split">
            {/* Left Column: Debit / Expenses */}
            <div>
              <div className="fin-section-title">Expenses (Debits)</div>
              
              <div className="fin-row">
                <span>Opening Stock</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(pl.openingStockValue)}</span>
              </div>

              <div className="fin-row">
                <span>Purchases A/c</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(pl.purchasesTotal)}</span>
              </div>

              <div className="fin-row">
                <span>Direct Expenses</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(pl.directExpenses)}</span>
              </div>

              {/* Gross Profit C/o */}
              {pl.grossProfit >= 0 && (
                <div className="fin-row bold" style={{ color: 'var(--color-success)' }}>
                  <span>Gross Profit c/o</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatCurrency(pl.grossProfit)}</span>
                </div>
              )}

              {/* Total Trading (Expenses side) */}
              <div className="fin-row total">
                <span>Total</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {formatCurrency(pl.openingStockValue + pl.purchasesTotal + pl.directExpenses + (pl.grossProfit >= 0 ? pl.grossProfit : 0))}
                </span>
              </div>

              {/* Indirect Expenses section */}
              <div style={{ marginTop: '16px' }}>
                <div className="fin-section-title">Indirect Expenses</div>
                {pl.indirectExpenses.map((exp, idx) => (
                  <div key={idx} className="fin-row indent-1">
                    <span>{exp.name}</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(exp.amount)}</span>
                  </div>
                ))}
                {pl.indirectExpenses.length === 0 && (
                  <div className="fin-row indent-1" style={{ color: 'var(--text-muted)' }}>None recorded</div>
                )}
                
                {/* Net Profit */}
                {pl.netProfit >= 0 && (
                  <div className="fin-row bold" style={{ color: 'var(--color-success)', marginTop: '8px' }}>
                    <span>Net Profit Transferred to Capital</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(pl.netProfit)}</span>
                  </div>
                )}
              </div>

              <div className="fin-row total" style={{ marginTop: '8px' }}>
                <span>Total</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {formatCurrency(pl.indirectExpensesTotal + (pl.netProfit >= 0 ? pl.netProfit : 0))}
                </span>
              </div>
            </div>

            {/* Right Column: Credit / Incomes */}
            <div>
              <div className="fin-section-title">Incomes / Assets (Credits)</div>
              
              <div className="fin-row">
                <span>Sales Accounts</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(pl.salesTotal)}</span>
              </div>

              <div className="fin-row">
                <span>Closing Stock Value</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(pl.closingStockValue)}</span>
              </div>

              {/* Gross Loss C/o */}
              {pl.grossProfit < 0 && (
                <div className="fin-row bold" style={{ color: 'var(--color-error)' }}>
                  <span>Gross Loss c/o</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatCurrency(Math.abs(pl.grossProfit))}</span>
                </div>
              )}

              {/* Total Trading (Income side) */}
              <div className="fin-row total">
                <span>Total</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {formatCurrency(pl.salesTotal + pl.closingStockValue + (pl.grossProfit < 0 ? Math.abs(pl.grossProfit) : 0))}
                </span>
              </div>

              {/* Indirect Incomes section */}
              <div style={{ marginTop: '16px' }}>
                <div className="fin-section-title">Indirect Incomes</div>
                
                {/* Show Gross Profit brought forward */}
                {pl.grossProfit >= 0 && (
                  <div className="fin-row">
                    <span>Gross Profit b/f</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(pl.grossProfit)}</span>
                  </div>
                )}

                {pl.indirectIncomes.map((inc, idx) => (
                  <div key={idx} className="fin-row indent-1">
                    <span>{inc.name}</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(inc.amount)}</span>
                  </div>
                ))}
                
                {/* Net Loss */}
                {pl.netProfit < 0 && (
                  <div className="fin-row bold" style={{ color: 'var(--color-error)' }}>
                    <span>Net Loss</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(Math.abs(pl.netProfit))}</span>
                  </div>
                )}
              </div>

              <div className="fin-row total" style={{ marginTop: '8px' }}>
                <span>Total</span>
                <span style={{ fontFamily: 'monospace' }}>
                  {formatCurrency(
                    (pl.grossProfit >= 0 ? pl.grossProfit : 0) + 
                    pl.indirectIncomesTotal + 
                    (pl.netProfit < 0 ? Math.abs(pl.netProfit) : 0)
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Balance Sheet Report */}
      {activeTab === 'bs' && (
        <div className="glass-card">
          {renderReportCompanyHeader()}
          <div className="report-header">
            <div>
              <h2>Balance Sheet</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                {getPeriodString(true)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button 
                className="btn-secondary no-print" 
                onClick={handlePrint}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <Printer size={16} /> Print Report
              </button>
              <button 
                className="btn-primary no-print" 
                onClick={handleExportCSV}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <FileSpreadsheet size={16} /> Export to Excel
              </button>
              {bs.isBalanced ? (
                <span className="badge badge-sales">Tally Matched</span>
              ) : (
                <span className="badge badge-purchase">Unbalanced Diff: {formatCurrency(Math.abs(bs.totalAssets - bs.totalLiabilities))}</span>
              )}
            </div>
          </div>

          <div className="financial-split">
            {/* Liabilities Side */}
            <div>
              <div className="fin-section-title">Liabilities & Capital</div>
              {bs.liabilitiesList.map((item, idx) => (
                <div key={idx} className={`fin-row ${item.isProfitShare ? 'bold' : ''}`}>
                  <span>{item.name}</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatCurrency(item.amount)}</span>
                </div>
              ))}
              
              <div className="fin-row total" style={{ marginTop: '24px' }}>
                <span>Total Capital & Liabilities</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(bs.totalLiabilities)}</span>
              </div>
            </div>

            {/* Assets Side */}
            <div>
              <div className="fin-section-title">Assets</div>
              {bs.assetsList.map((item, idx) => (
                <div key={idx} className="fin-row">
                  <span>{item.name}</span>
                  <span style={{ fontFamily: 'monospace' }}>{formatCurrency(item.amount)}</span>
                </div>
              ))}

              <div className="fin-row total" style={{ marginTop: '24px' }}>
                <span>Total Assets</span>
                <span style={{ fontFamily: 'monospace' }}>{formatCurrency(bs.totalAssets)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Summary */}
      {activeTab === 'stock' && (
        <div className="glass-card">
          {renderReportCompanyHeader()}
          <div className="report-header">
            <div>
              <h2>Stock Summary (FIFO Valuation)</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                {getPeriodString(false)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} className="no-print">
                <button 
                  className="btn-secondary" 
                  onClick={handlePrint}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                >
                  <Printer size={16} /> Print Report
                </button>
                <button 
                  className="btn-primary" 
                  onClick={handleExportCSV}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
                >
                  <FileSpreadsheet size={16} /> Export to Excel
                </button>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total Closing Inventory Value:</span>
                <div style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-info)' }}>
                  {formatCurrency(pl.closingStockValue)}
                </div>
              </div>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="tally-table">
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Unit</th>
                  <th className="text-right">Opening Qty</th>
                  <th className="text-right">Inwards (Purchased)</th>
                  <th className="text-right">Outwards (Sold)</th>
                  <th className="text-right">Closing Qty</th>
                  <th className="text-right">Average Rate</th>
                  <th className="text-right">Closing Stock Value</th>
                </tr>
              </thead>
              <tbody>
                {Object.values(stockSummary).map((sum) => (
                  <tr key={sum.id}>
                    <td style={{ fontWeight: 600 }}>{sum.name}</td>
                    <td>{sum.unit}</td>
                    <td className="text-right" style={{ fontFamily: 'monospace' }}>{sum.openingQty}</td>
                    <td className="text-right" style={{ fontFamily: 'monospace', color: 'var(--color-success)' }}>{sum.inwardsQty}</td>
                    <td className="text-right" style={{ fontFamily: 'monospace', color: 'var(--color-error)' }}>{sum.outwardsQty}</td>
                    <td className="text-right" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{sum.closingQty}</td>
                    <td className="text-right" style={{ fontFamily: 'monospace' }}>{formatCurrency(sum.closingRate)}</td>
                    <td className="text-right" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatCurrency(sum.closingVal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Day Book Transactions List */}
      {activeTab === 'daybook' && (
        <div className="glass-card">
          {renderReportCompanyHeader()}
          <div className="report-header">
            <div>
              <h2>Day Book Entries</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '2px' }}>
                {getPeriodString(false)}
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} className="no-print">
              <button 
                className="btn-secondary" 
                onClick={handlePrint}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <Printer size={16} /> Print Report
              </button>
              <button 
                className="btn-primary" 
                onClick={handleExportCSV}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px', fontSize: '0.85rem' }}
              >
                <FileSpreadsheet size={16} /> Export to Excel
              </button>
            </div>
          </div>

          {/* Filters inside Daybook */}
          <div className="filter-bar no-print">
            <div style={{ position: 'relative', flexGrow: 1 }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input 
                type="text" 
                placeholder="Search by Voucher No., Client name, remarks..." 
                className="form-control" 
                value={dayBookSearch}
                onChange={(e) => setDayBookSearch(e.target.value)}
                style={{ paddingLeft: '38px', height: '40px' }}
              />
            </div>

            <div style={{ width: '180px' }}>
              <select 
                className="form-control" 
                style={{ height: '40px' }}
                value={dayBookFilterType}
                onChange={(e) => setDayBookFilterType(e.target.value)}
              >
                <option value="All">All Vouchers</option>
                <option value="Sales">Sales</option>
                <option value="Purchase">Purchase</option>
                <option value="Payment">Payment</option>
                <option value="Receipt">Receipt</option>
                <option value="Journal">Journal</option>
              </select>
            </div>
          </div>

          <div className="table-wrapper">
            <table className="tally-table">
              <thead>
                <tr>
                  <th>Voucher Date</th>
                  <th>Voucher No</th>
                  <th>Voucher Type</th>
                  <th>Account / Party Particulars</th>
                  <th className="text-right">Purchase Amount (Dr)</th>
                  <th className="text-right">Sale Amount (Cr)</th>
                  <th>Narration</th>
                  <th className="text-center no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDayBook.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="text-center" style={{ color: 'var(--text-muted)', padding: '24px' }}>
                      No transaction entries found matching criteria.
                    </td>
                  </tr>
                ) : (
                  <>
                    {filteredDayBook.map((tx) => {
                      const badgeClass = 
                        tx.voucherType === 'Sales' ? 'badge-sales' :
                        tx.voucherType === 'Purchase' ? 'badge-purchase' :
                        tx.voucherType === 'Payment' ? 'badge-payment' :
                        tx.voucherType === 'Receipt' ? 'badge-receipt' : 'badge-journal';
                      
                      const party = ledgers.find((l) => l.id === tx.partyLedgerId);
                      const partyName = party ? party.name : 'Journal Adjustments';

                      // Get gross total from postings
                      const amount = tx.ledgerPostings[0]?.amount || 0;
                      const isPurchaseSide = tx.voucherType === 'Purchase' || tx.voucherType === 'Payment' || (tx.voucherType === 'Journal' && tx.ledgerPostings[0]?.type === 'Dr');

                      return (
                        <tr key={tx.id}>
                          <td>{tx.date}</td>
                          <td>
                            <span 
                              onClick={() => setSelectedVoucher(tx)}
                              style={{ 
                                fontWeight: 700, 
                                color: 'var(--color-accent)', 
                                cursor: 'pointer',
                                textDecoration: 'underline',
                                textUnderlineOffset: '3px'
                              }}
                            >
                              {tx.voucherNo}
                            </span>
                          </td>
                          <td>
                            <span className={`badge ${badgeClass}`}>{tx.voucherType}</span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{partyName}</td>
                          <td className="text-right" style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-error)' }}>
                            {isPurchaseSide ? formatCurrency(amount) : ''}
                          </td>
                          <td className="text-right" style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--color-success)' }}>
                            {isPurchaseSide ? '' : formatCurrency(amount)}
                          </td>
                          <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {tx.narration}
                          </td>
                          <td className="text-center no-print">
                            <button 
                              type="button" 
                              style={{ color: 'var(--color-error)', backgroundColor: 'transparent' }}
                              onClick={() => {
                                if (window.confirm(`Are you sure you want to delete voucher ${tx.voucherNo}? This action is irreversible!`)) {
                                  deleteTransaction(tx.id);
                                }
                              }}
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {/* Total Row */}
                    <tr style={{ borderTop: '2.5px solid var(--border-color)', fontWeight: 800, backgroundColor: 'rgba(255,255,255,0.01)' }}>
                      <td colSpan="4">GRAND TOTAL</td>
                      <td className="text-right" style={{ fontFamily: 'monospace', color: 'var(--color-error)', fontSize: '0.95rem' }}>{formatCurrency(totalPurchase)}</td>
                      <td className="text-right" style={{ fontFamily: 'monospace', color: 'var(--color-success)', fontSize: '0.95rem' }}>{formatCurrency(totalSale)}</td>
                      <td colSpan="2"></td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
      </div>

      {/* Voucher Details Modal */}
      {selectedVoucher && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <style>{`
            @media print {
              /* Hide overlay background during print */
              .modal-overlay {
                background: transparent !important;
                position: static !important;
                display: block !important;
                padding: 0 !important;
                margin: 0 !important;
              }
              
              /* Force transparent background and black text on all voucher elements and their children */
              .print-voucher-area,
              .print-voucher-area * {
                background: transparent !important;
                color: black !important;
                box-shadow: none !important;
              }
              
              .print-voucher-area {
                position: absolute !important;
                left: 0 !important;
                top: 0 !important;
                width: 100% !important;
                border: none !important;
                padding: 10px !important;
                font-size: 12px !important;
              }
              
              .print-voucher-area select, 
              .print-voucher-area input, 
              .print-voucher-area textarea {
                border: none !important;
              }
              
              .print-voucher-area .no-print {
                display: none !important;
              }
              
              .print-voucher-area .badge {
                border: 1px solid black !important;
                color: black !important;
                background: transparent !important;
              }
            }
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
          
          <div className="glass-card modal-content print-voucher-area" style={{ maxWidth: '750px', width: '90%', padding: '28px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 20px 50px rgba(0,0,0,0.6)' }}>
            {/* Header info */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid var(--border-color)', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  {companyDetails.name}
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginTop: '4px' }}>
                  {companyDetails.address}
                </p>
                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  {companyDetails.gstin && <span>GSTIN: {companyDetails.gstin}</span>}
                  {companyDetails.phone && <span>Phone: {companyDetails.phone}</span>}
                </div>
              </div>
              <div style={{ textAlign: 'right' }} className="no-print">
                <button 
                  type="button" 
                  style={{ background: 'transparent', color: 'var(--text-muted)', padding: '4px' }} 
                  onClick={() => setSelectedVoucher(null)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Customer Billing details "To" */}
            {(selectedVoucher.customerName || selectedVoucher.customerAddress || selectedVoucher.customerMobile) && (
              <div style={{ marginBottom: '20px', borderLeft: '3px solid var(--color-accent)', paddingLeft: '16px', paddingTop: '4px', paddingBottom: '4px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px', marginBottom: '6px' }}>To,</div>
                <div style={{ fontSize: '1rem', fontWeight: 850, color: 'var(--text-primary)' }}>
                  {selectedVoucher.customerName || 'N/A'}
                </div>
                {selectedVoucher.customerAddress && (
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '2px' }}>
                    {selectedVoucher.customerAddress}
                  </div>
                )}
                {selectedVoucher.customerMobile && (
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: '2px', fontFamily: 'monospace' }}>
                    Mob: {selectedVoucher.customerMobile}
                  </div>
                )}
              </div>
            )}

            {/* Voucher Metadata */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', backgroundColor: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: '20px' }}>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Voucher Number</div>
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-accent)', marginTop: '2px' }}>{selectedVoucher.voucherNo}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Voucher Date</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>{formatDateDisplay(selectedVoucher.date)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Voucher Type</div>
                <div style={{ marginTop: '2px' }}>
                  <span className={`badge ${
                    selectedVoucher.voucherType === 'Sales' ? 'badge-sales' :
                    selectedVoucher.voucherType === 'Purchase' ? 'badge-purchase' :
                    selectedVoucher.voucherType === 'Payment' ? 'badge-payment' :
                    selectedVoucher.voucherType === 'Receipt' ? 'badge-receipt' : 'badge-journal'
                  }`} style={{ fontSize: '0.8rem', padding: '4px 8px' }}>
                    {selectedVoucher.voucherType} Entry
                  </span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Party / Account Particulars</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginTop: '2px' }}>
                  {(() => {
                    const party = ledgers.find((l) => l.id === selectedVoucher.partyLedgerId);
                    return party ? party.name : 'Journal Adjustments';
                  })()}
                  {selectedVoucher.customerName && (
                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '4px' }}>
                      Customer: {selectedVoucher.customerName}
                      {selectedVoucher.customerAddress && <span> ({selectedVoucher.customerAddress})</span>}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Items or Postings list */}
            {selectedVoucher.items && selectedVoucher.items.length > 0 ? (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>
                  Inventory Items Details
                </h4>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table className="tally-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(255,255,255,0.01)' }}>
                        <th>Stock Item</th>
                        <th className="text-right">Qty</th>
                        <th className="text-right">Rate</th>
                        <th className="text-center">GST %</th>
                        <th className="text-right">Taxable Amt</th>
                        <th className="text-right">GST Amt</th>
                        <th className="text-right">Total Amt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let subtotal = 0;
                        let gstTotal = 0;
                        
                        return (
                          <>
                            {selectedVoucher.items.map((item, idx) => {
                              const stock = stockItems.find(s => s.id === item.stockItemId);
                              const name = stock ? stock.name : 'Unknown Item';
                              const unit = stock ? stock.unit : '';
                              const qty = Number(item.qty) || 0;
                              const rate = Number(item.rate) || 0;
                              const gstRate = Number(item.gstRate) || 0;
                              
                              const lineCost = qty * rate;
                              const lineTax = lineCost * (gstRate / 100);
                              const lineTotal = lineCost + lineTax;
                              
                              subtotal += lineCost;
                              gstTotal += lineTax;

                              return (
                                <tr key={idx}>
                                  <td style={{ fontWeight: 600 }}>{name}</td>
                                  <td className="text-right" style={{ fontFamily: 'monospace' }}>{qty} {unit}</td>
                                  <td className="text-right" style={{ fontFamily: 'monospace' }}>{formatCurrency(rate)}</td>
                                  <td className="text-center" style={{ fontFamily: 'monospace' }}>{gstRate}%</td>
                                  <td className="text-right" style={{ fontFamily: 'monospace' }}>{formatCurrency(lineCost)}</td>
                                  <td className="text-right" style={{ fontFamily: 'monospace', color: 'var(--color-warning)' }}>{formatCurrency(lineTax)}</td>
                                  <td className="text-right" style={{ fontFamily: 'monospace', fontWeight: 700 }}>{formatCurrency(lineTotal)}</td>
                                </tr>
                              );
                            })}
                            
                            {/* Summary Rows */}
                            <tr style={{ borderTop: '1.5px solid var(--border-color)', fontWeight: 600 }}>
                              <td colSpan="4">SUBTOTAL (Taxable Cost)</td>
                              <td className="text-right" colSpan="3" style={{ fontFamily: 'monospace' }}>{formatCurrency(subtotal)}</td>
                            </tr>
                            <tr style={{ fontWeight: 600 }}>
                              <td colSpan="4">ESTIMATED GST VALUE</td>
                              <td className="text-right" colSpan="3" style={{ fontFamily: 'monospace', color: 'var(--color-warning)' }}>{formatCurrency(gstTotal)}</td>
                            </tr>
                            <tr style={{ borderTop: '2px double var(--border-color)', fontWeight: 800, fontSize: '0.95rem' }}>
                              <td colSpan="4" style={{ color: 'var(--color-accent)' }}>GRAND TOTAL</td>
                              <td className="text-right" colSpan="3" style={{ fontFamily: 'monospace', color: 'var(--color-accent)', fontSize: '1rem' }}>
                                {formatCurrency(subtotal + gstTotal)}
                              </td>
                            </tr>
                          </>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ marginBottom: '20px' }}>
                <h4 style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '10px', letterSpacing: '0.5px' }}>
                  Accounting Postings (Double-Entry ledger classification)
                </h4>
                <div style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                  <table className="tally-table" style={{ fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'rgba(255,255,255,0.01)' }}>
                        <th>Ledger Account</th>
                        <th>Classification</th>
                        <th className="text-right">Debit (Dr)</th>
                        <th className="text-right">Credit (Cr)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedVoucher.ledgerPostings?.map((post, idx) => {
                        const lObj = ledgers.find(l => l.id === post.ledgerId);
                        const lName = lObj ? lObj.name : 'Unknown Account';
                        const isDr = post.type === 'Dr';
                        const amount = Number(post.amount) || 0;

                        return (
                          <tr key={idx}>
                            <td style={{ fontWeight: 600 }}>{lName}</td>
                            <td>
                              <span className={`badge ${isDr ? 'badge-dr' : 'badge-cr'}`}>{post.type}</span>
                            </td>
                            <td className="text-right" style={{ fontFamily: 'monospace', fontWeight: isDr ? 700 : 400 }}>
                              {isDr ? formatCurrency(amount) : ''}
                            </td>
                            <td className="text-right" style={{ fontFamily: 'monospace', fontWeight: !isDr ? 700 : 400 }}>
                              {!isDr ? formatCurrency(amount) : ''}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Narration box */}
            {selectedVoucher.narration && (
              <div style={{ marginTop: '16px', padding: '12px 16px', borderLeft: '3px solid var(--color-accent)', backgroundColor: 'rgba(255,255,255,0.01)', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)', marginBottom: '24px' }}>
                <strong>Narration:</strong> {selectedVoucher.narration}
              </div>
            )}

            {/* Signatures for Print Area */}
            <div className="print-only" style={{ display: 'none', marginTop: '80px', justifyContent: 'space-between' }}>
              <style>{`
                @media print {
                  .print-only {
                    display: flex !important;
                  }
                }
              `}</style>
              <div style={{ borderTop: '1px solid black', width: '200px', textAlign: 'center', paddingTop: '8px', fontSize: '10px', color: 'black' }}>
                Receiver's Signature
              </div>
              <div style={{ borderTop: '1px solid black', width: '200px', textAlign: 'center', paddingTop: '8px', fontSize: '10px', color: 'black' }}>
                Authorized Signatory
              </div>
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '20px', marginTop: '20px' }} className="no-print">
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => setSelectedVoucher(null)}
              >
                Close
              </button>
              
              <button 
                type="button" 
                className="btn-secondary" 
                onClick={() => {
                  const party = ledgers.find((l) => l.id === selectedVoucher.partyLedgerId);
                  const pName = selectedVoucher.customerName || (party ? party.name : 'Client');
                  const amt = selectedVoucher.ledgerPostings[0]?.amount || 0;
                  
                  // Set default values for SMS
                  const defaultPhone = selectedVoucher.customerMobile || (party?.subgroup === 'Sundry Debtors' ? '+91 99887 76655' : '+91 98765 43210');
                  setSmsPhone(defaultPhone);
                  setSmsMessage(`Hello ${pName},\n\nThis is to notify that voucher ${selectedVoucher.voucherNo} dated ${selectedVoucher.date} for ${formatCurrency(amt)} has been recorded in our books.\n\nThank you!`);
                  setSmsSuccess(false);
                  setSmsSending(false);
                  setSmsModalOpen(true);
                }}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.3)' }}
              >
                <MessageSquare size={16} /> Send SMS
              </button>

              <button 
                type="button" 
                className="btn-success" 
                onClick={() => window.print()}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={16} /> Print Voucher
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Simulated SMS Dialog Modal */}
      {smsModalOpen && (
        <div className="modal-overlay no-print" style={{ zIndex: 3000 }}>
          <div className="glass-card modal-content" style={{ maxWidth: '450px', width: '90%', padding: '24px', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', boxShadow: '0 20px 40px rgba(0,0,0,0.5)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Send Invoice SMS Receipt
              </h3>
              <button 
                type="button" 
                style={{ background: 'transparent', color: 'var(--text-muted)' }} 
                onClick={() => setSmsModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            {smsSuccess ? (
              <div style={{ textAlign: 'center', padding: '24px 0' }}>
                <div style={{ width: '64px', height: '64px', borderRadius: '50%', backgroundColor: 'var(--color-success-bg)', border: '2px solid var(--color-success)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', margin: '0 auto 16px auto', color: 'var(--color-success)' }}>
                  <Check size={36} />
                </div>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '8px' }}>
                  SMS Sent Successfully!
                </h4>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Invoice text message delivered successfully to <strong>{smsPhone}</strong>
                </p>
                
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={() => setSmsModalOpen(false)} 
                  style={{ marginTop: '24px', width: '100%' }}
                >
                  Close Dialog
                </button>
              </div>
            ) : (
              <div>
                <div className="form-group">
                  <label>Recipient Mobile Number</label>
                  <input 
                    type="text" 
                    className="form-control" 
                    value={smsPhone} 
                    onChange={(e) => setSmsPhone(e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    disabled={smsSending}
                  />
                </div>
                
                <div className="form-group">
                  <label>Message Content</label>
                  <textarea 
                    className="form-control" 
                    rows="6" 
                    value={smsMessage} 
                    onChange={(e) => setSmsMessage(e.target.value)}
                    disabled={smsSending}
                    style={{ fontSize: '0.85rem', lineHeight: '1.4' }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                  <button 
                    type="button" 
                    className="btn-secondary" 
                    onClick={() => setSmsModalOpen(false)}
                    disabled={smsSending}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    disabled={smsSending || !smsPhone.trim() || !smsMessage.trim()}
                    onClick={() => {
                      setSmsSending(true);
                      setTimeout(() => {
                        setSmsSending(false);
                        setSmsSuccess(true);
                      }, 1500);
                    }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', minWidth: '130px' }}
                  >
                    {smsSending ? (
                      <>
                        <div className="spinner" style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={14} /> Send SMS Message
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
