from datetime import datetime
from reportlab.lib.utils import ImageReader
from rest_framework.viewsets import ModelViewSet
from indent.models import Requisition
from django.apps import apps
from .models import Master
from .serializers import MasterSerializer
from django.http import HttpResponse
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import inch, mm
from reportlab.platypus import Table, TableStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from io import BytesIO
import json
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import Paragraph
from reportlab.lib.enums import TA_JUSTIFY
import os
from django.conf import settings
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from django.http import HttpResponse
from rest_framework.decorators import api_view
from docx import Document
from docx.shared import Inches, Pt, Mm
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
import os
import json
from docx.shared import RGBColor
from django.utils import timezone
from items.models import ItemMaster
from django.http import HttpResponse
from rest_framework.decorators import api_view
from docx import Document
from docx.shared import Inches, Pt
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from django.http import HttpResponse
from rest_framework.decorators import api_view
from docx import Document
from docx.shared import Pt, Inches, Mm
from docx.shared import Pt, Inches, Mm
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
import logging
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.application import MIMEApplication
from .pdf_generator import PurchaseOrderPDFGenerator
from docx.shared import Inches, Pt
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from django.http import HttpResponse
from rest_framework.decorators import api_view
from docx import Document
import requests
from django.middleware.csrf import get_token
from django.views.decorators.csrf import csrf_exempt
from django.core.files.storage import default_storage
from django.conf import settings
from users.models import CustomUser

from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.table import WD_ALIGN_VERTICAL
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from rest_framework.decorators import api_view
from django.http import HttpResponse
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Table, TableStyle, Spacer, Image, PageBreak, Frame, PageTemplate
)
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import inch
from io import BytesIO
import os
from datetime import datetime
from reportlab.platypus import BaseDocTemplate

def add_horizontal_line(paragraph):
    p = paragraph._p  # access to the XML element
    pPr = p.get_or_add_pPr()
    border = OxmlElement('w:pBdr')
    bottom = OxmlElement('w:bottom')
    bottom.set(qn('w:val'), 'single')  # solid line
    bottom.set(qn('w:sz'), '6')        # thickness
    bottom.set(qn('w:space'), '1')
    bottom.set(qn('w:color'), '000000')  # black
    border.append(bottom)
    pPr.append(border)

@api_view(['GET'])
def fetch_terms_from_file(request):
    file_path = os.path.join(settings.BASE_DIR, 'master', 't&c.txt')
    try:
        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()
        return HttpResponse(content, content_type='text/plain')
    except FileNotFoundError:
        return HttpResponse("Terms and Conditions file not found.", status=404)
    except UnicodeDecodeError:
        return HttpResponse("Could not decode the file. Try saving it as UTF-8.", status=500)


class MasterViewSet(ModelViewSet):
    """
    CRUD API for the Master model.
    """
    queryset = Master.objects.all()
    serializer_class = MasterSerializer
    
    def get_queryset(self):
        """
        Override the default queryset to include HSN code from the ItemMaster model 
        for each Master record based on their cimcon_part_number.
        """
        queryset = super().get_queryset()
        
        # Process request parameters if provided
        approved_status = self.request.query_params.get('approved_status')
        if approved_status == 'true':
            queryset = queryset.filter(ordering_status__in=['In Progress', 'Ordered'])
        
        # Create a list to hold our annotated queryset results
        result = []
        
        # Get all CIMCON part numbers from the queryset
        part_numbers = [m.cimcon_part_number for m in queryset if m.cimcon_part_number]
        
        # Fetch all relevant ItemMaster records in a single query
        item_masters = ItemMaster.objects.filter(cimcon_part_no__in=part_numbers).values('cimcon_part_no', 'hsn_code')
        
        # Create a lookup dictionary for quick access
        hsn_lookup = {item['cimcon_part_no']: item['hsn_code'] or "" for item in item_masters}
        
        # Process each master record
        for master in queryset:
            # Get the HSN code if available
            if master.cimcon_part_number and master.cimcon_part_number in hsn_lookup:
                master._hsn_code = hsn_lookup[master.cimcon_part_number]
            else:
                master._hsn_code = ""
            
            # Add to results
            result.append(master)
        
        return result

# Define the directory where PO documents will be stored
PO_STORAGE_PATH = os.path.join("media", "po_documents")
if not os.path.exists(PO_STORAGE_PATH):
    os.makedirs(PO_STORAGE_PATH)

from django.http import HttpResponse
import os
import json
import logging
from datetime import datetime
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image, PageBreak
from reportlab.pdfgen import canvas
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from django.views.decorators.csrf import csrf_exempt
from rest_framework.decorators import api_view
import io

logger = logging.getLogger(__name__)
    
@api_view(['POST'])
def update_hsn_code(request):
    try:
        data = request.data
        items = data.get('items', [])
        
        updated_items = []
        for item in items:
            # Handle both naming conventions
            item_no = item.get('item_no')
            hsn_sac = item.get('hsnSac') or item.get('hsn_sac')  # Try both keys
            
            if not item_no or not hsn_sac:
                logger.warning(f"Skipping item {item_no} due to missing HSN code")
                continue
                
            try:
                # Try to get the ItemMaster record by cimcon_part_no
                item_master = ItemMaster.objects.filter(cimcon_part_no=item_no).first()
                
                if item_master:
                    # Check if the HSN code is different from the existing one
                    if item_master.hsn_code != hsn_sac:
                        # Save the old value for reference
                        old_hsn_code = item_master.hsn_code
                        
                        # Update the hsn_code regardless of whether it was empty or not
                        item_master.hsn_code = hsn_sac
                        item_master.save()
                        
                        logger.info(f"Updated HSN code for item {item_no} from {old_hsn_code} to {hsn_sac}")
                        
                        updated_items.append({
                            'item_no': item_no,
                            'old_hsn_code': old_hsn_code,
                            'new_hsn_code': hsn_sac,
                            'status': 'updated'
                        })
                    else:
                        logger.info(f"No change needed for item {item_no}, HSN code already {hsn_sac}")
                        updated_items.append({
                            'item_no': item_no,
                            'hsn_code': hsn_sac,
                            'status': 'unchanged'
                        })
            except Exception as e:
                logger.error(f"Error updating HSN code for item {item_no}: {str(e)}")
                updated_items.append({
                    'item_no': item_no,
                    'status': 'error',
                    'message': str(e)
                })
        
        return Response({
            'message': f'HSN code update completed for {len(updated_items)} items',
            'updated_items': updated_items
        }, status=status.HTTP_200_OK)
        
    except Exception as e:
        logger.error(f"Error in update_hsn_code: {str(e)}")
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
 

    
@api_view(['POST'])
def generate_po(request):
    """
    Core function to handle PO generation request and business logic
    """
    try:
        data = request.data
        logger.info("Received data: %s", data)

        # Extract data from request with better error handling
        po_details = data.get('poDetails', {})
        supplier_data = po_details.get('supplier', {})
        invoice_to = po_details.get('invoiceTo', {})
        items = data.get('items', [])
        totals = data.get('totals', {})
        delivery_address = data.get('deliveryAddress', '')
        currency = data.get('currency', {'symbol': '₹', 'code': 'INR'})
        total_in_words = data.get('totalInWords', 'N/A')
        terms_and_conditions = data.get('terms_and_conditions', '')
        terms = po_details.get('terms', {})
        
        # Log the original items data
        logger.info("Original items data:")
        for i, item in enumerate(items):
            logger.info(f"Item {i}: {item}")
        
        # Update HSN codes in ItemMaster
        update_hsn_codes_in_item_master(items)
        
        # Process items with enhanced mapping
        processed_items = []
        for item in items:
            logger.info(f"Processing item: {item}")
            
            # Extract basic item information
            item_no = item.get('item_no') or item.get('cpn') or item.get('cimcon_part_no') or ''
            quantity = float(item.get('quantity', 0))
            unit_price = float(item.get('unit_price') or item.get('unitRate', 0))
            
            # Calculate taxable value (base amount before GST)
            taxable_value = quantity * unit_price
            
            # Extract GST percentage - try multiple field names
            gst_percentage = float(
                item.get('gst_percentage') or 
                item.get('gstPercentage') or 
                item.get('gst_rate') or 
                item.get('gstRate') or 
                item.get('tax_rate') or 
                item.get('taxRate') or 
                18.0  # Default GST rate if not found
            )
            
            # Calculate GST value
            gst_value = (taxable_value * gst_percentage) / 100
            
            # Calculate total price including GST
            total_price = taxable_value + gst_value
            
            # If total_price is provided in the item, use it and recalculate GST
            if item.get('total_price') or item.get('totalAmount'):
                provided_total = float(item.get('total_price') or item.get('totalAmount', 0))
                if provided_total > 0:
                    total_price = provided_total
                    # Recalculate taxable value and GST from total
                    taxable_value = total_price / (1 + (gst_percentage / 100))
                    gst_value = total_price - taxable_value
            
            # Map all possible field names to ensure data is captured
            processed_item = {
                'item_no': item_no,
                'material_description': item.get('material_description') or item.get('description') or '',
                'make': item.get('make', ''),
                'material_group': item.get('material_group', ''),
                'quantity': quantity,
                'unit': item.get('unit') or item.get('uom') or 'Nos',
                'unit_price': unit_price,
                'taxable_value': round(taxable_value, 2),
                'gst_percentage': gst_percentage,
                'gst_value': round(gst_value, 2),
                'total_price': round(total_price, 2)
            }
            
            # Handle HSN code with multiple possible field names
            hsn_code = (item.get('hsnSac') or 
                       item.get('hsn_sac') or 
                       item.get('hsn_code') or 
                       item.get('HSN') or 'NA')
            
            # If HSN code is still not found, try to get from ItemMaster
            if not hsn_code or hsn_code == 'NA':
                try:
                    if item_no:
                        item_master = ItemMaster.objects.filter(cimcon_part_no=item_no).first()
                        if item_master and item_master.hsn_code:
                            hsn_code = item_master.hsn_code
                            logger.info(f"Using HSN code from ItemMaster for {item_no}: {hsn_code}")
                except Exception as e:
                    logger.error(f"Error fetching HSN code from ItemMaster: {str(e)}")
            
            processed_item['hsn_code'] = hsn_code
            processed_items.append(processed_item)
            
            logger.info(f"Processed item with GST calculation:")
            logger.info(f"  - Item: {item_no}")
            logger.info(f"  - Quantity: {quantity}")
            logger.info(f"  - Unit Price: {unit_price}")
            logger.info(f"  - Taxable Value: {taxable_value}")
            logger.info(f"  - GST %: {gst_percentage}")
            logger.info(f"  - GST Value: {gst_value}")
            logger.info(f"  - Total Price: {total_price}")

        # Prepare data for PDF generation
        po_date = po_details.get('poDate', datetime.now().strftime('%d-%b-%Y'))
        try:
            if '-' in po_date and len(po_date.split('-')) == 3:
                formatted_po_date = datetime.strptime(po_date, '%Y-%m-%d').strftime('%d-%b-%Y')
            else:
                formatted_po_date = po_date
        except:
            formatted_po_date = po_date

        vendor_name = supplier_data.get('name', 'Unknown_Vendor')
        po_number = po_details.get('poNumber', 'N/A')
        vendor_name_safe = vendor_name.replace(" ", "_")

        # Create file paths
        document_name = f"Purchase_Order_{po_number}_{vendor_name_safe}.pdf"
        document_path = os.path.join("media", "purchase_orders", document_name)
        os.makedirs(os.path.dirname(document_path), exist_ok=True)

        # Load terms and conditions from file if not provided
        if not terms_and_conditions or terms_and_conditions.strip() == '':
            try:
                tc_path = os.path.join(os.path.dirname(__file__), "t&c.txt")
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

        # Prepare PDF data structure with complete mapping
        pdf_data = {
            'po_details': {
                'poNumber': po_number,
                'poDate': po_date,
                'quoteRefNumber': po_details.get('quoteRefNumber', ''),
                'projectCode': po_details.get('projectCode', ''),
                'version': po_details.get('version', '1.0')
            },
            'supplier_data': {
                'name': supplier_data.get('name', ''),
                'address': supplier_data.get('address', ''),
                'email': supplier_data.get('email', ''),
                'contact': supplier_data.get('contact', ''),
                'contact_person': supplier_data.get('contact_person', ''),
                'gstin': supplier_data.get('gstin', ''),
                'pan': supplier_data.get('pan', ''),
                'state': supplier_data.get('state', ''),
                'stateCode': supplier_data.get('stateCode', ''),
                'vendorCode': supplier_data.get('vendorCode', '')
            },
            'invoice_to': {
                'name': invoice_to.get('name', 'CIMCON Software India Pvt. Ltd.'),
                'address': invoice_to.get('address', ''),
                'gstin': invoice_to.get('gstin', '')
            },
            'terms': {
                'payment': terms.get('payment', ''),
                'warranty': terms.get('warranty', ''),
                'delivery': terms.get('delivery', ''),
                'freightAndInsurance': terms.get('freightAndInsurance', ''),
                'tpiInspection': terms.get('tpiInspection', ''),
                'installation': terms.get('installation', ''),
                'commissioning': terms.get('commissioning', '')
            },
            'delivery_address': delivery_address,
            'formatted_po_date': formatted_po_date,
            'items': processed_items,
            'currency': {
                'symbol': get_currency_symbol(currency.get('code', 'INR')),
                'code': currency.get('code', 'INR')
            },
            'totals': {
                'totalAmount': float(totals.get('totalAmount', 0)),
                'taxableValue': float(totals.get('taxableValue', 0)),
                'gst': float(totals.get('gst', 0)),
                'roundOff': float(totals.get('roundOff', 0))
            },
            'total_in_words': total_in_words,
            'terms_and_conditions': terms_and_conditions
        }

        logger.info("Final PDF data structure prepared")
        logger.info(f"Terms and conditions length: {len(terms_and_conditions)}")
        logger.info(f"Number of processed items: {len(processed_items)}")

        # Generate PDF using the reusable generator
        pdf_generator = PurchaseOrderPDFGenerator()
        buffer = pdf_generator.generate_pdf(pdf_data, document_path)
        
        # Create HTTP response
        response = HttpResponse(content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="{document_name}"'
        response.write(buffer.getvalue())
        
        # Send email if needed
        send_po_email_if_required(supplier_data, po_number, document_path, vendor_name)

        return response

    except Exception as e:
        logger.error("Error generating PO: %s", str(e), exc_info=True)
        return HttpResponse(json.dumps({'error': str(e)}), content_type='application/json', status=500)


# Helper functions for business logic
def update_hsn_codes_in_item_master(items):
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


def process_items_for_pdf(items):
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


def get_currency_symbol(currency_code):
    """Get currency symbol for code"""
    currency_symbols = {
        'AED': 'د.إ', 'CNY': '¥', 'JPY': '¥', 'EUR': '€', 'GBP': '£',
        'USD': '$', 'INR': '₹', 'CAD': 'C$', 'AUD': 'A$', 'SGD': 'S$',
        'HKD': 'HK$', 'KRW': '₩', 'RUB': '₽', 'THB': '฿', 'CHF': 'CHF',
        'TRY': '₺', 'SAR': 'ر.س', 'MYR': 'RM', 'IDR': 'Rp', 'PHP': '₱'
    }
    return currency_symbols.get(currency_code, currency_code)


def send_po_email_if_required(supplier_data, po_number, document_path, vendor_name):
    """Send email if vendor email and admin info available"""
    vendor_email = supplier_data.get('email')
    if vendor_email:
        try:
            admin = CustomUser.objects.filter(role='Admin').first()
            admin_email = admin.email if admin else None
            admin_first_name = admin.first_name if admin else 'Admin'
            admin_last_name = admin.last_name if admin else ''

            if admin_email:
                email_sender = SendEmail()
                email_sender.send(
                    trigger='po_verification',
                    vendor_email=vendor_email,
                    po_number=po_number,
                    document_path=document_path,
                    vendor_name=vendor_name,
                    admin_email=admin_email,
                    admin_first_name=admin_first_name,
                    admin_last_name=admin_last_name,
                )
        except Exception as e:
            logger.error(f"Error sending email: {str(e)}")





@api_view(['POST'])
def update_master_status(request):
    try:
        master_ids = request.data.get('master_ids', [])
        new_status = request.data.get('new_status')
        po_number = request.data.get('po_number')

        # Update all Master records with the given IDs
        Master.objects.filter(id__in=master_ids).update(
            ordering_status=new_status,
            # po_number=po_number
        )

        return Response({'message': 'Status updated successfully'}, status=status.HTTP_200_OK)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

@api_view(['POST'])
def verify_and_create_master(request):
    try:
        data = request.data
        batch_id = data.get('batch_id')
        items = data.get('items', [])
        
        print("=== Starting Verification Process ===")
        print(f"Batch ID: {batch_id}")
        print(f"Number of items received: {len(items)}")
        
        master_entries = []
        verification_date = timezone.now()
        
        for item in items:
            try:
                print("\n--- Processing Item ---")
                print("Item data being processed:", item)
                
                # Check if Master entry already exists for this requisition
                if Master.objects.filter(requisition_id=item.get('id')).exists():
                    print(f"Master entry already exists for requisition ID: {item.get('id')}")
                    continue
                
                # Get the requisition object to ensure we have all required fields
                requisition = Requisition.objects.get(id=item.get('id'))
                
                # Validate required fields
                required_fields = [
                    'project_code', 'project_name', 'cimcon_part_number',
                    'material_description', 'make', 'material_group', 'required_quantity', 'unit',
                    'ordering_qty', 'indent_number', 'order_type'
                ]
                
                missing_fields = [field for field in required_fields if field not in item or item.get(field) is None]
                if missing_fields:
                    print(f"Skipping item due to missing required fields: {missing_fields}")
                    logger.error(f"Skipping item {item.get('id')} due to missing fields: {missing_fields}")
                    continue
                
                # Convert numeric fields
                try:
                    ordering_qty = float(item.get('ordering_qty', 0))
                    required_quantity = float(item.get('required_quantity', 0))
                    soh = float(item.get('soh', 0))
                    balance_quantity = float(item.get('balance_quantity', 0))
                except (ValueError, TypeError) as e:
                    print(f"Error converting numeric fields for item {item.get('id')}: {e}")
                    logger.error(f"Error converting numeric fields for item {item.get('id')}: {e}. Item data: {item}")
                    continue
                
                print("Creating master entry with values:")
                print(f"project_code: {item.get('project_code')}")
                print(f"project_name: {item.get('project_name')}")
                print(f"ordering_qty: {ordering_qty}")
                print(f"required_quantity: {required_quantity}")
                
                # OPTIMIZATION: Validate and truncate unit field to prevent database error
                unit_value = item.get('unit', '')
                if len(unit_value) > 10:
                    logger.warning(f"Unit value '{unit_value}' exceeds 10 characters, truncating to '{unit_value[:10]}'")
                    unit_value = unit_value[:10]
                print(f"unit: {unit_value} (length: {len(unit_value)})")
                
                master_entry = Master.objects.create(
                    project_code=item.get('project_code'),
                    project_name=item.get('project_name'),
                    cimcon_part_number=item.get('cimcon_part_number'),
                    material_description=item.get('material_description'),
                    # Get mfg_part_number directly from requisition to ensure it's included
                    mfg_part_number=requisition.mfg_part_number,
                    make=item.get('make'),
                    material_group=item.get('material_group'),
                    required_quantity=required_quantity,
                    # Get required_by_date directly from requisition
                    required_by=requisition.required_by_date,
                    unit=unit_value,  # Use the validated unit value
                    indent_date=item.get('indent_date'),
                    soh=soh,
                    balance_quantity=balance_quantity,
                    ordering_qty=ordering_qty,
                    indent_number=item.get('indent_number'),
                    ordering_status='In Progress',
                    requisition_id=item.get('id'),
                    verification_date=verification_date,
                    batch_id=batch_id,
                    order_type=item.get('order_type')
                )
                
                print(f"Successfully created master entry: {master_entry}")
                master_entries.append(master_entry)
                
                # Update requisition status
                requisition.master_entry_exists = True
                requisition.verification_status = True
                requisition.save()
                print(f"Updated requisition status for ID: {item.get('id')}")
                
            except Exception as e:
                print(f"Error processing item: {str(e)}")
                logger.error(f"Error processing item {item.get('id')}: {str(e)}. Full item data: {item}")
                import traceback
                print("Full traceback:", traceback.format_exc())
                continue

        print("\n=== Verification Process Complete ===")
        print(f"Successfully created {len(master_entries)} master entries")
        
        # Get Purchaser's information
        purchaser = CustomUser.objects.filter(role='Purchaser').first()
        purchaser_email = purchaser.email if purchaser else None
        purchaser_first_name = purchaser.first_name if purchaser else 'Purchaser'
        purchaser_last_name = purchaser.last_name if purchaser else ''
        
        # Send email notification
        email_sender = SendEmail()
        email_sender.send(
            trigger='batch_id_verification',
            batch_id=batch_id,
            items=master_entries,
            purchaser_email=purchaser_email,
            purchaser_first_name=purchaser_first_name,
            purchaser_last_name=purchaser_last_name
        )
        
        return Response({
            'message': f'Verification completed. {len(master_entries)} items sent to master database.',
            'master_ids': [entry.id for entry in master_entries],
            'verification_date': verification_date.isoformat()
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        print("\n=== Verification Process Failed ===")
        print(f"Error: {str(e)}")
        logger.error(f"Verification process failed: {str(e)}")
        import traceback
        print("Full traceback:", traceback.format_exc())
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        
        


@api_view(['POST'])
def approve_po_email(request, po_number):
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

                # Simple but professional email body for vendor
                html_body = f"""
                <html>
                    <head>
                        <style>
                            body {{ font-family: Arial, sans-serif; color: #333; line-height: 1.5; }}
                            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
                            .po-info {{ background-color: #f7f7f7; padding: 10px; margin: 10px 0; }}
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <p>Dear {po.vendor_name},</p>
                            
                            <div class="po-info">
                                <p><strong>Purchase Order Number:</strong> {po_number}</p>
                                <p><strong>Date:</strong> {timezone.now().strftime('%d-%b-%Y')}</p>
                            </div>
                            
                            <p>Please find the attached purchase order for your review. Kindly confirm receipt and expected delivery date.</p>
                            
                            <p>For any queries, please contact our purchasing department.</p>
                            
                            <p>Thank You</p>
                        </div>
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
                document_name = f"Purchase_Order_{po_number}_{po.vendor_name.replace(' ', '_')}.docx"
                document_path = os.path.join(settings.MEDIA_ROOT, 'purchase_orders', document_name)


                # Attach PO document - Updated attachment code
                if os.path.exists(document_path):
                    with open(document_path, 'rb') as f:
                        # Change from MIMEApplication to MIMEText
                        attachment = MIMEText(f.read(), 'base64', 'utf-8')
                        attachment.add_header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
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

                # After successful vendor email, send internal notification
                # Create internal notification email
                internal_subject = f"PO {po_number} - Approved and Sent to Vendor"
                
                # Create purchaser full name
                purchaser_full_name = f"{purchaser_first_name} {purchaser_last_name}".strip()
                if not purchaser_full_name:
                    purchaser_full_name = "Purchaser"
                
                internal_body = f"""
                <html>
                    <body>
                        <p>Dear {purchaser_full_name},</p>
                        
                        <p>This is to inform you that Purchase Order <strong>{po_number}</strong> has been approved and sent to vendor <strong>{po.vendor_name}</strong>.</p>
                        
                        <p>The approved Purchase Order document is attached for your records.</p>
                                                
                        <p>Thank You</p>
                    </body>
                </html>
                """

                internal_msg = MIMEMultipart()
                internal_msg['From'] = sender_email
                internal_msg['To'] = purchaser_email
                internal_msg['Subject'] = internal_subject

                # Add HTML content
                internal_html_part = MIMEText(internal_body, 'html')
                internal_msg.attach(internal_html_part)

                # Attach the same PO document
                if os.path.exists(document_path):
                    with open(document_path, 'rb') as f:
                        internal_attachment = MIMEText(f.read(), 'base64', 'utf-8')
                        internal_attachment.add_header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                        internal_attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(document_path))
                        internal_msg.attach(internal_attachment)

                # Send internal notification
                with smtplib.SMTP(smtp_server, port) as server:
                    server.starttls()
                    server.login(sender_email, password)
                    server.send_message(internal_msg)
                    logger.info(f"Internal notification email sent successfully for PO {po_number}")

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
def reject_po_email(request, po_number):
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

        # Send rejection notification email
        try:
            smtp_server = settings.EMAIL_HOST
            port = settings.EMAIL_PORT
            sender_email = settings.EMAIL_HOST_USER
            password = settings.EMAIL_HOST_PASSWORD
            receiver_email = purchaser_email
            
            # Create purchaser full name
            purchaser_full_name = f"{purchaser_first_name} {purchaser_last_name}".strip()
            if not purchaser_full_name:
                purchaser_full_name = "Purchaser"

            subject = f'Purchase Order Rejected - PO#{po_number}'
            
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
                            <h2>Purchase Order Rejection Notice</h2>
                            
                            <p>Dear {purchaser_full_name},</p>
                            
                            <p>We wish to inform you that Purchase Order <span class="po-number">{po_number}</span> has been rejected.</p>
                            
                            <div class="rejection-details">
                                <p><strong>Rejection Remarks:</strong></p>
                                <p>{rejection_remarks}</p>
                            </div>
                            
                            <p>Please review the rejection remarks and take appropriate action. If you have any questions regarding this rejection, please contact the purchasing department.</p>
                        </div>

                        <div class="footer">
                            <p>Thank You</p>
                        </div>
                    </div>
                </body>
            </html>
            """

            msg = MIMEMultipart()
            msg['From'] = sender_email
            msg['To'] = receiver_email
            msg['Subject'] = subject

            msg.attach(MIMEText(html_body, 'html'))

            with smtplib.SMTP(smtp_server, port) as server:
                server.starttls()
                server.login(sender_email, password)
                server.send_message(msg)
                logger.info(f"Rejection notification email sent successfully for PO {po_number}")

        except Exception as email_error:
            logger.error(f"Error sending rejection notification email for PO {po_number}: {str(email_error)}")
            # Continue with the response even if email fails

        return Response({
            'message': 'Purchase Order rejected successfully',
            'po_number': po_number,
            'rejection_remarks': rejection_remarks
        })

    except PurchaseOrder.DoesNotExist:
        return Response({'error': 'Purchase Order not found'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=500)

def approval_page_open(request, po_number):
    try:
        # Make API call to approve-po-email endpoint
        base_url = settings.BASE_API_URL
        api_url = f"{base_url}/api/approve-po-email/{po_number}/"
        
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

def reject_page_open(request, po_number):
    try:
        if request.method == 'POST':
            # Handle form submission
            remarks = request.POST.get('rejection_remarks', '')
            
            # Make API call to reject-po-email endpoint
            base_url = settings.BASE_API_URL
            api_url = f"{base_url}/api/reject-po-email/{po_number}/"
            
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



class SendEmail:
    def __init__(self):
        self.smtp_server = settings.EMAIL_HOST
        self.port = settings.EMAIL_PORT
        self.sender_email = settings.EMAIL_HOST_USER
        self.password = settings.EMAIL_HOST_PASSWORD

    def send(self, trigger, **kwargs):       
        if trigger == 'batch_id_verification':
            # Get purchaser info from kwargs
            purchaser_email = kwargs.get('purchaser_email')
            purchaser_first_name = kwargs.get('purchaser_first_name', 'Purchaser')
            purchaser_last_name = kwargs.get('purchaser_last_name', '')
            
            # Use purchaser email if available, otherwise use default
            receiver_email = purchaser_email 

            # Create purchaser full name
            purchaser_full_name = f"{purchaser_first_name} {purchaser_last_name}".strip()
            if not purchaser_full_name:
                purchaser_full_name = "Purchaser"
            
            subject = f'Purchase Verification Details - Batch ID: {kwargs.get("batch_id")}'
            
            # Create HTML table for items
            table_rows = ""
            total_items = 0
            total_order_qty = 0
            
            for item in kwargs.get('items', []):
                total_items += 1
                total_order_qty += item.ordering_qty
                table_rows += f"""
                    <tr>
                        <td style="padding: 8px; border: 1px solid #ddd;">{item.cimcon_part_number}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{item.make}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{item.material_group}</td>
                        <td style="padding: 8px; border: 1px solid #ddd;">{item.order_type}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">{item.required_quantity}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">{item.soh}</td>
                        <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">{item.ordering_qty}</td>
                    </tr>
                """
            
            body = f"""
            <html>
            <head>
                <style>
                    body {{ font-family: Arial, sans-serif; color: #333333; }}
                    .email-container {{ max-width: 700px; margin: 0 auto; padding: 20px; }}
                    .header {{ background-color: #f5f5f5; color: #333; padding: 15px; border-bottom: 1px solid #ddd; }}
                    .content {{ padding: 20px; }}
                    .footer {{ padding: 15px; font-size: 12px; color: #666; text-align: center; border-top: 1px solid #ddd; margin-top: 20px; }}
                    table {{ width: 100%; border-collapse: collapse; margin: 15px 0; }}
                    th {{ background-color: #f5f5f5; color: #333; padding: 10px; text-align: left; border: 1px solid #ddd; }}
                    td {{ padding: 8px; border: 1px solid #ddd; }}
                    .summary-box {{ background-color: #f9f9f9; padding: 10px 15px; margin: 15px 0; border: 1px solid #ddd; }}
                    .batch-id {{ font-weight: bold; }}
                    h3 {{ color: #333; }}
                </style>
            </head>
            <body>
                <div class="email-container">
                    <div class="header">
                        <h2 style="margin: 0;">Purchase Verification Notification</h2>
                    </div>
                    
                    <div class="content">
                        <p>Dear {purchaser_full_name},</p>
                        
                        <p>This is to inform you that the following items have been verified and moved to the master database for further processing.</p>
                        
                        <div class="summary-box">
                            <p><span class="batch-id">Batch ID: {kwargs.get('batch_id')}</span></p>
                            <p><strong>Total Items:</strong> {total_items}</p>
                            <p><strong>Total Ordering Quantity:</strong> {total_order_qty}</p>
                        </div>
                        
                        <h3>Verified Items:</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Part Number</th>
                                    <th>Make</th>
                                    <th>Material Group</th>
                                    <th>Order Type</th>
                                    <th style="text-align: right;">Required Qty</th>
                                    <th style="text-align: right;">SOH</th>
                                    <th style="text-align: right;">Ordering Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {table_rows}
                            </tbody>
                        </table>
                        
                        <p>Please proceed with the purchasing process for these items at your earliest convenience.</p>
                        
                        <p>Thank You</p>

                    </div>
                    

                </div>
            </body>
            </html>
            """

            try:
                msg = MIMEMultipart()
                msg['From'] = self.sender_email
                msg['To'] = receiver_email
                msg['Subject'] = subject
                msg.attach(MIMEText(body, 'html'))

                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls()
                    server.login(self.sender_email, self.password)
                    server.send_message(msg)
                    
                print(f"Email sent successfully to {receiver_email}")
                return True
            except Exception as e:
                print(f"Failed to send email: {str(e)}")
                return False

        elif trigger == 'po_verification':
            vendor_email = kwargs.get('vendor_email')
            po_number = kwargs.get('po_number')
            document_path = kwargs.get('document_path')
            # vendor_name = kwargs.get('vendor_name')
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
                
            subject = f'PURCHASE ORDER/ {po_number} /'
            
            base_url = settings.BASE_API_URL
            approval_link = f"{base_url}/approve-po/{po_number}/"
            rejection_link = f"{base_url}/reject-po/{po_number}/"
            
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
                                <strong>Purchase Order:</strong> {po_number}
                            </div>

                            <p>Please find attached Purchase Order for your review. Kindly approve or reject at your earliest convenience.</p>
                        </div>

                        <div class="button-container">
                            <a href="{approval_link}" class="button approve">Approve</a>
                            <a href="{rejection_link}" class="button reject">Reject</a>
                        </div>

                        <div class="footer">
                            <p>Thak You</p>
                        </div>
                    </div>
                </body>
            </html>
            """

            try:
                msg = MIMEMultipart()
                msg['From'] = self.sender_email
                msg['To'] = admin_email
                msg['Subject'] = subject
                msg.attach(MIMEText(body, 'html'))

                # Attach the PO document
                with open(document_path, 'rb') as f:
                    attachment = MIMEText(f.read(), 'base64', 'utf-8')
                    attachment.add_header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
                    attachment.add_header('Content-Disposition', 'attachment', filename=os.path.basename(document_path))
                    msg.attach(attachment)

                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls()
                    server.login(self.sender_email, self.password)
                    server.send_message(msg)
                    
                print(f"Updated PO email sent successfully to Admin - {admin_full_name}, email - {admin_email}")
                return True
            except Exception as e:
                print(f"Failed to send PO email: {str(e)}")
                return False            
       
