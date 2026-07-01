import React, { useState, useRef } from 'react';
import { Camera, Plus, X, Sparkles, Loader2, Barcode, Trash2 } from 'lucide-react';

export default function AddProductModal({ initialBarcode, onClose, onSave, apiRequestHeaders }) {
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

  const handlePhotoCapture = async (e) => {
    const file = e.target.files[0];
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
    <div className="modal-backdrop">
      <div className="modal-content glass-card" style={{ maxWidth: '850px' }}>
        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus className="text-primary" size={24} /> Add Product with Variants
          </h2>
          <button className="btn btn-secondary" onClick={onClose} style={{ padding: '8px' }}>
            <X size={18} />
          </button>
        </div>

        {error ? (
          <div className="badge badge-danger" style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '16px', textTransform: 'none' }}>
            {error}
          </div>
        ) : null}

        {visionStatus ? (
          <div className="badge badge-success" style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '16px', textTransform: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} className="animate-pulse" /> {visionStatus}
          </div>
        ) : null}

        {/* AI Ingest */}
        <div style={{ marginBottom: '24px' }}>
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
            onClick={() => fileInputRef.current.click()}
            disabled={loading}
            style={{ width: '100%', gap: '10px', height: '50px', background: 'linear-gradient(135deg, #6366f1, #a855f7)' }}
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
            Scan Product Packaging / Take Photo (AI Ingest)
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Parent Details */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label htmlFor="prod-parent-name">Product Title *</label>
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
              <label htmlFor="prod-parent-cat">Category</label>
              <input 
                id="prod-parent-cat"
                type="text" 
                value={category} 
                onChange={e => setCategory(e.target.value)} 
                placeholder="e.g. Apparel"
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="prod-parent-desc">Product Description</label>
            <textarea 
              id="prod-parent-desc"
              value={description} 
              onChange={e => setDescription(e.target.value)} 
              rows="2" 
              placeholder="e.g. Made from 100% organic cotton, breathable fit."
            />
          </div>

          {/* Variants section */}
          <div style={{ marginBottom: '20px' }}>
            <div className="flex-between" style={{ marginBottom: '12px' }}>
              <h4 style={{ margin: 0 }}>D2C Product Variants Matrix</h4>
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={addVariantRow}
                style={{ padding: '8px 12px', fontSize: '13px' }}
              >
                <Plus size={14} /> Add Variant Row
              </button>
            </div>

            <div style={{ overflowX: 'auto' }}>
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
                      <td style={{ padding: '8px 4px' }}>
                        <input 
                          type="text" 
                          value={v.name} 
                          onChange={e => handleVariantChange(idx, 'name', e.target.value)}
                          placeholder="e.g. M / Red"
                          required
                          style={{ padding: '8px' }}
                        />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input 
                          type="text" 
                          value={v.sku} 
                          onChange={e => handleVariantChange(idx, 'sku', e.target.value)}
                          placeholder="SKU code"
                          required
                          style={{ padding: '8px' }}
                        />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input 
                          type="text" 
                          value={v.barcode} 
                          onChange={e => handleVariantChange(idx, 'barcode', e.target.value)}
                          placeholder="Barcode"
                          style={{ padding: '8px' }}
                        />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input 
                          type="number" 
                          step="0.01"
                          value={v.cost} 
                          onChange={e => handleVariantChange(idx, 'cost', e.target.value)}
                          style={{ padding: '8px', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input 
                          type="number" 
                          step="0.01"
                          value={v.price} 
                          onChange={e => handleVariantChange(idx, 'price', e.target.value)}
                          style={{ padding: '8px', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '8px 4px' }}>
                        <input 
                          type="number" 
                          value={v.initialStock} 
                          onChange={e => handleVariantChange(idx, 'initialStock', e.target.value)}
                          min="0"
                          style={{ padding: '8px', textAlign: 'right' }}
                        />
                      </td>
                      <td style={{ padding: '8px 4px', textAlign: 'center' }}>
                        <button 
                          type="button" 
                          className="btn btn-danger" 
                          onClick={() => removeVariantRow(idx)}
                          disabled={variants.length === 1}
                          style={{ padding: '8px', background: 'transparent' }}
                        >
                          <Trash2 size={15} style={{ color: variants.length === 1 ? 'var(--text-dark)' : 'var(--danger)' }} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Product & Variants'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
