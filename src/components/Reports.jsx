import React, { useState, useContext } from 'react';
import { TallyContext } from '../context/TallyContext';
import { 
  getTrialBalance, 
  getProfitAndLoss, 
  getBalanceSheet, 
  calculateInventoryValuation 
} from '../utils/accountingEngine';
import { Trash2, Search, Calendar, FileText, Download, Printer, FileSpreadsheet } from 'lucide-react';

export default function Reports() {
  const { ledgers, transactions, stockItems, deleteTransaction, companyDetails } = useContext(TallyContext);
  const [activeTab, setActiveTab] = useState('trial'); // trial, pl, bs, stock, daybook
  
  // Search & dates for Day Book
  const [dayBookSearch, setDayBookSearch] = useState('');
  const [dayBookFilterType, setDayBookFilterType] = useState('All');

  // Report Date Period State (defaults to start of current financial year to today)
  const [fromDate, setFromDate] = useState('2026-04-01');
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

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
      const headers = ["Voucher Date", "Voucher No", "Voucher Type", "Account / Party Particulars", "Debited / Amount (INR)", "Narration"];
      const rows = filteredDayBook.map(tx => {
        const party = ledgers.find((l) => l.id === tx.partyLedgerId);
        const partyName = party ? party.name : 'Journal Adjustments';
        const amount = tx.ledgerPostings[0]?.amount || 0;
        return [tx.date, tx.voucherNo, tx.voucherType, partyName, amount, tx.narration];
      });
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
                  <th className="text-right">Debited / Amount</th>
                  <th>Narration</th>
                  <th className="text-center no-print">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDayBook.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center" style={{ color: 'var(--text-muted)', padding: '24px' }}>
                      No transaction entries found matching criteria.
                    </td>
                  </tr>
                ) : (
                  filteredDayBook.map((tx) => {
                    const badgeClass = 
                      tx.voucherType === 'Sales' ? 'badge-sales' :
                      tx.voucherType === 'Purchase' ? 'badge-purchase' :
                      tx.voucherType === 'Payment' ? 'badge-payment' :
                      tx.voucherType === 'Receipt' ? 'badge-receipt' : 'badge-journal';
                    
                    const party = ledgers.find((l) => l.id === tx.partyLedgerId);
                    const partyName = party ? party.name : 'Journal Adjustments';

                    // Get gross total from postings
                    const amount = tx.ledgerPostings[0]?.amount || 0;

                    return (
                      <tr key={tx.id}>
                        <td>{tx.date}</td>
                        <td style={{ fontWeight: 600 }}>{tx.voucherNo}</td>
                        <td>
                          <span className={`badge ${badgeClass}`}>{tx.voucherType}</span>
                        </td>
                        <td style={{ fontWeight: 600 }}>{partyName}</td>
                        <td className="text-right" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                          {formatCurrency(amount)}
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
