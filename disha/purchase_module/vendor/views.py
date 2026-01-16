from django.shortcuts import render
from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework.decorators import action, api_view, parser_classes
from django.http import FileResponse, Http404, HttpResponse
from .models import Vendor
from .serializers import VendorSerializer
import os
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib
import logging
import requests
from django.middleware.csrf import get_token
from django.conf import settings
from users.models import CustomUser  # Add this import at the top

logger = logging.getLogger(__name__)


@api_view(['GET'])
def get_vendor_details(request, vendor_id):
    vendor = Vendor.objects.get(id=vendor_id)
    serializer = VendorSerializer(vendor)
    return Response(serializer.data)

class VendorViewSet(viewsets.ModelViewSet):
    queryset = Vendor.objects.all()
    serializer_class = VendorSerializer

    def perform_create(self, serializer):
        serializer.save(uploaded_file=self.request.FILES.get('uploaded_file'))

    @action(detail=True, methods=['get'], url_path='download/(?P<field_name>[^/.]+)')
    def download_file(self, request, pk=None, field_name=None):
        try:
            vendor = self.get_object()
            
            # Validate that the requested field is a file field
            valid_file_fields = [
                'pan_card', 'gst_certificate', 'incorporation_certificate',
                'cancelled_cheque', 'tan_allotment_letter', 'udyam_certificate_msme',
                'vendor_reg_form'
            ]
            
            if field_name not in valid_file_fields:
                return Response(
                    {"error": "Invalid document field"},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Get the field value (file object)
            file_obj = getattr(vendor, field_name)
            
            if not file_obj:
                return Response(
                    {"error": "File not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            file_path = file_obj.path
            if os.path.exists(file_path):
                # Get the file extension to determine content type
                filename = os.path.basename(file_path)
                ext = os.path.splitext(filename)[1].lower()
                
                # Map common extensions to MIME types
                content_types = {
                    '.pdf': 'application/pdf',
                    '.jpg': 'image/jpeg',
                    '.jpeg': 'image/jpeg',
                    '.png': 'image/png',
                    '.gif': 'image/gif',
                    '.doc': 'application/msword',
                    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                    '.xls': 'application/vnd.ms-excel',
                    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    '.txt': 'text/plain',
                }
                
                content_type = content_types.get(ext, 'application/octet-stream')
                
                response = FileResponse(
                    open(file_path, 'rb'),
                    content_type=content_type,
                    as_attachment=True,
                    filename=filename
                )
                
                # Add content disposition header
                response['Content-Disposition'] = f'attachment; filename="{filename}"'
                return response
            else:
                return Response(
                    {"error": "File not found on disk"},
                    status=status.HTTP_404_NOT_FOUND
                )
        except Exception as e:
            import traceback
            print(f"Error downloading file: {str(e)}")
            print(traceback.format_exc())
            return Response(
                {"error": str(e)},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

@api_view(['GET', 'POST'])
def create_vendor(request):
    if request.method == 'GET':
        vendors = Vendor.objects.all()
        serializer = VendorSerializer(vendors, many=True)
        return Response(serializer.data)
        
    elif request.method == 'POST':
        try:
            # Define required fields
            required_fields = [
                'product_category', 'vendor_name', 'contact_person',
                'mobile_no_1', 'email_1', 'address', 'gst_number', 'pan_number', 'state', 'state_code'
            ]
            
            # Define required documents
            required_documents = [
                'pan_card', 'gst_certificate', 'incorporation_certificate',
                'cancelled_cheque', 'tan_allotment_letter', 'vendor_reg_form'
            ]
            
            # Check required fields
            missing_fields = []
            for field in required_fields:
                if not request.data.get(field):
                    missing_fields.append(field)
            
            # Check required documents
            missing_documents = []
            for doc in required_documents:
                if doc not in request.FILES:
                    missing_documents.append(doc)
            
            # If any required fields or documents are missing, return error
            if missing_fields or missing_documents:
                error_response = {
                    "error": "Missing required information"
                }
                
                if missing_fields:
                    error_response["missing_fields"] = missing_fields
                    
                if missing_documents:
                    error_response["missing_documents"] = missing_documents
                    
                return Response(error_response, status=status.HTTP_400_BAD_REQUEST)
            
            # Get Purchaser's information
            purchaser = CustomUser.objects.filter(role='Purchaser').first()
            purchaser_email = purchaser.email if purchaser else None
            purchaser_first_name = purchaser.first_name if purchaser else 'Purchaser'
            purchaser_last_name = purchaser.last_name if purchaser else ''

            # Get Admin's information (for approval notification)
            approver = CustomUser.objects.filter(role='Admin').first()
            approver_email = approver.email if approver else None
            approver_first_name = approver.first_name if approver else 'Admin'
            approver_last_name = approver.last_name if approver else ''

            # if not purchaser_email:
            #     logger.warning("No Purchaser role user found in the system")
            
            # Get the last vendor ID
            last_vendor = Vendor.objects.order_by('-vendor_id').first()
            
            # Generate new vendor_id
            if last_vendor and last_vendor.vendor_id:
                last_number = int(last_vendor.vendor_id[6:])  # Still slice from position 6
                new_number = last_number + 1
            else:
                new_number = 1
            
            # Changed from 05d to 07d to get 7 digits
            new_vendor_id = f'CIMVED{new_number:07d}'

            # Convert string 'true'/'false' to boolean for registration_form_received
            
            # Create vendor instance first
            vendor = Vendor(
                vendor_id=new_vendor_id,
                product_category=request.data.get('product_category', ''),
                vendor_name=request.data.get('vendor_name', ''),
                contact_person=request.data.get('contact_person', ''),
                mobile_no_1=request.data.get('mobile_no_1', ''),
                mobile_no_2=request.data.get('mobile_no_2', ''),
                email_1=request.data.get('email_1', ''),
                email_2=request.data.get('email_2', ''),
                website=request.data.get('website', ''),
                address=request.data.get('address', ''),
                payment_term=request.data.get('payment_term', ''),
                gst_number=request.data.get('gst_number', ''),
                pan_number=request.data.get('pan_number', ''),
                state=request.data.get('state', ''),
                state_code=request.data.get('state_code', ''),
            )

            # Save the initial instance
            vendor.save()

            # Handle file uploads
            file_fields = [
                'pan_card',
                'gst_certificate',
                'incorporation_certificate',
                'cancelled_cheque',
                'tan_allotment_letter',
                'udyam_certificate_msme',
                'vendor_reg_form'
            ]

            # Process each file field
            for field in file_fields:
                if field in request.FILES:
                    # Delete old file if exists
                    existing_file = getattr(vendor, field, None)
                    if existing_file:
                        try:
                            os.remove(existing_file.path)
                        except Exception:
                            pass
                    # Save new file with standard name
                    file_obj = request.FILES[field]
                    ext = file_obj.name.split('.')[-1]
                    file_obj.name = f"{field}.{ext}"
                    setattr(vendor, field, file_obj)

            # Save again with files
            vendor.save()

            # Add debug print before email attempt
            print("Attempting to send email notification...")
            try:
                email_sender = SendEmail()
                print(f"Email sender initialized with SMTP server: {email_sender.smtp_server}")
                email_sender.send('create_new_vendor',
                    vendor_id=new_vendor_id,
                    vendor_name=request.data.get('vendor_name', ''),
                    product_category=request.data.get('product_category', ''),
                    contact_person=request.data.get('contact_person', ''),
                    mobile_no_1=request.data.get('mobile_no_1', ''),
                    mobile_no_2=request.data.get('mobile_no_2', ''),
                    email_1=request.data.get('email_1', ''),
                    email_2=request.data.get('email_2', ''),
                    website=request.data.get('website', ''),
                    address=request.data.get('address', ''),
                    payment_term=request.data.get('payment_term', ''),
                    # ADD THE 4 NEW FIELDS
                    gst_number=request.data.get('gst_number', ''),
                    pan_number=request.data.get('pan_number', ''),
                    state=request.data.get('state', ''),
                    state_code=request.data.get('state_code', ''),
                    purchaser_email=purchaser_email,
                    purchaser_first_name=purchaser_first_name,
                    purchaser_last_name=purchaser_last_name,
                    approver_email=approver_email,
                    approver_first_name=approver_first_name,
                    approver_last_name=approver_last_name,
                    vendor=vendor,

                    # Pass the vendor instance
                )
                print("Email sent successfully")  # Debug print
            except Exception as e:
                print(f"Error sending email notification: {str(e)}")
                print(f"Full error details: ", e.__class__.__name__)
                import traceback
                print(traceback.format_exc())

            return Response({
                'message': 'Vendor created successfully',
                'vendor_id': new_vendor_id
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            print(f"Error creating vendor: {str(e)}")
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        

@api_view(['GET'])
def get_last_vendor_id(request):
    last_vendor = Vendor.objects.order_by('-vendor_id').first()
    if last_vendor:
        return Response({'vendor_id': last_vendor.vendor_id})
    return Response({'vendor_id': None})

@api_view(['GET'])
def get_pending_vendors(request):
    vendors = Vendor.objects.filter(status='pending')
    serializer = VendorSerializer(vendors, many=True)
    return Response(serializer.data)

@api_view(['POST'])
def approve_vendor(request, vendor_id):
    try:
        vendor = Vendor.objects.get(id=vendor_id)
        previous_status = vendor.status
        status_value = request.data.get('status')
        
        # Get Purchaser's email
        purchaser_email = CustomUser.objects.filter(
            role='Purchaser'
        ).values_list('email', flat=True).first()

        # Get Accounts email
        accounts_email = CustomUser.objects.filter(
            role='Accounts'
        ).values_list('email', flat=True).first()
        
        if status_value not in ['approved', 'rejected']:
            return Response(
                {'error': 'Invalid status'},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        vendor.status = status_value
        
        # Save remarks if provided and status is rejected
        remarks = None
        if status_value == 'rejected' and 'remarks' in request.data:
            remarks = request.data.get('remarks')
            if remarks:
                vendor.remarks = remarks
                print(f"Saving rejection remarks: {remarks}")
            
        vendor.save()
        
        # Send email notifications if status changed from pending
        if previous_status == 'pending':
            try:
                email_sender = SendEmail()
                
                # Prepare common kwargs for email
                email_kwargs = {
                    'vendor_id': vendor.vendor_id,
                    'vendor_name': vendor.vendor_name,
                    'product_category': vendor.product_category,
                    'contact_person': vendor.contact_person,
                    'purchaser_email': purchaser_email,  # Add purchaser email
                    'accounts_email': accounts_email  # Add accounts email
                }
                
                if status_value == 'approved':
                    email_sender.send('vendor_approve_dash', **email_kwargs)
                elif status_value == 'rejected':
                    email_kwargs['remarks'] = remarks or 'No remarks provided'
                    email_sender.send('vendor_reject_dash', **email_kwargs)
                    
            except Exception as e:
                print(f"Error sending status change email: {str(e)}")
                logger.error(f"Failed to send vendor status change email: {str(e)}")
                # Continue execution even if email fails
        
        return Response({'message': f'Vendor {status_value} successfully'})
    except Vendor.DoesNotExist:
        return Response(
            {'error': 'Vendor not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        print(f"Error approving vendor: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

@api_view(['GET', 'PUT'])
@parser_classes([MultiPartParser, FormParser])
def update_vendor(request, vendor_id):
    try:
        vendor = Vendor.objects.get(id=vendor_id)
        
        if request.method == 'GET':
            serializer = VendorSerializer(vendor)
            
            # Add information about uploaded documents to help the frontend
            file_fields = [
                'pan_card', 
                'gst_certificate', 
                'incorporation_certificate',
                'cancelled_cheque', 
                'tan_allotment_letter', 
                'udyam_certificate_msme',
                'vendor_reg_form'
            ]
            
            # Create a document status dictionary
            document_status = {}
            for field in file_fields:
                file_obj = getattr(vendor, field, None)
                # Extract file name for display in the edit form
                if file_obj:
                    # Get full path
                    file_path = file_obj.path
                    # Extract just the filename from the path
                    file_name = os.path.basename(file_path)
                else:
                    file_name = None
                
                document_status[field] = {
                    'is_uploaded': bool(file_obj),
                    'file_name': file_name,  # This is the file name to display in the edit form
                    'field_label': {
                        'pan_card': 'PAN Card',
                        'gst_certificate': 'GST Certificate',
                        'incorporation_certificate': 'Incorporation Certificate',
                        'cancelled_cheque': 'Cancelled Cheque',
                        'tan_allotment_letter': 'TAN Allotment Letter',
                        'udyam_certificate_msme': 'UDYAM Certificate (MSME)',
                        'vendor_reg_form': 'Vendor Registration Form' 
                    }[field]
                }
            
            # Prepare summary stats
            total_documents = len(file_fields)
            uploaded_documents = sum(1 for field in file_fields if getattr(vendor, field, None))
            
            # Create the response with document information
            response_data = serializer.data
            response_data['document_status'] = document_status
            response_data['document_summary'] = {
                'total': total_documents,
                'uploaded': uploaded_documents,
                'missing': total_documents - uploaded_documents
            }
            
            return Response(response_data)
            
        elif request.method == 'PUT':
            # Define required fields when changing to pending status
            required_fields = [
                'product_category', 'vendor_name', 'contact_person',
                'mobile_no_1', 'email_1', 'address'
            ]
            
            # Check if we're changing status to pending
            status_value = request.data.get('status')
            if status_value == 'pending':
                # Only check for missing required text fields
                missing_fields = []
                for field in required_fields:
                    field_value = request.data.get(field)
                    if not field_value:
                        existing_value = getattr(vendor, field, None)
                        if not existing_value:
                            missing_fields.append(field)
                if missing_fields:
                    return Response({
                        "error": "Missing required information to resubmit vendor",
                        "missing_fields": missing_fields
                    }, status=status.HTTP_400_BAD_REQUEST)
            
            # Get Purchaser's email
            purchaser_email = CustomUser.objects.filter(
                role='Purchaser'
            ).values_list('email', flat=True).first()

            # Get Admin's email (for approval notification)
            approver_email = CustomUser.objects.filter(
                role='Admin'
            ).values_list('email', flat=True).first()

            print("Received update request for vendor:", vendor_id)
            print("Request data:", request.data)
            
            # Create a copy of request.data to modify
            data = request.data.copy()
            
            # Remove document fields from data if they're not actual files
            file_fields = [
                'pan_card', 
                'gst_certificate', 
                'incorporation_certificate',
                'cancelled_cheque', 
                'tan_allotment_letter', 
                'udyam_certificate_msme',
                'vendor_reg_form'
            ]
            
            for field in file_fields:
                if field in data and field not in request.FILES:
                    del data[field]
            
            # Validate with partial=True to allow partial updates
            serializer = VendorSerializer(vendor, data=data, partial=True)
            
            if serializer.is_valid():
                # Save basic fields but don't commit yet
                instance = serializer.save()
                
                # Explicitly set the status field
                status_value = request.data.get('status')
                if status_value and status_value in ['pending', 'approved', 'rejected']:
                    print(f"Explicitly setting status to: {status_value}")
                    instance.status = status_value
                
                # If status changed to pending, clear the remarks field
                if status_value == 'pending' and instance.remarks:
                    print("Clearing remarks field as vendor is being resubmitted")
                    instance.remarks = None
                    
                # Process files
                file_fields = [
                    'pan_card', 
                    'gst_certificate', 
                    'incorporation_certificate',
                    'cancelled_cheque', 
                    'tan_allotment_letter', 
                    'udyam_certificate_msme',
                    'vendor_reg_form'
                ]
                
                for field in file_fields:
                    if field in request.FILES:
                        file_obj = request.FILES[field]
                        
                        # Get file extension
                        original_ext = file_obj.name.split('.')[-1].lower()
                        
                        # Get the vendor document directory to check existing files
                        safe_vendor_name = "".join(c for c in instance.vendor_name if c.isalnum() or c in [' ', '_']).replace(' ', '_')
                        vendor_docs_dir = os.path.join(settings.MEDIA_ROOT, 'vendor_documents', f"{instance.vendor_id}_{safe_vendor_name}")
                        
                        # Determine the next filename
                        if os.path.exists(vendor_docs_dir):
                            existing_files = os.listdir(vendor_docs_dir)
                            
                            # Check for base file (e.g., pan_card.pdf)
                            base_file = f"{field}.{original_ext}"
                            
                            # Check for numbered files (e.g., pan_card_1.pdf, pan_card_2.pdf)
                            numbered_files = [f for f in existing_files if f.startswith(f"{field}_") and f.endswith(f".{original_ext}")]
                            
                            if base_file in existing_files:
                                # Base file exists, find the highest number
                                numbers = [0]  # Start with 0 for the base file
                                for f in numbered_files:
                                    try:
                                        num_part = f.replace(f"{field}_", "").replace(f".{original_ext}", "")
                                        numbers.append(int(num_part))
                                    except ValueError:
                                        continue
                                
                                next_number = max(numbers) + 1
                                new_filename = f"{field}_{next_number}.{original_ext}"
                            else:
                                # No base file, use base filename
                                new_filename = f"{field}.{original_ext}"
                        else:
                            # Directory doesn't exist, use base filename
                            new_filename = f"{field}.{original_ext}"
                        
                        # Simply change the file object's name - Django will handle the rest
                        file_obj.name = new_filename
                        setattr(instance, field, file_obj)
                        print(f"Uploaded new file for {field}: {new_filename}")
                
                # Save the instance with all changes
                instance.save()

                # Add cleanup function after the file processing loop
                # Clean up files with original names (not following field naming convention)
                safe_vendor_name = "".join(c for c in instance.vendor_name if c.isalnum() or c in [' ', '_']).replace(' ', '_')
                vendor_docs_dir = os.path.join(settings.MEDIA_ROOT, 'vendor_documents', f"{instance.vendor_id}_{safe_vendor_name}")

                if os.path.exists(vendor_docs_dir):
                    existing_files = os.listdir(vendor_docs_dir)
                    
                    # Define valid filename patterns for each field
                    valid_patterns = []
                    for field in file_fields:
                        # Add base pattern (e.g., "pan_card.pdf")
                        valid_patterns.append(f"{field}.")
                        # Add numbered pattern (e.g., "pan_card_1.pdf", "pan_card_2.pdf")
                        valid_patterns.append(f"{field}_")
                    
                    # Find and remove files that don't match valid patterns
                    for filename in existing_files:
                        is_valid = False
                        for pattern in valid_patterns:
                            if filename.startswith(pattern):
                                is_valid = True
                                break
                        
                        if not is_valid:
                            file_path = os.path.join(vendor_docs_dir, filename)
                            try:
                                os.remove(file_path)
                                print(f"Removed file with original name: {filename}")
                            except Exception as e:
                                print(f"Error removing file {filename}: {str(e)}")

                # Send email notification for the update
                try:
                    email_sender = SendEmail()
                    email_sender.send('create_new_vendor',
                        vendor_id=instance.vendor_id,
                        vendor_name=instance.vendor_name,
                        product_category=instance.product_category,
                        contact_person=instance.contact_person,
                        mobile_no_1=instance.mobile_no_1,
                        mobile_no_2=instance.mobile_no_2,
                        email_1=instance.email_1,
                        email_2=instance.email_2,
                        website=instance.website,
                        address=instance.address,
                        payment_term=instance.payment_term,
                        # ADD THE 4 NEW FIELDS
                        gst_number=instance.gst_number,
                        pan_number=instance.pan_number,
                        state=instance.state,
                        state_code=instance.state_code,
                        is_update=True,
                        purchaser_email=purchaser_email,
                        approver_email=approver_email,
                        vendor=instance  # Pass the instance to include document status
                    )
                except Exception as e:
                    print(f"Error sending update notification email: {str(e)}")
                    logger.error(f"Failed to send vendor update email: {str(e)}")
                    # Continue execution even if email fails
                
                return Response({'message': 'Vendor updated successfully'})
            else:
                print("Serializer errors:", serializer.errors)
                return Response(
                    {'error': 'Invalid data', 'details': serializer.errors},
                    status=status.HTTP_400_BAD_REQUEST
                )
    except Vendor.DoesNotExist:
        return Response(
            {'error': f'Vendor with ID {vendor_id} not found'},
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        print("Exception in update_vendor:", str(e))
        print(traceback.format_exc())
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )

@api_view(['GET'])
def get_approved_vendors(request):
    vendors = Vendor.objects.filter(status='approved')
    serializer = VendorSerializer(vendors, many=True)
    return Response(serializer.data)

@api_view(['GET'])
def get_rejected_vendors(request):
    try:
        vendors = Vendor.objects.filter(status='rejected')
        serializer = VendorSerializer(vendors, many=True)
        return Response(serializer.data)
    except Exception as e:
        print(f"Error fetching rejected vendors: {str(e)}")
        return Response(
            {'error': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )





def vendor_reject_page_open(request, vendor_id):
    try:
        if request.method == 'POST':
            # Handle form submission
            remarks = request.POST.get('rejection_remarks', '')
            
            # Make API call to vendor-reject-email endpoint
            base_url = settings.BASE_API_URL
            api_url = f"{base_url}/api/vendor-reject-email/{vendor_id}/"
            
            response = requests.post(api_url, json={
                "vendor_id": vendor_id,
                "remarks": remarks
            })
            
            # Prepare response page
            success = response.status_code == 200
            message = "Vendor Rejected Successfully!" if success else "Failed to reject vendor"
            message_color = "#F44336"  # Red for rejection
            
            return HttpResponse(f'''
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Vendor Rejection</title>
                    <style>
                        body {{
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            background-color: #f5f5f5;
                            margin: 0;
                        }}
                        .container {{
                            background-color: white;
                            padding: 40px;
                            border-radius: 8px;
                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                            text-align: center;
                            max-width: 500px;
                            width: 90%;
                        }}
                        h2 {{
                            color: #333;
                        }}
                        .message {{
                            color: {message_color};
                            font-size: 24px;
                            margin-top: 20px;
                        }}
                        .vendor-id {{
                            font-size: 16px;
                            color: #666;
                            margin-top: 10px;
                        }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Vendor Rejection Status</h2>
                        <p class="message">{"✓" if success else "✗"} {message}</p>
                        <p class="vendor-id">Vendor ID: {vendor_id}</p>
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
                    <title>Reject Vendor Request</title>
                    <style>
                        body {{
                            font-family: Arial, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            min-height: 100vh;
                            background-color: #f5f5f5;
                            margin: 0;
                        }}
                        .container {{
                            background-color: white;
                            padding: 40px;
                            border-radius: 8px;
                            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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
                            background-color: #F44336;
                            color: white;
                            border: none;
                            padding: 12px 24px;
                            border-radius: 4px;
                            cursor: pointer;
                            font-size: 16px;
                        }}
                        .submit-btn:hover {{
                            background-color: #d32f2f;
                        }}
                        .vendor-id {{
                            font-size: 16px;
                            color: #666;
                            margin-top: 10px;
                        }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Reject Vendor Request</h2>
                        <p class="vendor-id">Vendor ID: {vendor_id}</p>
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
        error_html = f'''
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background-color: #f5f5f5;
                    margin: 0;
                }}
                .container {{
                    background-color: white;
                    padding: 40px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    text-align: center;
                }}
                h2 {{
                    color: #333;
                }}
                .message {{
                    color: #F44336;
                    font-size: 24px;
                    margin-top: 20px;
                }}
                .vendor-id {{
                    color: #666;
                    font-size: 16px;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Error</h2>
                <p class="message">✗ Failed to process rejection</p>
                <p class="vendor-id">Vendor ID: {vendor_id}</p>
                <p style="color: #666;">Error: {str(e)}</p>
            </div>
        </body>
        </html>
        '''
        return HttpResponse(error_html)

def vendor_approve_page_open(request, vendor_id):
    try:
        # Make API call to vendor-approve-email endpoint
        base_url = settings.BASE_API_URL
        api_url = f"{base_url}/api/vendor-approve-email/{vendor_id}/"
        
        response = requests.post(api_url, json={"vendor_id": vendor_id})
        
        # Prepare HTML response based on API response
        success = response.status_code == 200
        message = "Vendor Approved Successfully!" if success else "Failed to approve vendor"
        message_color = "#4CAF50" if success else "#F44336"
        
        html_content = f'''
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Vendor Approval</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background-color: #f5f5f5;
                    margin: 0;
                }}
                .container {{
                    background-color: white;
                    padding: 40px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    text-align: center;
                }}
                h2 {{
                    color: #333;
                }}
                .message {{
                    color: {message_color};
                    font-size: 24px;
                    margin-top: 20px;
                }}
                .vendor-id {{
                    color: #666;
                    font-size: 16px;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Vendor Approval Status</h2>
                <p class="message">{"✓" if success else "✗"} {message}</p>
                <p class="vendor-id">Vendor ID: {vendor_id}</p>
            </div>
        </body>
        </html>
        '''
        return HttpResponse(html_content)
        
    except Exception as e:
        error_html = f'''
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Error</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    background-color: #f5f5f5;
                    margin: 0;
                }}
                .container {{
                    background-color: white;
                    padding: 40px;
                    border-radius: 8px;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
                    text-align: center;
                }}
                h2 {{
                    color: #333;
                }}
                .message {{
                    color: #F44336;
                    font-size: 24px;
                    margin-top: 20px;
                }}
                .vendor-id {{
                    color: #666;
                    font-size: 16px;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Error</h2>
                <p class="message">✗ Failed to process approval</p>
                <p class="vendor-id">Vendor ID: {vendor_id}</p>
                <p style="color: #666;">Error: {str(e)}</p>
            </div>
        </body>
        </html>
        '''
        return HttpResponse(error_html)

@api_view(['POST'])
def vendor_approve_email(request, vendor_id):
    """Approve a vendor from email link"""
    try:
        vendor = Vendor.objects.get(vendor_id=vendor_id)
        
        # Get Purchaser's email
        purchaser_email = CustomUser.objects.filter(
            role='Purchaser'
        ).values_list('email', flat=True).first()

        # Get Accounts email
        accounts_email = CustomUser.objects.filter(
            role='Accounts'
        ).values_list('email', flat=True).first()

        
        if vendor.status != 'pending':
            return Response({"error": "Can only approve pending vendors"}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Update vendor status
        vendor.status = 'approved'
        vendor.save()
        
        # Send approval email notification
        try:
            email_sender = SendEmail()
            email_sender.send('vendor_approve_dash',
                vendor_id=vendor.vendor_id,
                vendor_name=vendor.vendor_name,
                product_category=vendor.product_category,
                contact_person=vendor.contact_person,
                purchaser_email=purchaser_email,  # Add purchaser email
                accounts_email=accounts_email  # Add accounts email
            )
        except Exception as e:
            print(f"Error sending approval email: {str(e)}")
            logger.error(f"Failed to send vendor approval email: {str(e)}")
            # Continue execution even if email fails
        
        return Response({
            "success": True,
            "message": "Vendor approved successfully",
            "vendor_id": vendor.vendor_id
        })
    except Vendor.DoesNotExist:
        return Response({"error": "Vendor not found"}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def vendor_reject_email(request, vendor_id):
    """Reject a vendor from email link"""
    try:
        vendor = Vendor.objects.get(vendor_id=vendor_id)
        # Get Purchaser's email
        purchaser_email = CustomUser.objects.filter(
            role='Purchaser'
        ).values_list('email', flat=True).first()
        
        if vendor.status != 'pending':
            return Response({"error": "Can only reject pending vendors"}, 
                          status=status.HTTP_400_BAD_REQUEST)
        
        # Get remarks from request
        remarks = request.data.get('remarks', 'No remarks provided')
        
        # Update vendor status
        vendor.status = 'rejected'
        vendor.remarks = remarks
        vendor.save()
        
        # Send rejection email notification
        try:
            email_sender = SendEmail()
            email_sender.send('vendor_reject_dash',
                vendor_id=vendor.vendor_id,
                vendor_name=vendor.vendor_name,
                product_category=vendor.product_category,
                contact_person=vendor.contact_person,
                remarks=remarks,
                purchaser_email=purchaser_email
            )
        except Exception as e:
            print(f"Error sending rejection email: {str(e)}")
            logger.error(f"Failed to send vendor rejection email: {str(e)}")
            # Continue execution even if email fails
        
        return Response({
            "success": True,
            "message": "Vendor rejected successfully",
            "vendor_id": vendor.vendor_id
        })
    except Vendor.DoesNotExist:
        return Response({"error": "Vendor not found"}, 
                       status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, 
                       status=status.HTTP_500_INTERNAL_SERVER_ERROR)



@api_view(['PUT'])
@parser_classes([MultiPartParser, FormParser])
def quick_update_vendor(request, vendor_id):
    """
    Complete update of vendor information including file handling
    """
    try:
        # Get the vendor by ID
        vendor = Vendor.objects.get(id=vendor_id)
        
        # Update all possible text fields from request data
        updateable_fields = [
            'product_category', 'vendor_name', 'contact_person',
            'mobile_no_1', 'mobile_no_2', 'email_1', 'email_2',
            'website', 'address', 'payment_term', 'gst_number',
            'pan_number', 'state', 'state_code', 'vendor_id', 'status'
        ]
        
        # Update each field if present in the request
        for field in updateable_fields:
            if field in request.data:
                setattr(vendor, field, request.data[field])
        
        # Process file fields
        file_fields = [
            'pan_card', 
            'gst_certificate', 
            'incorporation_certificate',
            'cancelled_cheque', 
            'tan_allotment_letter', 
            'udyam_certificate_msme',
            'vendor_reg_form'
        ]
        
        # Handle file uploads
        for field in file_fields:
            if field in request.FILES:
                file_obj = request.FILES[field]
                
                # Get file extension
                original_ext = file_obj.name.split('.')[-1].lower()
                
                # Get the vendor document directory to check existing files
                safe_vendor_name = "".join(c for c in vendor.vendor_name if c.isalnum() or c in [' ', '_']).replace(' ', '_')
                vendor_docs_dir = os.path.join(settings.MEDIA_ROOT, 'vendor_documents', f"{vendor.vendor_id}_{safe_vendor_name}")
                
                # Determine the next filename
                if os.path.exists(vendor_docs_dir):
                    existing_files = os.listdir(vendor_docs_dir)
                    
                    # Check for base file (e.g., pan_card.pdf)
                    base_file = f"{field}.{original_ext}"
                    
                    # Check for numbered files (e.g., pan_card_1.pdf, pan_card_2.pdf)
                    numbered_files = [f for f in existing_files if f.startswith(f"{field}_") and f.endswith(f".{original_ext}")]
                    
                    if base_file in existing_files:
                        # Base file exists, find the highest number
                        numbers = [0]  # Start with 0 for the base file
                        for f in numbered_files:
                            try:
                                num_part = f.replace(f"{field}_", "").replace(f".{original_ext}", "")
                                numbers.append(int(num_part))
                            except ValueError:
                                continue
                        
                        next_number = max(numbers) + 1
                        new_filename = f"{field}_{next_number}.{original_ext}"
                    else:
                        # No base file, use base filename
                        new_filename = f"{field}.{original_ext}"
                else:
                    # Directory doesn't exist, use base filename
                    new_filename = f"{field}.{original_ext}"
                
                # Simply change the file object's name - Django will handle the rest
                file_obj.name = new_filename
                setattr(vendor, field, file_obj)
                print(f"Uploaded new file for {field}: {new_filename}")
        
        # Save the updated vendor
        vendor.save()
        
        # Return all vendor data
        serializer = VendorSerializer(vendor)
        
        # Add information about uploaded documents to help the frontend
        response_data = serializer.data
        document_status = {}
        for field in file_fields:
            file_obj = getattr(vendor, field, None)
            # Extract file name for display
            if file_obj:
                file_path = file_obj.path
                file_name = os.path.basename(file_path)
            else:
                file_name = None
            
            document_status[field] = {
                'is_uploaded': bool(file_obj),
                'file_name': file_name,
                'field_label': {
                    'pan_card': 'PAN Card',
                    'gst_certificate': 'GST Certificate',
                    'incorporation_certificate': 'Incorporation Certificate',
                    'cancelled_cheque': 'Cancelled Cheque',
                    'tan_allotment_letter': 'TAN Allotment Letter',
                    'udyam_certificate_msme': 'UDYAM Certificate (MSME)',
                    'vendor_reg_form': 'Vendor Registration Form'
                }[field]
            }
        
        response_data['document_status'] = document_status
        response_data['document_summary'] = {
            'total': len(file_fields),
            'uploaded': sum(1 for field in file_fields if getattr(vendor, field, None)),
            'missing': len(file_fields) - sum(1 for field in file_fields if getattr(vendor, field, None))
        }
        
        return Response({
            'message': 'Vendor updated successfully',
            'data': response_data
        })
        
    except Vendor.DoesNotExist:
        return Response(
            {'error': f'Vendor with ID {vendor_id} not found'}, 
            status=status.HTTP_404_NOT_FOUND
        )
    except Exception as e:
        import traceback
        print("Exception in quick_update_vendor:", str(e))
        print(traceback.format_exc())
        return Response(
            {'error': str(e)},
            status=status.HTTP_400_BAD_REQUEST
        )
    

class SendEmail:
    def __init__(self):
        self.smtp_server = settings.EMAIL_HOST
        self.port = settings.EMAIL_PORT
        self.sender_email = settings.EMAIL_HOST_USER
        self.password = settings.EMAIL_HOST_PASSWORD

    def send(self, trigger, **kwargs):
        if trigger == 'create_new_vendor':
            try:
                print(f"Starting email send process for trigger: {trigger}")
                
                # Extract vendor details from kwargs
                purchaser_email = kwargs.get('purchaser_email')
                purchaser_first_name = kwargs.get('purchaser_first_name', 'Purchaser')
                purchaser_last_name = kwargs.get('purchaser_last_name', '')
                approver_email = kwargs.get('approver_email')
                approver_first_name = kwargs.get('approver_first_name', 'Admin')
                approver_last_name = kwargs.get('approver_last_name', '')
                accounts_email = kwargs.get('accounts_email')
                vendor_id = kwargs.get('vendor_id', 'N/A')
                vendor_name = kwargs.get('vendor_name', 'N/A')
                product_category = kwargs.get('product_category', 'N/A')
                contact_person = kwargs.get('contact_person', 'N/A')
                mobile_no_1 = kwargs.get('mobile_no_1', 'N/A')
                mobile_no_2 = kwargs.get('mobile_no_2', 'N/A')
                email_1 = kwargs.get('email_1', 'N/A')
                email_2 = kwargs.get('email_2', 'N/A')
                website = kwargs.get('website', 'N/A')
                address = kwargs.get('address', 'N/A')
                payment_term = kwargs.get('payment_term', 'N/A')
                vendor = kwargs.get('vendor')  # Get vendor instance

                # ADD THESE 4 LINES TO EXTRACT THE NEW FIELDS
                gst_number = kwargs.get('gst_number', 'N/A')
                pan_number = kwargs.get('pan_number', 'N/A')
                state = kwargs.get('state', 'N/A')
                state_code = kwargs.get('state_code', 'N/A')

                # Create purchaser and approver full names
                purchaser_full_name = f"{purchaser_first_name} {purchaser_last_name}".strip()
                approver_full_name = f"{approver_first_name} {approver_last_name}".strip()

                # Add base URL and approval/rejection URLs
                base_url = settings.BASE_API_URL
                approve_url = f"{base_url}/vendor-approve-page-open/{vendor_id}/"
                reject_url = f"{base_url}/vendor-reject-page-open/{vendor_id}/"

                # Prepare document status rows
                document_status_rows = ""
                if vendor:
                    valid_file_fields = [
                        ('pan_card', 'PAN Card'),
                        ('gst_certificate', 'GST Certificate'),
                        ('incorporation_certificate', 'Incorporation Certificate'),
                        ('cancelled_cheque', 'Cancelled Cheque'),
                        ('tan_allotment_letter', 'TAN Allotment Letter'),
                        ('udyam_certificate_msme', 'UDYAM Certificate (MSME)'),
                        ('vendor_reg_form', 'Vendor Registration Form')
                    ]
                    
                    for field_name, field_label in valid_file_fields:
                        file_obj = getattr(vendor, field_name, None)
                        status_text = '<span style="color: green;">✓ Uploaded</span>' if file_obj else '<span style="color: red;">✗ Not Uploaded</span>'
                        document_status_rows += f"""
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;"><strong>{field_label}:</strong></td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{status_text}</td>
                        </tr>
                        """

                # Original detailed table for both emails
                vendor_details_table = f"""
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Vendor ID:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{vendor_id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Vendor Name:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{vendor_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Product Category:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{product_category}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Contact Person:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{contact_person}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Primary Mobile:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{mobile_no_1}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Secondary Mobile:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{mobile_no_2}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Primary Email:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{email_1}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Secondary Email:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{email_2}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Website:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{website}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Address:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{address}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Payment Terms:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payment_term}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>GST Number:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{gst_number}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>PAN Number:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{pan_number}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>State:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{state}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>State Code:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{state_code}</td>
                    </tr>
                    
                    <!-- Document Status Section -->
                    <tr>
                        <td colspan="2" style="padding: 10px; border: 1px solid #ddd; background-color: #f8f9fa;">
                            <strong>Document Upload Status</strong>
                        </td>
                    </tr>
                    {document_status_rows}
                </table>
                """

                # Email for Purchaser (Submission notification)
                purchaser_subject = f"Vendor Registration Submitted - {vendor_id}"
                purchaser_html = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
                                <h2 style="margin: 0; color: #28a745;">Vendor Registration Submitted Successfully</h2>
                            </div>
                            <p>Dear {purchaser_full_name},</p>
                            <p>You have submitted a new vendor registration with the following details:</p>
                            {vendor_details_table}
                            <p style="color: #666; font-size: 12px; margin-top: 20px; border-top: 1px solid #ddd; padding-top: 20px;">
                                This registration has been sent for approval. You will be notified once it is approved.
                            </p>
                        </div>
                    </body>
                </html>
                """

                # Email for Approver (Original approval email with buttons)
                approver_subject = f"New Vendor Registration - {vendor_id}"
                approver_html = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <h2>New Vendor Registration Details</h2>
                            <p>Dear {approver_full_name},</p>
                            <p>A new vendor registration has been submitted that requires your review:</p>
                            {vendor_details_table}
                            <div style="margin-top: 30px; text-align: center;">
                                <p>Please take action on this vendor registration:</p>
                                <a href="{approve_url}" style="display: inline-block; margin: 10px; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Approve Vendor</a>
                                <a href="{reject_url}" style="display: inline-block; margin: 10px; padding: 12px 24px; background-color: #F44336; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Reject Vendor</a>
                            </div>

                        </div>
                    </body>
                </html>
                """

                # Create documents directory path for the vendor
                # Create a safe version of vendor name to match how it's stored in the path
                safe_vendor_name = "".join(c for c in vendor_name if c.isalnum() or c in [' ', '_']).replace(' ', '_')
                vendor_docs_dir = os.path.join(settings.MEDIA_ROOT, 'vendor_documents', f"{vendor_id}_{safe_vendor_name}")
                print(f"Looking for vendor documents in: {vendor_docs_dir}")

                # Check if directory exists
                has_documents = os.path.exists(vendor_docs_dir) and os.path.isdir(vendor_docs_dir)

                # Send both emails
                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls()
                    server.login(self.sender_email, self.password)
                    
                    # Send to Purchaser
                    if purchaser_email:
                        msg_purchaser = MIMEMultipart('alternative')
                        msg_purchaser['From'] = self.sender_email
                        msg_purchaser['To'] = purchaser_email
                        msg_purchaser['Subject'] = purchaser_subject
                        msg_purchaser.attach(MIMEText(purchaser_html, 'html'))
                        
                        # Add any vendor documents as attachments for purchaser
                        if has_documents:
                            print(f"Found vendor document directory: {vendor_docs_dir}")
                            for filename in os.listdir(vendor_docs_dir):
                                file_path = os.path.join(vendor_docs_dir, filename)
                                if os.path.isfile(file_path):
                                    print(f"Attaching document: {filename}")
                                    # Determine content type based on file extension
                                    ext = os.path.splitext(filename)[1].lower()
                                    content_types = {
                                        '.pdf': 'application/pdf',
                                        '.jpg': 'image/jpeg',
                                        '.jpeg': 'image/jpeg',
                                        '.png': 'image/png',
                                        '.gif': 'image/gif',
                                        '.doc': 'application/msword',
                                        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                        '.xls': 'application/vnd.ms-excel',
                                        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                        '.txt': 'text/plain',
                                    }
                                    content_type = content_types.get(ext, 'application/octet-stream')
                                    
                                    # Read file and attach
                                    with open(file_path, 'rb') as f:
                                        attachment = MIMEText(f.read(), 'base64', 'utf-8')
                                        attachment.add_header('Content-Type', content_type)
                                        attachment.add_header('Content-Disposition', 'attachment', filename=filename)
                                        msg_purchaser.attach(attachment)
                        
                        server.sendmail(self.sender_email, purchaser_email, msg_purchaser.as_string())
                        print("Email sent to Purchaser successfully")
                    
                    # Send to Approver
                    if approver_email:
                        msg_approver = MIMEMultipart('alternative')
                        msg_approver['From'] = self.sender_email
                        msg_approver['To'] = approver_email
                        msg_approver['Subject'] = approver_subject
                        msg_approver.attach(MIMEText(approver_html, 'html'))
                        
                        # Add any vendor documents as attachments for approver
                        if has_documents:
                            for filename in os.listdir(vendor_docs_dir):
                                file_path = os.path.join(vendor_docs_dir, filename)
                                if os.path.isfile(file_path):
                                    # Determine content type based on file extension
                                    ext = os.path.splitext(filename)[1].lower()
                                    content_types = {
                                        '.pdf': 'application/pdf',
                                        '.jpg': 'image/jpeg',
                                        '.jpeg': 'image/jpeg',
                                        '.png': 'image/png',
                                        '.gif': 'image/gif',
                                        '.doc': 'application/msword',
                                        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                        '.xls': 'application/vnd.ms-excel',
                                        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                        '.txt': 'text/plain',
                                    }
                                    content_type = content_types.get(ext, 'application/octet-stream')
                                    
                                    # Read file and attach
                                    with open(file_path, 'rb') as f:
                                        attachment = MIMEText(f.read(), 'base64', 'utf-8')
                                        attachment.add_header('Content-Type', content_type)
                                        attachment.add_header('Content-Disposition', 'attachment', filename=filename)
                                        msg_approver.attach(attachment)
                        
                        server.sendmail(self.sender_email, approver_email, msg_approver.as_string())
                        print("Email sent to Approver successfully")

            except Exception as e:
                print(f"Error in send method: {str(e)}")
                logger.error(f"Error sending vendor creation email: {str(e)}")
                raise

        elif trigger == 'vendor_approve_dash':
            try:
                vendor_id = kwargs.get('vendor_id', 'N/A')
                vendor_name = kwargs.get('vendor_name', 'N/A')
                product_category = kwargs.get('product_category', 'N/A')
                contact_person = kwargs.get('contact_person', 'N/A')
                purchaser_email = kwargs.get('purchaser_email')
                accounts_email = kwargs.get('accounts_email')
                
                # Get vendor instance to check document status and get additional fields
                try:
                    vendor = Vendor.objects.get(vendor_id=vendor_id)
                    
                    # Get all vendor fields for a complete table
                    mobile_no_1 = vendor.mobile_no_1 if hasattr(vendor, 'mobile_no_1') else 'N/A'
                    mobile_no_2 = vendor.mobile_no_2 if hasattr(vendor, 'mobile_no_2') else 'N/A'
                    email_1 = vendor.email_1 if hasattr(vendor, 'email_1') else 'N/A'
                    email_2 = vendor.email_2 if hasattr(vendor, 'email_2') else 'N/A'
                    website = vendor.website if hasattr(vendor, 'website') else 'N/A'
                    address = vendor.address if hasattr(vendor, 'address') else 'N/A'
                    payment_term = vendor.payment_term if hasattr(vendor, 'payment_term') else 'N/A'
                    
                    # ADD THE 4 NEW FIELDS
                    gst_number = vendor.gst_number if hasattr(vendor, 'gst_number') else 'N/A'
                    pan_number = vendor.pan_number if hasattr(vendor, 'pan_number') else 'N/A'
                    state = vendor.state if hasattr(vendor, 'state') else 'N/A'
                    state_code = vendor.state_code if hasattr(vendor, 'state_code') else 'N/A'

                    # Prepare document status rows
                    document_status_rows = ""
                    valid_file_fields = [
                        ('pan_card', 'PAN Card'),
                        ('gst_certificate', 'GST Certificate'),
                        ('incorporation_certificate', 'Incorporation Certificate'),
                        ('cancelled_cheque', 'Cancelled Cheque'),
                        ('tan_allotment_letter', 'TAN Allotment Letter'),
                        ('udyam_certificate_msme', 'UDYAM Certificate (MSME)'),
                        ('vendor_reg_form', 'Vendor Registration Form')
                    ]
                    
                    for field_name, field_label in valid_file_fields:
                        file_obj = getattr(vendor, field_name, None)
                        status_text = '<span style="color: green;">✓ Uploaded</span>' if file_obj else '<span style="color: red;">✗ Not Uploaded</span>'
                        document_status_rows += f"""
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;"><strong>{field_label}:</strong></td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{status_text}</td>
                        </tr>
                        """
                except Vendor.DoesNotExist:
                    document_status_rows = "<tr><td colspan='2' style='padding: 10px; border: 1px solid #ddd;'>Vendor details not found</td></tr>"
                    mobile_no_1 = mobile_no_2 = email_1 = email_2 = website = address = payment_term = 'N/A'
                
                subject = f"Vendor Approved - {vendor_id}"
                
                # Create complete vendor details table
                vendor_details_table = f"""
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Vendor ID:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{vendor_id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Vendor Name:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{vendor_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Product Category:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{product_category}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Contact Person:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{contact_person}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Primary Mobile:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{mobile_no_1}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Secondary Mobile:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{mobile_no_2}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Primary Email:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{email_1}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Secondary Email:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{email_2}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Website:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{website}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Address:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{address}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Payment Terms:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payment_term}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>GST Number:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{gst_number}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>PAN Number:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{pan_number}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>State:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{state}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>State Code:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{state_code}</td>
                    </tr>
                    
                    <!-- Document Status Section -->
                    <tr>
                        <td colspan="2" style="padding: 10px; border: 1px solid #ddd; background-color: #f8f9fa;">
                            <strong>Document Upload Status</strong>
                        </td>
                    </tr>
                    {document_status_rows}
                </table>
                """

                html_body = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background-color: #4CAF50; color: white; padding: 15px; text-align: center; border-radius: 5px;">
                                <h2 style="margin: 0;">Vendor Approved</h2>
                            </div>
                            
                            <div style="margin-top: 20px;">
                                <p>A vendor has been successfully approved in the Purchase Module System.</p>
                                
                                {vendor_details_table}
                            </div>
                            

                        </div>
                    </body>
                </html>
                """
                
                msg = MIMEMultipart('alternative')
                msg['From'] = self.sender_email
                msg['To'] = purchaser_email
                msg['Subject'] = subject
                
                text_part = MIMEText(
                    f"Vendor Approved\n\n"
                    f"Vendor ID: {vendor_id}\n"
                    f"Vendor Name: {vendor_name}\n"
                    f"Product Category: {product_category}\n"
                    f"Contact Person: {contact_person}\n",
                    'plain'
                )
                html_part = MIMEText(html_body, 'html')
                
                msg.attach(text_part)
                msg.attach(html_part)
                
                print("Attempting SMTP connection...")
                try:
                    with smtplib.SMTP(self.smtp_server, self.port) as server:
                        print("SMTP connection established")
                        print("Starting TLS...")
                        server.starttls()
                        print("TLS started, attempting login...")
                        server.login(self.sender_email, self.password)
                        print("Login successful, sending email...")

                        # Create a safe version of vendor name to match how it's stored in the path
                        safe_vendor_name = "".join(c for c in vendor_name if c.isalnum() or c in [' ', '_']).replace(' ', '_')
                        vendor_docs_dir = os.path.join(settings.MEDIA_ROOT, 'vendor_documents', f"{vendor_id}_{safe_vendor_name}")
                        print(f"Looking for vendor documents in: {vendor_docs_dir}")

                        # Check if directory exists
                        has_documents = os.path.exists(vendor_docs_dir) and os.path.isdir(vendor_docs_dir)
                        
                        # Attach any vendor documents as attachments
                        if has_documents:
                            print(f"Found vendor document directory: {vendor_docs_dir}")
                            attachments = []
                            for filename in os.listdir(vendor_docs_dir):
                                file_path = os.path.join(vendor_docs_dir, filename)
                                if os.path.isfile(file_path):
                                    print(f"Attaching document: {filename}")
                                    # Determine content type based on file extension
                                    ext = os.path.splitext(filename)[1].lower()
                                    content_types = {
                                        '.pdf': 'application/pdf',
                                        '.jpg': 'image/jpeg',
                                        '.jpeg': 'image/jpeg',
                                        '.png': 'image/png',
                                        '.gif': 'image/gif',
                                        '.doc': 'application/msword',
                                        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                        '.xls': 'application/vnd.ms-excel',
                                        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                        '.txt': 'text/plain',
                                    }
                                    content_type = content_types.get(ext, 'application/octet-stream')
                                    
                                    # Read file and create attachment
                                    with open(file_path, 'rb') as f:
                                        file_content = f.read()
                                        attachment = MIMEText(file_content, 'base64', 'utf-8')
                                        attachment.add_header('Content-Type', content_type)
                                        attachment.add_header('Content-Disposition', 'attachment', filename=filename)
                                        # Add to msg and save for accounts email
                                        msg.attach(attachment)
                                        attachments.append((filename, file_content, content_type))

                        # Send to purchaser
                        server.sendmail(self.sender_email, purchaser_email, msg.as_string())
                        print("Email sent to Purchaser successfully")
                        
                        # If accounts email exists, send there too
                        if accounts_email:
                            # Create a new message for accounts with a different template
                            accounts_subject = f"New Vendor Registered - {vendor_id}"
                            
                            # Create accounts-specific HTML body
                            accounts_html_body = f"""
                            <html>
                                <body style="font-family: Arial, sans-serif; color: #333;">
                                    <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                                        <div style="background-color: #2196F3; color: white; padding: 15px; text-align: center; border-radius: 5px;">
                                            <h2 style="margin: 0;">New Vendor Registered</h2>
                                        </div>
                                        
                                        <div style="margin-top: 20px;">
                                            <p>Dear Accounts team,</p>
                                            <p>A new vendor has been registered.</p>
                                            
                                            {vendor_details_table}
                                        </div>
                                        
                                    </div>
                                </body>
                            </html>
                            """
                            
                            accounts_text_part = MIMEText(
                                f"New Vendor Registered\n\n"
                                f"Dear Accounts team,\n"
                                f"A new vendor has been registered with the following details:\n\n"
                                f"Vendor ID: {vendor_id}\n"
                                f"Vendor Name: {vendor_name}\n"
                                f"Product Category: {product_category}\n"
                                f"Contact Person: {contact_person}\n",
                                'plain'
                            )
                            accounts_html_part = MIMEText(accounts_html_body, 'html')
                            
                            # Create a new message for accounts
                            accounts_msg = MIMEMultipart('alternative')
                            accounts_msg['From'] = self.sender_email
                            accounts_msg['To'] = accounts_email
                            accounts_msg['Subject'] = accounts_subject
                            
                            # Add text and HTML parts
                            accounts_msg.attach(accounts_text_part)
                            accounts_msg.attach(accounts_html_part)
                            
                            # Add attachments
                            if has_documents:
                                for filename, content, content_type in attachments:
                                    attachment = MIMEText(content, 'base64', 'utf-8')
                                    attachment.add_header('Content-Type', content_type)
                                    attachment.add_header('Content-Disposition', 'attachment', filename=filename)
                                    accounts_msg.attach(attachment)
                                    
                            # Send to accounts
                            server.sendmail(self.sender_email, accounts_email, accounts_msg.as_string())
                            print("Email sent to Accounts successfully")

                except smtplib.SMTPAuthenticationError as auth_error:
                    print(f"SMTP Authentication Error: {str(auth_error)}")
                    logger.error(f"SMTP Authentication failed: {str(auth_error)}")
                    raise
                except smtplib.SMTPException as smtp_error:
                    print(f"SMTP Error: {str(smtp_error)}")
                    logger.error(f"SMTP Error occurred: {str(smtp_error)}")
                    raise
                except Exception as e:
                    print(f"Unexpected error during SMTP operation: {str(e)}")
                    logger.error(f"Unexpected error during SMTP operation: {str(e)}")
                    raise
                    
            except Exception as e:
                print(f"Error in vendor_approve_dash: {str(e)}")
                logger.error(f"Error sending vendor approval email: {str(e)}")
                raise
                
        elif trigger == 'vendor_reject_dash':
            try:
                vendor_id = kwargs.get('vendor_id', 'N/A')
                vendor_name = kwargs.get('vendor_name', 'N/A')
                product_category = kwargs.get('product_category', 'N/A')
                contact_person = kwargs.get('contact_person', 'N/A')
                remarks = kwargs.get('remarks', 'No remarks provided')
                purchaser_email = kwargs.get('purchaser_email')

                # Get vendor instance to check document status and get additional fields
                try:
                    vendor = Vendor.objects.get(vendor_id=vendor_id)
                    
                    # Get all vendor fields for a complete table
                    mobile_no_1 = vendor.mobile_no_1 if hasattr(vendor, 'mobile_no_1') else 'N/A'
                    mobile_no_2 = vendor.mobile_no_2 if hasattr(vendor, 'mobile_no_2') else 'N/A'
                    email_1 = vendor.email_1 if hasattr(vendor, 'email_1') else 'N/A'
                    email_2 = vendor.email_2 if hasattr(vendor, 'email_2') else 'N/A'
                    website = vendor.website if hasattr(vendor, 'website') else 'N/A'
                    address = vendor.address if hasattr(vendor, 'address') else 'N/A'
                    payment_term = vendor.payment_term if hasattr(vendor, 'payment_term') else 'N/A'
                    
                    # ADD THE 4 NEW FIELDS
                    gst_number = vendor.gst_number if hasattr(vendor, 'gst_number') else 'N/A'
                    pan_number = vendor.pan_number if hasattr(vendor, 'pan_number') else 'N/A'
                    state = vendor.state if hasattr(vendor, 'state') else 'N/A'
                    state_code = vendor.state_code if hasattr(vendor, 'state_code') else 'N/A'

                    # Prepare document status rows
                    document_status_rows = ""
                    valid_file_fields = [
                        ('pan_card', 'PAN Card'),
                        ('gst_certificate', 'GST Certificate'),
                        ('incorporation_certificate', 'Incorporation Certificate'),
                        ('cancelled_cheque', 'Cancelled Cheque'),
                        ('tan_allotment_letter', 'TAN Allotment Letter'),
                        ('udyam_certificate_msme', 'UDYAM Certificate (MSME)'),
                        ('vendor_reg_form', 'Vendor Registration Form')
                    ]
                    
                    for field_name, field_label in valid_file_fields:
                        file_obj = getattr(vendor, field_name, None)
                        status_text = '<span style="color: green;">✓ Uploaded</span>' if file_obj else '<span style="color: red;">✗ Not Uploaded</span>'
                        document_status_rows += f"""
                        <tr>
                            <td style="padding: 10px; border: 1px solid #ddd;"><strong>{field_label}:</strong></td>
                            <td style="padding: 10px; border: 1px solid #ddd;">{status_text}</td>
                        </tr>
                        """
                except Vendor.DoesNotExist:
                    document_status_rows = "<tr><td colspan='2' style='padding: 10px; border: 1px solid #ddd;'>Vendor details not found</td></tr>"
                    mobile_no_1 = mobile_no_2 = email_1 = email_2 = website = address = payment_term = 'N/A'
                
                subject = f"Vendor Rejected - {vendor_id}"
                
                # Create complete vendor details table
                vendor_details_table = f"""
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Vendor ID:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{vendor_id}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Vendor Name:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{vendor_name}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Product Category:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{product_category}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Contact Person:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{contact_person}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Primary Mobile:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{mobile_no_1}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Secondary Mobile:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{mobile_no_2}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Primary Email:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{email_1}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Secondary Email:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{email_2}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Website:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{website}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Address:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{address}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Payment Terms:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{payment_term}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>GST Number:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{gst_number}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>PAN Number:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{pan_number}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>State:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{state}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>State Code:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{state_code}</td>
                    </tr>
                    <tr>
                        <td style="padding: 10px; border: 1px solid #ddd;"><strong>Rejection Remarks:</strong></td>
                        <td style="padding: 10px; border: 1px solid #ddd;">{remarks}</td>
                    </tr>
                    
                    <!-- Document Status Section -->
                    <tr>
                        <td colspan="2" style="padding: 10px; border: 1px solid #ddd; background-color: #f8f9fa;">
                            <strong>Document Upload Status</strong>
                        </td>
                    </tr>
                    {document_status_rows}
                </table>
                """
                
                html_body = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <div style="background-color: #F44336; color: white; padding: 15px; text-align: center; border-radius: 5px;">
                                <h2 style="margin: 0;">Vendor Rejected</h2>
                            </div>
                            
                            <div style="margin-top: 20px;">
                                <p>The vendor you submitted has been rejected. Please visit our portal to make the desired changes.</p>
                                
                                {vendor_details_table}
                            </div>
                            
                            
                        </div>
                    </body>
                </html>
                """
                
                msg = MIMEMultipart('alternative')
                msg['From'] = self.sender_email
                msg['To'] = purchaser_email
                msg['Subject'] = subject
                
                text_part = MIMEText(
                    f"Vendor Rejected\n\n"
                    f"Vendor ID: {vendor_id}\n"
                    f"Vendor Name: {vendor_name}\n"
                    f"Product Category: {product_category}\n"
                    f"Contact Person: {contact_person}\n"
                    f"Rejection Remarks: {remarks}\n",
                    'plain'
                )
                html_part = MIMEText(html_body, 'html')
                
                msg.attach(text_part)
                msg.attach(html_part)
                
                print("Attempting SMTP connection...")
                try:
                    with smtplib.SMTP(self.smtp_server, self.port) as server:
                        print("SMTP connection established")
                        print("Starting TLS...")
                        server.starttls()
                        print("TLS started, attempting login...")
                        server.login(self.sender_email, self.password)
                        print("Login successful, sending email...")

                        # Create a safe version of vendor name to match how it's stored in the path
                        safe_vendor_name = "".join(c for c in vendor_name if c.isalnum() or c in [' ', '_']).replace(' ', '_')
                        vendor_docs_dir = os.path.join(settings.MEDIA_ROOT, 'vendor_documents', f"{vendor_id}_{safe_vendor_name}")
                        print(f"Looking for vendor documents in: {vendor_docs_dir}")

                        # Check if directory exists
                        has_documents = os.path.exists(vendor_docs_dir) and os.path.isdir(vendor_docs_dir)
                        
                        # Attach any vendor documents as attachments
                        if has_documents:
                            print(f"Found vendor document directory: {vendor_docs_dir}")
                            for filename in os.listdir(vendor_docs_dir):
                                file_path = os.path.join(vendor_docs_dir, filename)
                                if os.path.isfile(file_path):
                                    print(f"Attaching document: {filename}")
                                    # Determine content type based on file extension
                                    ext = os.path.splitext(filename)[1].lower()
                                    content_types = {
                                        '.pdf': 'application/pdf',
                                        '.jpg': 'image/jpeg',
                                        '.jpeg': 'image/jpeg',
                                        '.png': 'image/png',
                                        '.gif': 'image/gif',
                                        '.doc': 'application/msword',
                                        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                                        '.xls': 'application/vnd.ms-excel',
                                        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                                        '.txt': 'text/plain',
                                    }
                                    content_type = content_types.get(ext, 'application/octet-stream')
                                    
                                    # Read file and attach
                                    with open(file_path, 'rb') as f:
                                        attachment = MIMEText(f.read(), 'base64', 'utf-8')
                                        attachment.add_header('Content-Type', content_type)
                                        attachment.add_header('Content-Disposition', 'attachment', filename=filename)
                                        msg.attach(attachment)

                        server.sendmail(self.sender_email, purchaser_email, msg.as_string())
                        print("Email sent successfully")
                except smtplib.SMTPAuthenticationError as auth_error:
                    print(f"SMTP Authentication Error: {str(auth_error)}")
                    logger.error(f"SMTP Authentication failed: {str(auth_error)}")
                    raise
                except smtplib.SMTPException as smtp_error:
                    print(f"SMTP Error: {str(smtp_error)}")
                    logger.error(f"SMTP Error occurred: {str(smtp_error)}")
                    raise
                except Exception as e:
                    print(f"Unexpected error during SMTP operation: {str(e)}")
                    logger.error(f"Unexpected error during SMTP operation: {str(e)}")
                    raise
                
            except Exception as e:
                print(f"Error in vendor_reject_dash: {str(e)}")
                logger.error(f"Error sending vendor rejection email: {str(e)}")
                raise





