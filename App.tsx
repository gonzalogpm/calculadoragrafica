
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
  RulerIcon
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

const DESIGN_COLORS = [
  { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' },
  { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600' },
  { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  { bg: 'bg-amber-400', text: 'text-amber-950', border: 'border-amber-500' },
  { bg: 'bg-violet-500', text: 'text-white', border: 'border-violet-600' },
];

const MASTER_KEY = 'graficapro_enterprise_v11';

const DEFAULT_CATEGORIES: Category[] = [
  { id: '1', name: 'DE STOCK', pricePerUnit: 100 },
  { id: '2', name: 'PERS. C/FONDO', pricePerUnit: 250 },
  { id: '3', name: 'PERS. S/FONDO', pricePerUnit: 200 },
  { id: '4', name: 'CARTOON C/FONDO', pricePerUnit: 400 },
  { id: '5', name: 'CARTOON S/FONDO', pricePerUnit: 350 },
  { id: '6', name: 'PLANCHA', pricePerUnit: 1500 },
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
    { id: '1', minLargo: 0, maxLargo: 20, precioPorCm: 10000 },
    { id: '2', minLargo: 20, maxLargo: 50, precioPorCm: 8000 },
    { id: '3', minLargo: 50, maxLargo: 100, precioPorCm: 6000 },
  ],
  quantityDiscounts: [] as QuantityDiscount[],
  designs: [] as DesignItem[],
  clients: [] as Client[],
  orders: [] as Order[],
  categories: DEFAULT_CATEGORIES,
  statuses: DEFAULT_STATUSES,
};

type AppDataType = typeof DEFAULT_DATA;
type Tab = 'dash' | 'presupuestar' | 'pedidos' | 'clientes' | 'config';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('dash');
  const [appData, setAppData] = useState<AppDataType>(DEFAULT_DATA);
  const [session, setSession] = useState<any>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [loading, setLoading] = useState(true);

  const [lastSaved, setLastSaved] = useState<string>('');
  const [showSummary, setShowSummary] = useState<Order | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      if (!supabase) {
        const saved = localStorage.getItem(MASTER_KEY);
        if (saved) setAppData({ ...DEFAULT_DATA, ...JSON.parse(saved) });
        setLoading(false);
        return;
      }

      const { data: { session: currentSession } } = await supabase.auth.getSession();
      setSession(currentSession);

      if (currentSession?.user) {
        await fetchCloudData(currentSession.user.id);
      } else {
        const saved = localStorage.getItem(MASTER_KEY);
        if (saved) setAppData({ ...DEFAULT_DATA, ...JSON.parse(saved) });
      }
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
      const [{ data: settings }, { data: cls }, { data: ords }] = await Promise.all([
        supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('clients').select('*').eq('user_id', userId),
        supabase.from('orders').select('*').eq('user_id', userId)
      ]);

      setAppData(prev => ({
        ...prev,
        sheetWidth: Number(settings?.sheet_width) || prev.sheetWidth,
        profitMargin: Number(settings?.profit_margin) || prev.profitMargin,
        designSpacing: Number(settings?.design_spacing) || prev.designSpacing,
        clients: cls || [],
        orders: ords || []
      }));
    } catch (e) {
      console.error("Error cargando desde la nube:", e);
    }
  };

  useEffect(() => {
    if (loading) return;
    localStorage.setItem(MASTER_KEY, JSON.stringify(appData));
    setLastSaved(new Date().toLocaleTimeString());
    
    const sync = async () => {
      if (!supabase || !session?.user) return;
      await supabase.from('settings').upsert({
        user_id: session.user.id,
        sheet_width: appData.sheetWidth,
        profit_margin: appData.profitMargin,
        design_spacing: appData.designSpacing,
        updated_at: new Date().toISOString()
      });
    };
    
    sync();
  }, [appData, session, loading]);

  const updateData = async (field: keyof AppDataType, value: any) => {
    setAppData(prev => ({ ...prev, [field]: value }));
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });
      if (error) {
        const { error: signUpError } = await supabase.auth.signUp({
          email: authEmail,
          password: authPassword,
        });
        if (signUpError) alert("Error en autenticación. Verifica tus datos.");
      }
      setIsAuthModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ title, message, onConfirm });
  };

  const [newDesign, setNewDesign] = useState<Omit<DesignItem, 'id'>>({ name: '', width: 0, height: 0, quantity: 1 });
  const PREVIEW_SCALE = 6;

  const packingResult = useMemo(() => packDesigns(appData.designs, appData.sheetWidth, appData.designSpacing), [appData.designs, appData.sheetWidth, appData.designSpacing]);
  
  const currentPricePerCm = useMemo(() => {
    const totalL = packingResult.totalLength;
    const tier = appData.costTiers.find((t: CostTier) => totalL >= t.minLargo && totalL < t.maxLargo);
    return tier ? tier.precioPorCm : (appData.costTiers[appData.costTiers.length - 1]?.precioPorCm || 0);
  }, [packingResult.totalLength, appData.costTiers]);

  const calculateDetails = useCallback((item: DesignItem): CalculationResult => {
    if (packingResult.totalLength <= 0) return { unitProductionCost: 0, unitClientPrice: 0, totalProductionCost: 0, totalClientPrice: 0 };
    const totalSheetCost = packingResult.totalLength * currentPricePerCm;
    const totalDesignArea = appData.designs.reduce((acc: number, d: DesignItem) => acc + (d.width * d.height * d.quantity), 0);
    const itemAreaTotal = (item.width * item.height) * item.quantity;
    const totalProdCostForItem = totalDesignArea > 0 ? (itemAreaTotal / totalDesignArea) * totalSheetCost : 0;
    const unitProdCost = item.quantity > 0 ? totalProdCostForItem / item.quantity : 0;
    const discount = appData.quantityDiscounts.find(q => item.quantity >= q.minQty && item.quantity <= q.maxQty);
    const discountFactor = discount ? (1 - discount.discountPercent / 100) : 1;
    const unitClientPrice = unitProdCost * (1 + (appData.profitMargin / 100)) * discountFactor;
    return { unitProductionCost: unitProdCost, unitClientPrice, totalProductionCost: totalProdCostForItem, totalClientPrice: unitClientPrice * item.quantity };
  }, [appData.designs, packingResult.totalLength, currentPricePerCm, appData.profitMargin, appData.quantityDiscounts]);

  const totalsPresupuesto = useMemo(() => {
    return appData.designs.reduce((acc, d) => {
      const res = calculateDetails(d);
      return { 
        totalQty: acc.totalQty + d.quantity,
        unitCostoSum: acc.unitCostoSum + res.unitProductionCost,
        unitVentaSum: acc.unitVentaSum + res.unitClientPrice,
        costoTotal: acc.costoTotal + res.totalProductionCost, 
        ventaTotal: acc.ventaTotal + res.totalClientPrice 
      };
    }, { totalQty: 0, unitCostoSum: 0, unitVentaSum: 0, costoTotal: 0, ventaTotal: 0 });
  }, [appData.designs, calculateDetails]);

  const addDesign = () => {
    if (newDesign.width <= 0 || newDesign.height <= 0 || newDesign.quantity <= 0) return;
    const item: DesignItem = {
      ...newDesign,
      name: newDesign.name || 'S/N',
      id: Date.now().toString(),
    };
    updateData('designs', [...appData.designs, item]);
    setNewDesign({ name: '', width: 0, height: 0, quantity: 1 });
  };

  const getColorForDesign = (originalId: string) => {
    const index = appData.designs.findIndex(d => d.id === originalId);
    return index !== -1 ? DESIGN_COLORS[index % DESIGN_COLORS.length] : DESIGN_COLORS[0];
  };

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [orderSearch, setOrderSearch] = useState('');
  const [orderStatusFilter, setOrderStatusFilter] = useState('all');
  const [orderForm, setOrderForm] = useState<Partial<Order>>({});

  const handleOpenNewOrder = () => {
    setEditingOrder(null);
    setOrderForm({
      orderNumber: (appData.orders.length + 1).toString().padStart(4, '0'),
      clientId: appData.clients[0]?.id || '',
      categoryId: appData.categories[0]?.id || '1',
      quantity: 1,
      width: 0,
      height: 0,
      deposit: 0,
      statusId: 'hacer'
    });
    setIsOrderModalOpen(true);
  };

  const saveOrder = async () => {
    const category = appData.categories.find(c => c.id === orderForm.categoryId);
    const totalPrice = (category?.pricePerUnit || 0) * (orderForm.quantity || 0);
    const deposit = orderForm.deposit || 0;
    const balance = totalPrice - deposit;
    
    let updatedOrder: Order;
    if (editingOrder) {
      updatedOrder = { ...editingOrder, ...orderForm, totalPrice, balance } as Order;
      updateData('orders', appData.orders.map(o => o.id === editingOrder.id ? updatedOrder : o));
    } else {
      updatedOrder = { ...orderForm, id: Date.now().toString(), totalPrice, balance, createdAt: Date.now() } as Order;
      updateData('orders', [...appData.orders, updatedOrder]);
    }

    if (supabase && session?.user) {
      await supabase.from('orders').upsert({ ...updatedOrder, user_id: session.user.id });
    }
    setIsOrderModalOpen(false);
  };

  const filteredOrders = useMemo(() => {
    return appData.orders.filter(o => {
      const client = appData.clients.find(c => c.id === o.clientId);
      const matchesText = client?.name.toLowerCase().includes(orderSearch.toLowerCase()) || o.orderNumber.includes(orderSearch);
      const matchesStatus = orderStatusFilter === 'all' || o.statusId === orderStatusFilter;
      return matchesText && matchesStatus;
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  }, [appData.orders, appData.clients, orderSearch, orderStatusFilter]);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<Partial<Client>>({ name: '', phone: '', address: '' });
  const [clientSearch, setClientSearch] = useState('');

  const filteredClients = useMemo(() => {
    return appData.clients.filter(c => 
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) || 
      c.phone.includes(clientSearch)
    );
  }, [appData.clients, clientSearch]);

  const saveClient = async () => {
    if (!clientForm.name) return;
    let updatedClient: Client;
    if (clientForm.id) {
        updatedClient = { ...clientForm } as Client;
        updateData('clients', appData.clients.map(c => c.id === clientForm.id ? updatedClient : c));
    } else {
        updatedClient = { ...clientForm, id: Date.now().toString(), createdAt: Date.now() } as Client;
        updateData('clients', [...appData.clients, updatedClient]);
    }
    if (supabase && session?.user) {
      await supabase.from('clients').upsert({ ...updatedClient, user_id: session.user.id });
    }
    setClientForm({ name: '', phone: '', address: '' });
    setIsClientModalOpen(false);
  };

  const shareToWA = (order: Order) => {
    const client = appData.clients.find(c => c.id === order.clientId);
    const phone = client?.phone.replace(/\D/g,'') || '';
    const clientName = client?.name || 'Cliente';
    const text = `*CreaStickers - Ticket #${order.orderNumber}*\n\n*Cliente:* ${clientName}\n*Medida:* ${order.width}x${order.height} cm\n*Cantidad:* ${order.quantity}\n*Total:* $${order.totalPrice}\n*Seña:* $${order.deposit}\n*Restante:* $${order.balance}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2Icon className="animate-spin text-indigo-600" size={48}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-700 pb-12">
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-8 py-4 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200"><CalculatorIcon size={24}/></div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Crea<span className="text-indigo-600">Stickers</span></h1>
          </div>
          
          <nav className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner">
            <button onClick={() => setActiveTab('dash')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'dash' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Inicio</button>
            <button onClick={() => setActiveTab('presupuestar')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'presupuestar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Presupuestar</button>
            <button onClick={() => setActiveTab('pedidos')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'pedidos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Pedidos</button>
            <button onClick={() => setActiveTab('clientes')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'clientes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Clientes</button>
            <button onClick={() => setActiveTab('config')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all ${activeTab === 'config' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Ajustes</button>
          </nav>

          <div className="flex items-center gap-4">
             {session ? (
               <button onClick={() => supabase?.auth.signOut()} className="flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase bg-emerald-50 px-4 py-2 rounded-full hover:bg-emerald-100 transition-all">
                 <CloudIcon size={14}/> {session.user.email.split('@')[0]} <LogOutIcon size={12}/>
               </button>
             ) : (
               <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase bg-slate-100 px-4 py-2 rounded-full hover:bg-indigo-600 hover:text-white transition-all shadow-sm">
                 <LogInIcon size={14}/> Sincronizar Nube
               </button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        
        {activeTab === 'dash' && (
           <div className="space-y-10 animate-in fade-in duration-500">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                 {appData.statuses.map(s => (
                   <div key={s.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center hover:translate-y-[-4px] transition-transform">
                      <div className={`w-4 h-4 rounded-full ${s.color} mb-4 shadow-sm`}></div>
                      <div className="text-5xl font-black text-slate-900 mb-2 leading-none">{appData.orders.filter(o => o.statusId === s.id).length}</div>
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{s.name}</div>
                   </div>
                 ))}
              </div>
           </div>
        )}

        {/* PRESUPUESTAR */}
        {activeTab === 'presupuestar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-in fade-in duration-500">
            <div className="lg:col-span-4 space-y-8">
              <section className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
                <h2 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-3 mb-8"><Settings2Icon className="text-indigo-500" size={18}/> Configuración</h2>
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Ancho Pliego</label><input type="number" value={appData.sheetWidth} onChange={e => updateData('sheetWidth', Number(e.target.value))} className="w-full bg-slate-50 rounded-2xl p-4 font-bold" /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Margen %</label><input type="number" value={appData.profitMargin} onChange={e => updateData('profitMargin', Number(e.target.value))} className="w-full bg-slate-50 rounded-2xl p-4 font-bold" /></div>
                   </div>
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Espaciado (cm)</label><input type="number" step="0.1" value={appData.designSpacing} onChange={e => updateData('designSpacing', Number(e.target.value))} className="w-full bg-slate-50 rounded-2xl p-4 font-bold" /></div>
                </div>
              </section>
              <section className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-sm">
                <h2 className="text-indigo-600 font-black text-sm uppercase tracking-widest flex items-center gap-3 mb-8"><PlusIcon size={18}/> Agregar Diseño</h2>
                <div className="space-y-6">
                   <input type="text" placeholder="Nombre (opcional)..." value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 font-bold" />
                   <div className="grid grid-cols-3 gap-3">
                      <input type="number" placeholder="Ancho" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="bg-slate-50 rounded-2xl p-4 font-bold text-center" />
                      <input type="number" placeholder="Alto" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="bg-slate-50 rounded-2xl p-4 font-bold text-center" />
                      <input type="number" placeholder="Cant." value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="bg-slate-50 rounded-2xl p-4 font-bold text-center" />
                   </div>
                   <button onClick={addDesign} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">Optimizar Largo</button>
                </div>
              </section>
            </div>
            
            <div className="lg:col-span-8 space-y-10">
               <section className="bg-white rounded-[3.5rem] p-12 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <h2 className="font-black text-2xl text-slate-900 tracking-tighter flex items-center gap-4"><LayoutIcon className="text-indigo-500" size={24}/> Distribución</h2>
                    <div className="flex flex-col items-end">
                       <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Largo Total Optimizado</div>
                       <div className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-lg uppercase tracking-widest shadow-lg shadow-indigo-900/20 flex items-center gap-3">
                         <RulerIcon size={20} className="text-indigo-400"/>
                         {packingResult.totalLength.toFixed(1)} cm
                       </div>
                    </div>
                  </div>
                  <div className="bg-slate-950 rounded-[3rem] min-h-[450px] overflow-auto flex justify-center p-14 custom-scrollbar border-[12px] border-slate-900 shadow-2xl">
                     {packingResult.totalLength > 0 ? (
                        <div className="bg-white relative shadow-2xl" style={{ width: `${appData.sheetWidth * PREVIEW_SCALE}px`, height: `${packingResult.totalLength * PREVIEW_SCALE}px` }}>
                          {packingResult.packed.map(p => {
                            const color = getColorForDesign(p.originalId);
                            return (
                              <div key={p.id} className={`absolute border ${color.bg} ${color.border} ${color.text} flex items-center justify-center text-[7px] font-black overflow-hidden group transition-all`} style={{ left: `${p.x * PREVIEW_SCALE}px`, top: `${p.y * PREVIEW_SCALE}px`, width: `${p.width * PREVIEW_SCALE}px`, height: `${p.height * PREVIEW_SCALE}px` }}>
                                 <span className="block text-center">{p.width}x{p.height}</span>
                              </div>
                            )
                          })}
                        </div>
                     ) : <div className="text-slate-700 opacity-20 uppercase font-black tracking-[0.3em] flex flex-col items-center justify-center py-32"><LayoutIcon size={64} className="mb-6"/> Sin diseños</div>}
                  </div>
               </section>

               <section className="bg-white rounded-[3.5rem] p-12 border border-slate-200 shadow-sm">
                  <div className="overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left border-separate border-spacing-y-5">
                      <thead>
                        <tr className="text-slate-400 text-[11px] font-black uppercase tracking-widest">
                          <th className="px-6 pb-2">Nombre</th>
                          <th className="text-right pb-2">Costo Unit.</th>
                          <th className="text-right pb-2">Precio Unit.</th>
                          <th className="text-right pb-2">Costo Total</th>
                          <th className="px-6 text-right pb-2">Venta Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appData.designs.map(d => {
                          const res = calculateDetails(d);
                          return (
                            <tr key={d.id} className="bg-slate-50 rounded-3xl group hover:bg-indigo-50/30 transition-all">
                              <td className="py-6 px-8 rounded-l-[2rem]">
                                 <div className="font-black text-slate-900 uppercase text-[12px] mb-1">{d.name || 'Sin nombre'}</div>
                                 <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d.width}x{d.height} CM • QTY: {d.quantity}</div>
                              </td>
                              <td className="text-right font-black text-rose-500 text-sm whitespace-nowrap">${res.unitProductionCost.toFixed(0)}</td>
                              <td className="text-right font-black text-slate-900 text-sm whitespace-nowrap">${res.unitClientPrice.toFixed(0)}</td>
                              <td className="text-right font-bold text-slate-400 text-sm whitespace-nowrap">${res.totalProductionCost.toFixed(0)}</td>
                              <td className="py-6 px-8 text-right rounded-r-[2rem] font-black text-emerald-600 text-xl whitespace-nowrap">
                                 ${res.totalClientPrice.toFixed(0)}
                                 <button onClick={() => askConfirmation("Borrar Diseño", "¿Seguro que deseas quitar este diseño del presupuesto?", () => updateData('designs', appData.designs.filter(i => i.id !== d.id)))} className="ml-5 text-slate-300 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><TrashIcon size={18}/></button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                      <tfoot>
                         <tr className="border-t-2 border-slate-100">
                            <td className="px-8 py-8 font-black text-slate-400 uppercase tracking-widest text-[11px]">Totales ({totalsPresupuesto.totalQty} u.)</td>
                            <td className="text-right px-4 font-black text-rose-500 text-sm whitespace-nowrap">${totalsPresupuesto.unitCostoSum.toFixed(0)}</td>
                            <td className="text-right px-4 font-black text-slate-900 text-sm whitespace-nowrap">${totalsPresupuesto.unitVentaSum.toFixed(0)}</td>
                            <td className="text-right px-4 font-black text-rose-500 text-lg whitespace-nowrap">${totalsPresupuesto.costoTotal.toLocaleString()}</td>
                            <td className="text-right px-8 font-black text-emerald-600 text-3xl whitespace-nowrap">${totalsPresupuesto.ventaTotal.toLocaleString()}</td>
                         </tr>
                      </tfoot>
                    </table>
                  </div>
               </section>
            </div>
          </div>
        )}

        {/* PEDIDOS, CLIENTES Y AJUSTES MANTIENEN SU LÓGICA EXISTENTE */}
        {activeTab === 'pedidos' && (
           <div className="space-y-10 animate-in fade-in duration-500">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
                 <div className="relative flex-1 w-full">
                    <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    <input type="text" placeholder="Buscar pedido o cliente..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 pl-16 pr-8 outline-none font-bold" />
                 </div>
                 <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-2">
                    <button onClick={() => setOrderStatusFilter('all')} className={`px-6 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest border transition-all ${orderStatusFilter === 'all' ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}>Todos</button>
                    {appData.statuses.map(s => <button key={s.id} onClick={() => setOrderStatusFilter(s.id)} className={`px-6 py-3.5 rounded-xl text-[11px] font-black uppercase tracking-widest border whitespace-nowrap transition-all ${orderStatusFilter === s.id ? 'bg-indigo-600 text-white shadow-lg' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}>{s.name}</button>)}
                    <button onClick={handleOpenNewOrder} className="ml-6 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3 hover:bg-indigo-700 active:scale-95 transition-all"><PlusIcon size={16}/> Cargar Pedido</button>
                 </div>
              </div>

              <div className="grid gap-5">
                 {filteredOrders.map(o => {
                   const client = appData.clients.find(c => c.id === o.clientId);
                   const status = appData.statuses.find(s => s.id === o.statusId);
                   return (
                     <div key={o.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-10 group hover:border-indigo-300 transition-all hover:translate-x-1">
                        <div className="flex-1 flex items-center gap-6 w-full">
                           <div className={`w-16 h-16 rounded-3xl ${status?.color || 'bg-slate-400'} text-white flex flex-col items-center justify-center font-black text-[10px] shadow-xl`}>
                              <span className="opacity-60 text-[8px] uppercase">ID</span>
                              <span className="text-sm">#{o.orderNumber}</span>
                           </div>
                           <div>
                              <div className="font-black text-slate-900 uppercase text-[15px] mb-1 leading-none">{client?.name || 'Cliente borrado'}</div>
                              <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-white text-[9px] ${status?.color || 'bg-slate-400'}`}>{status?.name || 'S/E'}</span>
                                {o.width}x{o.height} cm • {o.quantity} u.
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-10 w-full md:w-auto text-right">
                           <div className="min-w-[80px]"><div className="text-[10px] font-black text-slate-300 uppercase mb-1">Total</div><div className="font-black text-slate-900 text-lg">$ {o.totalPrice.toLocaleString()}</div></div>
                           <div className="min-w-[80px]"><div className="text-[10px] font-black text-emerald-300 uppercase mb-1">Seña</div><div className="font-black text-emerald-600">$ {o.deposit.toLocaleString()}</div></div>
                           <div className="min-w-[80px]"><div className="text-[10px] font-black text-rose-300 uppercase mb-1">Restante</div><div className="font-black text-rose-500 text-xl font-black">$ {o.balance.toLocaleString()}</div></div>
                           <div className="flex gap-3">
                              <button onClick={() => setShowSummary(o)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"><Share2Icon size={20}/></button>
                              <button onClick={() => { setEditingOrder(o); setOrderForm(o); setIsOrderModalOpen(true); }} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 hover:text-indigo-600 transition-all active:scale-90"><Edit3Icon size={20}/></button>
                              <button onClick={() => askConfirmation("Borrar Pedido", `¿Seguro que deseas eliminar el pedido #${o.orderNumber}?`, () => updateData('orders', appData.orders.filter(ord => ord.id !== o.id)))} className="p-4 bg-white border border-slate-100 text-slate-200 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100 rounded-xl active:scale-90"><TrashIcon size={18}/></button>
                           </div>
                        </div>
                     </div>
                   )
                 })}
              </div>
           </div>
        )}

        {activeTab === 'clientes' && (
           <div className="space-y-10 animate-in fade-in duration-500">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
                 <div className="relative flex-1 w-full">
                    <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    <input type="text" placeholder="Filtrar por nombre o WhatsApp..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 pl-16 pr-8 outline-none font-bold" />
                 </div>
                 <button onClick={() => { setClientForm({name: '', phone: '', address: ''}); setIsClientModalOpen(true); }} className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl flex items-center gap-3 hover:bg-slate-800 transition-all"><PlusIcon size={16}/> Nuevo Cliente</button>
              </div>

              <div className="bg-white rounded-[3.5rem] border border-slate-200 overflow-hidden shadow-2xl">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50/80 border-b border-slate-100">
                       <tr className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-10 py-8">Cliente</th>
                          <th className="px-10 py-8">WhatsApp</th>
                          <th className="px-10 py-8">Dirección</th>
                          <th className="px-10 py-8 text-right">Operaciones</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {filteredClients.map(c => (
                         <tr key={c.id} className="hover:bg-indigo-50/20 transition-all group">
                            <td className="px-10 py-8">
                               <div className="flex items-center gap-5">
                                  <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl uppercase shadow-lg">{c.name.charAt(0)}</div>
                                  <div>
                                     <div className="font-black text-slate-900 uppercase text-sm leading-none mb-1">{c.name}</div>
                                     <div className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">Registrado: {new Date(c.createdAt || 0).toLocaleDateString()}</div>
                                  </div>
                               </div>
                            </td>
                            <td className="px-10 py-8 font-black text-slate-600 text-sm flex items-center gap-2">
                                <PhoneIcon size={14} className="text-emerald-500"/>
                                {c.phone}
                            </td>
                            <td className="px-10 py-8 font-bold text-slate-400 text-xs uppercase flex items-center gap-2">
                                <MapPinIcon size={14} className="text-slate-300"/>
                                {c.address || 'Ubicación no cargada'}
                            </td>
                            <td className="px-10 py-8 text-right">
                               <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                  <button onClick={() => { setClientForm(c); setIsClientModalOpen(true); }} className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all"><Edit3Icon size={18}/></button>
                                  <button onClick={() => askConfirmation("Borrar Cliente", `¿Seguro que deseas eliminar a ${c.name}?`, () => updateData('clients', appData.clients.filter(cl => cl.id !== c.id)))} className="p-4 bg-white border border-slate-100 text-slate-200 hover:text-rose-500 rounded-xl transition-all active:scale-90"><TrashIcon size={18}/></button>
                               </div>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === 'config' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in duration-500 pb-16">
              <section className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-3"><TagIcon className="text-indigo-600" size={18}/> Categorías</h2>
                    <button onClick={() => updateData('categories', [...appData.categories, { id: Date.now().toString(), name: 'Nueva', pricePerUnit: 0 }])} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><PlusIcon size={18}/></button>
                 </div>
                 <div className="space-y-4">
                    {appData.categories.map((cat, idx) => (
                      <div key={cat.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group">
                         <input type="text" value={cat.name} onChange={e => { const nc = [...appData.categories]; nc[idx].name = e.target.value; updateData('categories', nc); }} className="flex-1 bg-transparent font-black text-[10px] uppercase outline-none" />
                         <div className="flex items-center gap-1 font-black text-indigo-600 text-xs">$ <input type="number" value={cat.pricePerUnit} onChange={e => { const nc = [...appData.categories]; nc[idx].pricePerUnit = Number(e.target.value); updateData('categories', nc); }} className="w-16 bg-transparent text-right outline-none" /></div>
                         <button onClick={() => askConfirmation("Borrar Categoría", "¿Deseas eliminar esta categoría de precios?", () => updateData('categories', appData.categories.filter(c => c.id !== cat.id)))} className="text-slate-200 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><TrashIcon size={16}/></button>
                      </div>
                    ))}
                 </div>
              </section>

              <section className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-3"><LayersIcon className="text-indigo-600" size={18}/> Tarifas Producción</h2>
                    <button onClick={() => updateData('costTiers', [...appData.costTiers, { id: Date.now().toString(), minLargo: 0, maxLargo: 0, precioPorCm: 0 }])} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl transition-all"><PlusIcon size={18}/></button>
                 </div>
                 <div className="space-y-3">
                    {appData.costTiers.map((tier, idx) => (
                      <div key={tier.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                         <input type="number" value={tier.minLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].minLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-12 bg-white border border-slate-200 rounded p-1.5 text-[10px] font-black text-center" />
                         <span className="text-slate-300 font-black">→</span>
                         <input type="number" value={tier.maxLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].maxLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-12 bg-white border border-slate-200 rounded p-1.5 text-[10px] font-black text-center" />
                         <div className="flex-1 text-right font-black text-indigo-600 text-xs">$ <input type="number" value={tier.precioPorCm} onChange={e => { const nt = [...appData.costTiers]; nt[idx].precioPorCm = Number(e.target.value); updateData('costTiers', nt); }} className="w-16 bg-transparent text-right outline-none" /></div>
                         <button onClick={() => askConfirmation("Borrar Tarifa", "¿Eliminar esta escala de precios de producción?", () => updateData('costTiers', appData.costTiers.filter(t => t.id !== tier.id)))} className="text-slate-200 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><TrashIcon size={16}/></button>
                      </div>
                    ))}
                 </div>
              </section>

              <section className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-3"><PercentIcon className="text-indigo-600" size={18}/> Descuentos Cantidad</h2>
                    <button onClick={() => updateData('quantityDiscounts', [...appData.quantityDiscounts, { id: Date.now().toString(), minQty: 0, maxQty: 0, discountPercent: 0 }])} className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl transition-all"><PlusIcon size={18}/></button>
                 </div>
                 <div className="space-y-3">
                    {appData.quantityDiscounts.map((disc, idx) => (
                      <div key={disc.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                         <input type="number" placeholder="Min" value={disc.minQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].minQty = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-12 bg-white border border-slate-200 rounded p-1.5 text-[10px] font-black text-center" />
                         <span className="text-slate-300 font-black">→</span>
                         <input type="number" placeholder="Max" value={disc.maxQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].maxQty = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-12 bg-white border border-slate-200 rounded p-1.5 text-[10px] font-black text-center" />
                         <div className="flex-1 text-right font-black text-emerald-600 text-xs"><input type="number" placeholder="%" value={disc.discountPercent} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].discountPercent = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-12 bg-transparent text-right outline-none" /> %</div>
                         <button onClick={() => askConfirmation("Borrar Descuento", "¿Eliminar esta regla de descuento?", () => updateData('quantityDiscounts', appData.quantityDiscounts.filter(d => d.id !== disc.id)))} className="text-slate-200 hover:text-rose-500 transition-all opacity-0 group-hover:opacity-100"><TrashIcon size={16}/></button>
                      </div>
                    ))}
                    {appData.quantityDiscounts.length === 0 && <p className="text-center text-[10px] font-black text-slate-300 uppercase tracking-widest py-10 italic">Sin descuentos configurados</p>}
                 </div>
              </section>
           </div>
        )}
      </main>

      {/* MODALES: LOGIN, CARGAR PEDIDO, RESUMEN TICKET, CLIENTE, CONFIRMACIÓN */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative">
              <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900"><XIcon size={24}/></button>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-8 flex items-center gap-3"><CloudIcon className="text-indigo-600"/> Cuenta Taller</h2>
              <form onSubmit={handleAuth} className="space-y-5">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Email del Taller</label>
                    <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold outline-none" placeholder="taller@ejemplo.com" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2">Contraseña</label>
                    <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 font-bold outline-none" placeholder="••••••••" />
                 </div>
                 <p className="text-[10px] text-slate-400 font-medium italic">Si el usuario no existe, se creará automáticamente.</p>
                 <button type="submit" className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl uppercase text-[11px] tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Sincronizar Ahora</button>
              </form>
           </div>
        </div>
      )}

      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-md rounded-[2rem] p-5 shadow-2xl relative overflow-hidden border border-slate-200">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter mb-4 flex items-center gap-3 leading-none">
                 <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg"><PackageIcon size={18}/></div>
                 {editingOrder ? 'Editar Pedido' : 'Cargar Pedido'}
              </h2>
              <div className="space-y-3">
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nº Pedido</label>
                      <input type="text" value={orderForm.orderNumber} onChange={e => setOrderForm({...orderForm, orderNumber: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-black outline-none text-[11px]" />
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Estado</label>
                      <select value={orderForm.statusId} onChange={e => setOrderForm({...orderForm, statusId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-black outline-none appearance-none text-[11px]">
                        {appData.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                 </div>
                 
                 <div className="space-y-0.5">
                    <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Cliente</label>
                    <select value={orderForm.clientId} onChange={e => setOrderForm({...orderForm, clientId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-black outline-none appearance-none text-[11px]">
                      {appData.clients.length === 0 ? <option>Registra un cliente</option> : appData.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Medidas (cm)</label>
                      <div className="flex items-center gap-1">
                        <input type="number" placeholder="W" value={orderForm.width || ''} onChange={e => setOrderForm({...orderForm, width: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-black outline-none text-[11px] text-center" />
                        <span className="text-slate-300 font-black">x</span>
                        <input type="number" placeholder="H" value={orderForm.height || ''} onChange={e => setOrderForm({...orderForm, height: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-black outline-none text-[11px] text-center" />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Cantidad</label>
                      <input type="number" value={orderForm.quantity || ''} onChange={e => setOrderForm({...orderForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-black outline-none text-[11px] text-center" />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Categoría</label>
                      <select value={orderForm.categoryId} onChange={e => setOrderForm({...orderForm, categoryId: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2 font-black outline-none appearance-none text-[11px]">
                        {appData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase ml-2 tracking-widest">Seña ($)</label>
                      <input type="number" value={orderForm.deposit || ''} onChange={e => setOrderForm({...orderForm, deposit: Number(e.target.value)})} className="w-full bg-emerald-50 border border-emerald-100 rounded-xl p-2 font-black text-emerald-700 outline-none text-[11px]" />
                    </div>
                 </div>
                 
                 <div className="pt-3 flex gap-2">
                    <button onClick={() => setIsOrderModalOpen(false)} className="flex-1 py-3 rounded-xl font-black text-[9px] uppercase tracking-widest text-slate-400 hover:bg-slate-50">Cancelar</button>
                    <button onClick={saveOrder} className="flex-[2] py-3 rounded-xl bg-indigo-600 text-white font-black text-[9px] uppercase tracking-[0.2em] shadow-xl hover:bg-indigo-700 transition-all active:scale-95">Guardar</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/95 backdrop-blur-xl z-[200] flex items-center justify-center p-6 animate-in zoom-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative flex flex-col items-center text-center overflow-hidden" ref={ticketRef}>
              <button onClick={() => setShowSummary(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-all active:scale-125"><XIcon size={24}/></button>
              <div className="w-20 h-20 bg-indigo-600 rounded-[2rem] flex items-center justify-center text-white mb-6 shadow-2xl shadow-indigo-200"><CalculatorIcon size={36}/></div>
              <h2 className="font-black text-2xl text-slate-900 uppercase mb-1 tracking-tighter leading-none">Ticket Pedido</h2>
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-6">ID #{showSummary.orderNumber}</p>
              
              <div className="w-full space-y-4 border-y-2 border-slate-50 py-6 mb-8">
                 <div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold uppercase tracking-widest">Cliente</span><span className="font-black text-slate-900 uppercase">{appData.clients.find(c => c.id === showSummary.clientId)?.name}</span></div>
                 <div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold uppercase tracking-widest">Medida</span><span className="font-black text-slate-900">{showSummary.width}x{showSummary.height} cm</span></div>
                 <div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold uppercase tracking-widest">Cantidad</span><span className="font-black text-slate-900">{showSummary.quantity} u.</span></div>
                 <div className="flex justify-between pt-4 border-t-2 border-slate-50"><span className="text-indigo-600 font-black uppercase text-[10px] tracking-widest">Total</span><span className="font-black text-indigo-600 text-xl">${showSummary.totalPrice}</span></div>
                 <div className="flex justify-between items-center"><span className="text-emerald-500 font-black uppercase text-[10px] tracking-widest">Seña</span><span className="font-black text-emerald-500 text-sm">${showSummary.deposit}</span></div>
                 <div className="flex justify-between items-center"><span className="text-rose-500 font-black uppercase text-[10px] tracking-widest">Restante</span><span className="font-black text-rose-500 text-lg">${showSummary.balance}</span></div>
              </div>

              <div className="flex flex-col gap-3 w-full">
                  <button onClick={() => shareToWA(showSummary)} className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-600 transition-all active:scale-95"><MessageCircleIcon size={18}/> Enviar WhatsApp</button>
                  <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest italic opacity-60">¡Captura pantalla para compartir!</p>
              </div>
           </div>
        </div>
      )}
      
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-md rounded-[3.5rem] p-12 shadow-2xl relative overflow-hidden">
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-10 flex items-center gap-4"><div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white"><UsersIcon size={24}/></div> Ficha Cliente</h2>
              <div className="space-y-6">
                 <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">Nombre</label><input type="text" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-black outline-none" /></div>
                 <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">WhatsApp</label>
                    <input type="text" value={clientForm.phone} placeholder="+54221..." onChange={e => setClientForm({...clientForm, phone: e.target.value.replace(/[^0-9+]/g, '')})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-black outline-none" />
                 </div>
                 <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase ml-2 tracking-widest">Dirección</label><input type="text" value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-black outline-none" /></div>
                 <div className="pt-6 flex gap-4">
                    <button onClick={() => setIsClientModalOpen(false)} className="flex-1 py-5 font-black text-slate-400 text-xs uppercase tracking-widest">Cerrar</button>
                    <button onClick={saveClient} className="flex-[2] py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl text-xs uppercase tracking-widest active:scale-95">Guardar</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[300] flex items-center justify-center p-6 animate-in fade-in duration-200">
           <div className="bg-white w-full max-sm rounded-[2.5rem] p-8 shadow-2xl text-center border border-rose-100">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangleIcon size={32}/>
              </div>
              <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight mb-2 leading-none">{confirmModal.title}</h3>
              <p className="text-slate-500 font-medium text-sm mb-8">{confirmModal.message}</p>
              <div className="flex gap-3">
                 <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 rounded-2xl bg-slate-50 text-slate-400 font-black text-[10px] uppercase tracking-widest">Cancelar</button>
                 <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-4 rounded-2xl bg-rose-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-rose-100 active:scale-95">Confirmar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
