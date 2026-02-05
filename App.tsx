
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  Settings2Icon, 
  LayoutIcon, 
  CalculatorIcon, 
  TagIcon, 
  LayersIcon, 
  UsersIcon,
  PackageIcon,
  SearchIcon,
  Share2Icon,
  MessageCircleIcon,
  Edit3Icon,
  XIcon,
  MapPinIcon,
  PercentIcon,
  AlertTriangleIcon,
  CloudIcon,
  LogOutIcon,
  Loader2Icon,
  RulerIcon,
  CloudUploadIcon,
  RefreshCwIcon,
  ClipboardListIcon
} from 'lucide-react';
import { 
  DesignItem, 
  CostTier, 
  QuantityDiscount, 
  CalculationResult, 
  PackedDesign,
  Client,
  Category,
  OrderStatus,
  Order
} from './types';
import { packDesigns } from './utils/layout';
import { supabase } from './supabaseClient';

const MASTER_KEY = 'graficapro_enterprise_v15_final';

// Helpers para IDs y UUIDs
const generateUUID = () => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

const toSafeUUID = (id: string | undefined) => {
  if (!id) return generateUUID();
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(id)) return id;
  const numeric = id.replace(/\D/g, '').padStart(12, '0').slice(-12);
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

const DEFAULT_DATA = {
  sheetWidth: 58,
  profitMargin: 100,
  designSpacing: 0.2,
  costTiers: [] as CostTier[],
  quantityDiscounts: [] as QuantityDiscount[],
  designs: [] as DesignItem[],
  clients: [] as Client[],
  orders: [] as Order[],
  categories: DEFAULT_CATEGORIES,
  statuses: DEFAULT_STATUSES,
};

type AppDataType = typeof DEFAULT_DATA;
type Tab = 'dash' | 'presupuestar' | 'pedidos' | 'clients' | 'config';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dash');
  const [appData, setAppData] = useState<AppDataType>(DEFAULT_DATA);
  const [session, setSession] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isMigrating, setIsMigrating] = useState(false);
  const [showSummary, setShowSummary] = useState<Order | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  const [newDesign, setNewDesign] = useState({ name: '', width: 0, height: 0, quantity: 1 });
  const [clientSearch, setClientSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<Partial<Client>>({});
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderForm, setOrderForm] = useState<Partial<Order>>({
    order_number: '', status_id: 'hacer', client_id: '', width: 0, height: 0, quantity: 1, category_id: '', deposit: 0, details: ''
  });

  const ensureISO = (val: any): string => {
    if (!val) return new Date().toISOString();
    if (typeof val === 'number') return new Date(val).toISOString();
    return String(val).length < 10 ? new Date().toISOString() : val;
  };

  // Función núcleo de actualización de estado y persistencia
  const updateData = useCallback((field: keyof AppDataType, value: any) => {
    setAppData(prev => {
        const newData = { ...prev, [field]: value };
        localStorage.setItem(MASTER_KEY, JSON.stringify(newData));
        return newData;
    });
  }, []);

  // Inicialización y carga de datos
  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem(MASTER_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setAppData(prev => ({ ...prev, ...parsed }));
        } catch (e) {}
      }
      if (!supabase) { setLoading(false); return; }
      try {
        const { data: { session: cur } } = await supabase.auth.getSession();
        setSession(cur);
        if (cur?.user) await fetchCloudData(cur.user.id);
      } catch (e) {}
      setLoading(false);
    };
    init();

    if (supabase) {
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        if (session?.user) fetchCloudData(session.user.id);
      });
      return () => subscription.unsubscribe();
    }
  }, []);

  const fetchCloudData = async (userId: string) => {
    if (!supabase) return;
    try {
      const [setts, cls, ords, cats, tiers, discs] = await Promise.all([
        supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('clients').select('*').eq('user_id', userId),
        supabase.from('orders').select('*').eq('user_id', userId),
        supabase.from('categories').select('*').eq('user_id', userId),
        supabase.from('cost_tiers').select('*').eq('user_id', userId).order('min_largo', { ascending: true }),
        supabase.from('quantity_discounts').select('*').eq('user_id', userId).order('min_qty', { ascending: true })
      ]);

      setAppData(prev => ({
        ...prev,
        sheetWidth: setts.data ? Number(setts.data.sheet_width) : prev.sheetWidth,
        profitMargin: setts.data ? Number(setts.data.profit_margin) : prev.profitMargin,
        designSpacing: setts.data ? Number(setts.data.design_spacing) : prev.designSpacing,
        clients: cls.data || prev.clients,
        orders: ords.data || prev.orders,
        categories: (cats.data && cats.data.length > 0) ? cats.data.map((c: any) => ({ id: c.id, name: c.name, pricePerUnit: Number(c.price_per_unit || 0) })) : prev.categories,
        costTiers: (tiers.data || []).map((t: any) => ({ id: t.id, minLargo: Number(t.min_largo || 0), maxLargo: Number(t.max_largo || 0), precioPorCm: Number(t.precio_por_cm || 0) })),
        quantityDiscounts: (discs.data || []).map((d: any) => ({ id: d.id, minQty: Number(d.min_qty || 0), maxQty: Number(d.max_qty || 0), discountPercent: Number(d.discount_percent || 0) })),
      }));
    } catch (e) {}
  };

  const pushLocalDataToCloud = async () => {
    if (!supabase || !session?.user) return;
    setIsMigrating(true);
    try {
      const userId = session.user.id;
      // Sincronizar por partes para evitar errores de integridad
      await Promise.all([
        appData.categories.length > 0 ? supabase.from('categories').upsert(appData.categories.map(c => ({ id: toSafeUUID(c.id), name: c.name, price_per_unit: c.pricePerUnit, user_id: userId }))) : Promise.resolve(),
        appData.clients.length > 0 ? supabase.from('clients').upsert(appData.clients.map(c => ({ id: toSafeUUID(c.id), name: c.name, phone: c.phone, address: c.address, user_id: userId, created_at: ensureISO(c.created_at) }))) : Promise.resolve(),
        appData.costTiers.length > 0 ? supabase.from('cost_tiers').upsert(appData.costTiers.map(t => ({ id: toSafeUUID(t.id), min_largo: t.minLargo, max_largo: t.maxLargo, precio_por_cm: t.precioPorCm, user_id: userId }))) : Promise.resolve(),
        appData.quantityDiscounts.length > 0 ? supabase.from('quantity_discounts').upsert(appData.quantityDiscounts.map(d => ({ id: toSafeUUID(d.id), min_qty: d.minQty, max_qty: d.maxQty, discount_percent: d.discountPercent, user_id: userId }))) : Promise.resolve()
      ]);

      if (appData.orders.length > 0) {
        await supabase.from('orders').upsert(appData.orders.map(o => ({
          id: toSafeUUID(o.id), order_number: o.order_number, client_id: toSafeUUID(o.client_id),
          category_id: o.category_id ? toSafeUUID(o.category_id) : null,
          width: o.width, height: o.height, quantity: o.quantity, total_price: o.total_price,
          deposit: o.deposit, balance: o.balance, status_id: o.status_id, details: o.details || '',
          user_id: userId, created_at: ensureISO(o.created_at)
        })));
      }

      await supabase.from('settings').upsert({ user_id: userId, sheet_width: appData.sheetWidth, profit_margin: appData.profitMargin, design_spacing: appData.designSpacing });
      
      alert("✅ Sincronización exitosa.");
      fetchCloudData(userId);
    } catch (err: any) {
      alert("❌ Error: " + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  // CRUD Lógica - Pedidos
  const saveOrder = async () => {
    const cat = appData.categories.find(c => c.id === orderForm.category_id);
    const total = (cat?.pricePerUnit || 0) * (orderForm.quantity || 0);
    const dep = orderForm.deposit || 0;
    
    const order: Order = editingOrder 
      ? { ...editingOrder, ...orderForm, total_price: total, balance: total - dep } as Order 
      : { ...orderForm, id: generateUUID(), total_price: total, balance: total - dep, created_at: new Date().toISOString() } as Order;

    const newOrders = editingOrder ? appData.orders.map(o => o.id === order.id ? order : o) : [...appData.orders, order];
    updateData('orders', newOrders);
    
    if (supabase && session?.user) {
        const { error } = await supabase.from('orders').upsert({
          id: toSafeUUID(order.id), order_number: order.order_number, client_id: toSafeUUID(order.client_id),
          category_id: order.category_id ? toSafeUUID(order.category_id) : null,
          width: order.width, height: order.height, quantity: order.quantity,
          total_price: order.total_price, deposit: order.deposit, balance: order.balance,
          status_id: order.status_id, details: order.details || '', user_id: session.user.id,
          created_at: ensureISO(order.created_at)
        });
        if (error) console.error("Error al subir a Supabase:", error.message);
    }
    setIsOrderModalOpen(false);
  };

  const deleteOrder = async (id: string) => {
    updateData('orders', appData.orders.filter(o => o.id !== id));
    if (supabase && session?.user) {
      await supabase.from('orders').delete().eq('id', toSafeUUID(id));
    }
  };

  // CRUD Lógica - Clientes
  const saveClient = async () => {
    const client = clientForm.id ? { ...clientForm } as Client : { ...clientForm, id: generateUUID(), created_at: new Date().toISOString() } as Client;
    updateData('clients', clientForm.id ? appData.clients.map(c => c.id === client.id ? client : c) : [...appData.clients, client]);
    if (supabase && session?.user) {
      await supabase.from('clients').upsert({ ...client, id: toSafeUUID(client.id), user_id: session.user.id });
    }
    setIsClientModalOpen(false);
  };

  const deleteClient = async (id: string) => {
    updateData('clients', appData.clients.filter(c => c.id !== id));
    if (supabase && session?.user) {
      await supabase.from('clients').delete().eq('id', toSafeUUID(id));
    }
  };

  // CRUD Lógica - Descuentos y Rangos (Corregido para evitar persistencia errónea)
  const deleteDiscount = async (id: string) => {
    updateData('quantityDiscounts', appData.quantityDiscounts.filter(d => d.id !== id));
    if (supabase && session?.user) {
      await supabase.from('quantity_discounts').delete().eq('id', toSafeUUID(id));
    }
  };

  const deleteTier = async (id: string) => {
    updateData('costTiers', appData.costTiers.filter(t => t.id !== id));
    if (supabase && session?.user) {
      await supabase.from('cost_tiers').delete().eq('id', toSafeUUID(id));
    }
  };

  const deleteCategory = async (id: string) => {
    updateData('categories', appData.categories.filter(c => c.id !== id));
    if (supabase && session?.user) {
      await supabase.from('categories').delete().eq('id', toSafeUUID(id));
    }
  };

  // Cálculos de empaquetado y costos
  const packResult = useMemo(() => packDesigns(appData.designs, appData.sheetWidth, appData.designSpacing), [appData.designs, appData.sheetWidth, appData.designSpacing]);
  
  const currentPricePerCm = useMemo(() => {
    const l = packResult.totalLength;
    const tier = appData.costTiers.find((t: CostTier) => l >= t.minLargo && l < t.maxLargo);
    return tier ? tier.precioPorCm : (appData.costTiers[appData.costTiers.length - 1]?.precioPorCm || 0);
  }, [packResult.totalLength, appData.costTiers]);

  const calculateDetails = useCallback((item: DesignItem): CalculationResult => {
    if (packResult.totalLength <= 0 || packResult.totalAreaUsed <= 0) return { unitProductionCost: 0, unitClientPrice: 0, totalProductionCost: 0, totalClientPrice: 0 };
    const totalSheetCost = packResult.totalLength * currentPricePerCm;
    const packedUnits = packResult.packed.filter(p => p.originalId === item.id);
    const actualPackedQuantity = packedUnits.length;
    if (actualPackedQuantity === 0) return { unitProductionCost: 0, unitClientPrice: 0, totalProductionCost: 0, totalClientPrice: 0 };
    const itemPackedArea = packedUnits.reduce((acc, p) => acc + (p.width * p.height), 0);
    const totalProdCostForItem = (itemPackedArea / packResult.totalAreaUsed) * totalSheetCost;
    const unitProdCost = totalProdCostForItem / actualPackedQuantity;
    const profitFactor = 1 + (appData.profitMargin / 100);
    const discount = appData.quantityDiscounts.find(q => item.quantity >= q.minQty && item.quantity <= q.maxQty);
    const discFactor = discount ? (1 - discount.discountPercent / 100) : 1;
    const unitClientPrice = unitProdCost * profitFactor * discFactor;
    return { unitProductionCost: unitProdCost, unitClientPrice: unitClientPrice, totalProductionCost: totalProdCostForItem, totalClientPrice: unitClientPrice * actualPackedQuantity };
  }, [packResult, currentPricePerCm, appData.profitMargin, appData.quantityDiscounts]);

  const tableTotals = useMemo(() => {
    return appData.designs.reduce((acc, d) => {
        const res = calculateDetails(d);
        const packedQty = packResult.packed.filter(p => p.originalId === d.id).length;
        return { prod: acc.prod + res.totalProductionCost, client: acc.client + res.totalClientPrice, qty: acc.qty + packedQty };
    }, { prod: 0, client: 0, qty: 0 });
  }, [appData.designs, calculateDetails, packResult.packed]);

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => setConfirmModal({ title, message, onConfirm });

  // Vistas filtradas
  const filteredOrders = useMemo(() => {
    const s = orderSearch.toLowerCase();
    return appData.orders.filter(o => {
      const client = appData.clients.find(c => c.id === o.client_id);
      const matchesText = (client?.name || '').toLowerCase().includes(s) || (o.order_number || '').includes(s);
      const matchesStatus = statusFilter === 'all' || o.status_id === statusFilter;
      return matchesText && matchesStatus;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [appData.orders, appData.clients, orderSearch, statusFilter]);

  const filteredClients = useMemo(() => {
    const s = clientSearch.toLowerCase();
    return appData.clients.filter(c => (c.name || '').toLowerCase().includes(s) || (c.phone || '').toLowerCase().includes(s));
  }, [appData.clients, clientSearch]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2Icon className="animate-spin text-indigo-600" size={48}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 overflow-x-hidden">
      <header className="bg-white border-b px-4 lg:px-6 py-4 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3 w-full lg:w-auto">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><CalculatorIcon size={20}/></div>
            <h1 className="text-xl font-black text-slate-900 uppercase">Crea<span className="text-indigo-600">Stickers</span></h1>
          </div>
          <nav className="flex items-center bg-slate-100 p-1 rounded-2xl border w-full lg:w-auto overflow-x-auto no-scrollbar-mobile">
            {['dash', 'presupuestar', 'pedidos', 'clients', 'config'].map((t) => (
              <button key={t} onClick={() => setActiveTab(t as Tab)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${activeTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                {t === 'dash' ? 'Inicio' : t === 'presupuestar' ? 'Presu' : t === 'clients' ? 'Clientes' : t}
              </button>
            ))}
          </nav>
          <div className="hidden lg:flex items-center gap-3">
             {session?.user ? (
               <button onClick={() => askConfirmation("Cerrar Sesión", "¿Desconectar taller?", () => supabase?.auth.signOut())} className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 border border-emerald-200 px-5 py-3 rounded-full">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 {session.user.email?.split('@')[0]} <LogOutIcon size={12}/>
               </button>
             ) : (
               <button onClick={() => setIsAuthModalOpen(true)} className="bg-indigo-600 text-white px-8 py-3 rounded-full font-black text-[11px] uppercase shadow-xl flex items-center gap-2 transition-all hover:scale-105"><CloudIcon size={16}/> Sincronizar</button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 lg:p-10 overflow-x-hidden">
        {activeTab === 'dash' && (
           <div className="space-y-6 lg:space-y-10">
              {session?.user && (
                <div className="bg-indigo-600 rounded-[2rem] p-6 lg:p-10 flex flex-col md:flex-row items-center justify-between gap-6 text-white shadow-2xl">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center shrink-0"><CloudUploadIcon size={24}/></div>
                      <div>
                         <h3 className="text-xl font-black uppercase mb-1">Nube Conectada</h3>
                         <p className="text-indigo-100 text-xs font-bold opacity-80 uppercase">Datos protegidos en tiempo real.</p>
                      </div>
                   </div>
                   <button disabled={isMigrating} onClick={pushLocalDataToCloud} className="bg-white text-indigo-600 px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl flex items-center gap-2">
                     {isMigrating ? <Loader2Icon className="animate-spin" size={18}/> : <><RefreshCwIcon size={16}/> Forzar Sincro</>}
                   </button>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 lg:gap-8">
                 {appData.statuses.map(s => (
                   <div key={s.id} className="bg-white p-6 lg:p-10 rounded-[2.5rem] border shadow-sm flex flex-col items-center group transition-all hover:border-indigo-200">
                      <div className={`w-3 h-3 rounded-full ${s.color} mb-4`}></div>
                      <div className="text-4xl font-black text-slate-900 mb-2">{appData.orders.filter(o => o.status_id === s.id).length}</div>
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
                <h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mb-6"><Settings2Icon size={16}/> Configuración</h2>
                <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Pliego (cm)</label><input type="number" value={appData.sheetWidth} onChange={e => updateData('sheetWidth', Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-xl font-bold" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Margen %</label><input type="number" value={appData.profitMargin} onChange={e => updateData('profitMargin', Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-xl font-bold" /></div>
                   </div>
                   <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Espaciado (cm)</label><input type="number" step="0.1" value={appData.designSpacing} onChange={e => updateData('designSpacing', Number(e.target.value))} className="w-full bg-slate-50 p-4 rounded-xl font-bold" /></div>
                </div>
              </section>
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                <h2 className="text-indigo-600 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mb-6"><PlusIcon size={16}/> Agregar Diseño</h2>
                <div className="space-y-4">
                   <input type="text" placeholder="Nombre..." value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold" />
                   <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase text-center block">W</label><input type="number" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-xl font-bold text-center" /></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase text-center block">H</label><input type="number" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-xl font-bold text-center" /></div>
                      <div className="space-y-1"><label className="text-[9px] font-black text-slate-400 uppercase text-center block">Qty</label><input type="number" value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="w-full bg-slate-50 p-4 rounded-xl font-bold text-center" /></div>
                   </div>
                   <button onClick={() => { if(newDesign.width > 0) { updateData('designs', [...appData.designs, { ...newDesign, id: generateUUID() }]); setNewDesign({name:'', width:0, height:0, quantity:1}); } }} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase text-[10px] shadow-lg hover:bg-indigo-700 transition-all">Optimizar Pliego</button>
                </div>
              </section>
            </div>
            <div className="lg:col-span-8 space-y-10">
               <section className="bg-white rounded-[2.5rem] p-10 border shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <h2 className="font-black text-xl text-slate-900 flex items-center gap-3"><LayoutIcon className="text-indigo-500" size={20}/> Vista del Pliego</h2>
                    <div className="bg-slate-900 text-white px-5 py-2.5 rounded-xl font-black text-sm uppercase flex items-center gap-2">
                       <RulerIcon size={14} className="text-indigo-400"/> {packResult.totalLength.toFixed(1)} cm totales
                    </div>
                  </div>
                  <div className="bg-slate-950 rounded-[2rem] min-h-[400px] overflow-auto flex justify-center p-10 border-[10px] border-slate-900 shadow-inner custom-scrollbar">
                     {packResult.totalLength > 0 ? (
                        <div className="bg-white relative shadow-2xl shrink-0" style={{ width: `${appData.sheetWidth * 6}px`, height: `${packResult.totalLength * 6}px` }}>
                          {packResult.packed.map(p => (
                            <div key={p.id} className="absolute border bg-indigo-500 border-indigo-600 text-white flex items-center justify-center text-[7px] font-black overflow-hidden" title={p.name} style={{ left: `${p.x * 6}px`, top: `${p.y * 6}px`, width: `${p.width * 6}px`, height: `${p.height * 6}px` }}>
                               <span className="p-0.5 leading-none">{p.width}x{p.height}</span>
                            </div>
                          ))}
                        </div>
                     ) : <div className="text-slate-800 opacity-20 uppercase font-black py-20 text-[10px]">Sin diseños para calcular</div>}
                  </div>
               </section>
               <section className="bg-white rounded-[2.5rem] p-10 border shadow-sm overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left min-w-[600px]">
                    <thead className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                       <tr><th className="pb-4">Diseño</th><th className="text-right pb-4">Prod U.</th><th className="text-right pb-4">Venta U.</th><th className="text-right pb-4 px-6">Total</th></tr>
                    </thead>
                    <tbody className="divide-y">
                      {appData.designs.map(d => {
                        const res = calculateDetails(d);
                        const pQty = packResult.packed.filter(p => p.originalId === d.id).length;
                        return (
                          <tr key={d.id} className="group hover:bg-slate-50 transition-all">
                            <td className="py-5"><div className="font-black text-slate-900 uppercase text-xs">{d.name || 'Sin Nombre'}</div><div className="text-[9px] font-bold text-slate-400 uppercase">{d.width}x{d.height} CM • {pQty}/{d.quantity}u</div></td>
                            <td className="text-right font-black text-rose-500 text-xs">${res.unitProductionCost.toFixed(0)}</td>
                            <td className="text-right font-black text-slate-900 text-xs">${res.unitClientPrice.toFixed(0)}</td>
                            <td className="text-right py-5 px-6 font-black text-emerald-600 text-base">
                               ${res.totalClientPrice.toFixed(0)}
                               <button onClick={() => updateData('designs', appData.designs.filter(i => i.id !== d.id))} className="ml-4 text-slate-200 hover:text-rose-500 transition-all"><TrashIcon size={14}/></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200 font-black">
                        <tr><td className="py-6 px-4 uppercase text-[10px] text-slate-400">Totales ({tableTotals.qty} u.)</td><td className="text-right text-rose-600 text-lg">${tableTotals.prod.toFixed(0)}</td><td></td><td className="text-right py-6 px-6 text-emerald-700 text-3xl">${tableTotals.client.toFixed(0)}</td></tr>
                    </tfoot>
                  </table>
               </section>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
           <div className="space-y-10">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border shadow-sm">
                 <div className="relative flex-1 w-full">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                    <input type="text" placeholder="Buscar pedido o cliente..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="w-full bg-slate-50 p-4 pl-12 rounded-xl font-bold border-none text-sm" />
                 </div>
                 <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto no-scrollbar-mobile">
                    {['all', ...appData.statuses.map(s => s.id)].map(st => (
                      <button key={st} onClick={() => setStatusFilter(st)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${statusFilter === st ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-white text-slate-400 border'}`}>
                        {st === 'all' ? 'Todos' : appData.statuses.find(s => s.id === st)?.name}
                      </button>
                    ))}
                    <button onClick={() => { setEditingOrder(null); setOrderForm({order_number: String(appData.orders.length+1).padStart(4,'0'), status_id: 'hacer', client_id:'', width:0, height:0, quantity:1, category_id:'', deposit:0, details:''}); setIsOrderModalOpen(true); }} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase shadow-lg flex items-center gap-2 shrink-0 hover:scale-105 active:scale-95 transition-all"><PlusIcon size={14}/> Nuevo Pedido</button>
                 </div>
              </div>
              <div className="grid gap-6">
                 {filteredOrders.map(o => {
                   const c = appData.clients.find(cl => cl.id === o.client_id);
                   const s = appData.statuses.find(st => st.id === o.status_id);
                   const cat = appData.categories.find(cat => cat.id === o.category_id);
                   return (
                     <div key={o.id} className="bg-white rounded-[2rem] p-6 border shadow-sm flex flex-col gap-6 group hover:border-indigo-100 transition-all overflow-hidden">
                        <div className="flex items-center gap-6">
                           <div className={`w-14 h-14 rounded-2xl ${s?.color} text-white flex flex-col items-center justify-center font-black shrink-0 shadow-inner`}><span className="text-[8px] opacity-60 uppercase">Ticket</span><span className="text-sm">#{o.order_number}</span></div>
                           <div className="flex-1 min-w-0">
                              <div className="font-black text-slate-900 uppercase text-base truncate">{c?.name || 'Cliente Desconocido'}</div>
                              <div className="flex flex-wrap items-center gap-2 mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-white ${s?.color} text-[8px] font-black uppercase`}>{s?.name}</span>
                                <span className="bg-slate-100 px-2 py-0.5 rounded-full text-[8px] font-black uppercase">{cat?.name}</span>
                                <span className="text-[10px] text-slate-400 font-bold uppercase">{o.width}x{o.height}cm • {o.quantity}u</span>
                              </div>
                           </div>
                        </div>

                        {o.details && (
                          <div className="bg-indigo-50/50 p-4 rounded-2xl border border-indigo-100">
                             <div className="flex items-center gap-2 text-indigo-600 font-black text-[9px] uppercase mb-1.5"><ClipboardListIcon size={12}/> Detalles Adicionales</div>
                             <p className="text-slate-600 text-xs font-medium leading-relaxed whitespace-pre-wrap">{o.details}</p>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap items-center justify-between gap-6 pt-6 border-t border-slate-50">
                           <div className="flex items-center gap-8 overflow-x-auto no-scrollbar-mobile flex-1">
                              <div><div className="text-[8px] font-black text-slate-400 uppercase">Seña</div><div className="font-black text-emerald-600 text-xs">$ {o.deposit.toLocaleString()}</div></div>
                              <div><div className="text-[8px] font-black text-rose-300 uppercase">A cobrar</div><div className="font-black text-rose-500 text-sm">$ {o.balance.toLocaleString()}</div></div>
                              <div className="border-l pl-6"><div className="text-[8px] font-black text-slate-400 uppercase">Total</div><div className="font-black text-slate-900 text-xl">$ {o.total_price.toLocaleString()}</div></div>
                           </div>
                           <div className="flex gap-2 shrink-0">
                              <button onClick={() => setShowSummary(o)} className="p-3.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Share2Icon size={18}/></button>
                              <button onClick={() => { setEditingOrder(o); setOrderForm(o); setIsOrderModalOpen(true); }} className="p-3.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all"><Edit3Icon size={18}/></button>
                              <button onClick={() => askConfirmation("Eliminar Pedido", `¿Borrar ticket #${o.order_number}?`, () => deleteOrder(o.id))} className="p-3.5 text-slate-200 hover:text-rose-500 transition-all"><TrashIcon size={18}/></button>
                           </div>
                        </div>
                     </div>
                   );
                 })}
                 {filteredOrders.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase text-[10px]">Sin pedidos registrados</div>}
              </div>
           </div>
        )}

        {activeTab === 'clients' && (
           <div className="space-y-10">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border shadow-sm">
                 <div className="relative flex-1 w-full">
                    <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16}/>
                    <input type="text" placeholder="Buscar por nombre o celular..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full bg-slate-50 p-4 pl-12 rounded-xl font-bold border-none text-sm" />
                 </div>
                 <button onClick={() => { setClientForm({}); setIsClientModalOpen(true); }} className="w-full lg:w-auto bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all"><PlusIcon size={16}/> Nuevo Cliente</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredClients.map(c => (
                   <div key={c.id} className="bg-white rounded-[2rem] p-6 border shadow-sm flex flex-col group hover:border-indigo-100 transition-all overflow-hidden">
                      <div className="flex items-center gap-4 mb-4">
                         <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 uppercase">{c.name?.charAt(0)}</div>
                         <div className="min-w-0">
                            <div className="font-black text-slate-900 uppercase text-sm truncate">{c.name}</div>
                            <div className="font-black text-emerald-500 text-[10px] flex items-center gap-1 mt-0.5"><MessageCircleIcon size={12}/> {c.phone}</div>
                         </div>
                      </div>
                      <div className="mt-auto space-y-4 pt-4 border-t border-slate-50">
                         {c.address && (
                           <div className="flex items-start gap-2 text-slate-400 text-[10px] font-bold uppercase leading-tight bg-slate-50 p-3 rounded-xl truncate">
                              <MapPinIcon size={12} className="shrink-0 mt-0.5 text-slate-300" />
                              <span>{c.address}</span>
                           </div>
                         )}
                         <div className="flex items-center justify-between gap-2">
                            <button onClick={() => { setClientForm(c); setIsClientModalOpen(true); }} className="p-3 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center flex-1 gap-2 font-black text-[10px] uppercase shadow-sm">
                               <Edit3Icon size={14}/> Editar
                            </button>
                            <button onClick={() => askConfirmation("Borrar Cliente", `¿Eliminar a ${c.name}?`, () => deleteClient(c.id))} className="p-3 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center flex-1 gap-2 font-black text-[10px] uppercase shadow-sm">
                               <TrashIcon size={14}/> Borrar
                            </button>
                         </div>
                      </div>
                   </div>
                 ))}
                 {filteredClients.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase text-[10px] col-span-full">Sin clientes para mostrar</div>}
              </div>
           </div>
        )}

        {activeTab === 'config' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><TagIcon size={16}/> Categorías</h2>
                    <button onClick={() => updateData('categories', [...appData.categories, { id: generateUUID(), name: 'NUEVA', pricePerUnit: 0 }])} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg transition-all hover:bg-indigo-100"><PlusIcon size={16}/></button>
                 </div>
                 <div className="space-y-4">
                    {appData.categories.map((cat, idx) => (
                      <div key={cat.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border group hover:border-indigo-100 transition-all">
                         <input type="text" value={cat.name} onChange={e => { const nc = [...appData.categories]; nc[idx].name = e.target.value; updateData('categories', nc); }} className="flex-1 bg-transparent font-black text-[10px] uppercase outline-none" />
                         <div className="font-black text-indigo-600 text-xs">$ <input type="number" value={cat.pricePerUnit} onChange={e => { const nc = [...appData.categories]; nc[idx].pricePerUnit = Number(e.target.value); updateData('categories', nc); }} className="w-16 bg-transparent text-right outline-none" /></div>
                         <button onClick={() => deleteCategory(cat.id)} className="text-slate-200 hover:text-rose-500 transition-all"><TrashIcon size={14}/></button>
                      </div>
                    ))}
                 </div>
              </section>
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><LayersIcon size={16}/> Tarifas por Largo</h2>
                    <button onClick={() => updateData('costTiers', [...appData.costTiers, { id: generateUUID(), minLargo: 0, maxLargo: 0, precioPorCm: 0 }])} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg transition-all hover:bg-indigo-100"><PlusIcon size={16}/></button>
                 </div>
                 <div className="space-y-3">
                    {appData.costTiers.map((t, idx) => (
                      <div key={t.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border hover:border-indigo-100 transition-all">
                         <input type="number" value={t.minLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].minLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-12 bg-white rounded p-1 text-[9px] font-black text-center border" />
                         <span className="text-slate-300">→</span>
                         <input type="number" value={t.maxLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].maxLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-12 bg-white rounded p-1 text-[9px] font-black text-center border" />
                         <div className="flex-1 text-right font-black text-indigo-600 text-xs">$ <input type="number" value={t.precioPorCm} onChange={e => { const nt = [...appData.costTiers]; nt[idx].precioPorCm = Number(e.target.value); updateData('costTiers', nt); }} className="w-16 bg-transparent text-right outline-none" /></div>
                         <button onClick={() => deleteTier(t.id)} className="text-slate-200 hover:text-rose-500 transition-all"><TrashIcon size={14}/></button>
                      </div>
                    ))}
                 </div>
              </section>
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><PercentIcon size={16}/> Descuentos Qty</h2>
                    <button onClick={() => updateData('quantityDiscounts', [...appData.quantityDiscounts, { id: generateUUID(), minQty: 0, maxQty: 0, discountPercent: 0 }])} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg transition-all hover:bg-indigo-100"><PlusIcon size={16}/></button>
                 </div>
                 <div className="space-y-3">
                    {appData.quantityDiscounts.map((d, idx) => (
                      <div key={d.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border hover:border-emerald-100 transition-all">
                         <input type="number" value={d.minQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].minQty = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-12 bg-white rounded p-1 text-[9px] font-black text-center border" />
                         <span className="text-slate-300">→</span>
                         <input type="number" value={d.maxQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].maxQty = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-12 bg-white rounded p-1 text-[9px] font-black text-center border" />
                         <div className="flex-1 text-right font-black text-emerald-600 text-xs"><input type="number" value={d.discountPercent} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].discountPercent = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-10 bg-transparent text-right outline-none" />%</div>
                         <button onClick={() => deleteDiscount(d.id)} className="text-slate-200 hover:text-rose-500 transition-all"><TrashIcon size={14}/></button>
                      </div>
                    ))}
                 </div>
              </section>
           </div>
        )}
      </main>

      {/* Modales */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-[2rem] p-10 shadow-2xl relative">
              <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900"><XIcon size={20}/></button>
              <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-3"><CloudIcon className="text-indigo-600"/> Cuenta Taller</h2>
              <form onSubmit={async (e) => {
                e.preventDefault();
                setAuthLoading(true);
                try {
                  const { data, error } = await supabase!.auth.signInWithPassword({ email: authEmail, password: authPassword });
                  if (error) throw error;
                  setIsAuthModalOpen(false);
                  if (data.user) fetchCloudData(data.user.id);
                } catch (err: any) { alert(err.message); } finally { setAuthLoading(false); }
              }} className="space-y-4">
                 <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-2 border-slate-200" placeholder="Email taller" />
                 <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-2 border-slate-200" placeholder="Contraseña" />
                 <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase text-[10px] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">{authLoading ? 'Conectando...' : 'Iniciar Sesión'}</button>
              </form>
           </div>
        </div>
      )}

      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative">
              <h2 className="text-xl font-black uppercase mb-8 flex items-center gap-3"><UsersIcon/> Cliente</h2>
              <div className="space-y-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre Completo</label><input type="text" value={clientForm.name || ''} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-2 border-slate-200" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">WhatsApp / Tel</label><input type="text" value={clientForm.phone || ''} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-2 border-slate-200" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Dirección de Entrega</label><input type="text" value={clientForm.address || ''} onChange={e => setClientForm({...clientForm, address: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-2 border-slate-200" /></div>
                 <div className="pt-4 flex gap-4"><button onClick={() => setIsClientModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase text-xs">Cerrar</button><button onClick={saveClient} className="flex-[2] bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg active:scale-95 transition-all uppercase text-[10px]">Guardar Cliente</button></div>
              </div>
           </div>
        </div>
      )}

      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar-mobile">
              <h2 className="text-xl font-black uppercase mb-6 flex items-center gap-3"><PackageIcon/> {editingOrder ? 'Editar' : 'Nuevo'} Pedido</h2>
              <div className="space-y-5">
                 <div className="grid grid-cols-2 gap-4">
                    <input type="text" value={orderForm.order_number} onChange={e => setOrderForm({...orderForm, order_number: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-2 border-slate-200" placeholder="Nº Ticket" />
                    <select value={orderForm.status_id} onChange={e => setOrderForm({...orderForm, status_id: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-2 border-slate-200">{appData.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                 </div>
                 <select value={orderForm.client_id} onChange={e => setOrderForm({...orderForm, client_id: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-2 border-slate-200">
                   <option value="">Seleccionar Cliente...</option>
                   {appData.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
                 <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase text-center block">Ancho</label><input type="number" value={orderForm.width || ''} onChange={e => setOrderForm({...orderForm, width: Number(e.target.value)})} className="w-full bg-slate-50 p-3 rounded-xl font-black text-center border-2 border-slate-200" /></div>
                    <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase text-center block">Alto</label><input type="number" value={orderForm.height || ''} onChange={e => setOrderForm({...orderForm, height: Number(e.target.value)})} className="w-full bg-slate-50 p-3 rounded-xl font-black text-center border-2 border-slate-200" /></div>
                    <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase text-center block">Cant.</label><input type="number" value={orderForm.quantity || ''} onChange={e => setOrderForm({...orderForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 p-3 rounded-xl font-black text-center border-2 border-slate-200" /></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <select value={orderForm.category_id} onChange={e => setOrderForm({...orderForm, category_id: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-2 border-slate-200">
                      <option value="">Tipo...</option>
                      {appData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <input type="number" placeholder="Seña $" value={orderForm.deposit || ''} onChange={e => setOrderForm({...orderForm, deposit: Number(e.target.value)})} className="w-full bg-emerald-50 p-4 rounded-xl font-black text-emerald-700 border-2 border-emerald-100" />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2">Detalles del Trabajo</label>
                    <textarea value={orderForm.details || ''} onChange={e => setOrderForm({...orderForm, details: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold text-xs h-28 resize-none border-2 border-slate-200" placeholder="Escribe aquí las especificaciones..."></textarea>
                 </div>
                 <div className="pt-4 flex gap-4"><button onClick={() => setIsOrderModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase text-xs">Cerrar</button><button onClick={saveOrder} className="flex-[2] bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg uppercase text-[10px] hover:bg-indigo-700 transition-all">Confirmar Pedido</button></div>
              </div>
           </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-sm z-[200] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative text-center">
              <button onClick={() => setShowSummary(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900"><XIcon size={24}/></button>
              <h2 className="font-black text-lg uppercase mb-6">Detalle de Ticket</h2>
              <div className="space-y-3 border-y py-6 mb-8 text-left text-xs uppercase font-bold">
                 <div className="flex justify-between"><span>Ticket:</span><span className="text-slate-900">#{showSummary.order_number}</span></div>
                 <div className="flex justify-between"><span>Cliente:</span><span className="text-slate-900">{appData.clients.find(c => c.id === showSummary.client_id)?.name}</span></div>
                 <div className="flex justify-between"><span>Detalle:</span><span className="text-slate-900">{appData.categories.find(c => c.id === showSummary.category_id)?.name}</span></div>
                 <div className="flex justify-between"><span>Medida:</span><span className="text-slate-900">{showSummary.width}x{showSummary.height}CM ({showSummary.quantity}u)</span></div>
                 {showSummary.details && <div className="pt-2 border-t mt-2"><span className="text-slate-400 block mb-1">Notas:</span><span className="text-slate-800 lowercase first-letter:uppercase">{showSummary.details}</span></div>}
                 <div className="flex justify-between pt-4 border-t-2 text-indigo-600 text-xl font-black"><span>Total:</span><span>${showSummary.total_price.toLocaleString()}</span></div>
                 <div className="flex justify-between text-emerald-600"><span>Abonado:</span><span>${showSummary.deposit.toLocaleString()}</span></div>
                 <div className="flex justify-between text-rose-500 text-lg"><span>Saldo:</span><span>${showSummary.balance.toLocaleString()}</span></div>
              </div>
              <button onClick={() => {
                const c = appData.clients.find(cl => cl.id === showSummary.client_id);
                const text = `*Ticket #${showSummary.order_number}*\n\n` +
                             `*Cliente:* ${c?.name}\n` +
                             `*Medida:* ${showSummary.width}x${showSummary.height}cm (${showSummary.quantity}u)\n` +
                             (showSummary.details ? `*Notas:* ${showSummary.details}\n` : '') +
                             `*Total:* $${showSummary.total_price.toLocaleString()}\n` +
                             `*Seña:* $${showSummary.deposit.toLocaleString()}\n` +
                             `*Saldo:* $${showSummary.balance.toLocaleString()}`;
                window.open(`https://wa.me/${c?.phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank');
              }} className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg uppercase text-xs hover:bg-emerald-600 transition-all"><MessageCircleIcon size={20}/> Enviar por WhatsApp</button>
           </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[300] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-xs rounded-[2rem] p-8 shadow-2xl text-center">
              <AlertTriangleIcon size={40} className="text-rose-500 mx-auto mb-4"/>
              <h3 className="font-black text-slate-900 uppercase mb-2 text-sm">{confirmModal.title}</h3>
              <p className="text-slate-500 text-xs mb-8">{confirmModal.message}</p>
              <div className="flex gap-3"><button onClick={() => setConfirmModal(null)} className="flex-1 py-3.5 bg-slate-50 rounded-xl font-black text-[10px] uppercase">Cancelar</button><button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-3.5 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg">Confirmar</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
