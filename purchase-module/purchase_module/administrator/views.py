# Add these comprehensive admin APIs to your existing store/views.py
from datetime import datetime, timedelta
from django.utils import timezone
from django.db.models import Sum, Count, Q, Avg, Max
from django.db.models.functions import TruncDate, TruncMonth
from rest_framework.decorators import api_view
from rest_framework.response import Response
from users.models import CustomUser, Division, RolePermission
from indent.models import Requisition, Project
from purchase_order.models import PurchaseOrder, POLineItem
from items.models import ItemMaster, ItemRequest
from vendor.models import Vendor
from master.models import Master
from store.models import Inventory, InwardEntry, StockOutward
import json
import os

@api_view(['GET'])
def admin_dashboard_stats(request):
    """
    Comprehensive admin dashboard statistics
    """
    try:
        today = timezone.now().date()
        last_week = today - timedelta(days=7)
        last_month = today - timedelta(days=30)
        last_year = today - timedelta(days=365)
        
        # User Statistics
        total_users = CustomUser.objects.count()
        active_users = CustomUser.objects.filter(is_active=True).count()
        inactive_users = total_users - active_users
        recent_users = CustomUser.objects.filter(date_joined__date__gte=last_week).count()
        
        # Users by role
        users_by_role = {
            'requisitors': CustomUser.objects.filter(role='Requisitor').count(),
            'approvers': CustomUser.objects.filter(role='Approver').count(),
            'purchasers': CustomUser.objects.filter(role='Purchaser').count(),
        }
        
        # Division Statistics
        total_divisions = Division.objects.count()
        divisions_with_users = Division.objects.annotate(
            user_count=Count('custom_users')
        ).filter(user_count__gt=0).count()
        
        # Project Statistics
        total_projects = Project.objects.count()
        active_projects = Project.objects.annotate(
            req_count=Count('requisitions')
        ).filter(req_count__gt=0).count()
        recent_projects = Project.objects.filter(
            requisitions__requisition_date__gte=last_month
        ).distinct().count()
        
        # Requisition Statistics
        total_requisitions = Requisition.objects.count()
        pending_requisitions = Requisition.objects.filter(status='pending').count()
        approved_requisitions = Requisition.objects.filter(status='approved').count()
        rejected_requisitions = Requisition.objects.filter(status='rejected').count()
        recent_requisitions = Requisition.objects.filter(
            requisition_date__gte=last_week
        ).count()
        
        # Purchase Order Statistics
        total_purchase_orders = PurchaseOrder.objects.count()
        pending_pos = PurchaseOrder.objects.filter(status='pending_approval').count()
        approved_pos = PurchaseOrder.objects.filter(status='approved').count()
        rejected_pos = PurchaseOrder.objects.filter(status='rejected').count()
        recent_pos = PurchaseOrder.objects.filter(created_at__date__gte=last_week).count()
        
        # Financial Statistics
        total_po_value = PurchaseOrder.objects.filter(
            status__in=['approved', 'ordered', 'delivered']
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        
        monthly_po_value = PurchaseOrder.objects.filter(
            created_at__date__gte=last_month,
            status__in=['approved', 'ordered', 'delivered']
        ).aggregate(total=Sum('total_amount'))['total'] or 0
        
        avg_po_value = PurchaseOrder.objects.filter(
            status__in=['approved', 'ordered', 'delivered']
        ).aggregate(avg=Avg('total_amount'))['avg'] or 0
        
        # Vendor Statistics - Fixed field name from approval_status to status
        total_vendors = Vendor.objects.count()
        approved_vendors = Vendor.objects.filter(status='approved').count()
        pending_vendors = Vendor.objects.filter(status='pending').count()
        rejected_vendors = Vendor.objects.filter(status='rejected').count()
        
        # Item Statistics
        total_items = ItemMaster.objects.count()
        recent_items = ItemMaster.objects.filter(created_at__date__gte=last_week).count()
        
        # Item Request Statistics
        total_item_requests = ItemRequest.objects.count()
        pending_item_requests = ItemRequest.objects.filter(status='pending').count()
        approved_item_requests = ItemRequest.objects.filter(status='approved').count()
        rejected_item_requests = ItemRequest.objects.filter(status='rejected').count()
        
        # Inventory Statistics
        total_inventory_items = Inventory.objects.count()
        low_stock_items = Inventory.objects.filter(total_stock__lte=10).count()
        out_of_stock_items = Inventory.objects.filter(total_stock=0).count()
        total_inventory_value = Inventory.objects.aggregate(
            total=Sum('total_stock')
        )['total'] or 0
        
        # Inward/Outward Statistics
        total_inward_entries = InwardEntry.objects.count()
        recent_inward = InwardEntry.objects.filter(
            received_date__gte=last_week
        ).count()
        
        total_outward_entries = StockOutward.objects.count()
        recent_outward = StockOutward.objects.filter(
            created_at__date__gte=last_week
        ).count()
        
        # Material Groups Distribution - Simplified query
        material_groups = []
        try:
            material_groups = list(ItemMaster.objects.values('main_category__name').annotate(
                count=Count('id')
            ).filter(main_category__name__isnull=False).order_by('-count')[:10])
        except Exception as e:
            print(f"Error in material groups query: {e}")
        
        # Top projects by requisition count
        top_projects = []
        try:
            top_projects = list(Project.objects.annotate(
                req_count=Count('requisitions')
            ).order_by('-req_count')[:10])
        except Exception as e:
            print(f"Error in top projects query: {e}")
        
        # Top vendors by PO count and value - Simplified since no direct relationship
        top_vendors = []
        try:
            # Get unique vendor names from POs and count them
            vendor_stats = PurchaseOrder.objects.values('vendor_name').annotate(
                po_count=Count('id'),
                total_value=Sum('total_amount')
            ).order_by('-total_value')[:10]
            
            top_vendors = [
                {
                    'vendor_name': v['vendor_name'],
                    'po_count': v['po_count'],
                    'total_value': float(v['total_value'] or 0)
                } for v in vendor_stats
            ]
        except Exception as e:
            print(f"Error in top vendors query: {e}")
        
        return Response({
            # User Statistics
            'total_users': total_users,
            'active_users': active_users,
            'inactive_users': inactive_users,
            'recent_users': recent_users,
            'users_by_role': users_by_role,
            
            # Division Statistics
            'total_divisions': total_divisions,
            'divisions_with_users': divisions_with_users,
            
            # Project Statistics
            'total_projects': total_projects,
            'active_projects': active_projects,
            'recent_projects': recent_projects,
            
            # Requisition Statistics
            'total_requisitions': total_requisitions,
            'pending_requisitions': pending_requisitions,
            'approved_requisitions': approved_requisitions,
            'rejected_requisitions': rejected_requisitions,
            'recent_requisitions': recent_requisitions,
            
            # Purchase Order Statistics
            'total_purchase_orders': total_purchase_orders,
            'pending_pos': pending_pos,
            'approved_pos': approved_pos,
            'rejected_pos': rejected_pos,
            'recent_pos': recent_pos,
            
            # Financial Statistics
            'total_po_value': float(total_po_value),
            'monthly_po_value': float(monthly_po_value),
            'avg_po_value': float(avg_po_value),
            
            # Vendor Statistics
            'total_vendors': total_vendors,
            'approved_vendors': approved_vendors,
            'pending_vendors': pending_vendors,
            'rejected_vendors': rejected_vendors,
            
            # Item Statistics
            'total_items': total_items,
            'recent_items': recent_items,
            'total_item_requests': total_item_requests,
            'pending_item_requests': pending_item_requests,
            'approved_item_requests': approved_item_requests,
            'rejected_item_requests': rejected_item_requests,
            
            # Inventory Statistics
            'total_inventory_items': total_inventory_items,
            'low_stock_items': low_stock_items,
            'out_of_stock_items': out_of_stock_items,
            'total_inventory_value': float(total_inventory_value),
            
            # Inward/Outward Statistics
            'total_inward_entries': total_inward_entries,
            'recent_inward': recent_inward,
            'total_outward_entries': total_outward_entries,
            'recent_outward': recent_outward,
            
            # Charts and Analytics Data
            'material_groups': material_groups,
            'top_projects': [
                {
                    'project_code': p.project_code,
                    'client_project_name': p.client_project_name,
                    'req_count': p.req_count
                } for p in top_projects
            ],
            'top_vendors': top_vendors,
        })
        
    except Exception as e:
        print(f"Error in admin_dashboard_stats: {e}")
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def admin_get_users(request):
    """
    Get all users with comprehensive details for admin management
    """
    try:
        # Get query parameters for filtering and pagination
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 25))
        search = request.GET.get('search', '')
        role_filter = request.GET.get('role', '')
        division_filter = request.GET.get('division', '')
        status_filter = request.GET.get('status', '')
        
        # Base queryset with optimized joins - Filter out Developer users
        users = CustomUser.objects.select_related('division').exclude(role='Developer')
        
        # Apply filters
        if search:
            users = users.filter(
                Q(username__icontains=search) |
                Q(first_name__icontains=search) |
                Q(last_name__icontains=search) |
                Q(email__icontains=search)
            )
        
        if role_filter:
            users = users.filter(role=role_filter)
            
        if division_filter:
            users = users.filter(division_id=division_filter)
            
        if status_filter == 'active':
            users = users.filter(is_active=True)
        elif status_filter == 'inactive':
            users = users.filter(is_active=False)
        
        # Get total count for pagination
        total_count = users.count()
        
        # Apply pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        paginated_users = users[start_index:end_index]
        
        # Prepare user data with additional statistics
        user_data = []
        for user in paginated_users:
            # Get user activity statistics
            user_requisitions = Requisition.objects.filter(submitted_by=user.username).count()
            user_pos = PurchaseOrder.objects.filter(created_by=user.username).count()
            last_login_date = user.last_login.date() if user.last_login else None
            
            user_data.append({
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': user.get_full_name(),
                'role': user.role,
                'division_id': user.division.id if user.division else None,
                'division_name': user.division.division_name if user.division else None,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser,
                'date_joined': user.date_joined,
                'last_login': user.last_login,
                'last_login_date': last_login_date,
                'user_requisitions': user_requisitions,
                'user_pos': user_pos,
            })
        
        # Get divisions for dropdown
        divisions = Division.objects.all()
        division_data = [
            {
                'id': division.id,
                'division_name': division.division_name,
                'user_count': division.custom_users.exclude(role='Developer').count()  # Exclude Developer users from division counts
            } for division in divisions
        ]
        
        # Get role choices - Filter out Developer
        role_choices = [
            {'value': choice[0], 'label': choice[1]} 
            for choice in CustomUser.ROLE_CHOICES
            if choice[0] != 'Developer'  # Filter out Developer role
        ]
        
        return Response({
            'users': user_data,
            'divisions': division_data,
            'role_choices': role_choices,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_count': total_count,
                'total_pages': (total_count + page_size - 1) // page_size,
                'has_next': end_index < total_count,
                'has_previous': page > 1
            }
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['POST'])
def admin_create_user(request):
    """
    Create a new user with comprehensive validation
    """
    try:
        data = request.data
        
        # Required fields validation
        required_fields = ['username', 'email', 'first_name', 'last_name', 'role']
        missing_fields = [field for field in required_fields if not data.get(field)]
        
        if missing_fields:
            return Response({
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }, status=400)
        
        # Check for existing user
        if CustomUser.objects.filter(username=data['username']).exists():
            return Response({
                'error': 'Username already exists'
            }, status=400)
        
        if CustomUser.objects.filter(email=data['email']).exists():
            return Response({
                'error': 'Email already exists'
            }, status=400)
        
        # Validate role
        valid_roles = [choice[0] for choice in CustomUser.ROLE_CHOICES]
        if data['role'] not in valid_roles:
            return Response({
                'error': f'Invalid role. Valid roles are: {", ".join(valid_roles)}'
            }, status=400)
        
        # Get division if provided
        division = None
        if data.get('division_id'):
            try:
                division = Division.objects.get(id=data['division_id'])
            except Division.DoesNotExist:
                return Response({
                    'error': 'Invalid division ID'
                }, status=400)
        
        # Create user
        user = CustomUser.objects.create_user(
            username=data['username'],
            email=data['email'],
            first_name=data['first_name'],
            last_name=data['last_name'],
            password=data.get('password', 'defaultpassword123'),
            role=data['role'],
            division=division,
            is_active=data.get('is_active', True),
            is_staff=data.get('is_staff', False),
            is_superuser=data.get('is_superuser', False)
        )
        
        return Response({
            'message': 'User created successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': user.get_full_name(),
                'role': user.role,
                'division_name': user.division.division_name if user.division else None,
                'is_active': user.is_active
            }
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['PUT'])
def admin_update_user(request, user_id):
    """
    Update user details
    """
    try:
        user = CustomUser.objects.get(id=user_id)
        data = request.data
        
        # Update basic fields
        if 'first_name' in data:
            user.first_name = data['first_name']
        if 'last_name' in data:
            user.last_name = data['last_name']
        if 'email' in data:
            # Check if email is already taken by another user
            if CustomUser.objects.filter(email=data['email']).exclude(id=user_id).exists():
                return Response({
                    'error': 'Email already exists'
                }, status=400)
            user.email = data['email']
        
        if 'role' in data:
            valid_roles = [choice[0] for choice in CustomUser.ROLE_CHOICES]
            if data['role'] not in valid_roles:
                return Response({
                    'error': f'Invalid role. Valid roles are: {", ".join(valid_roles)}'
                }, status=400)
            user.role = data['role']
        
        if 'division_id' in data:
            if data['division_id']:
                try:
                    division = Division.objects.get(id=data['division_id'])
                    user.division = division
                except Division.DoesNotExist:
                    return Response({
                        'error': 'Invalid division ID'
                    }, status=400)
            else:
                user.division = None
        
        if 'is_active' in data:
            user.is_active = data['is_active']
        if 'is_staff' in data:
            user.is_staff = data['is_staff']
        if 'is_superuser' in data:
            user.is_superuser = data['is_superuser']
        
        # Update password if provided
        if 'password' in data and data['password']:
            user.set_password(data['password'])
        
        user.save()
        
        return Response({
            'message': 'User updated successfully',
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'first_name': user.first_name,
                'last_name': user.last_name,
                'full_name': user.get_full_name(),
                'role': user.role,
                'division_name': user.division.division_name if user.division else None,
                'is_active': user.is_active,
                'is_staff': user.is_staff,
                'is_superuser': user.is_superuser
            }
        })
        
    except CustomUser.DoesNotExist:
        return Response({
            'error': 'User not found'
        }, status=404)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['DELETE'])
def admin_delete_user(request, user_id):
    """
    Delete a user (with safety checks)
    """
    try:
        user = CustomUser.objects.get(id=user_id)
        
        # Safety check - don't allow deletion of superusers
        if user.is_superuser:
            return Response({
                'error': 'Cannot delete superuser accounts'
            }, status=400)
        
        # Check if user has related data
        user_requisitions = Requisition.objects.filter(submitted_by=user.username).count()
        user_pos = PurchaseOrder.objects.filter(created_by=user.username).count()
        
        if user_requisitions > 0 or user_pos > 0:
            # Instead of deleting, deactivate the user
            user.is_active = False
            user.save()
            return Response({
                'message': f'User deactivated instead of deleted due to existing data (Requisitions: {user_requisitions}, POs: {user_pos})'
            })
        
        username = user.username
        user.delete()
        
        return Response({
            'message': f'User {username} deleted successfully'
        })
        
    except CustomUser.DoesNotExist:
        return Response({
            'error': 'User not found'
        }, status=404)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def admin_division_management(request):
    """
    Get division management data with statistics
    """
    try:
        divisions = Division.objects.annotate(
            user_count=Count('custom_users'),
            active_user_count=Count('custom_users', filter=Q(custom_users__is_active=True)),
            project_count=Count('project'),
            requisition_count=Count('project__requisitions')
        ).order_by('division_name')
        
        division_data = []
        for division in divisions:
            division_data.append({
                'id': division.id,
                'division_name': division.division_name,
                'user_count': division.user_count,
                'active_user_count': division.active_user_count,
                'project_count': division.project_count,
                'requisition_count': division.requisition_count,
                'users': [
                    {
                        'id': user.id,
                        'username': user.username,
                        'full_name': user.get_full_name(),
                        'role': user.role,
                        'is_active': user.is_active
                    } for user in division.custom_users.all()[:10]  # Limit to first 10 users
                ]
            })
        
        return Response({
            'divisions': division_data,
            'total_divisions': len(division_data)
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['POST'])
def admin_create_division(request):
    """
    Create a new division
    """
    try:
        data = request.data
        division_name = data.get('division_name', '').strip()
        
        if not division_name:
            return Response({
                'error': 'Division name is required'
            }, status=400)
        
        # Check if division already exists
        if Division.objects.filter(division_name__iexact=division_name).exists():
            return Response({
                'error': 'Division with this name already exists'
            }, status=400)
        
        division = Division.objects.create(
            division_name=division_name
        )
        
        return Response({
            'message': 'Division created successfully',
            'division': {
                'id': division.id,
                'division_name': division.division_name,
                'user_count': 0,
                'project_count': 0
            }
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def admin_system_overview(request):
    """
    Get comprehensive system overview for admin dashboard
    """
    try:
        # System health metrics
        total_database_records = (
            CustomUser.objects.count() +
            Project.objects.count() +
            Requisition.objects.count() +
            PurchaseOrder.objects.count() +
            ItemMaster.objects.count() +
            Vendor.objects.count()
        )
        
        # Recent activity (last 24 hours)
        yesterday = timezone.now() - timedelta(days=1)
        recent_activity = {
            'new_users': CustomUser.objects.filter(date_joined__gte=yesterday).count(),
            'new_requisitions': Requisition.objects.filter(requisition_date__gte=yesterday.date()).count(),
            'new_pos': PurchaseOrder.objects.filter(created_at__gte=yesterday).count(),
            'new_vendors': 0,  # Vendor model doesn't have created_at field
        }
        
        # System alerts
        alerts = []
        
        # Check for pending approvals
        pending_requisitions = Requisition.objects.filter(status='pending').count()
        if pending_requisitions > 10:
            alerts.append({
                'type': 'warning',
                'title': 'High Pending Requisitions',
                'message': f'{pending_requisitions} requisitions are pending approval',
                'action_url': '/admin/requisitions?status=pending'
            })
        
        pending_pos = PurchaseOrder.objects.filter(status='pending_approval').count()
        if pending_pos > 5:
            alerts.append({
                'type': 'warning',
                'title': 'Pending Purchase Orders',
                'message': f'{pending_pos} purchase orders need approval',
                'action_url': '/admin/purchase-orders?status=pending_approval'
            })
        
        # Check for low stock - Fixed field name
        low_stock_count = Inventory.objects.filter(total_stock__lte=10).count()
        if low_stock_count > 0:
            alerts.append({
                'type': 'error',
                'title': 'Low Stock Alert',
                'message': f'{low_stock_count} items are running low on stock',
                'action_url': '/admin/inventory?filter=low_stock'
            })
        
        # Check for inactive users with recent activity
        inactive_users_with_data = CustomUser.objects.filter(
            is_active=False,
            last_login__gte=timezone.now() - timedelta(days=30)
        ).count()
        
        if inactive_users_with_data > 0:
            alerts.append({
                'type': 'info',
                'title': 'Inactive Users',
                'message': f'{inactive_users_with_data} recently active users are now inactive',
                'action_url': '/admin/users?status=inactive'
            })
        
        return Response({
            'system_health': {
                'total_records': total_database_records,
                'uptime_days': (timezone.now().date() - datetime(2024, 1, 1).date()).days,  # Adjust start date
                'active_users_today': CustomUser.objects.filter(
                    last_login__date=timezone.now().date()
                ).count()
            },
            'recent_activity': recent_activity,
            'alerts': alerts,
            'quick_stats': {
                'pending_approvals': pending_requisitions + pending_pos,
                'low_stock_items': low_stock_count,
                'inactive_users': CustomUser.objects.filter(is_active=False).count(),
                'total_value': float(
                    PurchaseOrder.objects.filter(
                        status__in=['approved', 'ordered', 'delivered']
                    ).aggregate(total=Sum('total_amount'))['total'] or 0
                )
            }
        })
        
    except Exception as e:
        print(f"Error in admin_system_overview: {e}")
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def admin_audit_logs(request):
    """
    Get audit logs for admin monitoring
    """
    try:
        page = int(request.GET.get('page', 1))
        page_size = int(request.GET.get('page_size', 50))
        
        # Combine different types of logs
        logs = []
        
        # Requisition history
        req_history = Requisition.objects.select_related('project').order_by('-id')[:100]
        for req in req_history:
            logs.append({
                'timestamp': req.requisition_date,
                'type': 'requisition',
                'action': f'Requisition {req.status}',
                'user': req.submitted_by,
                'details': f'Project: {req.project.project_code if req.project else "N/A"}, Items: {req.req_qty}',
                'status': req.status
            })
        
        # PO history
        po_history = PurchaseOrder.objects.order_by('-created_at')[:100]
        for po in po_history:
            logs.append({
                'timestamp': po.created_at.date(),
                'type': 'purchase_order',
                'action': f'PO {po.status}',
                'user': po.created_by,
                'details': f'PO: {po.po_number}, Value: {po.total_amount}',
                'status': po.status
            })
        
        # Sort logs by timestamp
        logs.sort(key=lambda x: x['timestamp'], reverse=True)
        
        # Apply pagination
        start_index = (page - 1) * page_size
        end_index = start_index + page_size
        paginated_logs = logs[start_index:end_index]
        
        return Response({
            'logs': paginated_logs,
            'pagination': {
                'page': page,
                'page_size': page_size,
                'total_count': len(logs),
                'total_pages': (len(logs) + page_size - 1) // page_size
            }
        })
        
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def admin_get_roles(request):
    """
    Get all roles with their permissions and statistics
    """
    try:
        # Define available modules/paths
        available_modules = {
            "home": "Dashboard",
            "requisition-form": "Create Requisition",
            "edit-requisition": "Edit Requisition", 
            "approval-table": "Approval Table",
            "inventory": "Inventory Management",
            "master-table": "Master Table",
            "PO": "Purchase Orders",
            "vendor-registration": "Vendor Registration",
            "vendor-approval": "Vendor Approval",
            "vendor-edit": "Vendor Edit",
            "vendor-data": "Vendor Database",
            "item-data": "Item Database",
            "item-generator": "Item Generator",
            "item-approval": "Item Approval",
            "item-submitter": "Item Submitter",
            "inward": "Inward Management",
            "outward": "Outward Management",
            "allocate": "Stock Allocation",
            "gatepass": "Gate Pass",
            "returnable": "Returnable Gate Pass",
            "rejected-materials": "Rejected Materials",
            "requisition-verification": "Requisition Verification",
            "po-approval": "PO Approval",
            "po-edit": "PO Edit",
            "po-line-items": "PO Line Items",
            "po-preview": "PO Preview",
            "invoice-tracker": "Invoice Tracker",
            "admin": "Admin Panel"
        }
        
        # Get roles from database or create default ones
        role_config = {}
        default_roles = {
            "Requisitor": {
                "allowedPaths": [
                    "/home",
                    "/requisition-form", 
                    "/edit-requisition",
                    "/inventory",
                    "/master-table",
                    "/PO",
                    "/vendor-data",
                    "/item-data",
                    "/item-generator"
                ],
                "description": "Can create and edit requisitions, view inventory and items"
            },
            "Approver": {
                "allowedPaths": [
                    "/home",
                    "/approval-table",
                    "/inventory", 
                    "/master-table",
                    "/PO",
                    "/vendor-data",
                    "/item-data"
                ],
                "description": "Can approve requisitions and purchase orders"
            },
            "Purchaser": {
                "allowedPaths": [
                    "/home",
                    "/master-table",
                    "/PO",
                    "/vendor-registration",
                    "/vendor-data", 
                    "/item-data",
                    "/item-generator"
                ],
                "description": "Can manage purchase orders and vendors"
            },
            "Admin": {
                "allowedPaths": "all",
                "description": "Full system access including admin panel"
            }
        }
        
        # Get or create role permissions from database
        for role_name, default_config in default_roles.items():
            role_permission, created = RolePermission.objects.get_or_create(
                role_name=role_name,
                defaults={
                    'description': default_config['description'],
                    'allowed_paths': default_config['allowedPaths'] if default_config['allowedPaths'] != "all" else []
                }
            )
            
            if created:
                print(f"Created default role: {role_name}")
            
            role_config[role_name] = {
                'role_name': role_permission.role_name,
                'description': role_permission.description,
                'allowedPaths': role_permission.get_allowed_paths() if role_permission.get_allowed_paths() else "all"
            }
        
        # Get statistics for each role - Filter out Developer
        role_stats = {}
        for role_name in role_config.keys():
            users_with_role = CustomUser.objects.filter(role=role_name)
            role_stats[role_name] = {
                "total_users": users_with_role.count(),
                "active_users": users_with_role.filter(is_active=True).count(),
                "recent_users": users_with_role.filter(date_joined__date__gte=timezone.now().date() - timedelta(days=30)).count(),
                "total_requisitions": Requisition.objects.filter(submitted_by__in=users_with_role.values_list('username', flat=True)).count(),
                "total_pos": PurchaseOrder.objects.filter(created_by__in=users_with_role.values_list('username', flat=True)).count(),
                "last_activity": users_with_role.aggregate(last_login=Max('last_login'))['last_login']
            }
        
        # Get module access statistics - Filter out Developer
        module_stats = {}
        for module_path, module_name in available_modules.items():
            if module_path == "admin":
                # Only Admin role can access admin
                module_stats[module_path] = {
                    "name": module_name,
                    "accessible_by": ["Admin"],
                    "user_count": CustomUser.objects.filter(role="Admin").count()
                }
            else:
                # Count users who can access this module
                accessible_roles = []
                for role_name, config in role_config.items():
                    if config["allowedPaths"] == "all" or f"/{module_path}" in config["allowedPaths"]:
                        accessible_roles.append(role_name)
                
                module_stats[module_path] = {
                    "name": module_name,
                    "accessible_by": accessible_roles,
                    "user_count": CustomUser.objects.filter(role__in=accessible_roles).count()
                }
        
        return Response({
            'roles': role_config,
            'role_stats': role_stats,
            'module_stats': module_stats,
            'available_modules': available_modules
        })
        
    except Exception as e:
        print(f"Error in admin_get_roles: {e}")
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['PUT'])
def admin_update_role(request, role_name):
    """
    Update an existing role's permissions
    """
    try:
        data = request.data
        description = data.get('description', '').strip()
        allowed_paths = data.get('allowed_paths', [])
        
        # Validate allowed paths
        valid_paths = [
            "/home", "/requisition-form", "/edit-requisition", "/approval-table",
            "/inventory", "/master-table", "/PO", "/vendor-registration", 
            "/vendor-approval", "/vendor-edit", "/vendor-data", "/item-data",
            "/item-generator", "/item-approval", "/item-submitter", "/inward",
            "/outward", "/allocate", "/gatepass", "/returnable", "/rejected-materials",
            "/requisition-verification", "/po-approval", "/po-edit", "/po-line-items",
            "/po-preview", "/invoice-tracker"
        ]
        
        invalid_paths = [path for path in allowed_paths if path not in valid_paths]
        if invalid_paths:
            return Response({
                'error': f'Invalid paths: {", ".join(invalid_paths)}'
            }, status=400)
        
        # Check if role exists in database
        try:
            role_permission = RolePermission.objects.get(role_name=role_name)
        except RolePermission.DoesNotExist:
            return Response({
                'error': 'Role not found'
            }, status=404)
        
        # Update the role permission
        role_permission.description = description
        role_permission.set_allowed_paths(allowed_paths)
        role_permission.save()
        
        # Return updated role data
        updated_role = {
            'role_name': role_permission.role_name,
            'description': role_permission.description,
            'allowedPaths': role_permission.get_allowed_paths(),
            'updated_at': role_permission.updated_at.isoformat()
        }
        
        return Response({
            'message': 'Role updated successfully',
            'role': updated_role
        })
        
    except Exception as e:
        print(f"Error in admin_update_role: {e}")
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['POST'])
def admin_create_role(request):
    """
    Create a new custom role
    """
    try:
        data = request.data
        role_name = data.get('role_name', '').strip()
        description = data.get('description', '').strip()
        allowed_paths = data.get('allowed_paths', [])
        
        if not role_name:
            return Response({
                'error': 'Role name is required'
            }, status=400)
        
        # Check if role already exists
        if RolePermission.objects.filter(role_name=role_name).exists():
            return Response({
                'error': 'Role already exists'
            }, status=400)
        
        # Validate allowed paths
        valid_paths = [
            "/home", "/requisition-form", "/edit-requisition", "/approval-table",
            "/inventory", "/master-table", "/PO", "/vendor-registration", 
            "/vendor-approval", "/vendor-edit", "/vendor-data", "/item-data",
            "/item-generator", "/item-approval", "/item-submitter", "/inward",
            "/outward", "/allocate", "/gatepass", "/returnable", "/rejected-materials",
            "/requisition-verification", "/po-approval", "/po-edit", "/po-line-items",
            "/po-preview", "/invoice-tracker"
        ]
        
        invalid_paths = [path for path in allowed_paths if path not in valid_paths]
        if invalid_paths:
            return Response({
                'error': f'Invalid paths: {", ".join(invalid_paths)}'
            }, status=400)
        
        # Create the new role permission
        role_permission = RolePermission.objects.create(
            role_name=role_name,
            description=description,
            allowed_paths=allowed_paths
        )
        
        # Return created role data
        new_role = {
            'role_name': role_permission.role_name,
            'description': role_permission.description,
            'allowedPaths': role_permission.get_allowed_paths(),
            'created_at': role_permission.created_at.isoformat()
        }
        
        return Response({
            'message': 'Role created successfully',
            'role': new_role
        })
        
    except Exception as e:
        print(f"Error in admin_create_role: {e}")
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['DELETE'])
def admin_delete_role(request, role_name):
    """
    Delete a custom role (only if no users are assigned to it)
    """
    try:
        # Check if role exists
        try:
            role_permission = RolePermission.objects.get(role_name=role_name)
        except RolePermission.DoesNotExist:
            return Response({
                'error': 'Role not found'
            }, status=404)
        
        # Check if any users are assigned to this role
        users_with_role = CustomUser.objects.filter(role=role_name).count()
        if users_with_role > 0:
            return Response({
                'error': f'Cannot delete role. {users_with_role} users are currently assigned to this role.'
            }, status=400)
        
        # Delete the role permission
        role_permission.delete()
        
        return Response({
            'message': f'Role {role_name} deleted successfully'
        })
        
    except Exception as e:
        print(f"Error in admin_delete_role: {e}")
        return Response({
            'error': str(e)
        }, status=500)

@api_view(['GET'])
def admin_alert_details(request, alert_id):
    """
    Get detailed information for a specific alert with line items
    """
    try:
        # Get actual data from database based on alert type
        alert_details = {}
        
        if alert_id == "pending-requisitions":
            # Get pending requisitions with line items
            pending_reqs = Requisition.objects.filter(status='pending').select_related('project')
            
            line_items = []
            for req in pending_reqs[:10]:  # Limit to 10 for performance
                req_line_items = req.requisitionlineitem_set.all()[:5]  # Limit to 5 items per req
                for item in req_line_items:
                    line_items.append({
                        "id": f"REQ-{req.id}-{item.id}",
                        "name": item.item_description or "N/A",
                        "type": "Requisition Line Item",
                        "status": req.status,
                        "quantity": item.quantity,
                        "unit": item.unit,
                        "project": req.project.client_project_name if req.project else "N/A",
                        "requester": f"{req.requester.first_name} {req.requester.last_name}" if req.requester else "N/A",
                        "date": req.requisition_date.strftime("%Y-%m-%d") if req.requisition_date else "N/A"
                    })
            
            alert_details = {
                "id": "pending-requisitions",
                "type": "warning",
                "title": "Pending Requisitions",
                "message": f"There are {pending_reqs.count()} pending requisitions that require attention",
                "timestamp": timezone.now().isoformat(),
                "priority": "medium",
                "category": "Requisitions",
                "action_required": True,
                "action_url": "/requisitions",
                "recommendations": [
                    "Review pending requisitions in the requisition module",
                    "Check if approvers are available and active",
                    "Consider escalating high-priority items",
                    "Verify item specifications and quantities"
                ],
                "affected_items": line_items,
                "metadata": {
                    "count": pending_reqs.count(),
                    "oldest_pending": pending_reqs.order_by('requisition_date').first().requisition_date.strftime("%Y-%m-%d") if pending_reqs.exists() else "N/A",
                    "divisions_affected": list(set([req.requester.division.division_name for req in pending_reqs if req.requester and req.requester.division]))
                }
            }
            
        elif alert_id == "pending-pos":
            # Get pending purchase orders with line items
            pending_pos = PurchaseOrder.objects.filter(status='pending_approval').select_related('project')
            
            line_items = []
            for po in pending_pos[:10]:  # Limit to 10 for performance
                po_line_items = po.polineitem_set.all()[:5]  # Limit to 5 items per PO
                for item in po_line_items:
                    line_items.append({
                        "id": f"PO-{po.id}-{item.id}",
                        "name": item.item_description or "N/A",
                        "type": "Purchase Order Line Item",
                        "status": po.status,
                        "quantity": item.quantity,
                        "unit": item.unit,
                        "rate": float(item.rate) if item.rate else 0,
                        "amount": float(item.amount) if item.amount else 0,
                        "vendor": po.vendor_name or "N/A",
                        "project": po.project.client_project_name if po.project else "N/A",
                        "date": po.created_at.strftime("%Y-%m-%d") if po.created_at else "N/A"
                    })
            
            alert_details = {
                "id": "pending-pos",
                "type": "error",
                "title": "Pending Purchase Orders",
                "message": f"Purchase orders worth ₹{sum([po.total_amount or 0 for po in pending_pos]):,.2f} are awaiting approval",
                "timestamp": timezone.now().isoformat(),
                "priority": "high",
                "category": "Purchase Orders",
                "action_required": True,
                "action_url": "/purchase-orders",
                "recommendations": [
                    "Review purchase orders for accuracy",
                    "Check vendor information and pricing",
                    "Ensure all required approvals are in place",
                    "Verify line item specifications"
                ],
                "affected_items": line_items,
                "metadata": {
                    "count": pending_pos.count(),
                    "total_value": sum([po.total_amount or 0 for po in pending_pos]),
                    "vendors_affected": len(set([po.vendor_name for po in pending_pos if po.vendor_name]))
                }
            }
            
        elif alert_id == "low-stock-items":
            # Get low stock items from inventory
            low_stock_items = Inventory.objects.filter(total_stock__lte=10).select_related('item')
            
            line_items = []
            for inv in low_stock_items[:15]:  # Limit to 15 items
                line_items.append({
                    "id": f"INV-{inv.id}",
                    "name": inv.item.item_description if inv.item else "N/A",
                    "type": "Inventory Item",
                    "status": "low_stock",
                    "current_stock": inv.total_stock,
                    "min_stock": 10,
                    "item_code": inv.item.item_code if inv.item else "N/A",
                    "category": inv.item.main_category.name if inv.item and inv.item.main_category else "N/A",
                    "last_updated": inv.updated_at.strftime("%Y-%m-%d") if inv.updated_at else "N/A"
                })
            
            alert_details = {
                "id": "low-stock-items",
                "type": "warning",
                "title": "Low Stock Items",
                "message": f"{low_stock_items.count()} items are running low on stock",
                "timestamp": timezone.now().isoformat(),
                "priority": "medium",
                "category": "Inventory",
                "action_required": True,
                "action_url": "/inventory",
                "recommendations": [
                    "Review inventory levels for critical items",
                    "Create requisitions for low stock items",
                    "Check supplier lead times",
                    "Consider bulk ordering for frequently used items"
                ],
                "affected_items": line_items,
                "metadata": {
                    "count": low_stock_items.count(),
                    "critical_items": low_stock_items.filter(total_stock=0).count(),
                    "estimated_shortage_days": 7
                }
            }
            
        elif alert_id == "pending-item-requests":
            # Get pending item requests
            pending_requests = ItemRequest.objects.filter(status='pending').select_related('requester')
            
            line_items = []
            for req in pending_requests[:10]:  # Limit to 10
                line_items.append({
                    "id": f"ITEM-REQ-{req.id}",
                    "name": req.item_name or "N/A",
                    "type": "Item Request",
                    "status": req.status,
                    "description": req.description or "N/A",
                    "category": req.category or "N/A",
                    "requester": f"{req.requester.first_name} {req.requester.last_name}" if req.requester else "N/A",
                    "date": req.created_at.strftime("%Y-%m-%d") if req.created_at else "N/A"
                })
            
            alert_details = {
                "id": "pending-item-requests",
                "type": "info",
                "title": "Pending Item Requests",
                "message": f"{pending_requests.count()} item requests are awaiting approval",
                "timestamp": timezone.now().isoformat(),
                "priority": "low",
                "category": "Items",
                "action_required": False,
                "action_url": "/items",
                "recommendations": [
                    "Review item requests for completeness",
                    "Check if items already exist in the system",
                    "Verify item specifications",
                    "Consider creating master items for frequently requested items"
                ],
                "affected_items": line_items,
                "metadata": {
                    "count": pending_requests.count(),
                    "requested_by": list(set([f"{req.requester.first_name} {req.requester.last_name}" for req in pending_requests if req.requester])),
                    "categories": list(set([req.category for req in pending_requests if req.category]))
                }
            }
        
        else:
            # Fallback for unknown alert types
            alert_details = {
                "id": alert_id,
                "type": "info",
                "title": "System Alert",
                "message": "General system information",
                "timestamp": timezone.now().isoformat(),
                "priority": "medium",
                "category": "System",
                "action_required": False,
                "recommendations": [
                    "Review the system logs for more information",
                    "Check related modules for potential issues",
                    "Contact system administrator if problem persists"
                ],
                "affected_items": []
            }
        
        return Response(alert_details)
        
    except Exception as e:
        return Response(
            {"error": f"Failed to fetch alert details: {str(e)}"}, 
            status=500
        )