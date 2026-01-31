
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  Settings2Icon, 
  CalculatorIcon, 
  CheckCircle2Icon,
  PackageIcon,
  Edit3Icon,
  XIcon,
  LayersIcon,
  LogOutIcon,
  Loader2Icon,
  DatabaseIcon,
  ShieldAlertIcon,
  ExternalLinkIcon,
  Maximize2Icon,
  LayoutIcon,
  InfoIcon,
  AlertCircleIcon
} from 'lucide-react';
import { 
  DesignItem, 
  CalculationResult, 
  Client,
  Category,
  OrderStatus,
  Order,
  QuantityDiscount
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
  const [activeTab, setActiveTab] = useState<Tab>('presupuestar');
  const [appData, setAppData] = useState<AppDataType>(DEFAULT_DATA);
  const [lastSaved, setLastSaved] = useState<string>('');
  
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [authError, setAuthError] = useState('');

  const isSupabaseReady = !!supabase;

  useEffect(() => {
    if (!isSupabaseReady) {
      setLoading(false);
      return;
    }

    supabase!.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSession(session);
        fetchAllData(session.user.id);
      } else {
        setSession(null);
      }
      setLoading(false);
    });

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

  const [newDesign, setNewDesign] = useState<Omit<DesignItem, 'id'>>({ name: '', width: 0, height: 0, quantity: 1 });
  const PREVIEW_SCALE = 8;
  const packingResult = useMemo(() => packDesigns(appData.designs, appData.sheetWidth, appData.designSpacing), [appData.designs, appData.sheetWidth, appData.designSpacing]);
  
  const materialEfficiency = useMemo(() => {
    if (packingResult.totalLength === 0) return 0;
    const totalArea = appData.sheetWidth * packingResult.totalLength;
    return Math.round((packingResult.totalAreaUsed / totalArea) * 100);
  }, [packingResult, appData.sheetWidth]);

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

  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false);
  const [orderForm, setOrderForm] = useState<Partial<Order>>({});

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

  const deleteOrder = async (id: string) => {
    if (supabase) {
      await supabase.from('orders').delete().eq('id', id);
      setAppData(prev => ({...prev, orders: prev.orders.filter(o => o.id !== id)}));
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center flex-col gap-6">
        <div className="relative">
          <Loader2Icon className="text-indigo-600 animate-spin" size={64} />
          <CalculatorIcon className="absolute inset-0 m-auto text-indigo-400" size={24}/>
        </div>
        <p className="font-black text-[11px] uppercase tracking-[0.3em] text-slate-400">CreaStickers Pro v1.2</p>
      </div>
    );
  }

  if (!isSupabaseReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white max-w-2xl w-full p-12 rounded-[4rem] shadow-2xl border border-rose-100 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-rose-500 to-rose-400"></div>
          <div className="flex flex-col md:flex-row gap-12">
            <div className="flex-1">
              <div className="bg-rose-50 text-rose-500 p-6 rounded-[2.5rem] inline-block mb-8 shadow-inner"><DatabaseIcon size={48}/></div>
              <h1 className="text-4xl font-black text-slate-900 mb-6 tracking-tighter">Acceso Restringido</h1>
              <p className="text-slate-500 font-medium leading-relaxed mb-10">
                El motor de base de datos no está vinculado. Tu taller necesita las variables <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> configuradas en el servidor.
              </p>

              <div className="space-y-5">
                 <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 group hover:border-indigo-200 transition-all">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">URL del Proyecto</span>
                    <code className="text-xs font-mono text-slate-600 break-all select-all">https://abc-xyz.supabase.co</code>
                 </div>
                 <div className="p-6 bg-slate-50 rounded-3xl border-2 border-slate-100 group hover:border-indigo-200 transition-all">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-3">Clave de Acceso (Anon Key)</span>
                    <code className="text-xs font-mono text-slate-600 break-all select-all">eyJhbGciOiJIUzI1NiIsInR5cCI...</code>
                 </div>
              </div>
            </div>

            <div className="md:w-72 flex flex-col gap-4">
              <button onClick={() => window.location.reload()} className="w-full bg-slate-900 text-white py-6 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-indigo-600 transition-all shadow-xl shadow-slate-200">Reconectar</button>
              <a href="https://supabase.com/dashboard" target="_blank" className="flex items-center justify-center gap-3 py-6 rounded-3xl bg-indigo-50 text-indigo-600 font-black text-xs uppercase tracking-widest hover:bg-indigo-100 transition-all"><ExternalLinkIcon size={18}/> Obtener Claves</a>
              <div className="mt-auto p-6 bg-amber-50 rounded-3xl border border-amber-100 flex items-start gap-3">
                <AlertCircleIcon className="text-amber-500 shrink-0" size={20}/>
                <p className="text-[10px] font-bold text-amber-700 leading-tight">Las variables deben estar en el panel de Vercel/GitHub Settings.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white w-full max-w-md rounded-[4rem] p-16 shadow-2xl border border-slate-100 relative overflow-hidden">
           <div className="absolute top-0 left-0 w-full h-2 bg-indigo-600"></div>
           <div className="flex flex-col items-center mb-12 text-center">
              <div className="bg-indigo-600 p-5 rounded-[2.2rem] text-white shadow-2xl shadow-indigo-200 mb-8"><LayoutIcon size={44}/></div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tighter">Crea<span className="text-indigo-600">Stickers</span></h1>
              <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-4">Taller Administrativo Pro</p>
           </div>
           
           <form onSubmit={handleAuth} className="space-y-6">
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Correo Corporativo</label>
                 <input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 font-bold outline-none focus:border-indigo-500 transition-all" placeholder="ejemplo@taller.com" />
              </div>
              <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Contraseña Segura</label>
                 <input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-5 font-bold outline-none focus:border-indigo-500 transition-all" placeholder="••••••••" />
              </div>
              {authError && <div className="bg-rose-50 text-rose-500 p-5 rounded-2xl text-[10px] font-black uppercase border border-rose-100 flex items-center gap-3"><ShieldAlertIcon size={16}/> {authError}</div>}
              <button type="submit" className="w-full bg-indigo-600 text-white py-6 rounded-3xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-100 hover:bg-indigo-700 transition-all active:scale-95">
                 {isRegistering ? 'Crear Empresa' : 'Entrar al Sistema'}
              </button>
           </form>
           <div className="mt-10 text-center border-t border-slate-50 pt-8">
              <button onClick={() => { setIsRegistering(!isRegistering); setAuthError(''); }} className="text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-indigo-600 transition-colors">
                 {isRegistering ? '¿Ya eres miembro? Inicia Sesión' : '¿Nuevo taller? Regístrate Gratis'}
              </button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-700 pt-32 pb-12 overflow-x-hidden">
      <header className="fixed top-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-b border-slate-100 px-10 py-6 z-[100] shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-8">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-xl shadow-indigo-100"><CalculatorIcon size={28}/></div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase leading-none">CreaStickers</h1>
              <span className="text-[9px] font-black text-indigo-500 uppercase tracking-[0.2em] mt-1 block">Panel de Control</span>
            </div>
          </div>
          
          <nav className="flex items-center bg-slate-50 p-1.5 rounded-3xl border border-slate-200 shadow-inner">
            <button onClick={() => setActiveTab('presupuestar')} className={`px-8 py-3.5 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'presupuestar' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Cálculo de Pliego</button>
            <button onClick={() => setActiveTab('pedidos')} className={`px-8 py-3.5 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'pedidos' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Mis Pedidos</button>
            <button onClick={() => setActiveTab('clientes')} className={`px-8 py-3.5 rounded-[1.2rem] text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'clientes' ? 'bg-white text-indigo-600 shadow-xl' : 'text-slate-400 hover:text-slate-600'}`}>Agenda</button>
          </nav>

          <div className="flex items-center gap-5">
             <div className="hidden lg:flex flex-col items-end">
                <span className="text-[10px] font-black text-slate-900 uppercase">{session.user.email.split('@')[0]}</span>
                <span className="text-[8px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-1"><div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></div> Sincronizado</span>
             </div>
             <button onClick={handleSignOut} className="p-4 bg-rose-50 text-rose-500 rounded-2xl border border-rose-100 hover:bg-rose-100 transition-all shadow-sm active:scale-95"><LogOutIcon size={22}/></button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        {activeTab === 'presupuestar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
             
             {/* CONFIGURACIÓN Y ENTRADA */}
             <div className="lg:col-span-4 space-y-10">
                <div className="bg-white p-10 rounded-[3.5rem] border border-slate-100 shadow-sm relative overflow-hidden group">
                   <div className="absolute -right-4 -bottom-4 text-slate-50 rotate-12 transition-transform group-hover:scale-110"><Settings2Icon size={120}/></div>
                   <h2 className="text-[11px] font-black uppercase tracking-widest text-slate-400 mb-10 flex items-center gap-3 relative z-10"><InfoIcon size={18}/> Parámetros Base</h2>
                   <div className="space-y-8 relative z-10">
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Ancho del Rollo (cm)</label>
                         <div className="relative">
                            <input type="number" value={appData.sheetWidth} onChange={e => updateData('sheetWidth', Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-200 rounded-[1.8rem] p-6 font-black text-2xl outline-none focus:border-indigo-500 transition-all pr-16" />
                            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-300 font-black">CM</span>
                         </div>
                      </div>
                      <div className="space-y-3">
                         <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Espaciado GIS (cm)</label>
                         <input type="number" step="0.1" value={appData.designSpacing} onChange={e => updateData('designSpacing', Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-200 rounded-[1.8rem] p-5 font-bold outline-none focus:border-indigo-500 transition-all" />
                      </div>
                   </div>
                </div>

                <div className="bg-indigo-600 text-white p-12 rounded-[4rem] shadow-[0_30px_60px_-15px_rgba(79,70,229,0.3)] relative overflow-hidden">
                   <div className="absolute right-0 top-0 w-32 h-32 bg-white/10 rounded-bl-full flex items-center justify-center text-white/20"><Maximize2Icon size={64}/></div>
                   <h2 className="text-xs font-black uppercase tracking-[0.2em] mb-10 text-indigo-100">Nueva Pieza</h2>
                   <div className="space-y-6 relative z-10">
                      <input placeholder="Nombre (ej. Logo Nike)" value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-6 font-bold text-white outline-none placeholder:text-white/30 focus:border-white/50 transition-all shadow-inner" />
                      <div className="grid grid-cols-2 gap-5">
                        <div className="space-y-2">
                           <span className="text-[9px] font-black text-indigo-100 uppercase ml-3">Ancho</span>
                           <input type="number" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-5 font-bold text-white outline-none" placeholder="0" />
                        </div>
                        <div className="space-y-2">
                           <span className="text-[9px] font-black text-indigo-100 uppercase ml-3">Alto</span>
                           <input type="number" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-5 font-bold text-white outline-none" placeholder="0" />
                        </div>
                      </div>
                      <div className="space-y-2">
                         <span className="text-[9px] font-black text-indigo-100 uppercase ml-3">Unidades Requeridas</span>
                         <input type="number" value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="w-full bg-white/10 border-2 border-white/20 rounded-2xl p-5 font-bold text-white outline-none" placeholder="1" />
                      </div>
                      <button onClick={() => {
                        if (newDesign.width > 0 && newDesign.height > 0) {
                          setAppData(prev => ({...prev, designs: [...prev.designs, {...newDesign, id: Date.now().toString()}]}));
                          setNewDesign({name: '', width: 0, height: 0, quantity: 1});
                        }
                      }} className="w-full bg-white text-indigo-600 py-7 rounded-[2.2rem] font-black text-sm uppercase tracking-widest shadow-2xl active:scale-95 transition-all mt-4">Calcular y Sumar</button>
                   </div>
                </div>
             </div>

             {/* RESULTADOS Y VISUALIZACIÓN */}
             <div className="lg:col-span-8 space-y-10">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                   <div className="md:col-span-2 bg-white p-14 rounded-[4.5rem] border border-slate-100 shadow-xl relative overflow-hidden group">
                      <div className="absolute right-0 top-0 w-32 h-32 bg-slate-50 rounded-bl-[4.5rem] flex items-center justify-center text-slate-200 group-hover:text-indigo-100 transition-colors"><LayoutIcon size={64}/></div>
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-4">Largo Total Requerido</div>
                      <div className="flex items-baseline gap-4">
                         <div className="text-[10rem] font-black text-slate-900 tracking-tighter leading-none">{packingResult.totalLength.toFixed(1)}</div>
                         <div className="text-4xl font-black text-slate-300 uppercase tracking-widest">cm</div>
                      </div>
                      <div className="mt-8 flex items-center gap-6">
                         <div className="flex-1">
                            <div className="flex justify-between text-[9px] font-black text-slate-400 uppercase mb-2"><span>Aprovechamiento de Material</span><span>{materialEfficiency}%</span></div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
                               <div className="h-full bg-indigo-600 rounded-full transition-all duration-1000" style={{ width: `${materialEfficiency}%` }}></div>
                            </div>
                         </div>
                         <div className="text-[9px] font-black text-slate-400 uppercase leading-tight bg-slate-50 p-3 rounded-2xl border border-slate-100">Algoritmo Skyline<br/>Optimizado</div>
                      </div>
                   </div>

                   <div className="bg-gradient-to-br from-indigo-50 to-white p-14 rounded-[4.5rem] border border-indigo-100 shadow-xl flex flex-col justify-center text-center">
                      <div className="text-[11px] font-black text-indigo-400 uppercase tracking-widest mb-6">Precio Sugerido</div>
                      <div className="flex flex-col">
                         <span className="text-4xl font-black text-indigo-300 leading-none">$</span>
                         <span className="text-8xl font-black text-indigo-600 tracking-tighter leading-none my-2">{Math.round(totals.ventaTotal).toLocaleString()}</span>
                      </div>
                      <div className="mt-10 inline-flex items-center justify-center gap-3 bg-indigo-600 text-white px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-200">
                         Margen {appData.profitMargin}%
                      </div>
                   </div>
                </div>

                <div className="bg-white p-16 rounded-[5rem] border border-slate-100 shadow-2xl min-h-[700px] overflow-hidden group">
                   <div className="flex justify-between items-center mb-16">
                      <h3 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-4"><Maximize2Icon size={20} className="text-indigo-600"/> Mapa de Impresión</h3>
                      <button onClick={() => setAppData(p => ({...p, designs: []}))} className="bg-rose-50 text-rose-500 p-4 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-sm active:rotate-12"><TrashIcon size={24}/></button>
                   </div>
                   
                   <div className="relative bg-[#f8fafc] border-[6px] border-dashed border-slate-200 rounded-[4rem] mx-auto transition-all duration-700 shadow-inner group-hover:border-indigo-200" 
                        style={{ width: appData.sheetWidth * PREVIEW_SCALE, height: Math.max(450, packingResult.totalLength * PREVIEW_SCALE) }}>
                      {packingResult.packed.map((p, i) => {
                         const col = DESIGN_COLORS[i % DESIGN_COLORS.length];
                         return (
                            <div key={p.id} className={`absolute border-2 p-2 text-[10px] font-black overflow-hidden flex flex-col items-center justify-center text-center rounded-[1.4rem] shadow-xl transition-all hover:scale-[1.05] hover:z-50 active:scale-95 cursor-default ${col.bg} ${col.text} ${col.border}`} 
                                 style={{ left: p.x * PREVIEW_SCALE, top: p.y * PREVIEW_SCALE, width: p.width * PREVIEW_SCALE, height: p.height * PREVIEW_SCALE }}>
                               {p.width > 3 && <span className="leading-none mb-1 drop-shadow-sm truncate w-full px-1">{p.name || `${p.width}x${p.height}`}</span>}
                               {p.width > 2.5 && p.height > 2.5 && <span className="opacity-70 text-[8px] font-medium">{p.width}×{p.height}</span>}
                            </div>
                         );
                      })}
                      {packingResult.packed.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 animate-pulse">
                           <LayoutIcon size={80} className="mb-6 opacity-30"/>
                           <p className="text-[12px] font-black uppercase tracking-[0.4em]">Pliego Vacío</p>
                        </div>
                      )}
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* MANTENEMOS LAS OTRAS PESTAÑAS IGUAL POR CONSISTENCIA */}
        {activeTab === 'pedidos' && (
           <div className="animate-in fade-in slide-in-from-right-8 duration-500">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 mb-16">
                 <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Gestión de Taller</h2>
                    <p className="text-slate-400 font-bold text-[11px] uppercase mt-2 tracking-widest flex items-center gap-2"><div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div> Cola de Producción Activa</p>
                 </div>
                 <button onClick={() => { setOrderForm({}); setIsOrderModalOpen(true); }} className="bg-indigo-600 text-white px-12 py-6 rounded-[2.2rem] font-black text-xs uppercase tracking-widest shadow-[0_20px_40px_-10px_rgba(79,70,229,0.3)] flex items-center gap-4 hover:bg-indigo-700 hover:-translate-y-1 transition-all active:scale-95"><PlusIcon size={20}/> Nuevo Pedido</button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                 {appData.orders.map(o => (
                    <div key={o.id} className="bg-white p-12 rounded-[4rem] border border-slate-100 shadow-sm hover:shadow-2xl hover:-translate-y-2 transition-all group">
                       <div className="flex justify-between items-start mb-10">
                          <span className="text-[11px] font-black text-slate-300 uppercase tracking-widest group-hover:text-indigo-200 transition-colors">#{o.orderNumber}</span>
                          <span className={`${appData.statuses.find(s=>s.id === o.statusId)?.color || 'bg-slate-400'} text-white px-5 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg`}>{appData.statuses.find(s=>s.id === o.statusId)?.name}</span>
                       </div>
                       <h3 className="text-3xl font-black text-slate-900 mb-2 truncate group-hover:text-indigo-600 transition-colors">{appData.clients.find(c => c.id === o.clientId)?.name || 'Cliente Particular'}</h3>
                       <div className="text-indigo-400 font-black text-[10px] uppercase tracking-widest mb-10">{appData.categories.find(c => c.id === o.categoryId)?.name}</div>
                       <div className="flex justify-between items-end border-t border-slate-50 pt-10">
                          <div>
                             <div className="text-[10px] font-black text-slate-300 uppercase mb-2">Total del Trabajo</div>
                             <div className="text-4xl font-black text-slate-900">${o.totalPrice.toLocaleString()}</div>
                          </div>
                          <div className="flex gap-3">
                             <button onClick={() => { setOrderForm(o); setIsOrderModalOpen(true); }} className="p-5 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-600 hover:text-white transition-all shadow-inner"><Edit3Icon size={22}/></button>
                             <button onClick={() => deleteOrder(o.id)} className="p-5 bg-rose-50 text-rose-300 rounded-2xl hover:bg-rose-500 hover:text-white transition-all shadow-inner"><TrashIcon size={22}/></button>
                          </div>
                       </div>
                    </div>
                 ))}
                 {appData.orders.length === 0 && (
                   <div className="col-span-full py-32 text-center bg-white border-[6px] border-dashed border-slate-100 rounded-[5rem] flex flex-col items-center">
                      <PackageIcon className="text-slate-200 mb-10" size={100}/>
                      <p className="text-slate-300 font-black text-[14px] uppercase tracking-[0.6em]">No hay órdenes registradas</p>
                      <button onClick={() => { setOrderForm({}); setIsOrderModalOpen(true); }} className="mt-10 text-indigo-500 font-black text-[10px] uppercase hover:underline">Comenzar primer pedido</button>
                   </div>
                 )}
              </div>
           </div>
        )}

        {activeTab === 'clientes' && (
           <div className="animate-in fade-in duration-500">
             <div className="flex justify-between items-center mb-16">
                 <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Directorio</h2>
                 <button className="bg-indigo-600 text-white px-10 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl">Nuevo Contacto</button>
             </div>
             {/* Lista de clientes simplificada */}
             <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                {appData.clients.map(c => (
                   <div key={c.id} className="bg-white p-10 rounded-[3rem] border border-slate-100 shadow-sm flex flex-col items-center text-center">
                      <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 font-black text-2xl mb-6">{c.name.charAt(0)}</div>
                      <h4 className="text-xl font-black text-slate-900 mb-2">{c.name}</h4>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{c.phone}</p>
                   </div>
                ))}
             </div>
           </div>
        )}
      </main>

      {/* MODAL PEDIDOS */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xl z-[200] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-xl rounded-[4.5rem] p-16 shadow-2xl relative animate-in zoom-in-95 duration-400">
              <button onClick={() => setIsOrderModalOpen(false)} className="absolute top-12 right-12 text-slate-300 hover:text-slate-900 transition-all hover:rotate-90"><XIcon size={32}/></button>
              <div className="flex items-center gap-5 mb-12">
                 <div className="p-4 bg-indigo-600 text-white rounded-3xl shadow-lg shadow-indigo-100"><PackageIcon size={32}/></div>
                 <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase">Ficha de Trabajo</h2>
              </div>
              
              <div className="space-y-8">
                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Titular del Pedido</label>
                    <select value={orderForm.clientId || ''} onChange={e => setOrderForm({...orderForm, clientId: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-[1.8rem] p-6 font-bold outline-none focus:border-indigo-500 transition-all text-lg">
                       <option value="">-- Seleccionar Cliente --</option>
                       {appData.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Tipo de Servicio</label>
                       <select value={orderForm.categoryId || ''} onChange={e => setOrderForm({...orderForm, categoryId: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-[1.8rem] p-5 font-bold outline-none focus:border-indigo-500 transition-all">
                          <option value="">Servicio</option>
                          {appData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                       </select>
                    </div>
                    <div className="space-y-3">
                       <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Cantidad Unidades</label>
                       <input type="number" value={orderForm.quantity || ''} onChange={e => setOrderForm({...orderForm, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-[1.8rem] p-5 font-bold outline-none focus:border-indigo-500 transition-all text-center" />
                    </div>
                 </div>

                 <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-400 uppercase ml-4 tracking-widest">Fase de Producción</label>
                    <div className="grid grid-cols-2 gap-3">
                       {appData.statuses.map(s => (
                          <button key={s.id} onClick={() => setOrderForm({...orderForm, statusId: s.id})} className={`p-5 rounded-2xl border-2 font-black text-[10px] uppercase tracking-widest transition-all ${orderForm.statusId === s.id ? `${s.color} border-transparent text-white shadow-xl` : 'bg-slate-50 border-slate-100 text-slate-400 hover:border-slate-300'}`}>
                             {s.name}
                          </button>
                       ))}
                    </div>
                 </div>

                 <button onClick={saveOrder} className="w-full bg-indigo-600 text-white py-8 rounded-[2.5rem] font-black text-sm uppercase tracking-widest shadow-2xl shadow-indigo-100 mt-10 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all">Confirmar e Imprimir Ticket</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
