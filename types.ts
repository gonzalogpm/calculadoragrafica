
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

export interface Client {
  id: string;
  name: string;
  phone: string;
  address: string;
  created_at: number;
}

export interface Category {
  id: string;
  name: string;
  pricePerUnit: number;
}

export interface OrderStatus {
  id: string;
  name: string;
  color: string;
}

export interface Order {
  id: string;
  order_number: string;
  client_id: string;
  width: number;
  height: number;
  quantity: number;
  category_id: string;
  total_price: number;
  deposit: number; // Seña
  balance: number; // Restante
  status_id: string;
  created_at: number;
}
