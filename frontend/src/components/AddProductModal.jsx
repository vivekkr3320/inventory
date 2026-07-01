import React, { useState, useRef } from 'react';
import { Camera, Plus, X, Sparkles, Loader2, Barcode } from 'lucide-react';

export default function AddProductModal({ initialBarcode, onClose, onSave, apiRequestHeaders }) {
  const [formData, setFormData] = useState({
    name: '',
    sku: '',
    barcode: initialBarcode || '',
    category: 'General',
    price: '0.00',
    cost: '0.00',
    description: '',
    primaryImageUrl: '',
    lowStockThreshold: '5',
    initialStock: '0'
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [visionStatus, setVisionStatus] = useState('');
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
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
        headers: {
          ...apiRequestHeaders
        },
        body: uploadData
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to analyze product image');
      }

      const result = await response.json();
      if (result.success && result.product) {
        const prod = result.product;
        
        // Auto fill form fields
        setFormData(prev => ({
          ...prev,
          name: prod.name || prev.name,
          brand: prod.brand || '',
          category: prod.category || prev.category,
          description: prod.description || prev.description,
          sku: prod.suggestedSku || prev.sku || `SKU-${Date.now().toString().slice(-6)}`
        }));
        
        setVisionStatus(result.sandbox ? 'AI analysis complete (Sandbox Mode)' : 'AI analysis complete!');
        setTimeout(() => setVisionStatus(''), 3000);
      }
    } catch (err) {
      console.error(err);
      setError(err.message);
      setVisionStatus('');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.sku) {
      setError('Product Name and SKU are required.');
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
          name: formData.name,
          sku: formData.sku,
          barcode: formData.barcode || null,
          category: formData.category,
          price: parseFloat(formData.price) || 0.00,
          cost: parseFloat(formData.cost) || 0.00,
          description: formData.description,
          primaryImageUrl: formData.primaryImageUrl,
          lowStockThreshold: parseInt(formData.lowStockThreshold) || 5,
          initialStock: parseInt(formData.initialStock) || 0
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to create product');
      }

      const newProduct = await response.json();
      onSave(newProduct);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-card">
        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Plus className="text-primary" size={24} /> Add New Product
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

        {/* AI Photo Button */}
        <div style={{ marginBottom: '24px' }}>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handlePhotoCapture} 
            accept="image/*"
            capture="environment" // opens rear camera directly on mobile
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
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', marginTop: '6px' }}>
            Snapping a photo automatically extracts name, category, and attributes.
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label htmlFor="prod-name">Product Name *</label>
              <input 
                id="prod-name"
                name="name" 
                type="text" 
                value={formData.name} 
                onChange={handleChange} 
                required 
                placeholder="e.g. Energy Drink"
              />
            </div>
            <div>
              <label htmlFor="prod-sku">SKU Code *</label>
              <input 
                id="prod-sku"
                name="sku" 
                type="text" 
                value={formData.sku} 
                onChange={handleChange} 
                required 
                placeholder="e.g. ENG-DRK-CAN"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label htmlFor="prod-barcode">Barcode (EAN/UPC)</label>
              <input 
                id="prod-barcode"
                name="barcode" 
                type="text" 
                value={formData.barcode} 
                onChange={handleChange} 
                placeholder="Scan or enter barcode"
              />
            </div>
            <div>
              <label htmlFor="prod-category">Category</label>
              <input 
                id="prod-category"
                name="category" 
                type="text" 
                value={formData.category} 
                onChange={handleChange} 
                placeholder="e.g. Food, Apparel"
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label htmlFor="prod-cost">Unit Cost ($)</label>
              <input 
                id="prod-cost"
                name="cost" 
                type="number" 
                step="0.01" 
                value={formData.cost} 
                onChange={handleChange} 
              />
            </div>
            <div>
              <label htmlFor="prod-price">Retail Price ($)</label>
              <input 
                id="prod-price"
                name="price" 
                type="number" 
                step="0.01" 
                value={formData.price} 
                onChange={handleChange} 
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div>
              <label htmlFor="prod-initial-stock">Initial Stock Level</label>
              <input 
                id="prod-initial-stock"
                name="initialStock" 
                type="number" 
                value={formData.initialStock} 
                onChange={handleChange} 
                min="0"
              />
            </div>
            <div>
              <label htmlFor="prod-low-threshold">Low Stock Threshold</label>
              <input 
                id="prod-low-threshold"
                name="lowStockThreshold" 
                type="number" 
                value={formData.lowStockThreshold} 
                onChange={handleChange} 
                min="1"
              />
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label htmlFor="prod-desc">Description</label>
            <textarea 
              id="prod-desc"
              name="description" 
              value={formData.description} 
              onChange={handleChange} 
              rows="3" 
              placeholder="Enter product description"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
