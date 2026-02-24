# React/TypeScript Code Audit - Complete API Coverage

## 1) ROUTES & NAVIGATION

### Route Table
| Route path | Component | File | Access guard logic | Roles allowed |
|------------|-----------|-------|------------------|--------------|
| / | Login | Components/Login/login.tsx | Public | All |
| /home | HomePage | Components/Home/home.tsx | checkAccess() | All roles |
| /requisition-form | RequisitionForm | Components/Indent/requisition_form.tsx | checkAccess() | Requisitor, Purchaser, Admin, Developer |
| /edit-requisition | EditRequisition | Components/Indent/Edit/edit_requisition.tsx | checkAccess() | Requisitor, Admin, Developer |
| /approval-table | ApprovalTable | Components/Approval/approval.tsx | checkAccess() | Approver, Admin, Developer |
| /master-table | MasterSheet | Components/Master/master.tsx | checkAccess() | All roles |
| /inventory | InventoryForm | Components/Store/Inventory/inventory.tsx | checkAccess() | All roles |
| /allocate | Allocate | Components/Store/Allocate/Allocate.tsx | checkAccess() | All roles |
| /outward | OutwardStock | Components/Store/Outward/outward.tsx | checkAccess() | All roles |
| /vendor-registration | VendorRegistration | Components/Vendor/VendorRegistration.tsx | checkAccess() | Purchaser, Admin, Developer |
| /vendor-approval | VendorApproval | Components/Vendor/VendorApproval.tsx | checkAccess() | Admin, Developer |
| /vendor-data | VendorDataGrid | Components/Vendor/VendorData.tsx | checkAccess() | All roles |
| /item-generator | ItemGenerator | Components/Items/ItemGenerator.tsx | checkAccess() | Requisitor, Purchaser, Admin, Developer |
| /item-data | ItemMasterDataGrid | Components/Items/ItemDatabase/itemData.tsx | checkAccess() | All roles |
| /item-approval | ItemApproval | Components/Items/ItemApproval.tsx | checkAccess() | Admin, Developer |
| /po-approval | POApproval | Components/PurchaseOrder/Approval/POApproval.tsx | checkAccess() | Admin, Developer |
| /admin-dashboard | AdminDashboard | Components/Admin/AdminDashboard.tsx | checkAccess() | Admin, Developer |

### Access Guard Logic
**File**: App.tsx
```typescript
const checkAccess = (path: string) => {
  const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
  const role = userInfo.role;
  if (role === "Admin" || role === "Developer") return true;
  const allowedPaths = roleBasedAccess[role]?.allowedPaths;
  return allowedPaths?.includes(path) || false;
};
```

## 2) API CLIENTS / CONFIG

### API Client Configuration
| Client name | Base URL source | Base URL value | Auth mechanism | Interceptors | withCredentials | File |
|-------------|-----------------|-----------------|----------------|--------------|-------|---------|
| apiClient | configuration.ts | http://199.199.50.190:8001/ | Session cookies | None | true | configuration.ts |
| axiosInstance | utils/axios.ts | http://199.199.50.128:8000 | Bearer token | Request interceptor adds Authorization header | false | utils/axios.ts |

### Request Interceptor Details
**File**: utils/axios.ts
```typescript
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

## 3) FULL API CALL EXTRACTION

### API Calls by Component
| Frontend file | Component/function | Client used | METHOD | Endpoint path | Payload keys | Query params | Response keys used | Notes |
|---------------|-------------------|--------------|---------|---------------|--------------|-------------------|-------|
| services/poService.ts | getNextPONumber() | apiClient | GET | /po/next-number/ | vendor_name | po_number | PO number generation |
| Components/Login/login.tsx | handleLogin() | apiClient | POST | /api/login/ | username, password | token, user, role | Login authentication |
| Components/Indent/requisition_form.tsx | saveRequisition() | apiClient | POST | /requisitions/save/ | project, item_no, cimcon_part_number, material_description, make, req_qty, unit, order_type | success, requisition_id | Create requisition |
| Components/Approval/approval.tsx | batchApprove() | apiClient | POST | /requisitions/batch-approve/ | batch_id, requisition_ids | success, approved_count | Batch approve |
| Components/Master/master.tsx | generatePO() | apiClient | POST | /master/generate-po/ | master_ids, vendor_details | po_number, po_data | PO generation |
| Components/PurchaseOrder/Approval/POApproval.tsx | approvePO() | apiClient | POST | /approve/<po_number>/ | po_number, approval_remarks | success, status | PO approval |
| Components/Store/Inventory/inventory.tsx | getInventory() | apiClient | GET | /inventory/ | None | inventory_data | Get inventory |
| Components/Store/Allocate/Allocate.tsx | allocateStock() | apiClient | POST | /allocate/ | inventory_id, project_code, allocated_quantity, location | success, allocation_id | Stock allocation |
| Components/Store/Outward/outward.tsx | outwardStock() | apiClient | POST | /outward/ | inventory_id, project_code, quantity, location, outward_type | success, outward_id | Stock outward |
| Components/Vendor/VendorRegistration.tsx | createVendor() | apiClient | POST | /vendors/ | vendor_data, documents | success, vendor_id | Vendor creation |
| Components/Items/ItemGenerator.tsx | requestItem() | apiClient | POST | /request-item/ | item_request_data | success, request_id | Item request |

### Dynamic Endpoint Construction
**File**: Components/PurchaseOrder/Approval/POApproval.tsx
```typescript
const approvePO = (poNumber: string) => {
  return apiClient.post(`/approve/${poNumber}/`, approvalData);
};
```

## 4) DUPLICATES & CONFLICTS

### Base URL Conflicts
| Issue type | Value | Files impacted | Risk |
|-------------|--------|----------------|-------|
| Multiple base URLs | http://199.199.50.190:8001/ | configuration.ts | Inconsistent API calls |
| Multiple base URLs | http://199.199.50.128:8000 | utils/axios.ts | Cross-origin issues |
| Multiple base URLs | http://199.199.50.190:8000 | settings.py CORS origins | Production/development mix |

### Hardcoded IP/Port References
| Value | Files impacted | Risk |
|--------|----------------|-------|
| 199.199.50.190:8001 | configuration.ts | Production hardcoded |
| 199.199.50.128:8000 | utils/axios.ts | Different IP conflict |
| 199.199.50.190:8000 | settings.py | Multiple origins |
| 199.199.50.190:3000 | settings.py | Frontend origin |
| 199.199.50.128:3000 | settings.py | Alternative frontend |
| 199.199.51.226:8000 | settings.py | Additional backend |
| 199.199.51.226:3000 | settings.py | Additional frontend |

### Endpoint Client Usage Conflicts
| Endpoint | Client used | Files | Risk |
|----------|-------------|--------|------|
| /api/login/ | apiClient (session) | login.tsx | Mixed auth mechanisms |
| /api/token/ | axiosInstance (JWT) | Not found in frontend | Unused JWT endpoint |
| All other endpoints | apiClient (session) | All components | Inconsistent with JWT setup |

### Security Risks
| Risk | Details | Impact |
|-------|---------|--------|
| Mixed authentication | Both session and JWT configured inconsistently | Authentication bypass possible |
| Hardcoded production URLs | IPs exposed in source code | Security exposure |
| CORS permissive settings | CORS_ALLOW_ALL_ORIGINS=True | Cross-origin attacks |
