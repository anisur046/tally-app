import React, { useState, useContext, useEffect } from 'react';
import { TallyContext } from '../context/TallyContext';
import { LEDGER_SUBGROUPS } from '../utils/mockData';
import { calculateInventoryValuation } from '../utils/accountingEngine';
import { Plus, Trash2, Calendar, FileText, CheckCircle } from 'lucide-react';

export default function Vouchers() {
  const { 
    ledgers, 
    stockItems, 
    transactions, 
    addTransaction, 
    getNextVoucherNo 
  } = useContext(TallyContext);

  const [vType, setVType] = useState('Sales'); // Sales, Purchase, Payment, Receipt, Journal
  
  // Base voucher state
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [voucherNo, setVoucherNo] = useState('');
  const [narration, setNarration] = useState('');

  // Party/ledger states with suggest dropdowns
  const [partyInput, setPartyInput] = useState('');
  const [selectedPartyId, setSelectedPartyId] = useState('');
  const [showPartySuggest, setShowPartySuggest] = useState(false);

  // Cash/Bank select for Payments/Receipts
  const [cashBankInput, setCashBankInput] = useState('');
  const [selectedCashBankId, setSelectedCashBankId] = useState('');
  const [showCashBankSuggest, setShowCashBankSuggest] = useState(false);

  // Journal specific
  const [drLedgerInput, setDrLedgerInput] = useState('');
  const [selectedDrLedgerId, setSelectedDrLedgerId] = useState('');
  const [showDrLedgerSuggest, setShowDrLedgerSuggest] = useState(false);

  const [crLedgerInput, setCrLedgerInput] = useState('');
  const [selectedCrLedgerId, setSelectedCrLedgerId] = useState('');
  const [showCrLedgerSuggest, setShowCrLedgerSuggest] = useState(false);

  const [nonInventoryAmount, setNonInventoryAmount] = useState('');

  // Sales / Purchase Inventory list
  const [itemRows, setItemRows] = useState([
    { stockItemId: '', qty: '', rate: '', gstRate: 18 }
  ]);

  // Recalculate Voucher Number on Type Change
  useEffect(() => {
    setVoucherNo(getNextVoucherNo(vType));
    resetForm();
  }, [vType]);

  const resetForm = () => {
    setNarration('');
    setPartyInput('');
    setSelectedPartyId('');
    setCashBankInput('');
    setSelectedCashBankId('');
    setDrLedgerInput('');
    setSelectedDrLedgerId('');
    setCrLedgerInput('');
    setSelectedCrLedgerId('');
    setNonInventoryAmount('');
    setItemRows([{ stockItemId: '', qty: '', rate: '', gstRate: 18 }]);
  };

  // Filter party ledgers for autosuggest
  const filteredParties = ledgers.filter((l) => {
    const term = partyInput.toLowerCase();
    if (vType === 'Sales') {
      return (l.subgroup === LEDGER_SUBGROUPS.SUNDRY_DEBTORS || l.subgroup === LEDGER_SUBGROUPS.CASH || l.subgroup === LEDGER_SUBGROUPS.BANK) && 
        l.name.toLowerCase().includes(term);
    }
    if (vType === 'Purchase') {
      return (l.subgroup === LEDGER_SUBGROUPS.SUNDRY_CREDITORS || l.subgroup === LEDGER_SUBGROUPS.CASH || l.subgroup === LEDGER_SUBGROUPS.BANK) &&
        l.name.toLowerCase().includes(term);
    }
    // For Payment/Receipt (represents the expense ledger or vendor)
    return l.name.toLowerCase().includes(term);
  });

  const filteredCashBank = ledgers.filter((l) => {
    return (l.subgroup === LEDGER_SUBGROUPS.CASH || l.subgroup === LEDGER_SUBGROUPS.BANK) &&
      l.name.toLowerCase().includes(cashBankInput.toLowerCase());
  });

  const filteredDrLedgers = ledgers.filter((l) => l.name.toLowerCase().includes(drLedgerInput.toLowerCase()));
  const filteredCrLedgers = ledgers.filter((l) => l.name.toLowerCase().includes(crLedgerInput.toLowerCase()));

  // Inventory rows handlers
  const handleItemRowChange = (index, field, value) => {
    const updated = [...itemRows];
    updated[index][field] = value;
    
    // Auto-fill standard sales or purchase rate when stock item is selected
    if (field === 'stockItemId') {
      const selectedItem = stockItems.find(i => i.id === value);
      if (selectedItem) {
        updated[index].rate = vType === 'Sales' ? selectedItem.saleRate : selectedItem.purchaseRate;
        updated[index].gstRate = selectedItem.gstRate;
      }
    }
    setItemRows(updated);
  };

  const addItemRow = () => {
    setItemRows([...itemRows, { stockItemId: '', qty: '', rate: '', gstRate: 18 }]);
  };

  const removeItemRow = (index) => {
    if (itemRows.length === 1) return;
    setItemRows(itemRows.filter((_, i) => i !== index));
  };

  // Calculate inventory totals
  const getInventoryTotals = () => {
    let subtotal = 0;
    let taxTotal = 0;
    
    itemRows.forEach(row => {
      const qty = Number(row.qty) || 0;
      const rate = Number(row.rate) || 0;
      const gst = Number(row.gstRate) || 0;
      
      const lineCost = qty * rate;
      const lineTax = lineCost * (gst / 100);
      
      subtotal += lineCost;
      taxTotal += lineTax;
    });

    return {
      subtotal,
      taxTotal,
      grandTotal: subtotal + taxTotal
    };
  };

  const handleVoucherSubmit = (e) => {
    e.preventDefault();

    if (!date) return alert('Please specify voucher date');
    if (!voucherNo.trim()) return alert('Voucher number is required');

    // Duplicate Voucher No Check
    const voucherExists = transactions.some(
      (tx) => tx.voucherNo.trim().toLowerCase() === voucherNo.trim().toLowerCase()
    );
    if (voucherExists) {
      return alert(`Voucher with number "${voucherNo.trim()}" already exists! Please use a unique voucher number.`);
    }

    let ledgerPostings = [];
    let transactionItems = [];

    if (vType === 'Sales' || vType === 'Purchase') {
      // Validate inventory lines
      if (!selectedPartyId) return alert('Please select a valid Customer/Supplier ledger.');
      
      const invalidLine = itemRows.some(row => !row.stockItemId || !row.qty || !row.rate);
      if (invalidLine) return alert('Please fill out all inventory item lines with quantity and rate.');

      const { grandTotal } = getInventoryTotals();

      if (vType === 'Sales') {
        // Stock availability check
        const { stockSummary } = calculateInventoryValuation(stockItems, transactions);
        let insStockErr = false;

        itemRows.forEach(row => {
          const sum = stockSummary[row.stockItemId];
          const currentQty = sum ? sum.closingQty : 0;
          if (currentQty < Number(row.qty)) {
            insStockErr = true;
          }
        });

        if (insStockErr) {
          const proceed = window.confirm('Warning: Insufficient inventory stock for one or more items. Do you want to proceed with negative stock?');
          if (!proceed) return;
        }

        // Ledger postings:
        // Debit: Customer (selectedPartyId) -> Grand Total
        // Credit: Sales A/c (ledger-sales) -> Grand Total (simple bookkeeping)
        ledgerPostings = [
          { ledgerId: selectedPartyId, amount: grandTotal, type: 'Dr' },
          { ledgerId: 'ledger-sales', amount: grandTotal, type: 'Cr' }
        ];
      } else {
        // Purchase voucher:
        // Debit: Purchase A/c (ledger-purchase) -> Grand Total
        // Credit: Supplier (selectedPartyId) -> Grand Total
        ledgerPostings = [
          { ledgerId: 'ledger-purchase', amount: grandTotal, type: 'Dr' },
          { ledgerId: selectedPartyId, amount: grandTotal, type: 'Cr' }
        ];
      }

      transactionItems = itemRows.map(row => ({
        stockItemId: row.stockItemId,
        qty: Number(row.qty),
        rate: Number(row.rate),
        gstRate: Number(row.gstRate)
      }));

    } else if (vType === 'Payment') {
      // Debit: Expense or Supplier (selectedPartyId)
      // Credit: Cash/Bank (selectedCashBankId)
      const amt = Number(nonInventoryAmount);
      if (!selectedPartyId) return alert('Please select a ledger for Debit (Payment To).');
      if (!selectedCashBankId) return alert('Please select a Cash/Bank ledger for Credit.');
      if (!amt || amt <= 0) return alert('Please enter a valid payment amount.');

      ledgerPostings = [
        { ledgerId: selectedPartyId, amount: amt, type: 'Dr' },
        { ledgerId: selectedCashBankId, amount: amt, type: 'Cr' }
      ];
    } else if (vType === 'Receipt') {
      // Debit: Cash/Bank (selectedCashBankId)
      // Credit: Customer or Capital (selectedPartyId)
      const amt = Number(nonInventoryAmount);
      if (!selectedPartyId) return alert('Please select a ledger for Credit (Received From).');
      if (!selectedCashBankId) return alert('Please select a Cash/Bank ledger for Debit (Received In).');
      if (!amt || amt <= 0) return alert('Please enter a valid receipt amount.');

      ledgerPostings = [
        { ledgerId: selectedCashBankId, amount: amt, type: 'Dr' },
        { ledgerId: selectedPartyId, amount: amt, type: 'Cr' }
      ];
    } else if (vType === 'Journal') {
      // Adjustments
      // Debit: selectedDrLedgerId
      // Credit: selectedCrLedgerId
      const amt = Number(nonInventoryAmount);
      if (!selectedDrLedgerId) return alert('Please select a ledger to Debit.');
      if (!selectedCrLedgerId) return alert('Please select a ledger to Credit.');
      if (!amt || amt <= 0) return alert('Please enter a valid adjustment amount.');

      ledgerPostings = [
        { ledgerId: selectedDrLedgerId, amount: amt, type: 'Dr' },
        { ledgerId: selectedCrLedgerId, amount: amt, type: 'Cr' }
      ];
    }

    addTransaction({
      voucherNo: voucherNo.trim(),
      date,
      voucherType: vType,
      partyLedgerId: selectedPartyId || selectedDrLedgerId,
      items: transactionItems,
      ledgerPostings,
      narration: narration.trim()
    });

    // Calculate the next voucher number before state updates (offset by 2 as the transaction state hasn't updated yet)
    const currentFiltered = transactions.filter((t) => t.voucherType === vType);
    const code = vType === 'Sales' ? 'SAL' :
                 vType === 'Purchase' ? 'PUR' :
                 vType === 'Payment' ? 'PMT' :
                 vType === 'Receipt' ? 'RCT' : 'JNL';
    const nextCount = currentFiltered.length + 2;
    const nextNo = `${code}-${String(nextCount).padStart(3, '0')}`;

    alert(`Voucher ${voucherNo} posted successfully!`);
    resetForm();
    setVoucherNo(nextNo);
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <div className="view-container">
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: '4px' }}>Accounting Voucher Entry</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '24px' }}>
          Record sales invoices, purchase records, expense payments, client receipts, and adjustment entries.
        </p>
      </div>

      <div className="voucher-tabs">
        {['Sales', 'Purchase', 'Payment', 'Receipt', 'Journal'].map((type) => (
          <button 
            key={type}
            className={`vtab ${vType === type ? 'active' : ''}`}
            onClick={() => setVType(type)}
          >
            {type} Entry
          </button>
        ))}
      </div>

      <form onSubmit={handleVoucherSubmit}>
        <div className="voucher-layout">
          {/* Main Voucher form card */}
          <div className="glass-card">
            <div className="form-row">
              <div className="form-group">
                <label>Voucher Date</label>
                <div style={{ position: 'relative' }}>
                  <Calendar size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="date" 
                    className="form-control" 
                    style={{ paddingLeft: '40px' }}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Voucher No.</label>
                <div style={{ position: 'relative' }}>
                  <FileText size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input 
                    type="text" 
                    className="form-control" 
                    style={{ paddingLeft: '40px' }}
                    value={voucherNo}
                    onChange={(e) => setVoucherNo(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Render conditional fields based on Voucher Type */}
            {(vType === 'Sales' || vType === 'Purchase') && (
              <>
                <div className="form-group suggest-container">
                  <label>{vType === 'Sales' ? 'Party / Customer (Debit)' : 'Party / Supplier (Credit)'}</label>
                  <input 
                    type="text" 
                    placeholder="Type to search Ledger..." 
                    className="form-control"
                    value={partyInput}
                    onChange={(e) => {
                      setPartyInput(e.target.value);
                      setShowPartySuggest(true);
                    }}
                    onFocus={() => setShowPartySuggest(true)}
                  />
                  {showPartySuggest && partyInput.length >= 0 && (
                    <ul className="suggest-list">
                      {filteredParties.map(l => (
                        <li 
                          key={l.id} 
                          className="suggest-item"
                          onClick={() => {
                            setSelectedPartyId(l.id);
                            setPartyInput(l.name);
                            setShowPartySuggest(false);
                          }}
                        >
                          <span>{l.name}</span>
                          <span className="sub">{l.subgroup}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Inventory Item Selection Grid */}
                <div style={{ marginTop: '24px', marginBottom: '24px' }}>
                  <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '12px', color: 'var(--text-secondary)' }}>
                    Inventory Items List
                  </h4>
                  
                  <div className="item-grid-header">
                    <div>Stock Item</div>
                    <div className="text-right">Quantity</div>
                    <div className="text-right">Rate / Unit</div>
                    <div className="text-center">GST %</div>
                    <div className="text-right">Total Amount</div>
                    <div className="text-center">Action</div>
                  </div>

                  {itemRows.map((row, idx) => {
                    const selectedItem = stockItems.find(i => i.id === row.stockItemId);
                    const rowQty = Number(row.qty) || 0;
                    const rowRate = Number(row.rate) || 0;
                    const amount = rowQty * rowRate;

                    return (
                      <div key={idx} className="item-grid-row">
                        <div>
                          <select 
                            className="form-control"
                            style={{ padding: '6px' }}
                            value={row.stockItemId}
                            onChange={(e) => handleItemRowChange(idx, 'stockItemId', e.target.value)}
                          >
                            <option value="">-- Select Item --</option>
                            {stockItems.map(item => (
                              <option key={item.id} value={item.id}>{item.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <input 
                            type="number" 
                            className="form-control text-right" 
                            style={{ padding: '6px' }}
                            placeholder="0"
                            value={row.qty}
                            onChange={(e) => handleItemRowChange(idx, 'qty', e.target.value)}
                            min="0"
                          />
                        </div>
                        <div>
                          <input 
                            type="number" 
                            className="form-control text-right" 
                            style={{ padding: '6px' }}
                            placeholder="0.00"
                            value={row.rate}
                            onChange={(e) => handleItemRowChange(idx, 'rate', e.target.value)}
                            min="0"
                          />
                        </div>
                        <div className="text-center">
                          <span style={{ fontSize: '0.85rem' }}>{row.gstRate}%</span>
                        </div>
                        <div className="text-right" style={{ fontWeight: 600, fontFamily: 'monospace' }}>
                          {formatCurrency(amount)}
                        </div>
                        <div className="text-center">
                          <button 
                            type="button" 
                            style={{ color: 'var(--color-error)', backgroundColor: 'transparent' }}
                            onClick={() => removeItemRow(idx)}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })}

                  <button 
                    type="button" 
                    className="btn-secondary btn-sm" 
                    style={{ marginTop: '12px' }}
                    onClick={addItemRow}
                  >
                    <Plus size={14} /> Add Line Item
                  </button>
                </div>
              </>
            )}

            {(vType === 'Payment' || vType === 'Receipt') && (
              <>
                <div className="form-group suggest-container">
                  <label>{vType === 'Payment' ? 'Payment To (Debit - Supplier/Expense)' : 'Received From (Credit - Customer/Capital)'}</label>
                  <input 
                    type="text" 
                    placeholder="Search Ledger Account..." 
                    className="form-control"
                    value={partyInput}
                    onChange={(e) => {
                      setPartyInput(e.target.value);
                      setShowPartySuggest(true);
                    }}
                    onFocus={() => setShowPartySuggest(true)}
                  />
                  {showPartySuggest && partyInput.length >= 0 && (
                    <ul className="suggest-list">
                      {filteredParties.map(l => (
                        <li 
                          key={l.id} 
                          className="suggest-item"
                          onClick={() => {
                            setSelectedPartyId(l.id);
                            setPartyInput(l.name);
                            setShowPartySuggest(false);
                          }}
                        >
                          <span>{l.name}</span>
                          <span className="sub">{l.subgroup}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="form-row">
                  <div className="form-group suggest-container">
                    <label>{vType === 'Payment' ? 'Paid From (Credit - Cash/Bank)' : 'Received In (Debit - Cash/Bank)'}</label>
                    <input 
                      type="text" 
                      placeholder="Select Cash or Bank ledger..." 
                      className="form-control"
                      value={cashBankInput}
                      onChange={(e) => {
                        setCashBankInput(e.target.value);
                        setShowCashBankSuggest(true);
                      }}
                      onFocus={() => setShowCashBankSuggest(true)}
                    />
                    {showCashBankSuggest && (
                      <ul className="suggest-list">
                        {filteredCashBank.map(l => (
                          <li 
                            key={l.id} 
                            className="suggest-item"
                            onClick={() => {
                              setSelectedCashBankId(l.id);
                              setCashBankInput(l.name);
                              setShowCashBankSuggest(false);
                            }}
                          >
                            <span>{l.name}</span>
                            <span className="sub">{l.subgroup}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="form-group">
                    <label>Amount (INR)</label>
                    <input 
                      type="number" 
                      placeholder="0.00" 
                      className="form-control"
                      value={nonInventoryAmount}
                      onChange={(e) => setNonInventoryAmount(e.target.value)}
                      min="0"
                    />
                  </div>
                </div>
              </>
            )}

            {vType === 'Journal' && (
              <div className="form-row">
                <div className="form-group suggest-container">
                  <label>Debit Ledger (Dr)</label>
                  <input 
                    type="text" 
                    placeholder="Search Ledger Account..." 
                    className="form-control"
                    value={drLedgerInput}
                    onChange={(e) => {
                      setDrLedgerInput(e.target.value);
                      setShowDrLedgerSuggest(true);
                    }}
                    onFocus={() => setShowDrLedgerSuggest(true)}
                  />
                  {showDrLedgerSuggest && (
                    <ul className="suggest-list">
                      {filteredDrLedgers.map(l => (
                        <li 
                          key={l.id} 
                          className="suggest-item"
                          onClick={() => {
                            setSelectedDrLedgerId(l.id);
                            setDrLedgerInput(l.name);
                            setShowDrLedgerSuggest(false);
                          }}
                        >
                          <span>{l.name}</span>
                          <span className="sub">{l.subgroup}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="form-group suggest-container">
                  <label>Credit Ledger (Cr)</label>
                  <input 
                    type="text" 
                    placeholder="Search Ledger Account..." 
                    className="form-control"
                    value={crLedgerInput}
                    onChange={(e) => {
                      setCrLedgerInput(e.target.value);
                      setShowCrLedgerSuggest(true);
                    }}
                    onFocus={() => setShowCrLedgerSuggest(true)}
                  />
                  {showCrLedgerSuggest && (
                    <ul className="suggest-list">
                      {filteredCrLedgers.map(l => (
                        <li 
                          key={l.id} 
                          className="suggest-item"
                          onClick={() => {
                            setSelectedCrLedgerId(l.id);
                            setCrLedgerInput(l.name);
                            setShowCrLedgerSuggest(false);
                          }}
                        >
                          <span>{l.name}</span>
                          <span className="sub">{l.subgroup}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}

            {vType === 'Journal' && (
              <div className="form-group" style={{ maxWidth: '300px' }}>
                <label>Amount (INR)</label>
                <input 
                  type="number" 
                  placeholder="0.00" 
                  className="form-control"
                  value={nonInventoryAmount}
                  onChange={(e) => setNonInventoryAmount(e.target.value)}
                  min="0"
                />
              </div>
            )}

            <div className="form-group">
              <label>Voucher Narration / Remarks</label>
              <textarea 
                className="form-control" 
                rows="3" 
                placeholder="Write transactional notes/details here..."
                value={narration}
                onChange={(e) => setNarration(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              <button type="button" className="btn-secondary" onClick={resetForm}>
                Reset Form
              </button>
              <button type="submit" className="btn-success">
                <CheckCircle size={16} /> Save / Post Voucher
              </button>
            </div>
          </div>

          {/* Pricing Summary Side Panel */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
              Posting Invoice Summary
            </h3>
            
            {(vType === 'Sales' || vType === 'Purchase') ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Inventory Items Cost:</span>
                  <span style={{ fontWeight: 600 }}>{formatCurrency(getInventoryTotals().subtotal)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Estimated GST Value:</span>
                  <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{formatCurrency(getInventoryTotals().taxTotal)}</span>
                </div>
                <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '10px', display: 'flex', justifyContent: 'space-between', fontSize: '1.1rem', fontWeight: 800 }}>
                  <span>Grand Total:</span>
                  <span style={{ color: 'var(--color-accent)' }}>{formatCurrency(getInventoryTotals().grandTotal)}</span>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Voucher Entry Amount:</span>
                  <span style={{ fontWeight: 700, fontSize: '1.1rem' }}>{formatCurrency(Number(nonInventoryAmount) || 0)}</span>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '10px', lineHeight: '1.4' }}>
                  For payment/receipt and journal vouchers, verify the ledger assignments. Double-entry engine validates debit sum against credit sum.
                </div>
              </>
            )}

            <div style={{ backgroundColor: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: 'var(--radius-md)', fontSize: '0.75rem', marginTop: 'auto', border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px' }}>
                Double-Entry Postings:
              </div>
              {vType === 'Sales' && selectedPartyId && (
                <div style={{ fontFamily: 'monospace' }}>
                  <div>Dr. {partyInput} : {formatCurrency(getInventoryTotals().grandTotal)}</div>
                  <div>Cr. Sales Account : {formatCurrency(getInventoryTotals().grandTotal)}</div>
                </div>
              )}
              {vType === 'Purchase' && selectedPartyId && (
                <div style={{ fontFamily: 'monospace' }}>
                  <div>Dr. Purchase Account : {formatCurrency(getInventoryTotals().grandTotal)}</div>
                  <div>Cr. {partyInput} : {formatCurrency(getInventoryTotals().grandTotal)}</div>
                </div>
              )}
              {vType === 'Payment' && selectedPartyId && selectedCashBankId && (
                <div style={{ fontFamily: 'monospace' }}>
                  <div>Dr. {partyInput} : {formatCurrency(Number(nonInventoryAmount) || 0)}</div>
                  <div>Cr. {cashBankInput} : {formatCurrency(Number(nonInventoryAmount) || 0)}</div>
                </div>
              )}
              {vType === 'Receipt' && selectedPartyId && selectedCashBankId && (
                <div style={{ fontFamily: 'monospace' }}>
                  <div>Dr. {cashBankInput} : {formatCurrency(Number(nonInventoryAmount) || 0)}</div>
                  <div>Cr. {partyInput} : {formatCurrency(Number(nonInventoryAmount) || 0)}</div>
                </div>
              )}
              {vType === 'Journal' && selectedDrLedgerId && selectedCrLedgerId && (
                <div style={{ fontFamily: 'monospace' }}>
                  <div>Dr. {drLedgerInput} : {formatCurrency(Number(nonInventoryAmount) || 0)}</div>
                  <div>Cr. {crLedgerInput} : {formatCurrency(Number(nonInventoryAmount) || 0)}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
