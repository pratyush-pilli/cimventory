from email.mime.application import MIMEApplication
import json
import os
from decimal import Decimal
from django.apps import apps
from django.conf import settings
from django.shortcuts import render
import requests
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework import status
from .models import PurchaseOrder, POLineItem, POHistory
from .serializers import PurchaseOrderSerializer, POLineItemSerializer, PendingPOSerializer
from django.http import HttpResponse, JsonResponse
from django.db.models import Sum
import logging
from rest_framework.permissions import IsAuthenticated
from django.core.exceptions import ValidationError
from django.utils import timezone
from django.core.mail import send_mail
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.template.loader import render_to_string
from num2words import num2words
from django.templatetags.static import static
from django.conf import settings
from rest_framework import viewsets
from datetime import datetime
import re
from users.models import CustomUser
from items.models import ItemMaster
from master.pdf_generator import PurchaseOrderPDFGenerator
from master.views import process_items_for_pdf, get_currency_symbol


logger = logging.getLogger(__name__)
class POLineItemViewSet(viewsets.ModelViewSet):
    queryset = POLineItem.objects.select_related('purchase_order').all()
    serializer_class = POLineItemSerializer

    def get_queryset(self):
        queryset = super().get_queryset()
        
        # Add filters if needed
        po_number = self.request.query_params.get('po_number', None)
        if po_number:
            queryset = queryset.filter(purchase_order__po_number=po_number)
            
        return queryset

@api_view(['GET'])
def download_po(request, po_number):
    try:
        # Remove any status restrictions - allow download for all POs including pending ones
        purchase_order = PurchaseOrder.objects.get(po_number=po_number)
        vendor_name_safe = purchase_order.vendor_name.replace(" ", "_")
        
        # Update document name to use PDF extension
        document_name = f"Purchase_Order_{po_number}_{vendor_name_safe}.pdf"
        document_path = os.path.join(settings.MEDIA_ROOT, 'purchase_orders', document_name)

        if not os.path.exists(document_path):
            # If PDF doesn't exist, try to generate it on-the-fly for pending POs
            logger.warning(f"PDF not found at {document_path}, attempting to generate...")
            return HttpResponse(
                json.dumps({'error': 'Purchase Order document not found. Please contact administrator.'}), 
                content_type='application/json', 
                status=404
            )

        with open(document_path, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/pdf')
            response['Content-Disposition'] = f'attachment; filename="{os.path.basename(document_path)}"'
            return response
            
    except PurchaseOrder.DoesNotExist:
        return HttpResponse(
            json.dumps({'error': 'Purchase Order not found'}), 
            content_type='application/json', 
            status=404
        )
    except Exception as e:
        logger.error(f"Error downloading PO {po_number}: {str(e)}")
        return HttpResponse(
            json.dumps({'error': str(e)}), 
            content_type='application/json', 
            status=500
        )

@api_view(['POST'])
def save_po(request):
    try:
        data = request.data
        items = data.get('items', [])
        
        # Create the PurchaseOrder record
        po = PurchaseOrder.objects.create(
            po_number=data.get('po_number', ''),
            po_date=data.get('po_date', timezone.now().date()),
            quote_ref_number=data.get('quote_ref_number', ''),
            project_code=data.get('project_code', ''),
            vendor_name=data.get('vendor_name', 'na'),
            vendor_address=data.get('vendor_address', 'na'),
            vendor_email=data.get('vendor_email', 'na'),
            vendor_gstin=data.get('vendor_gstin', '0'),
            vendor_pan=data.get('vendor_pan', '0'),
            vendor_state=data.get('vendor_state', 'na'),
            vendor_state_code=data.get('vendor_state_code', 'na'),
            vendor_contact=data.get('vendor_contact', 'na'),
            vendor_payment_terms=data.get('vendor_payment_terms', 'na'),
            vendor_code=data.get('vendor_code', ''),
            consignee_name=data.get('consignee_name', ''),
            consignee_address=data.get('consignee_address', ''),
            consignee_mobile=data.get('consignee_mobile', ''),
            consignee_attention=data.get('consignee_attention', ''),
            invoice_name=data.get('invoice_name', ''),
            invoice_address=data.get('invoice_address', ''),
            invoice_gstin=data.get('invoice_gstin', ''),
            total_amount=data.get('total_amount', 0),
            payment_terms=data.get('payment_terms', ''),
            warranty_terms=data.get('warranty_terms', ''),
            delivery_schedule=data.get('delivery_schedule', ''),
            freight_terms=data.get('freight_terms', ''),
            tpi_terms=data.get('tpi_terms', ''),
            installation_terms=data.get('installation_terms', ''),
            commissioning=data.get('commissioning', ''),
            notes=data.get('notes', 'NA'),
            status='draft',
            approval_status=False,
            rejection_status=False,
            inward_status='open',
            currency_code=data.get('currency_code'),
            currency_symbol=data.get('currency_symbol'),
            is_revised=False,
            revision_number=1,
        )

        # Create line items and update requisition status
        for item in items:
            # Handle HSN code with multiple possible field names
            hsn_code = (item.get('hsn_code') or 
                       item.get('hsnSac') or 
                       item.get('hsn_sac') or 
                       item.get('HSN') or '')
            
            # Create PO line item
            POLineItem.objects.create(
                purchase_order=po,
                item_no=item.get('item_no', ''),
                material_description=item.get('material_description', ''),
                make=item.get('make', ''),
                material_group=item.get('material_group', ''),
                hsn_code=hsn_code,  # Use the processed HSN code
                quantity=item.get('quantity', 0),
                unit=item.get('unit', 'Nos'),
                unit_price=item.get('unit_price', 0),
                total_price=item.get('total_price', 0),
                requisition_id=item.get('requisition_id', 0),
                added_in_revision=po.version,  # ✅ Add this line - track which version this item was added in
                is_revised=False,
            )
            
            # Update Master status
            requisition_id = item.get('requisition_id')
            if requisition_id:
                try:
                    from master.models import Master
                    Master.objects.filter(id=requisition_id).update(
                        ordering_status='Ordered',  # Using the exact status from STATUS_CHOICES
                        po_number=po.po_number
                    )
                except Exception as e:
                    logger.error(f"Error updating master status: {str(e)}")

        return Response({
            'status': 'success',
            'message': 'PO created successfully',
            'po_id': po.id,
            'po_number': po.po_number,
            'updated_items': items  # Include the items in response
        })

    except Exception as e:
        logger.error(f"Error creating PO: {str(e)}")
        return Response({
            'status': 'error',
            'message': f'Failed to create PO: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        
        
@api_view(['GET'])
def get_latest_po_number(request):
    try:
        latest_po = PurchaseOrder.objects.order_by('-id').first()  # Get the latest PO
        if latest_po:
            return JsonResponse({"latest_po_number": latest_po.po_number}, status=status.HTTP_200_OK)
        return JsonResponse({"latest_po_number": None}, status=status.HTTP_200_OK)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_all_po_numbers(request):
    try:
        # Only get POs that are approved and not completed
        po_numbers = PurchaseOrder.objects.filter(
            approval_status=True
        ).exclude(
            inward_status='completed'
        ).values_list('po_number', flat=True)
        return Response(list(po_numbers))
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_purchase_order_details(request, po_number):
    try:
        purchase_order = PurchaseOrder.objects.get(po_number=po_number)
        line_items = purchase_order.line_items.all()
        
        data = {
            'po_number': purchase_order.po_number,
            'po_date': purchase_order.po_date,                  # ADD
            'project_code': purchase_order.project_code,        # ADD
            'version': str(purchase_order.version),             # ADD
            'inward_status': purchase_order.inward_status,  # Add overall PO status
            'total_inwarded_quantity': float(purchase_order.total_inwarded_quantity or 0),  # Add total inwarded
            'line_items': [
                {
                    'item_no': item.item_no,
                    'material_description': item.material_description,
                    'make': item.make,
                    'material_group': item.material_group,
                    'hsn_code': item.hsn_code,  # ADD THIS LINE
                    'quantity': float(item.quantity),  # Convert Decimal to float
                    'unit_price': float(item.unit_price),  # Convert Decimal to float
                    'inwarded_quantity': float(item.inwarded_quantity or 0),  # Add inwarded quantity
                    'already_inwarded': float(item.inwarded_quantity or 0),  # Add for compatibility
                    'remaining_quantity': float(item.quantity - (item.inwarded_quantity or 0)),  # Add remaining
                    'inward_status': (
                        'completed' if item.inwarded_quantity >= item.quantity
                        else 'partially_inwarded' if item.inwarded_quantity > 0
                        else 'open'
                    )  # Add item-level status
                } for item in line_items
            ]
        }
        
        # Add total amounts
        data['total_ordered_quantity'] = float(sum(item.quantity for item in line_items))
        data['total_amount'] = float(purchase_order.total_amount or 0)
        
        # Log the response for debugging
        logger.info(f"PO Details response for {po_number}: {data}")
        
        return Response(data)
    except PurchaseOrder.DoesNotExist:
        logger.error(f"PO {po_number} not found")
        return Response({'error': 'Purchase Order not found'}, status=404)
    except Exception as e:
        logger.error(f"Error fetching PO details for {po_number}: {str(e)}")
        return Response({'error': str(e)}, status=500)
    
@api_view(['GET'])
def get_project_codes_with_po_details(request):
    try:
        project_code = request.query_params.get('project_code', None)
        start_date = request.query_params.get('start_date', None)
        end_date = request.query_params.get('end_date', None)

        # Fetch only approved purchase orders
        purchase_orders = PurchaseOrder.objects.filter(
            approval_status=True
        ).prefetch_related('line_items')

        # Filter by project code if provided
        if project_code:
            purchase_orders = purchase_orders.filter(project_code=project_code)

        # Filter by date range if provided
        if start_date and end_date:
            purchase_orders = purchase_orders.filter(po_date__range=[start_date, end_date])

        # Prepare the response data
        project_codes_with_details = []
        for po in purchase_orders:
            # Calculate totals for the PO
            total_ordered = sum(float(item.quantity) for item in po.line_items.all())
            total_inwarded = sum(float(item.inwarded_quantity or 0) for item in po.line_items.all())
            
            po_data = {
                # PO Details
                'po_number': po.po_number,
                'po_date': po.po_date,
                'quote_ref_number': po.quote_ref_number,
                'project_code': po.project_code,
                
                # Vendor Details
                'vendor_name': po.vendor_name,
                'vendor_address': po.vendor_address,
                'vendor_email': po.vendor_email,
                'vendor_gstin': po.vendor_gstin,
                'vendor_contact': po.vendor_contact,
                'vendor_payment_terms': po.vendor_payment_terms,
                
                # Financial Details
                'total_amount': float(po.total_amount),
                
                # Terms and Conditions
                'payment_terms': po.payment_terms,
                'warranty_terms': po.warranty_terms,
                'delivery_schedule': po.delivery_schedule,
                'freight_terms': po.freight_terms,
                'tpi_terms': po.tpi_terms,
                'installation_terms': po.installation_terms,
                
                # Consignee Details
                'consignee_name': po.consignee_name,
                'consignee_address': po.consignee_address,
                'consignee_mobile': po.consignee_mobile,
                'consignee_attention': po.consignee_attention,
                
                # Invoice Details
                'invoice_name': po.invoice_name,
                'invoice_address': po.invoice_address,
                'invoice_gstin': po.invoice_gstin,
                
                # Status and Tracking
                'status': po.status,
                'notes': po.notes,
                'created_at': po.created_at,
                'updated_at': po.updated_at,
                'created_by': po.created_by,
                'inward_status': po.inward_status,
                'total_inwarded_quantity': float(po.total_inwarded_quantity),
                
                # Approval/Rejection Details
                'approval_status': po.approval_status,
                'rejection_status': po.rejection_status,
                'approval_date': po.approval_date,
                'approved_by': po.approved_by,
                'rejection_remarks': po.rejection_remarks,
                'rejected_by': po.rejected_by,
                'rejection_date': po.rejection_date,
                
                'remaining_quantity': total_ordered - total_inwarded,
                'line_items': [
                    {
                        'item_no': item.item_no,
                        'material_description': item.material_description,
                        'make': item.make,
                        'material_group': item.material_group,
                        'hsn_code': item.hsn_code,  # ADD THIS LINE
                        'quantity': float(item.quantity),
                        'unit_price': float(item.unit_price),
                        'total_price': float(item.total_price or 0),
                        'inwarded_quantity': float(item.inwarded_quantity or 0),
                        'already_inwarded': float(item.inwarded_quantity or 0),  # For compatibility
                        'remaining_quantity': float(item.quantity - (item.inwarded_quantity or 0)),
                        'inward_status': (
                            'completed' if item.inwarded_quantity >= item.quantity
                            else 'partially_inwarded' if item.inwarded_quantity > 0
                            else 'open'
                        )
                    } for item in po.line_items.all()
                ]
            }
            project_codes_with_details.append(po_data)

        # Add logging for debugging
        logger.info(f"Returning {len(project_codes_with_details)} PO details")
        
        return Response(project_codes_with_details, status=200)

    except Exception as e:
        logger.error(f"Error in get_project_codes_with_po_details: {str(e)}")
        return Response({'error': str(e)}, status=500)

@api_view(['GET'])
def get_po_inward_status(request, po_number):
    try:
        po = PurchaseOrder.objects.get(po_number=po_number)
        line_items = po.line_items.all()
        
        total_ordered = sum(item.quantity for item in line_items)
        total_inwarded = sum(item.inwarded_quantity for item in line_items)
        
        status_data = {
            'po_number': po_number,
            'status': po.inward_status,
            'total_ordered': float(total_ordered),
            'total_inwarded': float(total_inwarded),
            'line_items': [{
                'item_no': item.item_no,
                'material_description': item.material_description,
                'ordered_quantity': float(item.quantity),
                'inwarded_quantity': float(item.inwarded_quantity),
                'unit_price': float(item.unit_price),
                'total_price': float(item.total_price),
                'remaining_quantity': float(item.quantity - item.inwarded_quantity)
            } for item in line_items]
        }
        
        return Response(status_data)
    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase Order not found'}, status=404)

def update_po_status(po_number):
    """Helper function to update PO status based on inward quantities"""
    try:
        po = PurchaseOrder.objects.get(po_number=po_number)
        line_items = po.line_items.all()
        
        total_ordered = sum(item.quantity for item in line_items)
        total_inwarded = sum(item.inwarded_quantity for item in line_items)
        
        if total_inwarded == 0:
            new_status = 'open'
        elif total_inwarded < total_ordered:
            new_status = 'partially_inwarded'
        else:
            new_status = 'completed'
            
        po.inward_status = new_status
        po.total_inwarded_quantity = total_inwarded
        po.save()
        
        return new_status
    except Exception as e:
        print(f"Error updating PO status: {str(e)}")
        return None

@api_view(['GET'])
def get_pending_pos(request):
    """Get all POs with approval_status as false"""
    try:
        revised_only = request.query_params.get('revised_only', 'false').lower() == 'true'
        # Fetch all POs where approval_status is false
        pos = PurchaseOrder.objects.filter(approval_status=False, rejection_status=False)
        
        if revised_only:
            pos = pos.filter(version__gt=1.0)  # Changed from revised=True to version__gt=1.0
            logger.info(f"Filtering for revised POs (version > 1.0)")

        
        logger.info(f"Found {pos.count()} pending POs with approval_status=False")
        
        data = []
        for po in pos:
            po_data = {
                # PO Details
                'po_number': po.po_number,
                'version': float(po.version) if po.version else 1.0,
                'po_date': po.po_date,
                'quote_ref_number': po.quote_ref_number,
                'project_code': po.project_code,
                
                # Vendor Details
                'vendor_name': po.vendor_name,
                'vendor_address': po.vendor_address,
                'vendor_email': po.vendor_email,
                'vendor_gstin': po.vendor_gstin,
                'vendor_pan': po.vendor_pan,
                'vendor_state': po.vendor_state,
                'vendor_state_code': po.vendor_state_code,
                'vendor_contact': po.vendor_contact,
                'vendor_payment_terms': po.vendor_payment_terms,
                
                # Financial Details
                'total_amount': float(po.total_amount),
                
                # Terms and Conditions
                'payment_terms': po.payment_terms,
                'warranty_terms': po.warranty_terms,
                'delivery_schedule': po.delivery_schedule,
                'freight_terms': po.freight_terms,
                
                'tpi_terms': po.tpi_terms,
                'installation_terms': po.installation_terms,
                
                # Consignee Details
                'consignee_name': po.consignee_name,
                'consignee_address': po.consignee_address,
                'consignee_mobile': po.consignee_mobile,
                'consignee_attention': po.consignee_attention,
                
                # Invoice Details
                'invoice_name': po.invoice_name,
                'invoice_address': po.invoice_address,
                'invoice_gstin': po.invoice_gstin,
                
                # Status and Tracking
                'status': po.status,
                'notes': po.notes,
                'created_at': po.created_at,
                'updated_at': po.updated_at,
                'created_by': po.created_by,
                'inward_status': po.inward_status,
                'total_inwarded_quantity': float(po.total_inwarded_quantity),
                
                # Approval/Rejection Details
                'approval_status': po.approval_status,
                'rejection_status': po.rejection_status,
                'approval_date': po.approval_date,
                'approved_by': po.approved_by,
                'rejection_remarks': po.rejection_remarks,
                'rejected_by': po.rejected_by,
                'rejection_date': po.rejection_date,
                'currency_code': po.currency_code,
                'currency_symbol': po.currency_symbol,
                # Line Items
                'line_items': [{
                    'id': item.id,
                    'requisition_id': item.requisition_id,
                    'item_no': item.item_no,
                    'material_description': item.material_description,
                    'make': item.make,
                    'material_group': item.material_group,
                    'hsn_code': item.hsn_code,  # ADD THIS LINE
                    'quantity': float(item.quantity),
                    'unit': item.unit,
                    'unit_price': float(item.unit_price),
                    'total_price': float(item.total_price),
                    'expected_delivery': item.expected_delivery,
                    'inwarded_quantity': float(item.inwarded_quantity)
                } for item in po.line_items.all()]
            }
            data.append(po_data)
            
        return Response(data)
    except Exception as e:
        logger.error(f"Error fetching pending POs: {str(e)}")
        return Response(
            {'error': 'Failed to fetch pending purchase orders'}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['POST'])
def approve_po(request, po_number):
    """Approve a purchase order"""
    try:
        po = PurchaseOrder.objects.get(po_number=po_number)
        
        # Directly set the approval status to true
        po.approval_status = True
        po.approval_date = timezone.now()
        po.approved_by = request.user.username if hasattr(request.user, 'username') else 'system'
        po.save()

        # Create history entry
        POHistory.objects.create(
            purchase_order=po,
            action='approved',
            description=f'PO approved by {po.approved_by}',
            created_by=po.approved_by
        )

        # Optionally, send an email notification to the vendor
        send_mail(
            f'PO {po_number} Approved',
            f'Purchase Order {po_number} has been approved by {po.approved_by}',
            settings.DEFAULT_FROM_EMAIL,
            [po.vendor_email] if po.vendor_email else [],
            fail_silently=True
        )

        return Response({
            'message': 'Purchase Order approved successfully',
            'po_number': po_number
        })

    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase Order not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
def reject_po(request, po_number):
    try:
        po = PurchaseOrder.objects.get(po_number=po_number)
        
        rejection_remarks = request.data.get('rejection_remarks')
        if not rejection_remarks:
            return Response({
                'error': 'Rejection remarks are required'
            }, status=400)

        # Update both status and rejection_status
        po.status = 'rejected'
        po.approval_status = False
        po.rejection_status = True
        po.rejection_remarks = rejection_remarks
        po.rejected_by = request.user.username if hasattr(request.user, 'username') else 'system'
        po.rejection_date = timezone.now()
        po.save()

        # Create history entry
        POHistory.objects.create(
            purchase_order=po,
            action='rejected',
            description=f'PO rejected by {po.rejected_by}. Reason: {rejection_remarks}',
            created_by=po.rejected_by
        )

        return Response({
            'message': 'Purchase Order rejected successfully',
            'po_number': po_number,
            'rejection_remarks': rejection_remarks,
            'rejected_by': po.rejected_by,
            'rejection_date': po.rejection_date
        })

    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase Order not found'}, status=404)
    except Exception as e:
        logger.error(f"Error rejecting PO {po_number}: {str(e)}")
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
def resubmit_po(request, po_number):
    """Resubmit a rejected PO for approval"""
    try:
        po = PurchaseOrder.objects.get(po_number=po_number)
        
        if po.status != 'rejected':
            return Response({
                'error': 'Only rejected POs can be resubmitted'
            }, status=400)

        po.status = 'pending_approval'
        po.rejection_reason = None
        po.save()

        # Create history entry
        POHistory.objects.create(
            purchase_order=po,
            action='resubmitted',
            description=f'PO resubmitted for approval by {request.user.get_full_name()}',
            created_by=request.user.username
        )

        return Response({
            'message': 'Purchase Order resubmitted successfully',
            'po_number': po_number
        })

    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase Order not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
def edit_po(request, po_number):
    try:
        po = PurchaseOrder.objects.get(po_number=po_number)
        
        if po.status not in ['rejected', 'draft']:
            return Response({
                'error': 'Only draft or rejected POs can be edited'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Update PO details based on request.data
        # Example: po.vendor_name = request.data.get('vendor_name', po.vendor_name)
        # Add all fields that can be updated

        po.reset_for_resubmission()  # Reset the status for resubmission

        po.save()
        return Response({
            'message': 'PO updated and resubmitted for approval',
            'po_number': po.po_number,
            'status': po.status
        }, status=status.HTTP_200_OK)

    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase Order not found'}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_rejected_pos(request):
    """Get all rejected purchase orders"""
    try:
        # Update the filter to use rejection_status
        pos = PurchaseOrder.objects.filter(rejection_status=True)
        data = []
        for po in pos:
            po_data = {

                # PO Details
                'po_number': po.po_number,
                'po_date': po.po_date,
                'quote_ref_number': po.quote_ref_number,
                'project_code': po.project_code,
                
                # Vendor Details
                'vendor_name': po.vendor_name,
                'vendor_address': po.vendor_address,
                'vendor_email': po.vendor_email,
                'vendor_gstin': po.vendor_gstin,
                'vendor_pan': po.vendor_pan,
                'vendor_state': po.vendor_state,
                'vendor_state_code': po.vendor_state_code,
                'vendor_code': po.vendor_code,
                'vendor_contact': po.vendor_contact,
                'vendor_payment_terms': po.vendor_payment_terms,
                
                # Financial Details
                'total_amount': float(po.total_amount),
                
                # Terms and Conditions
                'payment_terms': po.payment_terms,
                'warranty_terms': po.warranty_terms,
                'delivery_schedule': po.delivery_schedule,
                'freight_terms': po.freight_terms,
                'tpi_terms': po.tpi_terms,
                'installation_terms': po.installation_terms,
                
                # Consignee Details
                'consignee_name': po.consignee_name,
                'consignee_address': po.consignee_address,
                'consignee_mobile': po.consignee_mobile,
                'consignee_attention': po.consignee_attention,
                
                # Invoice Details
                'invoice_name': po.invoice_name,
                'invoice_address': po.invoice_address,
                'invoice_gstin': po.invoice_gstin,
                
                # Status and Tracking
                'status': po.status,
                'notes': po.notes,
                'created_at': po.created_at,
                'updated_at': po.updated_at,
                'created_by': po.created_by,
                'inward_status': po.inward_status,
                'total_inwarded_quantity': float(po.total_inwarded_quantity),
                
                # Approval/Rejection Details
                'approval_status': po.approval_status,
                'rejection_status': po.rejection_status,
                'approval_date': po.approval_date,
                'approved_by': po.approved_by,
                'rejection_remarks': po.rejection_remarks,
                'rejected_by': po.rejected_by,
                'rejection_date': po.rejection_date,
                'line_items': [{
                    'id': item.id,
                    'item_no': item.item_no,
                    'material_description': item.material_description,
                    'make': item.make,
                    'material_group': item.material_group,
                    'hsn_code': item.hsn_code,  # ADD THIS LINE
                    'quantity': float(item.quantity),
                    'unit_price': float(item.unit_price),
                    'total_price': float(item.total_price),
                    'unit': item.unit
                } for item in po.line_items.all()]
            }
            data.append(po_data)
        return Response(data)
    except Exception as e:
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET'])
def get_po_history(request, po_number):
    try:
        po = PurchaseOrder.objects.get(po_number=po_number)
        history_entries = POHistory.objects.filter(purchase_order=po).order_by('-created_at')
        
        history_data = []
        for entry in history_entries:
            entry_data = {
                'action': entry.action,
                'description': entry.description,
                'changed_by': entry.created_by or 'System',  # Map to frontend field name
                'changed_at': entry.created_at,  # Map to frontend field name
                'changes': [],  # Empty array to prevent undefined error
                'notes': entry.description,  # Add notes field
            }
            
            # Add version information if available
            if entry.previous_version is not None or entry.new_version is not None:
                entry_data['previous_version'] = float(entry.previous_version) if entry.previous_version else None
                entry_data['new_version'] = float(entry.new_version) if entry.new_version else None
            
            history_data.append(entry_data)
            
        return Response(history_data)
        
    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'PO not found'}, status=404)

@api_view(['PUT'])
def update_po(request, po_number):
    """Update a purchase order and resubmit for approval"""
    try:
        po = PurchaseOrder.objects.get(po_number=po_number)
        
        # Allow editing if status is draft/rejected/approved OR if approval_status is True
        if po.status not in ['rejected', 'draft', 'approved'] and not po.approval_status:
            return Response({
                'error': 'Only draft, rejected, or approved POs can be updated'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get PO details and line items from request
        po_details = request.data.get('po_details', {})
        line_items_data = request.data.get('line_items', [])
        
        # Get additional data from request
        totals = request.data.get('totals', {})
        delivery_address = request.data.get('deliveryAddress', '')
        currency = request.data.get('currency', {'symbol': '₹', 'code': 'INR'})
        total_in_words = request.data.get('totalInWords', 'N/A')
        terms_and_conditions = request.data.get('terms_and_conditions', '')
        
        # Handle approved PO: bump version and reset to pending_approval with history
        if po.approval_status or po.status == 'approved':
            prev_version = po.version or Decimal('1.0')
            po.version = (po.version or Decimal('1.0')) + Decimal('1.0')
            po.approval_status = False
            po.rejection_status = False
            po.status = 'pending_approval'
            po.approval_date = None
            po.approved_by = None

            POHistory.objects.create(
                purchase_order=po,
                action='revision',
                description=f'Approved PO edited and resubmitted. Version changed {prev_version} -> {po.version}',
                created_by=request.user.username if hasattr(request.user, 'username') else 'system',
                previous_version=prev_version,
                new_version=po.version,
            )
        else:
            # For draft/rejected edits, ensure pending_approval and log edit
            po.status = 'pending_approval'
            po.approval_status = False
            po.rejection_status = False

            POHistory.objects.create(
                purchase_order=po,
                action='edit_resubmitted',
                description='PO edited and resubmitted for approval',
                created_by=request.user.username if hasattr(request.user, 'username') else 'system'
            )
        # Enhanced logging for debugging
        logger.info("Line items data received for PO update:")
        for item in line_items_data:
            logger.info(f"Item: {item}")

        # Update HSN codes in ItemMaster with enhanced error handling
        try:
            for item_data in line_items_data:
                item_no = item_data.get('item_no')
                hsn_sac = item_data.get('hsnSac') or item_data.get('hsn_sac')
                
                if not item_no or not hsn_sac:
                    logger.warning(f"Skipping HSN update for item {item_no} due to missing data")
                    continue
                    
                item_master = ItemMaster.objects.filter(cimcon_part_no=item_no).first()
                
                if item_master:
                    old_hsn_code = item_master.hsn_code
                    item_master.hsn_code = hsn_sac
                    item_master.save()
                    logger.info(f"Updated HSN code for item {item_no} from {old_hsn_code} to {hsn_sac}")
                else:
                    logger.warning(f"ItemMaster record not found for item {item_no}")
        except Exception as e:
            logger.error(f"Error updating HSN codes: {str(e)}")

        # Update PO details (enhanced logic...)
        if po_details:
            po.vendor_name = po_details.get('vendor_name', po.vendor_name)
            po.vendor_address = po_details.get('vendor_address', po.vendor_address)
            po.vendor_email = po_details.get('vendor_email', po.vendor_email)
            po.vendor_contact = po_details.get('vendor_contact', po.vendor_contact)
            po.vendor_payment_terms = po_details.get('vendor_payment_terms', po.vendor_payment_terms)
            po.vendor_gstin = po_details.get('vendor_gstin', po.vendor_gstin)  # Add this
            po.vendor_pan = po_details.get('vendor_pan', po.vendor_pan)        # Add this
            po.vendor_state = po_details.get('vendor_state', po.vendor_state)  # Add this
            po.vendor_state_code = po_details.get('vendor_state_code', po.vendor_state_code)  # Add this
            
            po.project_code = po_details.get('project_code', po.project_code)
            po.quote_ref_number = po_details.get('quote_ref_number', po.quote_ref_number)
            
            po.payment_terms = po_details.get('payment_terms', po.payment_terms)
            po.warranty_terms = po_details.get('warranty_terms', po.warranty_terms)
            po.delivery_schedule = po_details.get('delivery_schedule', po.delivery_schedule)
            po.freight_terms = po_details.get('freight_terms', po.freight_terms)
            po.tpi_terms = po_details.get('tpi_terms', po.tpi_terms)
            po.installation_terms = po_details.get('installation_terms', po.installation_terms)
            po.commissioning = po_details.get('commissioning_terms', po.commissioning)  # Add this
            
            po.consignee_name = po_details.get('consignee_name', po.consignee_name)
            po.consignee_address = po_details.get('consignee_address', po.consignee_address)
            po.consignee_mobile = po_details.get('consignee_mobile', po.consignee_mobile)
            po.consignee_attention = po_details.get('consignee_attention', po.consignee_attention)
            
            po.invoice_name = po_details.get('invoice_name', po.invoice_name)
            po.invoice_address = po_details.get('invoice_address', po.invoice_address)
            po.invoice_gstin = po_details.get('invoice_gstin', po.invoice_gstin)

        # Update line items with enhanced field handling
        # Update existing line items and create new ones
        for item_data in line_items_data:
            item_no = item_data.get('item_no')
            
            if not item_no:
                logger.warning(f"Skipping item without item_no: {item_data}")
                continue
            
            # Try to find existing line item by item_no
            line_item = POLineItem.objects.filter(
                purchase_order=po,
                item_no=item_no
            ).first()
            
            if line_item:
                # Update existing line item
                line_item.quantity = item_data.get('quantity', line_item.quantity)
                line_item.unit_price = item_data.get('unit_price', line_item.unit_price)
                line_item.material_description = item_data.get('material_description', line_item.material_description)
                line_item.hsn_code = item_data.get('hsn_code') or item_data.get('hsnSac') or item_data.get('hsn_sac') or line_item.hsn_code
                line_item.make = item_data.get('make', line_item.make)
                line_item.material_group = item_data.get('material_group', line_item.material_group)
                line_item.unit = item_data.get('unit', line_item.unit)
                line_item.total_price = float(line_item.quantity) * float(line_item.unit_price)
                line_item.is_revised = True  # Mark as revised
                line_item.save()
                logger.info(f"Updated existing line item for PO {po_number}: {item_no}")
            else:
                # This is a new item - create it
                hsn_code = item_data.get('hsn_code') or item_data.get('hsnSac') or item_data.get('hsn_sac') or ''
                
                POLineItem.objects.create(
                    purchase_order=po,
                    item_no=item_no,
                    material_description=item_data.get('material_description', ''),
                    make=item_data.get('make', ''),
                    material_group=item_data.get('material_group', ''),
                    hsn_code=hsn_code,
                    quantity=item_data.get('quantity', 0),
                    unit=item_data.get('unit', 'Nos'),
                    unit_price=item_data.get('unit_price', 0),
                    total_price=float(item_data.get('quantity', 0)) * float(item_data.get('unit_price', 0)),
                    requisition_id=item_data.get('requisition_id', 0),
                    added_in_revision=po.version,
                    is_revised=False,
                )
                logger.info(f"Created new line item for PO {po_number}: {item_no}")

                # Update Master status for newly added items
                requisition_id = item_data.get('requisition_id')
                if requisition_id:
                    try:
                        from master.models import Master
                        Master.objects.filter(id=requisition_id).update(
                            ordering_status='Ordered',
                            po_number=po.po_number
                        )
                        logger.info(f"Updated Master status for requisition {requisition_id}")
                    except Exception as e:
                        logger.error(f"Error updating master status: {str(e)}")

        # Recalculate total amount properly
        total_amount = sum(
            float(item.quantity) * float(item.unit_price) * (1 + (item_data.get('gst_percentage', 18) / 100))
            for item, item_data in zip(po.line_items.all(), line_items_data)
        )
        po.total_amount = total_amount

        # Update PO status
        po.status = 'pending_approval'
        po.rejection_status = False
        po.rejection_remarks = None
        po.rejected_by = None
        po.rejection_date = None
        po.save()

        # Create history entry
        if 'prev_version' not in locals():
            POHistory.objects.create(
                purchase_order=po,
                action='updated',
                description='PO updated and resubmitted for approval',
                created_by=request.user.username if hasattr(request.user, 'username') else 'system'
            )
        # ============= REGENERATE PDF WITH UPDATED DATA =============
        try:
            po_date = po.po_date.strftime('%Y-%m-%d') if po.po_date else datetime.now().strftime('%Y-%m-%d')
            
            # Load terms and conditions from file if not provided
            if not terms_and_conditions or terms_and_conditions.strip() == '':
                try:
                    tc_path = os.path.join(os.path.dirname(__file__), '..', 'master', "t&c.txt")
                    if os.path.exists(tc_path):
                        with open(tc_path, 'r', encoding='utf-8') as tc_file:
                            terms_and_conditions = tc_file.read()
                            logger.info(f"Loaded terms and conditions from file: {len(terms_and_conditions)} characters")
                    else:
                        logger.warning(f"Terms and conditions file not found at: {tc_path}")
                        terms_and_conditions = "Terms and conditions file not found."
                except Exception as e:
                    logger.error(f"Error reading terms and conditions: {str(e)}")
                    terms_and_conditions = "Error loading terms and conditions."

            # Process line items with enhanced data mapping
            processed_items = []
            for item_data in line_items_data:
                # Enhanced data mapping for items
                processed_item = {
                    'item_no': item_data.get('item_no', ''),
                    'material_description': item_data.get('material_description', ''),
                    'make': item_data.get('make', ''),
                    'material_group': item_data.get('material_group', ''),
                    'quantity': float(item_data.get('quantity', 0)),
                    'unit': item_data.get('unit', 'Nos'),
                    'unit_price': float(item_data.get('unit_price', 0)),
                    'total_price': float(item_data.get('total_price', 0)),
                    'gst_value': float(item_data.get('gst_value', 0)),
                    'taxable_value': float(item_data.get('taxable_value', 0)),
                    'gst_percentage': float(item_data.get('gst_percentage', 0))
                }
                
                # Handle HSN code
                hsn_code = (item_data.get('hsnSac') or 
                           item_data.get('hsn_sac') or 
                           item_data.get('hsn_code') or 'NA')
                
                # If HSN code is not provided, try to get from ItemMaster
                if not hsn_code or hsn_code == 'NA':
                    try:
                        item_no = processed_item['item_no']
                        if item_no:
                            item_master = ItemMaster.objects.filter(cimcon_part_no=item_no).first()
                            if item_master and item_master.hsn_code:
                                hsn_code = item_master.hsn_code
                                logger.info(f"Using HSN code from ItemMaster for {item_no}: {hsn_code}")
                    except Exception as e:
                        logger.error(f"Error fetching HSN code from ItemMaster: {str(e)}")
                
                processed_item['hsn_code'] = hsn_code
                processed_items.append(processed_item)
                logger.info(f"Processed item for PDF: {processed_item}")

            vendor_name_safe = po.vendor_name.replace(" ", "_")
            document_name = f"Purchase_Order_{po_number}_{vendor_name_safe}.pdf"
            document_path = os.path.join("media", "purchase_orders", document_name)
            os.makedirs(os.path.dirname(document_path), exist_ok=True)

            # Format date
            try:
                formatted_po_date = datetime.strptime(po_date, '%Y-%m-%d').strftime('%d-%b-%Y')
            except:
                formatted_po_date = po_date

            # Prepare complete PDF data structure
            pdf_data = {
                'po_details': {
                    'poNumber': po.po_number,
                    'poDate': po_date,
                    'quoteRefNumber': po.quote_ref_number,
                    'projectCode': po.project_code,
                    'version': str(po.version)
                },
                'supplier_data': {
                    'name': po.vendor_name,
                    'address': po.vendor_address,
                    'email': po.vendor_email,
                    'contact': po.vendor_contact,
                    'contact_person': po.vendor_contact,
                    'gstin': po.vendor_gstin,
                    'pan': po.vendor_pan,
                    'state': po.vendor_state,
                    'stateCode': po.vendor_state_code,
                    'vendorCode': po.vendor_code
                },
                'invoice_to': {
                    'name': po.invoice_name or 'CIMCON Software India Pvt. Ltd.',
                    'address': po.invoice_address,
                    'gstin': po.invoice_gstin
                },
                'terms': {
                    'payment': po.payment_terms,
                    'warranty': po.warranty_terms,
                    'delivery': po.delivery_schedule,
                    'freightAndInsurance': po.freight_terms,
                    'tpiInspection': po.tpi_terms,
                    'installation': po.installation_terms,
                    'commissioning': po.commissioning
                },
                'delivery_address': delivery_address or f"{po.consignee_name}\n{po.consignee_address}",
                'formatted_po_date': formatted_po_date,
                'items': processed_items,
                'currency': {
                    'symbol': get_currency_symbol(currency.get('code', 'INR')),
                    'code': currency.get('code', 'INR')
                },
                'totals': {
                    'totalAmount': float(totals.get('totalAmount', total_amount)),
                    'taxableValue': float(totals.get('taxableValue', total_amount)),
                    'gst': float(totals.get('gst', 0)),
                    'roundOff': float(totals.get('roundOff', 0))
                },
                'total_in_words': total_in_words,
                'terms_and_conditions': terms_and_conditions
            }

            logger.info("Final PDF data structure prepared for update")
            logger.info(f"Terms and conditions length: {len(terms_and_conditions)}")
            logger.info(f"Number of processed items: {len(processed_items)}")

            # Generate PDF using the reusable generator
            pdf_generator = PurchaseOrderPDFGenerator()
            buffer = pdf_generator.generate_pdf(pdf_data, document_path)
            
            logger.info(f"Successfully regenerated PDF for PO {po_number} at {document_path}")

        except Exception as pdf_error:
            logger.error(f"Error regenerating PDF for PO {po_number}: {str(pdf_error)}")
            import traceback
            logger.error(f"PDF generation traceback: {traceback.format_exc()}")
        
        # Send email after successful update
        try:
            admin = CustomUser.objects.filter(role='Admin').first()
            admin_email = admin.email if admin else None
            admin_first_name = admin.first_name if admin else 'Admin'
            admin_last_name = admin.last_name if admin else ''   

            if admin_email and po.vendor_email:
                send_update_po_email(po_number, document_path, admin_email, admin_first_name, admin_last_name)
                
        except Exception as email_error:
            logger.error(f"Error sending update verification email for PO {po_number}: {str(email_error)}")

        return Response({
            'message': 'Purchase order updated successfully',
            'po_number': po_number,
            'version': str(PurchaseOrder.objects.get(po_number=po_number).version),
            'total_amount': float(PurchaseOrder.objects.get(po_number=po_number).total_amount)
        })

    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase Order not found'}, status=404)
    except POLineItem.DoesNotExist:
        return Response({'error': 'Line item not found'}, status=404)
    except Exception as e:
        logger.error(f"Error updating PO {po_number}: {str(e)}")
        import traceback
        logger.error(f"Update PO traceback: {traceback.format_exc()}")
        return Response({'error': str(e)}, status=500)


# ===== LOCAL HELPER FUNCTIONS (copied from master.views) =====

def update_hsn_codes_in_item_master_local(items):
    """Update HSN codes in ItemMaster"""
    try:
        for item in items:
            item_no = item.get('item_no')
            hsn_sac = item.get('hsnSac') or item.get('hsn_sac')
            
            if not item_no or not hsn_sac:
                logger.warning(f"Skipping HSN update for item {item_no} due to missing data")
                continue
                
            item_master = ItemMaster.objects.filter(cimcon_part_no=item_no).first()
            
            if item_master:
                old_hsn_code = item_master.hsn_code
                item_master.hsn_code = hsn_sac
                item_master.save()
                logger.info(f"Updated HSN code for item {item_no} from {old_hsn_code} to {hsn_sac}")
            else:
                logger.warning(f"ItemMaster record not found for item {item_no}")
    except Exception as e:
        logger.error(f"Error updating HSN codes: {str(e)}")


def process_items_for_pdf_local(items):
    """Process items and add HSN codes from ItemMaster if needed"""
    processed_items = []
    
    for item in items:
        processed_item = item.copy()
        
        # Get HSN code
        hsn_code = item.get('hsnSac') or item.get('hsn_sac', 'NA')
        
        # If HSN code is not provided, try to get from ItemMaster
        if not hsn_code or hsn_code == 'NA':
            try:
                item_no = item.get('item_no', '')
                item_master = ItemMaster.objects.filter(cimcon_part_no=item_no).first()
                if item_master and item_master.hsn_code:
                    hsn_code = item_master.hsn_code
                    logger.info(f"Using HSN code from ItemMaster for {item_no}: {hsn_code}")
            except Exception as e:
                logger.error(f"Error fetching HSN code from ItemMaster: {str(e)}")
        
        processed_item['hsn_code'] = hsn_code
        processed_items.append(processed_item)
    
    return processed_items


def get_currency_symbol_local(currency_code):
    """Get currency symbol for code"""
    currency_symbols = {
        'AED': 'د.إ', 'CNY': '¥', 'JPY': '¥', 'EUR': '€', 'GBP': '£',
        'USD': '$', 'INR': '₹', 'CAD': 'C$', 'AUD': 'A$', 'SGD': 'S$',
        'HKD': 'HK$', 'KRW': '₩', 'RUB': '₽', 'THB': '฿', 'CHF': 'CHF',
        'TRY': '₺', 'SAR': 'ر.س', 'MYR': 'RM', 'IDR': 'Rp', 'PHP': '₱'
    }
    return currency_symbols.get(currency_code, currency_code)


# Helper function for sending update email - similar to send_po_email_if_required
def send_update_po_email_if_required(supplier_data, po_number, document_path, vendor_name, admin_email, admin_first_name, admin_last_name):
    """Send email if vendor email and admin info available"""
    vendor_email = supplier_data.get('email')
    if vendor_email and admin_email:
        try:
            email_sender = SendEmail()
            email_sender.send(
                trigger='update_po_verification',
                vendor_email=vendor_email,
                po_number=po_number,
                document_path=document_path,
                admin_email=admin_email,
                admin_first_name=admin_first_name,
                admin_last_name=admin_last_name,
            )
        except Exception as e:
            logger.error(f"Error sending update email: {str(e)}")

@api_view(['POST'])
def update_approve_po_email(request, po_number):
    """Approve a purchase order from email link and send notification to vendor"""
    try:
        POHistory = apps.get_model('purchase_order', 'POHistory')
        PurchaseOrder = apps.get_model('purchase_order', 'PurchaseOrder')
        po = PurchaseOrder.objects.get(po_number=po_number)

        # Get Purchaser's information
        purchaser = CustomUser.objects.filter(role='Purchaser').first()
        purchaser_email = purchaser.email if purchaser else None
        purchaser_first_name = purchaser.first_name if purchaser else 'Purchaser'
        purchaser_last_name = purchaser.last_name if purchaser else ''
        
        # Check if PO is already processed
        if po.approval_status or po.rejection_status:
            status = "approved" if po.approval_status else "rejected"
            return Response({
                'error': f'This Purchase Order has already been {status}. No further actions can be taken.',
                'status': status
            }, status=400)
        
        # Update approval status
        po.approval_status = True
        po.approval_date = timezone.now()
        po.approved_by = 'system'
        po.save()

        # Create history entry
        POHistory.objects.create(
            purchase_order=po,
            action='approved',
            description=f'PO approved via email link',
            created_by='system'
        )

        # Send email to vendor if vendor email exists
        if po.vendor_email:
            try:
                # Email configuration
                smtp_server = settings.EMAIL_HOST
                port = settings.EMAIL_PORT
                sender_email = settings.EMAIL_HOST_USER
                password = settings.EMAIL_HOST_PASSWORD

                subject = f"Purchase Order - {po_number}"

                # Simplified email body
                html_body = f"""
                <html>
                    <body>
                        <p>Dear {po.vendor_name},</p>
                        
                        <p>Please find attached Purchase Order {po_number}.</p>
                        
                        <p>Best regards</p>
                    </body>
                </html>
                """

                # Create email message
                msg = MIMEMultipart()
                msg['From'] = sender_email
                # msg['To'] = po.vendor_email
                msg['To'] = "purchase.notifications@cimconautomation.com"
                msg['Subject'] = subject

                # Add HTML content
                html_part = MIMEText(html_body, 'html')
                msg.attach(html_part)

                # Get document path from media folder
                document_name = f"Purchase_Order_{po_number}_{po.vendor_name.replace(' ', '_')}.pdf"
                document_path = os.path.join(settings.MEDIA_ROOT, 'purchase_orders', document_name)


                # Attach PO document - Updated attachment code
                if os.path.exists(document_path):
                    with open(document_path, 'rb') as f:
                        # Change from MIMEApplication to MIMEText
                        attachment = MIMEText(f.read(), 'base64', 'utf-8')
                        attachment.add_header('Content-Type', 'application/pdf')
                        attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(document_path))
                        msg.attach(attachment)
                    logger.info(f"PO document attached successfully for {po_number}")
                else:
                    logger.error(f"PO document not found at {document_path}")

                # Send email
                with smtplib.SMTP(smtp_server, port) as server:
                    server.starttls()
                    server.login(sender_email, password)
                    server.sendmail(
                        sender_email, 
                        # po.vendor_email, 
                        "purchase.notifications@cimconautomation.com",
                        msg.as_string()
                    )
                    logger.info(f"Email sent successfully to vendor {po.vendor_name} for PO {po_number}")

                # Create purchaser full name
                purchaser_full_name = f"{purchaser_first_name} {purchaser_last_name}".strip()
                if not purchaser_full_name:
                    purchaser_full_name = "Purchaser"

                # Send notification to Purchaser
                notification_subject = f"PO {po_number} Approved and Sent"
                notification_body = f"""
                <html>
                    <body>
                        <p>Dear {purchaser_full_name},</p>
                        
                        <p>Your updated PO {po_number} is approved and sent to vendor {po.vendor_name}.</p>

                        <p>The approved Purchase Order document is attached for your records.</p>

                        
                        <p>Best regards</p>
                    </body>
                </html>
                """

                notification_msg = MIMEMultipart()
                notification_msg['From'] = sender_email
                notification_msg['To'] = purchaser_email
                notification_msg['Subject'] = notification_subject

                notification_msg.attach(MIMEText(notification_body, 'html'))

                # Attach same PO document
                if os.path.exists(document_path):
                    with open(document_path, 'rb') as f:
                        notification_attachment = MIMEText(f.read(), 'base64', 'utf-8')
                        notification_attachment.add_header('Content-Type', 'application/pdf')
                        notification_attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(document_path))
                        notification_msg.attach(notification_attachment)

                # Send notification email
                with smtplib.SMTP(smtp_server, port) as server:
                    server.starttls()
                    server.login(sender_email, password)
                    server.send_message(notification_msg)
                    logger.info(f"Notification email sent to Saurabh Wani for PO {po_number}")

            except Exception as email_error:
                logger.error(f"Error sending email for PO {po_number}: {str(email_error)}")
                pass

        return Response({
            'message': 'Purchase Order approved successfully',
            'po_number': po_number,
            'email_sent': bool(po.vendor_email)
        })

    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase Order not found'}, status=404)
    except Exception as e:
        logger.error(f"Error in approve_po_email: {str(e)}")
        return Response({'error': str(e)}, status=500)

@api_view(['POST'])
def update_reject_po_email(request, po_number):
    try:
        POHistory = apps.get_model('purchase_order', 'POHistory')
        PurchaseOrder = apps.get_model('purchase_order', 'PurchaseOrder')
        po = PurchaseOrder.objects.get(po_number=po_number)

        # Get Purchaser's information
        purchaser = CustomUser.objects.filter(role='Purchaser').first()
        purchaser_email = purchaser.email if purchaser else None
        purchaser_first_name = purchaser.first_name if purchaser else 'Purchaser'
        purchaser_last_name = purchaser.last_name if purchaser else ''
        
        # Fixed status check - only check if BOTH are true (already processed)
        # If PO was updated after rejection, rejection_status would be False
        if po.approval_status and po.rejection_status:
            return Response({
                'error': f'This Purchase Order has conflicting status. Please contact administrator.',
                'status': 'error'
            }, status=400)
        elif po.approval_status:
            return Response({
                'error': f'This Purchase Order has already been approved. No further actions can be taken.',
                'status': 'approved'
            }, status=400)
        elif po.rejection_status and po.status == 'rejected':
            return Response({
                'error': f'This Purchase Order has already been rejected. No further actions can be taken.',
                'status': 'rejected'
            }, status=400)
        
        rejection_remarks = request.data.get('rejection_remarks', 'No remarks provided')
        
        # Update rejection status
        po.status = 'rejected'
        po.approval_status = False
        po.rejection_status = True
        po.rejected_by = 'system'
        po.rejection_date = timezone.now()
        po.rejection_remarks = rejection_remarks
        po.save()

        # Create history entry
        POHistory.objects.create(
            purchase_order=po,
            action='rejected',
            description=f'PO rejected via email link. Remarks: {rejection_remarks}',
            created_by='system'
        )

        # Send rejection notification email to purchaser
        try:
            smtp_server = settings.EMAIL_HOST
            port = settings.EMAIL_PORT
            sender_email = settings.EMAIL_HOST_USER
            password = settings.EMAIL_HOST_PASSWORD
            
            # Create purchaser full name
            purchaser_full_name = f"{purchaser_first_name} {purchaser_last_name}".strip()
            if not purchaser_full_name:
                purchaser_full_name = "Purchaser"

            subject = f'Updated Purchase Order Rejection Notice'
            
            html_body = f"""
            <html>
                <head>
                    <style>
                        .email-container {{
                            font-family: Arial, sans-serif;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }}
                        .content {{
                            color: #333333;
                            line-height: 1.6;
                            margin-bottom: 25px;
                        }}
                        .rejection-details {{
                            margin: 20px 0;
                            padding: 15px;
                            background-color: #f8f9fa;
                            border-left: 4px solid #dc3545;
                            border-radius: 4px;
                        }}
                        .footer {{
                            margin-top: 25px;
                            padding-top: 15px;
                            border-top: 1px solid #eee;
                            color: #666;
                            font-size: 14px;
                        }}
                        .po-number {{
                            font-weight: bold;
                            color: #444;
                        }}
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        <div class="content">
                            <h2>Updated Purchase Order Rejection Notice</h2>
                            
                            <p>Dear {purchaser_full_name},</p>
                            
                            <p>We wish to inform you that your updated Purchase Order <span class="po-number">{po_number}</span> has been rejected.</p>
                            
                            <div class="rejection-details">
                                <p><strong>Rejection Remarks:</strong></p>
                                <p>{rejection_remarks}</p>
                            </div>
                            
                            <p>Please review the rejection remarks and make necessary modifications before resubmitting the Purchase Order. If you have any questions regarding this rejection, please contact the purchasing department.</p>
                        </div>

                        <div class="footer">
                            <p>Best regards</p>
                        </div>
                    </div>
                </body>
            </html>
            """

            msg = MIMEMultipart()
            msg['From'] = sender_email
            msg['To'] = purchaser_email
            msg['Subject'] = subject

            msg.attach(MIMEText(html_body, 'html'))

            with smtplib.SMTP(smtp_server, port) as server:
                server.starttls()
                server.login(sender_email, password)
                server.send_message(msg)
                logger.info(f"Updated PO rejection notification email sent successfully to {purchaser_full_name} for PO {po_number}")

        except Exception as email_error:
            logger.error(f"Error sending rejection notification email for updated PO {po_number}: {str(email_error)}")
            # Continue with the response even if email fails

        return Response({
            'message': 'Purchase Order rejected successfully',
            'po_number': po_number,
            'rejection_remarks': rejection_remarks,
            'email_sent': bool(purchaser_email)
        })

    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase Order not found'}, status=404)
    except Exception as e:
        logger.error(f"Error in update_reject_po_email: {str(e)}")
        return Response({'error': str(e)}, status=500)

def update_approval_page_open(request, po_number):
    try:
        # Make API call to approve-po-email endpoint
        base_url = settings.BASE_API_URL
        api_url = f"{base_url}/api/update-approve-po-email/{po_number}/"
        
        response = requests.post(api_url, json={"po_number": po_number})
        
        # Prepare HTML response based on API response
        success = response.status_code == 200
        message = "PO Approved Successfully!" if success else "Failed to approve PO"
        message_color = "#28a745" if success else "#dc3545"  # Green for success, Red for error
        
        html_content = f'''
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Purchase Order Approval</title>
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
                }}
                h2 {{
                    color: #333;
                }}
                .message {{
                    color: {message_color};
                    font-size: 18px;
                    margin-top: 20px;
                }}
                .po-number {{
                    font-size: 16px;
                    color: #666;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Purchase Order Approval</h2>
                <p class="message">{"✓" if success else "✗"} {message}</p>
                <p class="po-number">Purchase Order: {po_number}</p>
            </div>
        </body>
        </html>
        '''
        return HttpResponse(html_content)
        
    except Exception as e:
        # Return error page if something goes wrong
        error_html = f'''
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error</title>
            <style>
                /* Same styles as above */
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Error</h2>
                <p class="message" style="color: #dc3545;">✗ Failed to process approval</p>
                <p class="po-number">Purchase Order: {po_number}</p>
                <p style="color: #666;">Error: {str(e)}</p>
            </div>
        </body>
        </html>
        '''
        return HttpResponse(error_html)

def update_reject_page_open(request, po_number):
    try:
        if request.method == 'POST':
            # Handle form submission
            remarks = request.POST.get('rejection_remarks', '')
            
            # Make API call to reject-po-email endpoint
            base_url = settings.BASE_API_URL
            api_url = f"{base_url}/api/update-reject-po-email/{po_number}/"
            
            response = requests.post(api_url, json={
                "po_number": po_number,
                "rejection_remarks": remarks
            })
            
            # Prepare response page
            success = response.status_code == 200
            message = "PO Rejected Successfully!" if success else "Failed to reject PO"
            message_color = "#dc3545"
            
            return HttpResponse(f'''
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Purchase Order Rejection</title>
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
                            max-width: 500px;
                            width: 90%;
                        }}
                        h2 {{
                            color: #333;
                        }}
                        .message {{
                            color: {message_color};
                            font-size: 18px;
                            margin-top: 20px;
                        }}
                        .po-number {{
                            font-size: 16px;
                            color: #666;
                            margin-top: 10px;
                        }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Purchase Order Rejection</h2>
                        <p class="message">{"✓" if success else "✗"} {message}</p>
                        <p class="po-number">Purchase Order: {po_number}</p>
                        <p>Remarks: {remarks}</p>
                    </div>
                </body>
                </html>
            ''')
        else:
            # Generate CSRF token
            csrf_token = get_token(request)
            
            # Display rejection form with CSRF token
            return HttpResponse(f'''
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Reject Purchase Order</title>
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
                            max-width: 500px;
                            width: 90%;
                        }}
                        h2 {{
                            color: #333;
                        }}
                        .form-group {{
                            margin: 20px 0;
                            text-align: left;
                        }}
                        label {{
                            display: block;
                            margin-bottom: 8px;
                            color: #555;
                        }}
                        textarea {{
                            width: 100%;
                            padding: 10px;
                            border: 1px solid #ddd;
                            border-radius: 4px;
                            min-height: 100px;
                            margin-bottom: 20px;
                        }}
                        .submit-btn {{
                            background-color: #dc3545;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 16px;
                        }}
                        .submit-btn:hover {{
                            background-color: #c82333;
                        }}
                        .po-number {{
                            font-size: 16px;
                            color: #666;
                            margin-top: 10px;
                        }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Reject Purchase Order</h2>
                        <p class="po-number">Purchase Order: {po_number}</p>
                        <form method="POST">
                            <input type="hidden" name="csrfmiddlewaretoken" value="{csrf_token}">
                            <div class="form-group">
                                <label for="rejection_remarks">Please provide reason for rejection:</label>
                                <textarea 
                                    id="rejection_remarks" 
                                    name="rejection_remarks" 
                                    required 
                                    placeholder="Enter your rejection remarks here..."></textarea>
                            </div>
                            <button type="submit" class="submit-btn">Confirm Rejection</button>
                        </form>
                    </div>
                </body>
                </html>
            ''')
            
    except Exception as e:
        # Return error page if something goes wrong
        return HttpResponse(f'''
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Error</title>
                <style>
                    /* Same styles as above */
                </style>
            </head>
            <body>
                <div class="container">
                    <h2>Error</h2>
                    <p class="message" style="color: #dc3545;">✗ Failed to process rejection</p>
                    <p class="po-number">Purchase Order: {po_number}</p>
                    <p style="color: #666;">Error: {str(e)}</p>
                </div>
            </body>
            </html>
        ''')

@api_view(['POST'])
def generate_po_html(request):
    """Generate PO HTML using the po_print.html template"""
    if request.method == 'POST':
        try:
            # Parse JSON data
            data = json.loads(request.body)
            
            # Read the template file
            template_path = os.path.join(settings.BASE_DIR, 'frontend', 'src', 'PO_Print', 'po_print.html')
            with open(template_path, 'r') as file:
                html_content = file.read()
            
            # Format date
            po_date = datetime.strptime(data['poDetails']['poDate'], '%Y-%m-%d').strftime('%d %B %Y')
            
            # Replace placeholders with actual values
            replacements = {
                'CIMPO-2526/00001': data['poDetails']['poNumber'],
                '02 April 2025': po_date,
                'Intelux Electronics Pvt. Ltd.': data['poDetails']['supplier']['name'],
                'Unit 2, Electronic Co-Op Estate,<br>Pune - Satara Rd, Pune – 411009': data['poDetails']['supplier']['address'],
                'Neeraj Sukhija (+91-20-24223734)': data['poDetails']['supplier']['contact_person'],
                'neeraj.s@inteluxindia.com': data['poDetails']['supplier']['email'],
                '26AABCC1410E2ZY': data['poDetails']['supplier']['gstin'],
                'AABCC1410E': data['poDetails']['supplier']['pan'],
                'Maharashtra': data['poDetails']['supplier']['state'],
                '24': data['poDetails']['supplier']['stateCode'],
                'By email. Dt.-': data['poDetails']['quoteRefNumber'],
                '8104-F': data['poDetails']['projectCode'],
                'Net 60': data['poDetails']['terms']['payment'],
                'As mentioned in the Terms': data['poDetails']['terms']['warranty'],
                'Within 4 weeks': data.get('deliverySchedule', 'Within 4 weeks'),
            }
            
            # Apply replacements
            for old_text, new_text in replacements.items():
                if old_text and new_text:  # Avoid None values
                    html_content = html_content.replace(old_text, str(new_text))
            
            # Replace table items with actual line items
            items_html = ""
            for index, item in enumerate(data['items']):
                items_html += f"""
                <tr>
                  <td align="center">{index + 1}</td>
                  <td>{item['cpn']}</td>
                  <td>{item['description']}</td>
                  <td>{item['hsnSac']}</td>
                  <td align="center">{item['quantity']} {item['uom']}</td>
                  <td align="center">{data['currency']['symbol']} {item['unitRate']}</td>
                  <td align="center">{data['currency']['symbol']} {item['taxableValue']}</td>
                  <td align="center">{data['currency']['symbol']} {item['gst']}</td>
                  <td align="center">{data['currency']['symbol']} {item['totalAmount']}</td>
                </tr>
                """
            
            # Replace the sample items in the HTML
            item_pattern = r'<tr>\s*<td align="center">1<\/td>.*?<\/tr>\s*<tr>\s*<td align="center">2<\/td>.*?<\/tr>'
            html_content = re.sub(item_pattern, items_html, html_content, flags=re.DOTALL)
            
            # Calculate totals
            totals = {
                'quantity': sum(item['quantity'] for item in data['items']),
                'taxableValue': sum(item['taxableValue'] for item in data['items']),
                'gst': sum(item['gst'] for item in data['items']),
                'totalAmount': sum(item['totalAmount'] for item in data['items']),
            }
            
            # Replace totals row
            total_pattern = r'<tr style="font-weight: bold;">\s*<td colspan="4" align="center">Total \(INR\)<\/td>.*?<\/tr>'
            total_replacement = f"""
            <tr style="font-weight: bold;">
              <td colspan="4" align="center">Total ({data['currency']['code']})</td>
              <td align="center">{totals['quantity']} {data['items'][0]['uom'] if data['items'] else 'Nos'}</td>
              <td></td>
              <td align="center">{data['currency']['symbol']} {totals['taxableValue']:.2f}</td>
              <td align="center">{data['currency']['symbol']} {totals['gst']:.2f}</td>
              <td align="center">{data['currency']['symbol']} {totals['totalAmount']:.2f}</td>
            </tr>
            """
            html_content = re.sub(total_pattern, total_replacement, html_content, flags=re.DOTALL)
            
            # Generate file name with timestamp
            timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
            file_name = f"{data['poDetails']['poNumber']}_{timestamp}.html"
            file_path = os.path.join(settings.MEDIA_ROOT, 'po_html', file_name)
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            
            # Write the file
            with open(file_path, 'w') as file:
                file.write(html_content)
            
            # Return file URL
            file_url = f"{settings.MEDIA_URL}po_html/{file_name}"
            return JsonResponse({"status": "success", "file_url": file_url})
        
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)})
    
    return JsonResponse({"status": "error", "message": "Invalid request method"})

def calculate_totals(items):
    """Calculate the totals for the PO"""
    total_quantity = sum(item.get('quantity', 0) for item in items)
    total_taxable_value = sum(item.get('taxableValue', 0) for item in items)
    total_gst = sum(item.get('gst', 0) for item in items)
    
    # Sum of taxable value and GST
    total_amount = total_taxable_value + total_gst
    
    # Calculate round off
    rounded_total = round(total_amount)
    round_off = rounded_total - total_amount
    
    return {
        'total_quantity': total_quantity,
        'total_taxable_value': total_taxable_value,
        'total_gst': total_gst,
        'total_amount': total_amount,
        'round_off': round_off,
        'final_amount': rounded_total
    }

class SendEmail:
    def __init__(self):
        self.smtp_server = settings.EMAIL_HOST
        self.port = settings.EMAIL_PORT
        self.sender_email = settings.EMAIL_HOST_USER
        self.password = settings.EMAIL_HOST_PASSWORD

    def send(self, trigger, **kwargs):       
        if trigger == 'update_po_verification':
            vendor_email = kwargs.get('vendor_email')
            po_number = kwargs.get('po_number')
            document_path = kwargs.get('document_path')
            admin_email = kwargs.get('admin_email')
            admin_first_name = kwargs.get('admin_first_name', 'Admin')
            admin_last_name = kwargs.get('admin_last_name', '')

            # Create admin full name
            admin_full_name = f"{admin_first_name} {admin_last_name}".strip()
            if not admin_full_name:
                admin_full_name = "Admin"
            
            if not vendor_email:
                print("No vendor email provided")
                return False
                
            subject = f'Updated PURCHASE ORDER/ {po_number} /'
            
            base_url = settings.BASE_API_URL
            approval_link = f"{base_url}/update-approval-page-open/{po_number}/"
            rejection_link = f"{base_url}/update-reject-page-open/{po_number}/"
            
            body = f"""
            <html>
                <head>
                    <style>
                        .email-container {{
                            font-family: Arial, sans-serif;
                            max-width: 600px;
                            margin: 0 auto;
                            padding: 20px;
                        }}
                        .content {{
                            color: #333333;
                            line-height: 1.6;
                            margin-bottom: 25px;
                        }}
                        .po-details {{
                            margin-bottom: 20px;
                            padding: 15px;
                            background-color: #f8f9fa;
                            border-radius: 4px;
                        }}
                        .button-container {{
                            text-align: center;
                            margin: 25px 0;
                        }}
                        .button {{
                            display: inline-block;
                            padding: 10px 25px;
                            color: white;
                            text-decoration: none;
                            border-radius: 4px;
                            font-size: 14px;
                            margin: 0 8px;
                        }}
                        .approve {{
                            background-color: #28a745;
                        }}
                        .reject {{
                            background-color: #dc3545;
                        }}
                        .footer {{
                            margin-top: 25px;
                            padding-top: 15px;
                            border-top: 1px solid #eee;
                            color: #666;
                            font-size: 14px;
                        }}
                    </style>
                </head>
                <body>
                    <div class="email-container">
                        <div class="content">
                            <p>Dear {admin_full_name},</p>
                            
                            <div class="po-details">
                                <strong>Purchase Order:</strong> {po_number}<br>
                                <p>The Purchase Order has been updated as per previous remarks and resubmitted for your approval.</p>
                            </div>

                            <p>Please find attached updated Purchase Order for your review. Kindly approve or reject at your earliest convenience.</p>
                        </div>

                        <div class="button-container">
                            <a href="{approval_link}" class="button approve">Approve</a>
                            <a href="{rejection_link}" class="button reject">Reject</a>
                        </div>

                        <div class="footer">
                            <p>Regards</p>
                        </div>
                    </div>
                </body>
            </html>
            """

            # Verify document exists
            if not os.path.exists(document_path):
                logger.error(f"PO document not found at {document_path}")
                return False
                
            try:
                msg = MIMEMultipart()
                msg['From'] = self.sender_email
                msg['To'] = admin_email
                msg['Subject'] = subject
                msg.attach(MIMEText(body, 'html'))

                # Attach the PO document
                with open(document_path, 'rb') as f:
                    attachment = MIMEText(f.read(), 'base64', 'utf-8')
                    attachment.add_header('Content-Type', 'application/pdf')
                    attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(document_path))
                    msg.attach(attachment)

                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls()
                    server.login(self.sender_email, self.password)
                    server.send_message(msg)
                    
                print(f"Updated PO email sent successfully to Admin - {admin_full_name}, email - {admin_email}")
                return True
            except Exception as e:
                print(f"Failed to send updated PO email: {str(e)}")
                return False

def send_update_po_email(po_number, document_path, admin_email, admin_first_name, admin_last_name):
    """Send update PO verification email"""
    try:
        # Create admin full name
        admin_full_name = f"{admin_first_name} {admin_last_name}".strip()
        if not admin_full_name:
            admin_full_name = "Admin"
        
        # Email configuration
        smtp_server = settings.EMAIL_HOST
        port = settings.EMAIL_PORT
        sender_email = settings.EMAIL_HOST_USER
        password = settings.EMAIL_HOST_PASSWORD
        
        subject = f'Updated PURCHASE ORDER/ {po_number} /'
        
        base_url = settings.BASE_API_URL
        approval_link = f"{base_url}/update-approval-page-open/{po_number}/"
        rejection_link = f"{base_url}/update-reject-page-open/{po_number}/"
        
        body = f"""
        <html>
            <head>
                <style>
                    .email-container {{
                        font-family: Arial, sans-serif;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                    }}
                    .content {{
                        color: #333333;
                        line-height: 1.6;
                        margin-bottom: 25px;
                    }}
                    .po-details {{
                        margin-bottom: 20px;
                        padding: 15px;
                        background-color: #f8f9fa;
                        border-radius: 4px;
                    }}
                    .button-container {{
                        text-align: center;
                        margin: 25px 0;
                    }}
                    .button {{
                        display: inline-block;
                        padding: 10px 25px;
                        color: white;
                        text-decoration: none;
                        border-radius: 4px;
                        font-size: 14px;
                        margin: 0 8px;
                    }}
                    .approve {{
                        background-color: #28a745;
                    }}
                    .reject {{
                        background-color: #dc3545;
                    }}
                    .footer {{
                        margin-top: 25px;
                        padding-top: 15px;
                        border-top: 1px solid #eee;
                        color: #666;
                        font-size: 14px;
                    }}
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="content">
                        <p>Dear {admin_full_name},</p>
                        
                        <div class="po-details">
                            <strong>Purchase Order:</strong> {po_number}<br>
                            <p>The Purchase Order has been updated as per previous remarks and resubmitted for your approval.</p>
                        </div>

                        <p>Please find attached updated Purchase Order for your review. Kindly approve or reject at your earliest convenience.</p>
                    </div>

                    <div class="button-container">
                        <a href="{approval_link}" class="button approve">Approve</a>
                        <a href="{rejection_link}" class="button reject">Reject</a>
                    </div>

                    <div class="footer">
                        <p>Regards</p>
                    </div>
                </div>
            </body>
        </html>
        """

        # Verify document exists
        if not os.path.exists(document_path):
            logger.error(f"PO document not found at {document_path}")
            return False
            
        msg = MIMEMultipart()
        msg['From'] = sender_email
        msg['To'] = admin_email
        msg['Subject'] = subject
        msg.attach(MIMEText(body, 'html'))

        # Attach the PO document
        with open(document_path, 'rb') as f:
            attachment = MIMEText(f.read(), 'base64', 'utf-8')
            attachment.add_header('Content-Type', 'application/pdf')
            attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(document_path))
            msg.attach(attachment)

        with smtplib.SMTP(smtp_server, port) as server:
            server.starttls()
            server.login(sender_email, password)
            server.send_message(msg)
            
        logger.info(f"Updated PO email sent successfully to Admin - {admin_full_name}, email - {admin_email}")
        return True
        
    except Exception as e:
        logger.error(f"Failed to send updated PO email: {str(e)}")
        return False





