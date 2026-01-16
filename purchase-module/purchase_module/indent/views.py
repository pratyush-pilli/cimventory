from django.db import transaction
from django.http import JsonResponse
from rest_framework.decorators import api_view
from indent.models import Project, Requisition, RequisitionHistory
from indent.serializers import ProjectSerializer, RequisitionHistorySerializer, RequisitionSerializer
import json
import logging
from rest_framework import viewsets, status
from rest_framework.response import Response
from indent.models import Requisition
from django.db import transaction
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from rest_framework.decorators import action
from master.models import Master
from django.contrib.auth.models import User
from users.models import CustomUser
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import api_view, permission_classes
from email.mime.multipart import MIMEMultipart
from items.models import ItemMaster
from email.mime.text import MIMEText
import smtplib
import re
from django.http import JsonResponse
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from django.http import HttpResponse
import requests
import time
from django.core.mail import send_mail
from django.conf import settings
from django.core.cache import cache
import threading
from django.core.exceptions import PermissionDenied
from users.models import Division
from django.core.cache import cache



logger = logging.getLogger(__name__)
class RequisitionViewSet(viewsets.ModelViewSet):
    serializer_class = RequisitionSerializer
    # permission_classes = [IsAuthenticated]  # COMMENTED OUT - No authentication

    def get_queryset(self):
        """Return all requisitions without division filtering"""
        # SIMPLIFIED: Just return all requisitions      
        return Requisition.objects.select_related(
            'project',
            'project__division'
        ).all()
    
    
def get_user_division_or_403(user):
    """FIXED: Helper function to get user's division or raise 403"""
    try:
        print(f"DEBUG: Getting division for user {user.username} (ID: {user.id})")
        
        # Check if user is authenticated
        if not user.is_authenticated:
            raise PermissionDenied("User not authenticated")
        
        # Try to get division directly first
        if hasattr(user, 'division') and user.division:
            print(f"DEBUG: Found division directly: {user.division}")
            return user.division
        
        # If division not directly accessible, fetch CustomUser by username (not ID)
        try:
            custom_user = CustomUser.objects.select_related('division').get(username=user.username)
            print(f"DEBUG: Found CustomUser by username: {custom_user.username}, Division: {custom_user.division}")
            
            if custom_user.division:
                return custom_user.division
            else:
                raise PermissionDenied("User has no division assigned")
                
        except CustomUser.DoesNotExist:
            print(f"DEBUG: CustomUser not found for username: {user.username}")
            raise PermissionDenied("User not found in system")
            
    except Exception as e:
        print(f"DEBUG: Exception in get_user_division_or_403: {str(e)}")
        logger.error(f"Error getting user division: {str(e)}")
        raise PermissionDenied(f"Could not determine user division: {str(e)}")


@api_view(['POST'])
# @permission_classes([IsAuthenticated])
def create_project(request):
    """ENHANCED: Automatically use user's division for new projects"""
    try:
        # REMOVED: user = request.user
        # REMOVED: user_division = get_user_division_or_403(user)
        
        data = json.loads(request.body.decode('utf-8'))
        project_code = data.get("project_code")
        client_project_name = data.get("client_project_name")
        approved_by = data.get("approved_by")
        submitted_by = data.get("submitted_by", "User")
        requested_by = data.get("requested_by")
        bill_to = data.get("bill_to")
        ship_to = data.get("ship_to")
        division_id = data.get("division_id") or data.get("division") 

        # Validate required fields
        if not all([project_code, client_project_name, approved_by, requested_by]):
            return JsonResponse({"error": "All fields are required."}, status=400)

        # Check if project already exists
        if Project.objects.filter(project_code=project_code).exists():
            return JsonResponse({"error": "Project code already exists."}, status=400)

        # Get division
        try:
            division = Division.objects.get(id=division_id)
        except Division.DoesNotExist:
            return JsonResponse({"error": "Invalid division."}, status=400)

        # Create project
        project = Project(
            project_code=project_code,
            client_project_name=client_project_name,
            approved_by=approved_by,
            submitted_by=submitted_by,
            requested_by=requested_by,
            division=division,
            bill_to=bill_to,
            ship_to=ship_to,
        )
        project.save()
        
        return JsonResponse({
            "message": "Project created successfully.",
            "division_id": division.id,
            "division_name": division.division_name
        }, status=201)

    except Exception as e:
        logger.exception(f"Error creating project: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)

@api_view(['POST'])
# @permission_classes([IsAuthenticated])  # Keep commented out
def save_requisition(request):
    """ENHANCED: Send emails based on user's division"""
    try:
        data = json.loads(request.body.decode('utf-8'))
        requisitions_data = data.get('requisitions', [])
        project_code = data.get('project_code')
        requested_by = data.get('requested_by')
        user_division_id = data.get('user_division_id')  # Get user's division

        logger.info(f"Requisition submission: User division = {user_division_id}, Project = {project_code}")

        if not project_code:
            return JsonResponse({'error': 'Project code is required.'}, status=400)

        try:
            project = Project.objects.get(project_code=project_code)
        except Project.DoesNotExist:
            return JsonResponse({
                'error': 'Project code does not exist.'
            }, status=404)

        with transaction.atomic():
            latest_batches = Requisition.objects.filter(
                project=project
            ).only('batch_id').values_list('batch_id', flat=True)

            batch_numbers = [
                int(re.match(r'^(\d+)_', batch_id).group(1))
                for batch_id in latest_batches if re.match(r'^(\d+)_', batch_id)
            ]

            new_batch_num = max(batch_numbers) + 1 if batch_numbers else 1
            batch_id = f"{new_batch_num}_{project_code}"
            
            created_requisitions = []
            
            for req_data in requisitions_data:
                req_data['project'] = project.pk
                req_data['batch_id'] = batch_id
                req_data['submitted_by'] = requested_by

                try:
                    item_master = ItemMaster.objects.get(cimcon_part_no=req_data.get('cimcon_part_number'))
                    if req_data.get('mfg_part_number') and req_data.get('mfg_part_number') != item_master.mfg_part_no:
                        item_master.mfg_part_no = req_data.get('mfg_part_number')
                        item_master.save()
                except ItemMaster.DoesNotExist:
                    logger.warning(f"ItemMaster not found for cimcon_part_no: {req_data.get('cimcon_part_number')}")
                except Exception as e:
                    logger.error(f"Error updating ItemMaster: {str(e)}")

                serializer = RequisitionSerializer(data=req_data)
                if serializer.is_valid():
                    requisition = serializer.save()
                    created_requisitions.append(serializer.data)
                else:
                    logger.error(f"Validation error: {serializer.errors}")
                    return JsonResponse({'error': serializer.errors}, status=400)

        # Send email notification
        if created_requisitions:
            try:
                def send_requisition_email():
                    try:
                        email_sender = SendEmail()
                        email_sender.send(
                            'save_requisition',
                            project_code=project_code,
                            batch_id=batch_id,
                            created_requisitions=created_requisitions,
                            submitted_by=requested_by or 'User',
                            user_division_id=user_division_id  # Pass user's division
                        )
                    except Exception as email_error:
                        logger.error(f"Error sending requisition save email: {str(email_error)}")
                
                threading.Thread(target=send_requisition_email, daemon=True).start()
                logger.info(f"Requisition save email initiated for batch {batch_id}")
                
            except Exception as e:
                logger.error(f"Error initiating email for batch {batch_id}: {str(e)}")

        return JsonResponse({
            'message': 'Requisitions created successfully.', 
            'data': created_requisitions,
            'batch_id': batch_id
        }, status=201)

    except Exception as e:
        logger.exception(f"Error saving requisitions: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)

@api_view(['PUT'])
def update_requisition(request, requisition_id):
    try:
        requisition = Requisition.objects.get(id=requisition_id)
        data = request.data

        # Update fields
        requisition.status = data.get('status', 'pending')
        requisition.rejection_remarks = data.get('rejection_remarks')
        requisition.approved_status = data.get('approved_status', False)
        
        # Update other fields...
        #Initialize the serializer with partial updates allowed
        serializer = RequisitionSerializer(requisition, data=data, partial=True)

        if serializer.is_valid():
            serializer.save()
        
        requisition.save()
        
        return Response(serializer.data)

    except Requisition.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_ERROR)

@api_view(['DELETE'])
def delete_requisition(request, requisition_id):
    """
    Deletes a single requisition instance based on its ID.
    """
    try:
        requisition = Requisition.objects.get(id=requisition_id)
    except Requisition.DoesNotExist:
        return JsonResponse({'error': 'Requisition not found.'}, status=404)

    try:
        with transaction.atomic():
            requisition_id = requisition.id
            requisition.delete()
            logger.info(f"Requisition {requisition_id} deleted successfully.")
            return JsonResponse({'message': f"Requisition {requisition_id} deleted successfully."}, status=204)

    except Exception as e:
        logger.exception(f"Error while deleting requisition: {str(e)}")
        return JsonResponse({'error': str(e)}, status=500)
    

@api_view(['POST'])
def batch_approve_requisitions(request):
    """
    OPTIMIZED version with bulk operations
    """
    try:
        data = json.loads(request.body.decode('utf-8'))
        batch_id = data.get('batch_id')
        items = data.get('items', [])
        
        if not batch_id or not items:
            return JsonResponse({"error": "Batch ID and items are required."}, status=400)
        
        with transaction.atomic():
            # OPTIMIZED: Use bulk_update instead of individual updates
            requisitions = list(Requisition.objects.filter(
                batch_id=batch_id,
                id__in=items,
                approved_status=False
            ))
            
            if not requisitions:
                return JsonResponse({
                    "error": "No requisitions found to approve or already approved."
                }, status=404)
            
            # Prepare bulk update
            for req in requisitions:
                req.approved_status = True
                req.status = 'approved'
                req.rejection_remarks = None
            
            # Perform bulk update
            Requisition.objects.bulk_update(
                requisitions,
                ['approved_status', 'status', 'rejection_remarks']
            )
            
            updated_count = len(requisitions)
            
            # OPTIMIZED: Send email asynchronously
            def send_approval_email():
                try:
                    email_sender = SendEmail()
                    email_sender.send('approved_requisition', 
                                    batch_id=batch_id,
                                    approved_items=items)
                except Exception as email_error:
                    logger.error(f"Error sending approval email: {str(email_error)}")
            
            # Start email in background thread
            threading.Thread(target=send_approval_email, daemon=True).start()
            
            # Clear related cache
            cache.delete(f'revision_history_{batch_id}')
            
            return JsonResponse({
                "message": f"{updated_count} requisitions approved successfully."
            }, status=200)
    
    except Exception as e:
        logger.exception(f"Error in batch_approve_requisitions: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)
    
@api_view(['POST'])
def batch_reject_requisitions(request):
    """
    OPTIMIZED version with bulk operations
    """
    try:
        data = json.loads(request.body.decode('utf-8'))
        batch_id = data.get('batch_id')
        rejection_remarks = data.get('rejection_remarks')
        
        if not batch_id or not rejection_remarks:
            return JsonResponse({"error": "Batch ID and rejection remarks are required."}, status=400)
        
        with transaction.atomic():
            # OPTIMIZED: Use bulk_update
            requisitions = list(Requisition.objects.filter(
                batch_id=batch_id,
                status='pending'
            ))
            
            if not requisitions:
                return JsonResponse({"error": "No pending requisitions found to reject."}, status=404)
            
            # Prepare bulk update
            for req in requisitions:
                req.status = 'rejected'
                req.approved_status = False
                req.rejection_remarks = rejection_remarks
            
            # Perform bulk update
            Requisition.objects.bulk_update(
                requisitions,
                ['status', 'approved_status', 'rejection_remarks']
            )
            
            updated_count = len(requisitions)
            
            # OPTIMIZED: Send email asynchronously
            def send_rejection_email():
                try:
                    email_sender = SendEmail()
                    email_sender.send('rejected_requisition', 
                                    batch_id=batch_id,
                                    rejection_remarks=rejection_remarks)
                except Exception as email_error:
                    logger.error(f"Error sending rejection email: {str(email_error)}")
            
            # Start email in background thread
            threading.Thread(target=send_rejection_email, daemon=True).start()
            
            # Clear related cache
            cache.delete(f'revision_history_{batch_id}')
        
        return JsonResponse({
            "message": f"{updated_count} pending requisitions rejected successfully.",
            "note": "Already approved requisitions were not affected."
        }, status=200)
    
    except Exception as e:
        logger.exception(f"Error rejecting requisitions: {str(e)}")
        return JsonResponse({"error": str(e)}, status=500)
    
# Project Table fetching data
class ProjectViewSet(viewsets.ModelViewSet):
    """
    A viewset for handling Project objects.
    """
    queryset = Project.objects.select_related('division').all()
    serializer_class = ProjectSerializer
    # permission_classes = [IsAuthenticated]  # COMMENTED OUT - No authentication

    def get_queryset(self):
        """Return all projects"""
        return Project.objects.select_related('division').all()

    def create(self, request, *args, **kwargs):
        # SIMPLIFIED: No division assignment
        return super().create(request, *args, **kwargs)

    def update(self, request, *args, **kwargs):
        # SIMPLIFIED: No division checks
        return super().update(request, *args, **kwargs)
    
class RequisitionHistoryViewSet(viewsets.ModelViewSet):
    queryset = RequisitionHistory.objects.all()
    serializer_class = RequisitionHistorySerializer

    @action(detail=False, methods=['get'])
    def by_batch(self, request):
        batch_id = request.query_params.get('batch_id')
        if not batch_id:
            return Response(
                {"error": "batch_id is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        history = RequisitionHistory.objects.filter(
            requisition__batch_id=batch_id
        ).exclude(field_name='status').order_by('-changed_at')
        
        serializer = self.get_serializer(history, many=True)
        return Response(serializer.data)

@api_view(['GET'])
def get_revision_history_by_batch(request):
    try:
        batch_id = request.query_params.get('batch_id')
        if not batch_id:
            return Response({'error': 'batch_id is required'}, status=400)
            
        # OPTIMIZED with caching
        cache_key = f'revision_history_{batch_id}'
        cached_data = cache.get(cache_key)
        
        if cached_data is None:
            history = RequisitionHistory.objects.filter(
                requisition__batch_id=batch_id
            ).select_related('requisition').exclude(
                field_name='status'
            ).order_by('-changed_at')
            
            serializer = RequisitionHistorySerializer(history, many=True)
            cached_data = serializer.data
            
            # Cache for 5 minutes
            cache.set(cache_key, cached_data, timeout=300)
            
        return Response(cached_data)
        
    except Exception as e:
        return Response({'error': str(e)}, status=400)

@api_view(['POST'])
def save_revision_history(request):
    try:
        requisition_id = request.data.get('requisition_id')
        changes = request.data.get('changes', [])
        changed_by = request.data.get('changed_by')
        approved_by_name = request.data.get('approved_by_name', None)

        requisition = Requisition.objects.get(id=requisition_id)    
        batch_id = requisition.batch_id

        # Create a cache key for this batch
        cache_key = f'batch_email_sent_{batch_id}'

        # Save all changes first
        for change in changes:
            RequisitionHistory.log_change(
                requisition=requisition,
                field_name=change['field_name'],
                old_value=change['old_value'],
                new_value=change['new_value'],
                changed_by=changed_by,
                approved_by=approved_by_name,
                remarks=None
            )

        # Only send email if there are quantity changes and no email has been sent for this batch
        quantity_changes = [change for change in changes if change['field_name'] == 'req_qty']
        if quantity_changes:
            # Check if this is the first item in the batch being updated
            # We'll use the cache to track if we've already sent an email for this batch update
            if not cache.get(cache_key):
                # Set the cache to indicate an email has been sent for this batch
                cache.set(cache_key, True, timeout=1)  # Cache for 1 second
                
                # Send email after all changes are saved
                email_sender = SendEmail()
                email_sender.send(
                    'update_requisition',
                    requisition_id=requisition_id,
                    project_code=requisition.project.project_code,
                    batch_id=batch_id,
                    history_records=RequisitionHistory.objects.filter(
                        requisition__batch_id=batch_id,  # Changed to filter by batch_id
                        field_name='req_qty'
                    ).order_by('-changed_at')
                )

        return Response({'status': 'success'})
    except Exception as e:
        logger.error(f"Error saving revision history: {str(e)}")
        return Response({'error': str(e)}, status=400)



@api_view(['PUT'])
def approve_requisition(request, requisition_id):
    try:
        requisition = Requisition.objects.get(id=requisition_id)
        requisition.approved_status = True
        requisition.status = 'approved'
        requisition.rejection_remarks = None  # Clear any rejection remarks
        requisition.save()
        
        return Response({
            'message': 'Requisition approved successfully',
            'requisition': RequisitionSerializer(requisition).data
        })
    except Requisition.DoesNotExist:
        return Response({'error': 'Requisition not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=400)





@api_view(['POST'])
def approve_requisition_email(request, batch_id):
    try:
        # Check if any requisitions with this batch_id are already approved
        already_approved_count = Requisition.objects.filter(
            batch_id=batch_id, 
            status='approved'
        ).count()
        
        total_requisitions = Requisition.objects.filter(batch_id=batch_id).count()
        
        # If all requisitions are already approved, return a specific message
        if already_approved_count == total_requisitions and total_requisitions > 0:
            return JsonResponse({
                'status': 'already_approved',
                'message': 'All requisitions in this batch are already approved',
                'batch_id': batch_id
            }, status=200)
        
        # If no requisitions in this batch, return an error
        if total_requisitions == 0:
            return JsonResponse({
                'status': 'error',
                'message': 'No requisitions found with this batch ID',
                'batch_id': batch_id
            }, status=404)
        
        # First, get the IDs of requisitions that are currently pending
        pending_requisition_ids = list(Requisition.objects.filter(
            batch_id=batch_id, 
            status='pending'
        ).values_list('id', flat=True))
        
        # Update all remaining pending requisitions with matching batch_id
        updated = Requisition.objects.filter(
            batch_id=batch_id, 
            status='pending'
        ).update(
            approved_status=True,
            status='approved'
        )

        if updated > 0:
            # Get the first requisition to get project and division info
            first_req = Requisition.objects.filter(batch_id=batch_id).first()
            if first_req:
                project = first_req.project
                division_id = project.division.id
                
                # Get the submitted_by name from the first requisition
                submitted_by = first_req.submitted_by
                
                # Extract first name (assuming format is "First Last")
                first_name = submitted_by.split()[0] if submitted_by and ' ' in submitted_by else submitted_by

                # Get requisitor with full details to get name, matching the first name
                requisitor = CustomUser.objects.filter(
                    division_id=division_id,
                    role='Requisitor',
                    first_name=first_name
                ).first()

                if not requisitor:
                    logger.error(f"No requisitor found for division {division_id}")
                    return JsonResponse({
                        'status': 'error',
                        'message': 'Could not find requisitor for notification',
                        'batch_id': batch_id
                    }, status=500)

                # ADDED: Find ALL Store role users (no division filter)
                store_users = CustomUser.objects.filter(
                    role='Store',
                    is_active=True
                ).exclude(email__isnull=True).exclude(email='')

                logger.info(f"Found {store_users.count()} Store users to send emails to")

                # OPTIMIZED: Send emails asynchronously
                def send_approval_emails():
                    try:
                        # Get requisitor name for personalized greeting
                        requisitor_name = f"{requisitor.first_name} {requisitor.last_name}".strip()
                        if not requisitor_name:
                            requisitor_name = requisitor.username

                        # Email configuration
                        smtp_server = settings.EMAIL_HOST
                        port = settings.EMAIL_PORT
                        sender_email = settings.EMAIL_HOST_USER
                        password = settings.EMAIL_HOST_PASSWORD

                        current_date = time.strftime("%B %d, %Y")
                        subject = f"Requisitions Approved for Project {project.project_code} - Batch {batch_id}"

                        # Get NEWLY approved requisitions only (the ones that were pending)
                        newly_approved_reqs = Requisition.objects.filter(
                            id__in=pending_requisition_ids,
                            batch_id=batch_id
                        )

                        # Create a summary of all requisitions with their status
                        all_requisitions_summary = """
                        <h3 style="color: #444; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">All Requisitions in Batch:</h3>
                        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                            <thead>
                                <tr style="background-color: #f2f2f2;">
                                    <th style="padding: 10px; border: 1px solid #ddd;">Material Description</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">CIMCON Part Number</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Quantity</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Required By</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                        """
                        
                        all_reqs = Requisition.objects.filter(batch_id=batch_id)
                        for req in all_reqs:
                            status_style = ""
                            if req.id in pending_requisition_ids:
                                status_style = "background-color: #e8f5e9; font-weight: bold;"
                                
                            all_requisitions_summary += f"""
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.material_description}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.cimcon_part_number}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.req_qty}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.required_by_date}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd; {status_style}">{req.status.capitalize()}</td>
                                </tr>
                            """
                        all_requisitions_summary += "</tbody></table>"

                        # Create table for NEWLY approved requisitions only (for requisitor email)
                        approved_table = """
                        <h3 style="color: #28a745; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; font-size: 18px;">Newly Approved Requisitions:</h3>
                        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                            <thead>
                                <tr style="background-color: #e8f5e9;">
                                    <th style="padding: 10px; border: 1px solid #ddd;">Material Description</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">CIMCON Part Number</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Quantity</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Required By</th>
                                </tr>
                            </thead>
                            <tbody>
                        """

                        for req in newly_approved_reqs:
                            approved_table += f"""
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.material_description}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.cimcon_part_number}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.req_qty}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.required_by_date}</td>
                                </tr>
                            """
                        approved_table += "</tbody></table>"

                        # ADDED: Create table for Store email with only newly approved items
                        store_approved_table = """
                        <h3 style="color: #2e7d32; border-bottom: 1px solid #ddd; padding-bottom: 5px;">New Items for Verification:</h3>
                        <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                            <thead>
                                <tr style="background-color: #e8f5e9;">
                                    <th style="padding: 10px; border: 1px solid #ddd;">Material Description</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">CIMCON Part Number</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Quantity</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Required By</th>
                                    <th style="padding: 10px; border: 1px solid #ddd;">Submitted By</th>
                                </tr>
                            </thead>
                            <tbody>
                        """

                        for req in newly_approved_reqs:
                            store_approved_table += f"""
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.material_description}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.cimcon_part_number}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.req_qty}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.required_by_date}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{req.submitted_by}</td>
                                </tr>
                            """
                        store_approved_table += "</tbody></table>"

                        # EMAIL 1: Requisitor Email
                        html_body_requisitor = f"""
                        <html>
                            <head>
                                <style>
                                    /* Basic styling for better presentation */
                                    body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }}
                                    .container {{ max-width: 800px; margin: 20px auto; background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                                    .header {{ border-bottom: 2px solid #28a745; padding-bottom: 15px; margin-bottom: 20px; }}
                                    .header h2 {{ color: #28a745; margin: 0; font-size: 24px; }}
                                    .info-box {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 25px 0; border: 1px solid #e3e3e3; }}
                                    .info-box p {{ margin: 8px 0; font-size: 15px; }}
                                    table {{ border-collapse: collapse; width: 100%; margin-bottom: 20px; }}
                                    th, td {{ padding: 12px; border: 1px solid #ddd; text-align: left; }}
                                    th {{ background-color: #f2f2f2; font-weight: bold; }}
                                </style>
                            </head>
                            <body>
                                <div class="container">
                                    <div class="header">
                                        <h2>Requisition Approved</h2>
                                    </div>
                                    <p>Dear {requisitor_name},</p>
                                    <p>We are pleased to inform you that requisition(s) have been approved for your project.</p>
                                    
                                    <div class="info-box">
                                        <p><strong>Project Code:</strong> {project.project_code}</p>
                                        <p><strong>Batch ID:</strong> {batch_id}</p>
                                        <p><strong>Date:</strong> {current_date}</p>
                                    </div>
                                    
                                    {all_requisitions_summary}
                                    
                                    {approved_table}
                                    
                                    <p>Thank you</p>
                                </div>
                            </body>
                        </html>
                        """

                        # Prepare all messages to send
                        messages_to_send = []

                        # Message for Requisitor
                        msg_requisitor = MIMEMultipart('alternative')
                        msg_requisitor['From'] = sender_email
                        msg_requisitor['To'] = requisitor.email
                        msg_requisitor['Subject'] = subject

                        text_part_requisitor = MIMEText(
                            f"Dear {requisitor_name},\n\n"
                            f"{newly_approved_reqs.count()} requisition(s) have been newly approved for Project {project.project_code}.\n"
                            f"Batch ID: {batch_id}\n"
                            f"Date: {current_date}\n\n"
                            f"Please check the HTML version of this email for detailed information.\n\n"
                            f"Thank you,\n"
                            f"CIMCON Purchase Requisition System", 
                            'plain'
                        )
                        html_part_requisitor = MIMEText(html_body_requisitor, 'html')

                        msg_requisitor.attach(text_part_requisitor)
                        msg_requisitor.attach(html_part_requisitor)

                        messages_to_send.append({
                            'message': msg_requisitor,
                            'email': requisitor.email,
                            'name': requisitor_name,
                            'type': 'requisitor'
                        })

                        # ADDED: Messages for ALL Store users with only newly approved items
                        for store_user in store_users:
                            store_name = f"{store_user.first_name} {store_user.last_name}".strip()
                            if not store_name:
                                store_name = store_user.username

                            # EMAIL 2: Store Email with only newly approved items
                            html_body_store = f"""
                            <html>
                                <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
                                    <div style="padding: 20px; border-radius: 5px;">
                                        <div style="border-bottom: 2px solid #ff9800; padding-bottom: 10px;">
                                            <h2 style="color: #ff9800; margin-top: 0;">New Items for Verification</h2>
                                        </div>
                                        
                                        <p style="margin-top: 20px;">Dear {store_name},</p>
                                        
                                        <p>The following requisitions have been approved and require your verification for availability and procurement.</p>
                                        
                                        <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                            <p><strong>Project Code:</strong> {project.project_code}</p>
                                            <p><strong>Batch ID:</strong> {batch_id}</p>
                                            <p><strong>Division:</strong> {project.division.division_name}</p>
                                            <p><strong>Date Approved:</strong> {current_date}</p>
                                            <p><strong>Newly Approved Items:</strong> {newly_approved_reqs.count()}</p>
                                            <p style="color: #ff9800;"><strong>Action Required:</strong> Verification & Procurement</p>
                                        </div>
                                        
                                        {store_approved_table}
                                        
                                        <p style="margin-top: 20px;">Please verify the availability of these items and proceed with the procurement process as per company guidelines.</p>
                                        
                                        <p>Thank you</p>
                                    </div>
                                </body>
                            </html>
                            """

                            msg_store = MIMEMultipart('alternative')
                            msg_store['From'] = sender_email
                            msg_store['To'] = store_user.email
                            msg_store['Subject'] = f"New Items for Verification - Project {project.project_code} - Batch {batch_id}"

                            text_part_store = MIMEText(
                                f"Dear {store_name},\n\n"
                                f"{newly_approved_reqs.count()} new requisitions have been approved for Project {project.project_code} and require verification.\n"
                                f"Batch ID: {batch_id}\n"
                                f"Division: {project.division.division_name}\n"
                                f"Date Approved: {current_date}\n\n"
                                f"Please verify the availability of these items and proceed with procurement as per company guidelines.\n\n"
                                f"Please check the HTML version of this email for detailed item information.\n\n"
                                f"Thank you,\n"
                                f"CIMCON Purchase Requisition System", 
                                'plain'
                            )
                            html_part_store = MIMEText(html_body_store, 'html')

                            msg_store.attach(text_part_store)
                            msg_store.attach(html_part_store)

                            messages_to_send.append({
                                'message': msg_store,
                                'email': store_user.email,
                                'name': store_name,
                                'type': 'store'
                            })

                        # Send all emails
                        if messages_to_send:
                            with smtplib.SMTP(smtp_server, port) as server:
                                server.starttls()
                                server.login(sender_email, password)
                                
                                for msg_info in messages_to_send:
                                    server.sendmail(sender_email, msg_info['email'], msg_info['message'].as_string())
                                    logger.info(f"Email approval notification sent to {msg_info['type'].upper()} {msg_info['name']} ({msg_info['email']}) for batch {batch_id}")
                                
                                logger.info(f"Total approval emails sent: {len(messages_to_send)} (1 to requisitor + {store_users.count()} to store users) for batch {batch_id} with {newly_approved_reqs.count()} newly approved items")

                    except Exception as email_error:
                        logger.error(f"Error sending approval emails: {str(email_error)}")

                # Start email sending in background
                threading.Thread(target=send_approval_emails, daemon=True).start()

            return JsonResponse({
                'status': 'success',
                'message': f'Successfully approved {updated} requisition(s)',
                'batch_id': batch_id
            })
        else:
            # This happens if there are requisitions but none are in 'pending' status
            return JsonResponse({
                'status': 'no_action',
                'message': 'No pending requisitions to approve in this batch',
                'batch_id': batch_id
            }, status=200)
            
    except Exception as e:
        logger.error(f"Error in approve_requisition_email: {str(e)}")
        return JsonResponse({
            'status': 'error',
            'message': str(e),
            'batch_id': batch_id
        }, status=500)


def approve_requisition_page(request, batch_id):
    base_url = settings.BASE_API_URL
    api_url = f"{base_url}/api/approve-requisition-email/{batch_id}/"
    response = requests.post(api_url, json={"batch_id": batch_id})
    
    data = response.json() if response.status_code != 500 else {"message": "Server error"}
    status = data.get('status', 'error')
    
    if response.status_code == 200:
        if status == 'success':
            message = f"Requisition {data.get('batch_id')} approved successfully!"
            message_class = "success"
        elif status == 'already_approved':
            message = f"Requisition {data.get('batch_id')} has already been approved!"
            message_class = "error"  # Changed from "warning" to "error" for red color
        elif status == 'no_action':
            message = f"No pending requisitions to approve in batch {data.get('batch_id')}"
            message_class = "error"  # Also changed to red
        else:
            message = data.get('message', 'Unknown status')
            message_class = "info"
    else:
        message = f"Error: {data.get('message', 'Unknown error')}"
        message_class = "error"
    
    html_content = f'''
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Requisition Approval</title>
        <style>
            body {{
                font-family: 'Arial', sans-serif;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background-color: #f4f4f4;
                margin: 0;
            }}
            .container {{
                background-color: #fff;
                padding: 40px;
                border-radius: 8px;
                box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                text-align: center;
                max-width: 600px;
                width: 90%;
            }}
            h2 {{
                color: #333;
            }}
            p {{
                font-size: 18px;
                margin-top: 20px;
            }}
            .success {{
                color: #28a745; /* Green */
            }}
            .error {{
                color: #dc3545; /* Red */
                font-weight: bold;
            }}
            .info {{
                color: #17a2b8; /* Blue */
            }}
            .note {{
                font-size: 14px;
                margin-top: 30px;
                color: #666;
            }}
        </style>
    </head>
    <body>
        <div class="container">
            <h2>Requisition Approval</h2>
            <p class="{message_class}">{message}</p>
            <p class="note">You can close this window.</p>
        </div>
    </body>
    </html>
    '''
    return HttpResponse(html_content)  # Return the rendered HTML directly





# OPTIMIZED SendEmail class with all templates preserved
class SendEmail:
    def __init__(self):
        self.smtp_server = settings.EMAIL_HOST
        self.port = settings.EMAIL_PORT
        self.sender_email = settings.EMAIL_HOST_USER
        self.password = settings.EMAIL_HOST_PASSWORD

    def send(self, trigger, **kwargs):
        if trigger == 'save_requisition':
            project_code = kwargs.get('project_code', 'Unknown')
            batch_id = kwargs.get('batch_id', '')
            created_requisitions = kwargs.get('created_requisitions', [])
            submitted_by = kwargs.get('submitted_by', 'User')
            user_division_id = kwargs.get('user_division_id')

            try:
                # FIXED: Get project first to determine PROJECT'S division for approver
                project = Project.objects.select_related('division').get(project_code=project_code)
                project_division_id = project.division.id
                project_division_name = project.division.division_name
                logger.info(f"Project division: {project_division_id} ({project_division_name})")

                # --- Find Approver in PROJECT'S DIVISION ---
                approver = CustomUser.objects.filter(
                    division_id=project_division_id,
                    role='Approver',
                    is_active=True
                ).first()

                approver_email = None
                approver_name = "Approver"
                if approver:
                    approver_email = approver.email
                    approver_name = f"{approver.first_name} {approver.last_name}".strip() or approver.username
                    logger.info(f"Approver found for PROJECT'S division {project_division_id}: {approver_name} ({approver_email})")
                else:
                    logger.warning(f"No approver found for PROJECT'S division {project_division_id}. Cannot send approval request email.")

                # --- MODIFIED: Find SPECIFIC Requisitor in USER'S DIVISION matching submitted_by ---
                user_division_name = "Unknown Division"
                requisitor_email_info = None
                
                if user_division_id and submitted_by:
                    try:
                        from users.models import Division
                        user_division = Division.objects.get(id=user_division_id)
                        user_division_name = user_division.division_name
                        logger.info(f"User division: {user_division_id} ({user_division_name})")
                        
                        # Extract first name from submitted_by
                        first_name = submitted_by.split()[0] if submitted_by and ' ' in submitted_by else submitted_by
                        logger.info(f"Looking for requisitor with first name: '{first_name}' in division {user_division_id}")
                        
                        # Find the specific requisitor whose first name matches
                        matching_requisitor = CustomUser.objects.filter(
                            division_id=user_division_id,
                            role='Requisitor',
                            is_active=True,
                            first_name__iexact=first_name  # Case-insensitive match
                        ).first()
                        
                        if matching_requisitor and matching_requisitor.email:
                            requisitor_email_info = {
                                'email': matching_requisitor.email,
                                'name': f"{matching_requisitor.first_name} {matching_requisitor.last_name}".strip() or matching_requisitor.username
                            }
                            logger.info(f"Found matching requisitor: {requisitor_email_info['name']} ({requisitor_email_info['email']})")
                        else:
                            logger.warning(f"No active requisitor found with first name '{first_name}' in division {user_division_id}")
                        
                    except Division.DoesNotExist:
                        logger.error(f"User division with ID {user_division_id} not found")
                else:
                    logger.warning("User division ID or submitted_by not provided")

            except Project.DoesNotExist:
                logger.error(f"Project with code {project_code} not found")
                return
            except Exception as e:
                logger.error(f"Error finding users for project {project_code}: {e}")
                return

            # --- Prepare Requisition Details Table (Common for both emails) ---
            requisition_details = ""
            if created_requisitions:
                requisition_details = """
                <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="padding: 10px; border: 1px solid #ddd;">Material Description</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">CIMCON Part Number</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Quantity</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Required By</th>
                        </tr>
                    </thead>
                    <tbody>
                """
                for req in created_requisitions:
                    requisition_details += f"""
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req['material_description']}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req['cimcon_part_number']}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req['req_qty']}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req['required_by_date']}</td>
                        </tr>
                    """
                requisition_details += "</tbody></table>"
            else:
                requisition_details = "<p>No requisitions created.</p>"

            # --- EMAIL 1: Prepare Approver Email (For Approval Request) ---
            msg_approver = None
            if approver_email:
                approver_subject = f"New Requisition(s) for Project {project_code} - Action Required (Batch: {batch_id})"
                base_url = settings.BASE_API_URL
                approval_link = f"{base_url}/approve-requisition/{batch_id}/"
                current_date = time.strftime("%B %d, %Y")

                approver_html_body = f"""
                <html>
                    <head>
                        <style>
                            body {{ font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f4f4; margin: 0; padding: 0; }}
                            .container {{ max-width: 800px; margin: 20px auto; background-color: #ffffff; padding: 25px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }}
                            .header {{ border-bottom: 2px solid #007bff; padding-bottom: 15px; margin-bottom: 20px; }}
                            .header h2 {{ color: #007bff; margin: 0; font-size: 24px; }}
                            .info-box {{ background-color: #f8f9fa; padding: 20px; border-radius: 5px; margin: 25px 0; border: 1px solid #e3e3e3; }}
                            .info-box p {{ margin: 8px 0; font-size: 15px; }}
                            .details-header {{ color: #444; border-bottom: 1px solid #ddd; padding-bottom: 8px; margin-top: 30px; margin-bottom: 15px; font-size: 18px; }}
                            .action-button {{ display: inline-block; background-color: #28a745; color: white !important; padding: 12px 28px; text-decoration: none; font-size: 16px; border-radius: 5px; font-weight: bold; text-align: center; }}
                            .button-container {{ text-align: center; margin: 35px 0; }}
                            table {{ border-collapse: collapse; width: 100%; margin-bottom: 20px; }}
                            th, td {{ padding: 12px; border: 1px solid #ddd; text-align: left; }}
                            th {{ background-color: #f2f2f2; font-weight: bold; }}
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h2>Requisition Approval Request</h2>
                            </div>
                            <p>Dear {approver_name},</p>
                            <p>A new purchase requisition batch requires your review and approval.</p>
                            
                            <div class="info-box">
                                <p><strong>Project Code:</strong> {project_code}</p>
                                <p><strong>Project Division:</strong> {project_division_name}</p>
                                <p><strong>Batch ID:</strong> {batch_id}</p>
                                <p><strong>Submitted By:</strong> {submitted_by}</p> 
                                <p><strong>Date Submitted:</strong> {current_date}</p>
                            </div>
                            
                            <h3 class="details-header">Requisition Details:</h3>
                            {requisition_details}
                            
                            <p>Please review the items above and click the button below to proceed with the approval process.</p>
                            
                            <div class="button-container">
                                <a href="{approval_link}" class="action-button">Approve Requisition</a>
                            </div>
                        </div>
                    </body>
                </html>
                """
                
                msg_approver = MIMEMultipart('alternative')
                msg_approver['From'] = self.sender_email
                msg_approver['To'] = approver_email
                msg_approver['Subject'] = approver_subject
                
                approver_text_part = MIMEText(
                    f"Dear {approver_name},\n\nNew Requisition(s) submitted by {submitted_by} for Project {project_code} require your approval.\nProject Division: {project_division_name}\nBatch ID: {batch_id}\nDate: {current_date}\nPlease review using the link: {approval_link}\n\nThank you.",
                    'plain'
                )
                approver_html_part = MIMEText(approver_html_body, 'html')
                
                msg_approver.attach(approver_text_part)
                msg_approver.attach(approver_html_part)

            # --- EMAIL 2: Prepare Requisitor Confirmation Email (For SPECIFIC Requisitor) ---
            msg_requisitor = None
            if requisitor_email_info:
                requisitor_subject = f"Requisition Submitted Successfully - Project {project_code} (Batch: {batch_id})"
                current_date = time.strftime("%B %d, %Y")
                
                requisitor_name = requisitor_email_info['name']
                requisitor_email = requisitor_email_info['email']

                requisitor_html_body = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
                        <div style="padding: 20px; border-radius: 5px;">
                            <div style="border-bottom: 2px solid #28a745; padding-bottom: 10px;">
                                <h2 style="color: #28a745; margin-top: 0;">Requisition Submitted Successfully</h2>
                            </div>
                            <p style="margin-top: 20px;">Dear {requisitor_name},</p>
                            <p>Your requisition has been submitted for project {project_code} and sent for approval.</p>
                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p><strong>Project Code:</strong> {project_code}</p>
                                <p><strong>Project Division:</strong> {project_division_name}</p>
                                <p><strong>Your Division:</strong> {user_division_name}</p>
                                <p><strong>Batch ID:</strong> {batch_id}</p>
                                <p><strong>Submitted By:</strong> {submitted_by}</p>
                                <p><strong>Date Submitted:</strong> {current_date}</p>
                            </div>
                            <h3 style="color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Submitted Requisition Details:</h3>
                            {requisition_details}
                            <p style="margin-top: 20px;">You will be notified once the approver takes action on this request.</p>
                            <p>Thank you</p>
                        </div>
                    </body>
                </html>
                """
                
                msg_requisitor = MIMEMultipart('alternative')
                msg_requisitor['From'] = self.sender_email
                msg_requisitor['To'] = requisitor_email
                msg_requisitor['Subject'] = requisitor_subject
                
                requisitor_text_part = MIMEText(
                    f"Dear {requisitor_name},\n\nYour requisition has been submitted for Project {project_code}.\nProject Division: {project_division_name}\nYour Division: {user_division_name}\nSubmitted By: {submitted_by}\nBatch ID: {batch_id}\nDate: {current_date}\nYou will be notified upon approval or rejection.\n\nThank you.",
                    'plain'
                )
                requisitor_html_part = MIMEText(requisitor_html_body, 'html')
                
                msg_requisitor.attach(requisitor_text_part)
                msg_requisitor.attach(requisitor_html_part)

            # --- Send All Emails ---
            if msg_approver or msg_requisitor:
                try:
                    with smtplib.SMTP(self.smtp_server, self.port) as server:
                        server.starttls()
                        server.login(self.sender_email, self.password)

                        # Send EMAIL 1: To Approver (PROJECT'S division)
                        if msg_approver:
                            server.sendmail(self.sender_email, approver_email, msg_approver.as_string())
                            logger.info(f"Approval request email sent to APPROVER {approver_name} ({approver_email}) in PROJECT'S division {project_division_id} for batch {batch_id}")

                        # Send EMAIL 2: To SPECIFIC Requisitor (USER'S division)
                        if msg_requisitor:
                            server.sendmail(self.sender_email, requisitor_email, msg_requisitor.as_string())
                            logger.info(f"Confirmation email sent to SPECIFIC REQUISITOR {requisitor_name} ({requisitor_email}) matching '{submitted_by}' in USER'S division {user_division_id} for batch {batch_id}")

                        total_emails = (1 if msg_approver else 0) + (1 if msg_requisitor else 0)
                        logger.info(f"Total emails sent: {total_emails} (1 to approver + 1 to specific requisitor) for batch {batch_id}")

                except Exception as e:
                    logger.error(f"Error sending email(s) for batch {batch_id}: {e}")
            else:
                logger.warning(f"No recipients found for batch {batch_id}. No emails sent.")

        elif trigger == 'update_requisition':
            requisition_id = kwargs.get('requisition_id', 'Unknown')
            project_code = kwargs.get('project_code', 'Unknown')
            batch_id = kwargs.get('batch_id', '')

            try:
                # OPTIMIZED: Use select_related for related fields
                changed_requisition = Requisition.objects.select_related(
                    'project', 
                    'project__division'
                ).get(id=requisition_id)
                project = changed_requisition.project
                division_id = project.division.id

                # OPTIMIZED: Use select_related for history records
                all_batch_history = RequisitionHistory.objects.filter(
                    requisition__batch_id=batch_id,
                    field_name='req_qty'
                ).select_related('requisition').order_by('requisition__id', '-changed_at')

                if not all_batch_history.exists():
                    logger.warning(f"No quantity history records found for batch {batch_id}. Skipping email.")
                    return

                # Group history by requisition
                latest_changes_by_item = {}
                for record in all_batch_history:
                    if record.requisition_id not in latest_changes_by_item:
                        latest_changes_by_item[record.requisition_id] = record

                # Get approver details
                approver = CustomUser.objects.filter(
                    division_id=division_id,
                    role='Approver'
                ).first()

                approver_email = None
                approver_name = "Approver"
                if approver:
                    approver_email = approver.email
                    approver_name = f"{approver.first_name} {approver.last_name}".strip()
                    if not approver_name:
                        approver_name = approver.username
                else:
                    logger.error(f"No approver found for division {division_id}")

                # --- ADDED: Find the specific requisitor who made the updates ---
                requisitor_email = None
                requisitor_name = "Requisitor"
                submitted_by = changed_requisition.submitted_by
                
                if submitted_by:
                    # Extract first name from submitted_by
                    first_name = submitted_by.split()[0] if submitted_by and ' ' in submitted_by else submitted_by
                    logger.info(f"Looking for requisitor with first name: '{first_name}' in division {division_id}")
                    
                    # Find the specific requisitor whose first name matches
                    matching_requisitor = CustomUser.objects.filter(
                        division_id=division_id,
                        role='Requisitor',
                        is_active=True,
                        first_name__iexact=first_name  # Case-insensitive match
                    ).first()
                    
                    if matching_requisitor and matching_requisitor.email:
                        requisitor_email = matching_requisitor.email
                        requisitor_name = f"{matching_requisitor.first_name} {matching_requisitor.last_name}".strip() or matching_requisitor.username
                        logger.info(f"Found matching requisitor for updates: {requisitor_name} ({requisitor_email})")
                    else:
                        logger.warning(f"No active requisitor found with first name '{first_name}' in division {division_id}")

                # Skip if neither approver nor requisitor found
                if not approver_email and not requisitor_email:
                    logger.error(f"No approver or requisitor found for division {division_id}")
                    return

                current_date = time.strftime("%B %d, %Y")
                subject = f"Requisition(s) Updated for Project {project_code} - Batch {batch_id}"

                most_recent_change_by = all_batch_history.first().changed_by
                if most_recent_change_by:
                    if '.' in most_recent_change_by:
                        most_recent_change_by = most_recent_change_by.replace('.', ' ').title()
                    else:
                        most_recent_change_by = most_recent_change_by.capitalize()
                else:
                    most_recent_change_by = "User"

                # Table for changed items
                changed_items_summary_html = f"""
                <h3 style="color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Summary of Quantity Changes in Batch:</h3>
                <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr style="background-color: #e8f5e9;">
                            <th style="padding: 10px; border: 1px solid #ddd;">Material Description</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">CIMCON Part Number</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Previous Quantity</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">New Quantity</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Required By</th>
                        </tr>
                    </thead>
                    <tbody>
                """

                sorted_latest_changes = sorted(latest_changes_by_item.values(), key=lambda x: x.requisition_id)

                for record in sorted_latest_changes:
                    req = record.requisition
                    changed_items_summary_html += f"""
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.material_description}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.cimcon_part_number}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{record.old_value}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{record.new_value}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.required_by_date}</td>
                        </tr>
                    """
                changed_items_summary_html += "</tbody></table>"

                # Table for other items in the same batch
                changed_req_ids = latest_changes_by_item.keys()
                other_items = Requisition.objects.filter(
                    batch_id=batch_id
                ).exclude(
                    id__in=changed_req_ids
                ).filter(
                    status__in=['pending', 'rejected', 'approved']
                )

                other_items_html = ""
                if other_items.exists():
                    other_items_html = f"""
                    <h3 style="color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 30px;">Other Items in Same Batch (Status Summary):</h3>
                    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                        <thead>
                            <tr style="background-color: #f2f2f2;">
                                <th style="padding: 10px; border: 1px solid #ddd;">Material Description</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">CIMCON Part Number</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Quantity</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Required By</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Status</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Remarks</th>
                            </tr>
                        </thead>
                        <tbody>
                    """

                    for item in other_items:
                        status_style = ''
                        if item.status == 'rejected':
                            status_style = 'background-color: #ffebee;'
                        elif item.status == 'approved':
                            status_style = 'background-color: #e8f5e9;'

                        other_items_html += f"""
                            <tr style="{status_style}">
                                <td style="padding: 10px; border: 1px solid #ddd;">{item.material_description}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{item.cimcon_part_number}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{item.req_qty}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{item.required_by_date}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{item.get_status_display()}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{item.rejection_remarks if item.status == 'rejected' else ''}</td>
                            </tr>
                        """
                    other_items_html += "</tbody></table>"

                base_url = settings.BASE_API_URL
                approval_link = f"{base_url}/approve-requisition/{batch_id}/"

                # --- MODIFIED: Create email messages for both approver and requisitor ---
                messages_to_send = []

                # Email for Approver
                if approver_email:
                    approver_html_body = f"""
                    <html>
                        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
                            <div style="padding: 20px; border-radius: 5px;">
                                <div style="border-bottom: 2px solid #007bff; padding-bottom: 10px;">
                                    <h2 style="color: #007bff; margin-top: 0;">Updated Requisition(s)</h2>
                                </div>

                                <p style="margin-top: 20px;">Dear {approver_name},</p>

                                <p>This is to inform you that requisition(s) in a batch have been updated and require your review.</p>

                                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <p><strong>Project Code:</strong> {project_code}</p>
                                    <p><strong>Batch ID:</strong> {batch_id}</p>
                                    <p><strong>Last Changed By:</strong> {most_recent_change_by}</p>
                                    <p><strong>Date:</strong> {current_date}</p>
                                </div>

                                {changed_items_summary_html}
                                <br>
                                {other_items_html}

                                <p style="margin-top: 20px;">Please review all items and take necessary action at your earliest convenience.</p>

                                <div style="text-align: center; margin: 30px 0;">
                                    <a href="{approval_link}" style="
                                        display: inline-block;
                                        background-color: #007bff;
                                        color: white;
                                        padding: 12px 24px;
                                        text-decoration: none;
                                        font-size: 16px;
                                        border-radius: 5px;
                                        font-weight: bold;">
                                        Review and Approve Batch
                                    </a>
                                </div>

                                <p>Thank you</p>
                            </div>
                        </body>
                    </html>
                    """

                    msg_approver = MIMEMultipart('alternative')
                    msg_approver['From'] = self.sender_email
                    msg_approver['To'] = approver_email
                    msg_approver['Subject'] = subject

                    approver_text_part = MIMEText(
                        f"Dear {approver_name},\n\n"
                        f"Requisition quantity/quantities have been updated for Project {project_code}.\n"
                        f"Batch ID: {batch_id}\n"
                        f"Last Changed By: {most_recent_change_by}\n"
                        f"Date: {current_date}\n\n"
                        f"Please review these changes at your earliest convenience by visiting: {approval_link}\n\n"
                        f"Thank you,\n"
                        f"CIMCON Purchase Requisition System",
                        'plain'
                    )
                    approver_html_part = MIMEText(approver_html_body, 'html')

                    msg_approver.attach(approver_text_part)
                    msg_approver.attach(approver_html_part)
                    
                    messages_to_send.append({
                        'message': msg_approver,
                        'email': approver_email,
                        'name': approver_name,
                        'type': 'approver'
                    })

                # Email for Requisitor (same content, different greeting)
                if requisitor_email:
                    requisitor_html_body = f"""
                    <html>
                        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
                            <div style="padding: 20px; border-radius: 5px;">
                                <div style="border-bottom: 2px solid #28a745; padding-bottom: 10px;">
                                    <h2 style="color: #28a745; margin-top: 0;">Requisition Update Confirmation</h2>
                                </div>

                                <p style="margin-top: 20px;">Dear {requisitor_name},</p>

                                <p>This is to confirm that your requisition(s) have been successfully updated and sent for re-approval.</p>

                                <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <p><strong>Project Code:</strong> {project_code}</p>
                                    <p><strong>Batch ID:</strong> {batch_id}</p>
                                    <p><strong>Last Changed By:</strong> {most_recent_change_by}</p>
                                    <p><strong>Date:</strong> {current_date}</p>
                                </div>

                                {changed_items_summary_html}
                                <br>
                                {other_items_html}

                                <p style="margin-top: 20px;">Your updates have been sent to the approver for review. You will be notified once action is taken.</p>

                                <p>Thank you</p>
                            </div>
                        </body>
                    </html>
                    """

                    msg_requisitor = MIMEMultipart('alternative')
                    msg_requisitor['From'] = self.sender_email
                    msg_requisitor['To'] = requisitor_email
                    msg_requisitor['Subject'] = f"Requisition Update Confirmation - Project {project_code} - Batch {batch_id}"

                    requisitor_text_part = MIMEText(
                        f"Dear {requisitor_name},\n\n"
                        f"Your requisition quantity/quantities have been successfully updated for Project {project_code}.\n"
                        f"Batch ID: {batch_id}\n"
                        f"Last Changed By: {most_recent_change_by}\n"
                        f"Date: {current_date}\n\n"
                        f"Your updates have been sent to the approver for review. You will be notified once action is taken.\n\n"
                        f"Thank you,\n"
                        f"CIMCON Purchase Requisition System",
                        'plain'
                    )
                    requisitor_html_part = MIMEText(requisitor_html_body, 'html')

                    msg_requisitor.attach(requisitor_text_part)
                    msg_requisitor.attach(requisitor_html_part)
                    
                    messages_to_send.append({
                        'message': msg_requisitor,
                        'email': requisitor_email,
                        'name': requisitor_name,
                        'type': 'requisitor'
                    })

                # Send all emails
                if messages_to_send:
                    with smtplib.SMTP(self.smtp_server, self.port) as server:
                        server.starttls()
                        server.login(self.sender_email, self.password)
                        
                        for msg_info in messages_to_send:
                            server.sendmail(self.sender_email, msg_info['email'], msg_info['message'].as_string())
                            logger.info(f"Update notification email sent to {msg_info['type'].upper()} {msg_info['name']} ({msg_info['email']}) for batch {batch_id}")
                        
                        logger.info(f"Total update emails sent: {len(messages_to_send)} for batch {batch_id}")

            except Exception as e:
                logger.error(f"Error sending update summary email for batch {batch_id}: {e}")

        elif trigger == 'approved_requisition':
            batch_id = kwargs.get('batch_id', '')
            approved_items = kwargs.get('approved_items', [])

            try:
                # OPTIMIZED: Use select_related
                all_requisitions = Requisition.objects.filter(
                    batch_id=batch_id
                ).select_related('project', 'project__division')
                
                if not all_requisitions.exists():
                    logger.error(f"No requisitions found for batch {batch_id}")
                    return

                first_req = all_requisitions.first()
                project = first_req.project
                division_id = project.division.id
                
                submitted_by = first_req.submitted_by
                first_name = submitted_by.split()[0] if submitted_by and ' ' in submitted_by else submitted_by

                requisitor = CustomUser.objects.filter(
                    division_id=division_id,
                    role='Requisitor',
                    first_name=first_name
                ).first()

                if not requisitor:
                    logger.error(f"No requisitor found for division {division_id}")
                    return
            
                requisitor_name = f"{requisitor.first_name} {requisitor.last_name}".strip()
                if not requisitor_name:
                    requisitor_name = requisitor.username

                # MODIFIED: Find ALL Store role users (no division filter)
                store_users = CustomUser.objects.filter(
                    role='Store',
                    is_active=True
                ).exclude(email__isnull=True).exclude(email='')

                logger.info(f"Found {store_users.count()} Store users to send emails to")
                
                if store_users.exists():
                    for store_user in store_users:
                        logger.info(f"Store user: {store_user.username} ({store_user.email})")
                else:
                    logger.warning("No Store users found with valid email addresses")

                current_date = time.strftime("%B %d, %Y")
                subject = f"Requisitions Approved for Project {project.project_code} - Batch {batch_id}"

                # Create table for all requisitions
                all_requisitions_table = """
                <h3 style="color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px;">All Requisitions in Batch:</h3>
                <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr style="background-color: #f2f2f2;">
                            <th style="padding: 10px; border: 1px solid #ddd;">Material Description</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">CIMCON Part Number</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Quantity</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Required By</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                """
                
                for req in all_requisitions:
                    status_style = ""
                    display_status = req.get_status_display()
                    
                    if req.id in approved_items:
                        status_style = "background-color: #e8f5e9;"

                    all_requisitions_table += f"""
                        <tr style="{status_style}">
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.material_description}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.cimcon_part_number}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.req_qty}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.required_by_date}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{display_status}</td>
                        </tr>
                    """
                all_requisitions_table += "</tbody></table>"

                # Create table for approved requisitions (for both emails)
                approved_requisitions = all_requisitions.filter(id__in=approved_items)
                approved_table = ""

                if approved_requisitions.exists():
                    approved_table = """
                    <h3 style="color: #2e7d32; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Approved Requisitions in this Batch:</h3>
                    <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                        <thead>
                            <tr style="background-color: #e8f5e9;">
                                <th style="padding: 10px; border: 1px solid #ddd;">Material Description</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">CIMCON Part Number</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Quantity</th>
                                <th style="padding: 10px; border: 1px solid #ddd;">Required By</th>
                            </tr>
                        </thead>
                        <tbody>
                    """

                    for req in approved_requisitions:
                        approved_table += f"""
                            <tr>
                                <td style="padding: 10px; border: 1px solid #ddd;">{req.material_description}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{req.cimcon_part_number}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{req.req_qty}</td>
                                <td style="padding: 10px; border: 1px solid #ddd;">{req.required_by_date}</td>
                            </tr>
                        """
                    approved_table += "</tbody></table>"

                # MODIFIED: Create table with only approved requisitions for Store email
                approved_only_table = """
                <h3 style="color: #2e7d32; border-bottom: 1px solid #ddd; padding-bottom: 5px;">New Items for Verification:</h3>
                <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr style="background-color: #e8f5e9;">
                            <th style="padding: 10px; border: 1px solid #ddd;">Material Description</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">CIMCON Part Number</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Quantity</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Required By</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Submitted By</th>
                        </tr>
                    </thead>
                    <tbody>
                """

                for req in approved_requisitions:
                    approved_only_table += f"""
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.material_description}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.cimcon_part_number}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.req_qty}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.required_by_date}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.submitted_by}</td>
                        </tr>
                    """
                approved_only_table += "</tbody></table>"

                # EMAIL 1: Requisitor Email (existing)
                html_body_requisitor = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
                        <div style="padding: 20px; border-radius: 5px;">
                            <div style="border-bottom: 2px solid #28a745; padding-bottom: 10px;">
                                <h2 style="color: #28a745; margin-top: 0;">Requisition(s) Approved</h2>
                            </div>
                            
                            <p style="margin-top: 20px;">Dear {requisitor_name},</p>
                            
                            <p>We are pleased to inform you that the selected requisition(s) from your batch have been approved.</p>
                            
                            <div style="background-color: #e8f5e9; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p><strong>Project Code:</strong> {project.project_code}</p>
                                <p><strong>Batch ID:</strong> {batch_id}</p>
                                <p><strong>Date:</strong> {current_date}</p>
                                <p style="color: #28a745;"><strong>Status:</strong> Action Taken</p>
                            </div>
                            
                            {all_requisitions_table}
                            <br>
                            {approved_table}
                            
                            <p>Thank you</p>
                        </div>
                    </body>
                </html>
                """

                # Prepare messages to send
                messages_to_send = []

                # Message for Requisitor
                msg_requisitor = MIMEMultipart('alternative')
                msg_requisitor['From'] = self.sender_email
                msg_requisitor['To'] = requisitor.email
                msg_requisitor['Subject'] = subject

                text_part_requisitor = MIMEText(
                    f"Dear {requisitor_name},\n\n"
                    f"The selected requisition(s) from your batch for Project {project.project_code} have been approved.\n"
                    f"Batch ID: {batch_id}\n"
                    f"Date: {current_date}\n\n"
                    f"Please check the HTML version of this email for detailed information on the status of all requisitions in this batch.\n\n"
                    f"Thank you,\n"
                    f"CIMCON Purchase Requisition System", 
                    'plain'
                )
                html_part_requisitor = MIMEText(html_body_requisitor, 'html')

                msg_requisitor.attach(text_part_requisitor)
                msg_requisitor.attach(html_part_requisitor)

                messages_to_send.append({
                    'message': msg_requisitor,
                    'email': requisitor.email,
                    'name': requisitor_name,
                    'type': 'requisitor'
                })

                # MODIFIED: Messages for ALL Store users
                for store_user in store_users:
                    store_name = f"{store_user.first_name} {store_user.last_name}".strip()
                    if not store_name:
                        store_name = store_user.username

                    # EMAIL 2: Store Email (new) - Individual for each store user
                    html_body_store = f"""
                    <html>
                        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
                            <div style="padding: 20px; border-radius: 5px;">
                                <div style="border-bottom: 2px solid #ff9800; padding-bottom: 10px;">
                                    <h2 style="color: #ff9800; margin-top: 0;">New Items for Verification</h2>
                                </div>
                                
                                <p style="margin-top: 20px;">Dear {store_name},</p>
                                
                                <p>The following requisitions have been approved and require your verification for availability and procurement.</p>
                                
                                <div style="background-color: #fff3e0; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                    <p><strong>Project Code:</strong> {project.project_code}</p>
                                    <p><strong>Batch ID:</strong> {batch_id}</p>
                                    <p><strong>Division:</strong> {project.division.division_name}</p>
                                    <p><strong>Date Approved:</strong> {current_date}</p>
                                    <p style="color: #ff9800;"><strong>Action Required:</strong> Verification & Procurement</p>
                                </div>
                                
                                {approved_only_table}
                                
                                <p style="margin-top: 20px;">Please verify the availability of these items and proceed with the procurement process as per company guidelines.</p>
                                
                                <p>Thank you</p>
                            </div>
                        </body>
                    </html>
                    """

                    msg_store = MIMEMultipart('alternative')
                    msg_store['From'] = self.sender_email
                    msg_store['To'] = store_user.email
                    msg_store['Subject'] = f"New Items for Verification - Project {project.project_code} - Batch {batch_id}"

                    text_part_store = MIMEText(
                        f"Dear {store_name},\n\n"
                        f"New requisitions have been approved for Project {project.project_code} and require verification.\n"
                        f"Batch ID: {batch_id}\n"
                        f"Division: {project.division.division_name}\n"
                        f"Date Approved: {current_date}\n\n"
                        f"Please verify the availability of these items and proceed with procurement as per company guidelines.\n\n"
                        f"Please check the HTML version of this email for detailed item information.\n\n"
                        f"Thank you,\n"
                        f"CIMCON Purchase Requisition System", 
                        'plain'
                    )
                    html_part_store = MIMEText(html_body_store, 'html')

                    msg_store.attach(text_part_store)
                    msg_store.attach(html_part_store)

                    messages_to_send.append({
                        'message': msg_store,
                        'email': store_user.email,
                        'name': store_name,
                        'type': 'store'
                    })

                # Send all emails
                if messages_to_send:
                    with smtplib.SMTP(self.smtp_server, self.port) as server:
                        server.starttls()
                        server.login(self.sender_email, self.password)
                        
                        for msg_info in messages_to_send:
                            server.sendmail(self.sender_email, msg_info['email'], msg_info['message'].as_string())
                            logger.info(f"Approval notification email sent to {msg_info['type'].upper()} {msg_info['name']} ({msg_info['email']}) for batch {batch_id}")
                        
                        logger.info(f"Total approval emails sent: {len(messages_to_send)} (1 to requisitor + {store_users.count()} to store users) for batch {batch_id}")

            except Exception as e:
                logger.error(f"Error sending approval notification email: {e}")

        elif trigger == 'rejected_requisition':      
            batch_id = kwargs.get('batch_id', '')
            rejection_remarks = kwargs.get('rejection_remarks', '')

            try:
                # OPTIMIZED: Use select_related
                rejected_requisitions = Requisition.objects.filter(
                    batch_id=batch_id,
                    status='rejected'
                ).select_related('project', 'project__division')
                
                if not rejected_requisitions.exists():
                    logger.error(f"No rejected requisitions found for batch {batch_id}")
                    return

                first_req = rejected_requisitions.first()
                project = first_req.project
                division_id = project.division.id
                
                submitted_by = first_req.submitted_by
                first_name = submitted_by.split()[0] if submitted_by and ' ' in submitted_by else submitted_by

                requisitor = CustomUser.objects.filter(
                    division_id=division_id,
                    role='Requisitor',
                    first_name=first_name
                ).first()

                if not requisitor:
                    logger.error(f"No requisitor found for division {division_id}")
                    return
            
                requisitor_name = f"{requisitor.first_name} {requisitor.last_name}".strip()
                if not requisitor_name:
                    requisitor_name = requisitor.username
            
                current_date = time.strftime("%B %d, %Y")
                subject = f"Requisitions Rejected for Project {project.project_code} - Batch {batch_id}"

                # Create table for rejected requisitions
                rejected_table = """
                <table border="1" cellpadding="5" cellspacing="0" style="border-collapse: collapse; width: 100%;">
                    <thead>
                        <tr style="background-color: #ffebee;">
                            <th style="padding: 10px; border: 1px solid #ddd;">Material Description</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">CIMCON Part Number</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Quantity</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">Required By</th>
                        </tr>
                    </thead>
                    <tbody>
                """

                for req in rejected_requisitions:
                    rejected_table += f"""
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.material_description}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.cimcon_part_number}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.req_qty}</td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{req.required_by_date}</td>
                        </tr>
                    """
                rejected_table += "</tbody></table>"

                html_body = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto;">
                        <div style="padding: 20px; border-radius: 5px;">
                            <div style="border-bottom: 2px solid #dc3545; padding-bottom: 10px;">
                                <h2 style="color: #dc3545; margin-top: 0;">Requisition Rejected</h2>
                            </div>
                            
                            <p style="margin-top: 20px;">Dear {requisitor_name},</p>
                            
                            <p>We regret to inform you that requisition(s) for your project have been rejected.</p>
                            
                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <p><strong>Project Code:</strong> {project.project_code}</p>
                                <p><strong>Batch ID:</strong> {batch_id}</p>
                                <p><strong>Date:</strong> {current_date}</p>
                                <p style="color: #dc3545;"><strong>Status:</strong> Rejected</p>
                            </div>
                            
                            <div style="background-color: #ffebee; padding: 15px; border-radius: 5px; margin: 20px 0;">
                                <h3 style="color: #dc3545; margin-top: 0;">Rejection Remarks:</h3>
                                <p style="margin-bottom: 0;">{rejection_remarks}</p>
                            </div>
                            
                            <h3 style="color: #555; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Rejected Requisitions:</h3>
                            {rejected_table}
                            
                            <p style="margin-top: 20px;">Please review the rejection remarks and make necessary changes before resubmitting the requisition(s).</p>
                            
                            <p>Thank you</p>
                        </div>
                    </body>
                </html>
                """

                msg = MIMEMultipart('alternative')
                msg['From'] = self.sender_email
                msg['To'] = requisitor.email
                msg['Subject'] = subject

                text_part = MIMEText(
                    f"Dear {requisitor_name},\n\n"
                    f"Requisitions for Project {project.project_code} have been rejected.\n"
                    f"Batch ID: {batch_id}\n"
                    f"Date: {current_date}\n\n"
                    f"Rejection Remarks: {rejection_remarks}\n\n"
                    f"Please review the rejection remarks and make necessary changes before resubmitting.\n\n"
                    f"Thank you,\n"
                    f"CIMCON Purchase Requisition System", 
                    'plain'
                )
                html_part = MIMEText(html_body, 'html')

                msg.attach(text_part)
                msg.attach(html_part)

                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls()
                    server.login(self.sender_email, self.password)
                    server.sendmail(self.sender_email, requisitor.email, msg.as_string())
                    logger.info(f"Rejection notification email sent successfully for batch {batch_id}")

            except Exception as e:
                logger.error(f"Error sending rejection notification email: {e}")

@api_view(['GET'])
def get_requisitions_by_division(request, division_id):
    """
    Get requisitions filtered by division ID
    """
    try:
        # SECURITY: Verify user belongs to this division
        user = request.user
        if hasattr(user, 'division') and user.division and user.division.id != int(division_id):
            return Response({
                'error': 'Access denied: User does not belong to this division'
            }, status=403)
        
        # Get requisitions from specified division
        requisitions = Requisition.objects.select_related(
            'project',
            'project__division'
        ).filter(
            project__division_id=division_id
        ).order_by('-id')
        
        print(f"Found {requisitions.count()} requisitions for division {division_id}")
        
        # Serialize the data
        serializer = RequisitionSerializer(requisitions, many=True)
        
        division = Division.objects.get(id=division_id)
        
        return Response({
            'count': requisitions.count(),
            'division_id': int(division_id),
            'division_name': division.division_name,
            'requisitions': serializer.data
        })
        
    except Division.DoesNotExist:
        return Response({
            'error': f'Division {division_id} not found'
        }, status=404)
    except Exception as e:
        print(f"Error in get_requisitions_by_division: {str(e)}")
        return Response({
            'error': f'Error fetching requisitions: {str(e)}'
        }, status=500)
        
        
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_division_requisitions(request):
    """Get requisitions filtered by user's division for dashboard"""
    try:
        user = request.user
        user_division = get_user_division_or_403(user)
        
        print(f"User: {user.username}, Division: {user_division.division_name} (ID: {user_division.id})")
        
        # FIXED: Use regular filtering instead of custom manager
        requisitions = Requisition.objects.select_related(
            'project',
            'project__division'
        ).filter(
            project__division=user_division
        ).order_by('-id')
        
        print(f"Found {requisitions.count()} requisitions for division {user_division.id}")
        
        # Serialize the data
        serializer = RequisitionSerializer(requisitions, many=True)
        
        return Response({
            'count': requisitions.count(),
            'division_id': user_division.id,
            'division_name': user_division.division_name,
            'requisitions': serializer.data
        })
        
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=403)
    except Exception as e:
        print(f"Error in get_division_requisitions: {str(e)}")
        import traceback
        traceback.print_exc()
        return Response({
            'error': f'Error fetching division requisitions: {str(e)}'
        }, status=500)

# ENHANCED: Projects endpoint with division filtering
@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_division_projects(request):
    """Get projects filtered by user's division"""
    try:
        user = request.user
        user_division = get_user_division_or_403(user)
        
        projects = Project.objects.select_related('division').filter(
            division=user_division
        ).order_by('-project_code')
        
        serializer = ProjectSerializer(projects, many=True)
        
        return Response({
            'count': projects.count(),
            'division_id': user_division.id,
            'division_name': user_division.division_name,
            'projects': serializer.data
        })
        
    except PermissionDenied as e:
        return Response({'error': str(e)}, status=403)
    except Exception as e:
        return Response({'error': str(e)}, status=500)