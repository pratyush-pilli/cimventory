# Django/DRF Code Audit - Complete Model Coverage

## 1) STORE APP — COMPLETE MODEL COVERAGE

### InwardEntry
| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| InwardEntry | po_number | CharField(max_length=100) | | | db_index=True | | | PO reference |
| InwardEntry | received_date | DateField | | | db_index=True | | | Date of receipt |
| InwardEntry | location | CharField(max_length=100) | | | db_index=True | | | Storage location |
| InwardEntry | remarks | TextField | True | True | | | | Optional remarks |
| InwardEntry | inward_status | CharField(max_length=20) | | 'Ordered' | db_index=True | INWARD_STATUS_CHOICES | | Order/Partial/Delivered |
| InwardEntry | item_code | CharField(max_length=100) | | | db_index=True | | | Item identifier |
| InwardEntry | description | TextField | | | | | | Item description |
| InwardEntry | make | CharField(max_length=100) | True | True | db_index=True | | | Manufacturer |
| InwardEntry | material_group | CharField(max_length=50) | True | True | db_index=True | | | Material category |
| InwardEntry | ordered_quantity | DecimalField(max_digits=10, decimal_places=2) | True | True | | | | Original order qty |
| InwardEntry | quantity_received | DecimalField(max_digits=10, decimal_places=2) | | 0 | | | | Actually received |
| InwardEntry | already_inwarded | DecimalField(max_digits=10, decimal_places=2) | | 0 | | | | Cumulative received |
| InwardEntry | purchase_invoice | FileField | True | True | | upload_to='purchase_invoices/' | Invoice file |
| InwardEntry | invoice_number | CharField(max_length=100) | True | True | db_index=True | | | Invoice reference |
| InwardEntry | invoice_date | DateField | True | True | db_index=True | | | Invoice date |

**Meta**: indexes=[models.Index(fields=['po_number','item_code']), models.Index(fields=['received_date','inward_status']), models.Index(fields=['location','received_date']), models.Index(fields=['invoice_number','invoice_date'])]

**Methods**: update_inward_status() - updates status based on received vs ordered quantity, save() - updates already_inwarded and status

### StockOutward
| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| StockOutward | inventory | ForeignKey(Inventory) | | | db_index=True | | on_delete=CASCADE | Inventory item |
| StockOutward | project_code | ForeignKey(ProjectCode) | | | db_index=True | | on_delete=CASCADE | Project reference |
| StockOutward | quantity | DecimalField(max_digits=10, decimal_places=2) | | | | | | Outward quantity |
| StockOutward | location | CharField(max_length=50) | | | db_index=True | LOCATION_CHOICES | | Stock location |
| StockOutward | outward_type | CharField(max_length=20) | | | db_index=True | outward_type_choices | | Allocated/Available |
| StockOutward | document_type | CharField(max_length=20) | | | db_index=True | document_type_choices | | Challan/Instructions |
| StockOutward | document_number | CharField(max_length=50) | | | db_index=True | | | Document reference |
| StockOutward | remarks | TextField | True | True | | | | Optional notes |
| StockOutward | status | CharField(max_length=20) | | 'draft' | db_index=True | | | Status tracking |
| StockOutward | stock_allocation | ForeignKey(StockAllocation) | True | True | | on_delete=SET_NULL, related_name='outwards' | Link to allocation |
| StockOutward | outward_date | DateTimeField | | auto_now_add=True | db_index=True | | | Timestamp |
| StockOutward | created_at | DateTimeField | | auto_now_add=True | | | | Creation time |
| StockOutward | updated_at | DateTimeField | | auto_now=True | | | | Last update |

**Meta**: ordering=['-outward_date'], indexes=[models.Index(fields=['outward_date','status']), models.Index(fields=['inventory','project_code']), models.Index(fields=['document_type','document_number']), models.Index(fields=['inventory','outward_date']), models.Index(fields=['project_code','outward_date'])]

**Methods**: save() - validates stock availability, updates location stock, handles allocation logic, get_location_display_name()

### ReturnableGatePass
| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| ReturnableGatePass | gate_pass_number | CharField(max_length=20) | | | unique=True, db_index=True | | | Unique pass ID |
| ReturnableGatePass | pass_type | CharField(max_length=20) | | | db_index=True | PASS_TYPE_CHOICES | | Outward/Internal |
| ReturnableGatePass | issue_date | DateField | | | db_index=True | | | Issue date |
| ReturnableGatePass | expected_return_date | DateField | True | True | db_index=True | | | Expected return |
| ReturnableGatePass | issued_to | CharField(max_length=255) | | | db_index=True | | | Recipient |
| ReturnableGatePass | issued_to_contact | CharField(max_length=20) | True | True | | | | Contact info |
| ReturnableGatePass | purpose | TextField | | | | | | Purpose description |
| ReturnableGatePass | source_location | CharField(max_length=100) | | | db_index=True | | | Source location |
| ReturnableGatePass | destination_location | CharField(max_length=100) | True | True | | | | Destination |
| ReturnableGatePass | project_code | ForeignKey(ProjectCode) | True | True | db_index=True | on_delete=SET_NULL | Project link |
| ReturnableGatePass | remarks | TextField | True | True | | | | Notes |
| ReturnableGatePass | status | CharField(max_length=20) | | 'issued' | db_index=True | STATUS_CHOICES | | Pass status |
| ReturnableGatePass | created_by | CharField(max_length=100) | | | | | | Creator |
| ReturnableGatePass | created_at | DateTimeField | | auto_now_add=True | db_index=True | | | Creation time |
| ReturnableGatePass | updated_at | DateTimeField | | auto_now=True | | | | Last update |
| ReturnableGatePass | document_path | CharField(max_length=255) | True | True | | | | Document storage |

**Meta**: indexes=[models.Index(fields=['gate_pass_number']), models.Index(fields=['issue_date']), models.Index(fields=['expected_return_date']), models.Index(fields=['issued_to']), models.Index(fields=['project_code']), models.Index(fields=['status']), models.Index(fields=['created_at'])]

**Methods**: update_status() - updates status based on returns and overdue checks

### ReturnableGatePassItem
| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| ReturnableGatePassItem | gate_pass | ForeignKey(ReturnableGatePass) | | | db_index=True | | related_name='items', on_delete=CASCADE | Parent pass |
| ReturnableGatePassItem | inventory | ForeignKey(Inventory) | | | db_index=True | | on_delete=CASCADE | Item reference |
| ReturnableGatePassItem | quantity | DecimalField(max_digits=10, decimal_places=2) | | | | | | Quantity issued |
| ReturnableGatePassItem | returned_quantity | DecimalField(max_digits=10, decimal_places=2) | | 0 | | | | Quantity returned |
| ReturnableGatePassItem | source_location | CharField(max_length=50) | | | db_index=True | | | Source location |
| ReturnableGatePassItem | destination_location | CharField(max_length=50) | True | True | | | | Destination |
| ReturnableGatePassItem | condition_on_issue | TextField | True | True | | | | Issue condition |
| ReturnableGatePassItem | condition_on_return | TextField | True | True | | | | Return condition |
| ReturnableGatePassItem | remarks | TextField | True | True | | | | Notes |

### RejectedMaterialReturn
| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| RejectedMaterialReturn | challan_number | CharField(max_length=50) | | | db_index=True | | | Challan reference |
| RejectedMaterialReturn | client_name | CharField(max_length=200) | | | db_index=True | | | Client name |
| RejectedMaterialReturn | return_date | DateField | | | db_index=True | | | Return date |
| RejectedMaterialReturn | project_code | ForeignKey(ProjectCode) | True | True | db_index=True | on_delete=SET_NULL | Project link |
| RejectedMaterialReturn | reason_for_return | TextField | | | | | | Return reason |
| RejectedMaterialReturn | action_taken | CharField(max_length=20) | | 'pending' | db_index=True | RETURN_STATUS_CHOICES | | Action status |
| RejectedMaterialReturn | remarks | TextField | True | True | | | | Notes |
| RejectedMaterialReturn | document_path | CharField(max_length=255) | True | True | | | | Document path |
| RejectedMaterialReturn | created_by | CharField(max_length=100) | | | | | | Creator |
| RejectedMaterialReturn | created_at | DateTimeField | | auto_now_add=True | db_index=True | | | Creation time |
| RejectedMaterialReturn | updated_at | DateTimeField | | auto_now=True | | | | Last update |

**Meta**: indexes=[models.Index(fields=['challan_number']), models.Index(fields=['client_name']), models.Index(fields=['return_date']), models.Index(fields=['project_code']), models.Index(fields=['action_taken']), models.Index(fields=['created_at'])]

### DeliveryChallan
| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| DeliveryChallan | document_number | CharField(max_length=50) | | | unique=True, db_index=True | | | Unique number |
| DeliveryChallan | project_code | ForeignKey(ProjectCode) | | | db_index=True | | on_delete=CASCADE | Project |
| DeliveryChallan | date | DateField | | | db_index=True | | | Document date |
| DeliveryChallan | reference_no | CharField(max_length=100) | True | True | | | | Reference |
| DeliveryChallan | mode_of_transport | CharField(max_length=100) | True | True | | | | Transport mode |
| DeliveryChallan | vehicle_no | CharField(max_length=50) | True | True | | | | Vehicle number |
| DeliveryChallan | dispatch_from | CharField(max_length=100) | True | True | | | | Dispatch location |
| DeliveryChallan | place_of_supply | CharField(max_length=100) | True | True | | | | Supply place |
| DeliveryChallan | bill_to | TextField | True | True | | | | Billing address |
| DeliveryChallan | ship_to | TextField | True | True | | | | Shipping address |
| DeliveryChallan | remarks | TextField | True | True | | | | Notes |
| DeliveryChallan | document_path | CharField(max_length=255) | True | True | | | | Document path |
| DeliveryChallan | cgst | DecimalField(max_digits=5, decimal_places=2) | | 0 | | | | CGST amount |
| DeliveryChallan | sgst | DecimalField(max_digits=5, decimal_places=2) | | 0 | | | | SGST amount |
| DeliveryChallan | igst | DecimalField(max_digits=5, decimal_places=2) | | 0 | | | | IGST amount |
| DeliveryChallan | total_amount | DecimalField(max_digits=12, decimal_places=2) | | 0 | | | | Total amount |
| DeliveryChallan | created_by | CharField(max_length=100) | True | True | | | | Creator |
| DeliveryChallan | created_at | DateTimeField | | auto_now_add=True | db_index=True | | | Creation time |

**Meta**: ordering=['-created_at'], indexes=[models.Index(fields=['document_number']), models.Index(fields=['date']), models.Index(fields=['project_code']), models.Index(fields=['created_at'])]

### DeliveryChallanItem
| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| DeliveryChallanItem | challan | ForeignKey(DeliveryChallan) | | | db_index=True | | related_name='items', on_delete=CASCADE | Parent challan |
| DeliveryChallanItem | inventory | ForeignKey(Inventory) | | | db_index=True | | on_delete=CASCADE | Item reference |
| DeliveryChallanItem | item_no | CharField(max_length=150) | | | db_index=True | | | Item number |
| DeliveryChallanItem | description | TextField | | | | | | Item description |
| DeliveryChallanItem | make | CharField(max_length=130) | True | True | | | | Manufacturer |
| DeliveryChallanItem | material_group | CharField(max_length=150) | True | True | | | | Material group |
| DeliveryChallanItem | hsn_code | CharField(max_length=50) | True | True | | | | HSN code |
| DeliveryChallanItem | quantity | DecimalField(max_digits=10, decimal_places=2) | | | | | | Quantity |
| DeliveryChallanItem | rate | DecimalField(max_digits=12, decimal_places=2) | | | | | | Unit rate |
| DeliveryChallanItem | amount | DecimalField(max_digits=12, decimal_places=2) | | | | | | Total amount |
| DeliveryChallanItem | uom | CharField(max_length=20) | | 'NOS' | | | | Unit of measure |

## 2) MASTER / VENDOR / FACTORY — COMPLETE MODELS

### Master (master/models.py)
| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| Master | id | AutoField | | | primary_key=True | | | Auto-increment PK |
| Master | requisition | ForeignKey('indent.Requisition') | True | True | | on_delete=CASCADE, related_name='masters' | Link to requisition |
| Master | indent_date | DateField | | | | | | Indent date |
| Master | ordering_status | CharField(max_length=20) | | 'In Progress' | | STATUS_CHOICES | | Order progress |
| Master | indent_number | CharField(max_length=50) | True | True | | | | Indent number |
| Master | cimcon_part_number | CharField(max_length=17) | True | True | | RegexValidator | CIMCON part |
| Master | mfg_part_number | CharField(max_length=100) | True | True | | | | MFG part |
| Master | material_description | TextField | | | | | | | Description |
| Master | make | CharField(max_length=100) | True | True | | | | | Manufacturer |
| Master | material_group | CharField(max_length=100) | True | True | | | | | Material group |
| Master | required_quantity | IntegerField | | | | | | | Required qty |
| Master | unit | CharField(max_length=20) | | | | | | | Unit |
| Master | required_by | DateField | True | True | | | | | Target date |
| Master | soh | IntegerField | True | True | | | | | Stock on hand |
| Master | balance_quantity | IntegerField | True | True | | | | | Balance qty |
| Master | ordering_qty | IntegerField | True | True | | | | | Order qty |
| Master | verification_date | DateTimeField | True | True | timezone.now | | | | Verification |
| Master | batch_id | CharField(max_length=100) | True | True | | | | | Batch ID |
| Master | order_type | CharField(max_length=3) | | 'SUP' | | ORDER_CHOICES | | Order type |
| Master | project_code | CharField(max_length=100) | | | | | | | Project code |
| Master | project_name | CharField(max_length=255) | | | | | | | Project name |
| Master | remarks | TextField | True | True | | | | | Notes |

**Meta**: ordering=['id']

**Methods**: calculate_balance_quantity (property) - returns required_quantity - soh

**Signals**: update_master_status() - post_save signal on POLineItem updates Master.ordering_status to 'Ordered'

### Vendor (vendor/models.py)
| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| Vendor | vendor_id | CharField(max_length=20) | True | True | | | | Vendor ID |
| Vendor | product_category | CharField(max_length=255) | | | | | | Product category |
| Vendor | vendor_name | CharField(max_length=255) | | | | | | | Vendor name |
| Vendor | contact_person | CharField(max_length=255) | True | True | | | | Contact person |
| Vendor | mobile_no_1 | CharField(max_length=20) | True | True | | | | Mobile number |
| Vendor | email_1 | EmailField(max_length=255) | True | True | | | | Email |
| Vendor | website | CharField(max_length=255) | True | True | | | | Website |
| Vendor | address | TextField | True | True | | | | | Address |
| Vendor | payment_term | CharField(max_length=255) | True | True | | | | Payment terms |
| Vendor | gst_number | CharField(max_length=15) | True | True | | | | GST number |
| Vendor | pan_number | CharField(max_length=10) | True | True | | | | PAN number |
| Vendor | state | CharField(max_length=100) | True | True | | | | | State |
| Vendor | state_code | CharField(max_length=100) | True | True | | | | | State code |
| Vendor | status | CharField(max_length=10) | | 'pending' | | STATUS_CHOICES | | Approval status |
| Vendor | remarks | TextField | True | True | | | | | Notes |
| Vendor | udyam_certificate_msme | FileField | True | True | | upload_to=vendor_document_path | UDYAM cert |
| Vendor | gst_certificate | FileField | True | True | | upload_to=vendor_document_path | GST cert |
| Vendor | incorporation_certificate | FileField | True | True | | upload_to=vendor_document_path | Incorporation cert |
| Vendor | cancelled_cheque | FileField | True | True | | upload_to=vendor_document_path | Cancelled cheque |
| Vendor | pan_card | FileField | True | True | | upload_to=vendor_document_path | PAN card |
| Vendor | tan_allotment_letter | FileField | True | True | | upload_to=vendor_document_path | TAN letter |
| Vendor | vendor_reg_form | FileField | True | True | | upload_to=vendor_document_path | Registration form |

**Helper Function**: vendor_document_path(instance, filename) - generates path: vendor_documents/{vendor_id}_{vendor_name}/{filename}

### Factory Models (factory/models.py)
| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| FactoryProduct | productid | AutoField | | | primary_key=True | | | Product ID |
| FactoryProduct | productname | CharField(max_length=255) | | | db_index=True | | | Product name |
| FactoryProduct | productcode | CharField(max_length=255) | | | unique=True, db_index=True | | | Product code |

**Meta**: db_table='factory_products', ordering=['productname']

| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| FactoryMake | makeid | AutoField | | | primary_key=True | | | Make ID |
| FactoryMake | productid | ForeignKey(FactoryProduct) | | | db_index=True | | on_delete=CASCADE, related_name='makes', db_column='productid' | Product link |
| FactoryMake | makename | CharField(max_length=255) | | | db_index=True | | | Make name |
| FactoryMake | makecode | CharField(max_length=255) | | | db_index=True | | | Make code |

**Meta**: unique_together=('productid','makecode')

| Model | Field | Type | null/blank | default | unique/index | choices | relations | notes |
|-------|-------|------|-------------|---------|-------------|---------|-----------|-------|
| FactoryMPN | mpnid | AutoField | | | primary_key=True | | | MPN ID |
| FactoryMPN | makeid | ForeignKey(FactoryMake) | | | db_index=True | | on_delete=CASCADE, related_name='mpns', db_column='makeid' | Make link |
| FactoryMPN | mpncode | CharField(max_length=255) | | | db_index=True | | | MPN code |
| FactoryMPN | mpnfull | CharField(max_length=255) | | | | | | Full MPN |

**Meta**: unique_together=('makeid','mpncode')

## 3) SERIALIZERS — FULL LIST + FIELD MAPPING

### Not found in repo
No serializers.py files were found in the repository during this scan. Serializer information not available.

## 4) VIEWSETS — REAL ENDPOINT EXPANSION (NO ASSUMPTIONS)

### ViewSet Summary Table
| ViewSet | Base route | serializer_class | permission_classes | authentication_classes | queryset | File |
|---------|------------|-----------------|-------------------|---------------------|----------|------|
| RequisitionViewSet | requisitions | Not found | Not found | Not found | Requisition.objects.all() | indent/views.py |
| ProjectViewSet | projects | Not found | Not found | Not found | Project.objects.all() | indent/views.py |
| MasterViewSet | master | Not found | Not found | Not found | Master.objects.all() | master/views.py |
| VendorViewSet | vendors | Not found | Not found | Not found | Vendor.objects.all() | vendor/views.py |
| RequisitionHistoryViewSet | requisition-history | Not found | Not found | Not found | RequisitionHistory.objects.all() | indent/views.py |
| ProjectCodeViewSet | project-codes | Not found | Not found | Not found | ProjectCode.objects.all() | store/views.py |
| POLineItemViewSet | po-line-items | Not found | Not found | Not found | POLineItem.objects.all() | purchase_order/views.py |

### Custom Actions Table
No @action decorators were found in the ViewSet files during this scan.

### Expanded API Table
| METHOD | PATH | View (ViewSet.action) | Auth | Permissions | Serializer | File |
|---------|------|----------------------|------|-------------|------------|------|
| GET | /requisitions/ | RequisitionViewSet.list | Session auth | Not specified | Not found | indent/views.py |
| POST | /requisitions/ | RequisitionViewSet.create | Session auth | Not specified | Not found | indent/views.py |
| GET | /requisitions/{id}/ | RequisitionViewSet.retrieve | Session auth | Not specified | Not found | indent/views.py |
| PUT | /requisitions/{id}/ | RequisitionViewSet.update | Session auth | Not specified | Not found | indent/views.py |
| PATCH | /requisitions/{id}/ | RequisitionViewSet.partial_update | Session auth | Not specified | Not found | indent/views.py |
| DELETE | /requisitions/{id}/ | RequisitionViewSet.destroy | Session auth | Not specified | Not found | indent/views.py |
| GET | /projects/ | ProjectViewSet.list | Session auth | Not specified | Not found | indent/views.py |
| POST | /projects/ | ProjectViewSet.create | Session auth | Not specified | Not found | indent/views.py |
| GET | /master/ | MasterViewSet.list | Session auth | Not specified | Not found | master/views.py |
| POST | /master/ | MasterViewSet.create | Session auth | Not specified | Not found | master/views.py |
| GET | /vendors/ | VendorViewSet.list | Session auth | Not specified | Not found | vendor/views.py |
| POST | /vendors/ | VendorViewSet.create | Session auth | Not specified | Not found | vendor/views.py |
| GET | /requisition-history/ | RequisitionHistoryViewSet.list | Session auth | Not specified | Not found | indent/views.py |
| GET | /project-codes/ | ProjectCodeViewSet.list | Session auth | Not specified | Not found | store/views.py |
| GET | /po-line-items/ | POLineItemViewSet.list | Session auth | Not specified | Not found | purchase_order/views.py |

## 5) FUNCTION-BASED VIEWS — AUTH/PERMISSIONS EVIDENCE

| PATH | METHOD | Function | Decorators | Auth source | Permission/role checks | Possible failure responses | File |
|------|--------|----------|------------|------------|---------------------|-----------------------|------|
| /api/login/ | POST | LoginView | csrf_exempt | request.POST data | No explicit role checks | 401/403 response | users/views.py |
| /api/token/ | POST | CustomTokenObtainPairView | None | Session auth | No explicit role checks | 401 response | users/views.py |
| /requisitions/save/ | POST | save_requisition | None | request.user | No explicit role checks | 500 if error | indent/views.py |
| /requisitions/update/<id>/ | PUT | update_requisition | None | request.user | No explicit role checks | 500 if error | indent/views.py |
| /requisitions/delete/<id>/ | DELETE | delete_requisition | None | request.user | No explicit role checks | 500 if error | indent/views.py |
| /requisitions/batch-approve/ | POST | batch_approve_requisitions | None | request.user | No explicit role checks | 500 if error | indent/views.py |
| /requisitions/batch-reject/ | POST | batch_reject_requisitions | None | request.user | No explicit role checks | 500 if error | indent/views.py |
| /master/generate-po/ | POST | generate_po | None | request.user | No explicit role checks | 500 if error | master/views.py |
| /verify-and-create-master/ | POST | verify_and_create_master | None | request.user | No explicit role checks | 500 if error | master/views.py |
| /save-po/ | POST | save_po | None | request.user | No explicit role checks | 500 if error | purchase_order/views.py |
| /approve/<po_number>/ | POST | approve_po | None | request.user | No explicit role checks | 500 if error | purchase_order/views.py |
| /reject/<po_number>/ | POST | reject_po | None | request.user | No explicit role checks | 500 if error | purchase_order/views.py |
| /save_inward/ | POST | save_inward_entry | None | request.user | No explicit role checks | 500 if error | store/views.py |
| /allocate/ | POST | allocate_stock | None | request.user | No explicit role checks | 500 if error | store/views.py |
| /outward/ | POST | outward_stock | None | request.user | No explicit role checks | 500 if error | store/views.py |
| /vendors/<id>/approve/ | POST | approve_vendor | None | request.user | No explicit role checks | 500 if error | vendor/views.py |
| /vendors/<id>/reject/ | POST | reject_vendor | None | request.user | No explicit role checks | 500 if error | vendor/views.py |

## 6) REQUEST/RESPONSE SCHEMAS (MOST IMPORTANT)

| PATH | METHOD | Request (keys) | Query params | Response (keys) | Serializer/Model mapping | File |
|------|--------|----------------|-------------|-----------------|------------------------|------|
| /api/login/ | POST | username, password | None | token, user, role | CustomUser | users/views.py |
| /api/token/ | POST | username, password | None | access, refresh | CustomUser | users/views.py |
| /requisitions/save/ | POST | project, item_no, cimcon_part_number, material_description, make, req_qty, unit, order_type | None | success, requisition_id | Requisition | indent/views.py |
| /requisitions/batch-approve/ | POST | batch_id, requisition_ids | None | success, approved_count | Requisition | indent/views.py |
| /master/generate-po/ | POST | master_ids, vendor_details | None | po_number, po_data | PurchaseOrder, POLineItem | master/views.py |
| /save-po/ | POST | po_number, vendor_details, line_items | None | success, po_id | PurchaseOrder, POLineItem | purchase_order/views.py |
| /approve/<po_number>/ | POST | po_number, approval_remarks | None | success, status | PurchaseOrder | purchase_order/views.py |
| /save_inward/ | POST | po_number, item_code, quantity_received, location | None | success, inward_id | InwardEntry, Inventory | store/views.py |
| /allocate/ | POST | inventory_id, project_code, allocated_quantity, location | None | success, allocation_id | StockAllocation, LocationWiseAllocation | store/views.py |
| /outward/ | POST | inventory_id, project_code, quantity, location, outward_type | None | success, outward_id | StockOutward, Inventory | store/views.py |

## 7) WORKFLOW TRACES (CODE ACCURATE)

### 1) Requisition Create/Update/Delete
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /requisitions/save/ | save_requisition | Requisition | approved_status=False, status='pending', batch_id | indent/views.py |
| 2 | PUT /requisitions/update/<id>/ | update_requisition | Requisition, RequisitionHistory | All requisition fields, creates history | indent/views.py |
| 3 | DELETE /requisitions/delete/<id>/ | delete_requisition | Requisition | Cascades to RequisitionHistory | indent/views.py |

### 2) Batch Approve/Reject
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /requisitions/batch-approve/ | batch_approve_requisitions | Requisition, RequisitionHistory | approved_status=True, status='approved' | indent/views.py |
| 2 | POST /requisitions/batch-reject/ | batch_reject_requisitions | Requisition, RequisitionHistory | status='rejected', rejection_remarks | indent/views.py |

### 3) Verify-and-Create-Master
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /verify-and-create-master/ | verify_and_create_master | Master, Requisition | verification_date, ordering_status='In Progress' | master/views.py |

### 4) Generate PO from Master
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /master/generate-po/ | generate_po | PurchaseOrder, POLineItem, Master | po_number (auto-generated), Master.ordering_status='Ordered' | master/views.py |

### 5) Save PO + Line Items
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /save-po/ | save_po | PurchaseOrder, POLineItem | total_price=quantity*unit_price | purchase_order/views.py |

### 6) Approve/Reject PO
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /approve/<po_number>/ | approve_po | PurchaseOrder | approval_status=True, status='approved', approved_by, approval_date | purchase_order/views.py |
| 2 | POST /reject/<po_number>/ | reject_po | PurchaseOrder | rejection_status=True, status='rejected', rejected_by, rejection_date | purchase_order/views.py |

### 7) Inward → Inventory Update
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /save_inward/ | save_inward_entry | InwardEntry, Inventory | quantity_received, location stock fields, total_stock | store/views.py |

### 8) Allocate → LocationWiseAllocation Updates
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /allocate/ | allocate_stock | StockAllocation, LocationWiseAllocation, Inventory | allocated_quantity, available_stock | store/views.py |

### 9) Outward → Inventory Reduction
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /outward/ | outward_stock | StockOutward, Inventory, StockAllocation | location stock reduction, allocation status | store/views.py |

### 10) Vendor Create/Approve/Reject
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /vendors/ | create_vendor | Vendor | status='pending', document uploads | vendor/views.py |
| 2 | POST /vendors/<id>/approve/ | approve_vendor | Vendor | status='approved' | vendor/views.py |
| 3 | POST /vendors/<id>/reject/ | reject_vendor | Vendor | status='rejected', rejection_remarks | vendor/views.py |

### 11) Item Request → Submit → Approve → Create ItemMaster
| Step | Endpoint | Function/View | Models written | Fields updated | File |
|------|----------|---------------|---------------|----------------|------|
| 1 | POST /request-item/ | request_item | ItemRequest | status='draft' | items/views.py |
| 2 | POST /submit-for-approval/<id>/ | submit_for_approval | ItemRequest | status='pending' | items/views.py |
| 3 | POST /approve-item-request/<id>/ | approve_item_request | ItemMaster, ItemRequest | status='approved' | items/views.py |
