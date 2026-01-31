
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  Settings2Icon, 
  LayoutIcon, 
  CalculatorIcon, 
  TagIcon, 
  LayersIcon, 
  CheckCircle2Icon,
  UsersIcon,
  PackageIcon,
  SearchIcon,
  Share2Icon,
  MessageCircleIcon,
  Edit3Icon,
  XIcon,
  FilterIcon,
  PhoneIcon,
  MapPinIcon,
  PercentIcon,
  AlertTriangleIcon,
  CloudIcon,
  LogInIcon,
  LogOutIcon,
  Loader2Icon,
  RulerIcon,
  CloudOffIcon,
  AlertCircleIcon,
  SettingsIcon,
  ShieldAlertIcon,
  ClockIcon,
  PartyPopperIcon,
  CloudUploadIcon,
  RefreshCwIcon,
  TrendingUpIcon
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

const MASTER_KEY = 'graficapro_enterprise_v11';

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

  // Missing states for search, filters, modals and forms
  const [clientSearch, setClientSearch] = useState('');
  const [orderSearch, setOrderSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<Partial<Client>>({});
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderForm, setOrderForm] = useState<Partial<Order>>({
    order_number: '',
    status_id: 'hacer',
    client_id: '',
    width: 0,
    height: 0,
    quantity: 1,
    category_id: '',
    deposit: 0
  });

  const ensureISO = (val: any): string => {
    if (!val) return new Date().toISOString();
    if (typeof val === 'number') return new Date(val).toISOString();
    return String(val).length < 10 ? new Date().toISOString() : val;
  };

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem(MASTER_KEY);
      if (saved) {
        try {
          let parsed = JSON.parse(saved);
          if (parsed.clients) parsed.clients = parsed.clients.map((c: any) => ({ ...c, id: toSafeUUID(c.id), created_at: ensureISO(c.created_at) }));
          if (parsed.orders) parsed.orders = parsed.orders.map((o: any) => ({ ...o, id: toSafeUUID(o.id), client_id: toSafeUUID(o.client_id), category_id: toSafeUUID(o.category_id), created_at: ensureISO(o.created_at) }));
          if (parsed.categories) parsed.categories = parsed.categories.map((cat: any) => ({ ...cat, id: toSafeUUID(cat.id) }));
          setAppData(prev => ({ ...prev, ...parsed }));
        } catch (e) { }
      }
      if (!supabase) { setLoading(false); return; }
      try {
        const { data: { session: cur } } = await supabase.auth.getSession();
        setSession(cur);
        if (cur?.user) await fetchCloudData(cur.user.id);
      } catch (e) { }
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
      const [{ data: setts }, { data: cls }, { data: ords }, { data: cats }] = await Promise.all([
        supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('clients').select('*').eq('user_id', userId),
        supabase.from('orders').select('*').eq('user_id', userId),
        supabase.from('categories').select('*').eq('user_id', userId)
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

  const pushLocalDataToCloud = async () => {
    if (!supabase || !session?.user) return;
    setIsMigrating(true);
    try {
      if (appData.categories.length > 0) {
        const catsToUpload = appData.categories.map(cat => ({
          id: toSafeUUID(cat.id),
          name: cat.name,
          price_per_unit: cat.pricePerUnit,
          user_id: session.user.id
        }));
        await supabase.from('categories').upsert(catsToUpload);
      }
      if (appData.clients.length > 0) {
        const clsToUpload = appData.clients.map(c => ({
          id: toSafeUUID(c.id),
          name: c.name,
          phone: c.phone,
          address: c.address,
          created_at: ensureISO(c.created_at),
          user_id: session.user.id
        }));
        await supabase.from('clients').upsert(clsToUpload);
      }
      if (appData.orders.length > 0) {
        const ordsToUpload = appData.orders.map(o => ({
          id: toSafeUUID(o.id),
          order_number: o.order_number,
          client_id: toSafeUUID(o.client_id),
          category_id: toSafeUUID(o.category_id),
          width: o.width,
          height: o.height,
          quantity: o.quantity,
          total_price: o.total_price,
          deposit: o.deposit,
          balance: o.balance,
          status_id: o.status_id,
          created_at: ensureISO(o.created_at),
          user_id: session.user.id
        }));
        await supabase.from('orders').upsert(ordsToUpload);
      }
      await supabase.from('settings').upsert({
        user_id: session.user.id,
        sheet_width: appData.sheetWidth,
        profit_margin: appData.profitMargin,
        design_spacing: appData.designSpacing,
        updated_at: new Date().toISOString()
      });
      alert("✅ Datos sincronizados correctamente.");
      await fetchCloudData(session.user.id);
    } catch (err: any) {
      alert("❌ Error al sincronizar: " + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  // Missing handleAuth function
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) {
        const { error: signUpError } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
        if (signUpError) throw signUpError;
      }
      setIsAuthModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    localStorage.setItem(MASTER_KEY, JSON.stringify(appData));
  }, [appData, loading]);

  const updateData = (field: keyof AppDataType, value: any) => {
    setAppData(prev => ({ ...prev, [field]: value }));
  };

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ title, message, onConfirm });
  };

  // Presupuestador Logic
  const packResult = useMemo(() => {
    return packDesigns(appData.designs, appData.sheetWidth, appData.designSpacing);
  }, [appData.designs, appData.sheetWidth, appData.designSpacing]);
  
  const currentPricePerCm = useMemo(() => {
    const l = packResult.totalLength;
    const tier = appData.costTiers.find((t: CostTier) => l >= t.minLargo && l < t.maxLargo);
    return tier ? tier.precioPorCm : (appData.costTiers[appData.costTiers.length - 1]?.precioPorCm || 0);
  }, [packResult.totalLength, appData.costTiers]);

  const calculateDetails = useCallback((item: DesignItem): CalculationResult => {
    if (packResult.totalLength <= 0 || packResult.totalAreaUsed <= 0) {
        return { unitProductionCost: 0, unitClientPrice: 0, totalProductionCost: 0, totalClientPrice: 0 };
    }
    
    const totalSheetCost = packResult.totalLength * currentPricePerCm;
    
    // Filtramos exactamente cuántas unidades de este diseño fueron empaquetadas
    const packedUnits = packResult.packed.filter(p => p.originalId === item.id);
    const actualPackedQuantity = packedUnits.length;
    
    if (actualPackedQuantity === 0) {
        return { unitProductionCost: 0, unitClientPrice: 0, totalProductionCost: 0, totalClientPrice: 0 };
    }

    // Área real de las unidades de este diseño que se empaquetaron
    const itemPackedArea = packedUnits.reduce((acc, p) => acc + (p.width * p.height), 0);
    
    // Proporción del costo total basada en el área ocupada
    const totalProdCost = (itemPackedArea / packResult.totalAreaUsed) * totalSheetCost;
    const unitProdCost = totalProdCost / actualPackedQuantity;
    
    // Aplicar descuento por cantidad basado en la cantidad original solicitada
    const discount = appData.quantityDiscounts.find(q => item.quantity >= q.minQty && item.quantity <= q.maxQty);
    const discFactor = discount ? (1 - discount.discountPercent / 100) : 1;
    
    const unitClientPrice = unitProdCost * (1 + (appData.profitMargin / 100)) * discFactor;
    
    return { 
        unitProductionCost: unitProdCost, 
        unitClientPrice: unitClientPrice, 
        totalProductionCost: totalProdCost, 
        totalClientPrice: unitClientPrice * actualPackedQuantity 
    };
  }, [packResult, currentPricePerCm, appData.profitMargin, appData.quantityDiscounts]);

  const tableTotals = useMemo(() => {
    return appData.designs.reduce((acc, d) => {
        const res = calculateDetails(d);
        const packedQty = packResult.packed.filter(p => p.originalId === d.id).length;
        return {
            prod: acc.prod + res.totalProductionCost,
            client: acc.client + res.totalClientPrice,
            qty: acc.qty + packedQty
        };
    }, { prod: 0, client: 0, qty: 0 });
  }, [appData.designs, calculateDetails, packResult.packed]);

  const addDesign = () => {
    if (newDesign.width <= 0 || newDesign.height <= 0 || newDesign.quantity <= 0) return;
    updateData('designs', [...appData.designs, { ...newDesign, id: generateUUID(), name: newDesign.name || 'S/N' } as DesignItem]);
    setNewDesign({ name: '', width: 0, height: 0, quantity: 1 });
  };

  // Deletions
  const deleteClient = async (id: string) => {
    updateData('clients', appData.clients.filter(cl => cl.id !== id));
    if (supabase && session?.user) {
      await supabase.from('clients').delete().eq('id', toSafeUUID(id));
    }
  };

  // Missing saveClient function
  const saveClient = async () => {
    const client = clientForm.id 
      ? { ...clientForm } as Client 
      : { ...clientForm, id: generateUUID(), created_at: new Date().toISOString() } as Client;
    
    updateData('clients', clientForm.id ? appData.clients.map(c => c.id === client.id ? client : c) : [...appData.clients, client]);
    if (supabase && session?.user) {
      await supabase.from('clients').upsert({ 
        ...client, 
        id: toSafeUUID(client.id), 
        user_id: session.user.id 
      });
    }
    setIsClientModalOpen(false);
  };

  const deleteOrder = async (id: string) => {
    updateData('orders', appData.orders.filter(ord => ord.id !== id));
    if (supabase && session?.user) {
      await supabase.from('orders').delete().eq('id', toSafeUUID(id));
    }
  };

  const saveOrder = async () => {
    const cat = appData.categories.find(c => c.id === orderForm.category_id);
    const total = (cat?.pricePerUnit || 0) * (orderForm.quantity || 0);
    const dep = orderForm.deposit || 0;
    const order: Order = editingOrder 
      ? { ...editingOrder, ...orderForm, total_price: total, balance: total - dep } as Order 
      : { ...orderForm, id: generateUUID(), total_price: total, balance: total - dep, created_at: new Date().toISOString() } as Order;
    
    updateData('orders', editingOrder ? appData.orders.map(o => o.id === order.id ? order : o) : [...appData.orders, order]);
    if (supabase && session?.user) {
      await supabase.from('orders').upsert({ 
        ...order, 
        id: toSafeUUID(order.id), 
        client_id: toSafeUUID(order.client_id), 
        category_id: toSafeUUID(order.category_id), 
        user_id: session.user.id 
      });
    }
    setIsOrderModalOpen(false);
  };

  // Missing handleNewOrder function
  const handleNewOrder = () => {
    setEditingOrder(null);
    setOrderForm({
      order_number: String(appData.orders.length + 1).padStart(4, '0'),
      status_id: 'hacer',
      client_id: '',
      width: 0,
      height: 0,
      quantity: 1,
      category_id: '',
      deposit: 0
    });
    setIsOrderModalOpen(true);
  };

  const filteredOrders = useMemo(() => {
    const s = orderSearch.toLowerCase();
    return appData.orders.filter(o => {
      const client = appData.clients.find(c => c.id === o.client_id);
      const matchesText = (client?.name || '').toLowerCase().includes(s) || (o.order_number || '').includes(s);
      const matchesStatus = statusFilter === 'all' || o.status_id === statusFilter;
      return matchesText && matchesStatus;
    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [appData.orders, appData.clients, orderSearch, statusFilter]);

  // Missing filteredClients logic
  const filteredClients = useMemo(() => {
    const s = clientSearch.toLowerCase();
    return appData.clients.filter(c => 
      (c.name || '').toLowerCase().includes(s) || 
      (c.phone || '').toLowerCase().includes(s)
    );
  }, [appData.clients, clientSearch]);

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2Icon className="animate-spin text-indigo-600" size={48}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg"><CalculatorIcon size={24}/></div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">Crea<span className="text-indigo-600">Stickers</span></h1>
          </div>
          <nav className="flex items-center bg-slate-100 p-1 rounded-2xl border overflow-x-auto">
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
              {session?.user && (appData.clients.length > 0 || appData.orders.length > 0) && (
                <div className="bg-indigo-600 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 text-white shadow-2xl">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center"><CloudUploadIcon size={32}/></div>
                      <div className="max-w-md">
                         <h3 className="text-xl font-black uppercase mb-1">Backup Disponible</h3>
                         <p className="text-indigo-100 text-xs font-bold opacity-80 uppercase tracking-widest leading-relaxed">Sube tus datos locales para acceder desde cualquier dispositivo.</p>
                      </div>
                   </div>
                   <button disabled={isMigrating} onClick={pushLocalDataToCloud} className="bg-white text-indigo-600 px-10 py-5 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">
                     {isMigrating ? <Loader2Icon className="animate-spin" size={18}/> : 'Subir a la Nube'}
                   </button>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                 {appData.statuses.map(s => (
                   <div key={s.id} className="bg-white p-10 rounded-[3rem] border shadow-sm flex flex-col items-center group transition-all hover:border-indigo-200">
                      <div className={`w-4 h-4 rounded-full ${s.color} mb-4`}></div>
                      <div className="text-5xl font-black text-slate-900 mb-2">{appData.orders.filter(o => o.status_id === s.id).length}</div>
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
                   <input type="text" placeholder="Nombre (ej. Logo Empresa)..." value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none" />
                   <div className="grid grid-cols-3 gap-3">
                      <input type="number" placeholder="Ancho" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="bg-slate-50 p-4 rounded-xl font-bold text-center border-none" />
                      <input type="number" placeholder="Alto" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="bg-slate-50 p-4 rounded-xl font-bold text-center border-none" />
                      <input type="number" placeholder="Cant" value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="bg-slate-50 p-4 rounded-xl font-bold text-center border-none" />
                   </div>
                   <button onClick={addDesign} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase text-[11px] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Optimizar Pliego</button>
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
                          {packResult.packed.map(p => (
                            <div key={p.id} className="absolute border bg-indigo-500 border-indigo-600 text-white flex items-center justify-center text-[7px] font-black overflow-hidden" title={p.name} style={{ left: `${p.x * 6}px`, top: `${p.y * 6}px`, width: `${p.width * 6}px`, height: `${p.height * 6}px` }}>
                               <span className="p-0.5 leading-none">{p.width}x{p.height}</span>
                            </div>
                          ))}
                        </div>
                     ) : <div className="text-slate-800 opacity-20 uppercase font-black py-20">Ingresa diseños para empaquetar</div>}
                  </div>
               </section>
               <section className="bg-white rounded-[2.5rem] p-10 border shadow-sm overflow-x-auto custom-scrollbar">
                  <table className="w-full text-left">
                    <thead className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                       <tr>
                         <th className="pb-4">Diseño</th>
                         <th className="text-right pb-4">Costo Prod.</th>
                         <th className="text-right pb-4">Venta Unit.</th>
                         <th className="text-right pb-4 px-6">Total Venta</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y">
                      {appData.designs.map(d => {
                        const res = calculateDetails(d);
                        const packedQty = packResult.packed.filter(p => p.originalId === d.id).length;
                        return (
                          <tr key={d.id} className="group">
                            <td className="py-6"><div className="font-black text-slate-900 uppercase text-xs">{d.name}</div><div className="text-[10px] font-bold text-slate-400 uppercase">{d.width}x{d.height} CM • EMPAQUETADO: {packedQty}/{d.quantity}</div></td>
                            <td className="text-right font-black text-rose-500 text-sm">${res.totalProductionCost.toFixed(0)}</td>
                            <td className="text-right font-black text-slate-900 text-sm">${res.unitClientPrice.toFixed(0)}</td>
                            <td className="text-right py-6 px-6 font-black text-emerald-600 text-lg">
                               ${res.totalClientPrice.toFixed(0)}
                               <button onClick={() => updateData('designs', appData.designs.filter(i => i.id !== d.id))} className="ml-4 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon size={16}/></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50">
                        <tr className="border-t-2 border-slate-200">
                            <td className="py-6 px-4 font-black text-slate-400 uppercase text-[10px]">Totales ({tableTotals.qty} u.)</td>
                            <td className="text-right font-black text-rose-600 text-xl">${tableTotals.prod.toFixed(0)}</td>
                            <td></td>
                            <td className="text-right py-6 px-6 font-black text-emerald-700 text-3xl">${tableTotals.client.toFixed(0)}</td>
                        </tr>
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
                    <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                    <input type="text" placeholder="Buscar pedido por número o cliente..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="w-full bg-slate-50 p-4 pl-14 rounded-xl font-bold border-none" />
                 </div>
                 <div className="flex items-center gap-2 overflow-x-auto w-full lg:w-auto custom-scrollbar">
                    {['all', ...appData.statuses.map(s => s.id)].map(st => (
                      <button key={st} onClick={() => setStatusFilter(st)} className={`px-5 py-3 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${statusFilter === st ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border'}`}>
                        {st === 'all' ? 'Todos' : appData.statuses.find(s => s.id === st)?.name}
                      </button>
                    ))}
                    <button onClick={handleNewOrder} className="bg-indigo-600 text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 ml-4 hover:scale-105 active:scale-95 transition-all"><PlusIcon size={16}/> Cargar</button>
                 </div>
              </div>
              <div className="grid gap-4">
                 {filteredOrders.map(o => {
                   const c = appData.clients.find(cl => cl.id === o.client_id);
                   const s = appData.statuses.find(st => st.id === o.status_id);
                   const cat = appData.categories.find(cat => cat.id === o.category_id);
                   return (
                     <div key={o.id} className="bg-white rounded-[2rem] p-6 border shadow-sm flex flex-col md:flex-row items-center gap-6 group">
                        <div className="flex-1 flex items-center gap-5 w-full">
                           <div className={`w-14 h-14 rounded-2xl ${s?.color} text-white flex flex-col items-center justify-center font-black text-[9px]`}><span className="opacity-60">Nº</span><span className="text-xs">#{o.order_number}</span></div>
                           <div>
                              <div className="font-black text-slate-900 uppercase text-sm">{c?.name || 'DESCONOCIDO'}</div>
                              <div className="text-[10px] font-bold text-slate-400 uppercase flex flex-wrap items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-white ${s?.color}`}>{s?.name}</span>
                                <span className="bg-slate-100 px-2 py-0.5 rounded-full">{cat?.name}</span>
                                {o.width}x{o.height} cm • {o.quantity} unidades
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-8 w-full md:w-auto justify-end">
                           <div className="text-right flex flex-col items-end min-w-[220px]">
                             <div className="text-[9px] font-black text-slate-400 uppercase mb-1">Costo Total</div>
                             <div className="font-black text-slate-900 text-base mb-2">$ {o.total_price.toLocaleString()}</div>
                             <div className="flex gap-4 items-center border-t border-slate-100 pt-2 w-full justify-end">
                               <div className="text-right"><div className="text-[9px] font-black text-emerald-400 uppercase">Seña</div><div className="font-black text-emerald-600 text-xs">$ {o.deposit.toLocaleString()}</div></div>
                               <div className="text-right"><div className="text-[9px] font-black text-rose-300 uppercase">Restante</div><div className="font-black text-rose-500 text-sm">$ {o.balance.toLocaleString()}</div></div>
                             </div>
                           </div>
                           <div className="flex gap-2">
                              <button onClick={() => setShowSummary(o)} title="Compartir WhatsApp" className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 transition-all"><Share2Icon size={18}/></button>
                              <button onClick={() => { setEditingOrder(o); setOrderForm(o); setIsOrderModalOpen(true); }} title="Editar Pedido" className="p-3 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 transition-all"><Edit3Icon size={18}/></button>
                              <button onClick={() => askConfirmation("Borrar Pedido", `¿Eliminar pedido #${o.order_number}? Se borrará también de la nube.`, () => deleteOrder(o.id))} title="Eliminar" className="p-3 text-slate-200 hover:text-rose-500 transition-all"><TrashIcon size={18}/></button>
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
                 <div className="relative flex-1 w-full">
                    <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                    <input type="text" placeholder="Buscar cliente por nombre o WhatsApp..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full bg-slate-50 p-4 pl-14 rounded-xl font-bold border-none" />
                 </div>
                 <button onClick={() => { setClientForm({}); setIsClientModalOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 hover:scale-105 active:scale-95 transition-all"><PlusIcon size={16}/> Nuevo Cliente</button>
              </div>
              <div className="bg-white rounded-[2rem] border overflow-hidden shadow-sm overflow-x-auto custom-scrollbar">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                       <tr><th className="px-8 py-6">Cliente</th><th className="px-8 py-6">WhatsApp</th><th className="px-8 py-6 text-right">Acciones</th></tr>
                    </thead>
                    <tbody className="divide-y">
                       {filteredClients.map(c => (
                         <tr key={c.id} className="hover:bg-slate-50 group">
                            <td className="px-8 py-6">
                               <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center font-black text-sm">{c.name?.charAt(0)}</div>
                                  <div className="font-black text-slate-900 uppercase text-xs">{c.name}</div>
                               </div>
                            </td>
                            <td className="px-8 py-6 font-black text-slate-600 text-xs">{c.phone}</td>
                            <td className="px-8 py-6 text-right opacity-0 group-hover:opacity-100 transition-all">
                               <button onClick={() => { setClientForm(c); setIsClientModalOpen(true); }} className="p-3 text-indigo-600 hover:scale-110 transition-all"><Edit3Icon size={18}/></button>
                               <button onClick={() => askConfirmation("Borrar Cliente", `¿Eliminar a ${c.name}? Se borrará también de la nube.`, () => deleteClient(c.id))} className="p-3 text-rose-500 hover:scale-110 transition-all"><TrashIcon size={18}/></button>
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
                    <h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><TagIcon size={16}/> Categorías</h2>
                    <button onClick={() => updateData('categories', [...appData.categories, { id: generateUUID(), name: 'NUEVA', pricePerUnit: 0 }])} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg transition-all hover:bg-indigo-100"><PlusIcon size={16}/></button>
                 </div>
                 <div className="space-y-4">
                    {appData.categories.map((cat, idx) => (
                      <div key={cat.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-xl border group">
                         <input type="text" value={cat.name} onChange={e => { const nc = [...appData.categories]; nc[idx].name = e.target.value; updateData('categories', nc); }} className="flex-1 bg-transparent font-black text-[10px] uppercase outline-none" />
                         <div className="font-black text-indigo-600 text-xs">$ <input type="number" value={cat.pricePerUnit} onChange={e => { const nc = [...appData.categories]; nc[idx].pricePerUnit = Number(e.target.value); updateData('categories', nc); }} className="w-16 bg-transparent text-right outline-none" /></div>
                         <button onClick={() => updateData('categories', appData.categories.filter(c => c.id !== cat.id))} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon size={14}/></button>
                      </div>
                    ))}
                 </div>
              </section>
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><LayersIcon size={16}/> Tarifas por Largo</h2>
                    <button onClick={() => updateData('costTiers', [...appData.costTiers, { id: generateUUID(), minLargo: 0, maxLargo: 0, precioPorCm: 0 }])} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg transition-all hover:bg-indigo-100"><PlusIcon size={16}/></button>
                 </div>
                 <div className="space-y-4">
                    {appData.costTiers.map((tier, idx) => (
                      <div key={tier.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border group">
                         <input type="number" title="Desde cm" value={tier.minLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].minLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-10 bg-white rounded p-1 text-[9px] font-black text-center" />
                         <span className="text-slate-300">→</span>
                         <input type="number" title="Hasta cm" value={tier.maxLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].maxLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-10 bg-white rounded p-1 text-[9px] font-black text-center" />
                         <div className="flex-1 text-right font-black text-indigo-600 text-xs">$ <input type="number" value={tier.precioPorCm} onChange={e => { const nt = [...appData.costTiers]; nt[idx].precioPorCm = Number(e.target.value); updateData('costTiers', nt); }} className="w-14 bg-transparent text-right outline-none" /></div>
                         <button onClick={() => updateData('costTiers', appData.costTiers.filter(t => t.id !== tier.id))} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon size={14}/></button>
                      </div>
                    ))}
                 </div>
              </section>
              <section className="bg-white rounded-[2rem] p-8 border shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2"><PercentIcon size={16}/> Descuentos por Qty</h2>
                    <button onClick={() => updateData('quantityDiscounts', [...appData.quantityDiscounts, { id: generateUUID(), minQty: 0, maxQty: 0, discountPercent: 0 }])} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg transition-all hover:bg-indigo-100"><PlusIcon size={16}/></button>
                 </div>
                 <div className="space-y-4">
                    {appData.quantityDiscounts.map((disc, idx) => (
                      <div key={disc.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-xl border group">
                         <input type="number" value={disc.minQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].minQty = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-10 bg-white rounded p-1 text-[9px] font-black text-center" />
                         <span className="text-slate-300">→</span>
                         <input type="number" value={disc.maxQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].maxQty = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-10 bg-white rounded p-1 text-[9px] font-black text-center" />
                         <div className="flex-1 text-right font-black text-emerald-600 text-xs"><input type="number" value={disc.discountPercent} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].discountPercent = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-10 bg-transparent text-right outline-none" />%</div>
                         <button onClick={() => updateData('quantityDiscounts', appData.quantityDiscounts.filter(d => d.id !== disc.id))} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon size={14}/></button>
                      </div>
                    ))}
                 </div>
              </section>
           </div>
        )}
      </main>

      {/* Modales */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-sm rounded-[2rem] p-10 shadow-2xl relative">
              <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900"><XIcon size={20}/></button>
              <h2 className="text-xl font-black text-slate-900 uppercase mb-6 flex items-center gap-3"><CloudIcon className="text-indigo-600"/> Cuenta Taller</h2>
              <form onSubmit={handleAuth} className="space-y-5">
                 <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none" placeholder="Email de acceso" />
                 <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 p-4 rounded-xl font-bold border-none" placeholder="Contraseña segura" />
                 <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase text-[10px] shadow-xl transition-all hover:bg-indigo-700 active:scale-95">
                    {authLoading ? 'Conectando...' : 'Iniciar Sincronización'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl relative">
              <h2 className="text-xl font-black text-slate-900 uppercase mb-8 flex items-center gap-3"><UsersIcon/> Ficha de Cliente</h2>
              <div className="space-y-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre Completo</label><input type="text" value={clientForm.name || ''} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-none" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">WhatsApp / Teléfono</label><input type="text" value={clientForm.phone || ''} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-none" placeholder="+54 9..." /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Dirección (Opcional)</label><input type="text" value={clientForm.address || ''} onChange={e => setClientForm({...clientForm, address: e.target.value})} className="w-full bg-slate-50 p-4 rounded-xl font-black border-none" /></div>
                 <div className="pt-4 flex gap-4"><button onClick={() => setIsClientModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase text-xs">Cerrar</button><button onClick={saveClient} className="flex-[2] bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg hover:bg-slate-800 active:scale-95 transition-all">Guardar Cliente</button></div>
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
                    <input type="text" value={orderForm.order_number} onChange={e => setOrderForm({...orderForm, order_number: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none" placeholder="Nº Pedido" />
                    <select value={orderForm.status_id} onChange={e => setOrderForm({...orderForm, status_id: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none">{appData.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                 </div>
                 <select value={orderForm.client_id} onChange={e => setOrderForm({...orderForm, client_id: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none">
                   <option value="">Seleccionar Cliente...</option>
                   {appData.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                 </select>
                 <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase">Ancho cm</label><input type="number" value={orderForm.width || ''} onChange={e => setOrderForm({...orderForm, width: Number(e.target.value)})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none text-center" /></div>
                    <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase">Alto cm</label><input type="number" value={orderForm.height || ''} onChange={e => setOrderForm({...orderForm, height: Number(e.target.value)})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none text-center" /></div>
                    <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase">Cantidad</label><input type="number" value={orderForm.quantity || ''} onChange={e => setOrderForm({...orderForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none text-center" /></div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase">Categoría</label><select value={orderForm.category_id} onChange={e => setOrderForm({...orderForm, category_id: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-black border-none">
                      <option value="">Categoría...</option>
                      {appData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select></div>
                    <div className="space-y-1"><label className="text-[8px] font-black text-slate-400 uppercase">Seña $</label><input type="number" value={orderForm.deposit || ''} onChange={e => setOrderForm({...orderForm, deposit: Number(e.target.value)})} className="w-full bg-emerald-50 p-3 rounded-xl font-black text-emerald-700 border-none" /></div>
                 </div>
                 <div className="pt-4 flex gap-4"><button onClick={() => setIsOrderModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase text-xs">Cancelar</button><button onClick={saveOrder} className="flex-[2] bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-700 active:scale-95 transition-all">Guardar Pedido</button></div>
              </div>
           </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-md z-[200] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative text-center">
              <button onClick={() => setShowSummary(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-all active:scale-125"><XIcon size={24}/></button>
              <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white mb-6 mx-auto"><CalculatorIcon size={36}/></div>
              <h2 className="font-black text-xl uppercase mb-6 tracking-tight">Ticket de Pedido</h2>
              <div className="space-y-4 border-y py-6 mb-8 text-left text-xs uppercase font-bold">
                 <div className="flex justify-between"><span>Pedido:</span><span className="text-slate-900">#{showSummary.order_number}</span></div>
                 <div className="flex justify-between"><span>Cliente:</span><span className="text-slate-900">{appData.clients.find(c => c.id === showSummary.client_id)?.name}</span></div>
                 <div className="flex justify-between"><span>Categoría:</span><span className="text-slate-900">{appData.categories.find(c => c.id === showSummary.category_id)?.name}</span></div>
                 <div className="flex justify-between"><span>Medidas:</span><span className="text-slate-900">{showSummary.width}x{showSummary.height} CM</span></div>
                 <div className="flex justify-between"><span>Cantidad:</span><span className="text-slate-900">{showSummary.quantity} UNIDADES</span></div>
                 <div className="flex justify-between pt-4 border-t"><span className="text-indigo-600 font-black">Total:</span><span className="text-indigo-600 text-xl font-black">${showSummary.total_price.toLocaleString()}</span></div>
                 <div className="flex justify-between text-emerald-600"><span>Seña abonada:</span><span>${showSummary.deposit.toLocaleString()}</span></div>
                 <div className="flex justify-between text-rose-500 font-black"><span>Saldo restante:</span><span>${showSummary.balance.toLocaleString()}</span></div>
              </div>
              <button onClick={() => {
                const c = appData.clients.find(cl => cl.id === showSummary.client_id);
                const cat = appData.categories.find(cat => cat.id === showSummary.category_id);
                const text = `*CreaStickers - Ticket #${showSummary.order_number}*\n\n` +
                             `*Cliente:* ${c?.name}\n` +
                             `*Detalle:* ${cat?.name} (${showSummary.width}x${showSummary.height}cm)\n` +
                             `*Cantidad:* ${showSummary.quantity} unidades\n\n` +
                             `*Total:* $${showSummary.total_price.toLocaleString()}\n` +
                             `*Seña:* $${showSummary.deposit.toLocaleString()}\n` +
                             `*Saldo:* $${showSummary.balance.toLocaleString()}`;
                window.open(`https://wa.me/${c?.phone.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank');
              }} className="w-full bg-emerald-500 text-white py-4 rounded-xl font-black flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-600 transition-all active:scale-95"><MessageCircleIcon size={18}/> Compartir por WhatsApp</button>
           </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[300] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-xs rounded-[2rem] p-8 shadow-2xl text-center">
              <AlertTriangleIcon size={32} className="text-rose-500 mx-auto mb-4"/>
              <h3 className="font-black text-slate-900 uppercase mb-2 leading-none">{confirmModal.title}</h3>
              <p className="text-slate-500 text-[10px] mb-8">{confirmModal.message}</p>
              <div className="flex gap-2"><button onClick={() => setConfirmModal(null)} className="flex-1 py-3 bg-slate-50 rounded-xl font-black text-[10px] uppercase">No, Volver</button><button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg active:scale-95 transition-all">Sí, Eliminar</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
