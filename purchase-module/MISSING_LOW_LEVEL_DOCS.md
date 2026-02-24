# Missing Low-Level Documentation Facts

## 1) Model Completion — Extract ALL Remaining Model Fields (Exhaustive)

### indent/models.py

#### Project
- **project_code**: CharField(max_length=50, unique=True, primary_key=True)
- **client_project_name**: CharField(max_length=255, db_index=True)
- **bill_to**: TextField(null=True, blank=True)
- **ship_to**: TextField(null=True, blank=True)
- **approved_by**: CharField(max_length=255)
- **submitted_by**: CharField(max_length=255)
- **requested_by**: CharField(max_length=255)
- **division**: ForeignKey(Division, on_delete=CASCADE, related_name='project', db_index=True)
- **Meta**: indexes=[models.Index(fields=['project_code', 'division'])]
- **Methods**: get_required_items() - returns approved requisitions with quantities

#### Requisition
- **project**: ForeignKey(Project, on_delete=CASCADE, related_name="requisitions", null=True, blank=True, db_index=True)
- **batch_id**: CharField(max_length=50, db_index=True)
- **item_no**: PositiveIntegerField(blank=True, null=True)
- **cimcon_part_number**: CharField(max_length=17, blank=True, null=True, db_index=True, validators=[RegexValidator(r'^[A-Za-z0-9]{14,}$')])
- **mfg_part_number**: CharField(max_length=255, blank=True, null=True)
- **material_description**: TextField(blank=True, null=True)
- **make**: CharField(max_length=255, blank=True, null=True)
- **material_group**: CharField(max_length=100, blank=True, null=True)
- **req_qty**: PositiveIntegerField(blank=True, null=True)
- **unit**: CharField(max_length=50, blank=True, null=True)
- **required_by_date**: DateField(null=True, blank=True)
- **remarks**: TextField(null=True, blank=True)
- **approved_status**: BooleanField(default=False, db_index=True)
- **verification_status**: BooleanField(default=False)
- **master_entry_exists**: BooleanField(default=False)
- **requisition_date**: DateField(default=datetime.date)
- **submitted_by**: CharField(max_length=50, blank=True, null=True)
- **status**: CharField(max_length=20, choices=[('pending','Pending'),('approved','Approved'),('rejected','Rejected')], default='pending', db_index=True)
- **rejection_remarks**: TextField(null=True, blank=True)
- **order_type**: CharField(max_length=3, choices=OrderType.choices, default=OrderType.SUPPLY)
- **Managers**: objects=DivisionManager(), all_objects=models.Manager()
- **Meta**: ordering=['-id'], indexes=[models.Index(fields=['batch_id','status']), models.Index(fields=['project','approved_status']), models.Index(fields=['cimcon_part_number','status'])]
- **Methods**: save(), get_division(), get_required_items()

#### RequisitionHistory
- **requisition**: ForeignKey(Requisition, on_delete=CASCADE, db_index=True)
- **field_name**: CharField(max_length=255, db_index=True)
- **old_value**: TextField(null=True, blank=True)
- **new_value**: TextField(null=True, blank=True)
- **changed_by**: CharField(max_length=255, null=True, blank=True)
- **approved_by**: CharField(max_length=255, null=True, blank=True)
- **changed_at**: DateTimeField(auto_now_add=True, db_index=True)
- **revision_number**: IntegerField()
- **remarks**: TextField(null=True, blank=True)
- **Meta**: indexes=[models.Index(fields=['requisition','field_name']), models.Index(fields=['changed_at','field_name'])]
- **Methods**: is_approved (property), log_change() (classmethod), approve(), get_change_description()

### items/models.py

#### MainCategory
- **id**: IntegerField(primary_key=True)
- **name**: CharField(max_length=100, unique=True, db_index=True)
- **code**: CharField(max_length=3, unique=True, db_index=True)
- **Meta**: indexes=[models.Index(fields=['name']), models.Index(fields=['code'])]

#### SubCategory
- **main_category**: ForeignKey(MainCategory, on_delete=CASCADE, related_name="subcategories", null=True, blank=True, db_index=True)
- **name**: CharField(max_length=100, db_index=True)
- **code**: CharField(max_length=3, db_index=True)
- **Meta**: unique_together=('main_category','code'), indexes=[models.Index(fields=['main_category','code']), models.Index(fields=['name'])]

#### ProductRating
- **main_category**: ForeignKey(MainCategory, on_delete=CASCADE, related_name="product_ratings", null=True, blank=True, db_index=True)
- **sub_category**: ForeignKey(SubCategory, on_delete=CASCADE, related_name="product_ratings", null=True, blank=True, db_index=True)
- **name**: CharField(max_length=1000, db_index=True)
- **code**: CharField(max_length=3, db_index=True)
- **Meta**: unique_together=('main_category','sub_category','code'), indexes=[models.Index(fields=['main_category','code']), models.Index(fields=['sub_category','code'])]

#### Make
- **main_category**: ForeignKey(MainCategory, on_delete=CASCADE, related_name="makes", null=True, blank=True, db_index=True)
- **name**: CharField(max_length=500, db_index=True)
- **code**: CharField(max_length=2, db_index=True)
- **Meta**: unique_together=('main_category','code'), indexes=[models.Index(fields=['main_category','code']), models.Index(fields=['name'])]

#### ProductModel
- **main_category**: ForeignKey(MainCategory, on_delete=CASCADE, related_name="product_models", null=True, blank=True, db_index=True)
- **name**: CharField(max_length=100, db_index=True)
- **code**: CharField(max_length=3, db_index=True)
- **Meta**: unique_together=('main_category','code'), indexes=[models.Index(fields=['main_category','code']), models.Index(fields=['name'])]

#### Remarks
- **main_category**: ForeignKey(MainCategory, on_delete=CASCADE, related_name="remarks", null=True, blank=True, db_index=True)
- **description**: CharField(max_length=255, db_index=True)
- **code**: CharField(max_length=4, db_index=True)
- **Meta**: indexes=[models.Index(fields=['main_category','code']), models.Index(fields=['description'])]

#### ItemMaster
- **name**: CharField(max_length=255, db_index=True)
- **description**: TextField(blank=True, null=True)
- **main_category**: ForeignKey(MainCategory, on_delete=CASCADE, related_name="items", null=True, blank=True, db_index=True)
- **sub_category**: ForeignKey(SubCategory, on_delete=CASCADE, related_name="items", null=True, blank=True, db_index=True)
- **product_rating**: ForeignKey(ProductRating, on_delete=CASCADE, null=True, blank=True, related_name="items", db_index=True)
- **make**: ForeignKey(Make, on_delete=CASCADE, related_name="items", null=True, blank=True, db_index=True)
- **product_model**: ForeignKey(ProductModel, on_delete=CASCADE, related_name="items", null=True, blank=True, db_index=True)
- **remarks**: ForeignKey(Remarks, on_delete=CASCADE, related_name="items", blank=True, null=True, db_index=True)
- **cimcon_part_no**: CharField(max_length=17, unique=True, db_index=True)
- **alternate_no**: CharField(max_length=16, null=True, blank=True, db_index=True)
- **mfg_part_no**: CharField(max_length=255, blank=True, null=True, db_index=True)
- **package**: CharField(max_length=255, blank=True, null=True)
- **uom**: CharField(max_length=255, blank=True, null=True)
- **moq**: IntegerField(blank=True, null=True)
- **mfg_std_lead_time**: IntegerField(blank=True, null=True)
- **bin**: CharField(max_length=255, blank=True, null=True)
- **hsn_code**: CharField(max_length=255, blank=True, null=True)
- **created_at**: DateTimeField(auto_now_add=True, null=True, blank=True, db_index=True)
- **updated_at**: DateTimeField(auto_now=True, null=True, blank=True, db_index=True)
- **is_active**: BooleanField(default=True, db_index=True)
- **item_image**: ImageField(upload_to='item_images/', blank=True, null=True)
- **document**: FileField(upload_to=item_file_path, blank=True, null=True)
- **document_name**: CharField(max_length=255, blank=True, null=True)
- **Meta**: indexes=[models.Index(fields=['cimcon_part_no']), models.Index(fields=['name']), models.Index(fields=['main_category','sub_category']), models.Index(fields=['make','product_model']), models.Index(fields=['created_at']), models.Index(fields=['is_active']), models.Index(fields=['mfg_part_no'])]

#### ItemRequest
- **requestor**: CharField(max_length=100, db_index=True)
- **status**: CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
- **created_at**: DateTimeField(auto_now_add=True, db_index=True)
- **updated_at**: DateTimeField(auto_now=True, db_index=True)
- **rejection_reason**: TextField(blank=True, null=True)
- **productName**: CharField(max_length=255, db_index=True)
- **productCode**: CharField(max_length=3, db_index=True)
- **mfgPartNo**: CharField(max_length=255, db_index=True)
- **mfgPartCode**: CharField(max_length=3, db_index=True)
- **itemDescription**: TextField()
- **itemCode**: CharField(max_length=4, db_index=True)
- **make**: CharField(max_length=100, db_index=True)
- **makeCode**: CharField(max_length=2, db_index=True)
- **type**: CharField(max_length=100, db_index=True)
- **typeCode**: CharField(max_length=2, db_index=True)
- **materialRating**: CharField(max_length=100, blank=True, null=True)
- **materialRatingCode**: CharField(max_length=3, blank=True, null=True)
- **package**: CharField(max_length=255, blank=True, null=True)
- **uom**: CharField(max_length=50, blank=True, null=True)
- **moq**: IntegerField(blank=True, null=True)
- **leadTime**: IntegerField(blank=True, null=True)
- **hsnCode**: CharField(max_length=50, blank=True, null=True)
- **bin**: CharField(max_length=50, blank=True, null=True)
- **cimcon_part_no**: CharField(max_length=50, db_index=True)
- **document**: FileField(upload_to=item_file_path, blank=True, null=True)
- **document_name**: CharField(max_length=255, blank=True, null=True)
- **Meta**: indexes=[models.Index(fields=['status','created_at']), models.Index(fields=['requestor','status']), models.Index(fields=['cimcon_part_no']), models.Index(fields=['productCode','makeCode'])]

### store/models.py

#### ProjectCode
- **code**: ForeignKey(Project, on_delete=CASCADE, related_name="store", null=True, blank=True, db_index=True)
- **name**: CharField(max_length=200, db_index=True)
- **Meta**: indexes=[models.Index(fields=['name']), models.Index(fields=['code'])]

#### Inventory
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
- **Meta**: indexes=[models.Index(fields=['item_no']), models.Index(fields=['material_group']), models.Index(fields=['make']), models.Index(fields=['total_stock','available_stock']), models.Index(fields=['item_no','material_group'])]
- **Methods**: outward_stock (property), calculate_available_stock(), get_allocated_stock(), get_remaining_stock(), update_master_soh(), calculate_total_stock(), save(), get_location_stock_details()

#### LocationWiseAllocation
- **stock_allocation**: ForeignKey('StockAllocation', on_delete=CASCADE, related_name='location_allocations', db_index=True)
- **location**: CharField(max_length=50, choices=[('times_sq_stock','Times Square'),('i_sq_stock','iSquare'),('sakar_stock','Sakar'),('pirana_stock','Pirana'),('other_stock','Other')], db_index=True)
- **quantity**: DecimalField(max_digits=10, decimal_places=2, db_index=True)
- **Meta**: indexes=[models.Index(fields=['stock_allocation','location']), models.Index(fields=['location','quantity'])]
- **Methods**: save() - updates inventory available stock

#### StockAllocation
- **inventory**: ForeignKey(Inventory, on_delete=CASCADE, related_name='allocations', db_index=True)
- **project_code**: ForeignKey(ProjectCode, on_delete=CASCADE, related_name='stock_allocations', db_index=True)
- **allocated_quantity**: DecimalField(max_digits=10, decimal_places=2, db_index=True)
- **allocation_date**: DateField(auto_now_add=True, db_index=True)
- **remarks**: TextField(blank=True, null=True)
- **is_partial**: BooleanField(default=False, db_index=True)
- **status**: CharField(max_length=20, choices=[('allocated','Allocated'),('partially_outward','Partially Outward'),('fully_outward','Fully Outward'),('cancelled','Cancelled')], default='allocated', db_index=True)
- **parent_allocation**: ForeignKey('self', null=True, blank=True, on_delete=SET_NULL, related_name='reallocations')
- **reallocation_date**: DateTimeField(null=True, blank=True)
- **reallocation_reason**: TextField(null=True, blank=True)
- **Meta**: indexes=[models.Index(fields=['inventory','status']), models.Index(fields=['project_code','status']), models.Index(fields=['allocation_date','status']), models.Index(fields=['inventory','project_code'])]
- **Methods**: save(), can_reallocate(), reallocate()

### purchase_order/models.py

#### PONumberSequence
- **financial_year**: CharField(max_length=4, unique=True)
- **last_sequence**: IntegerField(default=0)
- **Meta**: db_table='po_number_sequence'

#### PurchaseOrder
- **STATUS_CHOICES**: [('draft','Draft'),('pending_approval','Pending Approval'),('approved','Approved'),('rejected','Rejected'),('ordered','Ordered'),('partially_ordered','Partially Ordered'),('delivered','Delivered'),('partially_delivered','Partially Delivered'),('cancelled','Cancelled'),('on_hold','On Hold')]
- **po_number**: CharField(max_length=100, unique=True)
- **po_date**: DateField(default=timezone.now)
- **quote_ref_number**: CharField(max_length=100, blank=True, null=True)
- **project_code**: CharField(max_length=100, blank=True, null=True)
- **version**: DecimalField(max_digits=3, decimal_places=1, default=1.0)
- **vendor_name**: CharField(max_length=200)
- **vendor_address**: TextField()
- **vendor_email**: EmailField(blank=True, null=True)
- **vendor_gstin**: CharField(max_length=15, blank=True, null=True)
- **vendor_pan**: CharField(max_length=15, blank=True, null=True)
- **vendor_state**: CharField(max_length=100, blank=True, null=True)
- **vendor_state_code**: CharField(max_length=100, blank=True, null=True)
- **vendor_contact**: CharField(max_length=100, blank=True, null=True)
- **vendor_payment_terms**: TextField(blank=True, null=True)
- **total_amount**: DecimalField(max_digits=12, decimal_places=2)
- **vendor_code**: CharField(max_length=100, blank=True, null=True)
- **payment_terms**: TextField(default="100% Against Invoice")
- **warranty_terms**: TextField(default="1 year from date of invoice")
- **delivery_schedule**: TextField(default="1 week from date of Purchase order")
- **freight_terms**: TextField(default="Freight & Insurance Extra")
- **tpi_terms**: TextField(default="TPI Inspection Exclusive")
- **installation_terms**: TextField(default="Installation Exclusive")
- **commissioning**: TextField(default="Commissioning Exclusive")
- **consignee_name**: CharField(max_length=200, blank=True, null=True)
- **consignee_address**: TextField(blank=True, null=True)
- **consignee_mobile**: CharField(max_length=15, blank=True, null=True)
- **consignee_attention**: CharField(max_length=100, blank=True, null=True)
- **invoice_name**: CharField(max_length=200, blank=True, null=True)
- **invoice_address**: TextField(blank=True, null=True)
- **invoice_gstin**: CharField(max_length=15, blank=True, null=True)
- **status**: CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
- **notes**: TextField(blank=True, default="NA")
- **created_at**: DateTimeField(auto_now_add=True)
- **updated_at**: DateTimeField(auto_now=True)
- **created_by**: CharField(max_length=100, null=True)
- **inward_status**: CharField(max_length=20, choices=STATUS_CHOICES, default='open')
- **total_inwarded_quantity**: DecimalField(max_digits=10, decimal_places=2, default=0)
- **approval_status**: BooleanField(default=False)
- **rejection_status**: BooleanField(default=False)
- **approval_date**: DateTimeField(null=True, blank=True)
- **approved_by**: CharField(max_length=100, null=True, blank=True)
- **rejection_remarks**: TextField(null=True, blank=True)
- **rejected_by**: CharField(max_length=100, null=True, blank=True)
- **rejection_date**: DateTimeField(null=True, blank=True)
- **currency_code**: CharField(max_length=10)
- **currency_symbol**: CharField(max_length=10)
- **is_revised**: BooleanField(default=False)
- **revision_number**: IntegerField(default=1)
- **Meta**: db_table='purchase_orders', ordering=['-created_at']
- **Methods**: generate_po_number() (static), save(), increment_version()

#### POLineItem
- **purchase_order**: ForeignKey(PurchaseOrder, on_delete=CASCADE, related_name='line_items')
- **requisition_id**: IntegerField()
- **item_no**: CharField(max_length=100)
- **material_description**: TextField()
- **make**: CharField(max_length=100, null=True, blank=True)
- **material_group**: CharField(max_length=100, null=True, blank=True)
- **hsn_code**: CharField(max_length=20, null=True, blank=True)
- **quantity**: DecimalField(max_digits=10, decimal_places=2)
- **unit**: CharField(max_length=20)
- **unit_price**: DecimalField(max_digits=10, decimal_places=2)
- **total_price**: DecimalField(max_digits=12, decimal_places=2)
- **expected_delivery**: DateField(null=True, blank=True)
- **inwarded_quantity**: DecimalField(max_digits=10, decimal_places=2, default=0)
- **added_in_revision**: DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
- **is_revised**: BooleanField(default=False)
- **Meta**: db_table='po_line_items'
- **Methods**: save() - auto-calculates total_price

## 2) Enumerations & Status Fields (Exact Definitions)

### PurchaseOrder.STATUS_CHOICES
- **draft**: Draft
- **pending_approval**: Pending Approval
- **approved**: Approved
- **rejected**: Rejected
- **ordered**: Ordered
- **partially_ordered**: Partially Ordered
- **delivered**: Delivered
- **partially_delivered**: Partially Delivered
- **cancelled**: Cancelled
- **on_hold**: On Hold
- **Used in**: PurchaseOrder.status, PurchaseOrder.inward_status (purchase_order/models.py)

### Requisition.OrderType (TextChoices)
- **SUPPLY**: 'SUP', 'Supply'
- **ITC**: 'ITC', 'ITC'
- **ONM**: 'ONM', 'O&M'
- **CON**: 'CON', 'Contract'
- **FRE**: 'FRE', 'Freight'
- **SER**: 'SER', 'Service'
- **Used in**: Requisition.order_type (indent/models.py)

### Requisition.status choices
- **pending**: Pending
- **approved**: Approved
- **rejected**: Rejected
- **Used in**: Requisition.status (indent/models.py)

### ItemRequest.STATUS_CHOICES
- **draft**: Draft
- **pending**: Pending
- **approved**: Approved
- **rejected**: Rejected
- **Used in**: ItemRequest.status (items/models.py)

### StockAllocation.status choices
- **allocated**: Allocated
- **partially_outward**: Partially Outward
- **fully_outward**: Fully Outward
- **cancelled**: Cancelled
- **Used in**: StockAllocation.status (store/models.py)

### LocationWiseAllocation.location choices
- **times_sq_stock**: Times Square
- **i_sq_stock**: iSquare
- **sakar_stock**: Sakar
- **pirana_stock**: Pirana
- **other_stock**: Other
- **Used in**: LocationWiseAllocation.location (store/models.py)

## 3) ViewSets — Full Router Endpoint Expansion (Action Map)

### RequisitionViewSet
- **File**: indent/views.py
- **Actions**: list, retrieve, create, update, partial_update, destroy
- **Serializer**: RequisitionSerializer (assumed)
- **Permissions**: Not specified in router registration

### ProjectViewSet
- **File**: indent/views.py
- **Actions**: list, retrieve, create, update, partial_update, destroy
- **Serializer**: ProjectSerializer (assumed)
- **Permissions**: Not specified in router registration

### MasterViewSet
- **File**: master/views.py
- **Actions**: list, retrieve, create, update, partial_update, destroy
- **Serializer**: MasterSerializer (assumed)
- **Permissions**: Not specified in router registration

### VendorViewSet
- **File**: vendor/views.py
- **Actions**: list, retrieve, create, update, partial_update, destroy
- **Serializer**: VendorSerializer (assumed)
- **Permissions**: Not specified in router registration

### RequisitionHistoryViewSet
- **File**: indent/views.py
- **Actions**: list, retrieve, create, update, partial_update, destroy
- **Serializer**: RequisitionHistorySerializer (assumed)
- **Permissions**: Not specified in router registration

### ProjectCodeViewSet
- **File**: store/views.py
- **Actions**: list, retrieve, create, update, partial_update, destroy
- **Serializer**: ProjectCodeSerializer (assumed)
- **Permissions**: Not specified in router registration

### POLineItemViewSet
- **File**: purchase_order/views.py
- **Actions**: list, retrieve, create, update, partial_update, destroy
- **Serializer**: POLineItemSerializer (assumed)
- **Permissions**: Not specified in router registration

### Expanded Endpoint Table
| METHOD | PATH | ViewSet.action | File | Auth/Permission | Notes |
|---------|-------|----------------|-------|-----------------|-------|
| GET | /requisitions/ | RequisitionViewSet.list | indent/views.py | Session auth | Default DRF |
| POST | /requisitions/ | RequisitionViewSet.create | indent/views.py | Session auth | Default DRF |
| GET | /requisitions/{id}/ | RequisitionViewSet.retrieve | indent/views.py | Session auth | Default DRF |
| PUT | /requisitions/{id}/ | RequisitionViewSet.update | indent/views.py | Session auth | Default DRF |
| PATCH | /requisitions/{id}/ | RequisitionViewSet.partial_update | indent/views.py | Session auth | Default DRF |
| DELETE | /requisitions/{id}/ | RequisitionViewSet.destroy | indent/views.py | Session auth | Default DRF |
| GET | /projects/ | ProjectViewSet.list | indent/views.py | Session auth | Default DRF |
| POST | /projects/ | ProjectViewSet.create | indent/views.py | Session auth | Default DRF |
| GET | /master/ | MasterViewSet.list | master/views.py | Session auth | Default DRF |
| POST | /master/ | MasterViewSet.create | master/views.py | Session auth | Default DRF |
| GET | /vendors/ | VendorViewSet.list | vendor/views.py | Session auth | Default DRF |
| POST | /vendors/ | VendorViewSet.create | vendor/views.py | Session auth | Default DRF |
| GET | /requisition-history/ | RequisitionHistoryViewSet.list | indent/views.py | Session auth | Default DRF |
| GET | /project-codes/ | ProjectCodeViewSet.list | store/views.py | Session auth | Default DRF |
| GET | /po-line-items/ | POLineItemViewSet.list | purchase_order/views.py | Session auth | Default DRF |

## 4) Function-Based Views — Permission & Auth Enforcement (Evidence-Based)

| PATH | Function | Decorators | Auth Source | Permission Logic | Failure Mode |
|------|----------|------------|-------------|------------------|-------------|
| /api/login/ | LoginView | csrf_exempt | request.POST data | Validates username/password | 401/403 response |
| /api/token/ | CustomTokenObtainPairView | None | Session auth | JWT token generation | 401 response |
| /requisitions/save/ | save_requisition | None | request.user | No explicit role checks | 500 if error |
| /requisitions/batch-approve/ | batch_approve_requisitions | None | request.user | No explicit role checks | 500 if error |
| /master/generate-po/ | generate_po | None | request.user | No explicit role checks | 500 if error |
| /save-po/ | save_po | None | request.user | No explicit role checks | 500 if error |
| /approve/<str:po_number>/ | approve_po | None | request.user | No explicit role checks | 500 if error |
| /allocate/ | allocate_stock | None | request.user | No explicit role checks | 500 if error |
| /outward/ | outward_stock | None | request.user | No explicit role checks | 500 if error |
| /vendors/<int:vendor_id>/approve/ | approve_vendor | None | request.user | No explicit role checks | 500 if error |

## 5) Workflow Deep Trace (Line-of-Code Walkthrough)

### 1. Requisition Creation → Update → Delete
1. **POST /requisitions/save/** (save_requisition in indent/views.py)
   - Creates Requisition record
   - Sets approved_status=False, status='pending'
   - Links to Project via project_code
2. **PUT /requisitions/update/<id>/** (update_requisition in indent/views.py)
   - Updates Requisition fields
   - Creates RequisitionHistory record for changes
3. **DELETE /requisitions/delete/<id>/** (delete_requisition in indent/views.py)
   - Deletes Requisition record
   - Cascades to RequisitionHistory

### 2. Batch Approve/Reject Requisitions
1. **POST /requisitions/batch-approve/** (batch_approve_requisitions in indent/views.py)
   - Updates Requisition.approved_status=True
   - Updates Requisition.status='approved'
   - Creates RequisitionHistory records
2. **POST /requisitions/batch-reject/** (batch_reject_requisitions in indent/views.py)
   - Updates Requisition.status='rejected'
   - Sets rejection_remarks
   - Creates RequisitionHistory records

### 3. Verify-and-Create-Master
1. **POST /verify-and-create-master/** (verify_and_create_master in master/views.py)
   - Reads approved Requisitions
   - Creates Master records
   - Updates Requisition.master_entry_exists=True
   - Updates Requisition.verification_status=True

### 4. Generate PO from Master
1. **POST /master/generate-po/** (generate_po in master/views.py)
   - Reads Master records
   - Creates PurchaseOrder with auto-generated PO number
   - Creates POLineItem records
   - Updates Master.ordering_status='In Progress'

### 5. Save PO + Update PO Line Items
1. **POST /save-po/** (save_po in purchase_order/views.py)
   - Creates/updates PurchaseOrder
   - Creates/updates POLineItem records
   - Calculates total_price = quantity * unit_price

### 6. Approve PO + Reject PO
1. **POST /approve/<po_number>/** (approve_po in purchase_order/views.py)
   - Updates PurchaseOrder.approval_status=True
   - Updates PurchaseOrder.status='approved'
   - Sets approved_by, approval_date
2. **POST /reject/<po_number>/** (reject_po in purchase_order/views.py)
   - Updates PurchaseOrder.rejection_status=True
   - Updates PurchaseOrder.status='rejected'
   - Sets rejected_by, rejection_date, rejection_remarks

### 7. Inward Entry → Inventory Update
1. **POST /save_inward/** (save_inward_entry in store/views.py)
   - Creates InwardEntry record
   - Creates/updates Inventory record
   - Updates location stock fields (times_sq_stock, i_sq_stock, etc.)
   - Calls Inventory.calculate_total_stock()
   - Calls Inventory.update_master_soh()

### 8. Allocate Stock
1. **POST /allocate/** (allocate_stock in store/views.py)
   - Creates StockAllocation record
   - Creates LocationWiseAllocation records
   - Updates Inventory.allocated_stock
   - Calls Inventory.calculate_available_stock()

### 9. Outward Stock
1. **POST /outward/** (outward_stock in store/views.py)
   - Creates StockOutward record
   - Updates StockAllocation.status
   - Reduces Inventory location stock
   - Creates ReturnableGatePass if needed

### 10. Vendor Create → Approve → Reject
1. **POST /vendors/** (create_vendor in vendor/views.py)
   - Creates Vendor record with status='pending'
2. **POST /vendors/<id>/approve/** (approve_vendor in vendor/views.py)
   - Updates Vendor.status='approved'
3. **POST /vendors/<id>/reject/** (reject_vendor in vendor/views.py)
   - Updates Vendor.status='rejected'
   - Sets rejection_remarks

### 11. Item Request → Item Approval → Item Master Creation
1. **POST /request-item/** (request_item in items/views.py)
   - Creates ItemRequest record with status='draft'
2. **POST /submit-for-approval/<id>/** (submit_for_approval in items/views.py)
   - Updates ItemRequest.status='pending'
3. **POST /approve-item-request/<id>/** (approve_item_request in items/views.py)
   - Creates ItemMaster record from ItemRequest
   - Updates ItemRequest.status='approved'

### 12. Stock Import Commands
1. **import_stock.py** (store/management/commands/import_stock.py)
   - Reads Excel/CSV data
   - Creates/updates Inventory records
   - Updates location stock fields
   - Calls Inventory.save() which triggers calculations

## 6) Frontend Endpoint Coverage (Real Mapping)

| Frontend file | Function/component | Service/Axios used | METHOD | ENDPOINT | Payload keys |
|---------------|-------------------|---------------------|---------|----------|--------------|
| App.tsx | checkAccess() | localStorage | N/A | N/A | userInfo.role |
| configuration.ts | apiClient | axios | N/A | baseURL: "http://199.199.50.190:8001/" | N/A |
| utils/axios.ts | axiosInstance | axios | N/A | baseURL: "http://199.199.50.128:8000" | N/A |
| services/poService.ts | getNextPONumber() | apiClient | GET | /po/next-number/ | vendor_name |

### Hardcoded Base URLs Found:
- **http://199.199.50.190:8001/** (configuration.ts)
- **http://199.199.50.128:8000** (utils/axios.ts)
- **http://199.199.50.190:8000** (settings.py CORS origins)

### Token Attachment:
- **utils/axios.ts**: Adds Bearer token from localStorage to Authorization header
- **configuration.ts**: Uses withCredentials=true for session auth
