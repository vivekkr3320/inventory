import React, { useState, useEffect } from 'react';
import { 
  Package, Search, Plus, Camera, Settings, LogOut, 
  Sparkles, ShieldAlert, ArrowUpDown, History, Key, CheckCircle, RefreshCw, ShoppingBag
} from 'lucide-react';
import BarcodeScanner from './components/BarcodeScanner';
import AddProductModal from './components/AddProductModal';

export default function App() {
  // Auth state
  const [token, setToken] = useState('bypass');
  const [user, setUser] = useState({ email: 'admin@vividinventory.local', orgName: 'My Inventory' });
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authOrgName, setAuthOrgName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [authError, setAuthError] = useState('');

  // App core state
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState({ skuCount: 0, totalStockCount: 0, totalValuation: 0, lowStockCount: 0, recentMovements: [] });
  const [search, setSearch] = useState('');
  const [filterLowStock, setFilterLowStock] = useState(false);
  const [loading, setLoading] = useState(false);

  // Settings state (BYOK & Shopify)
  const [showSettings, setShowSettings] = useState(false);
  const [visionProvider, setVisionProvider] = useState('gemini');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKeySaved, setHasApiKeySaved] = useState(false);
  const [shopifyShopUrl, setShopifyShopUrl] = useState('');
  const [shopifyAccessToken, setShopifyAccessToken] = useState('');
  const [hasShopifyTokenSaved, setHasShopifyTokenSaved] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // Shopify Sync state
  const [syncingShopify, setSyncingShopify] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  // Modals state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [prefilledBarcode, setPrefilledBarcode] = useState('');
  const [prefilledPhoto, setPrefilledPhoto] = useState(null);
  const [adjustmentProduct, setAdjustmentProduct] = useState(null);
  const [adjustmentVariant, setAdjustmentVariant] = useState(null);
  const [stockDelta, setStockDelta] = useState('1');
  const [stockReason, setStockReason] = useState('received');
  const [stockNote, setStockNote] = useState('');

  const apiHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  const fetchDashboardData = async () => {
    if (!token) return;
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
    if (!token) return;
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
    if (token) {
      fetchDashboardData();
      fetchSettings();
    }
  }, [token, search, filterLowStock]);

  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
    const body = isSignup 
      ? { orgName: authOrgName, email: authEmail, password: authPassword }
      : { email: authEmail, password: authPassword };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      if (isSignup) {
        setIsSignup(false);
        setAuthError('Signup complete! Please login with your details.');
      } else {
        localStorage.setItem('token', data.accessToken);
        localStorage.setItem('user', JSON.stringify(data.user));
        setToken(data.accessToken);
        setUser(data.user);
      }
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken('');
    setUser(null);
  };

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
        setSettingsSuccess('Credentials updated successfully!');
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
        setSettingsSuccess('Vision API Key deleted. Reverting to Sandbox Mode.');
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

  // Shopify sync trigger
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

  const handleBarcodeScanned = async (barcode) => {
    setScannerOpen(false);
    try {
      const res = await fetch(`/api/products/lookup/${barcode}`, { headers: apiHeaders });
      if (!res.ok) throw new Error('Lookup failed');
      const data = await res.json();
      
      if (data.found && data.product) {
        // Matched a specific variant
        const matched = data.product;
        // Fetch parent details to populate correctly
        const parentRes = await fetch(`/api/products/${matched.id}`, { headers: apiHeaders });
        if (parentRes.ok) {
          const parent = await parentRes.json();
          const targetVariant = parent.variants.find(v => v.id === matched.variantId);
          setAdjustmentProduct(parent);
          setAdjustmentVariant(targetVariant);
          setStockDelta('1');
          setStockReason('received');
        }
      } else if (data.source === 'open_food_facts' && data.product) {
        setPrefilledBarcode(barcode);
        setAddProductOpen(true);
      } else {
        setPrefilledBarcode(barcode);
        setAddProductOpen(true);
      }
    } catch (e) {
      console.error(e);
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

  if (!token) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '16px' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', marginBottom: '12px' }}>
              <Package size={32} />
            </div>
            <h2 style={{ margin: 0 }}>VividInventory</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>Retail & D2C Stock Engine</p>
          </div>

          {authError ? (
            <div className="badge badge-danger" style={{ width: '100%', padding: '10px', borderRadius: '8px', marginBottom: '16px', textTransform: 'none' }}>
              {authError}
            </div>
          ) : null}

          <form onSubmit={handleAuth}>
            {isSignup ? (
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="auth-org-name">Organization Name</label>
                <input 
                  id="auth-org-name"
                  type="text" 
                  value={authOrgName} 
                  onChange={e => setAuthOrgName(e.target.value)} 
                  required 
                  placeholder="e.g. Vintage Apparel Co." 
                />
              </div>
            ) : null}

            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="auth-email">Email Address</label>
              <input 
                id="auth-email"
                type="email" 
                value={authEmail} 
                onChange={e => setAuthEmail(e.target.value)} 
                required 
                placeholder="you@example.com" 
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label htmlFor="auth-pw">Password</label>
              <input 
                id="auth-pw"
                type="password" 
                value={authPassword} 
                onChange={e => setAuthPassword(e.target.value)} 
                required 
                placeholder="••••••••" 
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>
              {isSignup ? 'Create Account' : 'Log In'}
            </button>
          </form>

          <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px' }}>
            <button 
              className="btn" 
              style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: 0 }}
              onClick={() => {
                setIsSignup(!isSignup);
                setAuthError('');
              }}
            >
              {isSignup ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header */}
      <header className="glass flex-between" style={{ padding: '16px 24px', marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Package className="text-primary" size={28} />
          <div>
            <h3 style={{ margin: 0, lineHeight: 1.1 }}>VividInventory</h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.orgName} (Retail & D2C)</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={triggerShopifySync} 
            disabled={syncingShopify}
            style={{ gap: '6px', color: hasShopifyTokenSaved ? 'var(--success)' : 'var(--text-main)' }}
            title="Sync Shopify"
          >
            {syncingShopify ? <RefreshCw className="animate-spin" size={16} /> : <ShoppingBag size={16} />}
            Sync Shopify
          </button>
          <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)} style={{ padding: '10px' }} title="Settings">
            <Settings size={18} />
          </button>
        </div>
      </header>

      {/* Sync Status Banner */}
      {syncMessage ? (
        <div className="badge badge-success" style={{ width: '100%', padding: '12px', borderRadius: '8px', marginBottom: '24px', textTransform: 'none', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} /> {syncMessage}
        </div>
      ) : null}

      {/* Settings Panel */}
      {showSettings ? (
        <div className="glass-card" style={{ marginBottom: '32px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Settings className="text-primary" size={18} /> Integrations & Credentials
            </h4>
            <span className="badge badge-success">Configured</span>
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
      ) : null}

      {/* Dashboard Summaries */}
      <section className="grid-3" style={{ marginBottom: '32px' }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
            <Package size={28} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unique Products</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{summary.skuCount}</div>
          </div>
        </div>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
            <ArrowUpDown size={28} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Total Stock Units</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{summary.totalStockCount}</div>
          </div>
        </div>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)' }}>
            <ShieldAlert size={28} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Low Stock Variants</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: summary.lowStockCount > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
              {summary.lowStockCount}
            </div>
          </div>
        </div>
      </section>

      {/* Main Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '32px', alignItems: 'flex-start' }}>
        
        {/* Left: Product Catalog */}
        <section className="glass-card" style={{ minHeight: '400px' }}>
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <h3 style={{ margin: 0 }}>D2C Product Catalog</h3>
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

                  {/* Variants nested table */}
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
                        const isLow = v.total_quantity <= v.low_stock_threshold;
                        return (
                          <tr key={v.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                            <td style={{ padding: '8px 6px', fontWeight: 500 }}>{v.name}</td>
                            <td style={{ padding: '8px 6px', color: 'var(--text-muted)' }}>
                              <div>SKU: {v.sku}</div>
                              {v.barcode ? <div style={{ fontSize: '10px', color: 'var(--primary)' }}>BC: {v.barcode}</div> : null}
                            </td>
                            <td style={{ padding: '8px 6px', textAlign: 'right' }}>${v.price.toFixed(2)}</td>
                            <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                              <span style={{ fontWeight: 'bold', marginRight: '6px' }}>{v.total_quantity}</span>
                              <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '8px', padding: '1px 4px' }}>
                                {isLow ? 'Low' : 'OK'}
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

        {/* Right: Ledger Logs */}
        <section className="glass-card">
          <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <History className="text-primary" size={20} /> Stock Ledger
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {summary.recentMovements.length === 0 ? (
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', textAlign: 'center', padding: '40px 10px' }}>
                Stock adjustments logs will appear here.
              </div>
            ) : (
              summary.recentMovements.map(m => {
                const isAddition = m.quantity_delta > 0;
                return (
                  <div key={m.id} style={{ display: 'flex', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '12px', fontSize: '13px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      width: '32px', 
                      height: '32px', 
                      borderRadius: '50%',
                      background: isAddition ? 'var(--success-glow)' : 'rgba(239, 68, 68, 0.1)',
                      color: isAddition ? 'var(--success)' : 'var(--danger)',
                      fontWeight: 'bold',
                      flexShrink: 0
                    }}>
                      {isAddition ? `+` : ``}{m.quantity_delta}
                    </div>
                    <div style={{ flexGrow: 1 }}>
                      <div style={{ fontWeight: 600 }}>{m.product_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Variant: <span style={{ color: 'var(--text-main)', fontWeight: 500 }}>{m.variant_name}</span> (SKU: {m.product_sku})
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Reason: {m.reason} {m.reference_note ? `(${m.reference_note})` : ''}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dark)', marginTop: '2px' }}>
                        {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {m.user_email?.split('@')[0]}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>

      {/* Barcode scanner camera Modal */}
      {scannerOpen ? (
        <BarcodeScanner 
          onScan={handleBarcodeScanned}
          onAISnap={handleAISnap}
          onClose={() => setScannerOpen(false)}
        />
      ) : null}

      {/* Add Product Modal */}
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

      {/* Stock Adjustment Quick Modal */}
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
                  placeholder="e.g. 5, -3"
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="adj-reason">Reason</label>
                <select 
                  id="adj-reason"
                  value={stockReason} 
                  onChange={e => setStockReason(e.target.value)}
                >
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
                  placeholder="e.g. PO #104, Damaged seal"
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { setAdjustmentProduct(null); setAdjustmentVariant(null); }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Confirm Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
