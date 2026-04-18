import type { Schema, Struct } from '@strapi/strapi';

export interface SubCategorySubCategory extends Struct.ComponentSchema {
  collectionName: 'components_sub_category_sub_categories';
  info: {
    displayName: 'SubCategory';
  };
  attributes: {
    MedicineType: Schema.Attribute.Enumeration<
      ['Antibiotics', 'Pain Relievers', 'Paracetamol']
    >;
    SubMedicineDesc: Schema.Attribute.String;
  };
}

export interface SubMedicinesSubMedicines extends Struct.ComponentSchema {
  collectionName: 'components_sub_medicines_sub_medicines';
  info: {
    displayName: 'SubMedicines';
  };
  attributes: {};
}

export interface SubOderlineSubOrderLine extends Struct.ComponentSchema {
  collectionName: 'components_sub_oderline_sub_order_lines';
  info: {
    displayName: 'SubOrderLine';
  };
  attributes: {
    SubOrderLineDesc: Schema.Attribute.String;
  };
}

export interface SubOrderSubOrder extends Struct.ComponentSchema {
  collectionName: 'components_sub_order_sub_orders';
  info: {
    displayName: 'SubOrder';
  };
  attributes: {
    OrdersNum: Schema.Attribute.Integer;
    OrderType: Schema.Attribute.String;
  };
}

export interface SubStockSubStock extends Struct.ComponentSchema {
  collectionName: 'components_sub_stock_sub_stocks';
  info: {
    displayName: 'SubStock';
  };
  attributes: {
    StockNum: Schema.Attribute.Integer;
  };
}

declare module '@strapi/strapi' {
  export module Public {
    export interface ComponentSchemas {
      'sub-category.sub-category': SubCategorySubCategory;
      'sub-medicines.sub-medicines': SubMedicinesSubMedicines;
      'sub-oderline.sub-order-line': SubOderlineSubOrderLine;
      'sub-order.sub-order': SubOrderSubOrder;
      'sub-stock.sub-stock': SubStockSubStock;
    }
  }
}
