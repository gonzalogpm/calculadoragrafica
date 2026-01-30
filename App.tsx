import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  Settings2Icon, 
  LayoutIcon, 
  CalculatorIcon,
  TagIcon,
  LayersIcon,
  MaximizeIcon,
  RotateCcwIcon,
  CheckCircle2Icon
} from 'lucide-react';
import { DesignItem, CostTier, QuantityDiscount, CalculationResult } from './types';
import { packDesigns } from './utils/layout';

// Iconos simplificados para el componente
const Plus = ({ className, size = 18 }: { className?: string; size?: number }) => <PlusIcon size={size} className={className} />;
const Trash = ({ className, size = 16 }: { className?: string; size?: number }) => <TrashIcon size={size} className={className} />;
const Settings = ({ className, size = 18 }: { className?: string; size?: number }) => <Settings2Icon size={size} className={className} />;
const Layout = ({ className, size = 18 }: { className?: string; size?: number }) => <LayoutIcon size={size} className={className} />;
const Calculator = ({ className, size = 18 }: { className?: string; size?: number }) => <CalculatorIcon size={size} className={className} />;
const Tag = ({ className, size = 18 }: { className?: string; size?: number }) => <TagIcon size={size} className={className} />;
const Layers = ({ className, size = 18 }: { className?: string; size?: number }) => <LayersIcon size={size} className={className} />;
const Spacing = ({ className, size = 18 }: { className?: string; size?: number }) => <MaximizeIcon size={size} className={className} />;

const DESIGN_COLORS = [
  { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' },
  { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600' },
  { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  { bg: 'bg-amber-400', text: 'text-amber-950', border: 'border-amber-500' },
  { bg: 'bg-violet-500', text: 'text-white', border: 'border-violet-600' },
];

// Nueva clave para forzar limpieza de estados antiguos potencialmente corruptos
const MASTER_KEY = 'graficapro_v3_atomic_stable';

const DEFAULT_DATA = {
  sheetWidth: 58,
  profitMargin: 100,
  designSpacing: 0.2,
  costTiers: [
    { id: '1', minLargo: 0, maxLargo: 20, precioPorCm: 10000 },
    { id: '2', minLargo: 20, maxLargo: 50, precioPorCm: 8000 },
    { id: '3', minLargo: 50, maxLargo: 100, precioPorCm: 6000 },
    { id: '4', minLargo: 100, maxLargo: 9999, precioPorCm: 3000 },
  ],
  quantityDiscounts: [
    { id: '1', minQty: 10, maxQty: 25, discountPercent: 20 },
  ],
  designs: [] as DesignItem[]
};

const App: React.FC = () => {
  // Carga inicial robusta
  const [appData, setAppData] = useState(() => {
    try {
      const saved = localStorage.getItem(MASTER_KEY);
      if (saved) {
        return { ...DEFAULT_DATA, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn("No se pudo leer localStorage, iniciando con valores por defecto.");
    }
    return DEFAULT_DATA;
  });

  const [lastSaved, setLastSaved] = useState<string>('');

  // Efecto de guardado único y centralizado
  useEffect(() => {
    try {
      localStorage.setItem(MASTER_KEY, JSON.stringify(appData));
      setLastSaved(new Date().toLocaleTimeString());
    } catch (e) {
      console.error("Error al guardar datos:", e);
    }
  }, [appData]);

  const [newDesign, setNewDesign] = useState<Omit<DesignItem, 'id'>>({
    name: '',
    width: 0,
    height: 0,
    quantity: 1
  });

  const PREVIEW_SCALE = 6;

  // Cálculos derivados memorizados
  const packingResult = useMemo(() => {
    return packDesigns(appData.designs, appData.sheetWidth, appData.designSpacing);
  }, [appData.designs, appData.sheetWidth, appData.designSpacing]);

  const currentPricePerCm = useMemo(() => {
    const totalL = packingResult.totalLength;
    const tier = appData.costTiers.find(t => totalL >= t.minLargo && totalL < t.maxLargo);
    return tier ? tier.precioPorCm : (appData.costTiers[appData.costTiers.length - 1]?.precioPorCm || 0);
  }, [packingResult.totalLength, appData.costTiers]);

  const getDiscountForQty = useCallback((qty: number) => {
    const discount = appData.quantityDiscounts.find(d => qty >= d.minQty && qty <= d.maxQty);
    return discount ? discount.discountPercent : 0;
  }, [appData.quantityDiscounts]);

  const calculateDetails = useCallback((item: DesignItem): CalculationResult => {
    if (packingResult.totalLength <= 0) return { unitProductionCost: 0, unitClientPrice: 0, totalProductionCost: 0, totalClientPrice: 0 };

    const totalSheetCost = packingResult.totalLength * currentPricePerCm;
    const totalDesignArea = appData.designs.reduce((acc, d) => acc + (d.width * d.height * d.quantity), 0);
    const itemAreaTotal = (item.width * item.height) * item.quantity;
    const totalProdCostForItem = totalDesignArea > 0 ? (itemAreaTotal / totalDesignArea) * totalSheetCost : 0;
    const unitProdCost = item.quantity > 0 ? totalProdCostForItem / item.quantity : 0;

    const discountPercent = getDiscountForQty(item.quantity);
    const marginMult = 1 + (appData.profitMargin / 100);
    const discountMult = 1 - (discountPercent / 100);

    const unitClientPrice = unitProdCost * marginMult * discountMult;
    const totalClientPrice = unitClientPrice * item.quantity;

    return {
      unitProductionCost: unitProdCost,
      unitClientPrice,
      totalProductionCost: totalProdCostForItem,
      totalClientPrice
    };
  }, [appData.designs, packingResult.totalLength, currentPricePerCm, appData.profitMargin, getDiscountForQty]);

  // Funciones de actualización de estado atómico
  const updateField = (field: string, value: any) => {
    setAppData(prev => ({ ...prev, [field]: value }));
  };

  const addDesign = () => {
    if (newDesign.width <= 0 || newDesign.height <= 0 || newDesign.quantity <= 0) return;
    const updatedDesigns = [...appData.designs, { ...newDesign, id: Date.now().toString() }];
    updateField('designs', updatedDesigns);
    setNewDesign({ name: '', width: 0, height: 0, quantity: 1 });
  };

  const removeDesign = (id: string) => {
    updateField('designs', appData.designs.filter(d => d.id !== id));
  };

  const clearAll = () => {
    if(confirm('¿Deseas vaciar todos los diseños?')) {
      updateField('designs', []);
    }
  };

  const resetAll = () => {
    if(confirm('¿Restaurar configuración de fábrica? Esto borrará tus cambios personalizados.')) {
      setAppData(DEFAULT_DATA);
    }
  };

  const getColorForDesign = (originalId: string) => {
    const index = appData.designs.findIndex(d => d.id === originalId);
    return DESIGN_COLORS[index % DESIGN_COLORS.length] || DESIGN_COLORS[0];
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-700">
      <header className="bg-white/95 backdrop-blur-sm border-b border-slate-200 p-6 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-indigo-200 shadow-xl">
              <Calculator size={24} />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-slate-900 leading-none mb-1">
                Grafica<span className="text-indigo-600">Pro</span>
              </h1>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 tracking-widest uppercase">Sistema de Producción</span>
                <div className="flex items-center gap-1 text-emerald-500 text-[9px] font-black uppercase">
                  <CheckCircle2Icon size={10} /> {lastSaved ? `Guardado ${lastSaved}` : 'Conectado'}
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-4">
            <div className="bg-slate-900 px-5 py-3 rounded-2xl flex flex-col justify-center min-w-[140px] shadow-lg shadow-slate-200">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mb-1">Largo Total</div>
              <div className="text-white font-black text-xl leading-none">{packingResult.totalLength.toFixed(1)} <span className="text-xs text-indigo-400 ml-0.5">cm</span></div>
            </div>
            <div className="bg-emerald-600 px-5 py-3 rounded-2xl flex flex-col justify-center min-w-[140px] shadow-lg shadow-emerald-100">
              <div className="text-[9px] text-emerald-100 font-bold uppercase tracking-widest mb-1">Costo Lineal</div>
              <div className="text-white font-black text-xl leading-none">${currentPricePerCm.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* CONFIGURACIÓN */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-slate-900 font-bold text-sm flex items-center gap-2 uppercase tracking-widest">
                <Settings className="text-indigo-500" /> Parámetros
              </h2>
              <button onClick={resetAll} className="text-slate-300 hover:text-indigo-600 transition-all p-2 hover:bg-slate-50 rounded-lg">
                <RotateCcwIcon size={18} />
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Ancho Pliego</label>
                  <input type="number" value={appData.sheetWidth} onChange={e => updateField('sheetWidth', Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 focus:border-indigo-500 outline-none transition font-bold text-slate-900" />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Margen %</label>
                  <input type="number" value={appData.profitMargin} onChange={e => updateField('profitMargin', Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 focus:border-indigo-500 outline-none transition font-bold text-slate-900" />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Spacing className="text-indigo-400" size={14} /> Espaciado entre piezas (cm)</label>
                <input type="number" step="0.1" value={appData.designSpacing} onChange={e => updateField('designSpacing', Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 focus:border-indigo-500 outline-none transition font-bold text-slate-900" />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
            <h2 className="text-indigo-600 font-bold text-sm flex items-center gap-2 uppercase tracking-widest mb-8">
              <Plus /> Cargar Diseño
            </h2>
            <div className="space-y-5">
              <input type="text" placeholder="Nombre (ej. Sticker Circular)" value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 focus:border-indigo-500 outline-none transition font-bold text-slate-900" />
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase text-center block">Ancho</label>
                  <input type="number" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-center font-bold" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase text-center block">Alto</label>
                  <input type="number" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-center font-bold" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-400 uppercase text-center block">Cantidad</label>
                  <input type="number" value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 text-center font-bold" />
                </div>
              </div>
              <button onClick={addDesign} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-5 rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 uppercase text-xs tracking-[0.2em]">
                <Plus size={20} /> Optimizar e Insertar
              </button>
            </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-slate-900 font-bold text-sm flex items-center gap-2 uppercase tracking-widest"><Tag className="text-indigo-400" /> Tarifas Lineales</h2>
               <button onClick={() => updateField('costTiers', [...appData.costTiers, { id: Date.now().toString(), minLargo: 0, maxLargo: 0, precioPorCm: 0 }])} className="text-indigo-600 hover:bg-indigo-50 p-2 rounded-xl transition"><Plus size={18}/></button>
             </div>
             <div className="space-y-3">
               {appData.costTiers.map((tier, idx) => (
                 <div key={tier.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                   <input type="number" className="w-16 bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] font-bold text-center" value={tier.minLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].minLargo = Number(e.target.value); updateField('costTiers', nt); }} />
                   <span className="text-slate-300 font-black text-xs px-1">~</span>
                   <input type="number" className="w-16 bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] font-bold text-center" value={tier.maxLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].maxLargo = Number(e.target.value); updateField('costTiers', nt); }} />
                   <div className="flex-1 text-right font-black text-indigo-600 text-sm">$<input type="number" className="w-20 bg-transparent text-right outline-none" value={tier.precioPorCm} onChange={e => { const nt = [...appData.costTiers]; nt[idx].precioPorCm = Number(e.target.value); updateField('costTiers', nt); }} /></div>
                   <button onClick={() => updateField('costTiers', appData.costTiers.filter(t => t.id !== tier.id))} className="text-slate-300 hover:text-rose-500 p-2 opacity-0 group-hover:opacity-100 transition-all"><Trash size={16}/></button>
                 </div>
               ))}
             </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-slate-900 font-bold text-sm flex items-center gap-2 uppercase tracking-widest"><Layers className="text-emerald-400" /> Bonus x Cantidad</h2>
               <button onClick={() => updateField('quantityDiscounts', [...appData.quantityDiscounts, { id: Date.now().toString(), minQty: 0, maxQty: 0, discountPercent: 0 }])} className="text-emerald-600 hover:bg-emerald-50 p-2 rounded-xl transition"><Plus size={18}/></button>
             </div>
             <div className="space-y-3">
               {appData.quantityDiscounts.map((discount, idx) => (
                 <div key={discount.id} className="flex gap-2 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 group">
                   <input type="number" className="w-16 bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] font-bold text-center" value={discount.minQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].minQty = Number(e.target.value); updateField('quantityDiscounts', nd); }} />
                   <span className="text-slate-300 font-black text-xs px-1">~</span>
                   <input type="number" className="w-16 bg-white border border-slate-200 rounded-xl p-2.5 text-[11px] font-bold text-center" value={discount.maxQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].maxQty = Number(e.target.value); updateField('quantityDiscounts', nd); }} />
                   <div className="flex-1 text-right font-black text-emerald-600 text-sm"><input type="number" className="w-10 bg-transparent text-right outline-none" value={discount.discountPercent} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].discountPercent = Number(e.target.value); updateField('quantityDiscounts', nd); }} />%</div>
                   <button onClick={() => updateField('quantityDiscounts', appData.quantityDiscounts.filter(d => d.id !== discount.id))} className="text-slate-300 hover:text-rose-500 p-2 opacity-0 group-hover:opacity-100 transition-all"><Trash size={16}/></button>
                 </div>
               ))}
             </div>
          </section>
        </div>

        {/* CONTENIDO DERECHA */}
        <div className="lg:col-span-8 space-y-8">
          
          {/* VISUALIZADOR */}
          <section className="bg-white rounded-[3rem] p-10 shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="flex items-center justify-between mb-10">
              <div className="flex items-center gap-4">
                <div className="bg-slate-900 p-3 rounded-2xl text-white">
                  <LayoutIcon />
                </div>
                <h2 className="font-black text-xl text-slate-900 tracking-tight">Distribución en Pliego</h2>
              </div>
              {appData.designs.length > 0 && (
                <button onClick={clearAll} className="text-rose-500 hover:bg-rose-50 px-6 py-3 rounded-2xl text-[10px] font-black transition-all flex items-center gap-2 border border-rose-100 uppercase tracking-[0.2em]">
                  <Trash size={16} /> Vaciar Todo
                </button>
              )}
            </div>
            
            <div className="relative bg-slate-950 rounded-[2.5rem] min-h-[450px] overflow-auto flex justify-center p-16 custom-scrollbar shadow-2xl border-[10px] border-slate-900">
              {packingResult.totalLength > 0 ? (
                <div 
                  className="bg-white relative origin-top shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] transition-all duration-700 ease-out"
                  style={{
                    width: `${appData.sheetWidth * PREVIEW_SCALE}px`,
                    height: `${packingResult.totalLength * PREVIEW_SCALE}px`,
                  }}
                >
                  {packingResult.packed.map((p: any) => {
                    const color = getColorForDesign(p.originalId);
                    return (
                      <div
                        key={p.id}
                        className={`absolute border-2 ${color.bg} ${color.border} ${color.text} flex items-center justify-center text-[7px] font-black overflow-hidden shadow-sm rounded-[1px]`}
                        style={{
                          left: `${p.x * PREVIEW_SCALE}px`,
                          top: `${p.y * PREVIEW_SCALE}px`,
                          width: `${p.width * PREVIEW_SCALE}px`,
                          height: `${p.height * PREVIEW_SCALE}px`
                        }}
                      >
                        {p.width}x{p.height}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-700 opacity-20 py-24">
                  <LayoutIcon size={80} strokeWidth={1} />
                  <p className="mt-6 font-black uppercase tracking-[0.4em] text-xs">Sin trabajos activos</p>
                </div>
              )}
            </div>
          </section>

          {/* TABLA DE COSTOS */}
          <section className="bg-white rounded-[3rem] p-10 shadow-sm border border-slate-200">
            <div className="flex items-center gap-4 mb-10">
              <div className="bg-emerald-50 p-3 rounded-2xl text-emerald-600 border border-emerald-100">
                <Calculator />
              </div>
              <h2 className="font-black text-xl text-slate-900 tracking-tight">Análisis Unitario y Total</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-4">
                <thead>
                  <tr className="text-slate-400">
                    <th className="pb-4 px-6 text-[10px] font-black uppercase tracking-widest">Ítem Optimizado</th>
                    <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-right">Costo Prod.</th>
                    <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-right">Precio Un.</th>
                    <th className="pb-4 px-4 text-[10px] font-black uppercase tracking-widest text-right">Costo Total</th>
                    <th className="pb-4 px-6 text-[10px] font-black uppercase tracking-widest text-right text-indigo-500">Venta Final</th>
                  </tr>
                </thead>
                <tbody>
                  {appData.designs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-24 text-center text-slate-300 font-black uppercase tracking-[0.3em] italic text-xs">Esperando carga de archivos...</td>
                    </tr>
                  ) : (
                    appData.designs.map((design) => {
                      const res = calculateDetails(design);
                      const color = getColorForDesign(design.id);
                      return (
                        <tr key={design.id} className="bg-slate-50/50 hover:bg-slate-100 transition-all duration-300 rounded-2xl group cursor-default">
                          <td className="py-5 px-6 rounded-l-3xl">
                            <div className="flex items-center gap-4">
                               <div className={`w-3 h-3 rounded-full ${color.bg} ring-4 ring-slate-100`}></div>
                               <div>
                                 <div className="font-black text-slate-900 text-sm leading-none mb-1.5 uppercase">{design.name || 'S/N'}</div>
                                 <div className="text-[9px] font-black text-slate-400 tracking-widest uppercase">{design.width}x{design.height} CM • CANT: {design.quantity}</div>
                               </div>
                            </div>
                          </td>
                          <td className="py-5 px-4 text-right font-bold text-slate-600 text-xs">${res.unitProductionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-5 px-4 text-right font-black text-slate-900 text-sm">${res.unitClientPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-5 px-4 text-right font-bold text-slate-400 text-xs">${res.totalProductionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-5 px-6 text-right font-black text-emerald-600 text-xl rounded-r-3xl">
                             ${res.totalClientPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                             <button onClick={() => removeDesign(design.id)} className="ml-5 text-slate-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"><Trash size={18} /></button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* RESUMEN GLOBAL */}
            {appData.designs.length > 0 && (
              <div className="mt-12 p-10 bg-slate-900 rounded-[3rem] text-white flex flex-col md:flex-row justify-between items-center gap-10 shadow-2xl shadow-slate-300 border border-white/5 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-[100px] -mr-32 -mt-32"></div>
                <div className="text-center md:text-left relative z-10">
                  <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Presupuesto Producción</p>
                  <p className="text-4xl font-light text-white/90 tracking-tight">
                    ${(packingResult.totalLength * currentPricePerCm).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-center md:text-right relative z-10">
                  <p className="text-emerald-400 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Total Facturación Cliente</p>
                  <p className="text-6xl font-black text-emerald-400 tracking-tighter drop-shadow-lg">
                    ${appData.designs.reduce((acc, d) => acc + calculateDetails(d).totalClientPrice, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      
      <footer className="mt-24 text-center text-slate-300 text-[10px] py-16 font-black uppercase tracking-[0.5em] border-t border-slate-200">
        GraficaPro v3.0 &bull; Alta Disponibilidad Vercel
      </footer>
    </div>
  );
};

export default App;