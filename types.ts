
export interface DesignItem {
  id: string;
  name: string;
  width: number;
  height: number;
  quantity: number;
}

export interface PackedDesign extends DesignItem {
  x: number;
  y: number;
  rotated: boolean;
  originalId: string;
}

export interface CostTier {
  id: string;
  minLargo: number;
  maxLargo: number;
  precioPorCm: number;
}

export interface QuantityDiscount {
  id: string;
  minQty: number;
  maxQty: number;
  discountPercent: number;
}

export interface CalculationResult {
  unitProductionCost: number;
  unitClientPrice: number;
  totalProductionCost: number;
  totalClientPrice: number;
}