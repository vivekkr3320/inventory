import React, { useState, useEffect } from 'react';
import { 
  Package, Search, Plus, Camera, Settings, LogOut, 
  Sparkles, ShieldAlert, ArrowUpDown, History, Key, CheckCircle, RefreshCw
} from 'lucide-react';
import BarcodeScanner from './components/BarcodeScanner';
import AddProductModal from './components/AddProductModal';

export default function App() {
  // Auth state
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('user')) || null);
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

  // Settings BYOK state
  const [showSettings, setShowSettings] = useState(false);
  const [visionProvider, setVisionProvider] = useState('gemini');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [hasApiKeySaved, setHasApiKeySaved] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // Modals state
  const [scannerOpen, setScannerOpen] = useState(false);
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [prefilledBarcode, setPrefilledBarcode] = useState('');
  const [adjustmentProduct, setAdjustmentProduct] = useState(null);
  const [stockDelta, setStockDelta] = useState('1');
  const [stockReason, setStockReason] = useState('received');
  const [stockNote, setStockNote] = useState('');

  // Computed headers
  const apiHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  // Fetch all dashboard summary and products
  const fetchDashboardData = async () => {
    if (!token) return;
    setLoading(true);
    try {
      // Fetch summary
      const sumRes = await fetch('/api/dashboard/summary', { headers: apiHeaders });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }

      // Fetch products
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

  // Fetch settings status
  const fetchSettings = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/settings', { headers: apiHeaders });
      if (res.ok) {
        const data = await res.json();
        setVisionProvider(data.visionProvider);
        setHasApiKeySaved(data.hasApiKey);
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

  // Auth: handle sign in/up
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
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

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

  // Settings updates
  const saveSettings = async (e) => {
    e.preventDefault();
    setSettingsSuccess('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({
          visionProvider,
          apiKey: apiKeyInput || null
        })
      });
      if (res.ok) {
        setSettingsSuccess('API configurations updated successfully!');
        setApiKeyInput('');
        fetchSettings();
        setTimeout(() => setSettingsSuccess(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const clearApiKey = async () => {
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({ clearKey: true })
      });
      if (res.ok) {
        setHasApiKeySaved(false);
        setSettingsSuccess('Vision API Key deleted. Reverting to Mock Sandbox Mode.');
        setTimeout(() => setSettingsSuccess(''), 3000);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Barcode scan outcome handler
  const handleBarcodeScanned = async (barcode) => {
    setScannerOpen(false);
    
    // Look up barcode locally first
    try {
      const res = await fetch(`/api/products/lookup/${barcode}`, { headers: apiHeaders });
      if (!res.ok) throw new Error('Lookup failed');
      const data = await res.json();
      
      if (data.found && data.product) {
        // Product exists -> Open stock adjustment quick modal
        setAdjustmentProduct(data.product);
        setStockDelta('1');
        setStockReason('received');
      } else if (data.source === 'open_food_facts' && data.product) {
        // Found externally (Open Food Facts) -> Pre-populate fields in creation form
        setPrefilledBarcode(barcode);
        setAddProductOpen(true);
        // Force prefill initial values by updating state or let AddProductModal handle
      } else {
        // Not found anywhere -> Open clean Add Product form prefilled with barcode
        setPrefilledBarcode(barcode);
        setAddProductOpen(true);
      }
    } catch (e) {
      console.error(e);
      // Fallback
      setPrefilledBarcode(barcode);
      setAddProductOpen(true);
    }
  };

  // Submit stock adjustments
  const handleStockAdjustment = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/stock/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({
          productId: adjustmentProduct.id,
          quantityDelta: parseInt(stockDelta),
          reason: stockReason,
          referenceNote: stockNote
        })
      });

      if (res.ok) {
        setAdjustmentProduct(null);
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
    // Auth login/signup page UI
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '16px' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', padding: '12px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', marginBottom: '12px' }}>
              <Package size={32} />
            </div>
            <h2 style={{ margin: 0 }}>VividInventory</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: '4px 0 0 0' }}>AI-Powered Stock Operations</p>
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
                  placeholder="e.g. Acme Stores" 
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
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{user?.orgName || 'Loading...'}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="btn btn-secondary" onClick={() => setShowSettings(!showSettings)} style={{ padding: '10px' }}>
            <Settings size={18} />
          </button>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '10px' }} title="Log Out">
            <LogOut size={18} />
          </button>
        </div>
      </header>

      {/* Settings BYOK Box */}
      {showSettings ? (
        <div className="glass-card" style={{ marginBottom: '32px', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
          <div className="flex-between" style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Key className="text-primary" size={18} /> Vision AI Settings (BYOK)
            </h4>
            <span className={`badge ${hasApiKeySaved ? 'badge-success' : 'badge-warning'}`}>
              {hasApiKeySaved ? 'API KEY SAVED' : 'SANDBOX MODE'}
            </span>
          </div>

          {settingsSuccess ? (
            <div className="badge badge-success" style={{ width: '100%', padding: '10px', borderRadius: '8px', marginBottom: '16px', textTransform: 'none' }}>
              {settingsSuccess}
            </div>
          ) : null}

          <form onSubmit={saveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label htmlFor="settings-provider">Vision API Provider</label>
                <select 
                  id="settings-provider"
                  value={visionProvider} 
                  onChange={e => setVisionProvider(e.target.value)}
                >
                  <option value="gemini">Google Gemini API (gemini-2.5-flash)</option>
                  <option value="openai">OpenAI API (gpt-4o-mini)</option>
                </select>
              </div>
              <div>
                <label htmlFor="settings-key">{hasApiKeySaved ? 'Overwrite API Key' : 'Enter API Key'}</label>
                <input 
                  id="settings-key"
                  type="password" 
                  value={apiKeyInput} 
                  onChange={e => setApiKeyInput(e.target.value)} 
                  placeholder={hasApiKeySaved ? '••••••••••••••••' : 'AI_API_KEY_...'}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              {hasApiKeySaved ? (
                <button type="button" className="btn btn-danger" onClick={clearApiKey} style={{ padding: '10px 16px' }}>
                  Delete Saved Key
                </button>
              ) : null}
              <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>
                Save Settings
              </button>
            </div>
          </form>
          <div style={{ marginTop: '12px', fontSize: '11px', color: 'var(--text-muted)' }}>
            We encrypted saved keys using AES-256-GCM. Leaving it empty utilizes our **Mock Sandbox Mode** to let you try the image ingestion flow immediately without a key.
          </div>
        </div>
      ) : null}

      {/* Dashboard Summaries */}
      <section className="grid-3" style={{ marginBottom: '32px' }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <div style={{ padding: '12px', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>
            <Package size={28} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Active SKU Codes</div>
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
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Low Stock Items</div>
            <div style={{ fontSize: '28px', fontWeight: 'bold', color: summary.lowStockCount > 0 ? 'var(--danger)' : 'var(--text-main)' }}>
              {summary.lowStockCount}
            </div>
          </div>
        </div>
      </section>

      {/* Main Panel grid (left table list, right recent ledger logs) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: '32px', alignItems: 'flex-start' }}>
        
        {/* Left: Product catalog list */}
        <section className="glass-card" style={{ minHeight: '400px' }}>
          <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
            <h3 style={{ margin: 0 }}>Product Catalog</h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button 
                className={`btn ${filterLowStock ? 'btn-danger' : 'btn-secondary'}`}
                onClick={() => setFilterLowStock(!filterLowStock)}
                style={{ padding: '10px 14px' }}
              >
                Low Stock Only
              </button>
              <button 
                className="btn btn-secondary" 
                onClick={() => {
                  setPrefilledBarcode('');
                  setScannerOpen(true);
                }}
                style={{ gap: '8px' }}
              >
                <Camera size={16} /> Scan Barcode
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  setPrefilledBarcode('');
                  setAddProductOpen(true);
                }}
                style={{ gap: '8px' }}
              >
                <Plus size={16} /> Add Product
              </button>
            </div>
          </div>

          {/* Search bar */}
          <div style={{ position: 'relative', marginBottom: '20px' }}>
            <Search style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }} size={16} />
            <input 
              type="text" 
              placeholder="Search by name, SKU, or barcode..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '40px' }}
            />
          </div>

          {/* Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <RefreshCw size={24} className="animate-spin text-primary" style={{ margin: '0 auto 12px' }} />
              Loading product logs...
            </div>
          ) : products.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 20px' }}>
              No products found. Click **Add Product** or **Scan Barcode** to populate stock.
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)', fontSize: '13px' }}>
                    <th style={{ padding: '12px 8px' }}>Product</th>
                    <th style={{ padding: '12px 8px' }}>SKU/Barcode</th>
                    <th style={{ padding: '12px 8px' }}>Category</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Stock Level</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Price</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map(p => {
                    const isLow = p.total_quantity <= p.low_stock_threshold;
                    return (
                      <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '14px' }}>
                        <td style={{ padding: '16px 8px' }}>
                          <div style={{ fontWeight: 600 }}>{p.name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.brand || 'No brand'}</div>
                        </td>
                        <td style={{ padding: '16px 8px' }}>
                          <div style={{ color: 'var(--text-muted)', fontSize: '12px' }}>SKU: {p.sku}</div>
                          {p.barcode ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--primary)' }}>
                              <Barcode size={12} /> {p.barcode}
                            </div>
                          ) : null}
                        </td>
                        <td style={{ padding: '16px 8px' }}>
                          <span style={{ fontSize: '12px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
                            {p.category}
                          </span>
                        </td>
                        <td style={{ padding: '16px 8px', textAlign: 'right' }}>
                          <div style={{ fontWeight: 'bold' }}>{p.total_quantity}</div>
                          <span className={`badge ${isLow ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '9px', padding: '2px 6px' }}>
                            {isLow ? 'Low Stock' : 'In Stock'}
                          </span>
                        </td>
                        <td style={{ padding: '16px 8px', textAlign: 'right', fontWeight: '500' }}>
                          ${p.price.toFixed(2)}
                        </td>
                        <td style={{ padding: '16px 8px', textAlign: 'center' }}>
                          <button 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 12px', fontSize: '12px' }}
                            onClick={() => {
                              setAdjustmentProduct(p);
                              setStockDelta('1');
                              setStockReason('received');
                            }}
                          >
                            Update Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Right: Recent ledger logs */}
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
          onClose={() => setScannerOpen(false)}
        />
      ) : null}

      {/* Add Product Modal */}
      {addProductOpen ? (
        <AddProductModal 
          initialBarcode={prefilledBarcode}
          apiRequestHeaders={apiHeaders}
          onClose={() => setAddProductOpen(false)}
          onSave={() => {
            setAddProductOpen(false);
            fetchDashboardData();
          }}
        />
      ) : null}

      {/* Stock Adjustment Quick Modal */}
      {adjustmentProduct ? (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '400px' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3 style={{ margin: 0 }}>Update Stock Level</h3>
              <button className="btn btn-secondary" onClick={() => setAdjustmentProduct(null)} style={{ padding: '8px' }}>
                <X size={18} />
              </button>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
              <div style={{ fontWeight: 'bold' }}>{adjustmentProduct.name}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SKU: {adjustmentProduct.sku}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Current Quantity: {adjustmentProduct.total_quantity}</div>
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
                <button type="button" className="btn btn-secondary" onClick={() => setAdjustmentProduct(null)}>
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
