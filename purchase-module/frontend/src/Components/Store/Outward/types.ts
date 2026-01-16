export interface LocationStock {
  total: number;
  allocated: number;
  available: number;
  allocations: Array<{
    project_code: string;
    quantity: number;
    stock_allocation_id: number;
    allocation_date: string;
    remarks: string;
  }>;
}

export interface RequiredItem {
  id: string;
  item_no: string;
  description: string;
  make: string;
  material_group: string;
  required_quantity: number;
  allocated_quantity: number;
  available_stock: number;
  pending_quantity: number;
  status: string;
  inventory_id: number;
  location_stocks?: {
    [location: string]: LocationStock;
  };
  fifo_details?: Array<{
    id: number;
    req_qty: number;
    requisition_date: string;
  }>;
  outwarded_quantity?: number; // How much has been outwarded so far
  remaining_quantity?: number; // How much is still left to outward
} 