
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  Settings2Icon, 
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
  LogInIcon,
  LogOutIcon,
  UserIcon,
  Loader2Icon,
  DatabaseIcon
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
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('dash');
  const [appData, setAppData] = useState<AppDataType>(DEFAULT_DATA);
  const [lastSaved, setLastSaved] = useState<string>('');
  
  // Auth Form State
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  // Check if Supabase is configured
  const isSupabaseConfigured = !!(import.meta as any).env?.VITE_SUPABASE_URL;

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchAllData(session.user.id);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchAllData(session.user.id);
      else setAppData(DEFAULT_DATA);
    });

    return () => subscription.unsubscribe();
  }, [isSupabaseConfigured]);

  const fetchAllData = async (userId: string) => {
    setLoading(true);
    try {
      const [{ data: setts }, { data: cls }, { data: cats }, { data: ords }] = await Promise.all([
        supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('clients').select('*').eq('user_id', userId),
        supabase.from('categories').select('*').eq('user_id', userId),
        supabase.from('orders').select('*').eq('user_id', userId).order('created_at', { ascending: false })
      ]);

      setAppData(prev => ({
        ...prev,
        sheetWidth: setts?.sheet_width || 58,
        profitMargin: setts?.profit_margin || 100,
        designSpacing: setts?.design_spacing || 0.2,
        clients: cls || [],
        categories: cats?.length ? cats : DEFAULT_CATEGORIES,
        orders: ords || [],
      }));
      setLastSaved(new Date().toLocaleTimeString());
    } catch (e) { console.error("Error cargando datos:", e); }
    setLoading(false);
  };

  const updateData = async (field: keyof AppDataType, value: any) => {
    setAppData(prev => ({ ...prev, [field]: value }));
    if (!session) return;
    const userId = session.user.id;

    if (field === 'sheetWidth' || field === 'profitMargin' || field === 'designSpacing') {
      await supabase.from('settings').upsert({ 
        user_id: userId, 
        sheet_width: field === 'sheetWidth' ? value : appData.sheetWidth,
        profit_margin: field === 'profitMargin' ? value : appData.profitMargin,
        design_spacing: field === 'designSpacing' ? value : appData.designSpacing,
        updated_at: new Date().toISOString()
      });
    }
    setLastSaved(new Date().toLocaleTimeString());
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setLoading(true);
    const { error } = isRegistering 
      ? await supabase.auth.signUp({ email: authEmail, password: authPassword })
      : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    
    if (error) setAuthError(error.message);
    setLoading(false);
  };

  // --- CALCULADORA LOGIC ---
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

  // --- MODALS & SEARCH ---
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<Partial<Order>>({});
  const [clientForm, setClientForm] = useState<Partial<Client>>({});
  const [orderSearch, setOrderSearch] = useState('');
  const [clientSearch, setClientSearch] = useState('');

  const saveOrder = async () => {
    if (!session || !orderForm.clientId || !orderForm.categoryId) return;
    const category = appData.categories.find(c => c.id === orderForm.categoryId);
    const totalPrice = (category?.pricePerUnit || 0) * (orderForm.quantity || 0);
    const deposit = orderForm.deposit || 0;
    const balance = totalPrice - deposit;
    
    const orderData = { 
      ...orderForm, 
      user_id: session.user.id, 
      totalPrice, 
      balance,
      orderNumber: orderForm.orderNumber || `TK-${Date.now().toString().slice(-6)}`,
      statusId: orderForm.statusId || 'hacer'
    };
    
    const { data, error } = await supabase.from('orders').upsert(orderData).select().single();
    if (!error) {
      const updatedOrders = orderForm.id 
        ? appData.orders.map(o => o.id === data.id ? data : o)
        : [data, ...appData.orders];
      updateData('orders', updatedOrders);
      setIsOrderModalOpen(false);
    }
  };

  const saveClient = async () => {
    if (!session || !clientForm.name) return;
    const clientData = { ...clientForm, user_id: session.user.id };
    const { data, error } = await supabase.from('clients').upsert(clientData).select().single();
    if (!error) {
      const updatedClients = clientForm.id 
        ? appData.clients.map(c => c.id === data.id ? data : c)
        : [...appData.clients, data];
      updateData('clients', updatedClients);
      setIsClientModalOpen(false);
    }
  };

  const deleteOrder = async (id: string) => {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (!error) updateData('orders', appData.orders.filter(o => o.id !== id));
  };

  const deleteClient = async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (!error) updateData('clients', appData.clients.filter(c => c.id !== id));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <Loader2Icon className="text-indigo-600 animate-spin" size={48} />
        <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Verificando conexión...</p>
      </div>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white max-w-md p-10 rounded-[2.5rem] shadow-xl border border-rose-100">
          <div className="bg-rose-100 text-rose-600 p-4 rounded-3xl inline-block mb-6"><DatabaseIcon size={40}/></div>
          <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Faltan Variables de Entorno</h1>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">Debes configurar <code className="bg-slate-100 px-2 py-1 rounded font-bold">VITE_SUPABASE_URL</code> y <code className="bg-slate-100 px-2 py-1 rounded font-bold">VITE_SUPABASE_ANON_KEY</code> en el panel de Vercel.</p>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all">Reintentar</button>
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-[3rem] p-12 shadow-2xl border border-slate-200">
           <div className="flex flex-col items-center mb-10 text-center">
              <div className="bg-indigo-600 p-4 rounded-[2rem] text-white shadow-xl shadow-indigo-100 mb-6"><CalculatorIcon size={40}/></div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Crea<span className="text-indigo-600">Stickers</span></h1>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">{isRegistering ? 'Registro de Empresa' : 'Acceso al Sistema Pro'}</p>
           </div>
           
           <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Email</label>
                 <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500 transition-all" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Contraseña</label>
                 <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500 transition-all" />
              </div>

              {authError && <div className="bg-rose-50 text-rose-500 p-4 rounded-2xl text-xs font-bold border border-rose-100 text-center">{authError}</div>}

              <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95 flex items-center justify-center gap-3">
                 {isRegistering ? <PlusIcon size={18}/> : <LogInIcon size={18}/>}
                 {isRegistering ? 'Crear Cuenta' : 'Iniciar Sesión'}
              </button>
           </form>

           <div className="mt-8 text-center">
              <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                 {isRegistering ? '¿Ya tienes cuenta? Entrar' : '¿Eres nuevo? Registrate'}
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-700 pb-12">
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-8 py-4 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200"><CalculatorIcon size={24}/></div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Crea<span className="text-indigo-600">Stickers</span></h1>
          </div>
          
          <nav className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto max-w-full">
            <button onClick={() => setActiveTab('dash')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'dash' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Inicio</button>
            <button onClick={() => setActiveTab('presupuestar')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'presupuestar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Presupuestar</button>
            <button onClick={() => setActiveTab('pedidos')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'pedidos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Pedidos</button>
            <button onClick={() => setActiveTab('clientes')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'clientes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Clientes</button>
            <button onClick={() => setActiveTab('config')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'config' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Config</button>
          </nav>

          <div className="flex items-center gap-4">
             <div className="hidden lg:flex items-center gap-2 text-[11px] font-black text-emerald-500 uppercase bg-emerald-50 px-3 py-1.5 rounded-full">
                <CheckCircle2Icon size={14}/> Sincronizado: {lastSaved}
             </div>
             <button onClick={() => supabase.auth.signOut()} className="p-2.5 bg-slate-100 text-slate-400 rounded-xl hover:bg-rose-50 hover:text-rose-500 transition-all"><LogOutIcon size={20}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        {activeTab === 'dash' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {appData.statuses.map(s => (
                <div key={s.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm hover:shadow-md transition-all">
                  <div className={`w-3 h-3 rounded-full ${s.color} mb-4`}></div>
                  <div className="text-4xl font-black text-slate-900 mb-1">{appData.orders.filter(o => o.statusId === s.id).length}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.name}</div>
                </div>
              ))}
            </div>

            <div className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm overflow-hidden relative">
              <div className="absolute top-0 right-0 p-10 opacity-5 pointer-events-none"><PackageIcon size={120}/></div>
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 tracking-tight">Últimos Pedidos</h2>
                  <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Gestión en tiempo real</p>
                </div>
                <button onClick={() => setActiveTab('pedidos')} className="text-indigo-600 font-black text-[10px] uppercase tracking-widest bg-indigo-50 px-5 py-2.5 rounded-full hover:bg-indigo-100 transition-colors">Ver Todo</button>
              </div>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="pb-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nº Ticket</th>
                      <th className="pb-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</th>
                      <th className="pb-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</th>
                      <th className="pb-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appData.orders.slice(0, 5).map(o => {
                      const client = appData.clients.find(c => c.id === o.clientId);
                      const status = appData.statuses.find(s => s.id === o.statusId);
                      return (
                        <tr key={o.id} className="group hover:bg-slate-50 transition-colors">
                          <td className="py-5 font-black text-slate-900 text-sm">#{o.orderNumber}</td>
                          <td className="py-5">
                            <div className="font-bold text-slate-700 text-sm">{client?.name || '---'}</div>
                          </td>
                          <td className="py-5 font-black text-indigo-600 text-sm">${o.totalPrice}</td>
                          <td className="py-5">
                            <span className={`${status?.color || 'bg-slate-200'} text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm`}>{status?.name || '---'}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'presupuestar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                <h2 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-3 mb-8"><Settings2Icon className="text-indigo-500" size={18}/> Configuración</h2>
                <div className="space-y-6">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Ancho (cm)</label><input type="number" value={appData.sheetWidth} onChange={e => updateData('sheetWidth', Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none" /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Margen %</label><input type="number" value={appData.profitMargin} onChange={e => updateData('profitMargin', Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none" /></div>
                   </div>
                   <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Espaciado (cm)</label><input type="number" step="0.1" value={appData.designSpacing} onChange={e => updateData('designSpacing', Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none" /></div>
                </div>
              </section>

              <section className="bg-indigo-600 text-white rounded-[2.5rem] p-8 shadow-xl shadow-indigo-100">
                 <h2 className="font-black text-xs uppercase tracking-widest mb-6 opacity-80">Nuevo Diseño</h2>
                 <div className="space-y-4">
                    <input placeholder="Nombre del diseño" value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 font-bold text-white placeholder:text-white/40 outline-none" />
                    <div className="grid grid-cols-2 gap-4">
                      <input type="number" placeholder="Ancho" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 font-bold text-white placeholder:text-white/40 outline-none" />
                      <input type="number" placeholder="Alto" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 font-bold text-white placeholder:text-white/40 outline-none" />
                    </div>
                    <input type="number" placeholder="Cantidad" value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 font-bold text-white placeholder:text-white/40 outline-none" />
                    <button onClick={() => {
                      if (newDesign.width > 0 && newDesign.height > 0) {
                        setAppData(prev => ({...prev, designs: [...prev.designs, {...newDesign, id: Date.now().toString()}]}));
                        setNewDesign({name: '', width: 0, height: 0, quantity: 1});
                      }
                    }} className="w-full bg-white text-indigo-600 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg hover:bg-slate-50 transition-all">Añadir al Pliego</button>
                 </div>
              </section>
            </div>

            <div className="lg:col-span-8 space-y-6">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Largo Total del Pliego</div>
                    <div className="text-4xl font-black text-slate-900">{packingResult.totalLength.toFixed(1)} <span className="text-xl text-slate-300">cm</span></div>
                  </div>
                  <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Precio Venta Total</div>
                    <div className="text-4xl font-black text-indigo-600">${Math.round(totalsPresupuesto.ventaTotal)}</div>
                  </div>
               </div>

               <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-10">
                  <h3 className="text-slate-900 font-black text-sm uppercase tracking-widest mb-8">Visualización del Pliego</h3>
                  <div className="relative bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl mx-auto overflow-hidden" style={{ width: appData.sheetWidth * PREVIEW_SCALE, height: Math.max(200, packingResult.totalLength * PREVIEW_SCALE) }}>
                    {packingResult.packed.map((p, i) => {
                       const color = DESIGN_COLORS[i % DESIGN_COLORS.length];
                       return (
                         <div key={p.id} className={`absolute border transition-all duration-300 flex items-center justify-center p-1 text-[8px] font-black overflow-hidden ${color.bg} ${color.text} ${color.border} rounded-[4px]`} style={{ left: p.x * PREVIEW_SCALE, top: p.y * PREVIEW_SCALE, width: p.width * PREVIEW_SCALE, height: p.height * PREVIEW_SCALE }}>
                           {p.width > 3 && p.height > 2 && <span className="rotate-0 truncate">{p.name || p.width + 'x' + p.height}</span>}
                         </div>
                       );
                    })}
                  </div>
               </div>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Gestión de Pedidos</h2>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Control de facturación y estados</p>
                </div>
                <button onClick={() => { setOrderForm({}); setIsOrderModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 flex items-center gap-3"><PlusIcon size={18}/> Nuevo Ticket</button>
             </div>

             <div className="bg-white p-4 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                  <input placeholder="Buscar por cliente o Nº ticket..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="w-full bg-slate-50 rounded-xl pl-12 pr-6 py-4 font-bold outline-none" />
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
               {appData.orders.filter(o => {
                  const client = appData.clients.find(c => c.id === o.clientId);
                  const search = orderSearch.toLowerCase();
                  return o.orderNumber.toLowerCase().includes(search) || (client?.name.toLowerCase() || '').includes(search);
               }).map(o => {
                 const client = appData.clients.find(c => c.id === o.clientId);
                 const status = appData.statuses.find(s => s.id === o.statusId);
                 const category = appData.categories.find(c => c.id === o.categoryId);
                 return (
                   <div key={o.id} className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden hover:translate-y-[-4px] transition-transform">
                      <div className="p-8">
                         <div className="flex justify-between items-start mb-6">
                            <span className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest">#{o.orderNumber}</span>
                            <span className={`${status?.color || 'bg-slate-400'} text-white px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest shadow-sm`}>{status?.name}</span>
                         </div>
                         <h3 className="text-xl font-black text-slate-900 mb-1">{client?.name || 'Cliente Desconocido'}</h3>
                         <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-6">{category?.name} • {o.width}x{o.height}cm • Qty: {o.quantity}</p>
                         
                         <div className="grid grid-cols-2 gap-4 mb-8">
                            <div className="bg-slate-50 p-4 rounded-2xl">
                               <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total</div>
                               <div className="text-lg font-black text-slate-900">${o.totalPrice}</div>
                            </div>
                            <div className="bg-indigo-50 p-4 rounded-2xl">
                               <div className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-1">Restante</div>
                               <div className="text-lg font-black text-indigo-600">${o.balance}</div>
                            </div>
                         </div>

                         <div className="flex gap-2">
                            <button onClick={() => { setOrderForm(o); setIsOrderModalOpen(true); }} className="flex-1 bg-slate-50 text-slate-400 p-3 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-all flex items-center justify-center"><Edit3Icon size={18}/></button>
                            <button onClick={() => {
                              const phone = client?.phone?.replace(/\D/g,'') || '';
                              const text = `*Ticket #${o.orderNumber}*\n*Total:* $${o.totalPrice}\n*Restante:* $${o.balance}`;
                              window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
                            }} className="flex-1 bg-emerald-50 text-emerald-500 p-3 rounded-xl hover:bg-emerald-100 transition-all flex items-center justify-center"><MessageCircleIcon size={18}/></button>
                            <button onClick={() => deleteOrder(o.id)} className="flex-1 bg-rose-50 text-rose-400 p-3 rounded-xl hover:bg-rose-100 hover:text-rose-600 transition-all flex items-center justify-center"><TrashIcon size={18}/></button>
                         </div>
                      </div>
                   </div>
                 );
               })}
             </div>
          </div>
        )}

        {activeTab === 'clientes' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-3xl font-black text-slate-900 tracking-tight">Directorio</h2>
                  <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-1">Base de datos de clientes</p>
                </div>
                <button onClick={() => { setClientForm({}); setIsClientModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 flex items-center gap-3"><PlusIcon size={18}/> Nuevo Cliente</button>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {appData.clients.filter(c => c.name.toLowerCase().includes(clientSearch.toLowerCase())).map(c => (
                  <div key={c.id} className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group">
                    <button onClick={() => deleteClient(c.id)} className="absolute top-6 right-6 p-2 text-slate-300 hover:text-rose-500 transition-colors"><TrashIcon size={16}/></button>
                    <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6"><UserIcon size={24}/></div>
                    <h3 className="text-xl font-black text-slate-900 mb-4">{c.name}</h3>
                    <div className="space-y-3">
                       <div className="flex items-center gap-3 text-slate-500 text-sm font-bold"><PhoneIcon size={14} className="text-indigo-400"/> {c.phone || 'No registrado'}</div>
                       <div className="flex items-center gap-3 text-slate-500 text-sm font-bold"><MapPinIcon size={14} className="text-indigo-400"/> {c.address || 'Sin dirección'}</div>
                    </div>
                    <button onClick={() => { setClientForm(c); setIsClientModalOpen(true); }} className="mt-8 w-full bg-slate-50 text-slate-400 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-indigo-600 hover:text-white transition-all">Editar Perfil</button>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'config' && (
          <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-500">
             <section className="bg-white rounded-[3rem] p-10 border border-slate-200 shadow-sm">
                <h2 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-4"><LayersIcon className="text-indigo-600"/> Categorías de Servicio</h2>
                <div className="space-y-4">
                   {appData.categories.map(cat => (
                     <div key={cat.id} className="flex items-center gap-4 bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                        <div className="flex-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">{cat.name}</label><div className="font-black text-slate-900">${cat.pricePerUnit}</div></div>
                        <input type="number" placeholder="Nuevo precio" className="bg-white w-32 p-3 rounded-xl border-2 border-slate-100 font-bold outline-none focus:border-indigo-500" onChange={async (e) => {
                           const newPrice = Number(e.target.value);
                           if (newPrice > 0) {
                              const newCats = appData.categories.map(c => c.id === cat.id ? {...c, pricePerUnit: newPrice} : c);
                              setAppData({...appData, categories: newCats});
                              await supabase.from('categories').upsert(newCats);
                           }
                        }} />
                     </div>
                   ))}
                </div>
             </section>
          </div>
        )}
      </main>

      {/* MODAL ORDEN */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-xl rounded-[3rem] p-12 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <button onClick={() => setIsOrderModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><XIcon size={24}/></button>
              <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{orderForm.id ? 'Editar Pedido' : 'Nuevo Pedido'}</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">Completa los datos del ticket</p>
              
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Cliente</label>
                    <select value={orderForm.clientId} onChange={e => setOrderForm({...orderForm, clientId: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500">
                       <option value="">Seleccionar cliente...</option>
                       {appData.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Categoría</label>
                       <select value={orderForm.categoryId} onChange={e => setOrderForm({...orderForm, categoryId: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500">
                          <option value="">Servicio...</option>
                          {appData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Cantidad</label>
                       <input type="number" value={orderForm.quantity || ''} onChange={e => setOrderForm({...orderForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500" />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <input type="number" placeholder="Ancho (cm)" value={orderForm.width || ''} onChange={e => setOrderForm({...orderForm, width: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500" />
                    <input type="number" placeholder="Alto (cm)" value={orderForm.height || ''} onChange={e => setOrderForm({...orderForm, height: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500" />
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Seña ($)</label>
                    <input type="number" value={orderForm.deposit || ''} onChange={e => setOrderForm({...orderForm, deposit: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500" />
                 </div>
                 <div className="pt-6">
                    <button onClick={saveOrder} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Guardar Ticket</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL CLIENTE */}
      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-xl rounded-[3rem] p-12 shadow-2xl relative animate-in zoom-in-95 duration-200">
              <button onClick={() => setIsClientModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><XIcon size={24}/></button>
              <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{clientForm.id ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-10">Información de contacto</p>
              
              <div className="space-y-6">
                 <input placeholder="Nombre completo" value={clientForm.name || ''} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500" />
                 <input placeholder="WhatsApp (ej: 549...)" value={clientForm.phone || ''} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500" />
                 <input placeholder="Dirección / Localidad" value={clientForm.address || ''} onChange={e => setClientForm({...clientForm, address: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500" />
                 <div className="pt-6">
                    <button onClick={saveClient} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all">Guardar Perfil</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
