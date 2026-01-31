
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  PlusIcon, TrashIcon, Settings2Icon, LayoutIcon, CalculatorIcon, TagIcon, LayersIcon, 
  UsersIcon, PackageIcon, SearchIcon, Share2Icon, MessageCircleIcon, 
  Edit3Icon, XIcon, AlertTriangleIcon, 
  CloudIcon, LogOutIcon, Loader2Icon, RulerIcon, 
  SmartphoneIcon, DownloadIcon, BellIcon, CloudUploadIcon
} from 'lucide-react';
import { 
  DesignItem, CostTier, QuantityDiscount, CalculationResult, 
  Client, Category, OrderStatus, Order, NotificationSettings
} from './types';
import { packDesigns } from './utils/layout';
import { supabase } from './supabaseClient';

const MASTER_KEY = 'graficapro_enterprise_v11';

const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const toSafeUUID = (id: any) => {
  if (id === null || id === undefined || id === '') return generateUUID();
  const strId = String(id);
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(strId)) return strId;
  const numeric = strId.replace(/\D/g, '').padStart(12, '0').slice(-12);
  return `00000000-0000-0000-0000-${numeric}`;
};

const DEFAULT_CATEGORIES: Category[] = [
  { id: toSafeUUID("1"), name: 'DE STOCK', pricePerUnit: 100 },
  { id: toSafeUUID("2"), name: 'PERS. C/FONDO', pricePerUnit: 250 },
  { id: toSafeUUID("3"), name: 'PERS. S/FONDO', pricePerUnit: 200 },
  { id: toSafeUUID("4"), name: 'CARTOON C/FONDO', pricePerUnit: 400 },
  { id: toSafeUUID("5"), name: 'CARTOON S/FONDO', pricePerUnit: 350 },
  { id: toSafeUUID("6"), name: 'PLANCHA', pricePerUnit: 1500 },
];

const DEFAULT_STATUSES: OrderStatus[] = [
  { id: 'hacer', name: 'Hacer', color: 'bg-slate-400' },
  { id: 'presupuestar', name: 'Presupuestar', color: 'bg-amber-500' },
  { id: 'produccion', name: 'Producción', color: 'bg-indigo-500' },
  { id: 'entregado', name: 'Entregado', color: 'bg-emerald-500' },
];

const DEFAULT_NOTIFICATIONS: NotificationSettings = {
  newOrder: true,
  newClient: true,
  statusChange: true,
  enabled: false
};

const DEFAULT_DATA = {
  sheetWidth: 58,
  profitMargin: 100,
  designSpacing: 0.2,
  costTiers: [
    { id: generateUUID(), minLargo: 0, maxLargo: 20, precioPorCm: 10000 },
    { id: generateUUID(), minLargo: 20, maxLargo: 50, precioPorCm: 8000 },
    { id: generateUUID(), minLargo: 50, maxLargo: 100, precioPorCm: 6000 },
  ],
  quantityDiscounts: [] as QuantityDiscount[],
  designs: [] as DesignItem[],
  clients: [] as Client[],
  orders: [] as Order[],
  categories: DEFAULT_CATEGORIES,
  statuses: DEFAULT_STATUSES,
  notifications: DEFAULT_NOTIFICATIONS
};

type AppDataType = typeof DEFAULT_DATA;
type Tab = 'dash' | 'presupuestar' | 'pedidos' | 'clients' | 'config';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dash');
  const [appData, setAppData] = useState<AppDataType>(DEFAULT_DATA);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showSummary, setShowSummary] = useState<Order | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  const [newDesign, setNewDesign] = useState({ name: '', width: 0, height: 0, quantity: 1 });
  const [clientSearch, setClientSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<Partial<Client>>({});
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderForm, setOrderForm] = useState<Partial<Order>>({
    order_number: '', status_id: 'hacer', client_id: '', width: 0, height: 0, quantity: 1, category_id: '', deposit: 0
  });

  const ensureISO = (val: any): string => {
    if (!val) return new Date().toISOString();
    try {
      if (typeof val === 'number') return new Date(val).toISOString();
      const strVal = String(val);
      return strVal.length < 10 ? new Date().toISOString() : strVal;
    } catch {
      return new Date().toISOString();
    }
  };

  useEffect(() => {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const notify = useCallback((title: string, body: string, type: keyof NotificationSettings) => {
    if (!appData?.notifications?.enabled || !appData?.notifications?.[type]) return;
    if (Notification.permission === 'granted') {
      new Notification(title, {
        body,
        icon: 'https://cdn-icons-png.flaticon.com/512/9402/9402314.png'
      });
    }
  }, [appData?.notifications]);

  const fetchCloudData = async (userId: string) => {
    const client = supabase;
    if (!client) return;
    try {
      const [{ data: setts }, { data: cls }, { data: ords }, { data: cats }] = await Promise.all([
        client.from('settings').select('*').eq('user_id', userId).maybeSingle(),
        client.from('clients').select('*').eq('user_id', userId),
        client.from('orders').select('*').eq('user_id', userId),
        client.from('categories').select('*').eq('user_id', userId)
      ]);
      setAppData(prev => ({
        ...prev,
        sheetWidth: Number(setts?.sheet_width) || prev.sheetWidth,
        profitMargin: Number(setts?.profit_margin) || prev.profitMargin,
        designSpacing: Number(setts?.design_spacing) || prev.designSpacing,
        clients: (cls && cls.length > 0) ? cls : prev.clients,
        orders: (ords && ords.length > 0) ? ords : prev.orders,
        categories: (cats && cats.length > 0) ? cats.map((c: any) => ({ ...c, id: toSafeUUID(c.id), pricePerUnit: c.price_per_unit || c.pricePerUnit })) : prev.categories
      }));
    } catch (e) { }
  };

  useEffect(() => {
    const client = supabase;
    if (!client || !session?.user) return;

    const channel = client
      .channel('schema-db-changes')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.new.user_id === session.user.id) {
          const clientFound = (appData.clients || []).find(c => c && c.id === payload.new.client_id);
          notify('🔥 Nuevo Pedido', `Pedido #${payload.new.order_number} de ${clientFound?.name || 'Cliente'}`, 'newOrder');
          fetchCloudData(session.user.id);
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.new.user_id === session.user.id && payload.old.status_id !== payload.new.status_id) {
          const status = (appData.statuses || []).find(s => s && s.id === payload.new.status_id);
          notify('🔄 Cambio de Estado', `Pedido #${payload.new.order_number}: ${status?.name}`, 'statusChange');
          fetchCloudData(session.user.id);
        }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'clients' }, (payload) => {
        if (payload.new.user_id === session.user.id) {
          notify('👤 Nuevo Cliente', `${payload.new.name} agregado.`, 'newClient');
          fetchCloudData(session.user.id);
        }
      })
      .subscribe();

    return () => { client.removeChannel(channel); };
  }, [session, appData.clients, appData.statuses, notify]);

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem(MASTER_KEY);
      if (saved) {
        try {
          let parsed = JSON.parse(saved);
          if (parsed.clients) parsed.clients = parsed.clients.map((c: any) => ({ ...c, id: toSafeUUID(c.id), created_at: ensureISO(c.created_at) }));
          if (parsed.orders) parsed.orders = parsed.orders.map((o: any) => ({ ...o, id: toSafeUUID(o.id), client_id: toSafeUUID(o.client_id), category_id: toSafeUUID(o.category_id), created_at: ensureISO(o.created_at) }));
          if (parsed.categories) parsed.categories = parsed.categories.map((cat: any) => ({ ...cat, id: toSafeUUID(cat.id) }));
          setAppData(prev => ({ ...prev, ...parsed, notifications: parsed.notifications || DEFAULT_NOTIFICATIONS }));
        } catch (e) { }
      }
      const client = supabase;
      if (client) {
        try {
          const { data: { session: cur } } = await client.auth.getSession();
          setSession(cur);
          if (cur?.user) await fetchCloudData(cur.user.id);
        } catch (e) { }
      }
      setLoading(false);
    };
    init();
  }, []);

  const pushLocalDataToCloud = async () => {
    const client = supabase;
    if (!client || !session?.user) return;
    setIsMigrating(true);
    try {
      if (appData.categories.length > 0) {
        const catsToUpload = appData.categories.map(cat => ({
          id: toSafeUUID(cat.id), name: cat.name, price_per_unit: cat.pricePerUnit, user_id: session.user.id
        }));
        await client.from('categories').upsert(catsToUpload);
      }
      if (appData.clients.length > 0) {
        const clsToUpload = appData.clients.map(c => ({
          id: toSafeUUID(c.id), name: c.name, phone: c.phone, address: c.address, created_at: ensureISO(c.created_at), user_id: session.user.id
        }));
        await client.from('clients').upsert(clsToUpload);
      }
      if (appData.orders.length > 0) {
        const ordsToUpload = appData.orders.map(o => ({
          id: toSafeUUID(o.id), order_number: o.order_number, client_id: toSafeUUID(o.client_id), category_id: toSafeUUID(o.category_id),
          width: o.width, height: o.height, quantity: o.quantity, total_price: o.total_price, deposit: o.deposit, balance: o.balance,
          status_id: o.status_id, created_at: ensureISO(o.created_at), user_id: session.user.id
        }));
        await client.from('orders').upsert(ordsToUpload);
      }
      await client.from('settings').upsert({
        user_id: session.user.id, sheet_width: appData.sheetWidth, profit_margin: appData.profitMargin, design_spacing: appData.designSpacing, updated_at: new Date().toISOString()
      });
      alert("✅ Datos sincronizados.");
      await fetchCloudData(session.user.id);
    } catch (err: any) {
      alert("❌ Error: " + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    const client = supabase;
    if (!client) return;
    setAuthLoading(true);
    try {
      const { error } = await client.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) {
        const { error: sError } = await client.auth.signUp({ email: authEmail, password: authPassword });
        if (sError) throw sError;
      }
      setIsAuthModalOpen(false);
    } catch (err: any) { alert(err.message); } finally { setAuthLoading(false); }
  };

  useEffect(() => {
    if (loading) return;
    localStorage.setItem(MASTER_KEY, JSON.stringify(appData));
  }, [appData, loading]);

  const updateData = (field: keyof AppDataType, value: any) => {
    setAppData(prev => ({ ...prev, [field]: value }));
  };

  const packResult = useMemo(() => packDesigns(appData.designs || [], appData.sheetWidth || 58, appData.designSpacing || 0.2), [appData.designs, appData.sheetWidth, appData.designSpacing]);
  
  const currentPricePerCm = useMemo(() => {
    const l = packResult.totalLength;
    const tiers = Array.isArray(appData.costTiers) ? appData.costTiers : [];
    const tier = tiers.find((t: CostTier) => l >= t.minLargo && l < t.maxLargo);
    return tier ? tier.precioPorCm : (tiers[tiers.length - 1]?.precioPorCm || 0);
  }, [packResult.totalLength, appData.costTiers]);

  const calculateDetails = useCallback((item: DesignItem): CalculationResult => {
    const defaultRes = { unitProductionCost: 0, unitClientPrice: 0, totalProductionCost: 0, totalClientPrice: 0 };
    if (!item || packResult.totalLength <= 0 || packResult.totalAreaUsed <= 0) return defaultRes;
    const totalSheetCost = packResult.totalLength * currentPricePerCm;
    const packedUnits = (packResult.packed || []).filter(p => p && p.originalId === item.id);
    const actualPackedQuantity = packedUnits.length;
    if (actualPackedQuantity === 0) return defaultRes;
    const itemPackedArea = packedUnits.reduce((acc, p) => acc + (p.width * p.height), 0);
    const totalProdCostForItem = (itemPackedArea / packResult.totalAreaUsed) * totalSheetCost;
    const unitProdCost = totalProdCostForItem / actualPackedQuantity;
    const profitFactor = 1 + ((appData.profitMargin || 0) / 100);
    const discounts = Array.isArray(appData.quantityDiscounts) ? appData.quantityDiscounts : [];
    const discount = discounts.find(q => item.quantity >= q.minQty && item.quantity <= q.maxQty);
    const discFactor = discount ? (1 - discount.discountPercent / 100) : 1;
    const unitClientPrice = unitProdCost * profitFactor * discFactor;
    return { unitProductionCost: unitProdCost, unitClientPrice: unitClientPrice, totalProductionCost: totalProdCostForItem, totalClientPrice: unitClientPrice * actualPackedQuantity };
  }, [packResult, currentPricePerCm, appData.profitMargin, appData.quantityDiscounts]);

  const tableTotals = useMemo(() => {
    const designs = Array.isArray(appData.designs) ? appData.designs : [];
    return designs.reduce((acc, d) => {
        const res = calculateDetails(d);
        const packedQty = (packResult.packed || []).filter(p => p && p.originalId === d.id).length;
        return { prod: acc.prod + res.totalProductionCost, client: acc.client + res.totalClientPrice, qty: acc.qty + packedQty };
    }, { prod: 0, client: 0, qty: 0 });
  }, [appData.designs, calculateDetails, packResult.packed]);

  const filteredOrders = useMemo(() => {
    const orders = Array.isArray(appData.orders) ? appData.orders : [];
    const clients = Array.isArray(appData.clients) ? appData.clients : [];
    const s = (orderSearch || '').toLowerCase();
    return orders.filter(o => {
      if (!o) return false;
      const clientFound = clients.find(c => c && c.id === o.client_id);
      const nameMatch = (clientFound?.name || '').toLowerCase().includes(s);
      const numMatch = String(o.order_number || '').toLowerCase().includes(s);
      const statusMatch = statusFilter === 'all' || o.status_id === statusFilter;
      return (nameMatch || numMatch) && statusMatch;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [appData.orders, appData.clients, orderSearch, statusFilter]);

  const filteredClients = useMemo(() => {
    const clients = Array.isArray(appData.clients) ? appData.clients : [];
    const s = (clientSearch || '').toLowerCase();
    return clients.filter(c => {
      if (!c) return false;
      const nameMatch = (c.name || '').toLowerCase().includes(s);
      const phoneMatch = (c.phone || '').toLowerCase().includes(s);
      return nameMatch || phoneMatch;
    });
  }, [appData.clients, clientSearch]);

  const requestNotificationPermission = async () => {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      setAppData(prev => ({ ...prev, notifications: { ...prev.notifications, enabled: true } }));
    } else {
      alert("Permiso de notificaciones denegado.");
    }
  };

  const addDesign = () => {
    if (newDesign.width <= 0 || newDesign.height <= 0 || newDesign.quantity <= 0) return;
    updateData('designs', [...(appData.designs || []), { ...newDesign, id: generateUUID(), name: newDesign.name || 'S/N' } as DesignItem]);
    setNewDesign({ name: '', width: 0, height: 0, quantity: 1 });
  };

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => setConfirmModal({ title, message, onConfirm });

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2Icon className="animate-spin text-indigo-600" size={48}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><CalculatorIcon size={24}/></div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Crea<span className="text-indigo-600">Stickers</span></h1>
          </div>
          <nav className="flex items-center bg-slate-100 p-1 rounded-2xl border overflow-x-auto custom-scrollbar">
            {['dash', 'presupuestar', 'pedidos', 'clients', 'config'].map((t) => (
              <button key={t} onClick={() => setActiveTab(t as Tab)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                {t === 'dash' ? 'Inicio' : t === 'presupuestar' ? 'Presu' : t === 'clients' ? 'Clientes' : t}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-3">
             {session?.user ? (
               <button onClick={() => askConfirmation("Cerrar Sesión", "¿Desconectar taller?", () => supabase?.auth.signOut())} className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 border border-emerald-200 px-5 py-3 rounded-full">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 {session.user.email?.split('@')[0]} <LogOutIcon size={12}/>
               </button>
             ) : (
               <button onClick={() => setIsAuthModalOpen(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-full font-black text-[11px] uppercase shadow-xl flex items-center gap-2 transition-all hover:scale-105 active:scale-95"><CloudIcon size={16}/> Sincronizar</button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 lg:p-10">
        {activeTab === 'dash' && (
           <div className="space-y-10">
              {session?.user && ((appData.clients?.length || 0) > 0 || (appData.orders?.length || 0) > 0) && (
                <div className="bg-indigo-600 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 text-white shadow-2xl">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center"><CloudUploadIcon size={32}/></div>
                      <div className="max-w-md">
                         <h3 className="text-xl font-black uppercase mb-1">Backup Disponible</h3>
                         <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest leading-relaxed">Sincroniza tus datos locales con la nube.</p>
                      </div>
                   </div>
                   <button disabled={isMigrating} onClick={pushLocalDataToCloud} className="bg-white text-indigo-600 px-10 py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">
                     {isMigrating ? <Loader2Icon className="animate-spin" size={18}/> : 'Subir Datos'}
                   </button>
                </div>
              )}
              {deferredPrompt && (
                <div className="bg-white rounded-[2rem] p-8 border shadow-sm flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="bg-slate-100 p-3 rounded-2xl text-slate-900"><SmartphoneIcon/></div>
                      <div>
                        <h4 className="font-black text-xs uppercase">Instalar App</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Instala CreaStickers en tu pantalla de inicio.</p>
                      </div>
                   </div>
                   <button onClick={handleInstallClick} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase flex items-center gap-2"><DownloadIcon size={14}/> Instalar</button>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                 {(appData.statuses || []).map(s => (
                   <div key={s.id} className="bg-white p-10 rounded-[3rem] border shadow-sm flex flex-col items-center group transition-all hover:border-indigo-200">
                      <div className={`w-4 h-4 rounded-full ${s.color} mb-4`}></div>
                      <div className="text-5xl font-black text-slate-900 mb-2">{(appData.orders || []).filter(o => o && o.status_id === s.id).length}</div>
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{s.name}</div>
                   </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'presupuestar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                <h2 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-3 mb-8"><Settings2Icon size={18}/> Configuración</h2>
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Pliego (cm)</label><input type="number" value={appData.sheetWidth} onChange={e => updateData('sheetWidth', Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Margen %</label><input type="number" value={appData.profitMargin} onChange={e => updateData('profitMargin', Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none" /></div>
                   </div>
                   <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Espaciado (cm)</label><input type="number" step="0.1" value={appData.designSpacing} onChange={e => updateData('designSpacing', Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none" /></div>
                </div>
              </section>
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                <h2 className="text-indigo-600 font-black text-sm uppercase tracking-widest flex items-center gap-3 mb-8"><PlusIcon size={18}/> Agregar Diseño</h2>
                <div className="space-y-6">
                   <input type="text" placeholder="Nombre..." value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none" />
                   <div className="grid grid-cols-3 gap-3">
                      <input type="number" placeholder="W" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="bg-slate-50 p-4 rounded-xl font-bold text-center border-none" />
                      <input type="number" placeholder="H" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="bg-slate-50 p-4 rounded-xl font-bold text-center border-none" />
                      <input type="number" placeholder="Q" value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="bg-slate-50 p-4 rounded-xl font-bold text-center border-none" />
                   </div>
                   <button onClick={addDesign} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase text-[11px] shadow-xl hover:bg-indigo-700 transition-all">Optimizar</button>
                </div>
              </section>
            </div>
            <div className="lg:col-span-8 space-y-10">
               <section className="bg-white rounded-[2.5rem] p-10 border shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <h2 className="font-black text-xl text-slate-900 flex items-center gap-4"><LayoutIcon className="text-indigo-500" size={24}/> Previsualización</h2>
                    <div className="bg-slate-900 text-white px-6 py-2 rounded-xl font-black text-sm uppercase flex items-center gap-2">
                       <RulerIcon size={18} className="text-indigo-400"/> {packResult.totalLength.toFixed(1)} cm
                    </div>
                  </div>
                  <div className="bg-slate-950 rounded-[2rem] min-h-[400px] overflow-auto flex justify-center p-10 border-[10px] border-slate-900 shadow-inner custom-scrollbar">
                     {packResult.totalLength > 0 ? (
                        <div className="bg-white relative shadow-2xl" style={{ width: `${appData.sheetWidth * 6}px`, height: `${packResult.totalLength * 6}px` }}>
                          {(packResult.packed || []).map(p => (
                            <div key={p.id} className="absolute border bg-indigo-500 border-indigo-600 text-white flex items-center justify-center text-[7px] font-black overflow-hidden" title={p.name} style={{ left: `${p.x * 6}px`, top: `${p.y * 6}px`, width: `${p.width * 6}px`, height: `${p.height * 6}px` }}>
                               <span className="p-0.5 leading-none">{p.width}x{p.height}</span>
                            </div>
                          ))}
                        </div>
                     ) : <div className="text-slate-800 opacity-20 uppercase font-black py-20">Ingresa diseños</div>}
                  </div>
               </section>
               <section className="bg-white rounded-[2.5rem] p-10 border shadow-sm overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                       <tr><th className="pb-4">Diseño</th><th className="text-right pb-4">Costo Prod</th><th className="text-right pb-4">Venta Unit</th><th className="text-right pb-4 px-6">Total Venta</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {(appData.designs || []).map(d => {
                        const res = calculateDetails(d);
                        const packedQty = (packResult.packed || []).filter(p => p && p.originalId === d.id).length;
                        return (
                          <tr key={d.id} className="group">
                            <td className="py-6"><div className="font-black text-slate-900 uppercase text-xs">{d.name}</div><div className="text-[10px] font-bold text-slate-400 uppercase">{d.width}x{d.height} CM • {packedQty}/{d.quantity}</div></td>
                            <td className="text-right font-black text-rose-500 text-sm">${res.unitProductionCost.toFixed(0)}</td>
                            <td className="text-right font-black text-slate-900 text-sm">${res.unitClientPrice.toFixed(0)}</td>
                            <td className="text-right py-6 px-6 font-black text-emerald-600 text-lg">
                               ${res.totalClientPrice.toFixed(0)}
                               <button onClick={() => updateData('designs', appData.designs.filter(i => i.id !== d.id))} className="ml-4 text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon size={16}/></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                        <tr><td className="py-6 px-4 font-black text-slate-400 uppercase text-[10px]">Total ({tableTotals.qty} u.)</td><td className="text-right font-black text-rose-600 text-xl">${tableTotals.prod.toFixed(0)}</td><td></td><td className="text-right py-6 px-6 font-black text-emerald-700 text-3xl">${tableTotals.client.toFixed(0)}</td></tr>
                    </tfoot>
                  </table>
               </section>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
           <div className="space-y-10">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border shadow-sm">
                 <div className="relative flex-1 w-full"><SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18}/><input type="text" placeholder="Buscar..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="w-full bg-slate-50 p-4 pl-14 rounded-xl font-bold border-none" /></div>
                 <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto custom-scrollbar">
                    {['all', ...(appData.statuses || []).map(s => s.id)].map(st => (
                      <button key={st} onClick={() => setStatusFilter(st)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${statusFilter === st ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border'}`}>
                        {st === 'all' ? 'Todos' : appData.statuses.find(s => s.id === st)?.name}
                      </button>
                    ))}
                    <button onClick={() => { setEditingOrder(null); setOrderForm({ order_number: String((appData.orders?.length || 0) + 1).padStart(4, '0'), status_id: 'hacer', client_id: '', width: 0, height: 0, quantity: 1, category_id: '', deposit: 0 }); setIsOrderModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 hover:scale-105 transition-all"><PlusIcon size={16}/> Cargar</button>
                 </div>
              </div>
              <div className="grid gap-4">
                 {filteredOrders.map(o => {
                   const c = (appData.clients || []).find(cl => cl && cl.id === o.client_id);
                   const s = (appData.statuses || []).find(st => st && st.id === o.status_id);
                   const cat = (appData.categories || []).find(cat => cat && cat.id === o.category_id);
                   return (
                     <div key={o.id} className="bg-white rounded-[2rem] p-6 border shadow-sm flex flex-col md:flex-row items-center gap-6 group">
                        <div className="flex-1 flex items-center gap-5 w-full">
                           <div className={`w-14 h-14 rounded-2xl ${s?.color} text-white flex flex-col items-center justify-center font-black text-[9px]`}><span className="opacity-60">Nº</span><span className="text-xs">#{o.order_number}</span></div>
                           <div><div className="font-black text-slate-900 uppercase text-sm">{c?.name || 'DESCONOCIDO'}</div><div className="text-[10px] font-bold text-slate-400 uppercase flex gap-2"><span className={`px-2 py-0.5 rounded-full text-white ${s?.color}`}>{s?.name}</span><span className="bg-slate-100 px-2 py-0.5 rounded-full">{cat?.name}</span>{o.width}x{o.height}cm</div></div>
                        </div>
                        <div className="flex items-center gap-8 w-full md:w-auto justify-end">
                           <div className="text-right min-w-[200px] border-r pr-6 border-slate-100"><div className="text-[9px] font-black text-slate-400 uppercase mb-1">Costo Final</div><div className="font-black text-slate-900 text-lg">$ {o.total_price.toLocaleString()}</div></div>
                           <div className="flex gap-2">
                              <button onClick={() => setShowSummary(o)} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50"><Share2Icon size={18}/></button>
                              <button onClick={() => { setEditingOrder(o); setOrderForm(o); setIsOrderModalOpen(true); }} className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50"><Edit3Icon size={18}/></button>
                              <button onClick={() => askConfirmation("Borrar", `¿Eliminar #${o.order_number}?`, () => updateData('orders', appData.orders.filter(ord => ord.id !== o.id)))} className="p-3 text-slate-200 hover:text-rose-500"><TrashIcon size={18}/></button>
                           </div>
                        </div>
                     </div>
                   );
                 })}
              </div>
           </div>
        )}

        {activeTab === 'clients' && (
           <div className="space-y-10">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border shadow-sm">
                 <div className="relative flex-1 w-full"><SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18}/><input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full bg-slate-50 p-4 pl-14 rounded-xl font-bold border-none" /></div>
                 <button onClick={() => { setClientForm({}); setIsClientModalOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 hover:scale-105 transition-all"><PlusIcon size={16}/> Nuevo Cliente</button>
              </div>
              <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm overflow-x-auto custom-scrollbar">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <tr><th className="px-8 py-6">Cliente</th><th className="px-8 py-6">WhatsApp</th><th className="px-8 py-6 text-right">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y">
                       {filteredClients.map(c => (
                         <tr key={c.id} className="hover:bg-slate-50 group">
                            <td className="px-8 py-6 flex items-center gap-4"><div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">{c.name?.charAt(0)}</div><div className="font-black text-slate-900 uppercase text-xs">{c.name}</div></td>
                            <td className="px-8 py-6 font-black text-slate-600 text-xs">{c.phone}</td>
                            <td className="px-8 py-6 text-right opacity-0 group-hover:opacity-100 transition-all">
                               <button onClick={() => { setClientForm(c); setIsClientModalOpen(true); }} className="p-3 text-indigo-600"><Edit3Icon size={18}/></button>
                               <button onClick={() => askConfirmation("Borrar", `¿Eliminar a ${c.name}?`, () => updateData('clients', appData.clients.filter(cl => cl.id !== c.id)))} className="p-3 text-rose-500"><TrashIcon size={18}/></button>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === 'config' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><BellIcon size={16}/> Notificaciones</h2>
                    <div className={`w-3 h-3 rounded-full ${appData.notifications?.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                 </div>
                 {!appData.notifications?.enabled ? (
                    <button onClick={requestNotificationPermission} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-[10px] uppercase shadow-lg hover:bg-indigo-700 transition-all">Activar Alertas</button>
                 ) : (
                    <div className="space-y-4">
                       {['newOrder', 'newClient', 'statusChange'].map(key => (
                         <label key={key} className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border cursor-pointer">
                            <span className="font-black text-[10px] uppercase text-slate-600">{key === 'newOrder' ? 'Nuevo Pedido' : key === 'newClient' ? 'Nuevo Cliente' : 'Cambio Estado'}</span>
                            <input type="checkbox" checked={appData.notifications[key as keyof NotificationSettings] as boolean} onChange={e => updateData('notifications', {...appData.notifications, [key]: e.target.checked})} className="w-5 h-5 accent-indigo-600" />
                         </label>
                       ))}
                    </div>
                 )}
              </section>
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                 <div className="flex items-center justify-between mb-8"><h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><TagIcon size={16}/> Categorías</h2><button onClick={() => updateData('categories', [...(appData.categories || []), { id: generateUUID(), name: 'NUEVA', pricePerUnit: 0 }])} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><PlusIcon size={16}/></button></div>
                 <div className="space-y-4">
                    {(appData.categories || []).map((cat, idx) => (
                      <div key={cat.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border group">
                         <input type="text" value={cat.name} onChange={e => { const nc = [...appData.categories]; nc[idx].name = e.target.value; updateData('categories', nc); }} className="flex-1 bg-transparent font-black text-[10px] uppercase outline-none" />
                         <div className="font-black text-indigo-600 text-xs">$ <input type="number" value={cat.pricePerUnit} onChange={e => { const nc = [...appData.categories]; nc[idx].pricePerUnit = Number(e.target.value); updateData('categories', nc); }} className="w-16 bg-transparent text-right outline-none" /></div>
                         <button onClick={() => updateData('categories', appData.categories.filter(c => c.id !== cat.id))} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon size={14}/></button>
                      </div>
                    ))}
                 </div>
              </section>
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                 <div className="flex items-center justify-between mb-8"><h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><LayersIcon size={16}/> Escala</h2><button onClick={() => updateData('costTiers', [...(appData.costTiers || []), { id: generateUUID(), minLargo: 0, maxLargo: 0, precioPorCm: 0 }])} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><PlusIcon size={16}/></button></div>
                 <div className="space-y-4">
                    {(appData.costTiers || []).map((tier, idx) => (
                      <div key={tier.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border group">
                         <input type="number" value={tier.minLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].minLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-10 bg-white rounded p-1 text-[9px] font-black text-center" /><span className="text-slate-300">→</span><input type="number" value={tier.maxLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].maxLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-10 bg-white rounded p-1 text-[9px] font-black text-center" /><div className="flex-1 text-right font-black text-indigo-600 text-xs">$ <input type="number" value={tier.precioPorCm} onChange={e => { const nt = [...appData.costTiers]; nt[idx].precioPorCm = Number(e.target.value); updateData('costTiers', nt); }} className="w-14 bg-transparent text-right outline-none" /></div>
                         <button onClick={() => updateData('costTiers', appData.costTiers.filter(t => t.id !== tier.id))} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon size={14}/></button>
                      </div>
                    ))}
                 </div>
              </section>
           </div>
        )}
      </main>

      {/* Modales Genéricos */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-sm rounded-[2rem] p-10 shadow-2xl relative">
              <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900"><XIcon size={20}/></button>
              <h2 className="text-xl font-black text-slate-900 uppercase mb-6 flex items-center gap-3"><CloudIcon className="text-indigo-600"/> Cuenta Taller</h2>
              <form onSubmit={handleAuth} className="space-y-5">
                 <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none" placeholder="Email" />
                 <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none" placeholder="Contraseña" />
                 <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase text-[10px] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">
                    {authLoading ? 'Conectando...' : 'Entrar'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative">
              <h2 className="text-xl font-black text-slate-900 uppercase mb-8 flex items-center gap-3"><UsersIcon/> Cliente</h2>
              <div className="space-y-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre</label><input type="text" value={clientForm.name || ''} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-none" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">WhatsApp</label><input type="text" value={clientForm.phone || ''} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-none" /></div>
                 <div className="pt-4 flex gap-4"><button onClick={() => setIsClientModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase text-xs">Cerrar</button><button onClick={async () => {
                    const client = clientForm.id ? { ...clientForm } as Client : { ...clientForm, id: generateUUID(), created_at: new Date().toISOString() } as Client;
                    updateData('clients', clientForm.id ? appData.clients.map(c => c.id === client.id ? client : c) : [...appData.clients, client]);
                    if (supabase && session?.user) await supabase.from('clients').upsert({ ...client, id: toSafeUUID(client.id), user_id: session.user.id });
                    setIsClientModalOpen(false);
                 }} className="flex-[2] bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg hover:bg-slate-800 active:scale-95 transition-all">Guardar</button></div>
              </div>
           </div>
        </div>
      )}

      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl">
              <h2 className="text-lg font-black uppercase mb-6 flex items-center gap-3"><PackageIcon/> {editingOrder ? 'Editar' : 'Nuevo'} Pedido</h2>
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={orderForm.order_number} onChange={e => setOrderForm({...orderForm, order_number: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none" placeholder="Nº" />
                    <select value={orderForm.status_id} onChange={e => setOrderForm({...orderForm, status_id: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none">{(appData.statuses || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                 </div>
                 <select value={orderForm.client_id} onChange={e => setOrderForm({...orderForm, client_id: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none"><option value="">Cliente...</option>{(appData.clients || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                 <div className="grid grid-cols-3 gap-2">
                    <input type="number" placeholder="W" value={orderForm.width || ''} onChange={e => setOrderForm({...orderForm, width: Number(e.target.value)})} className="bg-slate-50 p-3 rounded-xl font-black border-none text-center" />
                    <input type="number" placeholder="H" value={orderForm.height || ''} onChange={e => setOrderForm({...orderForm, height: Number(e.target.value)})} className="bg-slate-50 p-3 rounded-xl font-black border-none text-center" />
                    <input type="number" placeholder="Q" value={orderForm.quantity || ''} onChange={e => setOrderForm({...orderForm, quantity: Number(e.target.value)})} className="bg-slate-50 p-3 rounded-xl font-black border-none text-center" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <select value={orderForm.category_id} onChange={e => setOrderForm({...orderForm, category_id: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none"><option value="">Cat...</option>{(appData.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input type="number" placeholder="Seña" value={orderForm.deposit || ''} onChange={e => setOrderForm({...orderForm, deposit: Number(e.target.value)})} className="w-full bg-emerald-50 p-3 rounded-xl font-black text-emerald-700 border-none" />
                 </div>
                 <div className="pt-4 flex gap-4"><button onClick={() => setIsOrderModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase text-xs">Cerrar</button><button onClick={async () => {
                    const cat = (appData.categories || []).find(c => c && c.id === orderForm.category_id);
                    const total = (cat?.pricePerUnit || 0) * (orderForm.quantity || 0);
                    const dep = orderForm.deposit || 0;
                    const order: Order = editingOrder ? { ...editingOrder, ...orderForm, total_price: total, balance: total - dep } as Order : { ...orderForm, id: generateUUID(), total_price: total, balance: total - dep, created_at: new Date().toISOString() } as Order;
                    updateData('orders', editingOrder ? appData.orders.map(o => o.id === order.id ? order : o) : [...appData.orders, order]);
                    if (supabase && session?.user) await supabase.from('orders').upsert({ ...order, id: toSafeUUID(order.id), client_id: toSafeUUID(order.client_id), category_id: toSafeUUID(order.category_id), user_id: session.user.id });
                    setIsOrderModalOpen(false);
                 }} className="flex-[2] bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-700 transition-all">Guardar</button></div>
              </div>
           </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[200] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative text-center">
              <button onClick={() => setShowSummary(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-all"><XIcon size={24}/></button>
              <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white mb-6 mx-auto"><CalculatorIcon size={36}/></div>
              <h2 className="font-black text-xl uppercase mb-6 tracking-tight">Ticket</h2>
              <div className="space-y-4 border-y py-6 mb-8 text-left text-xs uppercase font-bold">
                 <div className="flex justify-between"><span>Pedido:</span><span className="text-slate-900">#{showSummary.order_number}</span></div>
                 <div className="flex justify-between"><span>Total:</span><span className="text-indigo-600 font-black">${showSummary.total_price.toLocaleString()}</span></div>
                 <div className="flex justify-between text-rose-500 font-black"><span>Saldo:</span><span>${showSummary.balance.toLocaleString()}</span></div>
              </div>
              <button onClick={() => {
                const cFound = (appData.clients || []).find(cl => cl && cl.id === showSummary.client_id);
                const text = `*Ticket #${showSummary.order_number}*\n*Total:* $${showSummary.total_price}\n*Saldo:* $${showSummary.balance}`;
                window.open(`https://wa.me/${cFound?.phone?.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank');
              }} className="w-full bg-emerald-500 text-white py-4 rounded-xl font-black flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-600 transition-all"><MessageCircleIcon size={18}/> WhatsApp</button>
           </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[300] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-xs rounded-[2rem] p-8 shadow-2xl text-center">
              <AlertTriangleIcon size={32} className="text-rose-500 mx-auto mb-4"/>
              <h3 className="font-black text-slate-900 uppercase mb-2 leading-none">{confirmModal.title}</h3>
              <p className="text-slate-500 text-[10px] mb-8">{confirmModal.message}</p>
              <div className="flex gap-2"><button onClick={() => setConfirmModal(null)} className="flex-1 py-3 bg-slate-50 rounded-xl font-black text-[10px] uppercase">Cerrar</button><button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg transition-all">Borrar</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
