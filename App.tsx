
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
  RefreshCwIcon
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
  const [authLoading, setAuthLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showWelcomeMsg, setShowWelcomeMsg] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const [lastSaved, setLastSaved] = useState<string>('');
  const [showSummary, setShowSummary] = useState<Order | null>(null);
  const [confirmModal, setConfirmModal] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);
  const ticketRef = useRef<HTMLDivElement>(null);

  // Formatear fechas de localstorage si vienen como número
  const ensureISO = (val: any): string => {
    if (!val) return new Date().toISOString();
    if (typeof val === 'number') return new Date(val).toISOString();
    return val;
  };

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem(MASTER_KEY);
      if (saved) {
        try {
          let parsed = JSON.parse(saved);
          
          if (parsed.clients) {
            parsed.clients = parsed.clients.map((c: any) => ({
              ...c,
              created_at: ensureISO(c.created_at || c.createdAt)
            }));
          }
          if (parsed.orders) {
            parsed.orders = parsed.orders.map((o: any) => ({
              ...o,
              order_number: o.order_number || o.orderNumber || '',
              client_id: o.client_id || o.clientId || '',
              category_id: o.category_id || o.categoryId || '1',
              total_price: o.total_price || o.totalPrice || 0,
              status_id: o.status_id || o.statusId || 'hacer',
              created_at: ensureISO(o.created_at || o.createdAt)
            }));
          }
          
          setAppData(prev => ({ ...prev, ...parsed }));
        } catch (e) { 
          console.error("Error cargando caché local:", e);
        }
      }

      if (!supabase) {
        setLoading(false);
        return;
      }

      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        setSession(currentSession);
        if (currentSession?.user) {
          await fetchCloudData(currentSession.user.id);
        }

        if (window.location.hash.includes('access_token=')) {
          setShowWelcomeMsg(true);
          setTimeout(() => {
            window.history.replaceState(null, '', window.location.pathname);
          }, 2000);
        }
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
      const [{ data: settings }, { data: cls }, { data: ords }] = await Promise.all([
        supabase.from('settings').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('clients').select('*').eq('user_id', userId),
        supabase.from('orders').select('*').eq('user_id', userId)
      ]);

      setAppData(prev => {
        return {
          ...prev,
          sheetWidth: Number(settings?.sheet_width) || prev.sheetWidth,
          profitMargin: Number(settings?.profit_margin) || prev.profitMargin,
          designSpacing: Number(settings?.design_spacing) || prev.designSpacing,
          clients: (cls && cls.length > 0) ? cls : prev.clients,
          orders: (ords && ords.length > 0) ? ords : prev.orders
        };
      });
    } catch (e) { }
  };

  const pushLocalDataToCloud = async () => {
    if (!supabase || !session?.user) return;
    setIsMigrating(true);
    try {
      if (appData.clients.length > 0) {
        const clientsToUpload = appData.clients.map(c => ({
          id: c.id,
          name: c.name,
          phone: c.phone,
          address: c.address,
          created_at: ensureISO(c.created_at),
          user_id: session.user.id
        }));
        const { error } = await supabase.from('clients').upsert(clientsToUpload);
        if (error) throw error;
      }
      if (appData.orders.length > 0) {
        const ordersToUpload = appData.orders.map(o => ({
          id: o.id,
          order_number: o.order_number,
          client_id: o.client_id,
          width: o.width,
          height: o.height,
          quantity: o.quantity,
          category_id: o.category_id,
          total_price: o.total_price,
          deposit: o.deposit,
          balance: o.balance,
          status_id: o.status_id,
          created_at: ensureISO(o.created_at),
          user_id: session.user.id
        }));
        const { error } = await supabase.from('orders').upsert(ordersToUpload);
        if (error) throw error;
      }
      await supabase.from('settings').upsert({
        user_id: session.user.id,
        sheet_width: appData.sheetWidth,
        profit_margin: appData.profitMargin,
        design_spacing: appData.designSpacing,
        updated_at: new Date().toISOString()
      });
      alert("✅ Sincronización completa. Tus datos ya están en la nube.");
      await fetchCloudData(session.user.id);
    } catch (err: any) {
      alert("❌ Error al sincronizar: " + err.message);
    } finally {
      setIsMigrating(false);
    }
  };

  useEffect(() => {
    if (loading) return;
    localStorage.setItem(MASTER_KEY, JSON.stringify(appData));
    setLastSaved(new Date().toLocaleTimeString());
    
    const syncSettings = async () => {
      if (!supabase || !session?.user) return;
      try {
        await supabase.from('settings').upsert({
          user_id: session.user.id,
          sheet_width: appData.sheetWidth,
          profit_margin: appData.profitMargin,
          design_spacing: appData.designSpacing,
          updated_at: new Date().toISOString()
        });
      } catch (e) { }
    };
    syncSettings();
  }, [appData.sheetWidth, appData.profitMargin, appData.designSpacing, session, loading]);

  const updateData = async (field: keyof AppDataType, value: any) => {
    setAppData(prev => ({ ...prev, [field]: value }));
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) return;
    setAuthLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email: authEmail,
        password: authPassword,
      });

      if (signInError) {
        if (signInError.message.toLowerCase().includes("rate limit")) {
          alert("⏳ Límite de intentos excedido.");
          setAuthLoading(false);
          return;
        }

        if (signInError.message.toLowerCase().includes("invalid login credentials")) {
          const { error: signUpError } = await supabase.auth.signUp({
            email: authEmail,
            password: authPassword,
          });

          if (signUpError) {
             alert(`❌ Error: ${signUpError.message}`);
          } else {
            alert("✅ ¡Revisa tu email para confirmar la cuenta!");
            setIsAuthModalOpen(false);
          }
        } else {
          alert(`❌ Error: ${signInError.message}`);
        }
      } else {
        setIsAuthModalOpen(false);
      }
    } catch (err) {
      alert("Error de conexión.");
    } finally {
      setAuthLoading(false);
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
      order_number: (appData.orders.length + 1).toString().padStart(4, '0'),
      client_id: appData.clients[0]?.id || '',
      category_id: appData.categories[0]?.id || '1',
      quantity: 1,
      width: 0,
      height: 0,
      deposit: 0,
      status_id: 'hacer'
    });
    setIsOrderModalOpen(true);
  };

  const saveOrder = async () => {
    const category = appData.categories.find(c => c.id === orderForm.category_id);
    const total_price = (category?.pricePerUnit || 0) * (orderForm.quantity || 0);
    const deposit = orderForm.deposit || 0;
    const balance = total_price - deposit;
    
    let updatedOrder: Order;
    if (editingOrder) {
      updatedOrder = { ...editingOrder, ...orderForm, total_price, balance } as Order;
      updateData('orders', appData.orders.map(o => o.id === editingOrder.id ? updatedOrder : o));
    } else {
      updatedOrder = { ...orderForm, id: Date.now().toString(), total_price, balance, created_at: new Date().toISOString() } as Order;
      updateData('orders', [...appData.orders, updatedOrder]);
    }

    if (supabase && session?.user) {
      await supabase.from('orders').upsert({ ...updatedOrder, user_id: session.user.id });
    }
    setIsOrderModalOpen(false);
  };

  const filteredOrders = useMemo(() => {
    const search = orderSearch.toLowerCase();
    return appData.orders.filter(o => {
      const client = appData.clients.find(c => c.id === o.client_id);
      const orderNum = (o.order_number || '').toLowerCase();
      const clientName = (client?.name || '').toLowerCase();
      
      const matchesText = clientName.includes(search) || orderNum.includes(search);
      const matchesStatus = orderStatusFilter === 'all' || o.status_id === orderStatusFilter;
      return matchesText && matchesStatus;
    }).sort((a, b) => (new Date(b.created_at).getTime() || 0) - (new Date(a.created_at).getTime() || 0));
  }, [appData.orders, appData.clients, orderSearch, orderStatusFilter]);

  const [isClientModalOpen, setIsClientModalOpen] = useState(false);
  const [clientForm, setClientForm] = useState<Partial<Client>>({ name: '', phone: '', address: '' });
  const [clientSearch, setClientSearch] = useState('');

  const filteredClients = useMemo(() => {
    const search = clientSearch.toLowerCase();
    return appData.clients.filter(c => {
      const name = (c.name || '').toLowerCase();
      const phone = (c.phone || '').toLowerCase();
      return name.includes(search) || phone.includes(search);
    });
  }, [appData.clients, clientSearch]);

  const saveClient = async () => {
    if (!clientForm.name || !clientForm.phone) {
      alert("Nombre y WhatsApp son obligatorios.");
      return;
    }

    // VALIDACIÓN DE WHATSAPP ÚNICO
    const phoneExists = appData.clients.some(c => c.phone === clientForm.phone && c.id !== clientForm.id);
    if (phoneExists) {
      alert("🚨 Error: Ya existe un cliente registrado con este número de WhatsApp.");
      return;
    }

    let updatedClient: Client;
    if (clientForm.id) {
        updatedClient = { ...clientForm } as Client;
        updateData('clients', appData.clients.map(c => c.id === clientForm.id ? updatedClient : c));
    } else {
        updatedClient = { ...clientForm, id: Date.now().toString(), created_at: new Date().toISOString() } as Client;
        updateData('clients', [...appData.clients, updatedClient]);
    }
    
    if (supabase && session?.user) {
      const { error } = await supabase.from('clients').upsert({ 
        id: updatedClient.id,
        name: updatedClient.name,
        phone: updatedClient.phone,
        address: updatedClient.address,
        created_at: updatedClient.created_at, // Ya es ISO string
        user_id: session.user.id 
      });
      if (error) alert("Error al subir a la nube: " + error.message);
    }
    setClientForm({ name: '', phone: '', address: '' });
    setIsClientModalOpen(false);
  };

  const shareToWA = (order: Order) => {
    const client = appData.clients.find(c => c.id === order.client_id);
    const phone = client?.phone.replace(/\D/g,'') || '';
    const clientName = client?.name || 'Cliente';
    const text = `*CreaStickers - Ticket #${order.order_number}*\n\n*Cliente:* ${clientName}\n*Medida:* ${order.width}x${order.height} cm\n*Cantidad:* ${order.quantity}\n*Total:* $${order.total_price}\n*Seña:* $${order.deposit}\n*Restante:* $${order.balance}`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2Icon className="animate-spin text-indigo-600" size={48}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-700 pb-12">
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200 px-6 py-4 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-lg shadow-indigo-200"><CalculatorIcon size={24}/></div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tighter">Crea<span className="text-indigo-600">Stickers</span></h1>
          </div>
          <nav className="flex items-center justify-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-inner overflow-x-auto">
            <button onClick={() => setActiveTab('dash')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'dash' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Inicio</button>
            <button onClick={() => setActiveTab('presupuestar')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'presupuestar' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Presu</button>
            <button onClick={() => setActiveTab('pedidos')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'pedidos' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Pedidos</button>
            <button onClick={() => setActiveTab('clientes')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'clientes' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Clientes</button>
            <button onClick={() => setActiveTab('config')} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${activeTab === 'config' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}>Ajustes</button>
          </nav>
          <div className="flex items-center gap-3 min-w-[200px] justify-end">
             {session?.user ? (
               <button onClick={() => askConfirmation("Cerrar Sesión", "¿Quieres desconectar el taller?", () => supabase?.auth.signOut())} className="flex items-center gap-2 text-[10px] font-black text-emerald-600 uppercase bg-emerald-50 border border-emerald-200 px-5 py-3 rounded-full hover:bg-rose-50 hover:text-rose-600 transition-all shadow-sm">
                 <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                 {session.user.email?.split('@')[0] || 'Conectado'} <LogOutIcon size={12}/>
               </button>
             ) : (
               <button onClick={() => setIsAuthModalOpen(true)} className="flex items-center gap-3 text-[11px] font-black text-white uppercase bg-indigo-600 border-2 border-indigo-400 px-8 py-3 rounded-full hover:bg-indigo-700 hover:scale-105 transition-all shadow-xl">
                 <CloudIcon size={16}/> Sincronizar Nube
               </button>
             )}
          </div>
        </div>
      </header>

      {showWelcomeMsg && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-8 py-4 rounded-full shadow-2xl font-black text-sm uppercase flex items-center gap-4">
          <PartyPopperIcon size={24}/> ¡Cuenta confirmada! Ya estás conectado.
          <button onClick={() => setShowWelcomeMsg(false)} className="bg-white/20 p-1 rounded-full"><XIcon size={16}/></button>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 md:p-10">
        {activeTab === 'dash' && (
           <div className="space-y-10">
              {session?.user && (appData.clients.length > 0 || appData.orders.length > 0) && (
                <div className="bg-indigo-600 rounded-[3rem] p-10 flex flex-col md:flex-row items-center justify-between gap-8 text-white shadow-2xl border-2 border-indigo-400">
                   <div className="flex items-center gap-6">
                      <div className="w-16 h-16 bg-white/20 rounded-3xl flex items-center justify-center backdrop-blur-md"><CloudUploadIcon size={32}/></div>
                      <div>
                         <h3 className="text-xl font-black uppercase tracking-tighter leading-none mb-2">Sincronización Pendiente</h3>
                         <p className="text-indigo-100 text-xs font-bold uppercase tracking-widest opacity-80 leading-relaxed max-w-sm">Tienes datos locales. Súbelos a tu cuenta segura de Supabase.</p>
                      </div>
                   </div>
                   <button disabled={isMigrating} onClick={pushLocalDataToCloud} className="bg-white text-indigo-600 px-10 py-5 rounded-2xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-105 transition-all">
                     {isMigrating ? <Loader2Icon className="animate-spin" size={18}/> : 'Subir a la Nube'}
                   </button>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                 {appData.statuses.map(s => (
                   <div key={s.id} className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center">
                      <div className={`w-4 h-4 rounded-full ${s.color} mb-4`}></div>
                      <div className="text-5xl font-black text-slate-900 mb-2">{appData.orders.filter(o => o.status_id === s.id).length}</div>
                      <div className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">{s.name}</div>
                   </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'presupuestar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
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
                   <input type="text" placeholder="Nombre..." value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-slate-50 rounded-2xl p-4 font-bold" />
                   <div className="grid grid-cols-3 gap-3">
                      <input type="number" placeholder="W" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="bg-slate-50 rounded-2xl p-4 font-bold text-center" />
                      <input type="number" placeholder="H" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="bg-slate-50 rounded-2xl p-4 font-bold text-center" />
                      <input type="number" placeholder="Qty" value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="bg-slate-50 rounded-2xl p-4 font-bold text-center" />
                   </div>
                   <button onClick={addDesign} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl uppercase text-[11px] shadow-xl hover:bg-indigo-700">Optimizar</button>
                </div>
              </section>
            </div>
            
            <div className="lg:col-span-8 space-y-10">
               <section className="bg-white rounded-[3.5rem] p-12 border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-10">
                    <h2 className="font-black text-2xl text-slate-900 flex items-center gap-4"><LayoutIcon className="text-indigo-500" size={24}/> Distribución</h2>
                    <div className="bg-slate-900 text-white px-8 py-3 rounded-2xl font-black text-lg uppercase flex items-center gap-3">
                         <RulerIcon size={20} className="text-indigo-400"/> {packingResult.totalLength.toFixed(1)} cm
                    </div>
                  </div>
                  <div className="bg-slate-950 rounded-[3rem] min-h-[450px] overflow-auto flex justify-center p-14 border-[12px] border-slate-900 shadow-2xl">
                     {packingResult.totalLength > 0 ? (
                        <div className="bg-white relative shadow-2xl" style={{ width: `${appData.sheetWidth * PREVIEW_SCALE}px`, height: `${packingResult.totalLength * PREVIEW_SCALE}px` }}>
                          {packingResult.packed.map(p => {
                            const color = getColorForDesign(p.originalId);
                            return (
                              <div key={p.id} className={`absolute border ${color.bg} ${color.border} ${color.text} flex items-center justify-center text-[7px] font-black overflow-hidden`} style={{ left: `${p.x * PREVIEW_SCALE}px`, top: `${p.y * PREVIEW_SCALE}px`, width: `${p.width * PREVIEW_SCALE}px`, height: `${p.height * PREVIEW_SCALE}px` }}>
                                 <span className="block text-center">{p.width}x{p.height}</span>
                              </div>
                            )
                          })}
                        </div>
                     ) : <div className="text-slate-700 opacity-20 uppercase font-black py-32">Sin diseños</div>}
                  </div>
               </section>

               <section className="bg-white rounded-[3.5rem] p-12 border border-slate-200 shadow-sm">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-separate border-spacing-y-5">
                      <thead>
                        <tr className="text-slate-400 text-[11px] font-black uppercase tracking-widest">
                          <th className="px-6 pb-2">Nombre</th>
                          <th className="text-right pb-2">Unit.</th>
                          <th className="text-right pb-2">Venta</th>
                          <th className="px-6 text-right pb-2">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appData.designs.map(d => {
                          const res = calculateDetails(d);
                          return (
                            <tr key={d.id} className="bg-slate-50 rounded-3xl group">
                              <td className="py-6 px-8 rounded-l-[2rem]">
                                 <div className="font-black text-slate-900 uppercase text-[12px] mb-1">{d.name || 'S/N'}</div>
                                 <div className="text-[10px] font-bold text-slate-400 uppercase">{d.width}x{d.height} CM • QTY: {d.quantity}</div>
                              </td>
                              <td className="text-right font-black text-rose-500 text-sm whitespace-nowrap">${res.unitProductionCost.toFixed(0)}</td>
                              <td className="text-right font-black text-slate-900 text-sm whitespace-nowrap">${res.unitClientPrice.toFixed(0)}</td>
                              <td className="py-6 px-8 text-right rounded-r-[2rem] font-black text-emerald-600 text-xl whitespace-nowrap">
                                 ${res.totalClientPrice.toFixed(0)}
                                 <button onClick={() => updateData('designs', appData.designs.filter(i => i.id !== d.id))} className="ml-5 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all"><TrashIcon size={18}/></button>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
               </section>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
           <div className="space-y-10">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-8 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
                 <div className="relative flex-1 w-full">
                    <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    <input type="text" placeholder="Buscar pedido..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 pl-16 outline-none font-bold" />
                 </div>
                 <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto">
                    <button onClick={() => setOrderStatusFilter('all')} className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase transition-all ${orderStatusFilter === 'all' ? 'bg-slate-900 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>Todos</button>
                    {appData.statuses.map(s => <button key={s.id} onClick={() => setOrderStatusFilter(s.id)} className={`px-6 py-3 rounded-xl text-[11px] font-black uppercase transition-all ${orderStatusFilter === s.id ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border border-slate-200'}`}>{s.name}</button>)}
                    <button onClick={handleOpenNewOrder} className="ml-6 bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl flex items-center gap-3"><PlusIcon size={16}/> Cargar Pedido</button>
                 </div>
              </div>
              <div className="grid gap-5">
                 {filteredOrders.map(o => {
                   const client = appData.clients.find(c => c.id === o.client_id);
                   const status = appData.statuses.find(s => s.id === o.status_id);
                   const isLocal = !(o as any).user_id;
                   return (
                     <div key={o.id} className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center gap-10 group transition-all">
                        <div className="flex-1 flex items-center gap-6 w-full">
                           <div className={`w-16 h-16 rounded-3xl ${status?.color || 'bg-slate-400'} text-white flex flex-col items-center justify-center font-black text-[10px] shadow-xl`}>
                              <span className="opacity-60 uppercase">ID</span> <span className="text-sm">#{o.order_number}</span>
                           </div>
                           <div>
                              <div className="font-black text-slate-900 uppercase text-[15px] mb-1 leading-none flex items-center gap-3">
                                {client?.name || 'Cliente borrado'}
                                {isLocal && session?.user && <span title="Solo local"><CloudOffIcon size={14} className="text-rose-400" /></span>}
                              </div>
                              <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-full text-white text-[9px] ${status?.color || 'bg-slate-400'}`}>{status?.name || 'S/E'}</span>
                                {o.width}x{o.height} cm • {o.quantity} u.
                              </div>
                           </div>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-10 w-full md:w-auto text-right">
                           <div className="min-w-[80px]"><div className="text-[10px] font-black text-slate-300 uppercase mb-1">Total</div><div className="font-black text-slate-900 text-lg">$ {o.total_price.toLocaleString()}</div></div>
                           <div className="min-w-[80px] text-right"><div className="text-[10px] font-black text-emerald-300 uppercase mb-1">Seña</div><div className="font-black text-emerald-600">$ {o.deposit.toLocaleString()}</div></div>
                           <div className="min-w-[80px] text-right"><div className="text-[10px] font-black text-rose-300 uppercase mb-1">Restante</div><div className="font-black text-rose-500 text-xl font-black">$ {o.balance.toLocaleString()}</div></div>
                           <div className="flex gap-3">
                              <button onClick={() => setShowSummary(o)} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 transition-all"><Share2Icon size={20}/></button>
                              <button onClick={() => { setEditingOrder(o); setOrderForm(o); setIsOrderModalOpen(true); }} className="p-4 bg-slate-50 text-slate-400 rounded-2xl hover:bg-indigo-50 transition-all"><Edit3Icon size={20}/></button>
                              <button onClick={() => askConfirmation("Borrar Pedido", `¿Eliminar pedido #${o.order_number}?`, () => updateData('orders', appData.orders.filter(ord => ord.id !== o.id)))} className="p-4 bg-white text-slate-200 hover:text-rose-500 transition-all"><TrashIcon size={18}/></button>
                           </div>
                        </div>
                     </div>
                   )
                 })}
              </div>
           </div>
        )}

        {activeTab === 'clientes' && (
           <div className="space-y-10">
              <div className="flex flex-col md:flex-row items-center justify-between gap-8 bg-white p-8 rounded-[3rem] shadow-sm border border-slate-200">
                 <div className="relative flex-1 w-full">
                    <SearchIcon className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20}/>
                    <input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full bg-slate-50 border border-slate-100 rounded-2xl py-5 pl-16 outline-none font-bold" />
                 </div>
                 <button onClick={() => { setClientForm({name: '', phone: '', address: ''}); setIsClientModalOpen(true); }} className="bg-slate-900 text-white px-10 py-5 rounded-2xl font-black text-[11px] uppercase shadow-xl flex items-center gap-3"><PlusIcon size={16}/> Nuevo Cliente</button>
              </div>
              <div className="bg-white rounded-[3.5rem] border border-slate-200 overflow-hidden shadow-2xl">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50/80 border-b border-slate-100">
                       <tr className="text-[11px] font-black text-slate-400 uppercase tracking-widest">
                          <th className="px-10 py-8">Cliente</th>
                          <th className="px-10 py-8">WhatsApp</th>
                          <th className="px-10 py-8 text-right">Operaciones</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                       {filteredClients.map(c => {
                         const isLocal = !(c as any).user_id;
                         return (
                           <tr key={c.id} className="hover:bg-indigo-50/20 group">
                              <td className="px-10 py-8">
                                 <div className="flex items-center gap-5">
                                    <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-xl shadow-lg">{c.name ? c.name.charAt(0) : '?'}</div>
                                    <div>
                                       <div className="font-black text-slate-900 uppercase text-sm leading-none mb-1 flex items-center gap-2">
                                          {c.name || 'S/N'}
                                          {isLocal && session?.user && <div className="bg-rose-100 text-rose-500 px-2 py-0.5 rounded text-[8px] font-black">LOCAL</div>}
                                          {!isLocal && session?.user && <CloudIcon size={12} className="text-emerald-500"/>}
                                       </div>
                                       <div className="text-[10px] font-bold text-slate-300">ID: {c.id.slice(-6)}</div>
                                    </div>
                                 </div>
                              </td>
                              <td className="px-10 py-8 font-black text-slate-600 text-sm">{c.phone}</td>
                              <td className="px-10 py-8 text-right">
                                 <div className="flex justify-end gap-3 opacity-0 group-hover:opacity-100 transition-all">
                                    <button onClick={() => { setClientForm(c); setIsClientModalOpen(true); }} className="p-4 bg-indigo-50 text-indigo-600 rounded-2xl transition-all"><Edit3Icon size={18}/></button>
                                    <button onClick={() => askConfirmation("Borrar Cliente", `¿Eliminar a ${c.name}?`, () => updateData('clients', appData.clients.filter(cl => cl.id !== c.id)))} className="p-4 bg-white text-slate-200 hover:text-rose-500 rounded-xl transition-all"><TrashIcon size={18}/></button>
                                 </div>
                              </td>
                           </tr>
                         )
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === 'config' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <section className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
                 <div className="flex items-center justify-between mb-8">
                    <h2 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-3"><TagIcon className="text-indigo-600" size={18}/> Categorías</h2>
                    <button onClick={() => updateData('categories', [...appData.categories, { id: Date.now().toString(), name: 'Nueva', pricePerUnit: 0 }])} className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><PlusIcon size={18}/></button>
                 </div>
                 <div className="space-y-4">
                    {appData.categories.map((cat, idx) => (
                      <div key={cat.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border border-slate-100 group">
                         <input type="text" value={cat.name} onChange={e => { const nc = [...appData.categories]; nc[idx].name = e.target.value; updateData('categories', nc); }} className="flex-1 bg-transparent font-black text-[10px] uppercase outline-none" />
                         <div className="font-black text-indigo-600 text-xs">$ <input type="number" value={cat.pricePerUnit} onChange={e => { const nc = [...appData.categories]; nc[idx].pricePerUnit = Number(e.target.value); updateData('categories', nc); }} className="w-16 bg-transparent text-right outline-none" /></div>
                         <button onClick={() => updateData('categories', appData.categories.filter(c => c.id !== cat.id))} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"><TrashIcon size={16}/></button>
                      </div>
                    ))}
                 </div>
              </section>
              <section className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
                 <h2 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-3 mb-8"><LayersIcon className="text-indigo-600" size={18}/> Tarifas Prod.</h2>
                 <div className="space-y-3">
                    {appData.costTiers.map((tier, idx) => (
                      <div key={tier.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl group">
                         <input type="number" value={tier.minLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].minLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-12 bg-white rounded p-1 text-[10px] font-black text-center" />
                         <span className="text-slate-300 font-black">→</span>
                         <input type="number" value={tier.maxLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].maxLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-12 bg-white rounded p-1 text-[10px] font-black text-center" />
                         <div className="flex-1 text-right font-black text-indigo-600 text-xs">$ <input type="number" value={tier.precioPorCm} onChange={e => { const nt = [...appData.costTiers]; nt[idx].precioPorCm = Number(e.target.value); updateData('costTiers', nt); }} className="w-16 bg-transparent text-right outline-none" /></div>
                         <button onClick={() => updateData('costTiers', appData.costTiers.filter(t => t.id !== tier.id))} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"><TrashIcon size={16}/></button>
                      </div>
                    ))}
                 </div>
              </section>
              <section className="bg-white rounded-[3rem] p-8 border border-slate-200 shadow-sm">
                 <h2 className="text-slate-900 font-black text-sm uppercase tracking-widest flex items-center gap-3 mb-8"><PercentIcon className="text-indigo-600" size={18}/> Descuentos</h2>
                 <div className="space-y-3">
                    {appData.quantityDiscounts.map((disc, idx) => (
                      <div key={disc.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl group">
                         <input type="number" value={disc.minQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].minQty = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-12 bg-white rounded p-1 text-[10px] font-black text-center" />
                         <span className="text-slate-300 font-black">→</span>
                         <input type="number" value={disc.maxQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].maxQty = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-12 bg-white rounded p-1 text-[10px] font-black text-center" />
                         <div className="flex-1 text-right font-black text-emerald-600 text-xs"><input type="number" value={disc.discountPercent} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].discountPercent = Number(e.target.value); updateData('quantityDiscounts', nd); }} className="w-12 bg-transparent text-right outline-none" />%</div>
                         <button onClick={() => updateData('quantityDiscounts', appData.quantityDiscounts.filter(d => d.id !== disc.id))} className="text-slate-200 hover:text-rose-500 opacity-0 group-hover:opacity-100"><TrashIcon size={16}/></button>
                      </div>
                    ))}
                 </div>
              </section>
           </div>
        )}
      </main>

      {/* MODAL AUTH */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[200] flex items-center justify-center p-6 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-sm rounded-[3rem] p-10 shadow-2xl relative">
              <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-8 right-8 text-slate-300 hover:text-slate-900 transition-all"><XIcon size={24}/></button>
              <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-4 flex items-center gap-3"><CloudIcon className="text-indigo-600"/> Cuenta Taller</h2>
              <form onSubmit={handleAuth} className="space-y-5">
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Email</label><input type="email" required value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold outline-none" placeholder="taller@ejemplo.com" /></div>
                 <div className="space-y-2"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Contraseña</label><input type="password" required value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-bold outline-none" placeholder="••••••••" /></div>
                 <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white font-black py-5 rounded-2xl uppercase text-[11px] shadow-xl hover:bg-indigo-700 flex items-center justify-center gap-3">
                    {authLoading ? <Loader2Icon className="animate-spin" size={18}/> : 'Sincronizar Ahora'}
                 </button>
              </form>
           </div>
        </div>
      )}

      {/* MODAL PEDIDO */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative">
              <h2 className="text-xl font-black text-slate-900 uppercase mb-6 flex items-center gap-3"><PackageIcon className="text-indigo-600"/> {editingOrder ? 'Editar Pedido' : 'Nuevo Pedido'}</h2>
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nº</label><input type="text" value={orderForm.order_number} onChange={e => setOrderForm({...orderForm, order_number: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-black" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Estado</label><select value={orderForm.status_id} onChange={e => setOrderForm({...orderForm, status_id: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-black">{appData.statuses.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                 </div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Cliente</label><select value={orderForm.client_id} onChange={e => setOrderForm({...orderForm, client_id: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-black">{appData.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                 <div className="grid grid-cols-3 gap-3">
                    <input type="number" placeholder="W" value={orderForm.width || ''} onChange={e => setOrderForm({...orderForm, width: Number(e.target.value)})} className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-black" />
                    <input type="number" placeholder="H" value={orderForm.height || ''} onChange={e => setOrderForm({...orderForm, height: Number(e.target.value)})} className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-black" />
                    <input type="number" placeholder="Qty" value={orderForm.quantity || ''} onChange={e => setOrderForm({...orderForm, quantity: Number(e.target.value)})} className="bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-black" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <select value={orderForm.category_id} onChange={e => setOrderForm({...orderForm, category_id: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-black">{appData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input type="number" placeholder="Seña $" value={orderForm.deposit || ''} onChange={e => setOrderForm({...orderForm, deposit: Number(e.target.value)})} className="w-full bg-emerald-50 border-2 border-emerald-100 rounded-xl p-3 font-black text-emerald-700" />
                 </div>
                 <div className="pt-6 flex gap-3">
                    <button onClick={() => setIsOrderModalOpen(false)} className="flex-1 py-4 font-black text-slate-400 uppercase">Cancelar</button>
                    <button onClick={saveOrder} className="flex-[2] py-4 bg-indigo-600 text-white font-black rounded-2xl shadow-xl hover:bg-indigo-700">Guardar Pedido</button>
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
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.3em] mb-6">ID #{showSummary.order_number}</p>
              
              <div className="w-full space-y-4 border-y-2 border-slate-50 py-6 mb-8">
                 <div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold uppercase tracking-widest">Cliente</span><span className="font-black text-slate-900 uppercase">{appData.clients.find(c => c.id === showSummary.client_id)?.name}</span></div>
                 <div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold uppercase tracking-widest">Medida</span><span className="font-black text-slate-900">{showSummary.width}x{showSummary.height} cm</span></div>
                 <div className="flex justify-between text-[11px]"><span className="text-slate-400 font-bold uppercase tracking-widest">Cantidad</span><span className="font-black text-slate-900">{showSummary.quantity} u.</span></div>
                 <div className="flex justify-between pt-4 border-t-2 border-slate-50"><span className="text-indigo-600 font-black uppercase text-[10px] tracking-widest">Total</span><span className="font-black text-indigo-600 text-xl">${showSummary.total_price}</span></div>
                 <div className="flex justify-between items-center"><span className="text-emerald-500 font-black uppercase text-[10px] tracking-widest">Seña</span><span className="font-black text-emerald-500 text-sm">${showSummary.deposit}</span></div>
                 <div className="flex justify-between items-center"><span className="text-rose-500 font-black uppercase text-[10px] tracking-widest">Restante</span><span className="font-black text-rose-500 text-lg">${showSummary.balance}</span></div>
              </div>

              <div className="flex flex-col gap-3 w-full">
                  <button onClick={() => shareToWA(showSummary)} className="w-full bg-emerald-500 text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-600 transition-all active:scale-95"><MessageCircleIcon size={18}/> Enviar WhatsApp</button>
              </div>
           </div>
        </div>
      )}

      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-md rounded-[3.5rem] p-12 shadow-2xl relative">
              <h2 className="text-2xl font-black text-slate-900 uppercase mb-10 flex items-center gap-4"><div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white"><UsersIcon size={24}/></div> Ficha Cliente</h2>
              <div className="space-y-6">
                 <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase ml-2">Nombre</label><input type="text" value={clientForm.name} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" /></div>
                 <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase ml-2">WhatsApp</label><input type="text" value={clientForm.phone} placeholder="+54..." onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" /></div>
                 <div className="space-y-2"><label className="text-[11px] font-black text-slate-400 uppercase ml-2">Dirección</label><input type="text" value={clientForm.address} onChange={e => setClientForm({...clientForm, address: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl p-4 font-black outline-none focus:border-indigo-500" /></div>
                 <div className="pt-6 flex gap-4">
                    <button onClick={() => setIsClientModalOpen(false)} className="flex-1 py-5 font-black text-slate-400 uppercase">Cerrar</button>
                    <button onClick={saveClient} className="flex-[2] py-5 bg-slate-900 text-white font-black rounded-2xl shadow-xl hover:bg-slate-800">Guardar Cliente</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[300] flex items-center justify-center p-6">
           <div className="bg-white w-full max-sm rounded-[2.5rem] p-8 shadow-2xl text-center">
              <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6"><AlertTriangleIcon size={32}/></div>
              <h3 className="text-xl font-black text-slate-900 uppercase mb-2">{confirmModal.title}</h3>
              <p className="text-slate-500 text-sm mb-8">{confirmModal.message}</p>
              <div className="flex gap-3">
                 <button onClick={() => setConfirmModal(null)} className="flex-1 py-4 bg-slate-50 rounded-2xl font-black text-[10px] uppercase">Cancelar</button>
                 <button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg shadow-rose-100">Confirmar</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
