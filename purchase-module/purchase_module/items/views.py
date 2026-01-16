from django.shortcuts import render
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from .models import MainCategory, ProductRating, SubCategory, Make, ProductModel, Remarks, ItemMaster, ItemRequest
from factory.models import FactoryItemMaster
from .serializers import (
    MainCategorySerializer, ProductRatingSerializer, SubCategorySerializer, MakeSerializer,
    ProductModelSerializer, RemarksSerializer, ItemMasterSerializer, ItemRequestSerializer
)
import re
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import smtplib
import logging
from users.models import CustomUser
from django.http import HttpResponse, FileResponse
import requests
from django.middleware.csrf import get_token
import json
from django.conf import settings
from rest_framework.parsers import MultiPartParser, FormParser
import os
from django.template.loader import render_to_string
from django.conf import settings
import threading
from django.core.cache import cache
from django.db import transaction
from django.core.paginator import Paginator
from django.db import models


logger = logging.getLogger(__name__)

@api_view(['GET'])
def get_options(request):
    """
    Fetch all options for dropdowns with caching
    """
    cache_key = 'item_dropdown_options'
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return Response(cached_data)
    
    categories = MainCategorySerializer(MainCategory.objects.all().order_by('name'), many=True).data
    
    data = {
        "categories": categories,
    }
    
    # Cache for 30 minutes
    cache.set(cache_key, data, 1800)
    return Response(data)

@api_view(['GET'])
def get_related_options(request):
    """
    Fetch options related to a specific main category with optimized queries
    """
    main_category_id = request.GET.get('main_category_id')
    if not main_category_id:
        return Response({"error": "Main category ID is required"}, status=status.HTTP_400_BAD_REQUEST)
    
    cache_key = f'related_options_{main_category_id}'
    cached_data = cache.get(cache_key)
    
    if cached_data:
        return Response(cached_data)
    
    # Use select_related to optimize queries
    makes = MakeSerializer(
        Make.objects.filter(main_category_id=main_category_id)
        .select_related('main_category')
        .order_by('name'), 
        many=True
    ).data
    
    types = SubCategorySerializer(
        SubCategory.objects.filter(main_category_id=main_category_id)
        .select_related('main_category')
        .order_by('name'), 
        many=True
    ).data
    
    ratings = ProductRatingSerializer(
        ProductRating.objects.filter(main_category_id=main_category_id)
        .select_related('main_category', 'sub_category')
        .order_by('name'), 
        many=True
    ).data
    
    data = {
        "makes": makes,
        "types": types,
        "ratings": ratings
    }
    
    # Cache for 15 minutes
    cache.set(cache_key, data, 900)
    return Response(data)

@api_view(['GET'])
def get_subcategories(request, main_category_id):
    """
    Fetch subcategories based on the selected main category.
    """
    subcategories = SubCategorySerializer(SubCategory.objects.filter(main_category_id=main_category_id), many=True).data
    return Response(subcategories)

def generate_name_based_code(name, category_type):
    """
    Generate code based on name according to specified rules
    """
    if not name:
        return ""
        
    words = name.strip().upper().split()
    
    if category_type == 'productName' or category_type == 'main_category':
        # Product Name (3 characters)
        if len(words) == 1:
            # One word: first three letters
            return words[0][:3]
        elif len(words) == 2:
            # Two words: first two letters of first word + initial of second word
            return f"{words[0][:2]}{words[1][0]}"
        elif len(words) == 3:
            # Three words: initials of all three words
            return f"{words[0][0]}{words[1][0]}{words[2][0]}"
        elif len(words) >= 4:
            # Four or more words: initials of first three words
            return f"{words[0][0]}{words[1][0]}{words[2][0]}"
    
    elif category_type == 'make':
        # Make (2 characters)
        if len(words) == 1:
            # One word: first two letters
            return words[0][:2]
        elif len(words) >= 2:
            # Two or more words: initials of first two words
            return f"{words[0][0]}{words[1][0]}"
    
    return ""

def generate_next_numeric_code(existing_codes, width):
    """
    Generate next available numeric code with zero-padding (default 4 digits)
    """
    if not existing_codes:
        return f"{1:0{width}d}"
    
    numeric_codes = []
    for code in existing_codes:
        try:
            # Convert code to string first to handle different types
            code_str = str(code).strip()
            # Only extract codes that are purely numeric
            if code_str and code_str.isdigit():
                numeric_codes.append(int(code_str))
        except (ValueError, TypeError, AttributeError):
            pass
    
    # Debug logging to see what's happening
    print(f"Existing codes: {existing_codes}")
    print(f"Filtered numeric codes: {numeric_codes}")
    
    if numeric_codes:
        next_num = max(numeric_codes) + 1
    else:
        next_num = 1
        
    return f"{next_num:0{width}d}"
    
def generate_next_alpha_code(existing_codes):
    """
    Generate next available alphabetic code (AB format)
    """
    if not existing_codes:
        return "AA"
    
    # Filter only valid 2-character alphabetic codes
    alpha_codes = [code for code in existing_codes if code and len(code) == 2 and code.isalpha() and code.isupper()]
    
    if not alpha_codes:
        return "AA"
    
    last_code = max(alpha_codes)
    if last_code[1] < 'Z':
        return f"{last_code[0]}{chr(ord(last_code[1]) + 1)}"
    else:
        if last_code[0] < 'Z':
            return f"{chr(ord(last_code[0]) + 1)}A"
        else:
            return "AA"  # Wrap around if we've used all possibilities

@api_view(['POST'])
def generate_code(request):
    """
    Generate code based on type and name
    """
    data = request.data
    category_type = data.get('type')
    name = data.get('name')
    main_category_id = data.get('main_category_id')
    
    if not category_type or not name:
        return Response({"error": "Type and name are required"}, status=status.HTTP_400_BAD_REQUEST)
    
    # Handle name-based code generation for productName and make
    if category_type in ['productName', 'main_category', 'make']:
        code = generate_name_based_code(name, category_type)
        if not code:
            return Response({"error": f"Invalid {category_type} name format"}, status=status.HTTP_400_BAD_REQUEST)
        
    # Handle mfg_part or product_model - both should work the same way 
    elif category_type in ['mfg_part', 'product_model']:
        if not main_category_id:
            return Response({"error": "Main category ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get ALL existing ProductModel codes for this main_category
        existing_codes = ProductModel.objects.filter(
            main_category_id=main_category_id
        ).values_list('code', flat=True)
        
        # Convert to list for easier debugging
        existing_codes_list = list(existing_codes)
        print(f"Existing product model codes: {existing_codes_list}")
        
        # Generate next numeric code (3 digits for mfg/product_model)
        code = generate_next_numeric_code(existing_codes_list, width=3)
        print(f"Generated new product model code: {code}")

    # Handle description or remarks - both should work the same way
    elif category_type in ['description', 'remarks']:
        if not main_category_id:
            return Response({"error": "Main category ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get ALL existing Remarks codes for this main_category
        existing_codes = Remarks.objects.filter(
            main_category_id=main_category_id
        ).values_list('code', flat=True)
        
        # Convert to list for easier debugging
        existing_codes_list = list(existing_codes)
        print(f"Existing remarks codes: {existing_codes_list}")
        
        # Generate next numeric code
        code = generate_next_numeric_code(existing_codes_list, width=4)
        print(f"Generated new remarks code: {code}")


    
    elif category_type in ['type', 'sub_category']:
        # Get existing type codes for this main category
        if not main_category_id:
            return Response({"error": "Main category ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        existing_codes = SubCategory.objects.filter(main_category_id=main_category_id).values_list('code', flat=True)
        code = generate_next_alpha_code(existing_codes)
    
    elif category_type in ['rating', 'product_rating']:
        if not main_category_id:
            return Response({"error": "Main category ID is required"}, status=status.HTTP_400_BAD_REQUEST)
        existing_codes = ProductRating.objects.filter(main_category_id=main_category_id).values_list('code', flat=True)
        code = generate_next_numeric_code(existing_codes,width=3)
    
    else:
        return Response({"error": f"Invalid category type: {category_type}"}, status=status.HTTP_400_BAD_REQUEST)
    
    return Response({"code": code, "name": name})

@api_view(['POST'])
def create_item(request):
    """Create a new item with all details"""
    try:
        data = request.data
        
        # Basic validation
        required_fields = ['name', 'description', 'main_category', 'cimcon_part_no', 'mfg_part_no']
        
        missing = [field for field in required_fields if not data.get(field)]
        if missing:
            return Response({"error": f"Missing required fields: {', '.join(missing)}"}, 
                        status=status.HTTP_400_BAD_REQUEST)
        
        cimcon_part_no = data['cimcon_part_no']
        main_category_id = data['main_category']
        
        # 1. Create or get ProductModel for mfg_part_no if needed
        if not data.get('product_model') and 'mfg_part_no' in data and len(cimcon_part_no) >= 9:
            # Extract the model code (positions 5-7 in format NEIAATR001001001)
            model_code = cimcon_part_no[5:8]
            
            # Create or get the product model
            product_model, created = ProductModel.objects.get_or_create(
                code=model_code,
                main_category_id=main_category_id,
                defaults={'name': data['mfg_part_no']}
            )
            
            # Update data with the product_model_id
            data['product_model'] = product_model.id
            
            if created:
                print(f"Created new ProductModel: {model_code} for mfg_part_no: {data['mfg_part_no']}")
        
        # 2. Create or get Remarks for item description if needed
        if not data.get('remarks') and 'description' in data and len(cimcon_part_no) >= 12:
            # Extract the remarks code (positions 8-10 in format NEIAATR001001001)
            remarks_code = cimcon_part_no[8:11]
            
            # Create or get the remarks
            remarks, created = Remarks.objects.get_or_create(
                code=remarks_code,
                main_category_id=main_category_id,
                defaults={'description': data['description']}
            )
            
            # Update data with the remarks_id
            data['remarks'] = remarks.id
            
            if created:
                print(f"Created new Remarks: {remarks_code} for description: {data['description']}")
        
        # Create the item with all foreign key references
        item = ItemMaster.objects.create(
            name=data['name'],
            description=data['description'],
            main_category_id=data['main_category'],
            sub_category_id=data.get('sub_category'),
            make_id=data.get('make'),
            product_rating_id=data.get('product_rating'),
            product_model_id=data.get('product_model'),  # Now populated
            remarks_id=data.get('remarks'),  # Now populated
            cimcon_part_no=data['cimcon_part_no'],
            mfg_part_no=data['mfg_part_no'],
            package=data.get('package', ''),
            uom=data.get('uom', ''),
            moq=data.get('moq') or 0,
            mfg_std_lead_time=data.get('mfg_std_lead_time') or 0,
            bin=data.get('bin', ''),
            hsn_code=data.get('hsn_code', '')
        )
        
        return Response({
            "success": True,
            "message": "Item created successfully",
            "item_id": item.id,
            "cimcon_part_no": item.cimcon_part_no
        })
        
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def create_parameter(request):
    """
    Create a new parameter (product, make, type, or rating)
    """
    try:
        data = request.data
        param_type = data.get('type')
        name = data.get('name')
        code = data.get('code')
        main_category_id = data.get('main_category_id')
        
        if not param_type or not name or not code:
            return Response({"error": "Parameter type, name, and code are required"}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Create different parameter types
        if param_type == 'productName' or param_type == 'main_category':
            # Need to generate an ID for main category since it's not auto-incrementing
            # Get the highest existing ID and add 1
            highest_id = MainCategory.objects.all().order_by('-id').values_list('id', flat=True).first()
            new_id = 1 if highest_id is None else highest_id + 1
            
            # Create main category with explicit ID
            obj = MainCategory.objects.create(
                id=new_id,  # Set the ID explicitly
                name=name,
                code=code
            )
        
        elif param_type == 'make':
            if not main_category_id:
                return Response({"error": "Main category ID is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            # Create make
            obj = Make.objects.create(
                name=name,
                code=code,
                main_category_id=main_category_id
            )
        
        elif param_type == 'type' or param_type == 'sub_category':
            if not main_category_id:
                return Response({"error": "Main category ID is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            # Create type (subcategory)
            obj = SubCategory.objects.create(
                name=name,
                code=code,
                main_category_id=main_category_id
            )
        
        elif param_type == 'rating' or param_type == 'product_rating':
            if not main_category_id:
                return Response({"error": "Main category ID is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            # Create rating
            obj = ProductRating.objects.create(
                name=name,
                code=code,
                main_category_id=main_category_id
            )
            
        elif param_type == 'mfg_part' or param_type == 'product_model':
            if not main_category_id:
                return Response({"error": "Main category ID is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            # Create product model
            obj = ProductModel.objects.create(
                name=name,
                code=code,
                main_category_id=main_category_id
            )
            
        elif param_type == 'description' or param_type == 'remarks':
            if not main_category_id:
                return Response({"error": "Main category ID is required"}, status=status.HTTP_400_BAD_REQUEST)
                
            # Create remarks
            obj = Remarks.objects.create(
                description=name,
                code=code,
                main_category_id=main_category_id
            )
        
        else:
            return Response({"error": f"Invalid parameter type: {param_type}"}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Return a response with the correct field for each type
        if param_type == 'description' or param_type == 'remarks':
            return Response({
                "id": obj.id,
                "name": obj.description,  # Use description field for remarks
                "code": obj.code
            })
        else:
            return Response({
                "id": obj.id,
                "name": obj.name,
                "code": obj.code
            })
        
    except Exception as e:
        import traceback
        print(f"Error creating parameter: {str(e)}")
        print(traceback.format_exc())
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def check_or_create_item(request):
    """
    Check if an item exists or create a new item.
    """
    data = request.data
    item_code = (
        f"{data['main_category']}{data['sub_category']}{data['make']}{data['product_model']}{data.get('remarks', '0000')}"
    )

    # Check for existing item
    existing_item = ItemMaster.objects.filter(item_code=item_code).first()
    if existing_item:
        return Response({
            "exists": True,
            "item": ItemMasterSerializer(existing_item).data,
        })

    # Create a new item
    serializer = ItemMasterSerializer(data=data)
    if serializer.is_valid():
        serializer.save()
        return Response({
            "exists": False,
            "item": serializer.data,
        }, status=status.HTTP_201_CREATED)

    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

@api_view(['GET'])
def get_item_master_data(request):
    try:
        main_category_id = request.GET.get('main_category')
        search_term = request.GET.get('search')

        # Fetch purchase items
        purchase_items_qs = ItemMaster.objects.select_related(
            'main_category', 'sub_category', 'make',
            'product_model', 'product_rating', 'remarks'
        ).order_by('cimcon_part_no')

        if main_category_id:
            purchase_items_qs = purchase_items_qs.filter(main_category_id=main_category_id)
        if search_term:
            purchase_items_qs = purchase_items_qs.filter(
                models.Q(name__icontains=search_term) |
                models.Q(cimcon_part_no__icontains=search_term) |
                models.Q(description__icontains=search_term)
            )

        # Fetch factory items using Django ORM
        factory_items_qs = FactoryItemMaster.objects.all().order_by('full_part_number')
        
        # Filter by main_category if provided (match by product_name)
        if main_category_id:
            try:
                main_category = MainCategory.objects.get(id=main_category_id)
                # For factory items, product_name might correspond to main_category name
                # This is a flexible match - adjust if needed based on your business logic
                factory_items_qs = factory_items_qs.filter(product_name__icontains=main_category.name)
            except MainCategory.DoesNotExist:
                pass  # Handle case where main_category_id is invalid
        
        # Filter by search_term if provided
        if search_term:
            factory_items_qs = factory_items_qs.filter(
                models.Q(product_name__icontains=search_term) |
                models.Q(full_part_number__icontains=search_term) |
                models.Q(item_description__icontains=search_term) |
                models.Q(mpn_full__icontains=search_term) |
                models.Q(make_name__icontains=search_term)
            )

        # Transform purchase items directly from queryset (more efficient than serializing first)
        purchase_items_transformed = []
        for item_obj in purchase_items_qs:
            # Build transformed item from model instance
            transformed_item = {
                'id': item_obj.id,
                'name': item_obj.name,
                'description': item_obj.description,
                'cimcon_part_no': item_obj.cimcon_part_no,
                'alternate_no': item_obj.alternate_no,
                'mfg_part_no': item_obj.mfg_part_no,
                'main_category': item_obj.main_category_id,  # Keep as ID for consistency
                'sub_category': item_obj.sub_category_id if item_obj.sub_category else None,
                'make': item_obj.make.name if item_obj.make else '',  # Convert to string
                'product_model': item_obj.product_model_id if item_obj.product_model else None,
                'product_rating': item_obj.product_rating.name if item_obj.product_rating else '',  # Convert to string
                'remarks': item_obj.remarks_id if item_obj.remarks else None,
                'package': item_obj.package or '',
                'uom': item_obj.uom or '',
                'moq': item_obj.moq or 0,
                'mfg_std_lead_time': item_obj.mfg_std_lead_time or 0,
                'bin': item_obj.bin or '',
                'hsn_code': item_obj.hsn_code or '',
                'created_at': item_obj.created_at.isoformat() if item_obj.created_at else None,
                'updated_at': item_obj.updated_at.isoformat() if item_obj.updated_at else None,
                'is_active': item_obj.is_active,
                'item_image': item_obj.item_image.url if item_obj.item_image else None,
                'document': item_obj.document.url if item_obj.document else None,
                'document_name': item_obj.document_name or None,
                'source': 'purchase'  # Add source identifier
            }
            purchase_items_transformed.append(transformed_item)
        
        # Transform factory items from Django model objects
        factory_items_transformed = []
        for item in factory_items_qs:
            # Extract codes from full_part_number format: Product(3) + Make(2) + MPN(3) + Rating(5) + Package(2)
            # Format: [0:3] = product_code, [3:5] = make_code, [5:8] = mpn_code, [8:13] = rating_code, [13:15] = package_code
            product_code = item.full_part_number[:3] if len(item.full_part_number) >= 3 else ''
            make_code = item.full_part_number[3:5] if len(item.full_part_number) >= 5 else ''
            material_rating_code = item.full_part_number[8:13] if len(item.full_part_number) >= 13 else ''
            
            transformed_item = {
                'id': item.item_id,
                'name': item.product_name,
                'description': item.item_description,
                'cimcon_part_no': item.full_part_number,
                'alternate_no': None,
                'mfg_part_no': item.mpn_full,
                'main_category': None,  # Will be serialized as integer ID by serializer if needed
                'sub_category': None,
                'make': item.make_name,  # String, not object - matches frontend expectation
                'product_model': None,
                'product_rating': item.material_rating or '',  # String, not object - matches frontend expectation
                'remarks': None,
                'package': item.package_type or '',
                'uom': item.uom or '',
                'moq': item.moq or 0,
                'mfg_std_lead_time': item.lead_time or 0,
                'bin': item.bin_location or '',
                'hsn_code': item.hsn_code or '',
                'created_at': item.created_at.isoformat() if item.created_at else None,
                'updated_at': None,
                'is_active': True,
                'item_image': None,
                'document': None,
                'document_name': None,
                'source': 'factory'  # Add source identifier
            }
            factory_items_transformed.append(transformed_item)

        # Combine and sort items
        all_items = sorted(
            purchase_items_transformed + factory_items_transformed,
            key=lambda x: x.get('created_at', '') or '',
            reverse=True
        )

        # Optional pagination
        if request.GET.get('paginate') == 'true':
            page_size = int(request.GET.get('page_size', 50))
            page_number = int(request.GET.get('page', 1))

            paginator = Paginator(all_items, page_size)
            page_obj = paginator.get_page(page_number)

            return Response({
                'results': list(page_obj),
                'count': paginator.count,
                'page': page_number,
                'page_size': page_size,
                'total_pages': paginator.num_pages
            })
        else:
            return Response(all_items)

    except Exception as e:
        print(f"Error fetching item master data: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def generate_item_code(request):
    """Generate a unique item code based on material group, type, and make"""
    try:
        material_group = request.data.get('material_group')
        type_code = request.data.get('type')
        make = request.data.get('make')
        product_model = request.data.get('product_model')  # New parameter
        remarks = request.data.get('remarks', '0000')  # New parameter with default
        description = request.data.get('description', '')  # New parameter


        if not all([material_group, type_code, make]):
            return Response({
                'error': 'Missing required fields'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Get the prefix components
        try:
            material_group_obj = MainCategory.objects.get(id=material_group)
            type_obj = SubCategory.objects.get(id=type_code)
            make_obj = Make.objects.get(id=make)
            product_model_obj = ProductModel.objects.get(id=product_model)  # Fetch product model
            remarks_obj = Remarks.objects.get(description=remarks)  # Fetch remarks
        except (MainCategory.DoesNotExist, SubCategory.DoesNotExist, Make.DoesNotExist, ProductModel.DoesNotExist, Remarks.DoesNotExist) as e:
            return Response({
                'error': f'Invalid reference: {str(e)}'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Format: MGTYMMRRMXXXX
        # MG = Material Group Code (2 chars)
        # TY = Type Code (2 chars)
        # MM = Make Code (2 chars)
        # RR = Product Model Code (2 chars)
        # M = Remarks Code (2 chars)
        # XXXX = Sequential number (4 digits)
        prefix = f"{material_group_obj.code}{type_obj.code}{make_obj.code}{product_model_obj.code}{remarks_obj.code}"

        # Check if an item with similar codes exists
        existing_items = ItemMaster.objects.filter(
            main_category=material_group_obj,
            sub_category=type_obj,
            make=make_obj,
            product_model=product_model_obj,
            remarks=remarks_obj
        )

        if existing_items.exists():
            return Response({
                'exists': True,
                'items': [{
                    'item_code': item.cimcon_part_no,
                    'name': item.name,
                    'description': item.description,
                    'material_group': item.main_category.name,
                    'type': item.sub_category.name,
                    'make': item.make.name,
                    'product_model': item.product_model.name,
                    'remarks': item.remarks.description,
                } for item in existing_items]
            }, status=status.HTTP_200_OK)

        # Find the last sequential number for this prefix
        last_item = ItemMaster.objects.filter(
            cimcon_part_no__startswith=prefix
        ).order_by('-cimcon_part_no').first()

        if last_item:
            try:
                # Extract the number from the last item code
                last_number = int(last_item.cimcon_part_no[-4:])
                new_number = last_number + 1
            except (ValueError, IndexError):
                new_number = 1
        else:
            new_number = 1

        # Generate new item code without hyphens
        new_item_code = f"{prefix}{new_number:04d}"

        return Response({
            'exists': False,
            'item_code': new_item_code,
            'material_group': material_group_obj.name,
            'type': type_obj.name,
            'make': make_obj.name,
            'product_model': product_model_obj.name,
            'remarks': remarks_obj.description,
            'description': description
        }, status=status.HTTP_200_OK)

    except Exception as e:
        return Response({
            'error': f'Failed to generate item code: {str(e)}'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET', 'POST'])
def create_product_rating(request):
    """Create or get product ratings"""
    if request.method == 'GET':
        # Handle GET request
        main_category_id = request.GET.get('main_category')
        if main_category_id:
            ratings = ProductRating.objects.filter(main_category_id=main_category_id)
        else:
            ratings = ProductRating.objects.all()
        serializer = ProductRatingSerializer(ratings, many=True)
        return Response(serializer.data)
        
    elif request.method == 'POST':
        try:
            data = request.data
            
            # Validate code length (3 characters for rating code - updated)
            code = data.get('code', '').strip()
            if len(code) != 3:
                return Response({
                    'error': 'Rating Code must be exactly 3 characters'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate required fields
            name = data.get('name', '').strip()
            main_category_id = data.get('main_category')
            
            if not code or not name:
                return Response({
                    'error': 'Both code and name are required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # If main_category is not provided, return specific error
            if not main_category_id:
                return Response({
                    'error': 'Material group (main_category) is required'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Validate main_category exists
            try:
                main_category = MainCategory.objects.get(id=main_category_id)
            except MainCategory.DoesNotExist:
                return Response({
                    'error': f'Material group with id {main_category_id} does not exist'
                }, status=status.HTTP_400_BAD_REQUEST)
            except ValueError:
                return Response({
                    'error': 'Invalid material group id format'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Check if rating with same code already exists for this main category
            if ProductRating.objects.filter(
                code=code.upper(),
                main_category=main_category
            ).exists():
                return Response({
                    'error': 'Rating with this code already exists for this material group'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Create new rating
            new_rating = ProductRating.objects.create(
                code=code.upper(),
                name=name,
                main_category_id=main_category_id
            )

            # Use serializer for response
            serializer = ProductRatingSerializer(new_rating)
            return Response(serializer.data, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_product_ratings(request):
    """Get product ratings filtered by main category"""
    try:
        main_category_id = request.GET.get('main_category')
        
        if main_category_id:
            # Filter ratings by main category
            ratings = ProductRating.objects.filter(main_category_id=main_category_id)
        else:
            # Return empty list if no main category selected
            ratings = ProductRating.objects.none()
            
        serializer = ProductRatingSerializer(ratings, many=True)
        return Response(serializer.data)
    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def create_main_category(request):
    """Create a new main category"""
    try:
        data = request.data
        
        # Validate code length (3 characters)
        if len(data.get('code', '')) != 3:
            return Response({
                'error': 'Material Group Code must be exactly 3 characters'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate required fields
        if not data.get('code') or not data.get('name'):
            return Response({
                'error': 'Both code and name are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Create new main category
        new_category = MainCategory.objects.create(
            code=data['code'].upper(),
            name=data['name']
        )

        return Response({
            'id': new_category.id,
            'code': new_category.code,
            'name': new_category.name
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def create_sub_category(request):
    """Create a new sub category"""
    try:
        data = request.data
        
        # Validate code length (2 characters) - Updated
        if len(data.get('code', '')) != 2:
            return Response({
                'error': 'Type Code must be exactly 2 characters'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate required fields
        if not all([data.get('code'), data.get('name'), data.get('main_category')]):
            return Response({
                'error': 'Code, name, and main_category are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Create new sub category
        new_subcategory = SubCategory.objects.create(
            code=data['code'].upper(),
            name=data['name'],
            main_category_id=data['main_category']
        )

        return Response({
            'id': new_subcategory.id,
            'code': new_subcategory.code,
            'name': new_subcategory.name,
            'main_category': new_subcategory.main_category_id
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def create_make(request):
    """Create a new make"""
    try:
        data = request.data
        
        # Validate code length (2 characters)
        if len(data.get('code', '')) != 2:
            return Response({
                'error': 'Make Code must be exactly 2 characters'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate required fields
        if not all([data.get('code'), data.get('name'), data.get('main_category')]):
            return Response({
                'error': 'Code, name, and main_category are required'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Create new make
        new_make = Make.objects.create(
            code=data['code'].upper(),
            name=data['name'],
            main_category_id=data['main_category']
        )

        return Response({
            'id': new_make.id,
            'code': new_make.code,
            'name': new_make.name,
            'main_category': new_make.main_category_id
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        return Response({
            'error': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def generate_next_available_code(request):
    """Generate next available code for a given category"""
    # This is kept for backward compatibility
    # It calls our new generate_code function
    category_type = request.data.get('type')
    name = request.data.get('name')
    main_category_id = request.data.get('main_category_id')
    
    # Map old parameter names to new ones
    if category_type == 'main_category':
        mapped_type = 'productName'
    elif category_type == 'sub_category':
        mapped_type = 'type'
    elif category_type == 'product_rating':
        mapped_type = 'rating'
    else:
        mapped_type = category_type
    
    # Call the new function
    request.data['type'] = mapped_type
    return generate_code(request)

@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def request_item(request):
    try:
        data = request.data
        request_status = request.data.get('status', 'draft')
       
        # Get the requestor from request data (sent by frontend) or fallback to user from auth
        requestor = data.get('requestor')
        email = data.get('email')
        
        # Get email from CustomUser table where role is Submitter
        submitter_email = None
        try:
            submitter = CustomUser.objects.filter(role='Submitter').first()
            if submitter:
                submitter_email = submitter.email
        except Exception as e:
            logger.error(f"Error fetching submitter email: {str(e)}")
        
        if not requestor and hasattr(request, 'user') and request.user.is_authenticated:
            # Use full name if available
            if request.user.first_name or request.user.last_name:
                requestor = f"{request.user.first_name} {request.user.last_name}".strip()
            else:
                requestor = request.user.username
       
        if not requestor:
            requestor = "Anonymous"
       
        # Extract file data from request
        document = request.FILES.get('document')
        document_name = request.data.get('document_name', '')
       
        # Safely convert moq and leadTime to integers with default values
        try:
            moq = int(data.get('moq', 0)) if data.get('moq') not in [None, 'null', ''] else 0
        except (ValueError, TypeError):
            moq = 0
            
        try:
            leadTime = int(data.get('leadTime', 0)) if data.get('leadTime') not in [None, 'null', ''] else 0
        except (ValueError, TypeError):
            leadTime = 0
       
        # Create item request with all provided fields
        item_request = ItemRequest(
            requestor=requestor,
            productName=data.get('productName', ''),
            productCode=data.get('productCode', ''),
            mfgPartNo=data.get('mfgPartNo', ''),
            mfgPartCode=data.get('mfgPartCode', ''),
            itemDescription=data.get('itemDescription', ''),
            itemCode=data.get('itemCode', ''),
            make=data.get('make', ''),
            makeCode=data.get('makeCode', ''),
            type=data.get('type', ''),
            typeCode=data.get('typeCode', ''),
            materialRating=data.get('materialRating', ''),
            materialRatingCode=data.get('materialRatingCode', ''),
            package=data.get('package', ''),
            uom=data.get('uom', ''),
            moq=moq,  # Use safely converted value
            leadTime=leadTime,  # Use safely converted value
            hsnCode=data.get('hsnCode', ''),
            bin=data.get('bin', ''),
            cimcon_part_no=data.get('cimcon_part_no', ''),
            document=document,
            document_name=document_name,
            status=request_status
        )
       
        # Create upload directory if it doesn't exist
        upload_dir = os.path.join(settings.MEDIA_ROOT, 'item_requests')
        os.makedirs(upload_dir, exist_ok=True)
       
        item_request.save()
       
        # Send email notification asynchronously
        def send_request_email():
            try:
                email_sender = SendEmail()
                email_sender.send(
                    'generate_item',
                    requestor=requestor,
                    email=email,
                    cimcon_part_no=data.get('cimcon_part_no', 'N/A'),
                    status=request_status,
                    submitter_email=submitter_email  # Pass the submitter's email
                )
            except Exception as e:
                logger.error(f"Failed to send item request notification: {str(e)}")
        
        # Send email in background thread
        email_thread = threading.Thread(target=send_request_email)
        email_thread.daemon = True
        email_thread.start()
       
        return Response({
            "success": True,
            "message": "Item request submitted successfully",
            "request_id": item_request.id
        })
    except Exception as e:
        logger.error(f"Error submitting item request: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def get_item_requests(request):
    status_filter = request.GET.get('status', 'draft,pending,approved,rejected')
    statuses = status_filter.split(',')
    
    try:
        items = ItemRequest.objects.filter(
            status__in=statuses
        ).order_by('-created_at')
        
        # Add filters (KEEP THIS OPTIMIZATION)
        if request.GET.get('requestor'):
            items = items.filter(requestor__icontains=request.GET.get('requestor'))
        if request.GET.get('search'):
            search_term = request.GET.get('search')
            items = items.filter(
                models.Q(productName__icontains=search_term) |
                models.Q(cimcon_part_no__icontains=search_term) |
                models.Q(requestor__icontains=search_term)
            )
        
        # Optional pagination - only apply if requested
        if request.GET.get('paginate') == 'true':
            page_size = int(request.GET.get('page_size', 20))
            page_number = int(request.GET.get('page', 1))
            
            paginator = Paginator(items, page_size)
            page_obj = paginator.get_page(page_number)
            
            serializer = ItemRequestSerializer(page_obj, many=True, context={'request': request})
            
            return Response({
                'results': serializer.data,
                'count': paginator.count,
                'page': page_number,
                'page_size': page_size,
                'total_pages': paginator.num_pages
            })
        else:
            # ORIGINAL RESPONSE FORMAT - maintains backward compatibility
            serializer = ItemRequestSerializer(items, many=True, context={'request': request})
            return Response(serializer.data)
            
    except Exception as e:
        print(f"Error fetching item requests: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def approve_item_request(request, request_id):
    """Approve an item request and create the item"""
    try:
        with transaction.atomic():  # Use database transaction
            # Find the request with select_for_update to prevent race conditions
            item_request = ItemRequest.objects.select_for_update().get(id=request_id)
       
            if item_request.status != 'pending':
                return Response({"error": "Can only approve pending requests"}, status=status.HTTP_400_BAD_REQUEST)
       
            # 1. Create or get main category
            main_category = MainCategory.objects.filter(code=item_request.productCode).first()
            if not main_category:
                # Get the highest existing ID and add 1
                highest_id = MainCategory.objects.all().order_by('-id').values_list('id', flat=True).first()
                new_id = 1 if highest_id is None else highest_id + 1
                main_category = MainCategory.objects.create(
                    id=new_id,
                    code=item_request.productCode,
                    name=item_request.productName
                )
       
            # 2. Create or get subcategory
            sub_category = SubCategory.objects.filter(
                code=item_request.typeCode,
                main_category=main_category
            ).first()
            if not sub_category:
                sub_category = SubCategory.objects.create(
                    code=item_request.typeCode,
                    name=item_request.type,
                    main_category=main_category
                )
       
            # 3. Create or get make
            make = Make.objects.filter(
                code=item_request.makeCode,
                main_category=main_category
            ).first()
            if not make:
                make = Make.objects.create(
                    code=item_request.makeCode,
                    name=item_request.make,
                    main_category=main_category
                )
       
            # 4. Create or get product model
            product_model = ProductModel.objects.filter(
                code=item_request.mfgPartCode,
                main_category=main_category
            ).first()
            if not product_model:
                product_model = ProductModel.objects.create(
                    code=item_request.mfgPartCode,
                    name=item_request.mfgPartNo,
                    main_category=main_category
                )
       
            # 5. Create or get remarks
            remarks = Remarks.objects.filter(
                code=item_request.itemCode,
                main_category=main_category
            ).first()
            if not remarks:
                remarks = Remarks.objects.create(
                    code=item_request.itemCode,
                    description=item_request.itemDescription,
                    main_category=main_category
                )
       
            # 6. Create or get product rating if provided
            product_rating = None
            if item_request.materialRatingCode:
                product_rating = ProductRating.objects.filter(
                    code=item_request.materialRatingCode,
                    main_category=main_category,
                    sub_category=sub_category
                ).first()
                if not product_rating:
                    product_rating = ProductRating.objects.create(
                        code=item_request.materialRatingCode,
                        name=item_request.materialRating or '',
                        main_category=main_category,
                        sub_category=sub_category
                    )
        
            # 7. Create the item with all relationships
            item = ItemMaster.objects.create(
                name=item_request.productName,
                description=item_request.itemDescription,
                main_category=main_category,
                sub_category=sub_category,
                make=make,
                product_model=product_model,
                product_rating=product_rating,
                remarks=remarks,
                cimcon_part_no=item_request.cimcon_part_no,
                mfg_part_no=item_request.mfgPartNo,
                package=item_request.package,
                uom=item_request.uom,
                moq=item_request.moq,
                mfg_std_lead_time=item_request.leadTime,
                bin=item_request.bin,
                hsn_code=item_request.hsnCode,
                document=item_request.document,
                document_name=item_request.document_name
            )
       
            # Update request status
            item_request.status = 'approved'
            item_request.save()
            
            # Clear related caches
            cache.delete('item_dropdown_options')
            
            # Clear related options cache for all main categories
            # Since LocMemCache doesn't support delete_pattern, we need to clear individual keys
            try:
                # Get all main category IDs to clear their related options cache
                main_category_ids = MainCategory.objects.values_list('id', flat=True)
                for category_id in main_category_ids:
                    cache.delete(f'related_options_{category_id}')
            except Exception as e:
                logger.warning(f"Error clearing related options cache: {str(e)}")
        
        # Send email notification asynchronously
        def send_approval_email():
            try:
                # Get email from CustomUser table where role is Submitter
                submitter_email = None
                try:
                    submitter = CustomUser.objects.filter(role='Submitter').first()
                    if submitter:
                        submitter_email = submitter.email
                except Exception as e:
                    logger.error(f"Error fetching submitter email: {str(e)}")                
                
                email_sender = SendEmail()
                email_sender.send(
                    'item_approval_dash',
                    cimcon_part_no=item_request.cimcon_part_no,
                    requestor=item_request.requestor,
                    submitter_email=submitter_email
                )
            except Exception as e:
                logger.error(f"Failed to send approval notification: {str(e)}")
        
        # Send email in background thread
        email_thread = threading.Thread(target=send_approval_email)
        email_thread.daemon = True
        email_thread.start()
       
        return Response({
            "success": True,
            "message": "Request approved and item created successfully",
            "item_id": item.id
        })
    except ItemRequest.DoesNotExist:
        return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def reject_item_request(request, request_id):
    """Reject an item request"""
    try:
        # Find the request
        item_request = ItemRequest.objects.get(id=request_id)
        
        if item_request.status != 'pending':
            return Response({"error": "Can only reject pending requests"}, status=status.HTTP_400_BAD_REQUEST)
        
        rejection_reason = request.data.get('reason', '')
        
        # Update request status and add rejection reason
        item_request.status = 'rejected'
        item_request.rejection_reason = rejection_reason
        item_request.save()
        
        # Send email notification asynchronously
        def send_rejection_email():
            try:
                # Get email from CustomUser table where role is Submitter
                submitter_email = None
                try:
                    submitter = CustomUser.objects.filter(role='Submitter').first()
                    if submitter:
                        submitter_email = submitter.email
                except Exception as e:
                    logger.error(f"Error fetching submitter email: {str(e)}")        
                
                email_sender = SendEmail()
                email_sender.send(
                    'item_reject_dash',
                    cimcon_part_no=item_request.cimcon_part_no,
                    requestor=item_request.requestor,
                    rejection_reason=rejection_reason,
                    submitter_email=submitter_email
                )
            except Exception as e:
                logger.error(f"Failed to send rejection notification: {str(e)}")
        
        # Send email in background thread
        email_thread = threading.Thread(target=send_rejection_email)
        email_thread.daemon = True
        email_thread.start()
        
        return Response({
            "success": True,
            "message": "Request rejected successfully"
        })
    except ItemRequest.DoesNotExist:
        return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def update_item_request(request, request_id):
    """Update an existing item request"""
    try:
        # Find the request
        item_request = ItemRequest.objects.get(id=request_id)
        
        # Get email from CustomUser table where role is Admin
        admin_email = None
        try:
            admin = CustomUser.objects.filter(role='Admin').first()
            if admin:
                admin_email = admin.email
        except Exception as e:
            logger.error(f"Error fetching admin email: {str(e)}")

        # Check if we're changing status from draft to pending or rejected to pending
        status_changing_to_pending = False      
        is_resubmission = False
        
        if request.data.get('status') == 'pending':
            if item_request.status == 'draft':
                status_changing_to_pending = True
            elif item_request.status == 'rejected':
                is_resubmission = True
                previous_rejection_reason = item_request.rejection_reason
        
        # Update all fields from the request data
        for field, value in request.data.items():
            if hasattr(item_request, field):
                # If field is cimcon_part_no, remove any dashes
                if field == 'cimcon_part_no' and value:
                    value = value.replace('-', '')
                setattr(item_request, field, value)
        
        # Regenerate cimcon_part_no without dashes just to be sure
        rating_code = item_request.materialRatingCode or "000"
        cimcon_part_no = f"{item_request.productCode}{item_request.typeCode}{item_request.makeCode}{item_request.mfgPartCode}{item_request.itemCode}{rating_code}"
        item_request.cimcon_part_no = cimcon_part_no

        # Get email from CustomUser table where role is Submitter
        submitter_email = None
        try:
            submitter = CustomUser.objects.filter(role='Submitter').first()
            if submitter:
                submitter_email = submitter.email
        except Exception as e:
            logger.error(f"Error fetching submitter email: {str(e)}")
        
        # Save the updated request
        item_request.save()
        
        # Send appropriate email notification asynchronously
        def send_update_email():
            try:
                email_sender = SendEmail()
                
                if status_changing_to_pending:
                    # Send regular submission email with all required parameters
                    email_sender.send(
                        'update_item_request',
                        cimcon_part_no=cimcon_part_no,
                        productName=item_request.productName,
                        productCode=item_request.productCode,
                        mfgPartNo=item_request.mfgPartNo,
                        mfgPartCode=item_request.mfgPartCode,
                        itemDescription=item_request.itemDescription,
                        itemCode=item_request.itemCode,
                        make=item_request.make,
                        makeCode=item_request.makeCode,
                        type_name=item_request.type,
                        typeCode=item_request.typeCode,
                        materialRating=item_request.materialRating,
                        materialRatingCode=item_request.materialRatingCode,
                        package=item_request.package,
                        uom=item_request.uom,
                        moq=item_request.moq,
                        leadTime=item_request.leadTime,
                        requestor=item_request.requestor,
                        hsnCode=item_request.hsnCode,
                        bin=item_request.bin,
                        admin_email=admin_email  # Pass admin email
                    )
                elif is_resubmission:
                    # Send resubmission email with all required parameters
                    email_sender.send(
                        'resubmit_item_request',
                        cimcon_part_no=cimcon_part_no,
                        productName=item_request.productName,
                        productCode=item_request.productCode,
                        mfgPartNo=item_request.mfgPartNo,
                        mfgPartCode=item_request.mfgPartCode,
                        itemDescription=item_request.itemDescription,
                        itemCode=item_request.itemCode,
                        make=item_request.make,
                        makeCode=item_request.makeCode,
                        type_name=item_request.type,
                        typeCode=item_request.typeCode,
                        materialRating=item_request.materialRating,
                        materialRatingCode=item_request.materialRatingCode,
                        package=item_request.package,
                        uom=item_request.uom,
                        moq=item_request.moq,
                        leadTime=item_request.leadTime,
                        requestor=item_request.requestor,
                        hsnCode=item_request.hsnCode,
                        bin=item_request.bin,
                        previous_rejection_reason=previous_rejection_reason,
                        submitter_email=submitter_email  # Pass submitter email
                    )
            except Exception as e:
                logger.error(f"Failed to send notification: {str(e)}")
        
        # Send email in background thread
        email_thread = threading.Thread(target=send_update_email)
        email_thread.daemon = True
        email_thread.start()
        
        return Response({
            "success": True,
            "message": "Request updated successfully"
        })
    except ItemRequest.DoesNotExist:
        return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    

@api_view(['POST'])
def submit_for_approval(request, request_id):
    """Change a draft request to pending status for approval"""
    try:
        # Find the request
        item_request = ItemRequest.objects.get(id=request_id)
        
        if item_request.status != 'draft':
            return Response({"error": "Only draft requests can be submitted for approval"}, 
                           status=status.HTTP_400_BAD_REQUEST)
        
        # Update request status to pending
        item_request.status = 'pending'
        item_request.save()
        
        return Response({
            "success": True,
            "message": "Request submitted for approval successfully"
        })
    except ItemRequest.DoesNotExist:
        return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
def current_user(request):
    """Get the current logged-in user information"""
    try:
        # Check if user is authenticated through session
        if hasattr(request, 'user') and request.user.is_authenticated:
            # Log the user details for debugging
            logger.info(f"""
            Authenticated user details:
            ID: {request.user.id}
            Username: {request.user.username}
            First Name: {request.user.first_name}
            Last Name: {request.user.last_name}
            """)
            
            return Response({
                'username': request.user.username,
                'first_name': request.user.first_name,  # Add first name explicitly
                'last_name': request.user.last_name,    # Add last name explicitly
                'full_name': f"{request.user.first_name} {request.user.last_name}".strip(),
                'email': request.user.email if hasattr(request.user, 'email') else None,
                'is_authenticated': True
            })
        
        # Try to get auth token from headers
        auth_header = request.META.get('HTTP_AUTHORIZATION', '')
        if auth_header.startswith('Bearer '):
            from rest_framework_simplejwt.tokens import AccessToken
            from django.contrib.auth import get_user_model
            
            try:
                token = auth_header.split(' ')[1]
                # Decode the token
                access_token = AccessToken(token)
                user_id = access_token['user_id']
                User = get_user_model()
                user = User.objects.get(id=user_id)
                
                # Log token-based user details
                logger.info(f"""
                Token-based user details:
                ID: {user.id}
                Username: {user.username}
                First Name: {user.first_name}
                Last Name: {user.last_name}
                """)
                
                return Response({
                    'username': user.username,
                    'first_name': user.first_name,      # Add first name explicitly
                    'last_name': user.last_name,        # Add last name explicitly
                    'full_name': f"{user.first_name} {user.last_name}".strip(),
                    'email': user.email if hasattr(user, 'email') else None,
                    'is_authenticated': True
                })
            except Exception as token_error:
                logger.error(f"Token authentication error: {str(token_error)}")
        
        # If no authentication found, check if username is in a cookie
        username_cookie = request.COOKIES.get('username')
        full_name_cookie = request.COOKIES.get('full_name')
        email_cookie = request.COOKIES.get('email')

        if username_cookie:
            # Split full_name if available, otherwise use defaults
            first_name = "User"
            last_name = ""
            
            if full_name_cookie:
                name_parts = full_name_cookie.split(' ', 1)
                first_name = name_parts[0]
                last_name = name_parts[1] if len(name_parts) > 1 else ""
            
            return Response({
                'username': username_cookie,
                'first_name': first_name,
                'last_name': last_name,
                'full_name': full_name_cookie or first_name,
                'email': email_cookie,
                'is_authenticated': True,
                'source': 'cookie'
            })
            
        # If no authentication method succeeded, return 401 Unauthorized
        return Response(
            {"error": "Authentication failed", "detail": "No valid authentication found"},
            status=status.HTTP_401_UNAUTHORIZED
        )
            
    except Exception as e:
        logger.error(f"Error in current_user view: {str(e)}")
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def item_approve_email(request, cimcon_part_no):
    """Approve an item request from email link"""
    try:
        # Find the request by cimcon_part_no
        item_request = ItemRequest.objects.get(cimcon_part_no=cimcon_part_no)
        
        if item_request.status != 'pending':
            return Response({"error": "Can only approve pending requests"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Create all related entities and the item itself
        # 1. Create or get main category
        main_category, _ = MainCategory.objects.get_or_create(
            code=item_request.productCode,
            defaults={'name': item_request.productName}
        )
        
        # 2. Create or get subcategory
        sub_category, _ = SubCategory.objects.get_or_create(
            code=item_request.typeCode,
            main_category=main_category,
            defaults={'name': item_request.type}
        )
        
        # 3. Create or get make
        make, _ = Make.objects.get_or_create(
            code=item_request.makeCode,
            main_category=main_category,
            defaults={'name': item_request.make}
        )
        
        # 4. Create or get product model
        product_model, _ = ProductModel.objects.get_or_create(
            code=item_request.mfgPartCode,
            main_category=main_category,
            defaults={'name': item_request.mfgPartNo}
        )
        
        # 5. Create or get remarks
        remarks, _ = Remarks.objects.get_or_create(
            code=item_request.itemCode,
            main_category=main_category,
            defaults={'description': item_request.itemDescription}
        )
        
        # 6. Create or get product rating if provided
        product_rating = None
        if item_request.materialRatingCode:
            product_rating, _ = ProductRating.objects.get_or_create(
                code=item_request.materialRatingCode,
                main_category=main_category,
                sub_category=sub_category,
                defaults={'name': item_request.materialRating or ''}
            )
        # Get email from CustomUser table where role is Submitter
        submitter_email = None
        try:
            submitter = CustomUser.objects.filter(role='Submitter').first()
            if submitter:
                submitter_email = submitter.email
        except Exception as e:
            logger.error(f"Error fetching submitter email: {str(e)}")
        
        # 7. Create the item
        item = ItemMaster.objects.create(
            name=item_request.productName,
            description=item_request.itemDescription,
            main_category=main_category,
            sub_category=sub_category,
            make=make,
            product_model=product_model,
            remarks=remarks,
            product_rating=product_rating,
            cimcon_part_no=item_request.cimcon_part_no,
            mfg_part_no=item_request.mfgPartNo,
            package=item_request.package,
            uom=item_request.uom,
            moq=item_request.moq,
            mfg_std_lead_time=item_request.leadTime,
            bin=item_request.bin,
            hsn_code=item_request.hsnCode
        )
        
        # Update request status
        item_request.status = 'approved'
        item_request.save()
        
        # Send email notification
        try:
            email_sender = SendEmail()
            email_sender.send(
                'item_approval_dash',
                cimcon_part_no=item_request.cimcon_part_no,
                requestor=item_request.requestor,
                submitter_email=submitter_email
            )
        except Exception as e:
            logger.error(f"Failed to send approval notification: {str(e)}")
        
        return Response({
            "success": True,
            "message": "Item request approved successfully",
            "item_id": item.id
        })
    except ItemRequest.DoesNotExist:
        return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['POST'])
def item_reject_email(request, cimcon_part_no):
    """Reject an item request from email link"""
    try:
        # Find the request by cimcon_part_no
        item_request = ItemRequest.objects.get(cimcon_part_no=cimcon_part_no)
        
        if item_request.status != 'pending':
            return Response({"error": "Can only reject pending requests"}, status=status.HTTP_400_BAD_REQUEST)
        
        # Get rejection reason from request data
        rejection_reason = request.data.get('reason', '')
        # Get email from CustomUser table where role is Submitter
        submitter_email = None
        try:
            submitter = CustomUser.objects.filter(role='Submitter').first()
            if submitter:
                submitter_email = submitter.email
        except Exception as e:
            logger.error(f"Error fetching submitter email: {str(e)}")
        
        # Update request status and add rejection reason
        item_request.status = 'rejected'
        item_request.rejection_reason = rejection_reason
        item_request.save()
        
        # Send email notification
        try:
            email_sender = SendEmail()
            email_sender.send(
                'item_reject_dash',
                cimcon_part_no=item_request.cimcon_part_no,
                requestor=item_request.requestor,
                rejection_reason=rejection_reason,
                submitter_email=submitter_email
            )
        except Exception as e:
            logger.error(f"Failed to send rejection notification: {str(e)}")
        
        return Response({
            "success": True,
            "message": "Item request rejected successfully"
        })
    except ItemRequest.DoesNotExist:
        return Response({"error": "Request not found"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

def item_approve_page_open(request, cimcon_part_no):
    try:
        # Make API call to item-approve-email endpoint
        base_url = settings.BASE_API_URL
        api_url = f"{base_url}/api/item-approve-email/{cimcon_part_no}/"
        
        response = requests.post(api_url, json={"cimcon_part_no": cimcon_part_no})
        
        # Prepare HTML response based on API response
        success = response.status_code == 200
        message = "Item Approved Successfully!" if success else "Failed to approve item"
        message_color = "#4CAF50" if success else "#F44336"  # Green for success, Red for error
        
        html_content = f'''
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Item Approval</title>
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
                .part-no {{
                    color: #666;
                    font-size: 16px;
                    margin-top: 10px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <h2>Item Approval Status</h2>
                <p class="message">{"✓" if success else "✗"} {message}</p>
                <p class="part-no">CIMCON Part No: {cimcon_part_no}</p>
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
                .part-no {{
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
                <p class="part-no">CIMCON Part No: {cimcon_part_no}</p>
                <p style="color: #666;">Error: {str(e)}</p>
            </div>
        </body>
        </html>
        '''
        return HttpResponse(error_html)

def item_reject_page_open(request, cimcon_part_no):
    try:
        if request.method == 'POST':
            # Handle form submission
            remarks = request.POST.get('rejection_remarks', '')
            
            # Make API call to item-reject-email endpoint
            base_url = settings.BASE_API_URL
            api_url = f"{base_url}/api/item-reject-email/{cimcon_part_no}/"
            
            response = requests.post(api_url, json={
                "cimcon_part_no": cimcon_part_no,
                "reason": remarks  # Changed to match the field name in item_reject_email
            })
            
            # Prepare response page
            success = response.status_code == 200
            message = "Item Rejected Successfully!" if success else "Failed to reject item"
            message_color = "#F44336"  # Red for rejection
            
            return HttpResponse(f'''
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Item Rejection</title>
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
                        .part-no {{
                            font-size: 16px;
                            color: #666;
                            margin-top: 10px;
                        }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Item Rejection Status</h2>
                        <p class="message">{"✓" if success else "✗"} {message}</p>
                        <p class="part-no">CIMCON Part No: {cimcon_part_no}</p>
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
                    <title>Reject Item Request</title>
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
                        .part-no {{
                            font-size: 16px;
                            color: #666;
                            margin-top: 10px;
                        }}
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h2>Reject Item Request</h2>
                        <p class="part-no">CIMCON Part No: {cimcon_part_no}</p>
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
                .part-no {{
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
                <p class="part-no">CIMCON Part No: {cimcon_part_no}</p>
                <p style="color: #666;">Error: {str(e)}</p>
            </div>
        </body>
        </html>
        '''
        return HttpResponse(error_html)

class SendEmail:
    def __init__(self):
        self.smtp_server = 'smtp.office365.com'
        self.port = 587
        self.sender_email = 'purchase.notifications@cimconautomation.com'
        self.password = 'cimcon@1987'

    def send(self, trigger, **kwargs):
        if trigger == 'generate_item':
            try:
                # Extract item details from kwargs
                requestor = kwargs.get('requestor', 'Unknown')
                cimcon_part_no = kwargs.get('cimcon_part_no', 'N/A')
                status = kwargs.get('status', 'N/A')
                email = kwargs.get('email', 'Unknown')
                # Use submitter's email if provided, otherwise fall back to default
                recipient_email = kwargs.get('submitter_email')


                subject = f"New Item Request - {cimcon_part_no} (requested by {requestor})"

                html_body = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <p>Greetings,</p>
                            
                            <p>A new item request has been initiated.</p>
                            
                            <h2>Item Request Details</h2>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>CIMCON Part No:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{cimcon_part_no}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Requestor:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{requestor}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Email:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{email}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Status:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{status.title()}</td>
                                </tr>
                            </table>

                            <p style="margin-top: 20px;">Please review the request at your earliest convenience.</p>

                            <p style="margin-top: 20px;">Best regards</p>

                        </div>
                    </body>
                </html>
                """

                msg = MIMEMultipart('alternative')
                msg['From'] = self.sender_email
                msg['To'] = recipient_email
                msg['Subject'] = subject

                text_part = MIMEText(
                    f"New Item Request\n\n"
                    f"CIMCON Part No: {cimcon_part_no}\n"
                    f"Requestor: {requestor}\n"
                    f"Email: {email}\n"
                    f"Status: {status.title()}", 
                    'plain'
                )
                html_part = MIMEText(html_body, 'html')

                msg.attach(text_part)
                msg.attach(html_part)

                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls()
                    server.login(self.sender_email, self.password)
                    server.sendmail(self.sender_email,recipient_email, msg.as_string())
                    logger.info(f"Item request notification email sent successfully to {recipient_email}")

            except Exception as e:
                logger.error(f"Error sending item request email: {str(e)}")

        elif trigger == 'update_item_request':
            try:
                # Extract item request details from kwargs
                recipient_email = kwargs.get('admin_email')  # Get admin email from kwargs            
                cimcon_part_no = kwargs.get('cimcon_part_no')
                productName = kwargs.get('productName')
                productCode = kwargs.get('productCode')
                mfgPartNo = kwargs.get('mfgPartNo')
                itemDescription = kwargs.get('itemDescription')
                make = kwargs.get('make')
                type_name = kwargs.get('type_name')
                materialRating = kwargs.get('materialRating')
                package = kwargs.get('package')
                uom = kwargs.get('uom')
                moq = kwargs.get('moq')
                leadTime = kwargs.get('leadTime')
                requestor = kwargs.get('requestor')
                email = kwargs.get('email')

                # Base URL of your application
                base_url = settings.BASE_API_URL  # Update with your actual domain
                approve_url = f"{base_url}/item-approve-page-open/{cimcon_part_no}/"
                reject_url = f"{base_url}/item-reject-page-open/{cimcon_part_no}/"

                subject = f"New Item Code Approval Request - {cimcon_part_no}"

                html_body = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <p>Greetings,</p>
                            
                            <p>A new item request has been created, kindly review and approve it.</p>
                            
                            <h3 style="margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">CIMCON Part No: {cimcon_part_no}</h3>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                                <tr style="background-color: #f8f8f8;">
                                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Category</th>
                                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Name</th>
                                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Code</th>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Product:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{productName}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{productCode}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>MFG Part:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{mfgPartNo}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{kwargs.get('mfgPartCode', 'N/A')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Description:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{itemDescription}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{kwargs.get('itemCode', 'N/A')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Make:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{make}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{kwargs.get('makeCode', 'N/A')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Type:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{type_name}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{kwargs.get('typeCode', 'N/A')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Material Rating:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{materialRating or 'N/A'}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{kwargs.get('materialRatingCode', 'N/A')}</td>
                                </tr>
                            </table>

                            <h3 style="margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Additional Information</h3>
                            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Package:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{package or 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>UOM:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{uom or 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>MOQ:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{moq or 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Lead Time:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{leadTime or 'N/A'} days</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>HSN Code:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{kwargs.get('hsnCode', 'N/A')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Bin Location:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{kwargs.get('bin', 'N/A')}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Requestor:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{requestor}</td>
                                </tr>
                            </table>

                            <div style="margin-top: 30px; text-align: center;">
                                <p>Please take action on this request:</p>
                                <a href="{approve_url}" style="display: inline-block; margin: 10px; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Approve Request</a>
                                <a href="{reject_url}" style="display: inline-block; margin: 10px; padding: 12px 24px; background-color: #F44336; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Reject Request</a>
                            </div>

                            <p style="margin-top: 20px;">Best regards</p>


                        </div>
                    </body>
                </html>
                """

                msg = MIMEMultipart('alternative')
                msg['From'] = self.sender_email
                msg['To'] = recipient_email  # Use the admin email
                msg['Subject'] = subject

                text_part = MIMEText(
                    f"Dear Jutan,\n\n"
                    f"A new item code approval request has been submitted for your review.\n\n"
                    f"CIMCON Part No: {cimcon_part_no}\n"
                    f"Product Name: {productName}\n"
                    f"Description: {itemDescription}\n"
                    f"Make: {make}\n"
                    f"Type: {type_name}\n"
                    f"Requestor: {requestor}\n\n"
                    f"Please review and take necessary action on this request.\n\n"
                    f"Best regards,\n"
                    'plain'
                )
                html_part = MIMEText(html_body, 'html')

                msg.attach(text_part)
                msg.attach(html_part)

                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls()
                    server.login(self.sender_email, self.password)
                    server.sendmail(self.sender_email, recipient_email, msg.as_string())
                    logger.info(f"Approval request notification email sent successfully to {recipient_email}")

            except Exception as e:
                logger.error(f"Error sending approval request email: {str(e)}")

        elif trigger == 'item_approval_dash':
            try:
                # Extract item details from kwargs
                cimcon_part_no = kwargs.get('cimcon_part_no', 'N/A')
                requestor = kwargs.get('requestor', 'Unknown')
                recipient_email = kwargs.get('submitter_email')

                subject = f"Item Request Approved - {cimcon_part_no}"

                html_body = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <p>Greetings,</p>
                            
                            <p>Your item request has been approved.</p>
                            
                            <h2>Approval Details</h2>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>CIMCON Part No:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{cimcon_part_no}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Requestor:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{requestor}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Status:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd; color: #4CAF50;">Approved</td>
                                </tr>
                            </table>

                            <p style="margin-top: 20px;">You may now proceed with using this item code.</p>

                            <p style="margin-top: 20px;">Best regards</p>

                        </div>
                    </body>
                </html>
                """

                msg = MIMEMultipart('alternative')
                msg['From'] = self.sender_email
                msg['To'] = recipient_email
                msg['Subject'] = subject

                text_part = MIMEText(
                    f"Item Request Approval Notification\n\n"
                    f"CIMCON Part No: {cimcon_part_no}\n"
                    f"Requestor: {requestor}\n"
                    f"Status: Approved", 
                    'plain'
                )
                html_part = MIMEText(html_body, 'html')

                msg.attach(text_part)
                msg.attach(html_part)

                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls()
                    server.login(self.sender_email, self.password)
                    server.sendmail(self.sender_email, recipient_email, msg.as_string())
                    logger.info(f"Item approval notification email sent successfully to {recipient_email}")

            except Exception as e:
                logger.error(f"Error sending item approval email: {str(e)}")

        elif trigger == 'item_reject_dash':
            try:
                # Extract item details from kwargs
                cimcon_part_no = kwargs.get('cimcon_part_no', 'N/A')
                requestor = kwargs.get('requestor', 'Unknown')
                rejection_reason = kwargs.get('rejection_reason', 'No reason provided')
                recipient_email = kwargs.get('submitter_email')

                subject = f"Item Request Rejected - {cimcon_part_no}"

                html_body = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <p>Greetings,</p>
                            
                            <p>Your item request has not been approved.</p>
                            
                            <h2>Rejection Details</h2>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>CIMCON Part No:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{cimcon_part_no}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Requestor:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{requestor}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Status:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd; color: #F44336;">Rejected</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Reason for Rejection:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{rejection_reason}</td>
                                </tr>
                            </table>

                            <p style="margin-top: 20px;">Please review the rejection reason and make necessary modifications before resubmitting the request.</p>

                            <p style="margin-top: 20px;">Best regards</p>


                        </div>
                    </body>
                </html>
                """

                msg = MIMEMultipart('alternative')
                msg['From'] = self.sender_email
                msg['To'] = recipient_email
                msg['Subject'] = subject

                text_part = MIMEText(
                    f"Item Request Rejection Notification\n\n"
                    f"CIMCON Part No: {cimcon_part_no}\n"
                    f"Requestor: {requestor}\n"
                    f"Status: Rejected\n"
                    f"Rejection Reason: {rejection_reason}", 
                    'plain'
                )
                html_part = MIMEText(html_body, 'html')

                msg.attach(text_part)
                msg.attach(html_part)

                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls()
                    server.login(self.sender_email, self.password)
                    server.sendmail(self.sender_email, recipient_email, msg.as_string())
                    logger.info(f"Item rejection notification email sent successfully to {recipient_email}")

            except Exception as e:
                logger.error(f"Error sending item rejection email: {str(e)}")

        elif trigger == 'resubmit_item_request':
            try:
                # Extract item details from kwargs
                recipient_email = kwargs.get('submitter_email')
                cimcon_part_no = kwargs.get('cimcon_part_no')
                productName = kwargs.get('productName')
                productCode = kwargs.get('productCode')
                mfgPartNo = kwargs.get('mfgPartNo')
                mfgPartCode = kwargs.get('mfgPartCode')
                itemDescription = kwargs.get('itemDescription')
                itemCode = kwargs.get('itemCode')
                make = kwargs.get('make')
                makeCode = kwargs.get('makeCode')
                type_name = kwargs.get('type_name')
                typeCode = kwargs.get('typeCode')
                materialRating = kwargs.get('materialRating')
                materialRatingCode = kwargs.get('materialRatingCode')
                package = kwargs.get('package')
                uom = kwargs.get('uom')
                moq = kwargs.get('moq')
                leadTime = kwargs.get('leadTime')
                requestor = kwargs.get('requestor')
                hsnCode = kwargs.get('hsnCode')
                bin = kwargs.get('bin')
                previous_rejection_reason = kwargs.get('previous_rejection_reason', 'Not specified')

                # Base URL of your application
                base_url = settings.BASE_API_URL
                approve_url = f"{base_url}/item-approve-page-open/{cimcon_part_no}/"
                reject_url = f"{base_url}/item-reject-page-open/{cimcon_part_no}/"

                subject = f"Item Request Resubmitted - {cimcon_part_no}"

                html_body = f"""
                <html>
                    <body style="font-family: Arial, sans-serif; color: #333;">
                        <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                            <p>Greetings,</p>
                            
                            <p>We would like to inform you that a previously rejected item request has been resubmitted for your review.</p>
                            
                            <h2>Resubmission Details</h2>
                            
                            <h3 style="margin-top: 20px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">CIMCON Part No: {cimcon_part_no}</h3>
                            
                            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                                <tr style="background-color: #f8f8f8;">
                                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Category</th>
                                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Name</th>
                                    <th style="padding: 10px; border: 1px solid #ddd; text-align: left;">Code</th>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Product:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{productName}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{productCode}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>MFG Part:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{mfgPartNo}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{mfgPartCode}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Description:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{itemDescription}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{itemCode}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Make:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{make}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{makeCode}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Type:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{type_name}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{typeCode}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Material Rating:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{materialRating or 'N/A'}</td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{materialRatingCode}</td>
                                </tr>
                            </table>

                            <h3 style="margin-top: 30px; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Additional Information</h3>
                            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd; width: 30%;"><strong>Package:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{package or 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>UOM:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{uom or 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>MOQ:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{moq or 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Lead Time:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{leadTime or 'N/A'} days</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>HSN Code:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{hsnCode or 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Bin Location:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{bin or 'N/A'}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Requestor:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{requestor}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 10px; border: 1px solid #ddd;"><strong>Previous Rejection Reason:</strong></td>
                                    <td style="padding: 10px; border: 1px solid #ddd;">{previous_rejection_reason}</td>
                                </tr>
                            </table>

                            <div style="margin-top: 30px; text-align: center;">
                                <p>Please take action on this resubmitted request:</p>
                                <a href="{approve_url}" style="display: inline-block; margin: 10px; padding: 12px 24px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Approve Request</a>
                                <a href="{reject_url}" style="display: inline-block; margin: 10px; padding: 12px 24px; background-color: #F44336; color: white; text-decoration: none; border-radius: 4px; font-weight: bold;">Reject Request</a>
                            </div>

                            <p style="margin-top: 20px;">Best regards</p>


                        </div>
                    </body>
                </html>
                """

                msg = MIMEMultipart('alternative')
                msg['From'] = self.sender_email
                msg['To'] = recipient_email
                msg['Subject'] = subject

                text_part = MIMEText(
                    f"Item Request Resubmission\n\n"
                    f"CIMCON Part No: {cimcon_part_no}\n"
                    f"Product Name: {productName}\n"
                    f"Requestor: {requestor}\n"
                    f"Previous Rejection Reason: {previous_rejection_reason}\n\n"
                    f"Please review and take necessary action on this resubmitted request.", 
                    'plain'
                )
                html_part = MIMEText(html_body, 'html')

                msg.attach(text_part)
                msg.attach(html_part)

                with smtplib.SMTP(self.smtp_server, self.port) as server:
                    server.starttls()
                    server.login(self.sender_email, self.password)
                    server.sendmail(self.sender_email, recipient_email, msg.as_string())
                    logger.info(f"Item resubmission notification email sent successfully to {recipient_email}")

            except Exception as e:
                logger.error(f"Error sending item resubmission email: {str(e)}")






@api_view(['GET'])
def download_item_document(request, request_id=None, item_id=None):
    try:
        if request_id:
            # Get document from ItemRequest
            item_obj = ItemRequest.objects.get(id=request_id)
        elif item_id:
            # Get document from ItemMaster
            item_obj = ItemMaster.objects.get(id=item_id)
        else:
            return Response({"error": "No item specified"}, status=status.HTTP_400_BAD_REQUEST)
        
        if not item_obj.document:
            return Response({"error": "No document attached to this item"}, status=status.HTTP_404_NOT_FOUND)
        
        file_path = item_obj.document.path
        filename = os.path.basename(file_path)
        
        # Set content type based on file extension
        ext = os.path.splitext(filename)[1].lower()
        content_types = {
            '.pdf': 'application/pdf',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain',
        }
        content_type = content_types.get(ext, 'application/octet-stream')
        
        # Return the file with proper headers
        response = FileResponse(
            open(file_path, 'rb'),
            content_type=content_type,
            as_attachment=True,
            filename=filename
        )
        
        # Add cache control headers to prevent browser caching issues
        response['Cache-Control'] = 'no-cache, no-store, must-revalidate'
        response['Pragma'] = 'no-cache'
        response['Expires'] = '0'
        
        return response
    except (ItemRequest.DoesNotExist, ItemMaster.DoesNotExist):
        return Response({"error": "Item not found"}, status=status.HTTP_404_NOT_FOUND)
    except FileNotFoundError:
        return Response({"error": "Document file not found on server"}, status=status.HTTP_404_NOT_FOUND)
    except Exception as e:
        return Response({"error": str(e)}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
