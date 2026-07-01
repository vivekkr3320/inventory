import React, { useState, useEffect } from 'react';
import { 
  Package, Search, Plus, Camera, Settings, LogOut, 
  Sparkles, ShieldAlert, ArrowUpDown, History, Key, CheckCircle, RefreshCw, 
  ShoppingBag, LayoutDashboard, Minus, Trash2, ShieldX
} from 'lucide-react';
import BarcodeScanner from './components/BarcodeScanner';
import AddProductModal from './components/AddProductModal';

export default function App() {
  // Navigation & auth state
  const [token, setToken] = useState('bypass'); // Bypassed auth session
  const [activeTab, setActiveTab] = useState('dashboard');
  
  // App core data state
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({ 
    skuCount: 0, 
    totalStockCount: 0, 
    totalValuation: 0, 
    lowStockCount: 0, 
    outOfStockCount: 0, 
    recentMovements: [] 
  });
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [loading, setLoading] = useState(false);

  // Settings BYOK state
  const [showSettings, setShowSettings] = useState(false);
  const [visionProvider, setVisionProvider] = useState('gemini');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKeySaved, setHasApiKeySaved] = useState(false);
  const [shopifyShopUrl, setShopifyShopUrl] = useState('');
  const [shopifyAccessToken, setShopifyAccessToken] = useState('');
  const [hasShopifyTokenSaved, setHasShopifyTokenSaved] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // Shopify Sync status
  const [syncingShopify, setSyncingShopify] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // POS Billing Cart state
  const [cart, setCart] = useState([]);
  const [posSearch, setPosSearch] = useState('');
  const [posScannerOpen, setPosScannerOpen] = useState(false);
  const [checkoutStatus, setCheckoutStatus] = useState('');

  // Modals state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [prefilledBarcode, setPrefilledBarcode] = useState('');
  const [prefilledPhoto, setPrefilledPhoto] = useState(null);
  
  // Direct stock adjustments state
  const [adjustmentProduct, setAdjustmentProduct] = useState(null);
  const [adjustmentVariant, setAdjustmentVariant] = useState(null);
  const [stockDelta, setStockDelta] = useState('1');
  const [stockReason, setStockReason] = useState('received');
  const [stockNote, setStockNote] = useState('');

  // Confirm Reset Data
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetting, setResetting] = useState(false);

  const apiHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  // Fetch dashboard summary & products list
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const sumRes = await fetch('/api/dashboard/summary', { headers: apiHeaders });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }

      let prodUrl = `/api/products?search=${search}`;
      if (filterLowStock) prodUrl += '&lowStock=true';
      const prodRes = await fetch(prodUrl, { headers: apiHeaders });
      if (prodRes.ok) {
        const prodData = await prodRes.json();
        setProducts(prodData);
      }
    } catch (e) {
      console.error('Fetch dashboard error:', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch('/api/settings', { headers: apiHeaders });
      if (res.ok) {
        const data = await res.json();
        setVisionProvider(data.visionProvider);
        setHasApiKeySaved(data.hasApiKey);
        setShopifyShopUrl(data.shopifyShopUrl);
        setHasShopifyTokenSaved(data.hasShopifyToken);
      }
    } catch (e) {
      console.error('Fetch settings error:', e);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    fetchSettings();
  }, [search, filterLowStock]);

  // Seeding default Demo Data
  const handleResetDemoData = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/db/reset-demo', {
        method: 'POST',
        headers: apiHeaders
      });
      if (res.ok) {
        setShowResetConfirm(false);
        fetchDashboardData();
      } else {
        alert('Failed to reset data.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setResetting(false);
    }
  };

  // Settings handlers
  const saveSettings = async (e) => {
    e.preventDefault();
    setSettingsSuccess('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({
          visionProvider,
          apiKey: apiKeyInput || null,
          shopifyShopUrl,
          shopifyAccessToken: shopifyAccessToken || null
        })
      });
      if (res.ok) {
        setSettingsSuccess('Credentials saved successfully!');
        setApiKeyInput('');
        setShopifyAccessToken('');
        fetchSettings();
        setTimeout(() => setSettingsSuccess(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const clearVisionApiKey = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({ clearKey: true })
      });
      if (res.ok) {
        setHasApiKeySaved(false);
        setSettingsSuccess('Vision API Key deleted. Reverted to Sandbox Mode.');
        setTimeout(() => setSettingsSuccess(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const clearShopifyCredentials = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({ clearShopify: true })
      });
      if (res.ok) {
        setShopifyShopUrl('');
        setHasShopifyTokenSaved(false);
        setSettingsSuccess('Shopify credentials cleared.');
        setTimeout(() => setSettingsSuccess(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Shopify Sync API Trigger
  const triggerShopifySync = async () => {
    setSyncingShopify(true);
    setSyncMessage('Synchronizing inventory with Shopify...');
    try {
      const res = await fetch('/api/integrations/shopify/sync', {
        method: 'POST',
        headers: apiHeaders
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Shopify sync failed');
      
      const sourceStr = data.sandbox ? '(Sandbox Mock Mode)' : '(Live API)';
      setSyncMessage(`Sync Complete ${sourceStr}: Created ${data.createdCount} products, updated ${data.updatedCount} products.`);
      fetchDashboardData();
      setTimeout(() => setSyncMessage(''), 5000);
    } catch (err) {
      setSyncMessage(`Sync Error: ${err.message}`);
    } finally {
      setSyncingShopify(false);
    }
  };

  // Dashboard Barcode Scanner
  const handleBarcodeScanned = async (barcode) => {
    setScannerOpen(false);
    try {
      const res = await fetch(`/api/products/lookup/${barcode}`, { headers: apiHeaders });
      if (!res.ok) throw new Error('Lookup failed');
      const data = await res.json();
      
      if (data.found && data.product) {
        const matched = data.product;
        const parentRes = await fetch(`/api/products/${matched.id}`, { headers: apiHeaders });
        if (parentRes.ok) {
          const parent = await parentRes.json();
          const targetVariant = parent.variants.find(v => v.id === matched.variantId);
          setAdjustmentProduct(parent);
          setAdjustmentVariant(targetVariant);
          setStockDelta('1');
          setStockReason('received');
        }
      } else {
        setPrefilledBarcode(barcode);
        setAddProductOpen(true);
      }
    } catch (e) {
      setPrefilledBarcode(barcode);
      setAddProductOpen(true);
    }
  };

  const handleAISnap = (file) => {
    setScannerOpen(false);
    setPrefilledPhoto(file);
    setAddProductOpen(true);
  };

  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    if (!adjustmentVariant) return;

    try {
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({
          variantId: adjustmentVariant.id,
          quantityDelta: parseInt(stockDelta),
          reason: stockReason,
          referenceNote: stockNote
        })
      });

      if (res.ok) {
        setAdjustmentProduct(null);
        setAdjustmentVariant(null);
        setStockNote('');
        fetchDashboardData();
      } else {
        const err = await res.json();
        alert(err.error || 'Adjustment failed');
      }
    } catch (err) {
      console.error(err);
    }
  };

  // ----------------------------------------------------
  // POS Checkout Cart Handlers
  // ----------------------------------------------------
  const addToCart = (variant, productName) => {
    setCart(prev => {
      const existing = prev.find(item => item.variantId === variant.id);
      if (existing) {
        return prev.map(item => 
          item.variantId === variant.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, {
        variantId: variant.id,
        name: `${productName} - ${variant.name}`,
        sku: variant.sku,
        price: Number(variant.price),
        quantity: 1,
        maxStock: variant.total_quantity
      }];
    });
  };

  const updateCartQuantity = (variantId, delta) => {
    setCart(prev => prev.map(item => {
      if (item.variantId === variantId) {
        const newQty = item.quantity + delta;
        return newQty > 0 ? { ...item, quantity: newQty } : item;
      }
      return item;
    }));
  };

  const removeFromCart = (variantId) => {
    setCart(prev => prev.filter(item => item.variantId !== variantId));
  };

  const handlePOSBarcodeScan = async (barcode) => {
    setPosScannerOpen(false);
    try {
      const res = await fetch(`/api/products/lookup/${barcode}`, { headers: apiHeaders });
      if (!res.ok) throw new Error('Lookup failed');
      const data = await res.json();
      
      if (data.found && data.product) {
        const matched = data.product;
        // Fetch details to retrieve current inventory count
        const parentRes = await fetch(`/api/products/${matched.id}`, { headers: apiHeaders });
        if (parentRes.ok) {
          const parent = await parentRes.json();
          const targetVariant = parent.variants.find(v => v.id === matched.variantId);
          addToCart(targetVariant, parent.name);
        }
      } else {
        alert(`Barcode ${barcode} not found in product catalog.`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const executePOSCheckout = async () => {
    if (cart.length === 0) return;
    setCheckoutStatus('Processing transaction checkout...');
    
    try {
      const res = await fetch('/api/stock/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({
          items: cart.map(item => ({
            variantId: item.variantId,
            quantity: item.quantity
          }))
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'POS checkout failed');

      setCheckoutStatus(`Checkout Successful! Bill POS Sale #${data.billId}`);
      setCart([]);
      fetchDashboardData();
      setTimeout(() => setCheckoutStatus(''), 4000);
    } catch (err) {
      setCheckoutStatus(`Checkout Error: ${err.message}`);
    }
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // ----------------------------------------------------
  // RENDER TABS CONTENT
  // ----------------------------------------------------

  // 1. Dashboard View
  const renderDashboard = () => (
    <div>
      <section className="grid-4" style={{ marginBottom: '32px' }}>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>TOTAL SKUS</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', margin: '4px 0' }}>{summary.skuCount}</div>
          <div style={{ fontSize: '11px', color: 'var(--text-dark)' }}>Unique items registered</div>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--success)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>INVENTORY VALUE</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', margin: '4px 0' }}>
            ₹{summary.totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 1 })}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dark)' }}>Total assets at cost</div>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>LOW STOCK ALERTS</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: summary.lowStockCount > 0 ? 'var(--warning)' : 'var(--text-main)', margin: '4px 0' }}>
            {summary.lowStockCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dark)' }}>Require reordering</div>
        </div>
        <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>OUT OF STOCK</div>
          <div style={{ fontSize: '28px', fontWeight: 'bold', color: summary.outOfStockCount > 0 ? 'var(--danger)' : 'var(--text-main)', margin: '4px 0' }}>
            {summary.outOfStockCount}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-dark)' }}>Zero quantity on hand</div>
        </div>
      </section>

      {/* Recent transactions block */}
      <section className="glass-card">
        <div className="flex-between" style={{ marginBottom: '20px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History className="text-primary" size={20} /> Recent Transactions
          </h3>
          <button className="btn btn-secondary" onClick={() => setActiveTab('ledger')} style={{ padding: '8px 12px', fontSize: '12px' }}>
            View All Logs
          </button>
        </div>

        {summary.recentMovements.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
            No transaction records found. Populate data using "Reset Demo Data".
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '12px 8px' }}>DATE</th>
                  <th style={{ padding: '12px 8px' }}>PRODUCT</th>
                  <th style={{ padding: '12px 8px' }}>TYPE</th>
                  <th style={{ padding: '12px 8px', textAlign: 'right' }}>QUANTITY</th>
                  <th style={{ padding: '12px 8px' }}>NOTE</th>
                </tr>
              </thead>
              <tbody>
                {summary.recentMovements.slice(0, 6).map(m => {
                  const isIssue = m.quantity_delta < 0;
                  return (
                    <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                        {new Date(m.created_at).toISOString().split('T')[0]}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <div style={{ fontWeight: 600 }}>{m.product_name}</div>
                        <span style={{ fontSize: '11px', color: 'var(--text-dark)' }}>{m.product_sku}</span>
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span className={`badge ${isIssue ? 'badge-danger' : 'badge-success'}`}>
                          {isIssue ? 'ISSUE' : 'RECEIPT'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold', color: isIssue ? 'var(--danger)' : 'var(--success)' }}>
                        {m.quantity_delta}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                        {m.reference_note || m.reason}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );

  // 2. Catalog View
  const renderCatalog = () => (
    <section className="glass-card">
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <h3 style={{ margin: 0 }}>Products Catalog</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className={`btn ${filterLowStock ? 'btn-danger' : 'btn-secondary'}`}
            onClick={() => setFilterLowStock(!filterLowStock)}
            style={{ padding: '10px 14px' }}
          >
            Low Stock Only
          </button>
          <button className="btn btn-secondary" onClick={() => { setPrefilledBarcode(''); setScannerOpen(true); }} style={{ gap: '8px' }}>
            <Camera size={16} /> Scan Barcode
          </button>
          <button className="btn btn-primary" onClick={() => { setPrefilledBarcode(''); setAddProductOpen(true); }} style={{ gap: '8px' }}>
            <Plus size={16} /> Add Product
          </button>
        </div>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }} size={16} />
        <input 
          type="text" 
          placeholder="Search by title, SKU, or barcode..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: '40px' }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <RefreshCw size={24} className="animate-spin text-primary" style={{ margin: '0 auto 12px' }} />
          Loading catalog...
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 20px' }}>
          No items found. Click **Add Product** or sync with Shopify.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {products.map(p => (
            <div key={p.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'rgba(255,255,255,0.01)' }}>
              <div className="flex-between" style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '16px' }}>{p.name}</h4>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Category: {p.category}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Stock</div>
                  <div style={{ fontWeight: 'bold', fontSize: '18px' }}>{p.total_quantity}</div>
                </div>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: 'var(--text-muted)', textAlign: 'left', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <th style={{ padding: '6px' }}>Variant</th>
                    <th style={{ padding: '6px' }}>SKU/Barcode</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '6px', textAlign: 'right' }}>Stock</th>
                    <th style={{ padding: '6px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {p.variants.map(v => {
                    const isOut = v.total_quantity === 0;
                    const isLow = v.total_quantity <= v.low_stock_threshold;
                    return (
                      <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '8px 6px', fontWeight: 500 }}>{v.name}</td>
                        <td style={{ padding: '8px 6px', color: 'var(--text-muted)' }}>
                          <div>SKU: {v.sku}</div>
                          {v.barcode ? <div style={{ fontSize: '10px', color: 'var(--primary)' }}>BC: {v.barcode}</div> : null}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>₹{v.price.toFixed(2)}</td>
                        <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                          <span style={{ fontWeight: 'bold', marginRight: '6px' }}>{v.total_quantity}</span>
                          <span className={`badge ${isOut ? 'badge-danger' : isLow ? 'badge-warning' : 'badge-success'}`} style={{ fontSize: '8px', padding: '1px 4px' }}>
                            {isOut ? 'Out of Stock' : isLow ? 'Low' : 'OK'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '4px 8px', fontSize: '11px' }}
                            onClick={() => {
                              setAdjustmentProduct(p);
                              setAdjustmentVariant(v);
                              setStockDelta('1');
                              setStockReason('received');
                            }}
                          >
                            Adjust
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </section>
  );

  // 3. POS Billing checkout View
  const renderPOS = () => {
    // Find all variants available to manually select
    const allVariants = [];
    products.forEach(p => {
      p.variants.forEach(v => {
        allVariants.push({ ...v, productName: p.name });
      });
    });

    const filteredVariants = allVariants.filter(v => 
      v.productName.toLowerCase().includes(posSearch.toLowerCase()) || 
      v.sku.toLowerCase().includes(posSearch.toLowerCase()) ||
      (v.barcode && v.barcode.includes(posSearch))
    );

    return (
      <div className="pos-container">
        {/* Left: Product Selection grid */}
        <div className="glass-card" style={{ minHeight: '400px' }}>
          <div className="flex-between" style={{ marginBottom: '20px' }}>
            <h3 style={{ margin: 0 }}>Item Checkout Grid</h3>
            <button className="btn btn-primary" onClick={() => setPosScannerOpen(true)} style={{ gap: '6px' }}>
              <Camera size={16} /> Scan Barcode Cart
            </button>
          </div>

          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              placeholder="Search items by name, SKU..."
              value={posSearch}
              onChange={e => setPosSearch(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '16px' }}>
            {filteredVariants.slice(0, 12).map(v => {
              const isOut = v.total_quantity === 0;
              return (
                <button 
                  key={v.id} 
                  className="glass-card btn" 
                  disabled={isOut}
                  onClick={() => addToCart(v, v.productName)}
                  style={{ 
                    flexDirection: 'column', 
                    alignItems: 'flex-start', 
                    padding: '16px', 
                    textAlign: 'left',
                    gap: '4px',
                    width: '100%',
                    height: 'auto',
                    cursor: isOut ? 'not-allowed' : 'pointer',
                    opacity: isOut ? 0.5 : 1
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>
                    {v.productName}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{v.name !== 'Default' ? v.name : v.sku}</div>
                  <div className="flex-between" style={{ width: '100%', marginTop: '10px' }}>
                    <span style={{ fontWeight: 'bold', color: 'var(--primary)' }}>₹{v.price}</span>
                    <span style={{ fontSize: '10px', color: 'var(--text-dark)' }}>Qty: {v.total_quantity}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right: Checkout summary cart */}
        <div className="glass-card" style={{ position: 'sticky', top: '24px' }}>
          <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShoppingBag size={20} className="text-primary" /> Active Bill
          </h3>

          {checkoutStatus ? (
            <div className="badge badge-success" style={{ width: '100%', padding: '10px', borderRadius: '8px', marginBottom: '16px', textTransform: 'none' }}>
              {checkoutStatus}
            </div>
          ) : null}

          {cart.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 10px', color: 'var(--text-muted)', fontSize: '13px' }}>
              Cart is empty. Tap items or scan barcodes to add them.
            </div>
          ) : (
            <div>
              <div style={{ maxHeight: '280px', overflowY: 'auto', marginBottom: '20px' }}>
                {cart.map(item => (
                  <div key={item.variantId} className="pos-cart-item">
                    <div style={{ width: '60%' }}>
                      <div style={{ fontWeight: 600, fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.name}
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>₹{item.price} x {item.quantity}</span>
                    </div>
                    
                    {/* Controls */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <button className="btn btn-secondary" onClick={() => updateCartQuantity(item.variantId, -1)} style={{ padding: '4px 8px' }}>
                        <Minus size={12} />
                      </button>
                      <span style={{ fontSize: '13px', fontWeight: 'bold', minWidth: '18px', textAlign: 'center' }}>
                        {item.quantity}
                      </span>
                      <button className="btn btn-secondary" onClick={() => updateCartQuantity(item.variantId, 1)} style={{ padding: '4px 8px' }}>
                        <Plus size={12} />
                      </button>
                      <button className="btn" onClick={() => removeFromCart(item.variantId)} style={{ padding: '4px', background: 'transparent', border: 'none' }}>
                        <Trash2 size={14} className="text-danger" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Subtotal */}
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginBottom: '20px' }}>
                <div className="flex-between" style={{ fontSize: '14px', marginBottom: '6px' }}>
                  <span>Total Items</span>
                  <span style={{ fontWeight: 'bold' }}>{cart.reduce((sum, item) => sum + item.quantity, 0)}</span>
                </div>
                <div className="flex-between" style={{ fontSize: '18px', fontWeight: 'bold' }}>
                  <span>Grand Total</span>
                  <span className="text-primary">₹{cartTotal.toFixed(2)}</span>
                </div>
              </div>

              <button className="btn btn-primary" onClick={executePOSCheckout} style={{ width: '100%', height: '48px' }}>
                Complete Checkout
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 4. Detailed Ledger logs View
  const renderLedger = () => (
    <section className="glass-card">
      <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <History className="text-primary" size={20} /> Stock ledger audit trail
      </h3>
      {summary.recentMovements.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No logs found.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 8px' }}>DATE</th>
                <th style={{ padding: '12px 8px' }}>PRODUCT</th>
                <th style={{ padding: '12px 8px' }}>VARIANT</th>
                <th style={{ padding: '12px 8px' }}>TYPE</th>
                <th style={{ padding: '12px 8px', textAlign: 'right' }}>QUANTITY</th>
                <th style={{ padding: '12px 8px' }}>REFERENCE NOTE</th>
              </tr>
            </thead>
            <tbody>
              {summary.recentMovements.map(m => {
                const isIssue = m.quantity_delta < 0;
                return (
                  <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                    <td style={{ padding: '14px 8px', color: 'var(--text-muted)' }}>
                      {new Date(m.created_at).toLocaleString()}
                    </td>
                    <td style={{ padding: '14px 8px', fontWeight: 600 }}>{m.product_name}</td>
                    <td style={{ padding: '14px 8px', color: 'var(--text-muted)' }}>{m.variant_name} (SKU: {m.product_sku})</td>
                    <td style={{ padding: '14px 8px' }}>
                      <span className={`badge ${isIssue ? 'badge-danger' : 'badge-success'}`}>
                        {isIssue ? 'ISSUE' : 'RECEIPT'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 8px', textAlign: 'right', fontWeight: 'bold', color: isIssue ? 'var(--danger)' : 'var(--success)' }}>
                      {m.quantity_delta}
                    </td>
                    <td style={{ padding: '14px 8px', color: 'var(--text-muted)' }}>
                      {m.reference_note || m.reason}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  // 5. Settings view
  const renderSettings = () => (
    <div className="glass-card" style={{ border: '1px solid rgba(99, 102, 241, 0.2)' }}>
      <div className="flex-between" style={{ marginBottom: '16px' }}>
        <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Settings className="text-primary" size={18} /> Integrations & Credentials
        </h4>
        <span className={`badge ${hasApiKeySaved ? 'badge-success' : 'badge-warning'}`}>
          {hasApiKeySaved ? 'Credentials saved' : 'Sandbox Mode'}
        </span>
      </div>

      {settingsSuccess ? (
        <div className="badge badge-success" style={{ width: '100%', padding: '10px', borderRadius: '8px', marginBottom: '16px', textTransform: 'none' }}>
          {settingsSuccess}
        </div>
      ) : null}

      <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Vision BYOK */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px' }}>
          <h5 style={{ margin: '0 0 12px 0' }}>Vision AI Credentials</h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label htmlFor="set-prov">Provider</label>
              <select id="set-prov" value={visionProvider} onChange={e => setVisionProvider(e.target.value)}>
                <option value="gemini">Google Gemini API (gemini-2.5-flash)</option>
                <option value="openai">OpenAI API (gpt-4o-mini)</option>
              </select>
            </div>
            <div>
              <label htmlFor="set-key">API Key</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  id="set-key"
                  type="password" 
                  value={apiKeyInput} 
                  onChange={e => setApiKeyInput(e.target.value)} 
                  placeholder={hasApiKeySaved ? '••••••••••••••••' : 'AI_API_KEY_...'}
                />
                {hasApiKeySaved ? (
                  <button type="button" className="btn btn-danger" onClick={clearVisionApiKey}>Delete</button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Shopify BYOK */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px' }}>
          <h5 style={{ margin: '0 0 12px 0' }}>Shopify Store Integration</h5>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label htmlFor="set-shop">Shop URL</label>
              <input 
                id="set-shop"
                type="text" 
                value={shopifyShopUrl} 
                onChange={e => setShopifyShopUrl(e.target.value)} 
                placeholder="e.g. mystore.myshopify.com"
              />
            </div>
            <div>
              <label htmlFor="set-token">Admin Access Token</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input 
                  id="set-token"
                  type="password" 
                  value={shopifyAccessToken} 
                  onChange={e => setShopifyAccessToken(e.target.value)} 
                  placeholder={hasShopifyTokenSaved ? '••••••••••••••••' : 'shpat_...'}
                />
                {hasShopifyTokenSaved ? (
                  <button type="button" className="btn btn-danger" onClick={clearShopifyCredentials}>Clear</button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
            Save Configurations
          </button>
        </div>
      </form>
    </div>
  );

  return (
    <div className="app-layout">
      {/* Sidebar Navigation Menu */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-logo">
            <Package className="text-primary" size={28} />
            <span className="sidebar-logo-text" style={{ fontSize: '18px', fontWeight: 'bold' }}>Stockwise HQ</span>
          </div>
          <div className="sidebar-menu">
            <button className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => setActiveTab('dashboard')}>
              <LayoutDashboard size={18} /> 
              <span className="sidebar-text">Dashboard</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => setActiveTab('catalog')}>
              <Package size={18} /> 
              <span className="sidebar-text">Products Catalog</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => setActiveTab('pos')}>
              <ShoppingBag size={18} /> 
              <span className="sidebar-text">POS Billing</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => setActiveTab('ledger')}>
              <History size={18} /> 
              <span className="sidebar-text">Ledger Logs</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
              <Settings size={18} /> 
              <span className="sidebar-text">Settings</span>
            </button>
          </div>
        </div>

        {/* Reset demo data */}
        <button 
          className="sidebar-item" 
          onClick={() => setShowResetConfirm(true)}
          style={{ color: 'var(--text-dark)', marginTop: 'auto', gap: '12px' }}
        >
          <RefreshCw size={18} /> 
          <span className="sidebar-text">Reset Demo Data</span>
        </button>
      </aside>

      {/* Main Panel Content Area */}
      <main className="main-content">
        <header className="flex-between" style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: 0, textTransform: 'capitalize', fontFamily: 'Outfit' }}>
            {activeTab === 'pos' ? 'POS Billing Checkout' : activeTab === 'catalog' ? 'Products Catalog' : `${activeTab} view`}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>admin (ADMIN)</span>
          </div>
        </header>

        {syncMessage ? (
          <div className="badge badge-success" style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '24px', textTransform: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sparkles size={16} /> {syncMessage}
          </div>
        ) : null}

        {activeTab === 'dashboard' && renderDashboard()}
        {activeTab === 'catalog' && renderCatalog()}
        {activeTab === 'pos' && renderPOS()}
        {activeTab === 'ledger' && renderLedger()}
        {activeTab === 'settings' && renderSettings()}
      </main>

      {/* Modals & Overlays */}
      {scannerOpen ? (
        <BarcodeScanner 
          onScan={handleBarcodeScanned}
          onAISnap={handleAISnap}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}

      {posScannerOpen ? (
        <BarcodeScanner 
          onScan={handlePOSBarcodeScan}
          onAISnap={() => {}} // No vision snap in POS checkout
          onClose={() => setPosScannerOpen(false)}
        />
      ) : null}

      {addProductOpen ? (
        <AddProductModal 
          initialBarcode={prefilledBarcode}
          prefilledPhoto={prefilledPhoto}
          apiRequestHeaders={apiHeaders}
          onClose={() => {
            setAddProductOpen(false);
            setPrefilledPhoto(null);
          }}
          onSave={() => {
            setAddProductOpen(false);
            setPrefilledPhoto(null);
            fetchDashboardData();
          }}
        />
      ) : null}

      {/* Direct variant Stock adjust Modal */}
      {adjustmentProduct && adjustmentVariant ? (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '400px' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Update Stock Level</h3>
              <button className="btn btn-secondary" onClick={() => { setAdjustmentProduct(null); setAdjustmentVariant(null); }} style={{ padding: '8px' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold' }}>{adjustmentProduct.name}</div>
              <div style={{ fontSize: '12px', color: 'var(--primary)', fontWeight: 500 }}>Variant: {adjustmentVariant.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>SKU: {adjustmentVariant.sku}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current Quantity: {adjustmentVariant.total_quantity}</div>
            </div>

            <form onSubmit={handleStockAdjustment}>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="adj-delta">Adjustment Amount (+/-)</label>
                <input 
                  id="adj-delta"
                  type="number" 
                  value={stockDelta} 
                  onChange={e => setStockDelta(e.target.value)} 
                  required 
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="adj-reason">Reason</label>
                <select id="adj-reason" value={stockReason} onChange={e => setStockReason(e.target.value)}>
                  <option value="received">Restock (Received Shipment)</option>
                  <option value="sold">Sold (Direct Sale)</option>
                  <option value="adjustment">Inventory Count Audit</option>
                  <option value="damaged">Damaged / Written-Off</option>
                </select>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label htmlFor="adj-note">Reference Note</label>
                <input 
                  id="adj-note"
                  type="text" 
                  value={stockNote} 
                  onChange={e => setStockNote(e.target.value)} 
                  placeholder="e.g. PO #104"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setAdjustmentProduct(null); setAdjustmentVariant(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Confirm Reset Demo Modal */}
      {showResetConfirm ? (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '400px' }}>
            <h3 style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShieldX className="text-danger" size={24} /> Reset Database Seeding
            </h3>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5, margin: '0 0 20px 0' }}>
              This will truncate all active products, variants, stock levels, and audit logs. The database will be seeded with standard demo inventory items (HDMI, Mice, Reams).
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)} disabled={resetting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleResetDemoData} disabled={resetting}>
                {resetting ? 'Resetting...' : 'Confirm Reset Seeding'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
