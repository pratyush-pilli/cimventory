const roleBasedAccess = {
  Requisitor: {
    allowedPaths: [
      "/home",
      "/requisition-form",
      "/edit-requisition",
      "/inventory",
      "/master-table",
      "/PO",
      "/vendor-data",
      "/item-data",
      "/item-generator"
    ]
  },
  Approver: {
    allowedPaths: [
      "/home",
      "/approval-table",
      "/inventory",
      "/master-table",
      "/PO",
      "/vendor-data",
      "/item-data"
    ]
  },
  Purchaser: {
    allowedPaths: [
      "/home",
      "/master-table",
      "/PO",
      "/vendor-registration",
      "/vendor-data",
      "/item-data",
      "/item-generator"
    ]
  },
  Admin: {
    allowedPaths: "all"
  },
  Developer: {
    allowedPaths: "all"
  }
};

export default roleBasedAccess; 