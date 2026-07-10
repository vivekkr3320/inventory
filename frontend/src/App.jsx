import React, { useState, useEffect, useRef } from 'react';
import { 
  Package, Search, Plus, Camera, Settings, LogOut, 
  Sparkles, ShieldAlert, ArrowUpDown, History, Key, CheckCircle, RefreshCw, 
  ShoppingBag, LayoutDashboard, Minus, Trash2, ShieldX, Users, FileText, 
  TrendingUp, Truck, Users2, X, Receipt, Menu, MoreHorizontal
} from 'lucide-react';
import BarcodeScanner from './components/BarcodeScanner';
import AddProductModal from './components/AddProductModal';

export default function App() {
  const getInitialTab = () => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'dashboard';
  };

  // Navigation & auth state
  const [token, setToken] = useState('bypass'); // Auto-auth session
  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
  };

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const navigate = (tabName) => {
    setActiveTab(tabName);
    setMoreMenuOpen(false); // Close mobile more drawer on navigation
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') !== tabName) {
      window.history.pushState({ tab: tabName }, '', `?tab=${tabName}`);
    }
  };

  useEffect(() => {
    const handlePopState = (e) => {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab') || 'dashboard';
      setActiveTab(tab);
    };

    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get('tab') || 'dashboard';
    window.history.replaceState({ tab: initialTab }, '', `?tab=${initialTab}`);

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  
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
  
  // Tab-specific datasets
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [users, setUsers] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [ledgerMovements, setLedgerMovements] = useState([]);
  
  // Invoice states
  const [invoiceCart, setInvoiceCart] = useState([]);
  const [invoiceCustomer, setInvoiceCustomer] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().substring(0, 10));
  const [invoiceTax, setInvoiceTax] = useState(18);
  const [invoiceDiscount, setInvoiceDiscount] = useState(0);
  const [showInvoicePrint, setShowInvoicePrint] = useState(null);
  
  // Custom Invoice Form States
  const [selectedInvVariant, setSelectedInvVariant] = useState('');
  const [invQty, setInvQty] = useState(1);
  const [invPrice, setInvPrice] = useState(0);
  const [invoiceTab, setInvoiceTab] = useState('sales');

  const [search, setSearch] = useState('');
  const [dashSortField, setDashSortField] = useState('created_at');
  const [dashSortDirection, setDashSortDirection] = useState('desc');
  const [dashSearch, setDashSearch] = useState('');
  const [dashTypeFilter, setDashTypeFilter] = useState('ALL');
  const [catalogViewMode, setCatalogViewMode] = useState('grid');
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

  // Create Supplier Modal state
  const [addSupplierOpen, setAddSupplierOpen] = useState(false);
  const [supplierName, setSupplierName] = useState('');
  const [supplierEmail, setSupplierEmail] = useState('');
  const [supplierPhone, setSupplierPhone] = useState('');
  const [supplierCompany, setSupplierCompany] = useState('');

  // Create Purchase Order Modal state
  const [addPoOpen, setAddPoOpen] = useState(false);
  const [poSupplierId, setPoSupplierId] = useState('');
  const [poItems, setPoItems] = useState([{ variantId: '', quantityOrdered: 5, cost: 100 }]);
  const [poFilterStatus, setPoFilterStatus] = useState('ALL');
  const [poMobileFilterOpen, setPoMobileFilterOpen] = useState(false);
  const [poViewMode, setPoViewMode] = useState('list');

  const apiHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};

  // Fetch core dashboard data
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const sumRes = await fetch('/api/dashboard/summary', { headers: apiHeaders });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }

      let prodUrl = `/api/products?search=${search}`;
      if (filterLowStock || activeTab === 'alerts') prodUrl += '&lowStock=true';
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

  // Fetch suppliers
  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers', { headers: apiHeaders });
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch (e) {
      console.error('Fetch suppliers error:', e);
    }
  };

  // Fetch purchase orders
  const fetchPurchaseOrders = async () => {
    try {
      const res = await fetch('/api/purchase-orders', { headers: apiHeaders });
      if (res.ok) {
        const data = await res.json();
        setPurchaseOrders(data);
      }
    } catch (e) {
      console.error('Fetch POs error:', e);
    }
  };

  // Fetch users list
  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/users', { headers: apiHeaders });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (e) {
      console.error('Fetch users error:', e);
    }
  };

  // Fetch audit logs
  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/audit-logs', { headers: apiHeaders });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error('Fetch audit logs error:', e);
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

  const fetchLedgerLogs = async () => {
    try {
      const res = await fetch('/api/stock/movements', { headers: apiHeaders });
      if (res.ok) {
        const data = await res.json();
        setLedgerMovements(data);
      }
    } catch (e) {
      console.error('Fetch ledger logs error:', e);
    }
  };

  // Coordinated loaders based on current view tab
  useEffect(() => {
    fetchDashboardData();
  }, [search, filterLowStock, activeTab]);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (activeTab === 'po' || activeTab === 'pos' || activeTab === 'partners') {
      fetchSuppliers();
    }
    if (activeTab === 'po') {
      fetchPurchaseOrders();
    }
    if (activeTab === 'users') {
      fetchUsers();
    }
    if (activeTab === 'audit') {
      fetchAuditLogs();
    }
    if (activeTab === 'ledger' || activeTab === 'invoices') {
      fetchLedgerLogs();
    }
  }, [activeTab]);

  // Seeding Demo Data
  const handleResetDemoData = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/db/reset-demo', {
        method: 'POST',
        headers: apiHeaders
      });
      if (res.ok) {
        showToast('Database reset and seeded successfully!', 'success');
        setShowResetConfirm(false);
        navigate('dashboard');
        fetchDashboardData();
        fetchSuppliers();
        fetchPurchaseOrders();
        fetchAuditLogs();
      } else {
        const errData = await res.json();
        showToast('Failed to reset data: ' + (errData.error || 'Unknown error'), 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Network error: ' + e.message, 'error');
    } finally {
      setResetting(false);
    }
  };

  // Add Partner
  const handleCreateSupplier = async (e) => {
    e.preventDefault();
    if (!supplierName) return;
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({
          name: supplierName,
          email: supplierEmail,
          phone: supplierPhone,
          company: supplierCompany
        })
      });
      if (res.ok) {
        setSupplierName('');
        setSupplierEmail('');
        setSupplierPhone('');
        setSupplierCompany('');
        setAddSupplierOpen(false);
        fetchSuppliers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Create PO
  const handleCreatePO = async (e) => {
    e.preventDefault();
    const validItems = poItems.filter(item => item.variantId && item.quantityOrdered > 0);
    if (validItems.length === 0) {
      showToast('Add at least one product item to the purchase order.', 'error');
      return;
    }
    try {
      const res = await fetch('/api/purchase-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({
          supplierId: poSupplierId || null,
          items: validItems
        })
      });
      if (res.ok) {
        showToast('Purchase Order created successfully!', 'success');
        setAddPoOpen(false);
        setPoSupplierId('');
        setPoItems([{ variantId: '', quantityOrdered: 5, cost: 100 }]);
        fetchPurchaseOrders();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // PO status update triggers (e.g. marking PO as pending or received)
  const handlePOStatusUpdate = async (poId, newStatus) => {
    try {
      const res = await fetch(`/api/purchase-orders/${poId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...apiHeaders },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        showToast(`Purchase Order marked as ${newStatus}!`, 'success');
        fetchPurchaseOrders();
        fetchDashboardData();
      } else {
        const data = await res.json();
        showToast(data.error || 'Failed to update order status', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error updating status.', 'error');
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

  // Barcode Scanner Handlers
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
        showToast('Stock level adjusted successfully!', 'success');
        setAdjustmentProduct(null);
        setAdjustmentVariant(null);
        setStockNote('');
        fetchDashboardData();
      } else {
        const err = await res.json();
        showToast(err.error || 'Adjustment failed', 'error');
      }
    } catch (err) {
      console.error(err);
      showToast('Network error during adjustment.', 'error');
    }
  };

  // POS Billing Handlers
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
        const parentRes = await fetch(`/api/products/${matched.id}`, { headers: apiHeaders });
        if (parentRes.ok) {
          const parent = await parentRes.json();
          const targetVariant = parent.variants.find(v => v.id === matched.variantId);
          addToCart(targetVariant, parent.name);
        }
      } else {
        showToast(`Barcode ${barcode} not found in product catalog.`, 'error');
      }
    } catch (e) {
      console.error(e);
      showToast('Error looking up barcode.', 'error');
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

  // Helper: Get flat array of all variants for creation selectors
  const getFlatVariants = () => {
    const arr = [];
    products.forEach(p => {
      p.variants.forEach(v => {
        arr.push({ ...v, productName: p.name });
      });
    });
    return arr;
  };

  // ----------------------------------------------------
  // MODULE RENDER VIEWS
  // ----------------------------------------------------

  const renderSparkline = () => {
    const movements = summary.recentMovements || [];
    let currentVal = summary.totalValuation || 50000;
    const values = [currentVal];
    movements.slice(0, 8).forEach(m => {
      currentVal -= (m.quantity_delta * 120);
      values.push(currentVal);
    });
    values.reverse();
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const points = values.map((val, idx) => {
      const x = (idx / (values.length - 1)) * 60 + 5;
      const y = 20 - ((val - min) / range) * 16;
      return `${x},${y}`;
    }).join(' ');

    return (
      <svg width="70" height="22" style={{ overflow: 'visible', marginLeft: 'auto' }}>
        <polyline
          fill="none"
          stroke="var(--success)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
    );
  };

  // 1. Dashboard View
  const renderDashboard = () => {
    const handleDashSort = (field) => {
      if (dashSortField === field) {
        setDashSortDirection(dashSortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setDashSortField(field);
        setDashSortDirection('desc');
      }
    };

    const sortedMovements = [...(summary.recentMovements || [])].sort((a, b) => {
      let aVal = a[dashSortField];
      let bVal = b[dashSortField];
      
      if (dashSortField === 'created_at') {
        aVal = new Date(a.created_at).getTime();
        bVal = new Date(b.created_at).getTime();
      } else if (dashSortField === 'product_name') {
        aVal = a.product_name || '';
        bVal = b.product_name || '';
      } else if (dashSortField === 'quantity_delta') {
        aVal = Math.abs(a.quantity_delta || 0);
        bVal = Math.abs(b.quantity_delta || 0);
      }
      
      if (aVal < bVal) return dashSortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return dashSortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    const filteredMovements = sortedMovements.filter(m => {
      const matchSearch = 
        (m.product_name && m.product_name.toLowerCase().includes(dashSearch.toLowerCase())) ||
        (m.product_sku && m.product_sku.toLowerCase().includes(dashSearch.toLowerCase())) ||
        (m.reference_note && m.reference_note.toLowerCase().includes(dashSearch.toLowerCase()));
      
      const isIssue = m.quantity_delta < 0;
      const matchType = 
        dashTypeFilter === 'ALL' ||
        (dashTypeFilter === 'ISSUE' && isIssue) ||
        (dashTypeFilter === 'RECEIPT' && !isIssue);
      
      return matchSearch && matchType;
    });

    return (
      <div>
        <section className="grid-4" style={{ marginBottom: '32px' }}>
          <div className="glass-card" style={{ borderLeft: '4px solid var(--primary)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>TOTAL SKUS</div>
              <div style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0', fontFamily: 'Outfit' }}>{summary.skuCount}</div>
            </div>
            <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
              <span>↑ +4</span>
              <span style={{ color: 'var(--text-dark)' }}>this month</span>
            </div>
          </div>

          <div className="glass-card" style={{ borderLeft: '4px solid var(--success)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>INVENTORY VALUE</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                <div style={{ fontSize: '28px', fontWeight: 800, margin: '4px 0', fontFamily: 'Outfit' }}>
                  ₹{summary.totalValuation.toLocaleString('en-IN', { minimumFractionDigits: 0 })}
                </div>
                {renderSparkline()}
              </div>
            </div>
            <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--success)' }}>
              <span>↑ +12.4%</span>
              <span style={{ color: 'var(--text-dark)' }}>vs last month</span>
            </div>
          </div>

          <div className="glass-card" style={{ borderLeft: '4px solid var(--warning)', cursor: 'pointer', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }} onClick={() => navigate('alerts')}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>LOW STOCK ALERTS</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: summary.lowStockCount > 0 ? 'var(--warning)' : 'var(--text-main)', margin: '4px 0', fontFamily: 'Outfit' }}>
                {summary.lowStockCount}
              </div>
            </div>
            <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: summary.lowStockCount > 0 ? 'var(--warning)' : 'var(--success)' }}>
              <span>{summary.lowStockCount > 0 ? '↑ +1' : '↓ -2'}</span>
              <span style={{ color: 'var(--text-dark)' }}>since yesterday</span>
            </div>
          </div>

          <div className="glass-card" style={{ borderLeft: '4px solid var(--danger)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '120px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>OUT OF STOCK</div>
              <div style={{ fontSize: '28px', fontWeight: 800, color: summary.outOfStockCount > 0 ? 'var(--danger)' : 'var(--text-main)', margin: '4px 0', fontFamily: 'Outfit' }}>
                {summary.outOfStockCount}
              </div>
            </div>
            <div style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--text-dark)' }}>
              <span>No change</span>
              <span>vs last week</span>
            </div>
          </div>
        </section>

        {products.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <Package className="text-primary" size={48} style={{ opacity: 0.8 }} />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 'bold' }}>No products registered yet</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0, maxWidth: '400px', lineHeight: 1.5 }}>
              Your inventory catalog is currently empty. Add your first product manually or use the AI vision scan tool to automatically populate details!
            </p>
            <button 
              className="btn btn-primary" 
              onClick={() => { setPrefilledBarcode(''); setAddProductOpen(true); }}
              style={{ gap: '8px', padding: '12px 24px', fontSize: '14px', marginTop: '8px' }}
            >
              <Plus size={16} /> Add First Product
            </button>
          </div>
        ) : (
          <div className="dashboard-grid-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
            {/* Left: Recent Transactions */}
            <section className="glass-card" style={{ margin: 0 }}>
              <div className="flex-between" style={{ marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <History className="text-primary" size={20} /> Recent Transactions
                </h3>
                <button className="btn btn-secondary" onClick={() => navigate('ledger')} style={{ padding: '8px 12px', fontSize: '12px', minHeight: '32px', height: '32px' }}>
                  View All Logs
                </button>
              </div>

              {/* Filter & Search Bar */}
              <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <div style={{ position: 'relative', flexGrow: 1, minWidth: '200px' }}>
                  <Search style={{ position: 'absolute', left: '12px', top: '10px', color: 'var(--text-muted)' }} size={16} />
                  <input 
                    type="text" 
                    placeholder="Search transactions..."
                    value={dashSearch}
                    onChange={e => setDashSearch(e.target.value)}
                    style={{ paddingLeft: '36px', height: '36px', fontSize: '13px' }}
                  />
                </div>
                <select
                  value={dashTypeFilter}
                  onChange={e => setDashTypeFilter(e.target.value)}
                  style={{ width: '150px', height: '36px', fontSize: '13px' }}
                >
                  <option value="ALL">All Types</option>
                  <option value="RECEIPT">RECEIPTS</option>
                  <option value="ISSUE">ISSUES</option>
                </select>
              </div>

              {filteredMovements.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                  No transaction records match the search criteria.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                        <th className="sortable-th" onClick={() => handleDashSort('created_at')} style={{ padding: '12px 8px' }}>
                          DATE {dashSortField === 'created_at' && (dashSortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th className="sortable-th" onClick={() => handleDashSort('product_name')} style={{ padding: '12px 8px' }}>
                          PRODUCT {dashSortField === 'product_name' && (dashSortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th style={{ padding: '12px 8px' }}>TYPE</th>
                        <th className="sortable-th" onClick={() => handleDashSort('quantity_delta')} style={{ padding: '12px 8px', textAlign: 'right' }}>
                          QUANTITY {dashSortField === 'quantity_delta' && (dashSortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th style={{ padding: '12px 8px' }}>NOTE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMovements.slice(0, 8).map(m => {
                        const isIssue = m.quantity_delta < 0;
                        return (
                          <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }} className="table-hover-row">
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
                              {isIssue ? '' : '+'}{m.quantity_delta}
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

            {/* Right: Cin7 Channels Integration Widget */}
            <section className="glass-card" style={{ margin: 0, display: 'flex', flexDirection: 'column', gap: '20px', height: 'fit-content' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '12px' }}>
                <Sparkles className="text-primary" size={20} />
                <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>Cin7 Connected Channels</h3>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div className="flex-between" style={{ marginBottom: '8px' }}>
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>Shopify Integration</span>
                    <span className={`badge ${hasShopifyTokenSaved ? 'badge-success' : 'badge-secondary'}`} style={{ fontSize: '10px' }}>
                      {hasShopifyTokenSaved ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-dark)', wordBreak: 'break-all' }}>{shopifyShopUrl || 'No store linked'}</span>
                </div>
                
                <div style={{ padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <div className="flex-between">
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>POS Billing Terminal</span>
                    <span className="badge badge-success" style={{ fontSize: '10px' }}>ONLINE</span>
                  </div>
                </div>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={triggerShopifySync} 
                  disabled={syncingShopify}
                  style={{ width: '100%', minHeight: '36px', gap: '8px', fontSize: '12px' }}
                >
                  <RefreshCw size={14} className={syncingShopify ? 'animate-spin' : ''} />
                  {syncingShopify ? 'Syncing...' : 'Sync Shopify Inventory'}
                </button>
                {syncMessage && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>
                    {syncMessage}
                  </span>
                )}
              </div>
            </section>
          </div>
        )}
      </div>
    );
  };

  // 2. Catalog View (Shared by Catalog and Alerts tab, alerts tab sets filter automatically)
  const renderCatalog = (isAlertsOnly = false) => (
    <section className="glass-card">
      <div className="flex-between" style={{ flexWrap: 'wrap', gap: '16px', marginBottom: '24px' }}>
        <h3 style={{ margin: 0 }}>{isAlertsOnly ? 'Active Stock Alerts' : 'Products Catalog'}</h3>
        {!isAlertsOnly ? (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
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
            
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button 
                type="button"
                className={`btn ${catalogViewMode === 'grid' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setCatalogViewMode('grid')}
                style={{ padding: '4px 10px', fontSize: '11px', minHeight: '28px', height: '28px', border: 'none' }}
              >
                Grid View
              </button>
              <button 
                type="button"
                className={`btn ${catalogViewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setCatalogViewMode('list')}
                style={{ padding: '4px 10px', fontSize: '11px', minHeight: '28px', height: '28px', border: 'none' }}
              >
                List View
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <Search style={{ position: 'absolute', left: '14px', top: '13px', color: 'var(--text-muted)' }} size={16} />
        <input 
          type="text" 
          placeholder="Search catalog items..."
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
          {isAlertsOnly ? 'No products are currently low on stock. Great job!' : 'No items found in catalog.'}
        </div>
      ) : catalogViewMode === 'grid' ? (
        <div className="catalog-grid">
          {products.map(p => {
            const lowStockCount = p.variants.filter(v => v.total_quantity <= v.low_stock_threshold).length;
            const hasAlert = lowStockCount > 0;
            return (
              <div key={p.id} className="catalog-grid-card">
                <div className="catalog-grid-image-wrapper">
                  {p.primary_image_url ? (
                    <img src={p.primary_image_url} alt={p.name} className="catalog-grid-img" />
                  ) : (
                    <div className="catalog-grid-placeholder">
                      <Package size={32} style={{ opacity: 0.5 }} />
                      <span style={{ fontSize: '11px' }}>No Image</span>
                    </div>
                  )}
                  {hasAlert && (
                    <span className="badge badge-warning catalog-grid-badge" style={{ fontSize: '10px' }}>
                      {lowStockCount} ALERT{lowStockCount > 1 ? 'S' : ''}
                    </span>
                  )}
                </div>
                
                <div className="catalog-grid-body">
                  <div className="flex-between">
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      {p.category || 'Uncategorized'}
                    </span>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {p.variants.length} variant{p.variants.length > 1 ? 's' : ''}
                    </span>
                  </div>
                  
                  <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: 'var(--text-main)' }}>{p.name}</h4>
                  
                  <div style={{ marginTop: 'auto', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '10px', color: 'var(--text-dark)' }}>TOTAL STOCK</div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: hasAlert ? 'var(--warning)' : 'var(--text-main)' }}>
                        {p.total_quantity}
                      </div>
                    </div>
                    
                    <button 
                      type="button" 
                      className="btn btn-secondary" 
                      onClick={() => { setCatalogViewMode('list'); setSearch(p.name); }}
                      style={{ padding: '6px 12px', fontSize: '11px', minHeight: '32px' }}
                    >
                      View Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {products.map(p => (
            <div key={p.id} style={{ border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px', background: 'rgba(255,255,255,0.01)' }}>
              <div className="flex-between" style={{ marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {p.primary_image_url ? (
                    <img 
                      src={p.primary_image_url} 
                      alt={p.name} 
                      style={{ width: '40px', height: '40px', borderRadius: '8px', objectFit: 'cover', border: '1px solid var(--border-color)' }}
                    />
                  ) : (
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)' }}>
                      <Package size={20} className="text-muted" style={{ opacity: 0.7 }} />
                    </div>
                  )}
                  <div>
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '700' }}>{p.name}</h4>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Category: {p.category}</span>
                  </div>
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
                    if (isAlertsOnly && !isLow) return null; // skip healthy items in Alerts view
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

  // 3. POS Billing Tab
  const renderPOS = () => (
    <div className="pos-container">
      {/* Left: Product selection */}
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
          {getFlatVariants()
            .filter(v => v.productName.toLowerCase().includes(posSearch.toLowerCase()) || v.sku.toLowerCase().includes(posSearch.toLowerCase()))
            .slice(0, 12).map(v => {
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

      {/* Right: Cart checkout */}
      <div className="glass-card">
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

  // 4. Purchase Orders (PO) Tab View
  const renderPurchaseOrders = () => {
    const filteredPOs = purchaseOrders.filter(po => {
      if (poFilterStatus === 'ALL') return true;
      return po.status === poFilterStatus;
    });

    const renderKanbanBoard = () => {
      const statuses = [
        { key: 'DRAFT', title: 'Draft' },
        { key: 'PENDING', title: 'Ordered (Pending)' },
        { key: 'RECEIVED', title: 'Received' }
      ];
      
      return (
        <div className="kanban-board">
          {statuses.map(col => {
            const colPOs = purchaseOrders.filter(po => po.status === col.key);
            return (
              <div key={col.key} className="kanban-column">
                <div className="kanban-column-header">
                  <span className="kanban-column-title">{col.title}</span>
                  <span className="kanban-column-count">{colPOs.length}</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', overflowY: 'auto', flexGrow: 1, maxHeight: '500px', padding: '2px' }}>
                  {colPOs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', fontSize: '11px', color: 'var(--text-dark)' }}>
                      No orders
                    </div>
                  ) : (
                    colPOs.map(po => (
                      <div key={po.id} className="kanban-card">
                        <div className="flex-between">
                          <span style={{ fontWeight: 'bold', fontSize: '12px', fontFamily: 'monospace' }}>#{po.id.substring(0, 8)}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{new Date(po.created_at).toLocaleDateString()}</span>
                        </div>
                        
                        <div style={{ fontSize: '12px', fontWeight: 600 }}>{po.supplier_name || 'N/A'}</div>
                        
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {po.items ? po.items.length : 0} items • ₹{Number(po.total_amount).toFixed(2)}
                        </div>

                        {(() => {
                          const totalOrdered = po.items ? po.items.reduce((acc, curr) => acc + (curr.quantity_ordered || 0), 0) : 0;
                          const totalReceived = po.items ? po.items.reduce((acc, curr) => acc + (curr.quantity_received || 0), 0) : 0;
                          const progressPct = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 0;
                          return (
                            <div style={{ marginTop: '4px' }}>
                              <div className="flex-between" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                <span>Fulfillment</span>
                                <span>{progressPct}% ({totalReceived}/{totalOrdered})</span>
                              </div>
                              <div style={{ width: '100%', height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                                <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct === 100 ? 'var(--success)' : 'var(--primary)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
                              </div>
                            </div>
                          );
                        })()}
                        
                        {po.status === 'DRAFT' && (
                          <button 
                            className="btn btn-secondary" 
                            onClick={() => handlePOStatusUpdate(po.id, 'PENDING')} 
                            style={{ padding: '6px', fontSize: '11px', width: '100%', minHeight: '32px' }}
                          >
                            Mark Ordered
                          </button>
                        )}
                        {po.status === 'PENDING' && (
                          <button 
                            className="btn btn-primary" 
                            onClick={() => handlePOStatusUpdate(po.id, 'RECEIVED')} 
                            style={{ padding: '6px', fontSize: '11px', width: '100%', minHeight: '32px', background: 'var(--success)' }}
                          >
                            Receive Items
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    };

    return (
      <section className="glass-card">
        {/* Header and Create Button */}
        <div className="flex-between" style={{ marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Truck className="text-primary" size={22} /> Purchase Orders (PO)
          </h3>
          <button className="btn btn-primary" onClick={() => setAddPoOpen(true)} style={{ gap: '6px' }}>
            <Plus size={16} /> Create Purchase Order
          </button>
        </div>

        {/* Filters Panel */}
        <div style={{ marginBottom: '20px' }}>
          {/* Desktop Filter Pills (>= 640px) */}
          <div className="variant-matrix-table-view" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              {['ALL', 'DRAFT', 'PENDING', 'RECEIVED'].map(status => (
                <button
                  key={status}
                  className={`btn ${poFilterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPoFilterStatus(status)}
                  style={{ padding: '6px 14px', fontSize: '12px', minHeight: '32px', height: '32px' }}
                >
                  {status}
                </button>
              ))}
            </div>
            
            <div style={{ display: 'flex', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button 
                type="button"
                className={`btn ${poViewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setPoViewMode('list')}
                style={{ padding: '4px 12px', fontSize: '11px', minHeight: '28px', height: '28px', border: 'none' }}
              >
                List View
              </button>
              <button 
                type="button"
                className={`btn ${poViewMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setPoViewMode('kanban')}
                style={{ padding: '4px 12px', fontSize: '11px', minHeight: '28px', height: '28px', border: 'none' }}
              >
                Kanban Board
              </button>
            </div>
          </div>

          {/* Mobile Filter Button (< 640px) */}
          <div className="variant-matrix-card-view" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button 
              className="btn btn-secondary" 
              onClick={() => setPoMobileFilterOpen(true)}
              style={{ width: '100%', minHeight: '44px', display: 'flex', justifyContent: 'space-between', padding: '0 16px' }}
            >
              <span>Status Filter: <strong>{poFilterStatus}</strong></span>
              <ArrowUpDown size={16} />
            </button>
            
            <div style={{ display: 'flex', width: '100%', gap: '4px', background: 'rgba(255,255,255,0.02)', padding: '2px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <button 
                type="button"
                className={`btn ${poViewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setPoViewMode('list')}
                style={{ flexGrow: 1, padding: '8px', fontSize: '12px', minHeight: '36px', border: 'none' }}
              >
                List View
              </button>
              <button 
                type="button"
                className={`btn ${poViewMode === 'kanban' ? 'btn-primary' : 'btn-secondary'}`} 
                onClick={() => setPoViewMode('kanban')}
                style={{ flexGrow: 1, padding: '8px', fontSize: '12px', minHeight: '36px', border: 'none' }}
              >
                Kanban Board
              </button>
            </div>
          </div>
        </div>

        {/* PO List */}
        {filteredPOs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
            No purchase orders match this filter. Create a new PO or select a different filter.
          </div>
        ) : poViewMode === 'kanban' ? (
          renderKanbanBoard()
        ) : (
          <div>
            {/* Desktop Table View (>= 768px) */}
            <div className="variant-matrix-table-view" style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 8px' }}>PO NUMBER</th>
                    <th style={{ padding: '12px 8px' }}>DATE</th>
                    <th style={{ padding: '12px 8px' }}>SUPPLIER</th>
                    <th style={{ padding: '12px 8px' }}>ITEMS</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>TOTAL AMOUNT</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center' }}>STATUS</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>ACTIONS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPOs.map(po => (
                    <tr key={po.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                      <td style={{ padding: '12px 8px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                        #{po.id.substring(0, 8)}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                        {new Date(po.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        {po.supplier_name || 'N/A'}
                      </td>
                      <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                        {po.items ? po.items.length : 0} lines
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 'bold' }}>
                        ₹{Number(po.total_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        <span className={`badge ${po.status === 'RECEIVED' ? 'badge-success' : po.status === 'PENDING' ? 'badge-warning' : 'badge-secondary'}`}>
                          {po.status}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        {po.status === 'DRAFT' && (
                          <button className="btn btn-secondary" onClick={() => handlePOStatusUpdate(po.id, 'PENDING')} style={{ padding: '6px 10px', fontSize: '11px', minHeight: '28px' }}>
                            Order
                          </button>
                        )}
                        {po.status === 'PENDING' && (
                          <button className="btn btn-primary" onClick={() => handlePOStatusUpdate(po.id, 'RECEIVED')} style={{ padding: '6px 10px', fontSize: '11px', minHeight: '28px', background: 'var(--success)' }}>
                            Receive
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View (< 768px) */}
            <div className="variant-matrix-card-view" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {filteredPOs.map(po => (
                <div key={po.id} className="variant-card" style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '16px' }}>
                  <div className="flex-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', paddingBottom: '10px', marginBottom: '10px' }}>
                    <div>
                      <div style={{ fontWeight: 'bold', fontSize: '14px', fontFamily: 'monospace' }}>PO #{po.id.substring(0, 8)}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Date: {new Date(po.created_at).toLocaleDateString()}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className={`badge ${po.status === 'RECEIVED' ? 'badge-success' : po.status === 'PENDING' ? 'badge-warning' : 'badge-secondary'}`} style={{ marginRight: '8px' }}>
                        {po.status}
                      </span>
                      <span style={{ fontWeight: 'bold', fontSize: '14px' }}>₹{Number(po.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    <strong>Supplier:</strong> {po.supplier_name || 'N/A'}
                  </div>

                  <div style={{ marginBottom: '12px' }}>
                    {po.items && po.items.map(item => (
                      <div key={item.id} className="flex-between" style={{ fontSize: '12px', padding: '4px 0' }}>
                        <span>{item.product_name} ({item.product_sku})</span>
                        <span>Ordered: <strong>{item.quantity_ordered}</strong></span>
                      </div>
                    ))}
                  </div>

                  {po.status === 'DRAFT' && (
                    <button className="btn btn-secondary" onClick={() => handlePOStatusUpdate(po.id, 'PENDING')} style={{ width: '100%', minHeight: '44px' }}>
                      Mark PO as Ordered (Pending)
                    </button>
                  )}
                  {po.status === 'PENDING' && (
                    <button className="btn btn-primary" onClick={() => handlePOStatusUpdate(po.id, 'RECEIVED')} style={{ width: '100%', minHeight: '44px' }}>
                      Receive Stock Items
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Mobile Filter Sheet Modal */}
        {poMobileFilterOpen && (
          <div className="filter-sheet-backdrop" onClick={() => setPoMobileFilterOpen(false)}>
            <div className="filter-sheet" onClick={e => e.stopPropagation()}>
              <div className="flex-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
                <h4 style={{ margin: 0 }}>Filter Purchase Orders</h4>
                <button className="btn" onClick={() => setPoMobileFilterOpen(false)} style={{ padding: '4px', background: 'transparent', border: 'none' }}><X size={18} /></button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {['ALL', 'DRAFT', 'PENDING', 'RECEIVED'].map(status => (
                  <button
                    key={status}
                    className={`btn ${poFilterStatus === status ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => { setPoFilterStatus(status); setPoMobileFilterOpen(false); }}
                    style={{ width: '100%', minHeight: '44px' }}
                  >
                    {status}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </section>
    );
  };

  // 5. Analytics Tab View (Dynamic Pure SVGs)
  const renderAnalytics = () => {
    // Math helpers for SVG
    const categories = {};
    let totalVal = 0;
    products.forEach(p => {
      p.variants.forEach(v => {
        const val = (v.total_quantity || 0) * (v.cost || 0);
        categories[p.category || 'Other'] = (categories[p.category || 'Other'] || 0) + val;
        totalVal += val;
      });
    });

    const catData = Object.keys(categories).map(k => ({
      name: k,
      val: categories[k],
      pct: totalVal > 0 ? (categories[k] / totalVal) : 0
    }));

    // Horizontal bars: top 5 products by valuation
    const productValuations = [];
    products.forEach(p => {
      let prodVal = 0;
      p.variants.forEach(v => {
        prodVal += (v.total_quantity || 0) * (v.cost || 0);
      });
      productValuations.push({ name: p.name, val: prodVal });
    });
    productValuations.sort((a,b) => b.val - a.val);
    const topProducts = productValuations.slice(0, 5);
    const maxVal = topProducts.length > 0 ? Math.max(...topProducts.map(p => p.val)) : 100;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
        <div className="grid-3">
          {/* Chart 1: Donut Chart Valuation by Category */}
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <h4 style={{ alignSelf: 'flex-start', margin: '0 0 16px 0' }}>Asset Value by Category</h4>
            
            {totalVal === 0 ? (
              <div style={{ padding: '40px 0', color: 'var(--text-muted)' }}>No inventory value to graph</div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', width: '100%' }}>
                {/* SVG Donut */}
                <svg width="120" height="120" viewBox="0 0 42 42" style={{ transform: 'rotate(-90deg)' }}>
                  <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="6"></circle>
                  {(() => {
                    let accumulatedPercent = 0;
                    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                    return catData.map((cat, i) => {
                      const strokeDash = `${cat.pct * 100} ${100 - (cat.pct * 100)}`;
                      const strokeOffset = 100 - accumulatedPercent;
                      accumulatedPercent += (cat.pct * 100);
                      return (
                        <circle 
                          key={cat.name}
                          cx="21" cy="21" r="15.915" 
                          fill="transparent" 
                          stroke={colors[i % colors.length]} 
                          strokeWidth="6" 
                          strokeDasharray={strokeDash}
                          strokeDashoffset={strokeOffset}
                        />
                      );
                    });
                  })()}
                </svg>
                {/* Legend */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '11px', flexGrow: 1 }}>
                  {catData.map((cat, i) => {
                    const colors = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
                    return (
                      <div key={cat.name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: colors[i % colors.length] }}></span>
                        <span style={{ color: 'var(--text-muted)' }}>{cat.name}: <strong>{(cat.pct * 100).toFixed(0)}%</strong></span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Chart 2: Top Products by Value (Horizontal bars) */}
          <div className="glass-card" style={{ gridColumn: 'span 2' }}>
            <h4 style={{ margin: '0 0 16px 0' }}>Top 5 Valued Products (INR)</h4>
            {topProducts.length === 0 ? (
              <div style={{ padding: '40px', color: 'var(--text-muted)', textAlign: 'center' }}>Add products to view details</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {topProducts.map((p, idx) => {
                  const widthPct = Math.max(10, (p.val / maxVal) * 100);
                  const colors = ['#6366f1', '#4f46e5', '#8b5cf6', '#a855f7', '#d946ef'];
                  return (
                    <div key={p.name}>
                      <div className="flex-between" style={{ fontSize: '11px', marginBottom: '4px' }}>
                        <span style={{ fontWeight: 600 }}>{p.name}</span>
                        <span>₹{p.val.toLocaleString('en-IN')}</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', overflow: 'hidden' }}>
                        <div style={{ width: `${widthPct}%`, height: '100%', background: colors[idx % colors.length], borderRadius: '4px' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Transaction ledger stats */}
        <div className="glass-card">
          <h4 style={{ margin: '0 0 12px 0' }}>Transaction Velocity Insights</h4>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            You have processed <strong>{summary.recentMovements.length} logged stock movements</strong> across the database. 
            Of these, checkouts processed under type <code>ISSUE</code> reflect sales activity while stock receipts are tracked under <code>RECEIPT</code>.
          </p>
        </div>
      </div>
    );
  };

  // 6. Partners & Tags view (Suppliers)
  const renderPartners = () => (
    <section className="glass-card">
      <div className="flex-between" style={{ marginBottom: '20px' }}>
        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Truck className="text-primary" size={20} /> Partners & Suppliers
        </h3>
        <button className="btn btn-primary" onClick={() => setAddSupplierOpen(true)} style={{ gap: '6px' }}>
          <Plus size={16} /> Add Supplier Partner
        </button>
      </div>

      {suppliers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No supplier partners saved. Seed demo data to insert defaults.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 8px' }}>NAME</th>
                <th style={{ padding: '12px 8px' }}>COMPANY</th>
                <th style={{ padding: '12px 8px' }}>EMAIL</th>
                <th style={{ padding: '12px 8px' }}>PHONE</th>
              </tr>
            </thead>
            <tbody>
              {suppliers.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: '12px 8px' }}>{s.company || 'N/A'}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{s.email || 'N/A'}</td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{s.phone || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  // 7. Audit Logs View
  const renderAuditLogs = () => (
    <section className="glass-card">
      <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <FileText className="text-primary" size={20} /> System Audit Trail Logs
      </h3>
      {auditLogs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No system event logs recorded.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 8px' }}>DATE</th>
                <th style={{ padding: '12px 8px' }}>USER</th>
                <th style={{ padding: '12px 8px' }}>ACTION</th>
                <th style={{ padding: '12px 8px' }}>DESCRIPTION</th>
              </tr>
            </thead>
            <tbody>
              {auditLogs.map(l => (
                <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '14px 8px', color: 'var(--text-muted)' }}>
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '14px 8px', fontWeight: 500 }}>{l.user_email || 'System'}</td>
                  <td style={{ padding: '14px 8px' }}>
                    <span className="badge badge-success" style={{ background: 'rgba(99,102,241,0.08)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.1)' }}>
                      {l.action_type}
                    </span>
                  </td>
                  <td style={{ padding: '14px 8px', color: 'var(--text-muted)' }}>{l.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  // 8. Users View
  const renderUsers = () => (
    <section className="glass-card">
      <h3 style={{ margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <Users className="text-primary" size={20} /> Team Users & Roles
      </h3>
      {users.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
          No user profiles loaded.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                <th style={{ padding: '12px 8px' }}>EMAIL ADDRESS</th>
                <th style={{ padding: '12px 8px' }}>ROLE</th>
                <th style={{ padding: '12px 8px' }}>CREATED AT</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '12px 8px', fontWeight: 600 }}>{u.email}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span className={`badge ${u.role === 'admin' ? 'badge-success' : 'badge-secondary'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                    {new Date(u.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  // 9. Stock Movements Ledger View
  const renderLedger = () => (
    <section className="glass-card">
      <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <History className="text-primary" size={20} /> Stock Movement Ledger
      </h3>
      <p className="text-muted" style={{ fontSize: '13px', margin: '0 0 20px 0' }}>
        Chronological audit history of all inventory transaction modifications.
      </p>
      
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
              <th style={{ padding: '12px 8px' }}>DATE</th>
              <th style={{ padding: '12px 8px' }}>PRODUCT</th>
              <th style={{ padding: '12px 8px' }}>SKU</th>
              <th style={{ padding: '12px 8px' }}>LOCATION</th>
              <th style={{ padding: '12px 8px' }}>CHANGE</th>
              <th style={{ padding: '12px 8px' }}>REASON</th>
              <th style={{ padding: '12px 8px' }}>REFERENCE NOTE</th>
              <th style={{ padding: '12px 8px' }}>USER</th>
            </tr>
          </thead>
          <tbody>
            {ledgerMovements.length === 0 ? (
              <tr>
                <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dark)' }}>
                  No stock movements found.
                </td>
              </tr>
            ) : (
              ledgerMovements.map(m => (
                <tr key={m.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                    {new Date(m.created_at).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px 8px', fontWeight: 600 }}>
                    {m.product_name} <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({m.variant_name})</span>
                  </td>
                  <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontSize: '12px' }}>
                    {m.product_sku}
                  </td>
                  <td style={{ padding: '12px 8px' }}>{m.location_name}</td>
                  <td style={{ padding: '12px 8px' }}>
                    <span className={`badge ${m.quantity_delta > 0 ? 'badge-success' : 'badge-danger'}`} style={{ fontFamily: 'monospace' }}>
                      {m.quantity_delta > 0 ? `+${m.quantity_delta}` : m.quantity_delta}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textTransform: 'capitalize' }}>
                    <span style={{ fontSize: '12px' }}>{m.reason}</span>
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                    {m.reference_note || '-'}
                  </td>
                  <td style={{ padding: '12px 8px', color: 'var(--text-dark)' }}>
                    {m.user_email || 'System'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );

  // 10. Invoice Generator View
  const renderInvoices = () => {
    // Group movements to reconstruct POS invoices
    const salesInvoices = [];
    const groups = {};
    
    ledgerMovements.forEach(m => {
      if (m.reason === 'sold' && m.reference_note && m.reference_note.startsWith('POS Sale #')) {
        const key = m.reference_note;
        if (!groups[key]) {
          groups[key] = {
            id: m.reference_note,
            reference: m.reference_note,
            date: m.created_at,
            customerName: 'Walk-in Retail Customer',
            user: m.user_email || 'System Store Manager',
            items: [],
            tax: 18,
            discount: 0
          };
        }
        
        let unitPrice = 0;
        for (const p of products) {
          const v = p.variants ? p.variants.find(varItem => varItem.id === m.variant_id) : null;
          if (v) {
            unitPrice = v.price;
            break;
          }
        }
        
        groups[key].items.push({
          id: m.id,
          name: m.product_name + ' (' + m.variant_name + ')',
          sku: m.product_sku,
          quantity: Math.abs(m.quantity_delta),
          price: unitPrice || 0
        });
      }
    });
    
    Object.values(groups).forEach(g => salesInvoices.push(g));

    const handleAddInvoiceItem = () => {
      if (!selectedInvVariant) return;
      let foundProdName = '';
      let foundSku = '';
      let foundPrice = Number(invPrice);
      
      for (const p of products) {
        const v = p.variants ? p.variants.find(varItem => varItem.id === selectedInvVariant) : null;
        if (v) {
          foundProdName = p.name + ' (' + v.name + ')';
          foundSku = v.sku;
          if (foundPrice === 0) foundPrice = v.price;
          break;
        }
      }
      
      const newItem = {
        id: Math.random().toString(),
        variantId: selectedInvVariant,
        name: foundProdName,
        sku: foundSku,
        quantity: Number(invQty),
        price: foundPrice
      };
      
      setInvoiceCart([...invoiceCart, newItem]);
      setSelectedInvVariant('');
      setInvQty(1);
      setInvPrice(0);
    };

    const handleRemoveInvoiceItem = (idx) => {
      const updated = [...invoiceCart];
      updated.splice(idx, 1);
      setInvoiceCart(updated);
    };

    const handleGenerateCustomInvoice = (e) => {
      e.preventDefault();
      if (!invoiceCustomer || invoiceCart.length === 0) {
        showToast('Please provide a Customer Name and add at least one item.', 'error');
        return;
      }
      
      const customInv = {
        reference: invoiceNumber || 'INV-CUSTOM',
        number: invoiceNumber,
        date: invoiceDate || new Date().toISOString().substring(0, 10),
        customerName: invoiceCustomer,
        tax: Number(invoiceTax),
        discount: Number(invoiceDiscount),
        items: invoiceCart
      };
      
      setShowInvoicePrint(customInv);
      // Reset custom form after generation
      setInvoiceCart([]);
      setInvoiceCustomer('');
      setInvoiceNumber('INV-' + Math.floor(100000 + Math.random() * 900000));
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            type="button"
            className={`btn ${invoiceTab === 'sales' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setInvoiceTab('sales')}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            POS Bills & Receipts
          </button>
          <button 
            type="button"
            className={`btn ${invoiceTab === 'custom' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => {
              setInvoiceTab('custom');
              if (!invoiceNumber) {
                setInvoiceNumber('INV-' + Math.floor(100000 + Math.random() * 900000));
              }
            }}
            style={{ padding: '8px 16px', fontSize: '13px' }}
          >
            Create Custom Invoice
          </button>
        </div>

        {invoiceTab === 'sales' ? (
          <section className="glass-card">
            <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt className="text-primary" size={20} /> POS Sales Receipts
            </h3>
            <p className="text-muted" style={{ fontSize: '13px', margin: '0 0 20px 0' }}>
              Reconstruct and print formal invoices from previous POS register checkouts.
            </p>
            
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-muted)' }}>
                    <th style={{ padding: '12px 8px' }}>BILL ID / REF</th>
                    <th style={{ padding: '12px 8px' }}>DATE</th>
                    <th style={{ padding: '12px 8px' }}>CUSTOMER</th>
                    <th style={{ padding: '12px 8px' }}>ITEMS COUNT</th>
                    <th style={{ padding: '12px 8px' }}>TOTAL VALUE</th>
                    <th style={{ padding: '12px 8px' }}>PROCESSOR</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {salesInvoices.length === 0 ? (
                    <tr>
                      <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                        No POS sales recorded. Complete a POS Checkout to print receipts.
                      </td>
                    </tr>
                  ) : (
                    salesInvoices.map(inv => {
                      const sub = inv.items.reduce((a, c) => a + (c.quantity * c.price), 0);
                      const taxAmt = Math.round(sub * (inv.tax / 100));
                      const grandTotal = sub + taxAmt;
                      return (
                        <tr key={inv.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '12px 8px', fontWeight: 'bold', fontFamily: 'monospace' }}>
                            {inv.reference.replace('POS Sale #', '')}
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>
                            {new Date(inv.date).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 8px' }}>{inv.customerName}</td>
                          <td style={{ padding: '12px 8px' }}>{inv.items.length} items</td>
                          <td style={{ padding: '12px 8px', fontWeight: 'bold' }}>
                            ₹{grandTotal.toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-dark)' }}>{inv.user}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            <button 
                              className="btn btn-secondary" 
                              onClick={() => setShowInvoicePrint(inv)}
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                            >
                              Print / View Invoice
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="glass-card" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px' }}>
            <form onSubmit={handleGenerateCustomInvoice} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: '0 0 10px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus className="text-primary" size={20} /> New Invoice Details
              </h3>
              
              <div>
                <label>Invoice Number</label>
                <input 
                  type="text" 
                  value={invoiceNumber} 
                  onChange={e => setInvoiceNumber(e.target.value)} 
                  required 
                />
              </div>

              <div>
                <label>Customer Name</label>
                <input 
                  type="text" 
                  value={invoiceCustomer} 
                  onChange={e => setInvoiceCustomer(e.target.value)} 
                  placeholder="e.g. John Doe / Alpha Corp"
                  required 
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label>Invoice Date</label>
                  <input 
                    type="date" 
                    value={invoiceDate} 
                    onChange={e => setInvoiceDate(e.target.value)} 
                    required 
                  />
                </div>
                <div>
                  <label>Tax Rate (GST %)</label>
                  <input 
                    type="number" 
                    value={invoiceTax} 
                    onChange={e => setInvoiceTax(e.target.value)} 
                    min="0"
                    max="100"
                    required 
                  />
                </div>
              </div>

              <div>
                <label>Flat Discount (INR ₹)</label>
                <input 
                  type="number" 
                  value={invoiceDiscount} 
                  onChange={e => setInvoiceDiscount(Number(e.target.value))} 
                  min="0"
                />
              </div>

              <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }}>
                Compile & Preview Invoice
              </button>
            </form>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ margin: '0 0 10px 0' }}>Add Invoice Line Items</h3>
              
              <div style={{ background: 'rgba(255,255,255,0.02)', padding: '16px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label>Select Catalog Item</label>
                  <select 
                    value={selectedInvVariant} 
                    onChange={e => {
                      const vId = e.target.value;
                      setSelectedInvVariant(vId);
                      // Auto-fill price
                      for (const p of products) {
                        const v = p.variants ? p.variants.find(varItem => varItem.id === vId) : null;
                        if (v) {
                          setInvPrice(v.price);
                          break;
                        }
                      }
                    }}
                  >
                    <option value="">-- Choose Variant --</option>
                    {products.map(p => (
                      <optgroup key={p.id} label={p.name}>
                        {p.variants && p.variants.map(v => (
                          <option key={v.id} value={v.id}>
                            {v.name} ({v.sku} - Stock: {v.stock_levels ? v.stock_levels.reduce((acc, curr) => acc + curr.quantity, 0) : 0})
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label>Quantity</label>
                    <input 
                      type="number" 
                      value={invQty} 
                      onChange={e => setInvQty(Math.max(1, Number(e.target.value)))} 
                      min="1" 
                    />
                  </div>
                  <div>
                    <label>Unit Price (INR ₹)</label>
                    <input 
                      type="number" 
                      value={invPrice} 
                      onChange={e => setInvPrice(Number(e.target.value))} 
                      min="0" 
                    />
                  </div>
                </div>

                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={handleAddInvoiceItem}
                  disabled={!selectedInvVariant}
                  style={{ alignSelf: 'flex-end', padding: '8px 16px', fontSize: '13px' }}
                >
                  + Add Item to Cart
                </button>
              </div>

              <div>
                <h4 style={{ margin: '12px 0 8px 0' }}>Current Invoice Cart ({invoiceCart.length})</h4>
                <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '10px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.02)', color: 'var(--text-muted)' }}>
                        <th style={{ padding: '8px' }}>ITEM</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>QTY</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>PRICE</th>
                        <th style={{ padding: '8px', textAlign: 'right' }}>ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceCart.length === 0 ? (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-dark)' }}>
                            Cart is empty.
                          </td>
                        </tr>
                      ) : (
                        invoiceCart.map((item, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.01)' }}>
                            <td style={{ padding: '8px', fontWeight: 500 }}>{item.name}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>{item.quantity}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>₹{item.price.toLocaleString()}</td>
                            <td style={{ padding: '8px', textAlign: 'right' }}>
                              <button 
                                type="button" 
                                className="btn-icon" 
                                onClick={() => handleRemoveInvoiceItem(idx)}
                                style={{ background: 'transparent', border: 'none', padding: 0 }}
                              >
                                <Trash2 size={14} className="text-danger" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </section>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Background Glow Blobs for Glassmorphism */}
      <div className="bg-glow-blob blob-indigo"></div>
      <div className="bg-glow-blob blob-purple"></div>
      <div className="bg-glow-blob blob-emerald"></div>
      <div className="app-layout">
      {/* Sidebar navigation panel */}
      <aside className="sidebar">
        <div>
          <div className="sidebar-logo">
            <Package className="text-primary" size={28} />
            <span className="sidebar-logo-text" style={{ fontSize: '18px', fontWeight: 'bold' }}>Stockwise HQ</span>
          </div>
          <div className="sidebar-menu">
            <div className="sidebar-section-title">Operations</div>
            <button className={`sidebar-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}>
              <LayoutDashboard size={18} /> 
              <span className="sidebar-text">Dashboard</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => navigate('pos')}>
              <ShoppingBag size={18} /> 
              <span className="sidebar-text">POS Billing</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => navigate('invoices')}>
              <Receipt size={18} /> 
              <span className="sidebar-text">Invoices</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'po' ? 'active' : ''}`} onClick={() => navigate('po')}>
              <Truck size={18} /> 
              <span className="sidebar-text">Purchase Orders</span>
            </button>

            <div className="sidebar-section-title">Catalog</div>
            <button className={`sidebar-item ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => navigate('catalog')}>
              <Package size={18} /> 
              <span className="sidebar-text">Products Catalog</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'partners' ? 'active' : ''}`} onClick={() => navigate('partners')}>
              <Users2 size={18} /> 
              <span className="sidebar-text">Partners & Tags</span>
            </button>

            <div className="sidebar-section-title">Records</div>
            <button className={`sidebar-item ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => navigate('ledger')}>
              <History size={18} /> 
              <span className="sidebar-text">Ledger Logs</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => navigate('alerts')}>
              <ShieldAlert size={18} /> 
              <span className="sidebar-text">Stock Alerts</span>
              {summary.lowStockCount > 0 ? (
                <span className="badge badge-danger" style={{ marginLeft: 'auto', borderRadius: '50%', padding: '2px 6px', fontSize: '9px' }}>
                  {summary.lowStockCount}
                </span>
              ) : null}
            </button>
            <button className={`sidebar-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => navigate('audit')}>
              <FileText size={18} /> 
              <span className="sidebar-text">Audit Logs</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => navigate('analytics')}>
              <TrendingUp size={18} /> 
              <span className="sidebar-text">Analytics</span>
            </button>

            <div className="sidebar-section-title">Admin</div>
            <button className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => navigate('users')}>
              <Users size={18} /> 
              <span className="sidebar-text">Users & Roles</span>
            </button>
            <button className={`sidebar-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}>
              <Settings size={18} /> 
              <span className="sidebar-text">Settings</span>
            </button>
          </div>
        </div>

        {/* Reset button */}
        <div style={{ borderTop: '1px solid var(--border-color)', marginTop: 'auto', paddingTop: '12px' }}>
          <button 
            className="sidebar-item" 
            onClick={() => setShowResetConfirm(true)}
            style={{ color: 'var(--danger)', gap: '12px' }}
          >
            <RefreshCw size={18} /> 
            <span className="sidebar-text">Reset Demo Data</span>
          </button>
        </div>
      </aside>

      {/* Main panel view displayer */}
      <main className="main-content">
        <header className="app-header flex-between" style={{ marginBottom: '32px' }}>
          <h2 style={{ margin: 0, textTransform: 'capitalize', fontFamily: 'Outfit' }}>
            {activeTab === 'pos' ? 'POS Billing Checkout' : activeTab === 'invoices' ? 'Invoice Management & Generator' : activeTab === 'po' ? 'Purchase Orders' : activeTab === 'alerts' ? 'Active Stock Alerts' : activeTab === 'partners' ? 'Partners & Suppliers' : activeTab === 'audit' ? 'System Audit logs' : `${activeTab} view`}
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
        {activeTab === 'catalog' && renderCatalog(false)}
        {activeTab === 'pos' && renderPOS()}
        {activeTab === 'po' && renderPurchaseOrders()}
        {activeTab === 'ledger' && renderLedger()}
        {activeTab === 'invoices' && renderInvoices()}
        {activeTab === 'alerts' && renderCatalog(true)}
        {activeTab === 'analytics' && renderAnalytics()}
        {activeTab === 'partners' && renderPartners()}
        {activeTab === 'audit' && renderAuditLogs()}
        {activeTab === 'users' && renderUsers()}
        {activeTab === 'settings' && saveSettings && (
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
                <button type="button" className="btn btn-secondary" onClick={triggerShopifySync} disabled={syncingShopify} style={{ marginRight: 'auto' }}>
                  Sync Shopify Catalog
                </button>
                <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px' }}>
                  Save Configurations
                </button>
              </div>
            </form>
          </div>
        )}
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
          onAISnap={() => {}} 
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

      {/* Stock Adjust Modal */}
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
              This will truncate all active products, variants, stock levels, suppliers, purchase orders, and system logs. The database will be seeded with standard demo inventory.
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

      {/* Add Partner (Supplier) Modal */}
      {addSupplierOpen ? (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '450px' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3>Add Supplier Partner</h3>
              <button className="btn btn-secondary" onClick={() => setAddSupplierOpen(false)} style={{ padding: '8px' }}><X size={18} /></button>
            </div>
            <form onSubmit={handleCreateSupplier}>
              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="sup-name">Supplier Contact Name *</label>
                <input id="sup-name" type="text" value={supplierName} onChange={e => setSupplierName(e.target.value)} required placeholder="e.g. John Doe" />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="sup-comp">Company Name</label>
                <input id="sup-comp" type="text" value={supplierCompany} onChange={e => setSupplierCompany(e.target.value)} placeholder="e.g. Apex Suppliers Ltd" />
              </div>
              <div style={{ marginBottom: '12px' }}>
                <label htmlFor="sup-email">Email Address</label>
                <input id="sup-email" type="email" value={supplierEmail} onChange={e => setSupplierEmail(e.target.value)} placeholder="name@company.com" />
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="sup-phone">Phone Number</label>
                <input id="sup-phone" type="text" value={supplierPhone} onChange={e => setSupplierPhone(e.target.value)} placeholder="+91 98765..." />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddSupplierOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Supplier</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Add Purchase Order Modal */}
      {addPoOpen ? (
        <div className="modal-backdrop">
          <div className="modal-content glass-card" style={{ maxWidth: '600px' }}>
            <div className="flex-between" style={{ marginBottom: '16px' }}>
              <h3>Create Purchase Order</h3>
              <button className="btn btn-secondary" onClick={() => setAddPoOpen(false)} style={{ padding: '8px' }}><X size={18} /></button>
            </div>
            
            <form onSubmit={handleCreatePO}>
              <div style={{ marginBottom: '16px' }}>
                <label htmlFor="po-sup">Select Supplier Partner</label>
                <select id="po-sup" value={poSupplierId} onChange={e => setPoSupplierId(e.target.value)} required>
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.company || 'Private'})</option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label>Order Items</label>
                {poItems.map((item, idx) => (
                  <div key={idx} style={{ display: 'flex', gap: '8px', marginBottom: '8px', alignItems: 'center' }}>
                    <select 
                      value={item.variantId} 
                      onChange={e => {
                        const updated = [...poItems];
                        updated[idx].variantId = e.target.value;
                        // Pre-populate standard cost if available
                        const matched = getFlatVariants().find(v => v.id === e.target.value);
                        if (matched) updated[idx].cost = matched.cost || 100;
                        setPoItems(updated);
                      }}
                      style={{ width: '50%' }}
                      required
                    >
                      <option value="">-- Select Product Variant --</option>
                      {getFlatVariants().map(v => (
                        <option key={v.id} value={v.id}>{v.productName} - {v.name} ({v.sku})</option>
                      ))}
                    </select>
                    
                    <input 
                      type="number" 
                      placeholder="Qty" 
                      value={item.quantityOrdered} 
                      onChange={e => {
                        const updated = [...poItems];
                        updated[idx].quantityOrdered = parseInt(e.target.value) || 0;
                        setPoItems(updated);
                      }}
                      style={{ width: '20%' }}
                      min="1"
                      required
                    />
                    
                    <input 
                      type="number" 
                      placeholder="Cost" 
                      value={item.cost} 
                      onChange={e => {
                        const updated = [...poItems];
                        updated[idx].cost = parseFloat(e.target.value) || 0;
                        setPoItems(updated);
                      }}
                      style={{ width: '25%' }}
                      min="0.01"
                      step="0.01"
                      required
                    />

                    <button 
                      type="button" 
                      className="btn" 
                      onClick={() => setPoItems(poItems.filter((_, i) => i !== idx))}
                      disabled={poItems.length === 1}
                      style={{ padding: '6px', background: 'transparent', border: 'none' }}
                    >
                      <Trash2 size={16} className="text-danger" />
                    </button>
                  </div>
                ))}
                
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setPoItems([...poItems, { variantId: '', quantityOrdered: 5, cost: 100 }])}
                  style={{ padding: '6px 12px', fontSize: '12px', marginTop: '6px' }}
                >
                  + Add Item Row
                </button>
              </div>

              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setAddPoOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create PO Draft</button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {showInvoicePrint && (
        <div className="modal-backdrop" onClick={() => setShowInvoicePrint(null)}>
          <div className="glass-card print-invoice-card" onClick={e => e.stopPropagation()} style={{ background: '#fff', color: '#000', maxWidth: '800px', width: '100%', padding: '40px', borderRadius: '12px', boxShadow: '0 20px 50px rgba(0,0,0,0.3)', border: 'none' }}>
            
            {/* Printable Area */}
            <div id="printable-invoice-area" style={{ fontFamily: 'Arial, sans-serif' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #eaeaea', paddingBottom: '20px', marginBottom: '20px' }}>
                <div>
                  <h2 style={{ margin: 0, fontWeight: 'bold', color: '#111' }}>INVOICE</h2>
                  <span style={{ color: '#777', fontSize: '14px' }}>{showInvoicePrint.reference || 'Custom Invoice'}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <h3 style={{ margin: 0, color: 'var(--primary)', fontWeight: 'bold' }}>Stockwise HQ</h3>
                  <span style={{ color: '#777', fontSize: '13px' }}>Primary Warehouse Hub</span>
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
                <div>
                  <strong style={{ color: '#555' }}>Billed To:</strong>
                  <div style={{ fontSize: '15px', marginTop: '6px', fontWeight: 'bold' }}>{showInvoicePrint.customerName || 'Walk-in Retail Customer'}</div>
                  <div style={{ color: '#777', fontSize: '13px', marginTop: '4px' }}>Date: {new Date(showInvoicePrint.date).toLocaleDateString()}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <strong style={{ color: '#555' }}>Invoice Details:</strong>
                  <div style={{ fontSize: '13px', color: '#777', marginTop: '6px' }}>Invoice No: {showInvoicePrint.reference ? showInvoicePrint.reference.replace('POS Sale #', '') : showInvoicePrint.number}</div>
                  <div style={{ fontSize: '13px', color: '#777', marginTop: '4px' }}>Status: PAID</div>
                </div>
              </div>
              
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #eaeaea', textAlign: 'left' }}>
                    <th style={{ padding: '10px 0', color: '#555' }}>Item Details</th>
                    <th style={{ padding: '10px 0', color: '#555' }}>SKU</th>
                    <th style={{ padding: '10px 0', textAlign: 'right', color: '#555' }}>Qty</th>
                    <th style={{ padding: '10px 0', textAlign: 'right', color: '#555' }}>Unit Price</th>
                    <th style={{ padding: '10px 0', textAlign: 'right', color: '#555' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {showInvoicePrint.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f2f2f2' }}>
                      <td style={{ padding: '12px 0', fontWeight: '500' }}>{item.name}</td>
                      <td style={{ padding: '12px 0', fontFamily: 'monospace', color: '#666' }}>{item.sku}</td>
                      <td style={{ padding: '12px 0', textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '12px 0', textAlign: 'right' }}>₹{item.price.toLocaleString()}</td>
                      <td style={{ padding: '12px 0', textAlign: 'right', fontWeight: '600' }}>₹{(item.quantity * item.price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '250px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px', color: '#666' }}>
                    <span>Subtotal:</span>
                    <span>₹{showInvoicePrint.items.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0).toLocaleString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px', color: '#666' }}>
                    <span>Tax ({showInvoicePrint.tax}%):</span>
                    <span>₹{Math.round(showInvoicePrint.items.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0) * (showInvoicePrint.tax / 100)).toLocaleString()}</span>
                  </div>
                  {showInvoicePrint.discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', fontSize: '14px', color: '#e53e3e' }}>
                      <span>Discount:</span>
                      <span>-₹{showInvoicePrint.discount.toLocaleString()}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid #eaeaea', marginTop: '6px', fontSize: '16px', fontWeight: 'bold', color: '#111' }}>
                    <span>Total Amount:</span>
                    <span>₹{Math.round(showInvoicePrint.items.reduce((acc, curr) => acc + (curr.quantity * curr.price), 0) * (1 + showInvoicePrint.tax / 100) - (showInvoicePrint.discount || 0)).toLocaleString()}</span>
                  </div>
                </div>
              </div>
              
              <div style={{ borderTop: '1px solid #eaeaea', marginTop: '40px', paddingTop: '20px', textAlign: 'center', color: '#888', fontSize: '12px' }}>
                Thank you for shopping at Stockwise HQ! For any queries, contact support@stockwise.local.
              </div>
            </div>
            
            {/* Buttons */}
            <div className="no-print" style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '30px' }}>
              <button type="button" className="btn btn-secondary" onClick={() => setShowInvoicePrint(null)}>Close Preview</button>
              <button type="button" className="btn btn-primary" onClick={() => window.print()}>Print Invoice</button>
            </div>
          </div>
        </div>
      )}
      {/* Mobile Bottom Navigation Bar */}
      <nav className="mobile-bottom-nav">
        <button className={`mobile-bottom-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`} onClick={() => navigate('dashboard')}>
          <LayoutDashboard size={20} />
          <span>Dashboard</span>
        </button>
        <button className={`mobile-bottom-nav-item ${activeTab === 'catalog' ? 'active' : ''}`} onClick={() => navigate('catalog')}>
          <Package size={20} />
          <span>Catalog</span>
        </button>
        <button className={`mobile-bottom-nav-item ${activeTab === 'pos' ? 'active' : ''}`} onClick={() => navigate('pos')}>
          <ShoppingBag size={20} />
          <span>POS</span>
        </button>
        <button className={`mobile-bottom-nav-item ${activeTab === 'invoices' ? 'active' : ''}`} onClick={() => navigate('invoices')}>
          <Receipt size={20} />
          <span>Invoices</span>
        </button>
        <button className={`mobile-bottom-nav-item ${moreMenuOpen ? 'active' : ''}`} onClick={() => setMoreMenuOpen(!moreMenuOpen)}>
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>

      {/* Mobile More Navigation Drawer (Slide up sheet) */}
      {moreMenuOpen && (
        <div className="filter-sheet-backdrop" onClick={() => setMoreMenuOpen(false)} style={{ zIndex: 1004 }}>
          <div className="mobile-more-drawer open" onClick={e => e.stopPropagation()}>
            <div className="mobile-more-drawer-header">
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold' }}>All Navigation Tabs</h3>
              <button className="btn" onClick={() => setMoreMenuOpen(false)} style={{ padding: '4px', background: 'transparent', border: 'none' }}>
                <X size={18} />
              </button>
            </div>
            <div className="mobile-more-drawer-body">
              <button className={`mobile-more-drawer-item ${activeTab === 'po' ? 'active' : ''}`} onClick={() => navigate('po')}>
                <Truck size={18} />
                <span>Purchase Orders</span>
              </button>
              <button className={`mobile-more-drawer-item ${activeTab === 'ledger' ? 'active' : ''}`} onClick={() => navigate('ledger')}>
                <History size={18} />
                <span>Ledger Logs</span>
              </button>
              <button className={`mobile-more-drawer-item ${activeTab === 'alerts' ? 'active' : ''}`} onClick={() => navigate('alerts')}>
                <ShieldAlert size={18} />
                <span>Stock Alerts</span>
              </button>
              <button className={`mobile-more-drawer-item ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => navigate('analytics')}>
                <TrendingUp size={18} />
                <span>Analytics Stats</span>
              </button>
              <button className={`mobile-more-drawer-item ${activeTab === 'partners' ? 'active' : ''}`} onClick={() => navigate('partners')}>
                <Users2 size={18} />
                <span>Partners & Suppliers</span>
              </button>
              <button className={`mobile-more-drawer-item ${activeTab === 'audit' ? 'active' : ''}`} onClick={() => navigate('audit')}>
                <FileText size={18} />
                <span>Audit Logs</span>
              </button>
              <button className={`mobile-more-drawer-item ${activeTab === 'users' ? 'active' : ''}`} onClick={() => navigate('users')}>
                <Users size={18} />
                <span>Users & Roles</span>
              </button>
              <button className={`mobile-more-drawer-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}>
                <Settings size={18} />
                <span>Settings & Keys</span>
              </button>
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', margin: '8px 0', paddingTop: '8px' }}>
                <button 
                  className="mobile-more-drawer-item" 
                  onClick={() => { setMoreMenuOpen(false); setShowResetConfirm(true); }}
                  style={{ color: 'var(--danger)' }}
                >
                  <RefreshCw size={18} />
                  <span>Reset Demo Data</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification Container */}
      {toast && (
        <div className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            {toast.type === 'success' ? <CheckCircle size={18} className="text-success" /> : <ShieldAlert size={18} className="text-danger" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
