import React, { useContext, useState } from 'react';
import { TallyContext } from '../context/TallyContext';
import { LEDGER_SUBGROUPS, GROUP_MAP } from '../utils/mockData';
import { getLedgerBalance } from '../utils/accountingEngine';
import { Plus, Search, BookOpen, X, Edit } from 'lucide-react';

export default function Ledgers() {
  const { ledgers, transactions, addLedger, updateLedger } = useContext(TallyContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editingLedgerId, setEditingLedgerId] = useState(null);

  // Ledger Form State
  const [name, setName] = useState('');
  const [subgroup, setSubgroup] = useState(LEDGER_SUBGROUPS.INDIRECT_EXPENSES);
  const [openingBalance, setOpeningBalance] = useState('0');
  const [balanceType, setBalanceType] = useState('Dr');

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingLedgerId(null);
    setName('');
    setSubgroup(LEDGER_SUBGROUPS.INDIRECT_EXPENSES);
    setOpeningBalance('0');
    setBalanceType('Dr');
    setShowModal(true);
  };

  const handleOpenEditModal = (ledger) => {
    setIsEditing(true);
    setEditingLedgerId(ledger.id);
    setName(ledger.name);
    setSubgroup(ledger.subgroup);
    setOpeningBalance(String(ledger.openingBalance));
    setBalanceType(ledger.balanceType);
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Ledger name is required!');

    // Duplicate check (excluding the current ledger being edited)
    const exists = ledgers.some(l => 
      l.name.toLowerCase() === name.trim().toLowerCase() && 
      (!isEditing || l.id !== editingLedgerId)
    );
    if (exists) return alert('A ledger with this name already exists!');

    const ledgerData = {
      name: name.trim(),
      subgroup,
      openingBalance: Number(openingBalance) || 0,
      balanceType
    };

    if (isEditing) {
      updateLedger(editingLedgerId, ledgerData);
    } else {
      addLedger(ledgerData);
    }

    // Reset Form & Close Modal
    setName('');
    setOpeningBalance('0');
    setBalanceType('Dr');
    setIsEditing(false);
    setEditingLedgerId(null);
    setShowModal(false);
  };

  const filteredLedgers = ledgers.filter(ledger => 
    ledger.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    ledger.subgroup.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 2
    }).format(val);
  };

  return (
    <div className="view-container">
      {/* Header section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Ledger Accounts (Chart of Accounts)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            Manage your ledger accounts, classification groups, and opening balances.
          </p>
        </div>

        <button className="btn-primary" onClick={handleOpenCreateModal}>
          <Plus size={16} /> Add Ledger Account
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search ledger by name or classification group..." 
            className="form-control" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </div>

      {/* Ledgers List Table */}
      <div className="glass-card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="tally-table">
            <thead>
              <tr>
                <th>Ledger Name</th>
                <th>Classification Subgroup</th>
                <th>Primary Group</th>
                <th className="text-right">Opening Balance</th>
                <th className="text-right">Current Ledger Balance</th>
                <th className="text-center" style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredLedgers.length === 0 ? (
                <tr>
                  <td colSpan="6" className="text-center" style={{ color: 'var(--text-muted)', padding: '24px' }}>
                    No matching ledgers found. Click "Add Ledger Account" to create a new one.
                  </td>
                </tr>
              ) : (
                filteredLedgers.map((ledger) => {
                  const currentBal = getLedgerBalance(ledger, transactions);
                  const primaryGroup = GROUP_MAP[ledger.subgroup] || 'Assets';
                  
                  return (
                    <tr key={ledger.id}>
                      <td style={{ fontWeight: 600 }}>{ledger.name}</td>
                      <td>
                        <span className="badge badge-journal">{ledger.subgroup}</span>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{primaryGroup}</td>
                      <td className="text-right" style={{ fontFamily: 'monospace' }}>
                        {ledger.openingBalance > 0 
                          ? `${formatCurrency(ledger.openingBalance)} (${ledger.balanceType})`
                          : '0.00'
                        }
                      </td>
                      <td className="text-right" style={{ fontWeight: 700, fontFamily: 'monospace', color: currentBal.type === 'Dr' ? '#60a5fa' : '#c084fc' }}>
                        {currentBal.amount > 0 
                          ? `${formatCurrency(currentBal.amount)} (${currentBal.type})`
                          : '0.00'
                        }
                      </td>
                      <td className="text-center">
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                          onClick={() => handleOpenEditModal(ledger)}
                        >
                          <Edit size={12} /> Edit
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

      {/* Create / Edit Ledger Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                <BookOpen size={18} /> {isEditing ? 'Edit Ledger Account' : 'New Ledger Account'}
              </h3>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowModal(false)} />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Ledger Account Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Acme Corporation, Salary Expense" 
                  className="form-control" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Account Subgroup (Classification)</label>
                <select 
                  className="form-control" 
                  value={subgroup}
                  onChange={(e) => setSubgroup(e.target.value)}
                >
                  {Object.values(LEDGER_SUBGROUPS).map((grp) => (
                    <option key={grp} value={grp}>{grp}</option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Opening Balance</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Balance Type</label>
                  <select 
                    className="form-control" 
                    value={balanceType}
                    onChange={(e) => setBalanceType(e.target.value)}
                  >
                    <option value="Dr">Debit (Dr) - Assets/Expenses</option>
                    <option value="Cr">Credit (Cr) - Liabilities/Capital/Sales</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {isEditing ? 'Update Ledger' : 'Create Ledger'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
