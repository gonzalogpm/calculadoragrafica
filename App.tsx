import React, { useState, useMemo, useCallback } from 'react';
import { 
  PlusIcon, 
  TrashIcon, 
  Settings2Icon, 
  LayoutIcon, 
  CalculatorIcon,
  TagIcon,
  LayersIcon,
  MaximizeIcon
} from 'lucide-react';
import { DesignItem, CostTier, QuantityDiscount, CalculationResult } from './types';
import { packDesigns } from './utils/layout';

interface IconProps {
  className?: string;
  size?: number;
}

const Plus = ({ className, size = 18 }: IconProps) => <PlusIcon size={size} className={className} />;
const Trash = ({ className, size = 16 }: IconProps) => <TrashIcon size={size} className={className} />;
const Settings = ({ className, size = 18 }: IconProps) => <Settings2Icon size={size} className={className} />;
const Layout = ({ className, size = 18 }: IconProps) => <LayoutIcon size={size} className={className} />;
const Calculator = ({ className, size = 18 }: IconProps) => <CalculatorIcon size={size} className={className} />;
const Tag = ({ className, size = 18 }: IconProps) => <TagIcon size={size} className={className} />;
const Layers = ({ className, size = 18 }: IconProps) => <LayersIcon size={size} className={className} />;
const Spacing = ({ className, size = 18 }: IconProps) => <MaximizeIcon size={size} className={className} />;

const DESIGN_COLORS = [
  { bg: 'bg-indigo-500', text: 'text-white', border: 'border-indigo-600' },
  { bg: 'bg-rose-500', text: 'text-white', border: 'border-rose-600' },
  { bg: 'bg-emerald-500', text: 'text-white', border: 'border-emerald-600' },
  { bg: 'bg-amber-400', text: 'text-amber-950', border: 'border-amber-500' },
  { bg: 'bg-violet-500', text: 'text-white', border: 'border-violet-600' },
];

const App: React.FC = () => {
  const [sheetWidth, setSheetWidth] = useState<number>(58);
  const [profitMargin, setProfitMargin] = useState<number>(100);
  const [designSpacing, setDesignSpacing] = useState<number>(0.2);
  
  const [costTiers, setCostTiers] = useState<CostTier[]>([
    { id: '1', minLargo: 0, maxLargo: 20, precioPorCm: 10000 },
    { id: '2', minLargo: 20, maxLargo: 50, precioPorCm: 8000 },
    { id: '3', minLargo: 50, maxLargo: 100, precioPorCm: 6000 },
    { id: '4', minLargo: 100, maxLargo: 9999, precioPorCm: 3000 },
  ]);

  const [quantityDiscounts, setQuantityDiscounts] = useState<QuantityDiscount[]>([
    { id: '1', minQty: 10, maxQty: 25, discountPercent: 20 },
    { id: '2', minQty: 26, maxQty: 100, discountPercent: 30 },
  ]);

  const [designs, setDesigns] = useState<DesignItem[]>([]);
  const [newDesign, setNewDesign] = useState<Omit<DesignItem, 'id'>>({
    name: '',
    width: 0,
    height: 0,
    quantity: 1
  });

  const PREVIEW_SCALE = 6;

  const packingResult = useMemo(() => {
    return packDesigns(designs, sheetWidth, designSpacing);
  }, [designs, sheetWidth, designSpacing]);

  const currentPricePerCm = useMemo(() => {
    const totalL = packingResult.totalLength;
    const tier = costTiers.find(t => totalL >= t.minLargo && totalL < t.maxLargo);
    // Nota: El sistema asume que el precio de la escala es POR CM lineal según tu lógica de cálculo.
    return tier ? tier.precioPorCm : (costTiers[costTiers.length - 1]?.precioPorCm || 0);
  }, [packingResult.totalLength, costTiers]);

  const getDiscountForQty = useCallback((qty: number) => {
    const discount = quantityDiscounts.find(d => qty >= d.minQty && qty <= d.maxQty);
    return discount ? discount.discountPercent : 0;
  }, [quantityDiscounts]);

  const calculateDetails = useCallback((item: DesignItem): CalculationResult => {
    if (packingResult.totalLength <= 0) return { unitProductionCost: 0, unitClientPrice: 0, totalProductionCost: 0, totalClientPrice: 0 };

    const totalSheetCost = packingResult.totalLength * currentPricePerCm;
    const totalDesignArea = designs.reduce((acc, d) => acc + (d.width * d.height * d.quantity), 0);
    const itemAreaTotal = (item.width * item.height) * item.quantity;
    
    // Costo de producción (repartido proporcionalmente por área)
    const totalProdCostForItem = totalDesignArea > 0 ? (itemAreaTotal / totalDesignArea) * totalSheetCost : 0;
    const unitProdCost = item.quantity > 0 ? totalProdCostForItem / item.quantity : 0;

    const discountPercent = getDiscountForQty(item.quantity);
    const marginMult = 1 + (profitMargin / 100);
    const discountMult = 1 - (discountPercent / 100);

    const unitClientPrice = unitProdCost * marginMult * discountMult;
    const totalClientPrice = unitClientPrice * item.quantity;

    return {
      unitProductionCost: unitProdCost,
      unitClientPrice,
      totalProductionCost: totalProdCostForItem,
      totalClientPrice
    };
  }, [designs, packingResult.totalLength, currentPricePerCm, profitMargin, getDiscountForQty]);

  const getColorForDesign = (originalId: string) => {
    const index = designs.findIndex(d => d.id === originalId);
    return DESIGN_COLORS[index % DESIGN_COLORS.length] || DESIGN_COLORS[0];
  };

  const addDesign = () => {
    if (newDesign.width <= 0 || newDesign.height <= 0 || newDesign.quantity <= 0) return;
    setDesigns([...designs, { ...newDesign, id: Date.now().toString() }]);
    setNewDesign({ name: '', width: 0, height: 0, quantity: 1 });
  };

  const removeDesign = (id: string) => {
    setDesigns(designs.filter(d => d.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans text-slate-700">
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 p-6 sticky top-0 z-50 transition-all duration-300">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-2.5 rounded-xl text-white shadow-indigo-100 shadow-lg">
              <Calculator />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 leading-none mb-1">
                Grafica<span className="text-indigo-600">Pro</span>
              </h1>
              <span className="text-[10px] font-medium text-slate-400 tracking-wider uppercase">Cálculo de Pliegos</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-3">
            <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex flex-col justify-center min-w-[120px]">
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Largo Total</div>
              <div className="text-indigo-600 font-bold text-lg leading-tight">{packingResult.totalLength.toFixed(1)} <span className="text-[10px]">cm</span></div>
            </div>
            <div className="bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex flex-col justify-center min-w-[120px]">
              <div className="text-[9px] text-slate-400 font-semibold uppercase tracking-wider">Costo Lineal</div>
              <div className="text-emerald-600 font-bold text-lg leading-tight">${currentPricePerCm.toLocaleString()}</div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 pt-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        <div className="lg:col-span-4 space-y-8">
          <section className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-2 mb-6 text-slate-800 font-semibold text-sm">
              <Settings className="text-slate-400" />
              <h2>Configuración Base</h2>
            </div>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Ancho Pliego (cm)</label>
                  <input type="number" value={sheetWidth} onChange={e => setSheetWidth(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none transition font-medium text-slate-900" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Margen %</label>
                  <input type="number" value={profitMargin} onChange={e => setProfitMargin(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none transition font-medium text-slate-900" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1 flex items-center gap-2"><Spacing className="text-slate-300" /> Separación entre diseños (cm)</label>
                <input type="number" step="0.1" value={designSpacing} onChange={e => setDesignSpacing(Number(e.target.value))} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none transition font-medium text-slate-900" />
              </div>
            </div>
          </section>

          <section className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-2 mb-6 text-indigo-600 font-semibold text-sm">
              <Plus />
              <h2>Añadir Diseño</h2>
            </div>
            <div className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider ml-1">Nombre</label>
                <input type="text" placeholder="Ej: Sticker Logo" value={newDesign.name} onChange={e => setNewDesign({...newDesign, name: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none transition font-medium text-slate-900" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center space-y-1.5">
                  <label className="text-[9px] font-semibold text-slate-400 uppercase block">Ancho</label>
                  <input type="number" value={newDesign.width || ''} onChange={e => setNewDesign({...newDesign, width: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none transition font-medium text-center text-slate-900" />
                </div>
                <div className="text-center space-y-1.5">
                  <label className="text-[9px] font-semibold text-slate-400 uppercase block">Alto</label>
                  <input type="number" value={newDesign.height || ''} onChange={e => setNewDesign({...newDesign, height: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none transition font-medium text-center text-slate-900" />
                </div>
                <div className="text-center space-y-1.5">
                  <label className="text-[9px] font-semibold text-slate-400 uppercase block">Cant.</label>
                  <input type="number" value={newDesign.quantity || ''} onChange={e => setNewDesign({...newDesign, quantity: Number(e.target.value)})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:border-indigo-500 outline-none transition font-medium text-center text-slate-900" />
                </div>
              </div>
              <button onClick={addDesign} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-4 rounded-2xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
                <Plus /> Agregar Diseño
              </button>
            </div>
          </section>

          <section className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200/60">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-slate-800 font-semibold text-sm flex items-center gap-2"><Tag className="text-slate-400" /> Escala de Costos (Largo)</h2>
               <button onClick={() => setCostTiers([...costTiers, { id: Date.now().toString(), minLargo: 0, maxLargo: 0, precioPorCm: 0 }])} className="text-indigo-600 hover:bg-indigo-50 p-1.5 rounded-full transition"><Plus /></button>
             </div>
             <div className="space-y-2.5">
               {costTiers.map((tier, idx) => (
                 <div key={tier.id} className="flex gap-2 items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100 overflow-hidden">
                   <div className="flex items-center gap-1.5">
                     <input type="number" className="w-14 bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-medium text-center" value={tier.minLargo} onChange={e => { const nt = [...costTiers]; nt[idx].minLargo = Number(e.target.value); setCostTiers(nt); }} />
                     <span className="text-slate-300 text-[10px] font-bold">→</span>
                     <input type="number" className="w-14 bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-medium text-center" value={tier.maxLargo} onChange={e => { const nt = [...costTiers]; nt[idx].maxLargo = Number(e.target.value); setCostTiers(nt); }} />
                   </div>
                   <input type="number" className="flex-1 bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-bold text-indigo-600 text-right" value={tier.precioPorCm} onChange={e => { const nt = [...costTiers]; nt[idx].precioPorCm = Number(e.target.value); setCostTiers(nt); }} />
                   <button onClick={() => setCostTiers(costTiers.filter(t => t.id !== tier.id))} className="text-slate-300 hover:text-rose-500 transition-colors p-1"><Trash /></button>
                 </div>
               ))}
             </div>
          </section>

          <section className="bg-white rounded-3xl p-7 shadow-sm border border-slate-200/60">
             <div className="flex items-center justify-between mb-6">
               <h2 className="text-slate-800 font-semibold text-sm flex items-center gap-2"><Layers className="text-slate-400" /> Descuentos x Cantidad</h2>
               <button onClick={() => setQuantityDiscounts([...quantityDiscounts, { id: Date.now().toString(), minQty: 0, maxQty: 0, discountPercent: 0 }])} className="text-emerald-600 hover:bg-emerald-50 p-1.5 rounded-full transition"><Plus /></button>
             </div>
             <div className="space-y-2.5">
               {quantityDiscounts.map((discount, idx) => (
                 <div key={discount.id} className="flex gap-2 items-center bg-slate-50/50 p-2 rounded-xl border border-slate-100">
                   <div className="flex items-center gap-1.5">
                     <input type="number" className="w-14 bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-medium text-center" value={discount.minQty} onChange={e => { const nd = [...quantityDiscounts]; nd[idx].minQty = Number(e.target.value); setQuantityDiscounts(nd); }} />
                     <span className="text-slate-300 text-[10px] font-bold">→</span>
                     <input type="number" className="w-14 bg-white border border-slate-200 rounded-lg p-2 text-[11px] font-medium text-center" value={discount.maxQty} onChange={e => { const nd = [...quantityDiscounts]; nd[idx].maxQty = Number(e.target.value); setQuantityDiscounts(nd); }} />
                   </div>
                   <div className="flex-1 relative">
                     <input type="number" className="w-full bg-white border border-slate-200 rounded-lg p-2 pr-5 text-[11px] font-bold text-emerald-600 text-right" value={discount.discountPercent} onChange={e => { const nd = [...quantityDiscounts]; nd[idx].discountPercent = Number(e.target.value); setQuantityDiscounts(nd); }} />
                     <span className="absolute right-1.5 top-2.5 text-[9px] font-bold text-emerald-400">%</span>
                   </div>
                   <button onClick={() => setQuantityDiscounts(quantityDiscounts.filter(d => d.id !== discount.id))} className="text-slate-300 hover:text-rose-500 transition-colors p-1"><Trash /></button>
                 </div>
               ))}
             </div>
          </section>
        </div>

        <div className="lg:col-span-8 space-y-10">
          <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200/60 overflow-hidden relative">
            <div className="flex items-center gap-4 mb-8">
              <div className="bg-slate-50 p-2.5 rounded-xl text-slate-600 border border-slate-100">
                <Layout />
              </div>
              <h2 className="font-bold text-lg text-slate-900 tracking-tight">Previsualización del Pliego</h2>
            </div>
            
            <div className="relative bg-slate-900 rounded-3xl min-h-[500px] overflow-auto flex justify-center p-14 custom-scrollbar shadow-inner border-[6px] border-slate-800">
              {packingResult.totalLength > 0 ? (
                <div 
                  className="bg-white shadow-2xl relative border border-white/20 origin-top"
                  style={{
                    width: `${sheetWidth * PREVIEW_SCALE}px`,
                    height: `${packingResult.totalLength * PREVIEW_SCALE}px`,
                    transition: 'all 0.6s'
                  }}
                >
                  {packingResult.packed.map((p: any) => {
                    const color = getColorForDesign(p.originalId);
                    return (
                      <div
                        key={p.id}
                        className={`absolute border ${color.bg} ${color.border} ${color.text} flex items-center justify-center text-[8px] font-bold overflow-hidden shadow-sm`}
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
                  <div className="absolute -left-16 top-0 bottom-0 w-12 flex flex-col justify-between text-[11px] font-bold text-slate-400 py-1 uppercase italic">
                    <span>0</span>
                    <span className="bg-indigo-600 text-white px-1.5 py-0.5 rounded-md text-center">{packingResult.totalLength.toFixed(1)}cm</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-600 opacity-30 py-32">
                  <LayoutIcon size={80} strokeWidth={1} />
                  <p className="mt-4 font-semibold uppercase tracking-widest text-xs">Añade diseños para comenzar</p>
                </div>
              )}
            </div>
          </section>

          <section className="bg-white rounded-[2.5rem] p-8 shadow-sm border border-slate-200/60">
            <div className="flex items-center gap-4 mb-10">
              <div className="bg-emerald-50 p-2.5 rounded-xl text-emerald-600 border border-emerald-100">
                <Calculator />
              </div>
              <h2 className="font-bold text-lg text-slate-900 tracking-tight">Detalle de Costos y Precios</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-3">
                <thead>
                  <tr className="text-slate-400">
                    <th className="pb-2 px-6 text-[10px] font-bold uppercase tracking-widest">Diseño</th>
                    <th className="pb-2 px-4 text-[10px] font-bold uppercase tracking-widest text-center">Cant.</th>
                    <th className="pb-2 px-4 text-[10px] font-bold uppercase tracking-widest text-right">Costo Total (Prod)</th>
                    <th className="pb-2 px-4 text-[10px] font-bold uppercase tracking-widest text-right text-indigo-500">Precio Total (Cliente)</th>
                  </tr>
                </thead>
                <tbody>
                  {designs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-20 text-center text-slate-300 font-medium uppercase tracking-widest italic text-xs">No hay ítems cargados</td>
                    </tr>
                  ) : (
                    designs.map((design) => {
                      const res = calculateDetails(design);
                      const color = getColorForDesign(design.id);
                      return (
                        <tr key={design.id} className="bg-slate-50/50 hover:bg-slate-100/50 transition-colors duration-300 rounded-2xl group border border-slate-100">
                          <td className="py-5 px-6 rounded-l-2xl">
                            <div className="flex items-center gap-3">
                               <div className={`w-3 h-3 rounded-full ${color.bg} shadow-sm`}></div>
                               <div>
                                 <div className="font-semibold text-slate-900 text-sm leading-none mb-1">{design.name || 'Diseño'}</div>
                                 <div className="text-[10px] font-medium text-slate-400 tracking-wider">{design.width}x{design.height} CM • Costo Unit: ${res.unitProductionCost.toFixed(0)}</div>
                               </div>
                            </div>
                          </td>
                          <td className="py-5 px-4 text-center font-bold text-slate-700">{design.quantity}</td>
                          <td className="py-5 px-4 text-right font-bold text-slate-400 text-lg">${res.totalProductionCost.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-5 px-6 text-right rounded-r-2xl font-bold text-emerald-600 text-2xl">
                             ${res.totalClientPrice.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className="py-5 px-2">
                             <button onClick={() => removeDesign(design.id)} className="text-slate-300 hover:text-rose-500 p-2"><Trash /></button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {designs.length > 0 && (
              <div className="mt-12 p-10 bg-slate-900 rounded-[2.5rem] text-white shadow-xl relative overflow-hidden">
                <div className="relative z-10 flex flex-col lg:flex-row justify-between items-center gap-10">
                  <div className="space-y-1 text-center lg:text-left">
                    <h3 className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em]">Costo Producción Total</h3>
                    <div className="text-3xl font-light text-white/90">
                      ${(packingResult.totalLength * currentPricePerCm).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                  <div className="lg:text-right space-y-2 text-center">
                    <h3 className="text-emerald-400 text-[10px] font-bold uppercase tracking-[0.2em]">Venta Total Recomendada</h3>
                    <div className="text-6xl font-bold text-emerald-400 tracking-tighter">
                      ${designs.reduce((acc, d) => acc + calculateDetails(d).totalClientPrice, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </main>
      
      <footer className="mt-20 text-center text-slate-300 text-[10px] py-12 font-semibold uppercase tracking-[0.5em] border-t border-slate-200">
        GraficaPro &bull; &copy; {new Date().getFullYear()}
      </footer>
    </div>
  );
};

export default App;