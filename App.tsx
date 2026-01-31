
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
  DatabaseIcon,
  ShieldAlertIcon
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
  statuses: [
    { id: 'hacer', name: 'Hacer', color: 'bg-slate-400' },
    { id: 'presupuestar', name: 'Presupuestar', color: 'bg-amber-500' },
    { id: 'produccion', name: 'Producción', color: 'bg-indigo-500' },
    { id: 'entregado', name: 'Entregado', color: 'bg-emerald-500' },
  ] as OrderStatus[],
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

  // Comprobar si supabase está listo
  const isSupabaseReady = !!supabase;

  useEffect(() => {
    if (!isSupabaseReady) {
      setLoading(false);
      return;
    }

    // Obtener sesión inicial de forma segura
    supabase!.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        fetchAllData(session.user.id);
      } else {
        setSession(null);
      }
      setLoading(false);
    });

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase!.auth.onAuthStateChange((_event, newSession) => {
      if (newSession?.user) {
        setSession(newSession);
        fetchAllData(newSession.user.id);
      } else {
        setSession(null);
        setAppData(DEFAULT_DATA);
      }
    });

    return () => subscription.unsubscribe();
  }, [isSupabaseReady]);

  const fetchAllData = async (userId: string) => {
    if (!supabase) return;
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
    if (!supabase || !session?.user) return;
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
    if (!supabase) return;
    setAuthError('');
    setLoading(true);
    const { error, data } = isRegistering 
      ? await supabase.auth.signUp({ email: authEmail, password: authPassword })
      : await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
    
    if (error) setAuthError(error.message);
    else if (data.session) setSession(data.session);
    
    setLoading(false);
  };

  const handleSignOut = async () => {
    if (supabase) {
      setLoading(true);
      await supabase.auth.signOut();
      setSession(null);
      setAppData(DEFAULT_DATA);
      setLoading(false);
    }
  };

  // --- LÓGICA DE PLIEGO ---
  const [newDesign, setNewDesign] = useState<Omit<DesignItem, 'id'>>({ name: '', width: 0, height: 0, quantity: 1 });
  const PREVIEW_SCALE = 6;
  const packingResult = useMemo(() => packDesigns(appData.designs, appData.sheetWidth, appData.designSpacing), [appData.designs, appData.sheetWidth, appData.designSpacing]);
  
  const calculateDetails = useCallback((item: DesignItem): CalculationResult => {
    const totalLength = packingResult.totalLength || 1;
    const tier = appData.costTiers.find(t => totalLength >= t.minLargo && totalLength < t.maxLargo) || appData.costTiers[appData.costTiers.length - 1];
    const precioCm = tier?.precioPorCm || 0;
    const totalProdCost = totalLength * precioCm;
    
    const totalDesignArea = appData.designs.reduce((acc, d) => acc + (d.width * d.height * d.quantity), 0) || 1;
    const itemArea = (item.width * item.height) * item.quantity;
    const unitProdCost = (itemArea / totalDesignArea * totalProdCost) / item.quantity;
    const unitClientPrice = unitProdCost * (1 + (appData.profitMargin / 100));
    
    return { unitProductionCost: unitProdCost, unitClientPrice, totalProductionCost: unitProdCost * item.quantity, totalClientPrice: unitClientPrice * item.quantity };
  }, [appData.designs, packingResult.totalLength, appData.profitMargin, appData.costTiers]);

  const totals = useMemo(() => {
    return appData.designs.reduce((acc, d) => {
      const res = calculateDetails(d);
      return { ventaTotal: acc.ventaTotal + res.totalClientPrice };
    }, { ventaTotal: 0 });
  }, [appData.designs, calculateDetails]);

  // --- MODALS ---
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<Partial<Order>>({});
  const [clientForm, setClientForm] = useState<Partial<Client>>({});

  const saveOrder = async () => {
    if (!supabase || !session?.user) return;
    const cat = appData.categories.find(c => c.id === orderForm.categoryId);
    const totalPrice = (cat?.pricePerUnit || 0) * (orderForm.quantity || 0);
    const orderData = { 
      ...orderForm, 
      user_id: session.user.id, 
      totalPrice, 
      balance: totalPrice - (orderForm.deposit || 0),
      orderNumber: orderForm.orderNumber || `TK-${Date.now().toString().slice(-6)}`,
      statusId: orderForm.statusId || 'hacer'
    };
    const { data, error } = await supabase.from('orders').upsert(orderData).select().single();
    if (!error) {
      setAppData(prev => ({...prev, orders: orderForm.id ? prev.orders.map(o => o.id === data.id ? data : o) : [data, ...prev.orders]}));
      setIsOrderModalOpen(false);
    }
  };

  const saveClient = async () => {
    if (!supabase || !session?.user) return;
    const { data, error } = await supabase.from('clients').upsert({...clientForm, user_id: session.user.id}).select().single();
    if (!error) {
      setAppData(prev => ({...prev, clients: clientForm.id ? prev.clients.map(c => c.id === data.id ? data : c) : [...prev.clients, data]}));
      setIsClientModalOpen(false);
    }
  };

  const deleteOrder = async (id: string) => {
    if (supabase) {
      await supabase.from('orders').delete().eq('id', id);
      setAppData(prev => ({...prev, orders: prev.orders.filter(o => o.id !== id)}));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center flex-col gap-4">
        <Loader2Icon className="text-indigo-600 animate-spin" size={48} />
        <p className="font-black text-[10px] uppercase tracking-widest text-slate-400">Iniciando sistema...</p>
      </div>
    );
  }

  // Si Supabase no está configurado, mostramos el aviso preventivo
  if (!isSupabaseReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-center">
        <div className="bg-white max-w-md p-10 rounded-[3rem] shadow-2xl border border-rose-100">
          <div className="bg-rose-100 text-rose-600 p-5 rounded-[2rem] inline-block mb-8"><DatabaseIcon size={44}/></div>
          <h1 className="text-2xl font-black text-slate-900 mb-4 tracking-tight">Base de Datos no conectada</h1>
          <p className="text-slate-500 text-sm font-medium leading-relaxed mb-8">Debes ir a <b>Settings > Environment Variables</b> en Vercel y añadir:<br/><code className="bg-slate-100 px-2 py-1 rounded block mt-3 font-bold text-slate-900">VITE_SUPABASE_URL</code> y <code className="bg-slate-100 px-2 py-1 rounded block mt-1 font-bold text-slate-900">VITE_SUPABASE_ANON_KEY</code></p>
          <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all">Reintentar Conexión</button>
        </div>
      </div>
    );
  }

  // Si no hay sesión, mostramos el LOGIN (Garantizado que aparecerá porque el error de JS ya no ocurre)
  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-[3.5rem] p-12 shadow-2xl border border-slate-200">
           <div className="flex flex-col items-center mb-10 text-center">
              <div className="bg-indigo-600 p-4 rounded-[2rem] text-white shadow-xl shadow-indigo-100 mb-6"><CalculatorIcon size={40}/></div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter">Crea<span className="text-indigo-600">Stickers</span></h1>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-2">{isRegistering ? 'Nueva cuenta de empresa' : 'Acceso administrativo'}</p>
           </div>
           
           <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Email</label>
                 <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500 transition-all" placeholder="ejemplo@correo.com" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Contraseña</label>
                 <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500 transition-all" placeholder="••••••••" />
              </div>

              {authError && (
                <div className="bg-rose-50 text-rose-500 p-4 rounded-2xl text-[11px] font-black uppercase tracking-tight border border-rose-100 flex items-center gap-3">
                  <ShieldAlertIcon size={18}/> {authError}
                </div>
              )}

              <button type="submit" className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all flex items-center justify-center gap-3">
                 {isRegistering ? 'Registrarse' : 'Ingresar'}
              </button>
           </form>

           <div className="mt-8 text-center">
              <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                 {isRegistering ? '¿Ya tienes cuenta? Entrar' : '¿Sin cuenta? Regístrate'}
              </button>
           </div>
        </div>
      </div>
    );
  }

  // UI PRINCIPAL (Cuando hay sesión)
  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-700 pt-28 pb-12">
      <header className="fixed top-0 left-0 right-0 bg-white/95 backdrop-blur-md border-b border-slate-200 px-8 py-5 z-[100] shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200"><CalculatorIcon size={24}/></div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Crea<span className="text-indigo-600">Stickers</span></h1>
          </div>
          
          <nav className="flex items-center bg-slate-100 p-1.5 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto max-w-full">
            <button onClick={() => setActiveTab('dash')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'dash' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Dashboard</button>
            <button onClick={() => setActiveTab('presupuestar')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'presupuestar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Pliego</button>
            <button onClick={() => setActiveTab('pedidos')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'pedidos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Pedidos</button>
            <button onClick={() => setActiveTab('clientes')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'clientes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Clientes</button>
            <button onClick={() => setActiveTab('config')} className={`px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'config' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Precios</button>
          </nav>

          <div className="flex items-center gap-4">
             <div className="hidden lg:flex items-center gap-2 text-[10px] font-black text-emerald-500 uppercase bg-emerald-50 px-3 py-1.5 rounded-full">
                <CheckCircle2Icon size={12}/> Online: {lastSaved}
             </div>
             <button 
                onClick={handleSignOut} 
                className="flex items-center gap-2 px-5 py-2.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-xl hover:bg-rose-100 transition-all font-black text-[10px] uppercase tracking-widest"
             >
                <LogOutIcon size={16}/> Cerrar Sesión
             </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        {activeTab === 'dash' && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
             {appData.statuses.map(s => (
                <div key={s.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                   <div className={`w-3 h-3 rounded-full ${s.color} mb-4`}></div>
                   <div className="text-4xl font-black text-slate-900 mb-1">{appData.orders.filter(o => o.statusId === s.id).length}</div>
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{s.name}</div>
                </div>
             ))}
          </div>
        )}

        {activeTab === 'presupuestar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 animate-in fade-in duration-500">
             <div className="lg:col-span-4 space-y-6">
                <div className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
                   <h2 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-8 flex items-center gap-2"><Settings2Icon size={16}/> Config Pliego</h2>
                   <div className="space-y-6">
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Ancho (cm)</label><input type="number" value={appData.sheetWidth} onChange={e => updateData('sheetWidth', Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold outline-none" /></div>
                      <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Espaciado (cm)</label><input type="number" step="0.1" value={appData.designSpacing} onChange={e => updateData('designSpacing', Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold outline-none" /></div>
                   </div>
                </div>

                <div className="bg-indigo-600 text-white p-8 rounded-[3rem] shadow-xl shadow-indigo-100">
                   <h2 className="text-xs font-black uppercase tracking-widest mb-6 opacity-70">Agregar Stickers</h2>
                   <div className="space-y-4">
                      <input placeholder="Nombre" value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 font-bold text-white outline-none" />
                      <div className="grid grid-cols-2 gap-4">
                        <input type="number" placeholder="W" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 font-bold text-white outline-none" />
                        <input type="number" placeholder="H" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 font-bold text-white outline-none" />
                      </div>
                      <input type="number" placeholder="Cant." value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-4 font-bold text-white outline-none" />
                      <button onClick={() => {
                        if (newDesign.width > 0 && newDesign.height > 0) {
                          setAppData(prev => ({...prev, designs: [...prev.designs, {...newDesign, id: Date.now().toString()}]}));
                          setNewDesign({name: '', width: 0, height: 0, quantity: 1});
                        }
                      }} className="w-full bg-white text-indigo-600 py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg active:scale-95 transition-all">Añadir</button>
                   </div>
                </div>
             </div>

             <div className="lg:col-span-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Largo Total</div>
                      <div className="text-4xl font-black text-slate-900">{packingResult.totalLength.toFixed(1)} <span className="text-xl text-slate-300">cm</span></div>
                   </div>
                   <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Costo Total</div>
                      <div className="text-4xl font-black text-indigo-600">${Math.round(totals.ventaTotal)}</div>
                   </div>
                </div>

                <div className="bg-white p-12 rounded-[4rem] border border-slate-200 shadow-sm overflow-x-auto min-h-[400px]">
                   <h3 className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-10 text-center">Previsualización del Corte</h3>
                   <div className="relative bg-slate-50 border-4 border-dashed border-slate-200 rounded-3xl mx-auto" style={{ width: appData.sheetWidth * PREVIEW_SCALE, height: Math.max(300, packingResult.totalLength * PREVIEW_SCALE) }}>
                      {packingResult.packed.map((p, i) => {
                         const col = DESIGN_COLORS[i % DESIGN_COLORS.length];
                         return (
                            <div key={p.id} className={`absolute border p-1 text-[8px] font-black overflow-hidden flex items-center justify-center text-center rounded-lg ${col.bg} ${col.text} ${col.border}`} style={{ left: p.x * PREVIEW_SCALE, top: p.y * PREVIEW_SCALE, width: p.width * PREVIEW_SCALE, height: p.height * PREVIEW_SCALE }}>
                               {p.width > 3 && <span className="truncate">{p.name || `${p.width}x${p.height}`}</span>}
                            </div>
                         );
                      })}
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* El resto de componentes (pedidos, clientes, config) siguen la misma estructura de layout */}
        {activeTab === 'pedidos' && (
           <div className="space-y-6">
              <div className="flex justify-between items-center mb-10">
                 <h2 className="text-3xl font-black text-slate-900 tracking-tighter">Pedidos</h2>
                 <button onClick={() => { setOrderForm({}); setIsOrderModalOpen(true); }} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-3"><PlusIcon size={18}/> Nuevo Ticket</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {appData.orders.map(o => (
                    <div key={o.id} className="bg-white p-8 rounded-[3rem] border border-slate-200 shadow-sm">
                       <div className="flex justify-between items-start mb-6">
                          <span className="text-[10px] font-black text-slate-400 uppercase">#{o.orderNumber}</span>
                          <span className="bg-indigo-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase">{o.quantity} un.</span>
                       </div>
                       <h3 className="text-xl font-black text-slate-900 mb-6">{appData.clients.find(c => c.id === o.clientId)?.name || 'S/N'}</h3>
                       <div className="flex justify-between items-end">
                          <div className="text-2xl font-black text-indigo-600">${o.totalPrice}</div>
                          <button onClick={() => deleteOrder(o.id)} className="p-3 text-slate-300 hover:text-rose-500 transition-colors"><TrashIcon size={20}/></button>
                       </div>
                    </div>
                 ))}
              </div>
           </div>
        )}
      </main>

      {/* MODAL ORDEN (Simple para evitar bugs) */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[200] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-lg rounded-[3.5rem] p-12 shadow-2xl relative">
              <button onClick={() => setIsOrderModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-colors"><XIcon size={24}/></button>
              <h2 className="text-3xl font-black text-slate-900 mb-10 tracking-tight">Nuevo Ticket</h2>
              <div className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Cliente</label>
                    <select value={orderForm.clientId} onChange={e => setOrderForm({...orderForm, clientId: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold outline-none">
                       <option value="">Seleccionar...</option>
                       {appData.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Categoría</label>
                       <select value={orderForm.categoryId} onChange={e => setOrderForm({...orderForm, categoryId: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold outline-none">
                          <option value="">Servicio...</option>
                          {appData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2 tracking-widest">Cantidad</label>
                       <input type="number" value={orderForm.quantity || ''} onChange={e => setOrderForm({...orderForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold outline-none" />
                    </div>
                 </div>
                 <button onClick={saveOrder} className="w-full bg-indigo-600 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all mt-6">Crear Pedido</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
