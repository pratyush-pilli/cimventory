# Code-Accurate Technical Documentation Facts

## 1) Repo Map

```
purchase_module/
├── purchase_module/           # Django project settings
│   ├── settings.py          # Main configuration
│   ├── urls.py             # URL routing
│   ├── wsgi.py             # WSGI application
│   └── asgi.py             # ASGI application
├── administrator/           # Admin panel app
│   ├── models.py           # Empty (60 bytes)
│   ├── views.py           # Admin views (53KB)
│   └── management/        # Not found
├── factory/               # Factory data module
│   ├── models.py          # Factory models (9.7KB)
│   ├── views.py           # Factory views (41KB)
│   ├── urls.py           # Factory URLs
│   └── serializers.py    # Factory serializers (4.8KB)
├── indent/                # Requisition management
│   ├── models.py          # Requisition models (8.6KB)
│   ├── views.py           # Requisition views (109KB)
│   └── management/       # Not found
├── items/                 # Item master database
│   ├── models.py          # Item models (9.9KB)
│   ├── views.py           # Item views (119KB)
│   └── management/       # Commands for data import
│       └── commands/
│           ├── import_categories.py
│           ├── import_makes.py
│           ├── import_types.py
│           └── upload_excel_items.py (26KB)
├── master/                # Master verification
│   ├── models.py          # Master models (4.5KB)
│   ├── views.py           # Master views (67KB)
│   └── signals.py        # Master signals (2.9KB)
├── purchase_order/        # Purchase order system
│   ├── models.py          # PO models (9.3KB)
│   ├── views.py           # PO views (99KB)
│   └── templates/         # PO templates
├── store/                 # Inventory management
│   ├── models.py          # Store models (29KB)
│   ├── views.py           # Store views (146KB)
│   └── management/       # Stock import commands
│       └── commands/
│           ├── import_inventory_csv.py
│           ├── import_stock.py (12.6KB)
│           └── populate_project_codes.py
├── users/                 # User management
│   ├── models.py          # User models (2.5KB)
│   ├── views.py           # User views (5.4KB)
│   └── management/       # Not found
├── vendor/                # Vendor management
│   ├── models.py          # Vendor models (3.6KB)
│   ├── views.py           # Vendor views (104KB)
│   └── management/       # Not found
└── manage.py              # Django management script

frontend/
├── src/
│   ├── Components/        # React components by feature
│   │   ├── Admin/       # Admin components
│   │   ├── Approval/    # Approval workflows
│   │   ├── Home/        # Dashboard
│   │   ├── Indent/      # Requisition forms
│   │   ├── Items/       # Item management
│   │   ├── Login/       # Authentication
│   │   ├── Master/      # Master verification
│   │   ├── PurchaseOrder/ # PO management
│   │   ├── Shared/      # Reusable components
│   │   ├── Store/       # Inventory management
│   │   └── Vendor/      # Vendor management
│   ├── config/           # Frontend configuration
│   │   └── roleConfig.ts  # Role-based access
│   ├── services/         # API service layer
│   │   └── poService.ts  # PO API service
│   ├── utils/            # Utility functions
│   │   └── axios.ts      # Axios instance
│   ├── App.tsx           # Main router
│   └── configuration.ts   # API configuration
├── package.json          # Frontend dependencies
└── dist/               # Build output

templates/               # Django templates
migrations/              # SQL migrations
├── 0001_add_rejected_by_column.sql (126 bytes)
```

**Folder Contents:**
- **Django apps**: administrator, factory, indent, items, master, purchase_order, store, users, vendor
- **React routes/pages**: Defined in App.tsx with role-based access
- **Shared utilities**: src/utils/, src/services/
- **Configs**: purchase_module/settings.py, src/configuration.ts, src/config/roleConfig.ts

## 2) Backend (Django) — Settings & Runtime

### INSTALLED_APPS
```python
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    'administrator',
    'indent',
    'master',
    'users',
    'vendor',
    'purchase_order',
    'store',
    'items',
    'factory',
    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt',
    'drf_yasg',
]
```

### Middleware List
```python
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
```

### Auth Configuration
```python
AUTH_USER_MODEL = 'users.CustomUser'

SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=5),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=1),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}

REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework.authentication.SessionAuthentication',
    ],
}
```

### CORS Settings
```python
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://199.199.50.190:8000",
    'http://199.199.50.190:3000',
    "http://199.199.50.128:8000",
    'http://199.199.50.128:3000',
    "http://199.199.51.226:8000",
    "http://199.199.51.226:3000",
]

CORS_ALLOW_ALL_ORIGINS = True
CORS_ALLOW_CREDENTIALS = True
```

### DB Settings
```python
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': 'purchase',
        'USER': 'pratyush',
        'PASSWORD': '<REDACTED>',
        'HOST': '199.199.50.190',
        'PORT': '5432',
    }
}
```

### Static/Media Configs
```python
STATIC_URL = '/static/'
STATIC_ROOT = os.path.join(BASE_DIR, 'staticfiles')
MEDIA_URL = '/media/'
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
```

### Logging Config
Not found in settings.py - No custom logging configuration

### Email Config
```python
EMAIL_HOST = 'smtp.office365.com'
EMAIL_PORT = 587
EMAIL_HOST_USER = 'purchase.notifications@cimconautomation.com'
EMAIL_HOST_PASSWORD = '<REDACTED>'
```

### Management Commands
**Items app:**
- `import_categories.py` - Import item categories
- `import_makes.py` - Import item makes
- `import_types.py` - Import item types
- `upload_excel_items.py` - Upload items from Excel

**Store app:**
- `import_inventory_csv.py` - Import inventory from CSV
- `import_stock.py` - Import stock data (12.6KB)
- `populate_project_codes.py` - Populate project codes

### Cron/Celery Usage
Not found in repo - No Celery configuration or cron jobs

## 3) Backend — URL Map (Full)

### Main URLs (purchase_module/urls.py)

| METHOD | PATH | VIEW | FILE | AUTH | Notes |
|---------|-------|------|------|------|-------|
| GET | swagger/ | schema_view | drf_yasg | Public | API documentation |
| GET | redoc/ | schema_view | drf_yasg | Public | API documentation |
| POST | api/login/ | LoginView | users/views | CSRF exempt | User login |
| POST | api/token/ | CustomTokenObtainPairView | users/views | Session auth | JWT token |
| POST | create-project/ | create_project | indent/views | - | Create project |
| POST | requisitions/save/ | save_requisition | indent/views | - | Save requisition |
| PUT | requisitions/update/<int:requisition_id>/ | update_requisition | indent/views | - | Update requisition |
| DELETE | requisitions/delete/<int:requisition_id>/ | delete_requisition | indent/views | - | Delete requisition |
| POST | requisitions/batch-approve/ | batch_approve_requisitions | indent/views | - | Batch approve |
| POST | requisitions/batch-reject/ | batch_reject_requisitions | indent/views | - | Batch reject |
| POST | master/generate-po/ | generate_po | master/views | - | Generate PO |
| POST | verify-and-create-master/ | verify_and_create_master | master/views | - | Verify master |
| POST | save-po/ | save_po | purchase_order/views | - | Save PO |
| GET | get-latest-po-number/ | get_latest_po_number | purchase_order/views | - | Get PO number |
| GET | purchase-orders/<str:po_number>/ | get_purchase_order_details | purchase_order/views | - | PO details |
| GET | pending-approval/ | get_pending_pos | purchase_order/views | - | Pending POs |
| POST | approve/<str:po_number>/ | approve_po | purchase_order/views | - | Approve PO |
| POST | reject/<str:po_number>/ | reject_po | purchase_order/views | - | Reject PO |
| GET | inventory/ | get_inventory | store/views | - | Get inventory |
| POST | save_inward/ | save_inward_entry | store/views | - | Save inward |
| POST | allocate/ | allocate_stock | store/views | - | Allocate stock |
| POST | outward/ | outward_stock | store/views | - | Outward stock |
| POST | request-item/ | request_item | items/views | - | Request item |
| GET | item-requests/ | get_item_requests | items/views | - | Get item requests |
| POST | vendors/ | create_vendor | vendor/views | - | Create vendor |
| GET | vendors/pending/ | get_pending_vendors | vendor/views | - | Pending vendors |
| POST | vendors/<int:vendor_id>/approve/ | approve_vendor | vendor/views | - | Approve vendor |

### DRF Router Registrations
```python
router.register(r'requisitions', RequisitionViewSet, basename='requisition')
router.register(r'projects', ProjectViewSet, basename='project')
router.register('master', MasterViewSet, basename='master')
router.register(r'vendors', VendorViewSet)
router.register(r'requisition-history', RequisitionHistoryViewSet)
router.register(r'project-codes', ProjectCodeViewSet)
router.register(r'po-line-items', POLineItemViewSet, basename='po-line-items')
```

### Factory URLs (factory/urls.py)

| METHOD | PATH | VIEW | FILE | AUTH | Notes |
|---------|-------|------|------|------|-------|
| GET | factory/get-factory-mpns/ | get_factory_mpns | factory/views | - | Get factory MPNs |
| POST | factory/create-factory-mpn/ | create_factory_mpn | factory/views | - | Create factory MPN |
| POST | factory/submit-factory-item/ | submit_factory_item_request | factory/views | - | Submit factory item |
| GET | factory/products/ | get_factory_products | factory/views | - | Get factory products |

## 4) Backend — Data Models (Full ER Detail)

### Users App Models

#### Division (users/models.py)
- **division_name**: CharField(max_length=255)
- **__str__**: Returns division_name

#### CustomUser (users/models.py)
- **role**: CharField(max_length=20, choices=[('Requisitor','Requisitor'),('Approver','Approver'),('Developer','Developer')])
- **division**: ForeignKey(Division, on_delete=CASCADE, related_name='custom_users')
- **groups**: ManyToManyField('auth.Group', related_name='custom_user_groups', blank=True)
- **user_permissions**: ManyToManyField('auth.Permission', related_name='custom_user_permissions', blank=True)
- **Methods**: get_full_name(), __str__()

#### RolePermission (users/models.py)
- **role_name**: CharField(max_length=50, unique=True, db_index=True)
- **description**: TextField(blank=True, null=True)
- **allowed_paths**: JSONField(default=list)
- **is_active**: BooleanField(default=True)
- **created_at**: DateTimeField(auto_now_add=True)
- **updated_at**: DateTimeField(auto_now=True)
- **Meta**: db_table='role_permissions', ordering=['role_name']

### Indent App Models

#### Project (indent/models.py)
- **project_code**: CharField(max_length=50, unique=True, primary_key=True)
- **client_project_name**: CharField(max_length=255, db_index=True)
- **bill_to**: TextField(null=True, blank=True)
- **ship_to**: TextField(null=True, blank=True)
- **approved_by**: CharField(max_length=255)
- **submitted_by**: CharField(max_length=255)
- **requested_by**: CharField(max_length=255)
- **division**: ForeignKey(Division, on_delete=CASCADE, related_name='project', db_index=True)
- **Meta**: indexes=[models.Index(fields=['project_code', 'division'])]

#### Requisition (indent/models.py)
- **project**: ForeignKey(Project, on_delete=CASCADE, related_name="requisitions", null=True, blank=True, db_index=True)
- **batch_id**: CharField(max_length=50, db_index=True)
- **item_no**: PositiveIntegerField(blank=True, null=True)
- **cimcon_part_number**: CharField(max_length=17, blank=True, null=True, db_index=True)
- **mfg_part_number**: CharField(max_length=255, blank=True, null=True)
- **material_description**: TextField(blank=True, null=True)
- **make**: CharField(max_length=255, blank=True, null=True)
- **material_group**: CharField(max_length=100, blank=True, null=True)
- **req_qty**: PositiveIntegerField(blank=True, null=True)
- **unit**: CharField(max_length=50, blank=True, null=True)
- **OrderType**: TextChoices (SUP='SUP', ITC='ITC', ONM='ONM', CON='CON', FRE='FRE', SER='SER')

### Items App Models

#### MainCategory (items/models.py)
- **id**: IntegerField(primary_key=True)
- **name**: CharField(max_length=100, unique=True, db_index=True)
- **code**: CharField(max_length=3, unique=True, db_index=True)
- **Meta**: indexes=[models.Index(fields=['name']), models.Index(fields=['code'])]

#### SubCategory (items/models.py)
- **main_category**: ForeignKey(MainCategory, on_delete=CASCADE, related_name="subcategories", null=True, blank=True, db_index=True)
- **name**: CharField(max_length=100, db_index=True)
- **code**: CharField(max_length=3, db_index=True)
- **Meta**: unique_together=('main_category', 'code')

#### ItemMaster (items/models.py)
- **name**: CharField(max_length=255, db_index=True)
- **description**: TextField(blank=True, null=True)
- **main_category**: ForeignKey(MainCategory, on_delete=CASCADE, related_name="items", null=True, blank=True, db_index=True)
- **sub_category**: ForeignKey(SubCategory, on_delete=CASCADE, related_name="items", null=True, blank=True, db_index=True)
- **cimcon_part_no**: CharField(max_length=17, unique=True, db_index=True)
- **alternate_no**: CharField(max_length=16, null=True, blank=True, db_index=True)
- **mfg_part_no**: CharField(max_length=255, blank=True, null=True, db_index=True)

### Store App Models

#### Inventory (store/models.py)
- **inward_entry**: ForeignKey('InwardEntry', on_delete=CASCADE, related_name='inventory_entries', null=True, blank=True, db_index=True)
- **material_group**: CharField(max_length=150, blank=True, null=True, db_index=True)
- **item_no**: CharField(max_length=150, blank=True, null=True, db_index=True)
- **description**: TextField(blank=True, null=True)
- **make**: CharField(max_length=130, blank=True, null=True, db_index=True)
- **opening_stock**: DecimalField(max_digits=10, decimal_places=2, default=0)
- **allocated_stock**: DecimalField(max_digits=10, decimal_places=2, default=0, db_index=True)
- **available_stock**: DecimalField(max_digits=10, decimal_places=2, default=0, db_index=True)
- **total_stock**: DecimalField(max_digits=10, decimal_places=2, default=0, db_index=True)
- **times_sq_stock**: DecimalField(max_digits=10, decimal_places=2, default=0)
- **i_sq_stock**: DecimalField(max_digits=10, decimal_places=2, default=0)
- **sakar_stock**: DecimalField(max_digits=10, decimal_places=2, default=0)
- **pirana_stock**: DecimalField(max_digits=10, decimal_places=2, default=0)
- **other_stock**: DecimalField(max_digits=10, decimal_places=2, default=0)
- **remarks**: TextField(blank=True, null=True)
- **Methods**: calculate_available_stock(), get_allocated_stock(), update_master_soh(), calculate_total_stock()

### Purchase Order App Models

#### PurchaseOrder (purchase_order/models.py)
- **po_number**: CharField(max_length=100, unique=True)
- **po_date**: DateField(default=timezone.now)
- **quote_ref_number**: CharField(max_length=100, blank=True, null=True)
- **project_code**: CharField(max_length=100, blank=True, null=True)
- **version**: DecimalField(max_digits=3, decimal_places=1, default=1.0)
- **vendor_name**: CharField(max_length=200)
- **vendor_address**: TextField()
- **vendor_email**: EmailField(blank=True, null=True)
- **total_amount**: DecimalField(max_digits=12, decimal_places=2)
- **status**: CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
- **approval_status**: BooleanField(default=False)
- **rejection_status**: BooleanField(default=False)

### Vendor App Models

#### Vendor (vendor/models.py)
- **vendor_id**: CharField(max_length=20, null=True)
- **product_category**: CharField(max_length=255)
- **vendor_name**: CharField(max_length=255)
- **contact_person**: CharField(max_length=255, blank=True, null=True)
- **mobile_no_1**: CharField(max_length=20, blank=True, null=True)
- **email_1**: EmailField(max_length=255, blank=True, null=True)
- **address**: TextField(blank=True, null=True)
- **gst_number**: CharField(max_length=15, blank=True, null=True)
- **pan_number**: CharField(max_length=10, blank=True, null=True)
- **status**: CharField(max_length=10, choices=STATUS_CHOICES, default='pending')
- **File fields**: udyam_certificate_msme, gst_certificate, incorporation_certificate, cancelled_cheque, pan_card, tan_allotment_letter, vendor_reg_form

### Factory App Models

#### FactoryProduct (factory/models.py)
- **productid**: AutoField(primary_key=True)
- **productname**: CharField(max_length=255, db_index=True)
- **productcode**: CharField(max_length=255, unique=True, db_index=True)
- **Meta**: db_table='factory_products', ordering=['productname']

#### FactoryMake (factory/models.py)
- **makeid**: AutoField(primary_key=True)
- **productid**: ForeignKey(FactoryProduct, on_delete=CASCADE, related_name='makes', db_column='productid')
- **makename**: CharField(max_length=255, db_index=True)
- **makecode**: CharField(max_length=255, db_index=True)
- **Meta**: unique_together=('productid', 'makecode')

### ER Diagram (Text)
```
Division (1) ←→ (M) CustomUser
Division (1) ←→ (M) Project
Project (1) ←→ (M) Requisition
MainCategory (1) ←→ (M) SubCategory
MainCategory (1) ←→ (M) ItemMaster
Inventory (1) ←→ (M) StockAllocation
PurchaseOrder (1) ←→ (M) POLineItem
FactoryProduct (1) ←→ (M) FactoryMake
```

## 5) Backend — Business Workflows (Code-traced)

### Requisition Create → Approve/Reject → Master Verification
**API Endpoints:**
- POST /requisitions/save/ (save_requisition)
- POST /requisitions/batch-approve/ (batch_approve_requisitions)
- POST /requisitions/batch-reject/ (batch_reject_requisitions)
- POST /verify-and-create-master/ (verify_and_create_master)

**Views Involved:**
- indent/views.py: save_requisition()
- indent/views.py: batch_approve_requisitions()
- master/views.py: verify_and_create_master()

**Database Updates:**
- Requisition.created (status field)
- Master.created (from requisition data)
- RequisitionHistory.created (revision tracking)

### Master → PO Generation → PO Approve/Reject
**API Endpoints:**
- POST /master/generate-po/ (generate_po)
- POST /approve/<str:po_number>/ (approve_po)
- POST /reject/<str:po_number>/ (reject_po)

**Views Involved:**
- master/views.py: generate_po()
- purchase_order/views.py: approve_po()
- purchase_order/views.py: reject_po()

**Status Changes:**
- PurchaseOrder.status: draft → pending_approval → approved/rejected
- PurchaseOrder.approval_status: False → True
- PurchaseOrder.rejection_status: False → True

### Vendor Registration → Approve/Reject
**API Endpoints:**
- POST /vendors/ (create_vendor)
- POST /vendors/<int:vendor_id>/approve/ (approve_vendor)
- POST /vendors/<int:vendor_id>/reject/ (reject_vendor)

**Views Involved:**
- vendor/views.py: create_vendor()
- vendor/views.py: approve_vendor()
- vendor/views.py: reject_vendor()

**Status Changes:**
- Vendor.status: pending → approved/rejected

### Inward Entry → Inventory Update
**API Endpoints:**
- POST /save_inward/ (save_inward_entry)

**Views Involved:**
- store/views.py: save_inward_entry()

**Database Updates:**
- InwardEntry.created
- Inventory.updated (stock calculations via save() method)

### Stock Allocation → Outward → Gate Pass/Return
**API Endpoints:**
- POST /allocate/ (allocate_stock)
- POST /outward/ (outward_stock)
- POST /gate-pass/create/ (create_returnable_gate_pass)

**Views Involved:**
- store/views.py: allocate_stock()
- store/views.py: outward_stock()
- store/views.py: create_returnable_gate_pass()

**Database Updates:**
- StockAllocation.created (status='allocated')
- StockOutward.created
- ReturnableGatePass.created

## 6) Frontend — Routes, Pages, and Role-based Navigation

### Routes (App.tsx)
| PATH | COMPONENT | FILE | AUTH GUARD |
|------|-----------|-------|------------|
| / | Login | Components/Login/login | Public |
| /home | HomePage | Components/Home/home | checkAccess() |
| /requisition-form | RequisitionForm | Components/Indent/requisition_form | checkAccess() |
| /approval-table | ApprovalTable | Components/Approval/approval | checkAccess() |
| /master-table | MasterSheet | Components/Master/master | checkAccess() |
| /inventory | InventoryForm | Components/Store/Inventory/inventory | checkAccess() |
| /allocate | Allocate | Components/Store/Allocate/Allocate | checkAccess() |
| /outward | OutwardStock | Components/Store/Outward/outward | checkAccess() |
| /vendor-registration | VendorRegistration | Components/Vendor/VendorRegistration | checkAccess() |
| /vendor-approval | VendorApproval | Components/Vendor/VendorApproval | checkAccess() |
| /item-generator | ItemGenerator | Components/Items/ItemGenerator | checkAccess() |
| /item-approval | ItemApproval | Components/Items/ItemApproval | checkAccess() |
| /po-approval | POApproval | Components/PurchaseOrder/Approval/POApproval | checkAccess() |

### Role-based Navigation (config/roleConfig.ts)
```typescript
const roleBasedAccess = {
  Requisitor: {
    allowedPaths: [
      "/home", "/requisition-form", "/edit-requisition", 
      "/inventory", "/master-table", "/PO", "/vendor-data", 
      "/item-data", "/item-generator"
    ]
  },
  Approver: {
    allowedPaths: [
      "/home", "/approval-table", "/inventory", "/master-table", 
      "/PO", "/vendor-data", "/item-data"
    ]
  },
  Purchaser: {
    allowedPaths: [
      "/home", "/master-table", "/PO", "/vendor-registration", 
      "/vendor-data", "/item-data", "/item-generator"
    ]
  },
  Admin: { allowedPaths: "all" },
  Developer: { allowedPaths: "all" }
}
```

### Auth Guard Logic (App.tsx)
```typescript
const checkAccess = (path: string) => {
  const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
  const role = userInfo.role;
  if (role === "Admin" || role === "Developer") return true;
  const allowedPaths = roleBasedAccess[role]?.allowedPaths;
  return allowedPaths?.includes(path) || false;
};
```

## 7) Frontend — API Service Layer Mapping

### Service Files
- **src/services/poService.ts** - PO-related API calls
- **src/utils/axios.ts** - Axios instance with interceptors
- **src/configuration.ts** - API configuration

### poService.ts Functions
```typescript
getNextPONumber: async (vendorName: string) => {
  // GET /po/next-number/ with vendor_name param
  // Returns: response.data.po_number
}
```

### Axios Configuration (utils/axios.ts)
```typescript
const axiosInstance = axios.create({
  baseURL: "http://199.199.50.128:8000"
});

// Request interceptor adds Bearer token from localStorage
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Base URL Configuration (configuration.ts)
```typescript
const config = {
  api_url: "http://199.199.50.190:8001/",
};

export const apiClient = axios.create({
  baseURL: config.api_url,
  withCredentials: true,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
});
```

### Component → Service → Endpoint Mapping
| Component | Service Method | Backend Endpoint |
|-----------|----------------|------------------|
| PO Components | poService.getNextPONumber() | GET /po/next-number/ |
| All Components | apiClient (axios) | Various endpoints via baseURL |

## 8) Database & Constraints Summary

### Main Tables
- users_customuser
- users_division  
- users_rolepermission
- indent_project
- indent_requisition
- items_maincategory
- items_subcategory
- items_itemmaster
- store_inventory
- store_stockallocation
- store_inwardentry
- purchase_order_purchaseorder
- purchase_order_polineitem
- vendor_vendor
- factory_factoryproduct
- factory_factorymake

### Important Indexes
- Inventory: item_no, material_group, make, total_stock, available_stock
- Requisition: batch_id, cimcon_part_number, project
- ItemMaster: cimcon_part_no, main_category, sub_category
- Project: project_code, division

### Referential Constraints
- CustomUser.division → Division.id
- Requisition.project → Project.project_code
- ItemMaster.main_category → MainCategory.id
- Inventory.inward_entry → InwardEntry.id
- PurchaseOrder related fields via foreign keys

### Raw SQL Migrations
- migrations/0001_add_rejected_by_column.sql (126 bytes)

## 9) Deployment / Run Instructions

### From README.md
**Backend Setup:**
```bash
cd purchase_module/purchase_module
virtualenv my_env
source my_env/bin/activate
pip install -r requirements.txt
python manage.py runserver 199.199.50.190:3456
```

**Frontend Setup:**
```bash
cd frontend
npm install
npm run build
serve -s dist -p 3465
```

**Database:**
```bash
docker-compose up -d db  # PostgreSQL on port 5434
```

### Ports Used
- Backend: 3456 (Django runserver)
- Frontend: 3465 (serve)
- Database: 5432/5434 (PostgreSQL)
- API Base URLs: 8000, 8001, 128:8000, 190:8000

### Build Commands
- Frontend: `npm run build`
- Backend: `python manage.py runserver`
- Static files: `python manage.py collectstatic`

## 10) Security Findings (Evidence-based)

### Hardcoded Secrets
**File:** purchase_module/purchase_module/settings.py
- **Line 26:** `SECRET_KEY = 'django-insecure-$q&t29v0vi6ziq41u4a$ah42c+uqvjm$8df-3i)=5)s1wtkc&2'`
- **Line 40:** `EMAIL_HOST_PASSWORD = 'cimcon@1987'`
- **Line 183:** `PASSWORD = 'pratyush'` (database password)

### Debug Mode in Production
**File:** purchase_module/purchase_module/settings.py
- **Line 29:** `DEBUG = True` - Should be False in production

### Permissive CORS Configuration
**File:** purchase_module/purchase_module/settings.py
- **Line 121:** `CORS_ALLOW_ALL_ORIGINS = True` - Allows all origins
- **Lines 97-106:** Multiple specific origins including localhost

### CSRF Configuration Issues
**File:** purchase_module/purchase_module/settings.py
- **Line 137:** `CSRF_COOKIE_SECURE = False` - Should be True with HTTPS
- **Line 114:** `csrf_exempt(LoginView.as_view())` - Login endpoint bypasses CSRF

### Missing Permission Checks
**File:** purchase_module/purchase_module/urls.py
- **Line 92:** `permission_classes=(permissions.AllowAny,)` for Swagger docs
- Multiple endpoints lack explicit permission decorators in views

### File Upload Validation
**File:** purchase_module/purchase_module/vendor/models.py
- **Lines 36-77:** Multiple FileField fields with minimal validation
- **vendor_document_path() function:** Basic path sanitization only
