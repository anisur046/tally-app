import React, { useState, useContext, useEffect } from 'react';
import { TallyContext } from '../context/TallyContext';
import { Building2, Save, RotateCcw } from 'lucide-react';

export default function CompanyDetails() {
  const { companyDetails, setCompanyDetails } = useContext(TallyContext);

  // Form local state
  const [formData, setFormData] = useState({
    name: '',
    address: '',
    gstin: '',
    phone: '',
    email: '',
    website: '',
    financialYear: ''
  });

  const [notification, setNotification] = useState(null);

  // Sync form state when company details in context change
  useEffect(() => {
    if (companyDetails) {
      setFormData({
        name: companyDetails.name || '',
        address: companyDetails.address || '',
        gstin: companyDetails.gstin || '',
        phone: companyDetails.phone || '',
        email: companyDetails.email || '',
        website: companyDetails.website || '',
        financialYear: companyDetails.financialYear || ''
      });
    }
  }, [companyDetails]);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Save changes to context
  const handleSave = (e) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showNotification('error', 'Company / Shop name is required.');
      return;
    }
    if (!formData.financialYear.trim()) {
      showNotification('error', 'Financial Year is required (e.g. 2026-2027).');
      return;
    }

    setCompanyDetails(formData);
    showNotification('success', 'Organization details updated successfully!');
  };

  // Reset to default templates
  const handleReset = () => {
    if (window.confirm('Are you sure you want to reset company details to the default template? This will overwrite your custom entries.')) {
      const defaultCompany = {
        name: 'Tally Accounting Solutions Ltd.',
        address: '404 Financial Tech Hub, Sector 62, Noida, India',
        gstin: '09AAACT2468A1Z5',
        phone: '+91 98765 43210',
        email: 'info@tallysolutions.com',
        website: 'www.tallysolutions.com',
        financialYear: '2026-2027'
      };
      setCompanyDetails(defaultCompany);
      showNotification('success', 'Organization details reset to default template.');
    }
  };

  // Helper to trigger notifications
  const showNotification = (type, message) => {
    setNotification({ type, message });
    setTimeout(() => {
      setNotification(null);
    }, 4000);
  };

  return (
    <div className="view-container">
      {/* Header Banner */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <div style={{
          backgroundColor: 'rgba(99, 102, 241, 0.15)',
          color: '#818cf8',
          padding: '12px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Building2 size={28} />
        </div>
        <div>
          <h2 style={{ fontSize: '1.8rem', fontWeight: 800, background: 'linear-gradient(to right, #fff, #9ca3af)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Shop / Organization Details
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '4px' }}>
            Configure corporate details that populate report headers, invoices, and summaries.
          </p>
        </div>
      </div>

      {/* Success/Error Notifications */}
      {notification && (
        <div style={{
          padding: '12px 18px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          fontSize: '0.9rem',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          backgroundColor: notification.type === 'success' ? 'var(--color-success-bg)' : 'var(--color-error-bg)',
          color: notification.type === 'success' ? 'var(--color-success)' : 'var(--color-error)',
          border: `1px solid ${notification.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
          transition: 'all 0.3s ease'
        }}>
          <span>{notification.message}</span>
        </div>
      )}

      {/* Configuration Form Card */}
      <div className="glass-card" style={{ maxWidth: '800px' }}>
        <form onSubmit={handleSave}>
          <div className="form-group">
            <label htmlFor="name">Shop / Company Name *</label>
            <input
              type="text"
              id="name"
              name="name"
              className="form-control"
              placeholder="e.g. Acme Retailers Pvt Ltd"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="address">Registered Address</label>
            <textarea
              id="address"
              name="address"
              className="form-control"
              rows="3"
              placeholder="Full shop/office address..."
              value={formData.address}
              onChange={handleChange}
              style={{ resize: 'vertical', minHeight: '80px', fontFamily: 'inherit' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="gstin">GSTIN / Tax ID</label>
              <input
                type="text"
                id="gstin"
                name="gstin"
                className="form-control"
                placeholder="e.g. 09AAACT2468A1Z5"
                value={formData.gstin}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="financialYear">Financial Year *</label>
              <input
                type="text"
                id="financialYear"
                name="financialYear"
                className="form-control"
                placeholder="e.g. 2026-2027"
                value={formData.financialYear}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">Contact Phone</label>
              <input
                type="text"
                id="phone"
                name="phone"
                className="form-control"
                placeholder="e.g. +91 98765 43210"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                type="email"
                id="email"
                name="email"
                className="form-control"
                placeholder="e.g. support@acme.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="website">Website URL</label>
            <input
              type="text"
              id="website"
              name="website"
              className="form-control"
              placeholder="e.g. www.acmeretail.com"
              value={formData.website}
              onChange={handleChange}
            />
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleReset}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
            >
              <RotateCcw size={16} /> Reset defaults
            </button>

            <button
              type="submit"
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '12px 24px' }}
            >
              <Save size={16} /> Save Shop Details
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
