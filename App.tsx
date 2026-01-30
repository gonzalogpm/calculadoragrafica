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
  RotateCcwIcon
} from 'lucide-react';
import { DesignItem, CostTier, QuantityDiscount, CalculationResult } from './types';
import { packDesigns } from './utils/layout';

// Iconos auxiliares
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

const STORAGE_KEY = 'graficapro_v2_data';

// Estado inicial por defecto
const DEFAULT_STATE = {
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
  // Inicialización ÚNICA y persistente
  const [appData, setAppData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        // Mezclamos con los valores por defecto por si faltan campos en versiones viejas
        return { ...DEFAULT_STATE, ...parsed };
      }
    } catch (e) {
      console.error("Error cargando localStorage:", e);
    }
    return DEFAULT_STATE;
  });

  // Guardado automático en cada cambio de appData
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  }, [appData]);

  const [newDesign, setNewDesign] = useState<Omit<DesignItem, 'id'>>({
    name: '',
    width: 0,
    height: 0,
    quantity: 1
  });

  const PREVIEW_SCALE = 6;

  // Cálculos derivados
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

  // Manejadores de eventos actualizando el estado atómico
  const updateField = (field: string, value: any) => {
    setAppData(prev => ({ ...prev, [field]: value }));
  };

  const addDesign = () => {
    if (newDesign.width <= 0 || newDesign.height <= 0 || newDesign.quantity <= 0) return;
    updateField('designs', [...appData.designs, { ...newDesign, id: Date.now().toString() }]);
    setNewDesign({ name: '', width: 0, height: 0, quantity: 1 });
  };

  const removeDesign = (id: string) => {
    updateField('designs', appData.designs.filter(d => d.id !== id));
  };

  const clearAll = () => {
    if(confirm('¿Borrar todos los diseños?')) {
      updateField('designs', []);
    }
  };

  const resetToFactory = () => {
    if(confirm('¿Resetear toda la configuración a valores de fábrica?')) {
      setAppData(DEFAULT_STATE);
    }
  };

  const getColorForDesign = (originalId: string) => {
    const index = appData.designs.findIndex(d => d.id === originalId);
    return DESIGN_COLORS[index % DESIGN_COLORS.length] || DESIGN_COLORS[0];
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-700">
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 p-6 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-indigo-100 shadow-lg">
              <Calculator />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">
                Grafica<span className="text-indigo-600">Pro</span>
              </h1>
              <span className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Persistencia Activada</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 flex flex-col justify-center min-w-[120px] shadow-sm">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Largo Total</div>
              <div className="text-indigo-600 font-bold text-lg leading-tight">{packingResult.totalLength.toFixed(1)} <span className="text-[10px]">cm</span></div>
            </div>
            <div className="bg-white px-4 py-2 rounded-xl border border-slate-200 flex flex-col justify-center min-w-[120px] shadow-sm">
              <div className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Costo Lineal</div>
              <div className="text-emerald-600 font-bold text-lg leading-tight">${currentPricePerCm.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Columna Izquierda: Configuración */}
        <div className="lg:col-span-4 space-y-6">
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-slate-800 font-bold text-sm">
                <Settings className="text-slate-400" />
                <h2>Ajustes Base</h2>
              </div>
              <button onClick={resetToFactory} title="Restaurar valores de fábrica" className="text-slate-300 hover:text-indigo-600 transition">
                <RotateCcwIcon size={16} />
              </button>
            </div>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Ancho Pliego</label>
                  <input type="number" value={appData.sheetWidth} onChange={e => updateField('sheetWidth', Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/20 outline-none transition font-bold text-slate-900" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1">Margen %</label>
                  <input type="number" value={appData.profitMargin} onChange={e => updateField('profitMargin', Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/20 outline-none transition font-bold text-slate-900" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2"><Spacing className="text-slate-300" /> Separación entre piezas (cm)</label>
                <input type="number" step="0.1" value={appData.designSpacing} onChange={e => updateField('designSpacing', Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/20 outline-none transition font-bold text-slate-900" />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center gap-2 mb-6 text-indigo-600 font-bold text-sm">
              <Plus />
              <h2>Nuevo Diseño</h2>
            </div>
            <div className="space-y-4">
              <input type="text" placeholder="Nombre del diseño..." value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:ring-2 focus:ring-indigo-500/20 outline-none transition font-bold text-slate-900" />
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Ancho</label>
                  <input type="number" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-center font-bold" />
                </div>
                <div className="text-center space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Alto</label>
                  <input type="number" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-center font-bold" />
                </div>
                <div className="text-center space-y-1">
                  <label className="text-[9px] font-bold text-slate-400 uppercase block">Cant.</label>
                  <input type="number" value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-center font-bold" />
                </div>
              </div>
              <button onClick={addDesign} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2">
                <Plus /> Añadir al Pliego
              </button>
            </div>
          </section>

          {/* Configuración de Costos */}
          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-slate-800 font-bold text-sm flex items-center gap-2"><Tag className="text-slate-400" /> Escala de Costos</h2>
               <button onClick={() => updateField('costTiers', [...appData.costTiers, { id: Date.now().toString(), minLargo: 0, maxLargo: 0, precioPorCm: 0 }])} className="text-indigo-600 hover:bg-indigo-50 p-1 rounded-full transition"><Plus size={16}/></button>
             </div>
             <div className="space-y-2">
               {appData.costTiers.map((tier, idx) => (
                 <div key={tier.id} className="flex gap-2 items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                   <input type="number" className="w-14 bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold text-center" value={tier.minLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].minLargo = Number(e.target.value); updateField('costTiers', nt); }} />
                   <span className="text-slate-300 font-bold text-xs">~</span>
                   <input type="number" className="w-14 bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold text-center" value={tier.maxLargo} onChange={e => { const nt = [...appData.costTiers]; nt[idx].maxLargo = Number(e.target.value); updateField('costTiers', nt); }} />
                   <div className="flex-1 text-right font-bold text-indigo-600 text-xs">$<input type="number" className="w-16 bg-transparent text-right outline-none" value={tier.precioPorCm} onChange={e => { const nt = [...appData.costTiers]; nt[idx].precioPorCm = Number(e.target.value); updateField('costTiers', nt); }} /></div>
                   <button onClick={() => updateField('costTiers', appData.costTiers.filter(t => t.id !== tier.id))} className="text-slate-300 hover:text-rose-500 p-1"><Trash size={14}/></button>
                 </div>
               ))}
             </div>
          </section>

          <section className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-slate-800 font-bold text-sm flex items-center gap-2"><Layers className="text-slate-400" /> Descuentos x Qty</h2>
               <button onClick={() => updateField('quantityDiscounts', [...appData.quantityDiscounts, { id: Date.now().toString(), minQty: 0, maxQty: 0, discountPercent: 0 }])} className="text-emerald-600 hover:bg-emerald-50 p-1 rounded-full transition"><Plus size={16}/></button>
             </div>
             <div className="space-y-2">
               {appData.quantityDiscounts.map((discount, idx) => (
                 <div key={discount.id} className="flex gap-2 items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                   <input type="number" className="w-14 bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold text-center" value={discount.minQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].minQty = Number(e.target.value); updateField('quantityDiscounts', nd); }} />
                   <span className="text-slate-300 font-bold text-xs">~</span>
                   <input type="number" className="w-14 bg-white border border-slate-200 rounded-lg p-2 text-[10px] font-bold text-center" value={discount.maxQty} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].maxQty = Number(e.target.value); updateField('quantityDiscounts', nd); }} />
                   <div className="flex-1 text-right font-bold text-emerald-600 text-xs"><input type="number" className="w-10 bg-transparent text-right outline-none" value={discount.discountPercent} onChange={e => { const nd = [...appData.quantityDiscounts]; nd[idx].discountPercent = Number(e.target.value); updateField('quantityDiscounts', nd); }} />%</div>
                   <button onClick={() => updateField('quantityDiscounts', appData.quantityDiscounts.filter(d => d.id !== discount.id))} className="text-slate-300 hover:text-rose-500 p-1"><Trash size={14}/></button>
                 </div>
               ))}
             </div>
          </section>
        </div>

        {/* Columna Derecha: Pliego y Resultados */}
        <div className="lg:col-span-8 space-y-8">
          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200 relative overflow-hidden">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <Layout className="text-indigo-600" />
                <h2 className="font-bold text-lg text-slate-900">Visualización del Aprovechamiento</h2>
              </div>
              {appData.designs.length > 0 && (
                <button onClick={clearAll} className="text-rose-500 hover:bg-rose-50 px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 border border-rose-100 uppercase tracking-widest">
                  <Trash size={14} /> Limpiar Pliego
                </button>
              )}
            </div>
            
            <div className="relative bg-slate-950 rounded-2xl min-h-[400px] overflow-auto flex justify-center p-12 custom-scrollbar shadow-inner border-4 border-slate-900">
              {packingResult.totalLength > 0 ? (
                <div 
                  className="bg-white relative origin-top shadow-2xl transition-all duration-500"
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
                        className={`absolute border ${color.bg} ${color.border} ${color.text} flex items-center justify-center text-[7px] font-bold overflow-hidden shadow-sm`}
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
                <div className="flex flex-col items-center justify-center text-slate-700 opacity-20 py-20">
                  <LayoutIcon size={64} strokeWidth={1} />
                  <p className="mt-4 font-bold uppercase tracking-widest text-[10px]">Sin diseños cargados</p>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-[2rem] p-8 shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-8">
              <Calculator className="text-emerald-600" />
              <h2 className="font-bold text-lg text-slate-900">Análisis de Costos por Diseño</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-4">
                <thead>
                  <tr className="text-slate-400">
                    <th className="pb-2 px-6 text-[9px] font-bold uppercase tracking-widest">Diseño</th>
                    <th className="pb-2 px-4 text-[9px] font-bold uppercase tracking-widest text-right">Unit. Prod</th>
                    <th className="pb-2 px-4 text-[9px] font-bold uppercase tracking-widest text-right">Unit. Cliente</th>
                    <th className="pb-2 px-4 text-[9px] font-bold uppercase tracking-widest text-right">Total Prod</th>
                    <th className="pb-2 px-6 text-[9px] font-bold uppercase tracking-widest text-right text-indigo-500">Total Venta</th>
                  </tr>
                </thead>
                <tbody>
                  {appData.designs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-12 text-center text-slate-300 font-bold uppercase tracking-widest italic text-[10px]">Esperando diseños...</td>
                    </tr>
                  ) : (
                    appData.designs.map((design) => {
                      const res = calculateDetails(design);
                      const color = getColorForDesign(design.id);
                      return (
                        <tr key={design.id} className="bg-slate-50/50 hover:bg-slate-100 transition-colors rounded-xl group">
                          <td className="py-4 px-6 rounded-l-xl">
                            <div className="flex items-center gap-3">
                               <div className={`w-2 h-2 rounded-full ${color.bg}`}></div>
                               <div>
                                 <div className="font-bold text-slate-900 text-sm leading-none mb-1">{design.name || 'Sin nombre'}</div>
                                 <div className="text-[9px] font-bold text-slate-400 tracking-wider uppercase">{design.width}x{design.height} CM • QTY: {design.quantity}</div>
                               </div>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-right font-medium text-slate-600 text-xs">${res.unitProductionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-4 px-4 text-right font-bold text-slate-900 text-xs">${res.unitClientPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-4 px-4 text-right font-medium text-slate-400 text-xs">${res.totalProductionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-4 px-6 text-right font-bold text-emerald-600 text-lg rounded-r-xl">
                             ${res.totalClientPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                             <button onClick={() => removeDesign(design.id)} className="ml-4 text-slate-300 hover:text-rose-500 transition-colors"><Trash size={14} /></button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {appData.designs.length > 0 && (
              <div className="mt-10 p-8 bg-slate-900 rounded-[2rem] text-white flex flex-col md:flex-row justify-between items-center gap-8 border border-white/5">
                <div className="text-center md:text-left">
                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Costo Producción Pliego</p>
                  <p className="text-3xl font-bold text-white/90">
                    ${(packingResult.totalLength * currentPricePerCm).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
                <div className="text-center md:text-right">
                  <p className="text-emerald-400 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Precio Venta Total</p>
                  <p className="text-5xl font-black text-emerald-400 tracking-tight">
                    ${appData.designs.reduce((acc, d) => acc + calculateDetails(d).totalClientPrice, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      
      <footer className="mt-20 text-center text-slate-300 text-[10px] py-10 font-bold uppercase tracking-[0.4em]">
        GraficaPro v2.0 &bull; Auto-Save OK
      </footer>
    </div>
  );
};

export default App;
