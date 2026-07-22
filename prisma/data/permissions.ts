import {
  PermissionCodes,
  type PermissionCode,
} from "../../src/authorization/constants/permission-codes";

export interface PermissionSeedData {
  code: PermissionCode;
  name: string;
  category: string;
  description: string;
}

export const permissionSeedData: PermissionSeedData[] = [
  {
    code: PermissionCodes.BUSINESS_VIEW,
    name: "View business",
    category: "Business",
    description: "View business information and settings.",
  },
  {
    code: PermissionCodes.BUSINESS_UPDATE,
    name: "Update business",
    category: "Business",
    description: "Update business information and settings.",
  },

  {
    code: PermissionCodes.BRANCH_VIEW,
    name: "View branches",
    category: "Branch",
    description: "View branches belonging to the selected business.",
  },
  {
    code: PermissionCodes.BRANCH_CREATE,
    name: "Create branches",
    category: "Branch",
    description: "Create new branches for the selected business.",
  },
  {
    code: PermissionCodes.BRANCH_UPDATE,
    name: "Update branches",
    category: "Branch",
    description: "Update branches belonging to the selected business.",
  },
  {
    code: PermissionCodes.BRANCH_DELETE,
    name: "Delete branches",
    category: "Branch",
    description:
      "Delete or deactivate branches belonging to the selected business.",
  },

  {
    code: PermissionCodes.ROLE_VIEW,
    name: "View roles",
    category: "Role",
    description: "View roles and their assigned permissions.",
  },
  {
    code: PermissionCodes.ROLE_CREATE,
    name: "Create roles",
    category: "Role",
    description: "Create custom roles for the selected business.",
  },
  {
    code: PermissionCodes.ROLE_UPDATE,
    name: "Update roles",
    category: "Role",
    description: "Update roles and their permission assignments.",
  },
  {
    code: PermissionCodes.ROLE_DELETE,
    name: "Delete roles",
    category: "Role",
    description: "Delete eligible custom roles.",
  },

  {
    code: PermissionCodes.MEMBER_VIEW,
    name: "View members",
    category: "Member",
    description: "View business members and their assignments.",
  },
  {
    code: PermissionCodes.MEMBER_INVITE,
    name: "Invite members",
    category: "Member",
    description: "Invite users to join the selected business.",
  },
  {
    code: PermissionCodes.MEMBER_UPDATE,
    name: "Update members",
    category: "Member",
    description: "Update member status, roles, and branch assignments.",
  },
  {
    code: PermissionCodes.MEMBER_REMOVE,
    name: "Remove members",
    category: "Member",
    description: "Remove eligible members from the selected business.",
  },

  {
    code: PermissionCodes.CATEGORY_VIEW,
    name: "View categories",
    category: "Inventory - Category",
    description: "View product categories in the selected business.",
  },
  {
    code: PermissionCodes.CATEGORY_CREATE,
    name: "Create categories",
    category: "Inventory - Category",
    description: "Create product categories in the selected business.",
  },
  {
    code: PermissionCodes.CATEGORY_UPDATE,
    name: "Update categories",
    category: "Inventory - Category",
    description: "Update product categories in the selected business.",
  },
  {
    code: PermissionCodes.CATEGORY_DELETE,
    name: "Delete categories",
    category: "Inventory - Category",
    description:
      "Delete or deactivate product categories in the selected business.",
  },

  {
    code: PermissionCodes.UNIT_VIEW,
    name: "View units",
    category: "Inventory - Unit",
    description: "View units of measurement in the selected business.",
  },
  {
    code: PermissionCodes.UNIT_CREATE,
    name: "Create units",
    category: "Inventory - Unit",
    description: "Create units of measurement in the selected business.",
  },
  {
    code: PermissionCodes.UNIT_UPDATE,
    name: "Update units",
    category: "Inventory - Unit",
    description: "Update units of measurement in the selected business.",
  },
  {
    code: PermissionCodes.UNIT_DELETE,
    name: "Delete units",
    category: "Inventory - Unit",
    description:
      "Delete or deactivate units of measurement in the selected business.",
  },

  {
    code: PermissionCodes.BRAND_VIEW,
    name: "View brands",
    category: "Inventory - Brand",
    description: "View product brands in the selected business.",
  },
  {
    code: PermissionCodes.BRAND_CREATE,
    name: "Create brands",
    category: "Inventory - Brand",
    description: "Create product brands in the selected business.",
  },
  {
    code: PermissionCodes.BRAND_UPDATE,
    name: "Update brands",
    category: "Inventory - Brand",
    description: "Update product brands in the selected business.",
  },
  {
    code: PermissionCodes.BRAND_DELETE,
    name: "Delete brands",
    category: "Inventory - Brand",
    description:
      "Delete or deactivate product brands in the selected business.",
  },

  {
    code: PermissionCodes.PRODUCT_VIEW,
    name: "View products",
    category: "Inventory - Product",
    description: "View products in the selected business.",
  },
  {
    code: PermissionCodes.PRODUCT_CREATE,
    name: "Create products",
    category: "Inventory - Product",
    description: "Create products in the selected business.",
  },
  {
    code: PermissionCodes.PRODUCT_UPDATE,
    name: "Update products",
    category: "Inventory - Product",
    description: "Update products in the selected business.",
  },
  {
    code: PermissionCodes.PRODUCT_DELETE,
    name: "Delete products",
    category: "Inventory - Product",
    description: "Delete or deactivate products in the selected business.",
  },

  {
    code: PermissionCodes.SUPPLIER_VIEW,
    name: "View suppliers",
    category: "Purchase - Supplier",
    description: "View suppliers belonging to the selected business.",
  },
  {
    code: PermissionCodes.SUPPLIER_CREATE,
    name: "Create suppliers",
    category: "Purchase - Supplier",
    description: "Create suppliers for the selected business.",
  },
  {
    code: PermissionCodes.SUPPLIER_UPDATE,
    name: "Update suppliers",
    category: "Purchase - Supplier",
    description: "Update supplier information.",
  },
  {
    code: PermissionCodes.SUPPLIER_DELETE,
    name: "Deactivate suppliers",
    category: "Purchase - Supplier",
    description: "Deactivate suppliers belonging to the selected business.",
  },

  {
    code: PermissionCodes.CUSTOMER_VIEW,
    name: "View customers",
    category: "Sales - Customer",
    description: "View customers belonging to the selected business.",
  },
  {
    code: PermissionCodes.CUSTOMER_CREATE,
    name: "Create customers",
    category: "Sales - Customer",
    description: "Create customers for the selected business.",
  },
  {
    code: PermissionCodes.CUSTOMER_UPDATE,
    name: "Update customers",
    category: "Sales - Customer",
    description: "Update customer information and account settings.",
  },
  {
    code: PermissionCodes.CUSTOMER_DELETE,
    name: "Deactivate customers",
    category: "Sales - Customer",
    description: "Deactivate customers belonging to the selected business.",
  },

  {
    code: PermissionCodes.CUSTOMER_PAYMENT_VIEW,
    name: "View customer payments",
    category: "Sales - Customer Payments",
    description: "View customer payment history and outstanding balances.",
  },
  {
    code: PermissionCodes.CUSTOMER_PAYMENT_CREATE,
    name: "Record customer payments",
    category: "Sales - Customer Payments",
    description: "Record payments received against customer credit balances.",
  },

  {
    code: PermissionCodes.PURCHASE_VIEW,
    name: "View purchases",
    category: "Purchase",
    description: "View purchase records belonging to the selected business.",
  },
  {
    code: PermissionCodes.PURCHASE_CREATE,
    name: "Create purchases",
    category: "Purchase",
    description: "Create draft purchases for the selected business.",
  },
  {
    code: PermissionCodes.PURCHASE_UPDATE,
    name: "Update purchases",
    category: "Purchase",
    description:
      "Update purchase information and items while the purchase is in draft status.",
  },
  {
    code: PermissionCodes.PURCHASE_RECEIVE,
    name: "Receive purchases",
    category: "Purchase",
    description:
      "Receive a purchase and add purchased quantities to branch stock.",
  },
  {
    code: PermissionCodes.PURCHASE_CANCEL,
    name: "Cancel purchases",
    category: "Purchase",
    description:
      "Cancel eligible purchase records belonging to the selected business.",
  },

  {
    code: PermissionCodes.SALE_VIEW,
    name: "View sales",
    category: "Sales",
    description: "View sales belonging to the selected business.",
  },
  {
    code: PermissionCodes.SALE_CREATE,
    name: "Create sales",
    category: "Sales",
    description: "Create draft sales for the selected business.",
  },
  {
    code: PermissionCodes.SALE_UPDATE,
    name: "Update draft sales",
    category: "Sales",
    description: "Update sales that are still in draft status.",
  },
  {
    code: PermissionCodes.SALE_COMPLETE,
    name: "Complete sales",
    category: "Sales",
    description: "Complete sales, record payments, and deduct inventory.",
  },
  {
    code: PermissionCodes.SALE_CANCEL,
    name: "Cancel draft sales",
    category: "Sales",
    description: "Cancel sales that are still in draft status.",
  },
];
