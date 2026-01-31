
import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  PlusIcon, TrashIcon, Settings2Icon, LayoutIcon, CalculatorIcon, TagIcon, LayersIcon, 
  UsersIcon, PackageIcon, SearchIcon, Share2Icon, MessageCircleIcon, 
  Edit3Icon, XIcon, AlertTriangleIcon, 
  CloudIcon, LogOutIcon, Loader2Icon, RulerIcon, 
  SmartphoneIcon, DownloadIcon, BellIcon, CloudUploadIcon, PercentIcon
} from 'lucide-react';
import { 
  DesignItem, CostTier, QuantityDiscount, CalculationResult, 
  Client, Category, OrderStatus, Order, NotificationSettings
} from './types';
import { packDesigns } from './utils/layout';
import { supabase } from './supabaseClient';

const MASTER_KEY = 'graficapro_enterprise_v12';

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
    const init = async () => {
      const saved = localStorage.getItem(MASTER_KEY);
      if (saved) {
        try {
          let parsed = JSON.parse(saved);
          setAppData(prev => ({ ...prev, ...parsed }));
        } catch (e) { }
      }
      const client = supabase;
      if (client) {
        const { data: { session: cur } } = await client.auth.getSession();
        setSession(cur);
      }
      setLoading(false);
    };
    init();

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    });
  }, []);

  useEffect(() => {
    if (!loading) {
      localStorage.setItem(MASTER_KEY, JSON.stringify(appData));
    }
  }, [appData, loading]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') setDeferredPrompt(null);
  };

  const notify = useCallback((title: string, body: string) => {
    if (!appData.notifications.enabled) return;
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      new Notification(title, { body });
    }
  }, [appData.notifications.enabled]);

  const updateData = (field: keyof AppDataType, value: any) => {
    setAppData(prev => ({ ...prev, [field]: value }));
  };

  const packResult = useMemo(() => packDesigns(appData.designs || [], appData.sheetWidth || 58, appData.designSpacing || 0.2), [appData.designs, appData.sheetWidth, appData.designSpacing]);
  
  const currentPricePerCm = useMemo(() => {
    const l = packResult.totalLength;
    const tiers = appData.costTiers || [];
    const tier = tiers.find((t: CostTier) => l >= t.minLargo && l < t.maxLargo);
    return tier ? tier.precioPorCm : (tiers[tiers.length - 1]?.precioPorCm || 0);
  }, [packResult.totalLength, appData.costTiers]);

  const calculateDetails = useCallback((item: DesignItem): CalculationResult => {
    const defaultRes = { unitProductionCost: 0, unitClientPrice: 0, totalProductionCost: 0, totalClientPrice: 0 };
    if (!item || packResult.totalLength <= 0 || packResult.totalAreaUsed <= 0) return defaultRes;
    
    const totalSheetCost = packResult.totalLength * currentPricePerCm;
    const packedUnits = (packResult.packed || []).filter(p => p.originalId === item.id);
    const actualPackedQuantity = packedUnits.length;
    if (actualPackedQuantity === 0) return defaultRes;

    const itemPackedArea = packedUnits.reduce((acc, p) => acc + (p.width * p.height), 0);
    const totalProdCostForItem = (itemPackedArea / packResult.totalAreaUsed) * totalSheetCost;
    const unitProdCost = totalProdCostForItem / actualPackedQuantity;
    
    const profitFactor = 1 + (appData.profitMargin / 100);
    const discount = appData.quantityDiscounts.find(q => item.quantity >= q.minQty && item.quantity <= q.maxQty);
    const discFactor = discount ? (1 - discount.discountPercent / 100) : 1;
    
    const unitClientPrice = unitProdCost * profitFactor * discFactor;
    
    return { 
      unitProductionCost: unitProdCost, 
      unitClientPrice: unitClientPrice, 
      totalProductionCost: totalProdCostForItem, 
      totalClientPrice: unitClientPrice * actualPackedQuantity 
    };
  }, [packResult, currentPricePerCm, appData.profitMargin, appData.quantityDiscounts]);

  const tableTotals = useMemo(() => {
    return appData.designs.reduce((acc, d) => {
        const res = calculateDetails(d);
        const packedQty = (packResult.packed || []).filter(p => p.originalId === d.id).length;
        return { prod: acc.prod + res.totalProductionCost, client: acc.client + res.totalClientPrice, qty: acc.qty + packedQty };
    }, { prod: 0, client: 0, qty: 0 });
  }, [appData.designs, calculateDetails, packResult.packed]);

  const addDesign = () => {
    if (newDesign.width <= 0 || newDesign.height <= 0 || newDesign.quantity <= 0) return;
    updateData('designs', [...appData.designs, { ...newDesign, id: generateUUID() } as DesignItem]);
    setNewDesign({ name: '', width: 0, height: 0, quantity: 1 });
  };

  const filteredOrders = useMemo(() => {
    const s = orderSearch.toLowerCase();
    return appData.orders.filter(o => {
      const c = appData.clients.find(cl => cl.id === o.client_id);
      const nameMatch = (c?.name || '').toLowerCase().includes(s);
      const numMatch = o.order_number.toLowerCase().includes(s);
      const statusMatch = statusFilter === 'all' || o.status_id === statusFilter;
      return (nameMatch || numMatch) && statusMatch;
    });
  }, [appData.orders, appData.clients, orderSearch, statusFilter]);

  const filteredClients = useMemo(() => {
    const s = clientSearch.toLowerCase();
    return appData.clients.filter(c => c.name.toLowerCase().includes(s) || c.phone.includes(s));
  }, [appData.clients, clientSearch]);

  const askConfirmation = (title: string, message: string, onConfirm: () => void) => {
    setConfirmModal({ title, message, onConfirm });
  };

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center"><Loader2Icon className="animate-spin text-indigo-600" size={48}/></div>;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <header className="bg-white border-b px-6 py-4 sticky top-0 z-[60] shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2 rounded-xl text-white shadow-lg"><CalculatorIcon size={24}/></div>
            <h1 className="text-xl font-black text-slate-900 tracking-tighter uppercase">Crea<span className="text-indigo-600">Stickers</span></h1>
          </div>
          <nav className="flex items-center bg-slate-100 p-1 rounded-2xl border overflow-x-auto">
            {['dash', 'presupuestar', 'pedidos', 'clients', 'config'].map((t) => (
              <button key={t} onClick={() => setActiveTab(t as Tab)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === t ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-400'}`}>
                {t === 'dash' ? 'Inicio' : t === 'presupuestar' ? 'Presu' : t === 'clients' ? 'Clientes' : t}
              </button>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
             {session?.user ? (
               <button onClick={() => supabase?.auth.signOut()} className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 border px-4 py-2 rounded-full flex items-center gap-2">
                 {session.user.email} <LogOutIcon size={12}/>
               </button>
             ) : (
               <button onClick={() => setIsAuthModalOpen(true)} className="bg-indigo-600 text-white px-6 py-2 rounded-full font-black text-[10px] uppercase shadow-lg flex items-center gap-2"><CloudIcon size={14}/> Sincronizar</button>
             )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8">
        {activeTab === 'dash' && (
           <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                 {appData.statuses.map(s => (
                   <div key={s.id} className="bg-white p-6 rounded-3xl border shadow-sm flex flex-col items-center">
                      <div className={`w-3 h-3 rounded-full ${s.color} mb-2`}></div>
                      <div className="text-3xl font-black text-slate-900">{appData.orders.filter(o => o.status_id === s.id).length}</div>
                      <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{s.name}</div>
                   </div>
                 ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-indigo-600 rounded-3xl p-8 text-white shadow-xl flex items-center justify-between">
                   <div>
                      <h3 className="text-lg font-black uppercase mb-1">Backup Nube</h3>
                      <p className="text-indigo-100 text-xs font-medium opacity-80">Sincroniza tus datos de forma segura.</p>
                   </div>
                   <button onClick={() => setIsAuthModalOpen(true)} className="bg-white text-indigo-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase shadow-lg">Entrar</button>
                </div>
                {deferredPrompt && (
                  <div className="bg-white rounded-3xl p-8 border shadow-sm flex items-center justify-between">
                     <div>
                        <h3 className="text-lg font-black text-slate-900 uppercase mb-1">App Móvil</h3>
                        <p className="text-slate-400 text-xs font-medium">Instala CreaStickers para acceso rápido.</p>
                     </div>
                     <button onClick={handleInstallClick} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase flex items-center gap-2"><DownloadIcon size={14}/> Instalar</button>
                  </div>
                )}
              </div>
           </div>
        )}

        {activeTab === 'presupuestar' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            <div className="lg:col-span-4 space-y-6">
              <section className="bg-white rounded-3xl p-6 border shadow-sm">
                <h2 className="text-slate-900 font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-6"><Settings2Icon size={16}/> Configuración</h2>
                <div className="space-y-4">
                   <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Ancho Pliego (cm)</label><input type="number" value={appData.sheetWidth} onChange={e => updateData('sheetWidth', Number(e.target.value))} className="w-full bg-slate-50 p-3 rounded-xl font-bold border-none" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Margen %</label><input type="number" value={appData.profitMargin} onChange={e => updateData('profitMargin', Number(e.target.value))} className="w-full bg-slate-50 p-3 rounded-xl font-bold border-none" /></div>
                   </div>
                   <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Espaciado (cm)</label><input type="number" step="0.1" value={appData.designSpacing} onChange={e => updateData('designSpacing', Number(e.target.value))} className="w-full bg-slate-50 p-3 rounded-xl font-bold border-none" /></div>
                </div>
              </section>
              <section className="bg-white rounded-3xl p-6 border shadow-sm">
                <h2 className="text-indigo-600 font-black text-xs uppercase tracking-widest flex items-center gap-2 mb-6"><PlusIcon size={16}/> Agregar Sticker</h2>
                <div className="space-y-4">
                   <input type="text" placeholder="Nombre..." value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-slate-50 p-3 rounded-xl font-bold border-none" />
                   <div className="grid grid-cols-3 gap-2">
                      <input type="number" placeholder="W" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="bg-slate-50 p-3 rounded-xl font-bold text-center border-none" />
                      <input type="number" placeholder="H" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="bg-slate-50 p-3 rounded-xl font-bold text-center border-none" />
                      <input type="number" placeholder="Q" value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="bg-slate-50 p-3 rounded-xl font-bold text-center border-none" />
                   </div>
                   <button onClick={addDesign} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl uppercase text-[10px] shadow-lg hover:bg-indigo-700 transition-all">Optimizar</button>
                </div>
              </section>
              
              <section className="bg-slate-900 rounded-3xl p-8 text-white shadow-xl border-l-4 border-indigo-500">
                 <div className="flex items-center gap-2 mb-3 opacity-60">
                    <RulerIcon size={16}/>
                    <h2 className="font-black text-[10px] uppercase tracking-widest">Dimensiones Finales</h2>
                 </div>
                 <div className="text-4xl font-black">{packResult.totalLength.toFixed(1)} <span className="text-lg opacity-40 uppercase">cm</span></div>
                 <p className="text-indigo-400 font-bold text-[10px] uppercase mt-1 tracking-widest">Largo Total Requerido</p>
              </section>
            </div>
            
            <div className="lg:col-span-8 space-y-8">
               <section className="bg-white rounded-3xl p-8 border shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-black text-lg text-slate-900 flex items-center gap-2"><LayoutIcon size={20} className="text-indigo-500"/> Previsualización</h2>
                    <div className="bg-slate-100 text-slate-500 px-4 py-1.5 rounded-full font-black text-[10px] uppercase">
                       Ancho: {appData.sheetWidth}cm
                    </div>
                  </div>
                  <div className="bg-slate-900 rounded-2xl min-h-[300px] overflow-auto flex justify-center p-8 border-8 border-slate-900 shadow-inner custom-scrollbar">
                     {packResult.totalLength > 0 ? (
                        <div className="bg-white relative shadow-2xl" style={{ width: `${appData.sheetWidth * 6}px`, height: `${packResult.totalLength * 6}px` }}>
                          {packResult.packed.map(p => (
                            <div key={p.id} className="absolute border bg-indigo-500 border-indigo-600 text-white flex items-center justify-center text-[7px] font-black overflow-hidden" title={p.name} style={{ left: `${p.x * 6}px`, top: `${p.y * 6}px`, width: `${p.width * 6}px`, height: `${p.height * 6}px` }}>
                               <span className="p-0.5">{p.width}x{p.height}</span>
                            </div>
                          ))}
                        </div>
                     ) : <div className="text-slate-700 uppercase font-black py-20 opacity-20 text-xs">Agrega diseños para ver el pliego</div>}
                  </div>
               </section>

               <section className="bg-white rounded-3xl p-8 border shadow-sm overflow-x-auto custom-scrollbar">
                  <h2 className="font-black text-xs uppercase tracking-widest mb-6 flex items-center gap-2 text-slate-900"><TagIcon size={16}/> Resumen de Costos</h2>
                  <table className="w-full text-left">
                    <thead className="text-slate-400 text-[10px] font-black uppercase tracking-widest border-b">
                       <tr>
                         <th className="pb-4">Diseño</th>
                         <th className="text-right pb-4 px-2">Prod</th>
                         <th className="text-right pb-4 px-2">Venta U.</th>
                         <th className="text-right pb-4 px-2">Total Venta</th>
                         <th className="pb-4"></th>
                       </tr>
                    </thead>
                    <tbody className="divide-y">
                      {appData.designs.map(d => {
                        const res = calculateDetails(d);
                        const packedQty = packResult.packed.filter(p => p.originalId === d.id).length;
                        return (
                          <tr key={d.id} className="group">
                            <td className="py-5">
                               <div className="font-black text-slate-900 uppercase text-xs">{d.name || 'S/N'}</div>
                               <div className="text-[10px] font-bold text-slate-400 uppercase">{d.width}x{d.height} CM • {packedQty}/{d.quantity} u.</div>
                            </td>
                            <td className="text-right font-black text-rose-500 text-xs px-2">${res.unitProductionCost.toFixed(0)}</td>
                            <td className="text-right font-black text-slate-900 text-xs px-2">${res.unitClientPrice.toFixed(0)}</td>
                            <td className="text-right py-5 px-2 font-black text-emerald-600 text-base">
                               ${res.totalClientPrice.toFixed(0)}
                            </td>
                            <td className="text-right">
                               <button onClick={() => updateData('designs', appData.designs.filter(i => i.id !== d.id))} className="text-slate-200 hover:text-rose-500 transition-colors"><TrashIcon size={16}/></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                        <tr>
                          <td className="py-6 px-4 font-black text-slate-400 uppercase text-[10px]">Total Est. ({tableTotals.qty} u.)</td>
                          <td className="text-right font-black text-rose-600 text-lg px-2">${tableTotals.prod.toFixed(0)}</td>
                          <td className="px-2"></td>
                          <td className="text-right py-6 px-2 font-black text-emerald-700 text-2xl">${tableTotals.client.toFixed(0)}</td>
                          <td></td>
                        </tr>
                    </tfoot>
                  </table>
               </section>
            </div>
          </div>
        )}

        {activeTab === 'pedidos' && (
           <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border shadow-sm">
                 <div className="relative flex-1 w-full"><SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18}/><input type="text" placeholder="Buscar..." value={orderSearch} onChange={e => setOrderSearch(e.target.value)} className="w-full bg-slate-50 p-4 pl-14 rounded-2xl font-bold border-none" /></div>
                 <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
                    {['all', ...appData.statuses.map(s => s.id)].map(st => (
                      <button key={st} onClick={() => setStatusFilter(st)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all whitespace-nowrap ${statusFilter === st ? 'bg-indigo-600 text-white' : 'bg-white text-slate-400 border'}`}>
                        {st === 'all' ? 'Todos' : appData.statuses.find(s => s.id === st)?.name}
                      </button>
                    ))}
                    <button onClick={() => { setEditingOrder(null); setOrderForm({ order_number: String(appData.orders.length + 1).padStart(4, '0'), status_id: 'hacer', client_id: '', width: 0, height: 0, quantity: 1, category_id: '', deposit: 0 }); setIsOrderModalOpen(true); }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-[9px] uppercase shadow-lg flex items-center gap-2 hover:scale-105 transition-all"><PlusIcon size={14}/> Nuevo</button>
                 </div>
              </div>
              <div className="grid gap-4">
                 {filteredOrders.map(o => {
                   const c = appData.clients.find(cl => cl.id === o.client_id);
                   const s = appData.statuses.find(st => st.id === o.status_id);
                   return (
                     <div key={o.id} className="bg-white rounded-3xl p-5 border shadow-sm flex flex-col md:flex-row items-center justify-between gap-5 group transition-all hover:border-indigo-100">
                        <div className="flex items-center gap-4 flex-1">
                           <div className={`w-12 h-12 rounded-2xl ${s?.color} text-white flex flex-col items-center justify-center font-black text-[8px]`}><span className="opacity-60">Nº</span><span className="text-xs">#{o.order_number}</span></div>
                           <div>
                              <div className="font-black text-slate-900 uppercase text-sm">{c?.name || 'DESCONOCIDO'}</div>
                              <div className="text-[9px] font-bold text-slate-400 uppercase flex gap-2 mt-0.5">
                                 <span className={`px-2 py-0.5 rounded-full text-white ${s?.color}`}>{s?.name}</span>
                                 <span>{o.width}x{o.height}cm • {o.quantity}u.</span>
                              </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-6">
                           <div className="text-right"><div className="text-[8px] font-black text-slate-400 uppercase">Saldo</div><div className="font-black text-rose-500 text-xs">$ {o.balance.toLocaleString()}</div></div>
                           <div className="text-right border-l pl-6"><div className="text-[8px] font-black text-slate-400 uppercase">Total</div><div className="font-black text-slate-900 text-lg">$ {o.total_price.toLocaleString()}</div></div>
                           <div className="flex gap-1">
                              <button onClick={() => setShowSummary(o)} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Share2Icon size={16}/></button>
                              <button onClick={() => { setEditingOrder(o); setOrderForm(o); setIsOrderModalOpen(true); }} className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-indigo-50 hover:text-indigo-600 transition-colors"><Edit3Icon size={16}/></button>
                              <button onClick={() => askConfirmation("Borrar", "¿Eliminar pedido?", () => updateData('orders', appData.orders.filter(ord => ord.id !== o.id)))} className="p-2.5 text-slate-200 hover:text-rose-500 transition-colors"><TrashIcon size={16}/></button>
                           </div>
                        </div>
                     </div>
                   );
                 })}
                 {filteredOrders.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase text-xs tracking-widest">No hay pedidos</div>}
              </div>
           </div>
        )}

        {activeTab === 'clients' && (
           <div className="space-y-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-white p-4 rounded-3xl border shadow-sm">
                 <div className="relative flex-1 w-full"><SearchIcon className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300" size={18}/><input type="text" placeholder="Buscar cliente..." value={clientSearch} onChange={e => setClientSearch(e.target.value)} className="w-full bg-slate-50 p-4 pl-14 rounded-2xl font-bold border-none" /></div>
                 <button onClick={() => { setClientForm({}); setIsClientModalOpen(true); }} className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center gap-2 hover:scale-105 transition-all w-full md:w-auto justify-center"><PlusIcon size={16}/> Nuevo Cliente</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                 {filteredClients.map(c => (
                   <div key={c.id} className="bg-white rounded-3xl p-6 border shadow-sm flex flex-col justify-between group transition-all hover:border-indigo-100">
                      <div className="flex items-center gap-4 mb-4">
                         <div className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center font-black text-sm uppercase">{c.name.charAt(0)}</div>
                         <div>
                            <div className="font-black text-slate-900 uppercase text-sm">{c.name}</div>
                            <div className="font-black text-emerald-500 text-[10px] flex items-center gap-1"><MessageCircleIcon size={10}/> {c.phone}</div>
                         </div>
                      </div>
                      <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-50">
                         <button onClick={() => { setClientForm(c); setIsClientModalOpen(true); }} className="p-2.5 bg-slate-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all"><Edit3Icon size={16}/></button>
                         <button onClick={() => askConfirmation("Borrar", `¿Eliminar a ${c.name}?`, () => updateData('clients', appData.clients.filter(cl => cl.id !== c.id)))} className="p-2.5 bg-slate-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"><TrashIcon size={16}/></button>
                      </div>
                   </div>
                 ))}
                 {filteredClients.length === 0 && <div className="text-center py-20 text-slate-300 font-black uppercase text-xs tracking-widest col-span-full">No hay clientes</div>}
              </div>
           </div>
        )}

        {activeTab === 'config' && (
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <section className="bg-white rounded-3xl p-8 border shadow-sm">
                 <h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mb-8"><TagIcon size={16}/> Categorías</h2>
                 <div className="space-y-4">
                    {appData.categories.map((cat, idx) => (
                      <div key={cat.id} className="flex items-center gap-3 bg-slate-50 p-4 rounded-2xl border group">
                         <input type="text" value={cat.name} onChange={e => { const nc = [...appData.categories]; nc[idx].name = e.target.value; updateData('categories', nc); }} className="flex-1 bg-transparent font-black text-[10px] uppercase outline-none" />
                         <div className="font-black text-indigo-600 text-xs">$ <input type="number" value={cat.pricePerUnit} onChange={e => { const nc = [...appData.categories]; nc[idx].pricePerUnit = Number(e.target.value); updateData('categories', nc); }} className="w-16 bg-transparent text-right outline-none" /></div>
                      </div>
                    ))}
                 </div>
              </section>
              <section className="bg-white rounded-3xl p-8 border shadow-sm">
                 <h2 className="text-slate-900 font-black text-[10px] uppercase tracking-widest flex items-center gap-2 mb-8"><LayersIcon size={16}/> Escala de Precios</h2>
                 <div className="space-y-4">
                    {appData.costTiers.map((tier, idx) => (
                      <div key={tier.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl border group">
                         <input type="number" value={tier.minLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].minLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-10 bg-white rounded-lg p-1 text-[9px] font-black text-center" /><span className="text-slate-300">→</span><input type="number" value={tier.maxLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].maxLargo = Number(e.target.value); updateData('costTiers', nt); }} className="w-10 bg-white rounded-lg p-1 text-[9px] font-black text-center" /><div className="flex-1 text-right font-black text-indigo-600 text-xs">$ <input type="number" value={tier.precioPorCm} onChange={e => { const nt = [...appData.costTiers]; nt[idx].precioPorCm = Number(e.target.value); updateData('costTiers', nt); }} className="w-14 bg-transparent text-right outline-none" /></div>
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
           <div className="bg-white w-full max-w-sm rounded-3xl p-10 shadow-2xl relative">
              <button onClick={() => setIsAuthModalOpen(false)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900"><XIcon size={20}/></button>
              <h2 className="text-xl font-black text-slate-900 uppercase mb-6 flex items-center gap-3"><CloudIcon className="text-indigo-600"/> Cuenta Taller</h2>
              <div className="space-y-4">
                 <input type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none" placeholder="Email" />
                 <input type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full bg-slate-50 p-4 rounded-2xl font-bold border-none" placeholder="Contraseña" />
                 <button className="w-full bg-indigo-600 text-white font-black py-4 rounded-2xl uppercase text-[10px] shadow-xl hover:bg-indigo-700 active:scale-95 transition-all">Entrar</button>
              </div>
           </div>
        </div>
      )}

      {isClientModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-md rounded-[2rem] p-8 shadow-2xl relative">
              <h2 className="text-xl font-black text-slate-900 uppercase mb-8 flex items-center gap-3"><UsersIcon/> Cliente</h2>
              <div className="space-y-4">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Nombre</label><input type="text" value={clientForm.name || ''} onChange={e => setClientForm({...clientForm, name: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-black border-none" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase ml-2">Teléfono</label><input type="text" value={clientForm.phone || ''} onChange={e => setClientForm({...clientForm, phone: e.target.value})} className="w-full bg-slate-50 p-4 rounded-2xl font-black border-none" /></div>
                 <div className="pt-4 flex gap-4"><button onClick={() => setIsClientModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase text-xs">Cerrar</button><button onClick={() => {
                    const client = clientForm.id ? clientForm as Client : { ...clientForm, id: generateUUID(), created_at: new Date().toISOString() } as Client;
                    updateData('clients', clientForm.id ? appData.clients.map(c => c.id === client.id ? client : c) : [...appData.clients, client]);
                    setIsClientModalOpen(false);
                 }} className="flex-[2] bg-slate-900 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-slate-800 transition-all">Guardar</button></div>
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
                    <input type="text" value={orderForm.order_number} onChange={e => setOrderForm({...orderForm, order_number: e.target.value})} className="w-full bg-slate-50 p-3 rounded-2xl font-black border-none" placeholder="Nº" />
                    <select value={orderForm.status_id} onChange={e => setOrderForm({...orderForm, status_id: e.target.value})} className="w-full bg-slate-50 p-3 rounded-2xl font-black border-none">{(appData.statuses || []).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                 </div>
                 <select value={orderForm.client_id} onChange={e => setOrderForm({...orderForm, client_id: e.target.value})} className="w-full bg-slate-50 p-3 rounded-2xl font-black border-none"><option value="">Seleccionar Cliente...</option>{appData.clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                 <div className="grid grid-cols-3 gap-2">
                    <input type="number" placeholder="W" value={orderForm.width || ''} onChange={e => setOrderForm({...orderForm, width: Number(e.target.value)})} className="bg-slate-50 p-3 rounded-2xl font-black border-none text-center" />
                    <input type="number" placeholder="H" value={orderForm.height || ''} onChange={e => setOrderForm({...orderForm, height: Number(e.target.value)})} className="bg-slate-50 p-3 rounded-2xl font-black border-none text-center" />
                    <input type="number" placeholder="Q" value={orderForm.quantity || ''} onChange={e => setOrderForm({...orderForm, quantity: Number(e.target.value)})} className="bg-slate-50 p-3 rounded-2xl font-black border-none text-center" />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <select value={orderForm.category_id} onChange={e => setOrderForm({...orderForm, category_id: e.target.value})} className="w-full bg-slate-50 p-3 rounded-2xl font-black border-none"><option value="">Categoría...</option>{appData.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                    <input type="number" placeholder="Seña" value={orderForm.deposit || ''} onChange={e => setOrderForm({...orderForm, deposit: Number(e.target.value)})} className="w-full bg-emerald-50 p-3 rounded-2xl font-black text-emerald-700 border-none" />
                 </div>
                 <div className="pt-4 flex gap-4"><button onClick={() => setIsOrderModalOpen(false)} className="flex-1 font-black text-slate-400 uppercase text-xs">Cerrar</button><button onClick={() => {
                    const cat = appData.categories.find(c => c.id === orderForm.category_id);
                    const total = (cat?.pricePerUnit || 0) * (orderForm.quantity || 0);
                    const dep = orderForm.deposit || 0;
                    const order: Order = editingOrder ? { ...editingOrder, ...orderForm, total_price: total, balance: total - dep } as Order : { ...orderForm, id: generateUUID(), total_price: total, balance: total - dep, created_at: new Date().toISOString() } as Order;
                    updateData('orders', editingOrder ? appData.orders.map(o => o.id === order.id ? order : o) : [...appData.orders, order]);
                    setIsOrderModalOpen(false);
                 }} className="flex-[2] bg-indigo-600 text-white font-black py-4 rounded-2xl shadow-lg hover:bg-indigo-700 transition-all">Guardar</button></div>
              </div>
           </div>
        </div>
      )}

      {showSummary && (
        <div className="fixed inset-0 bg-slate-900/90 backdrop-blur-md z-[200] flex items-center justify-center p-4">
           <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-10 shadow-2xl relative text-center">
              <button onClick={() => setShowSummary(null)} className="absolute top-6 right-6 text-slate-300 hover:text-slate-900 transition-all"><XIcon size={24}/></button>
              <div className="w-16 h-16 bg-indigo-600 rounded-[1.5rem] flex items-center justify-center text-white mb-6 mx-auto"><CalculatorIcon size={32}/></div>
              <h2 className="font-black text-xl uppercase mb-6">Ticket de Pedido</h2>
              <div className="space-y-2 border-y py-6 mb-8 text-left text-[11px] uppercase font-bold text-slate-500">
                 <div className="flex justify-between"><span>Orden:</span><span className="text-slate-900 font-black">#{showSummary.order_number}</span></div>
                 <div className="flex justify-between"><span>Cliente:</span><span className="text-slate-900">{appData.clients.find(c => c.id === showSummary.client_id)?.name || 'S/N'}</span></div>
                 <div className="flex justify-between"><span>Categoría:</span><span className="text-slate-900">{appData.categories.find(cat => cat.id === showSummary.category_id)?.name || 'S/N'}</span></div>
                 <div className="flex justify-between text-indigo-600 font-black pt-2 border-t mt-2"><span>Total:</span><span>${showSummary.total_price.toLocaleString()}</span></div>
                 <div className="flex justify-between text-emerald-600"><span>Seña:</span><span>${showSummary.deposit.toLocaleString()}</span></div>
                 <div className="flex justify-between text-rose-500"><span>Saldo:</span><span>${showSummary.balance.toLocaleString()}</span></div>
              </div>
              <button onClick={() => {
                const cFound = appData.clients.find(cl => cl.id === showSummary.client_id);
                const text = `*Ticket #${showSummary.order_number}*\n*Total:* $${showSummary.total_price.toLocaleString()}\n*Seña:* $${showSummary.deposit.toLocaleString()}\n*Saldo:* $${showSummary.balance.toLocaleString()}`;
                window.open(`https://wa.me/${cFound?.phone?.replace(/\D/g,'')}?text=${encodeURIComponent(text)}`, '_blank');
              }} className="w-full bg-emerald-500 text-white py-4 rounded-2xl font-black flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-600 transition-all"><MessageCircleIcon size={18}/> Enviar WhatsApp</button>
           </div>
        </div>
      )}

      {confirmModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-[300] flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-xs rounded-3xl p-8 shadow-2xl text-center">
              <AlertTriangleIcon size={32} className="text-rose-500 mx-auto mb-4"/>
              <h3 className="font-black text-slate-900 uppercase mb-2 leading-none">{confirmModal.title}</h3>
              <p className="text-slate-500 text-[10px] mb-8">{confirmModal.message}</p>
              <div className="flex gap-2"><button onClick={() => setConfirmModal(null)} className="flex-1 py-3 bg-slate-50 rounded-xl font-black text-[10px] uppercase">Cerrar</button><button onClick={() => { confirmModal.onConfirm(); setConfirmModal(null); }} className="flex-1 py-3 bg-rose-500 text-white rounded-xl font-black text-[10px] uppercase shadow-lg transition-all">Confirmar</button></div>
           </div>
        </div>
      )}
    </div>
  );
};

export default App;
