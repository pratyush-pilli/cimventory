from django.urls import path, include
from django.contrib import admin
from rest_framework.routers import DefaultRouter
from django.conf import settings
from django.conf.urls.static import static
from rest_framework import permissions
from drf_yasg.views import get_schema_view
from drf_yasg import openapi
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
# View imports
from indent.views import (
    RequisitionHistoryViewSet, RequisitionViewSet, ProjectViewSet,
    get_revision_history_by_batch, save_revision_history,
    save_requisition, update_requisition, delete_requisition,
    batch_approve_requisitions, batch_reject_requisitions,
    create_project, approve_requisition_email, approve_requisition_page,
    get_division_requisitions, get_requisitions_by_division
)
from master.views import (
    MasterViewSet, approval_page_open, approve_po_email,
    fetch_terms_from_file, generate_po, reject_page_open,
    reject_po_email, update_master_status, verify_and_create_master,
    update_hsn_code
)
from items.views import (
    item_approve_email,
    item_approve_page_open, item_reject_email, item_reject_page_open,
    request_item, get_item_requests, update_item_request, submit_for_approval,
    current_user, download_item_document, generate_code, get_options,
    get_related_options, get_subcategories, create_item, create_parameter,
    get_item_master_data, approve_item_request, reject_item_request
)
from store.views import (
    ProjectCodeViewSet, allocate_stock, check_allocation_availability,
    create_rejected_material_return, create_returnable_gate_pass,
    debug_location_allocations, generate_document,
    get_allocations, get_delivery_challans, preview_document,
    get_gate_pass_document, get_inventory, get_inventory_outward_history,
    get_inventory_rejected_materials, get_inventory_returnable_info,
    get_item_project_requirements, get_location_stock,
    get_outward_history, get_outward_summary,
    get_project_outward_history, get_project_requirements,
    get_rejected_material_document, get_rejected_material_return,
    get_rejected_material_returns, get_returnable_gate_pass,
    get_returnable_gate_passes, get_stock_details, outward_stock,
    process_gate_pass_return,
    process_outward_and_document, reallocate_stock, save_inward_entry,
    get_all_invoices, get_po_invoices, download_invoice, get_invoice_statistics
)
from purchase_order.views import (
    POLineItemViewSet, approve_po, download_po, generate_po_html,
    get_all_po_numbers, get_latest_po_number, get_pending_pos,
    get_project_codes_with_po_details, get_rejected_pos, reject_po,
    resubmit_po, save_po, get_purchase_order_details,
    get_po_inward_status, update_approval_page_open,
    update_approve_po_email, update_po, update_reject_page_open,
    update_reject_po_email, get_po_history
)
from users.views import CustomTokenObtainPairView, DivisionUsersView, LoginView
from vendor.views import (
    VendorViewSet, approve_vendor, create_vendor, get_approved_vendors,
    get_last_vendor_id, get_pending_vendors, get_rejected_vendors,
    update_vendor, vendor_approve_email, vendor_reject_email,
    vendor_approve_page_open, vendor_reject_page_open, quick_update_vendor
)
from administrator.views import (
    # ... existing imports ...
    admin_alert_details,
    admin_create_role,
    admin_dashboard_stats,
    admin_delete_role,
    admin_get_roles,
    admin_get_users,
    admin_create_user,
    admin_update_role,
    admin_update_user,
    admin_delete_user,
    admin_division_management,
    admin_create_division,
    admin_system_overview,
    admin_audit_logs,
)
from django.views.decorators.csrf import csrf_exempt

schema_view = get_schema_view(
   openapi.Info(
      title="Purchase Module API",
      default_version='v1',
      description="API documentation for Purchase Module",
   ),
   public=True,
   permission_classes=(permissions.AllowAny,),
)
# Router
router = DefaultRouter()
router.register(r'requisitions', RequisitionViewSet, basename='requisition')
router.register(r'projects', ProjectViewSet, basename='project')
router.register('master', MasterViewSet, basename='master')
router.register(r'vendors', VendorViewSet)
router.register(r'requisition-history', RequisitionHistoryViewSet)
router.register(r'project-codes', ProjectCodeViewSet)
router.register(r'po-line-items', POLineItemViewSet, basename='po-line-items')

urlpatterns = [
    #Swagger/OpenAPI Docs
    path('swagger/', schema_view.with_ui('swagger', cache_timeout=0), name='schema-swagger-ui'),
    path('redoc/', schema_view.with_ui('redoc', cache_timeout=0), name='schema-redoc'),
    path('swagger.json', schema_view.without_ui(cache_timeout=0), name='schema-json'),
    
    # Admin
    path('admin/', admin.site.urls),

    # Authentication
    path('api/login/', csrf_exempt(LoginView.as_view()), name='login'),
    path('api/token/', CustomTokenObtainPairView.as_view(), name='token_obtain_pair'),
    
    # Project
    path('create-project/', create_project, name='create_project'),

    # Requisition
    path('requisitions/save/', save_requisition, name='save_requisition'),
    path('requisitions/update/<int:requisition_id>/', update_requisition, name='update_requisition'),
    path('requisitions/delete/<int:requisition_id>/', delete_requisition, name='delete_requisition'),
    path('requisitions/batch-approve/', batch_approve_requisitions, name='batch_approve_requisitions'),
    path('requisitions/batch-reject/', batch_reject_requisitions, name='batch_reject_requisitions'),
    path('api/requisition-history/', save_revision_history, name='save_revision_history'),
    path('api/requisition-history/by_batch/', get_revision_history_by_batch, name='get_revision_history_by_batch'),
    path('api/approve-requisition-email/<str:batch_id>/', approve_requisition_email, name='approve_requisition_email'),
    path('approve-requisition/<str:batch_id>/', approve_requisition_page, name='approve_requisition_page'),

    # Master
    path('master/generate-po/', generate_po, name='generate_po'),
    path('update-master-status/', update_master_status, name='update-master-status'),
    path('verify-and-create-master/', verify_and_create_master, name='verify-and-create-master'),
    path('master/update-hsn-code/', update_hsn_code, name='update_hsn_code'),
    path('terms-conds/', fetch_terms_from_file, name='terms-conds'),    

    # PO
    path('save-po/', save_po, name='save_po'),
    path('get-latest-po-number/', get_latest_po_number, name='get_latest_po_number'),
    path('purchase-orders/<str:po_number>/', get_purchase_order_details, name='get_po_details'),
    path('all-po-numbers/', get_all_po_numbers, name='get_all_po_numbers'),
    path('pending-approval/', get_pending_pos, name='pending_pos'),
    path('approve/<str:po_number>/', approve_po, name='approve_po'),
    path('reject/<str:po_number>/', reject_po, name='reject_po'),
    path('resubmit/<str:po_number>/', resubmit_po, name='resubmit_po'),
    path('rejected-pos/', get_rejected_pos, name='rejected_pos'),
    path('update-po/<str:po_number>', update_po, name='update_po'),
    path('download-po/<str:po_number>/', download_po, name='download_po'),
    path('po-inward-status/<str:po_number>/', get_po_inward_status, name='po-inward-status'),

    # PO Approval/Reject Pages and Emails
    path('approve-po/<str:po_number>/', approval_page_open, name='approval_page_open'),
    path('api/approve-po-email/<str:po_number>/', approve_po_email, name='approve_po_email'),
    path('reject-po/<str:po_number>/', reject_page_open, name='reject_page_open'),
    path('api/reject-po-email/<str:po_number>/', reject_po_email, name='reject_po_email'),
    path('api/update-reject-po-email/<str:po_number>/', update_reject_po_email, name='update_reject_po_email'),
    path('api/update-approve-po-email/<str:po_number>/', update_approve_po_email, name='update_approve_po_email'),
    path('update-approval-page-open/<str:po_number>/', update_approval_page_open, name='update_approval_page_open'),
    path('update-reject-page-open/<str:po_number>/', update_reject_page_open, name='update_reject_page_open'),
    path('po-history/<str:po_number>/', get_po_history, name='po-history'),

    # Inventory
    path('inventory/', get_inventory, name='get_inventory'),
    path('save_inward/', save_inward_entry, name='save_inward_entry'),
    path('inventory/<int:inventory_id>/location-stock/', get_location_stock, name='get-location-stock'),
    path('inventory/<int:inventory_id>/returnable-info/', get_inventory_returnable_info, name='get_inventory_returnable_info'),
    path('inventory/<int:inventory_id>/outward-history/', get_inventory_outward_history, name='inventory-outward-history'),
    path('inventory/<int:inventory_id>/rejected-materials/', get_inventory_rejected_materials, name='get_inventory_rejected_materials'),

    # Stock Allocation
    path('allocate/', allocate_stock, name='allocate_stock'),
    path('allocations/', get_allocations, name='get_allocations'),
    path('inventory/<int:inventory_id>/allocations/', get_allocations, name='get_inventory_allocations'),
    path('reallocate/<int:allocation_id>/', reallocate_stock, name='reallocate_stock'),
    path('check-allocation-availability/<int:inventory_id>/<str:project_code>/', check_allocation_availability, name='check-allocation-availability'),

    # Outward & Documents
    path('outward/', outward_stock, name='outward_stock'),
    path('project-requirements/<str:project_code>/', get_project_requirements, name='get_project_requirements'),
    path('project-requirements/item/<str:item_no>/', get_item_project_requirements, name='get-item-project-requirements'),
    path('outward-history/<int:inventory_id>/<str:project_code>/', get_outward_history, name='outward-history'),
    path('project/<str:project_code>/outward-history/', get_project_outward_history, name='project-outward-history'),
    path('outward-summary/', get_outward_summary, name='outward-summary'),
    path('generate-document/', generate_document, name='generate_document'),
    path('preview-document/', preview_document, name='preview-document'),
    path('process-outward-and-document/', process_outward_and_document, name='process-outward-and-document'),
    path('project-codes-with-po-details/', get_project_codes_with_po_details, name='project-codes-with-po-details'),
    path('debug-location-allocations/', debug_location_allocations, name='debug_location_allocations'),
    path('debug-location-allocations/<int:allocation_id>/', debug_location_allocations, name='debug_location_allocations_detail'),



    # Item Requests & Approval
    path('request-item/', request_item, name='request-item'),
    path('item-requests/', get_item_requests, name='get-item-requests'),
    
    
    path('update-item-request/<int:request_id>/', update_item_request, name='update-item-request'),
    path('submit-for-approval/<int:request_id>/', submit_for_approval, name='submit_for_approval'),
    path('current-user/', current_user, name='current-user'),
    path('item-approve-page-open/<str:cimcon_part_no>/', item_approve_page_open, name='item-approve-page-open'),
    path('item-reject-page-open/<str:cimcon_part_no>/', item_reject_page_open, name='item-reject-page-open'),
    path('api/item-approve-email/<str:cimcon_part_no>/', item_approve_email, name='item-approve-email'),
    path('api/item-reject-email/<str:cimcon_part_no>/', item_reject_email, name='item-reject-email'),

    # Item Documents
    path('item-document/request/<int:request_id>/', download_item_document, name='download-item-request-document'),
    path('item-document/master/<int:item_id>/', download_item_document, name='download-item-master-document'),
    
    # Factory Module - All factory-related endpoints
    path('factory/', include('factory.urls')),
    
    # General endpoints (used by both purchase and factory)
    path('generate-code/', generate_code, name='generate_code'),
    path('options/', get_options, name='get_options'),
    path('related-options/', get_related_options, name='get_related_options'),
    path('subcategories/<int:main_category_id>/', get_subcategories, name='get_subcategories'),
    path('create-item/', create_item, name='create_item'),
    path('create-parameter/', create_parameter, name='create_parameter'),
    path('item-master-data/', get_item_master_data, name='get_item_master_data'),
    path('approve-item-request/<int:request_id>/', approve_item_request, name='approve_item_request'),
    path('reject-item-request/<int:request_id>/', reject_item_request, name='reject_item_request'),

    # Vendor
    path('vendors/', create_vendor, name='vendor-list-create'),
    path('vendors/last-vendor-id/', get_last_vendor_id, name='last-vendor-id'),
    path('vendors/pending/', get_pending_vendors, name='pending-vendors'),
    path('vendors/approved/', get_approved_vendors, name='approved-vendors'),
    path('vendors/rejected/', get_rejected_vendors, name='rejected-vendors'),
    path('vendors/<int:vendor_id>/approve/', approve_vendor, name='approve-vendor'),
    path('vendors/<int:vendor_id>/', update_vendor, name='update-vendor'),
    path('api/vendor-approve-email/<str:vendor_id>/', vendor_approve_email, name='vendor_approve_email'),
    path('api/vendor-reject-email/<str:vendor_id>/', vendor_reject_email, name='vendor_reject_email'),
    path('vendor-approve-page-open/<str:vendor_id>/', vendor_approve_page_open, name='vendor_approve_page_open'),
    path('vendor-reject-page-open/<str:vendor_id>/', vendor_reject_page_open, name='vendor_reject_page_open'),
    path('quick-update-vendor/<int:vendor_id>/', quick_update_vendor, name='quick-update-vendor'),
    # Division Users
    path('api/divisions/<int:division_id>/users/', DivisionUsersView.as_view(), name='division-users'),
    path('divisions/<int:division_id>/users/', DivisionUsersView.as_view(), name='division-users'),

    # Returnable Gate Pass
    path('gate-pass/create/', create_returnable_gate_pass, name='create_returnable_gate_pass'),
    path('gate-passes/', get_returnable_gate_passes, name='get_returnable_gate_passes'), 
    path('gate-pass/<int:gate_pass_id>/', get_returnable_gate_pass, name='get_returnable_gate_pass'),
    path('gate-pass/<int:gate_pass_id>/return/', process_gate_pass_return, name='process_gate_pass_return'),
    path('gate-pass/<int:gate_pass_id>/document/', get_gate_pass_document, name='get_gate_pass_document'),

    # Rejected Material
    path('delivery-challans/', get_delivery_challans, name='get_delivery_challans'),
    path('rejected-material/create/', create_rejected_material_return, name='create_rejected_material_return'),
    path('rejected-materials/', get_rejected_material_returns, name='get_rejected_material_returns'),
    path('rejected-material/<int:return_id>/', get_rejected_material_return, name='get_rejected_material_return'),
    path('rejected-material/<int:return_id>/document/', get_rejected_material_document, name='get_rejected_material_document'),

    # Division Requisitions
    path('division-requisitions/', get_division_requisitions, name='division-requisitions'),
    path('requisitions/division/<int:division_id>/', get_requisitions_by_division, name='requisitions-by-division'),

    # Invoice Management
    path('all-invoices/', get_all_invoices, name='get_all_invoices'),
    path('po-invoices/<str:po_number>/', get_po_invoices, name='get_po_invoices'),
    path('download-invoice/<int:invoice_id>/', download_invoice, name='download_invoice'),
    path('invoice-statistics/', get_invoice_statistics, name='get_invoice_statistics'),
    
    # Admin URLs
    path('api/admin/dashboard-stats/', admin_dashboard_stats, name='admin_dashboard_stats'),
    path('api/admin/users/', admin_get_users, name='admin_get_users'),
    path('api/admin/users/create/', admin_create_user, name='admin_create_user'),
    path('api/admin/users/<int:user_id>/update/', admin_update_user, name='admin_update_user'),
    path('api/admin/users/<int:user_id>/delete/', admin_delete_user, name='admin_delete_user'),
    path('api/admin/divisions/', admin_division_management, name='admin_division_management'),
    path('api/admin/divisions/create/', admin_create_division, name='admin_create_division'),
    path('api/admin/system-overview/', admin_system_overview, name='admin_system_overview'),
    path('api/admin/audit-logs/', admin_audit_logs, name='admin_audit_logs'),
    path('api/admin/alert-details/<str:alert_id>/', admin_alert_details, name='admin_alert_details'),
    # Role Management URLs
    path('api/admin/roles/', admin_get_roles, name='admin_get_roles'),
    path('api/admin/roles/create/', admin_create_role, name='admin_create_role'),
    path('api/admin/roles/<str:role_name>/update/', admin_update_role, name='admin_update_role'),
    path('api/admin/roles/<str:role_name>/delete/', admin_delete_role, name='admin_delete_role'),
    
    # Django Admin
    path('django-admin/', admin.site.urls),

    # Include router URLs
    path('', include(router.urls)),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
