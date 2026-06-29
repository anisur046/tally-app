import React, { useContext, useState } from 'react';
import { TallyContext } from '../context/TallyContext';
import { calculateInventoryValuation } from '../utils/accountingEngine';
import { Plus, Search, Package, X, Edit } from 'lucide-react';

export default function Inventory() {
  const { stockItems, transactions, addStockItem, updateStockItem } = useContext(TallyContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Editing State
  const [isEditing, setIsEditing] = useState(false);
  const [editingStockItemId, setEditingStockItemId] = useState(null);

  // Stock Item Form State
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('pcs');
  const [openingQty, setOpeningQty] = useState('0');
  const [openingRate, setOpeningRate] = useState('0');
  const [purchaseRate, setPurchaseRate] = useState('0');
  const [saleRate, setSaleRate] = useState('0');
  const [gstRate, setGstRate] = useState('18');

  // Compute FIFO Stock Valuations
  const { stockSummary } = calculateInventoryValuation(stockItems, transactions);

  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setEditingStockItemId(null);
    setName('');
    setUnit('pcs');
    setOpeningQty('0');
    setOpeningRate('0');
    setPurchaseRate('0');
    setSaleRate('0');
    setGstRate('18');
    setShowModal(true);
  };

  const handleOpenEditModal = (item) => {
    setIsEditing(true);
    setEditingStockItemId(item.id);
    setName(item.name);
    setUnit(item.unit);
    setOpeningQty(String(item.openingQty));
    setOpeningRate(String(item.openingRate));
    setPurchaseRate(String(item.purchaseRate));
    setSaleRate(String(item.saleRate));
    setGstRate(String(item.gstRate));
    setShowModal(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert('Item name is required!');

    // Duplicate check (excluding the current stock item being edited)
    const exists = stockItems.some(i => 
      i.name.toLowerCase() === name.trim().toLowerCase() && 
      (!isEditing || i.id !== editingStockItemId)
    );
    if (exists) return alert('A stock item with this name already exists!');

    const stockItemData = {
      name: name.trim(),
      unit,
      openingQty: Number(openingQty) || 0,
      openingRate: Number(openingRate) || 0,
      purchaseRate: Number(purchaseRate) || Number(openingRate) || 0,
      saleRate: Number(saleRate) || 0,
      gstRate: Number(gstRate) || 0
    };

    if (isEditing) {
      updateStockItem(editingStockItemId, stockItemData);
    } else {
      addStockItem(stockItemData);
    }

    // Reset Form & Close Modal
    setName('');
    setUnit('pcs');
    setOpeningQty('0');
    setOpeningRate('0');
    setPurchaseRate('0');
    setSaleRate('0');
    setGstRate('18');
    setIsEditing(false);
    setEditingStockItemId(null);
    setShowModal(false);
  };

  const filteredItems = stockItems.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
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
          <h2 style={{ fontSize: '1.5rem', fontWeight: 800 }}>Stock Items (Inventory)</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: '4px' }}>
            Monitor real-time inventory quantity, unit classification, sales rates, and FIFO valuations.
          </p>
        </div>

        <button className="btn-primary" onClick={handleOpenCreateModal}>
          <Plus size={16} /> Add Stock Item
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass-card" style={{ padding: '16px', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ position: 'relative', flexGrow: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search stock items by name..." 
            className="form-control" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>
      </div>

      {/* Inventory Table */}
      <div className="glass-card" style={{ padding: '0px', overflow: 'hidden' }}>
        <div className="table-wrapper">
          <table className="tally-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Unit</th>
                <th className="text-center">GST %</th>
                <th className="text-right">Opening Qty</th>
                <th className="text-right">Inwards (Purchases)</th>
                <th className="text-right">Outwards (Sales)</th>
                <th className="text-right">Closing Qty</th>
                <th className="text-right">Closing Value (FIFO)</th>
                <th className="text-center" style={{ width: '100px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center" style={{ color: 'var(--text-muted)', padding: '24px' }}>
                    No stock items configured. Click "Add Stock Item" to create a new record.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const summary = stockSummary[item.id] || {
                    openingQty: item.openingQty,
                    openingVal: item.openingQty * item.openingRate,
                    inwardsQty: 0,
                    inwardsVal: 0,
                    outwardsQty: 0,
                    outwardsVal: 0,
                    closingQty: item.openingQty,
                    closingVal: item.openingQty * item.openingRate
                  };

                  return (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 600 }}>{item.name}</td>
                      <td>{item.unit}</td>
                      <td className="text-center">
                        <span className="badge badge-journal">{item.gstRate}%</span>
                      </td>
                      <td className="text-right" style={{ fontFamily: 'monospace' }}>
                        {summary.openingQty} {item.unit}
                      </td>
                      <td className="text-right" style={{ color: 'var(--color-success)', fontFamily: 'monospace' }}>
                        {summary.inwardsQty > 0 ? `+${summary.inwardsQty}` : '0'}
                      </td>
                      <td className="text-right" style={{ color: 'var(--color-error)', fontFamily: 'monospace' }}>
                        {summary.outwardsQty > 0 ? `-${summary.outwardsQty}` : '0'}
                      </td>
                      <td className="text-right" style={{ fontWeight: 700, fontFamily: 'monospace', color: summary.closingQty > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {summary.closingQty} {item.unit}
                      </td>
                      <td className="text-right" style={{ fontWeight: 700, fontFamily: 'monospace' }}>
                        {formatCurrency(summary.closingVal)}
                      </td>
                      <td className="text-center">
                        <button 
                          className="btn-secondary" 
                          style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem' }}
                          onClick={() => handleOpenEditModal(item)}
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

      {/* Create / Edit Stock Item Modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1.1rem' }}>
                <Package size={18} /> {isEditing ? 'Edit Stock Item' : 'New Stock Item'}
              </h3>
              <X size={18} style={{ cursor: 'pointer', color: 'var(--text-secondary)' }} onClick={() => setShowModal(false)} />
            </div>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Stock Item Name</label>
                <input 
                  type="text" 
                  placeholder="e.g. Dell Monitor 24 inch, Wireless Mouse" 
                  className="form-control" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Unit of Measure</label>
                  <select 
                    className="form-control" 
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                  >
                    <option value="pcs">Pieces (pcs)</option>
                    <option value="kgs">Kilograms (kgs)</option>
                    <option value="ltrs">Litres (ltrs)</option>
                    <option value="box">Boxes (box)</option>
                    <option value="nos">Numbers (nos)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>GST Rate (%)</label>
                  <select 
                    className="form-control" 
                    value={gstRate}
                    onChange={(e) => setGstRate(e.target.value)}
                  >
                    <option value="0">0% (Exempt)</option>
                    <option value="5">5% GST</option>
                    <option value="12">12% GST</option>
                    <option value="18">18% GST</option>
                    <option value="28">28% GST</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Opening Quantity</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={openingQty}
                    onChange={(e) => setOpeningQty(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Opening Stock Cost (Rate / Unit)</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={openingRate}
                    onChange={(e) => setOpeningRate(e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Standard Purchase Rate</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={purchaseRate}
                    onChange={(e) => setPurchaseRate(e.target.value)}
                    min="0"
                  />
                </div>
                <div className="form-group">
                  <label>Standard Sales Rate</label>
                  <input 
                    type="number" 
                    className="form-control" 
                    value={saleRate}
                    onChange={(e) => setSaleRate(e.target.value)}
                    min="0"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  {isEditing ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
