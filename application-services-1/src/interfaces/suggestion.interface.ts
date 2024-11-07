export interface Suggestion {
    orderForm:OrderForm,
    suggestion:string
}

export interface OrderForm {
  order_summary: string
  material_type:Tag[]
  manufacturing_process: Tag[]
  secondary_operations: Tag[]
  finishing: Tag[]
  tooling?: string
  product_certifications: Tag[]
  region?: Tag[],
  certifications: Tag[],
  facilities_infrastructure: Tag[],
  inspection_techniques: Tag[],
  export_capability?: string,
  annual_turnover?: string,
  additional_info?:string
}

export class Tag {
    label: string;
  }