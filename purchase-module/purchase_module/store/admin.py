from django.contrib import admin
from django.contrib.admin import AdminSite
from django.utils.html import format_html
from django.urls import path, reverse
from django.shortcuts import redirect
from django.http import JsonResponse
from django.db.models import Sum, Count, Q
from django.utils import timezone
from datetime import datetime, timedelta
import json

from .models import (
    Inventory, StockAllocation, LocationWiseAllocation, StockOutward,
    ProjectCode, DeliveryChallan, DeliveryChallanItem, InwardEntry,
    ReturnableGatePass, ReturnableGatePassItem, ReturnableGatePassReturn,
    RejectedMaterialReturn, RejectedMaterialItem
)

# Custom Admin Site
class PurchaseModuleAdminSite(AdminSite):
    site_header = "CIMCON Purchase Module Administration"
    site_title = "Purchase Module Admin"
    index_title = "Welcome to Purchase Module Administration"
    site_url = "/"

admin_site = PurchaseModuleAdminSite(name='purchase_admin')

# Custom Admin Classes
@admin.register(Inventory)
class InventoryAdmin(admin.ModelAdmin):
    list_display = ['item_no', 'description', 'make', 'total_stock', 'allocated_stock', 'available_stock', 'get_locations']
    list_filter = ['material_group', 'make', 'inward_entry__location']
    search_fields = ['item_no', 'description', 'make']
    readonly_fields = ['total_stock', 'allocated_stock', 'available_stock']
    ordering = ['item_no']
    
    def get_locations(self, obj):
        locations = []
        if obj.times_sq_stock > 0:
            locations.append(f"Times Square: {obj.times_sq_stock}")
        if obj.i_sq_stock > 0:
            locations.append(f"iSquare: {obj.i_sq_stock}")
        if obj.sakar_stock > 0:
            locations.append(f"Sakar: {obj.sakar_stock}")
        if obj.pirana_stock > 0:
            locations.append(f"Pirana: {obj.pirana_stock}")
        if obj.other_stock > 0:
            locations.append(f"Other: {obj.other_stock}")
        return ", ".join(locations) if locations else "No stock"
    get_locations.short_description = "Location-wise Stock"

@admin.register(StockAllocation)
class StockAllocationAdmin(admin.ModelAdmin):
    list_display = ['inventory', 'project_code', 'allocated_quantity', 'status', 'allocation_date']
    list_filter = ['status', 'allocation_date', 'project_code']
    search_fields = ['inventory__item_no', 'project_code__code__project_code']
    readonly_fields = ['allocation_date']
    ordering = ['-allocation_date']

@admin.register(StockOutward)
class StockOutwardAdmin(admin.ModelAdmin):
    list_display = ['inventory', 'project_code', 'quantity', 'location', 'outward_type', 'document_number', 'outward_date']
    list_filter = ['outward_type', 'document_type', 'location', 'outward_date']
    search_fields = ['inventory__item_no', 'document_number', 'project_code__code__project_code']
    readonly_fields = ['outward_date']
    ordering = ['-outward_date']

@admin.register(InwardEntry)
class InwardEntryAdmin(admin.ModelAdmin):
    list_display = ['po_number', 'item_code', 'description', 'quantity_received', 'inward_status', 'received_date', 'location']
    list_filter = ['inward_status', 'received_date', 'location']
    search_fields = ['po_number', 'item_code', 'description']
    readonly_fields = ['already_inwarded']
    ordering = ['-received_date']

@admin.register(DeliveryChallan)
class DeliveryChallanAdmin(admin.ModelAdmin):
    list_display = ['document_number', 'project_code', 'date', 'total_amount', 'created_by', 'created_at']
    list_filter = ['date', 'created_at']
    search_fields = ['document_number', 'project_code__code__project_code']
    readonly_fields = ['created_at']
    ordering = ['-created_at']

@admin.register(ReturnableGatePass)
class ReturnableGatePassAdmin(admin.ModelAdmin):
    list_display = ['gate_pass_number', 'pass_type', 'issued_to', 'issue_date', 'status', 'created_by']
    list_filter = ['pass_type', 'status', 'issue_date']
    search_fields = ['gate_pass_number', 'issued_to']
    readonly_fields = ['created_at']
    ordering = ['-issue_date']

@admin.register(RejectedMaterialReturn)
class RejectedMaterialReturnAdmin(admin.ModelAdmin):
    list_display = ['challan_number', 'client_name', 'return_date', 'action_taken', 'created_by']
    list_filter = ['action_taken', 'return_date']
    search_fields = ['challan_number', 'client_name']
    readonly_fields = ['created_at']
    ordering = ['-return_date']

# Custom Admin Views
class AdminDashboardView:
    def __init__(self, admin_site):
        self.admin_site = admin_site
    
    def get_dashboard_data(self):
        """Get data for admin dashboard"""
        today = timezone.now().date()
        last_week = today - timedelta(days=7)
        last_month = today - timedelta(days=30)
        
        # Inventory Statistics
        total_items = Inventory.objects.count()
        low_stock_items = Inventory.objects.filter(available_stock__lt=10).count()
        out_of_stock_items = Inventory.objects.filter(available_stock=0).count()
        
        # Recent Activities
        recent_outwards = StockOutward.objects.filter(
            outward_date__date__gte=last_week
        ).count()
        
        recent_inwards = InwardEntry.objects.filter(
            received_date__gte=last_week
        ).count()
        
        recent_challans = DeliveryChallan.objects.filter(
            created_at__date__gte=last_week
        ).count()
        
        # Project Statistics
        active_projects = ProjectCode.objects.filter(
            stock_allocations__status='allocated'
        ).distinct().count()
        
        # Financial Summary
        total_challan_value = DeliveryChallan.objects.filter(
            created_at__date__gte=last_month
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        
        return {
            'total_items': total_items,
            'low_stock_items': low_stock_items,
            'out_of_stock_items': out_of_stock_items,
            'recent_outwards': recent_outwards,
            'recent_inwards': recent_inwards,
            'recent_challans': recent_challans,
            'active_projects': active_projects,
            'total_challan_value': total_challan_value,
        }

# Register models with custom admin site
admin_site.register(Inventory, InventoryAdmin)
admin_site.register(StockAllocation, StockAllocationAdmin)
admin_site.register(LocationWiseAllocation)
admin_site.register(StockOutward, StockOutwardAdmin)
admin_site.register(ProjectCode)
admin_site.register(InwardEntry, InwardEntryAdmin)
admin_site.register(DeliveryChallan, DeliveryChallanAdmin)
admin_site.register(DeliveryChallanItem)
admin_site.register(ReturnableGatePass, ReturnableGatePassAdmin)
admin_site.register(ReturnableGatePassItem)
admin_site.register(ReturnableGatePassReturn)
admin_site.register(RejectedMaterialReturn, RejectedMaterialReturnAdmin)
admin_site.register(RejectedMaterialItem)
