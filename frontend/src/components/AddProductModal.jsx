import React, { useState, useRef, useEffect } from 'react';
import { Camera, Plus, X, Sparkles, Loader2, Barcode, Trash2 } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';

export default function AddProductModal({ initialBarcode, prefilledPhoto, onClose, onSave, apiRequestHeaders }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [primaryImageUrl, setPrimaryImageUrl] = useState('');

  // Variants list state (default to one default variant)
  const [variants, setVariants] = useState([
    {
      name: 'Default',
      sku: '',
      barcode: initialBarcode || '',
      price: '0.00',
      cost: '0.00',
      initialStock: '0',
      lowStockThreshold: '5'
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visionStatus, setVisionStatus] = useState('');
  const [scannerOpen, setScannerOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Auto-generate SKUs when parent name changes
  const handleParentNameChange = (val) => {
    setName(val);
    
    // Auto-generate SKU based on product name if variants sku is empty
    const cleanPrefix = val.replace(/\s+/g, '-').toUpperCase().slice(0, 10);
    setVariants(prev => prev.map((v, idx) => {
      if (!v.sku || v.sku.startsWith('SKU-')) {
        const variantSuffix = v.name === 'Default' ? 'DFT' : v.name.replace(/\s+/g, '-').toUpperCase();
        return {
          ...v,
          sku: `${cleanPrefix}-${variantSuffix}-${idx + 1}`
        };
      }
      return v;
    }));
  };

  const handleVariantChange = (index, field, value) => {
    setVariants(prev => prev.map((v, idx) => {
      if (idx === index) {
        const updated = { ...v, [field]: value };
        // If variant name changes and sku was auto-generated, update it
        if (field === 'name' && name) {
          const cleanPrefix = name.replace(/\s+/g, '-').toUpperCase().slice(0, 10);
          const suffix = value.replace(/\s+/g, '-').toUpperCase();
          updated.sku = `${cleanPrefix}-${suffix}-${idx + 1}`;
        }
        return updated;
      }
      return v;
    }));
  };

  const addVariantRow = () => {
    setVariants(prev => [
      ...prev,
      {
        name: '',
        sku: name ? `${name.replace(/\s+/g, '-').toUpperCase().slice(0, 10)}-VAR-${prev.length + 1}` : '',
        barcode: '',
        price: '0.00',
        cost: '0.00',
        initialStock: '0',
        lowStockThreshold: '5'
      }
    ]);
  };

  const removeVariantRow = (index) => {
    if (variants.length === 1) return; // Keep at least one
    setVariants(prev => prev.filter((_, idx) => idx !== index));
  };

  const uploadAndAnalyzePhoto = async (file) => {
    if (!file) return;

    setLoading(true);
    setVisionStatus('Uploading & analyzing image with AI...');
    setError('');

    const uploadData = new FormData();
    uploadData.append('photo', file);

    try {
      const response = await fetch('/api/products/from-photo', {
        method: 'POST',
        headers: { ...apiRequestHeaders },
        body: uploadData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to analyze product image');
      }

      const result = await response.json();
      if (result.success && result.product) {
        const prod = result.product;
        
        setName(prod.name || '');
        setCategory(prod.category || 'General');
        setDescription(prod.description || '');

        // Auto-create standard variant using AI response details
        const cleanPrefix = (prod.name || 'SKU').replace(/\s+/g, '-').toUpperCase().slice(0, 10);
        setVariants([
          {
            name: 'Default',
            sku: prod.suggestedSku || `${cleanPrefix}-DFT-1`,
            barcode: initialBarcode || '',
            price: '0.00',
            cost: '0.00',
            initialStock: '0',
            lowStockThreshold: '5'
          }
        ]);
        
        setVisionStatus(result.sandbox ? 'AI analysis complete (Sandbox Mode)' : 'AI analysis complete!');
        setTimeout(() => setVisionStatus(''), 3000);
      }
    } catch (err) {
      setError(err.message);
      setVisionStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (file) uploadAndAnalyzePhoto(file);
  };

  useEffect(() => {
    if (prefilledPhoto) {
      uploadAndAnalyzePhoto(prefilledPhoto);
    }
  }, [prefilledPhoto]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name) {
      setError('Product Name is required.');
      return;
    }

    // Verify all variants have SKU
    const missingSku = variants.some(v => !v.sku);
    if (missingSku) {
      setError('All variants must specify a unique SKU code.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiRequestHeaders
        },
        body: JSON.stringify({
          name,
          category,
          description,
          primaryImageUrl,
          variants: variants.map(v => ({
            name: v.name || 'Default',
            sku: v.sku,
            barcode: v.barcode || null,
            price: parseFloat(v.price) || 0.00,
            cost: parseFloat(v.cost) || 0.00,
            lowStockThreshold: parseInt(v.lowStockThreshold) || 5,
            initialStock: parseInt(v.initialStock) || 0
          }))
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create product');
      }

      onSave();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1005 }}>
      <div className="responsive-modal-container">
        <div className="responsive-modal-header">
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', fontWeight: 'bold' }}>
            <Plus className="text-primary" size={22} /> Add Product with Variants
          </h2>
          <button type="button" className="btn btn-secondary" onClick={onClose} style={{ padding: '8px', border: 'none', background: 'transparent' }}>
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div style={{ padding: '0 24px', marginTop: '16px' }}>
            <div className="badge badge-danger" style={{ width: '100%', padding: '12px', borderRadius: '8px', textTransform: 'none' }}>
              {error}
            </div>
          </div>
        ) : null}

        {visionStatus ? (
          <div style={{ padding: '0 24px', marginTop: '16px' }}>
            <div className="badge badge-success" style={{ width: '100%', padding: '12px', borderRadius: '8px', textTransform: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Sparkles size={16} className="animate-pulse" /> {visionStatus}
            </div>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden', margin: 0 }}>
          <div className="responsive-modal-body">
            
            {/* AI Ingest */}
            <div className="ingestion-btn-container" style={{ marginBottom: '8px' }}>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handlePhotoCapture} 
                accept="image/*"
                capture="environment"
                style={{ display: 'none' }} 
              />
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={() => setScannerOpen(true)}
                disabled={loading}
                style={{ gap: '10px', height: '48px', minHeight: '48px', background: 'linear-gradient(135deg, #6366f1, #a855f7)', border: 'none' }}
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
                Open Ingestion Camera (AI/Barcode)
              </button>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={() => fileInputRef.current.click()}
                disabled={loading}
                style={{ gap: '10px', height: '48px', minHeight: '48px' }}
              >
                Upload Photo
              </button>
            </div>

            {/* Parent Details */}
            <div className="parent-details-grid">
              <div>
                <label className="modal-field-label" htmlFor="prod-parent-name">Product Title *</label>
                <input 
                  id="prod-parent-name"
                  type="text" 
                  value={name} 
                  onChange={e => handleParentNameChange(e.target.value)} 
                  required 
                  placeholder="e.g. Classic Cotton Crewneck T-Shirt"
                />
              </div>
              <div>
                <label className="modal-field-label" htmlFor="prod-parent-cat">Category</label>
                <input 
                  id="prod-parent-cat"
                  type="text" 
                  value={category} 
                  onChange={e => setCategory(e.target.value)} 
                  placeholder="e.g. Apparel"
                />
              </div>
            </div>

            <div>
              <label className="modal-field-label" htmlFor="prod-parent-desc">Product Description</label>
              <textarea 
                id="prod-parent-desc"
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                style={{ minHeight: '80px', resize: 'vertical' }}
                placeholder="e.g. Made from 100% organic cotton, breathable fit."
              />
            </div>

            {/* Variants section */}
            <div>
              <div className="flex-between" style={{ marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                <h4 className="modal-section-title">D2C Product Variants Matrix</h4>
                <button 
                  type="button" 
                  className="btn btn-secondary add-variant-btn" 
                  onClick={addVariantRow}
                  style={{ padding: '8px 14px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} /> Add Variant Row
                </button>
              </div>

              {/* Table View (>= 768px viewports) */}
              <div className="variant-matrix-table-view" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                      <th style={{ padding: '8px', textAlign: 'left', width: '22%' }}>Variant Name (Size/Color)</th>
                      <th style={{ padding: '8px', textAlign: 'left', width: '22%' }}>SKU Code *</th>
                      <th style={{ padding: '8px', textAlign: 'left', width: '18%' }}>Barcode</th>
                      <th style={{ padding: '8px', textAlign: 'right', width: '10%' }}>Cost ($)</th>
                      <th style={{ padding: '8px', textAlign: 'right', width: '10%' }}>Price ($)</th>
                      <th style={{ padding: '8px', textAlign: 'right', width: '10%' }}>Stock</th>
                      <th style={{ padding: '8px', textAlign: 'center', width: '8%' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '6px 4px' }}>
                          <input 
                            type="text" 
                            value={v.name} 
                            onChange={e => handleVariantChange(idx, 'name', e.target.value)}
                            placeholder="e.g. M / Red"
                            required
                            style={{ padding: '8px', width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input 
                            type="text" 
                            value={v.sku} 
                            onChange={e => handleVariantChange(idx, 'sku', e.target.value)}
                            placeholder="SKU code"
                            required
                            style={{ padding: '8px', width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input 
                            type="text" 
                            value={v.barcode} 
                            onChange={e => handleVariantChange(idx, 'barcode', e.target.value)}
                            placeholder="Barcode"
                            style={{ padding: '8px', width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input 
                            type="number" 
                            step="0.01"
                            value={v.cost} 
                            onChange={e => handleVariantChange(idx, 'cost', e.target.value)}
                            style={{ padding: '8px', textAlign: 'right', width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input 
                            type="number" 
                            step="0.01"
                            value={v.price} 
                            onChange={e => handleVariantChange(idx, 'price', e.target.value)}
                            style={{ padding: '8px', textAlign: 'right', width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input 
                            type="number" 
                            value={v.initialStock} 
                            onChange={e => handleVariantChange(idx, 'initialStock', e.target.value)}
                            min="0"
                            style={{ padding: '8px', textAlign: 'right', width: '100%' }}
                          />
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <button 
                            type="button" 
                            className="btn btn-danger" 
                            onClick={() => removeVariantRow(idx)}
                            disabled={variants.length === 1}
                            style={{ padding: '8px', background: 'transparent', border: 'none' }}
                          >
                            <Trash2 size={16} style={{ color: variants.length === 1 ? 'var(--text-dark)' : 'var(--danger)' }} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Stacked Card View (Mobile < 768px viewports) */}
              <div className="variant-matrix-card-view">
                {variants.map((v, idx) => (
                  <div key={idx} className="variant-card">
                    <div className="variant-card-header">
                      <span className="variant-card-title">Variant #{idx + 1}: {v.name || 'Unnamed Variant'}</span>
                      <button 
                        type="button" 
                        className="btn btn-danger" 
                        onClick={() => removeVariantRow(idx)}
                        disabled={variants.length === 1}
                        style={{ padding: '4px', background: 'transparent', border: 'none', display: 'flex', alignItems: 'center' }}
                      >
                        <Trash2 size={16} style={{ color: variants.length === 1 ? 'var(--text-dark)' : 'var(--danger)' }} />
                      </button>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div>
                        <label className="modal-field-label">Variant Name (Size/Color) *</label>
                        <input 
                          type="text" 
                          value={v.name} 
                          onChange={e => handleVariantChange(idx, 'name', e.target.value)}
                          placeholder="e.g. M / Red"
                          required
                        />
                      </div>
                      <div>
                        <label className="modal-field-label">SKU Code *</label>
                        <input 
                          type="text" 
                          value={v.sku} 
                          onChange={e => handleVariantChange(idx, 'sku', e.target.value)}
                          placeholder="SKU code"
                          required
                        />
                      </div>
                      <div>
                        <label className="modal-field-label">Barcode</label>
                        <input 
                          type="text" 
                          value={v.barcode} 
                          onChange={e => handleVariantChange(idx, 'barcode', e.target.value)}
                          placeholder="Barcode"
                        />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        <div>
                          <label className="modal-field-label">Cost ($)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={v.cost} 
                            onChange={e => handleVariantChange(idx, 'cost', e.target.value)}
                            style={{ textAlign: 'right' }}
                          />
                        </div>
                        <div>
                          <label className="modal-field-label">Price ($)</label>
                          <input 
                            type="number" 
                            step="0.01"
                            value={v.price} 
                            onChange={e => handleVariantChange(idx, 'price', e.target.value)}
                            style={{ textAlign: 'right' }}
                          />
                        </div>
                        <div>
                          <label className="modal-field-label">Stock</label>
                          <input 
                            type="number" 
                            value={v.initialStock} 
                            onChange={e => handleVariantChange(idx, 'initialStock', e.target.value)}
                            min="0"
                            style={{ textAlign: 'right' }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          <div className="responsive-modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading} style={{ border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: '#fff' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ background: 'var(--primary)', color: '#fff', border: 'none' }}>
              {loading ? 'Saving...' : 'Save Product & Variants'}
            </button>
          </div>
        </form>
      </div>

      {scannerOpen ? (
        <BarcodeScanner 
          onScan={(barcode) => {
            setVariants(prev => prev.map((v, idx) => {
              if (idx === 0) {
                return { ...v, barcode };
              }
              return v;
            }));
            setScannerOpen(false);
          }}
          onAISnap={(file) => {
            uploadAndAnalyzePhoto(file);
            setScannerOpen(false);
          }}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}
    </div>
  );
}
