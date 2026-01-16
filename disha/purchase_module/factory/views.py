"""
Factory module views - All factory-related API endpoints
Separated from purchase team functionality for better code organization
"""

import logging
import time
import re
from django.db.models import Max, Q
from django.db import transaction
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from rest_framework.views import APIView
from .models import (
    FactoryProduct,
    FactoryMake,
    FactoryMPN,
    FactoryRating,
    FactoryPackage,
    FactoryItemDescription,
    FactoryItemRequest,
    FactoryItemMaster,
)
from items.models import ItemRequest
from items.serializers import ItemRequestSerializer
from .serializers import FactoryItemRequestSerializer

logger = logging.getLogger(__name__)


@api_view(['GET'])
def get_factory_products(request):
    """
    Fetch products from factory_products table for factory team form
    """
    try:
        products = FactoryProduct.objects.all().order_by('productname')
        
        formatted_products = [
            {
                'id': str(product.productid),
                'name': product.productname,
                'code': product.productcode
            }
            for product in products
        ]
        
        return Response({
            'products': formatted_products
        })
        
    except Exception as e:
        logger.error(f"Error fetching factory products: {e}")
        return Response(
            {"error": "Failed to fetch factory products"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_factory_related_options(request):
    """
    Fetch related options for factory products from factory database tables
    Optionally filter by product_id
    """
    try:
        product_id = request.GET.get('product_id')
        
        # Get makes - filter by product if provided
        makes_query = FactoryMake.objects.all()
        if product_id:
            try:
                makes_query = makes_query.filter(productid_id=int(product_id))
            except ValueError:
                pass
        makes = makes_query.order_by('makename')
        
        # Get ratings - filter by product if provided
        ratings_query = FactoryRating.objects.all()
        if product_id:
            try:
                ratings_query = ratings_query.filter(productid_id=int(product_id))
            except ValueError:
                pass
        ratings = ratings_query.order_by('ratingvalue')
        
        # Get packages - filter by product if provided
        packages_query = FactoryPackage.objects.all()
        if product_id:
            try:
                packages_query = packages_query.filter(productid_id=int(product_id))
            except ValueError:
                pass
        packages = packages_query.order_by('packagecode')
        
        formatted_makes = [
            {
                'id': str(make.makeid),
                'name': make.makename,
                'code': make.makecode
            }
            for make in makes
        ]
        
        formatted_ratings = [
            {
                'id': str(rating.ratingid),
                'name': rating.description or rating.ratingvalue,
                'code': rating.ratingvalue
            }
            for rating in ratings
        ]
        
        formatted_packages = [
            {
                'id': str(package.packageid),
                'name': package.packagedesc or package.packagecode,
                'code': package.packagecode
            }
            for package in packages
        ]
        
        return Response({
            'makes': formatted_makes,
            'ratings': formatted_ratings,
            'packages': formatted_packages,
            'types': []  # Factory doesn't use types/subcategories
        })
        
    except Exception as e:
        logger.error(f"Error fetching factory related options: {e}")
        return Response(
            {"error": "Failed to fetch factory related options"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def create_factory_product(request):
    """
    Create a new product in factory_products table with auto-generated code
    """
    try:
        product_name = request.data.get('product_name', '').strip()
        if not product_name:
            return Response(
                {"error": "Product name is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate product code from first 3 characters of the first word
        def generate_product_code(name):
            first_word = name.split()[0] if name.split() else ''
            return first_word[:3].upper()
        
        product_code = generate_product_code(product_name)
        
        # Check if product code already exists
        if FactoryProduct.objects.filter(productcode=product_code).exists():
            return Response(
                {"error": f"Product code '{product_code}' already exists"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create new product
        product = FactoryProduct.objects.create(
            productname=product_name,
            productcode=product_code
        )
        
        return Response({
            'success': True,
            'product': {
                'id': str(product.productid),
                'name': product.productname,
                'code': product.productcode
            },
            'message': f'Product "{product_name}" created with code "{product_code}"'
        })
                
    except Exception as e:
        logger.error(f"Error creating factory product: {e}")
        return Response(
            {"error": "Failed to create factory product"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def create_factory_make(request):
    """
    Create a new make in factory_makes table with auto-generated code
    Requires product_id in request data
    """
    try:
        make_name = request.data.get('make_name', '').strip()
        product_id = request.data.get('product_id')
        
        if not make_name:
            return Response(
                {"error": "Make name is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not product_id:
            return Response(
                {"error": "Product ID is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            product = FactoryProduct.objects.get(productid=int(product_id))
        except (FactoryProduct.DoesNotExist, ValueError):
            return Response(
                {"error": "Invalid product ID"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate make code: 2 characters
        # More than one word = first letter of each (up to 2), 1 word = first 2 letters
        def generate_make_code(name):
            words = [word.strip() for word in name.split() if word.strip()]
            
            if len(words) > 1:
                # Take first letter of each word, pad to 2 chars
                code = ''.join(word[0] for word in words[:2]).upper()
                code = code.ljust(2, 'X')[:2]
            elif len(words) == 1:
                # Take first 2 letters of the single word
                word = words[0]
                code = word[:2].upper().ljust(2, 'X')[:2]
            else:
                # Fallback for empty input
                code = "XX"
            
            return code
        
        # Generate make code - same code for same make name across all products
        make_code = generate_make_code(make_name)
        
        # Check if make with this code already exists for this product
        # If it exists, return the existing make instead of creating a duplicate
        existing_make = FactoryMake.objects.filter(
            productid=product,
            makecode=make_code
        ).first()
        
        if existing_make:
            # Make already exists for this product with this code
            # Return the existing make
            logger.info(f"Make with code '{make_code}' already exists for product '{product.productname}'. Returning existing make: {existing_make.makename}")
            return Response({
                'success': True,
                'make': {
                    'id': str(existing_make.makeid),
                    'name': existing_make.makename,
                    'code': existing_make.makecode
                },
                'message': f'Make "{existing_make.makename}" with code "{make_code}" already exists for this product'
            })
        
        # Create new make with the generated code
        make = FactoryMake.objects.create(
            productid=product,
            makename=make_name,
            makecode=make_code
        )
        
        return Response({
            'success': True,
            'make': {
                'id': str(make.makeid),
                'name': make.makename,
                'code': make.makecode
            },
            'message': f'Make "{make_name}" created with code "{make_code}"'
        })
                
    except Exception as e:
        logger.error(f"Error creating factory make: {e}")
        return Response(
            {"error": "Failed to create factory make"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def create_factory_product_model(request):
    """
    Create a new product model for factory team
    """
    try:
        model_name = request.data.get('model_name', '').strip()
        if not model_name:
            return Response(
                {"error": "Product model name is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate model code: first 3 characters of name in uppercase
        def generate_model_code(name):
            # Take first 3 characters and convert to uppercase
            code = name.strip()[:3].upper()
            return code
        
        model_code = generate_model_code(model_name)
        
        # For factory team, we'll use a simple approach without database storage
        # Just return the generated code for now
        return Response({
            'success': True,
            'product_model': {
                'id': f"factory_{model_code}_{int(time.time())}",  # Generate unique ID
                'name': model_name,
                'code': model_code
            },
            'message': f'Product model "{model_name}" created with code "{model_code}"'
        })
                
    except Exception as e:
        logger.error(f"Error creating factory product model: {e}")
        return Response(
            {"error": "Failed to create factory product model"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def create_factory_rating(request):
    """
    Create a new rating in factory_ratings table
    Requires product_id in request data
    """
    try:
        rating_description = request.data.get('rating_name', '').strip()
        product_id = request.data.get('product_id')
        
        if not rating_description:
            return Response(
                {"error": "Rating name is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not product_id:
            return Response(
                {"error": "Product ID is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            product = FactoryProduct.objects.get(productid=int(product_id))
        except (FactoryProduct.DoesNotExist, ValueError):
            return Response(
                {"error": "Invalid product ID"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Remove ONLY spaces (keep symbols like dots), then take first 5 chars, NO padding
        rating_value = rating_description.replace(' ', '').upper()[:5]
        
        # Check if rating with this value already exists for this product
        if FactoryRating.objects.filter(productid=product, ratingvalue=rating_value).exists():
            return Response(
                {"error": f"A rating with the code '{rating_value}' derived from '{rating_description}' already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create new rating
        rating = FactoryRating.objects.create(
            productid=product,
            ratingvalue=rating_value,
            description=rating_description
        )
        
        return Response({
            'success': True,
            'rating': {
                'id': str(rating.ratingid),
                'name': rating.description or rating.ratingvalue,
                'code': rating.ratingvalue
            },
            'message': f'Rating "{rating_description}" created successfully with code "{rating_value}"'
        })
                
    except Exception as e:
        logger.error(f"Error creating factory rating: {e}")
        return Response(
            {"error": "Failed to create factory rating"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def create_factory_package(request):
    """
    Create a new package in factory_packages table
    Requires product_id in request data
    """
    try:
        package_name = request.data.get('package_name', '').strip()
        product_id = request.data.get('product_id')
        
        if not package_name:
            return Response(
                {"error": "Package name is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not product_id:
            return Response(
                {"error": "Product ID is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            product = FactoryProduct.objects.get(productid=int(product_id))
        except (FactoryProduct.DoesNotExist, ValueError):
            return Response(
                {"error": "Invalid product ID"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Generate package code: 4 characters
        package_code = (package_name[:4] if package_name else "NONE").upper().ljust(4, 'N')[:4]
        
        # Check if package with this code already exists for this product
        if FactoryPackage.objects.filter(productid=product, packagecode=package_code).exists():
            return Response(
                {"error": f"A package with the code '{package_code}' derived from '{package_name}' already exists."},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Create new package
        package = FactoryPackage.objects.create(
            productid=product,
            packagecode=package_code,
            packagedesc=package_name
        )
        
        return Response({
            'success': True,
            'package': {
                'id': str(package.packageid),
                'name': package.packagedesc,
                'code': package.packagecode
            },
            'message': f'Package "{package_name}" created successfully with code "{package_code}"'
        })
                
    except Exception as e:
        logger.error(f"Error creating factory package: {e}")
        return Response(
            {"error": "Failed to create factory package"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_factory_ratings(request):
    """
    Get all factory ratings
    Optionally filter by product_id
    """
    try:
        product_id = request.GET.get('product_id')
        
        ratings_query = FactoryRating.objects.all()
        if product_id:
            try:
                ratings_query = ratings_query.filter(productid_id=int(product_id))
            except ValueError:
                pass
        
        ratings = ratings_query.order_by('ratingvalue')
        
        formatted_ratings = [
            {
                'id': str(rating.ratingid),
                'name': rating.description or rating.ratingvalue,
                'code': rating.ratingvalue
            }
            for rating in ratings
        ]
        
        return Response({
            'ratings': formatted_ratings
        })
        
    except Exception as e:
        logger.error(f"Error fetching factory ratings: {e}")
        return Response(
            {"error": "Failed to fetch factory ratings"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_factory_mpns(request):
    """
    Get MPNs filtered by make_id and/or product_id
    Returns MPNs with per-make auto-generated sequential codes (001, 002, 003...)
    """
    try:
        make_id = request.GET.get('make_id')
        product_id = request.GET.get('product_id')
        
        mpns_query = FactoryMPN.objects.select_related('makeid', 'makeid__productid').all()
        
        if make_id:
            try:
                mpns_query = mpns_query.filter(makeid_id=int(make_id))
            except ValueError:
                pass
        
        if product_id:
            try:
                mpns_query = mpns_query.filter(makeid__productid_id=int(product_id))
            except ValueError:
                pass
        
        mpns = mpns_query.order_by('mpnfull')
        
        formatted_mpns = [
            {
                'id': str(mpn.mpnid),
                'name': mpn.mpnfull,
                'code': mpn.mpncode,
                'make_id': str(mpn.makeid.makeid),
                'make_name': mpn.makeid.makename,
                'product_id': str(mpn.makeid.productid.productid),
                'product_name': mpn.makeid.productid.productname
            }
            for mpn in mpns
        ]
        
        return Response({
            'mpns': formatted_mpns
        })
            
    except Exception as e:
        logger.error(f"Error fetching factory MPNs: {e}")
        return Response(
            {"error": "Failed to fetch factory MPNs"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def create_factory_mpn(request):
    """
    Create a new MPN with per-make auto-generated sequential code (001, 002, 003...)
    Each make has its own independent sequence
    Requires make_id and product_id
    """
    try:
        mpn_full = request.data.get('mpn_full', '').strip()
        make_id = request.data.get('make_id')
        product_id = request.data.get('product_id')
        
        logger.info(f"create_factory_mpn received: mpn_full={mpn_full}, make_id={make_id}, product_id={product_id}")

        if not mpn_full:
            return Response(
                {"error": "MPN full name is required"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not make_id:
            return Response(
                {"error": "Make ID is required for per-make MPN creation"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        if not product_id:
            return Response(
                {"error": "Product ID is required for MPN creation"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            make_id = int(make_id)
            product_id = int(product_id)
        except (ValueError, TypeError):
            return Response(
                {"error": "Invalid make ID or product ID format"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            make = FactoryMake.objects.get(makeid=make_id, productid_id=product_id)
        except FactoryMake.DoesNotExist:
            return Response(
                {"error": "Make not found or does not belong to the specified product"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # Check if MPN already exists for this specific make
        if FactoryMPN.objects.filter(makeid=make, mpnfull=mpn_full).exists():
            return Response(
                {"error": f"MPN '{mpn_full}' already exists for this product-make combination"}, 
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # PER-PRODUCT-MAKE MPN SEQUENCING: Generate code based on THIS specific make only
        # Get existing MPNs for THIS specific make (product + make combination)
        existing_mpns = FactoryMPN.objects.filter(makeid=make)
        
        logger.info(f"Per-product-make MPN creation for make '{make.makename}' (Product: {make.productid.productname}): found {existing_mpns.count()} existing MPNs")
        
        max_number = 0
        for mpn in existing_mpns:
            mpn_code = mpn.mpncode.strip()
            # Check if it's pure numeric
            if mpn_code.isdigit():
                max_number = max(max_number, int(mpn_code))
            # Check if it starts with MPN followed by digits
            elif mpn_code.startswith('MPN') and mpn_code[3:].isdigit():
                max_number = max(max_number, int(mpn_code[3:]))
        
        next_number = max_number + 1
        mpn_code = f"{next_number:03d}"  # Format as 001, 002, etc.
        
        logger.info(f"Creating MPN '{mpn_full}' with code '{mpn_code}' for make '{make.makename}' (Product: {make.productid.productname}) (previous max: {max_number})")
        
        # Create new MPN
        mpn = FactoryMPN.objects.create(
            makeid=make,
            mpncode=mpn_code,
            mpnfull=mpn_full
        )
        
        return Response({
            'success': True,
            'mpn': {
                'id': str(mpn.mpnid),
                'full': mpn.mpnfull,
                'code': mpn.mpncode
            },
            'message': f'MPN "{mpn_full}" created with code "{mpn_code}" for make ID {make_id} (Product: {make.productid.productname})'
        })
                
    except Exception as e:
        logger.error(f"Error creating factory MPN: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {"error": "Failed to create factory MPN"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


def generate_factory_full_part_number(product_code, make_code, mpn_code, package_code, rating_code):
    """Generate factory full part number
    Format: Product(3) + Make(2) + MPN(3) + Rating(5) + Package(4)
    Structure: ProductName - Make - MPN - RATING - PACKAGE (no hyphens)
    """
    # Ensure exact lengths
    product_code = (product_code[:3] if product_code else "XXX").ljust(3, 'X')[:3]
    make_code = (make_code[:2] if make_code else "XX").ljust(2, 'X')[:2]
    mpn_code = (mpn_code[:3] if mpn_code else "001").zfill(3)[:3]
    # Remove spaces from rating_code before processing
    rating_code_no_spaces = rating_code.replace(' ', '') if rating_code else ""
    rating_code = (rating_code_no_spaces[:5] if rating_code_no_spaces else "00000").ljust(5, '0')[:5]
    package_code = (package_code[:4] if package_code else "NONE").ljust(4, 'N')[:4]
    
    # Order: Product - Make - MPN - Rating - Package (no hyphens)
    return f"{product_code}{make_code}{mpn_code}{rating_code}{package_code}"


@api_view(['GET'])
def get_next_mpn_code(request):
    """
    Get the next MPN code for a given Make ID.
    Used for real-time preview of item codes.
    """
    try:
        make_id = request.GET.get('make_id')
        if not make_id:
            return Response(
                {"error": "Make ID is required"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        try:
            make = FactoryMake.objects.get(makeid=int(make_id))
        except (FactoryMake.DoesNotExist, ValueError):
            return Response(
                {"error": "Invalid Make ID"},
                status=status.HTTP_400_BAD_REQUEST
            )
        
        # PER-PRODUCT-MAKE MPN SEQUENCING: Find the highest MPN code for THIS specific make (product + make combination)
        # Get all MPNs for this specific make only
        existing_mpns = FactoryMPN.objects.filter(makeid=make)
        max_number = 0
        
        logger.info(f"Per-product-make MPN sequencing for make '{make.makename}' (ID: {make.makeid}, Product: {make.productid.productname}): found {existing_mpns.count()} existing MPNs")
        
        for existing_mpn in existing_mpns:
            mpn_code_val = existing_mpn.mpncode.strip()
            if mpn_code_val.isdigit():
                max_number = max(max_number, int(mpn_code_val))
            elif mpn_code_val.startswith('MPN') and mpn_code_val[3:].isdigit():
                max_number = max(max_number, int(mpn_code_val[3:]))
        
        next_number = max_number + 1
        next_mpn_code = f"{next_number:03d}"
        
        logger.info(f"Next MPN code for make '{make.makename}' (Product: {make.productid.productname}): {next_mpn_code} (previous max: {max_number})")
        
        return Response({
            'success': True,
            'mpn_code': next_mpn_code,
            'make_id': str(make.makeid),
            'make_name': make.makename,
            'product_id': str(make.productid.productid),
            'product_name': make.productid.productname
        })
        
    except Exception as e:
        logger.error(f"Error getting next MPN code: {e}")
        return Response(
            {"error": "Failed to get next MPN code"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def submit_factory_item_request(request):
    """
    Submit a complete factory item to the factory_itemrequest table.
    This endpoint saves form data as a request for approval.
    """
    try:
        # Extract and validate required form data
        product_name = request.data.get('productName', '').strip()
        product_code = request.data.get('productCode', '').strip()
        make_name = request.data.get('make', '').strip()
        make_code = request.data.get('makeCode', '').strip()
        # Prefer explicit identifiers if the frontend passes them
        product_id_raw = request.data.get('productId')
        make_id_raw = request.data.get('makeId')
        mpn_full = request.data.get('mfgPartNo', '').strip()
        item_description = request.data.get('itemDescription', '').strip()

        # Log received data for debugging
        logger.info(f"Received factory item submission: product_name='{product_name}', make_name='{make_name}', mpn_full='{mpn_full}', item_description='{item_description}'")
        
        if not all([product_name, make_name, mpn_full, item_description]):
            missing_fields = []
            if not product_name:
                missing_fields.append("product_name")
            if not make_name:
                missing_fields.append("make")
            if not mpn_full:
                missing_fields.append("mfgPartNo (MPN)")
            if not item_description:
                missing_fields.append("itemDescription")
            
            logger.error(f"Missing required fields: {missing_fields}")
            return Response(
                {"error": f"Product name, make, MPN, and item description are required. Missing: {', '.join(missing_fields)}"}, 
                status=status.HTTP_400_BAD_REQUEST
            )

        # Generate codes if not provided
        # Product: 3 characters
        if not product_code:
            product_code = (product_name[:3] if product_name else "XXX").upper().ljust(3, 'X')[:3]
        else:
            product_code = product_code[:3].upper().ljust(3, 'X')[:3]

        # Make: 2 characters
        if not make_code:
            make_code = (make_name[:2] if make_name else "XX").upper().ljust(2, 'X')[:2]
        else:
            make_code = make_code[:2].upper().ljust(2, 'X')[:2]

        with transaction.atomic():
            # Resolve Product strictly (do NOT create implicitly)
            product = None
            if product_id_raw:
                try:
                    product = FactoryProduct.objects.get(productid=int(product_id_raw))
                except (FactoryProduct.DoesNotExist, ValueError, TypeError):
                    return Response({"error": "Invalid productId supplied"}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Try by code first, then by name
                product = FactoryProduct.objects.filter(productcode=product_code).first()
                if not product and product_name:
                    product = FactoryProduct.objects.filter(productname__iexact=product_name).first()
                if not product:
                    return Response({"error": "Product not found. Please select a valid existing product."}, status=status.HTTP_400_BAD_REQUEST)
            db_product_code = product.productcode

            # Resolve Make with flexible matching for global MPN sequencing
            make = None
            if make_id_raw:
                try:
                    # First try to get the exact make for this product
                    make = FactoryMake.objects.get(makeid=int(make_id_raw), productid=product)
                except (FactoryMake.DoesNotExist, ValueError, TypeError):
                    # If not found, try to find a make with the same name for this product
                    # This handles the case where frontend sends makeId from different product
                    try:
                        source_make = FactoryMake.objects.get(makeid=int(make_id_raw))
                        make = FactoryMake.objects.filter(productid=product, makename__iexact=source_make.makename).first()
                        if not make:
                            logger.error(f"Make '{source_make.makename}' not found for product '{product.productname}'")
                            return Response({"error": f"Make '{source_make.makename}' not found for product '{product.productname}'. Please select an existing make."}, status=status.HTTP_400_BAD_REQUEST)
                        logger.info(f"Resolved makeId {make_id_raw} to make '{make.makename}' (id: {make.makeid}) for product '{product.productname}'")
                    except FactoryMake.DoesNotExist:
                        logger.error(f"Invalid makeId {make_id_raw}")
                        return Response({"error": "Invalid makeId"}, status=status.HTTP_400_BAD_REQUEST)
            else:
                # Try by makecode tied to product, then by name
                make = FactoryMake.objects.filter(productid=product, makecode=make_code).first()
                if not make and make_name:
                    make = FactoryMake.objects.filter(productid=product, makename__iexact=make_name).first()
                if not make:
                    # Debug: show available makes for this product
                    available_makes = FactoryMake.objects.filter(productid=product).values_list('makename', 'makecode')
                    logger.error(f"Make '{make_name}' (code: '{make_code}') not found for product '{product.productname}'. Available makes: {list(available_makes)}")
                    return Response({"error": f"Make '{make_name}' not found for product '{product.productname}'. Please select an existing make."}, status=status.HTTP_400_BAD_REQUEST)
            db_make_code = make.makecode
            
            # Get or create MPN (linked to make) with PER-PRODUCT-MAKE sequencing
            # First, reuse existing MPN with same full value if present for THIS specific make
            mpn = FactoryMPN.objects.filter(makeid=make, mpnfull=mpn_full).first()
            
            if mpn is None:
                # PER-PRODUCT-MAKE MPN SEQUENCING: Generate next code based on THIS specific make only
                # Lock existing rows for THIS make to prevent races
                list(FactoryMPN.objects.select_for_update().filter(makeid=make).only('mpnid'))
                
                # Find highest existing MPN code for THIS specific make (product + make combination)
                existing_mpns = FactoryMPN.objects.filter(makeid=make)
                max_number = 0
                
                for existing_mpn in existing_mpns:
                    mpn_code_val = existing_mpn.mpncode.strip()
                    if mpn_code_val.isdigit():
                        max_number = max(max_number, int(mpn_code_val))
                    elif mpn_code_val.startswith('MPN') and mpn_code_val[3:].isdigit():
                        max_number = max(max_number, int(mpn_code_val[3:]))
                
                next_number = max_number + 1
                next_code = f"{next_number:03d}"
                
                logger.info(f"Creating new MPN '{mpn_full}' with code '{next_code}' for make '{make.makename}' (ID: {make.makeid}, Product: {product.productname}) (previous max: {max_number})")
                
                mpn = FactoryMPN.objects.create(
                    makeid=make,
                    mpncode=next_code,
                    mpnfull=mpn_full
                )
            
            mpn_code = mpn.mpncode

            # Get or create package in factory_packages table
            package_input = request.data.get('package', '').strip()
            package_code = (package_input[:4] if package_input else "NONE").upper().ljust(4, 'N')[:4]
            
            # Store package in factory_packages table if it's not the default "NONE"
            if package_input and package_input.upper() != "NONE":
                package_obj, created = FactoryPackage.objects.get_or_create(
                    productid=product,
                    packagecode=package_code,
                    defaults={
                        'packagedesc': package_input
                    }
                )
                if created:
                    logger.info(f"Created new package '{package_input}' with code '{package_code}' for product '{product.productname}'")
                else:
                    logger.info(f"Using existing package '{package_obj.packagedesc}' with code '{package_code}' for product '{product.productname}'")
            
            # Generate rating code - 5 characters
            # Use materialRatingCode if provided (from dropdown selection), otherwise generate from materialRating name
            rating_code_input = request.data.get('materialRatingCode', '').strip()
            rating_name_input = request.data.get('materialRating', '').strip()
            
            if rating_code_input:
                # Use the code directly from the selected rating
                rating_code = rating_code_input.upper().ljust(5, '0')[:5]
            else:
                # Fallback: generate from name (remove spaces before taking first 5 chars)
                rating_name_no_spaces = rating_name_input.replace(' ', '')
                rating_code = (rating_name_no_spaces[:5] if rating_name_no_spaces else "00000").upper().ljust(5, '0')[:5]

            full_part_number = generate_factory_full_part_number(
                product_code=db_product_code,
                make_code=db_make_code,
                mpn_code=mpn_code,
                package_code=package_code,
                rating_code=rating_code
            )
            
            logger.info(f"Generated factory part number: {full_part_number}")

            # Fetch descriptions from related tables
            # Get rating description from factory_ratings table
            rating_description = ""
            if rating_name_input:
                rating_obj = FactoryRating.objects.filter(
                    productid=product, 
                    ratingvalue__iexact=rating_code_input or rating_name_input
                ).first()
                if rating_obj:
                    rating_description = rating_obj.description or ""

            # Get package description from factory_packages table
            package_description = ""
            if package_input and package_input.upper() != "NONE":
                package_obj = FactoryPackage.objects.filter(
                    productid=product,
                    packagecode=package_code
                ).first()
                if package_obj:
                    package_description = package_obj.packagedesc or ""

            # Create or get item description in factory_itemdescriptions table
            if item_description:
                item_desc_obj, created = FactoryItemDescription.objects.get_or_create(
                    productid=product,
                    itemdesc=item_description
                )
                if created:
                    logger.info(f"Created new item description '{item_description}' for product '{product.productname}'")
                else:
                    logger.info(f"Using existing item description '{item_description}' for product '{product.productname}'")

            # Create item request with new fields
            item_request = FactoryItemRequest.objects.create(
                requestor=request.data.get('requestor', 'Unknown'),
                productid=product,
                makeid=make,
                productname=product_name,
                productcode=db_product_code,
                makename=make_name,
                makecode=db_make_code,
                mpnfull=mpn_full,
                mpncode=mpn_code,  # NEW: From factory_mpns table
                ratingvalue=rating_name_input,
                description=rating_description,  # NEW: From factory_ratings table
                packagecode=package_code,
                packagedesc=package_description,  # NEW: From factory_packages table
                itemdesc=item_description,  # From factory_itemdescription table (general item description)
                uom=request.data.get('uom', ''),
                moq=request.data.get('moq', 0) or 0,
                lead_time=request.data.get('leadTime', 0) or 0,
                hsn_code=request.data.get('hsnCode', ''),
                bin_location=request.data.get('bin', ''),
                full_part_number=full_part_number,
                status='draft'
            )

            return Response({
                'success': True,
                'request_id': item_request.request_id,
                'full_part_number': full_part_number,
                'product_code': db_product_code,
                'make_code': db_make_code,
                'mpn_code': mpn_code,
                'rating_code': rating_code,
                'package_code': package_code,
                'message': 'Factory item request submitted successfully for approval.'
            }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Error creating factory item request: {type(e).__name__} - {e}")
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {"error": "Failed to create factory item request", "details": f"{type(e).__name__}: {e}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def get_factory_items(request):
    """
    Get all factory items from factory_itemmaster table
    """
    try:
        items = FactoryItemMaster.objects.all().order_by('-created_at')
        
        items_data = [
            {
                'item_id': item.item_id,
                'product_name': item.product_name,
                'make_name': item.make_name,
                'mpn_full': item.mpn_full,
                'material_rating': item.material_rating,
                'package_type': item.package_type,
                'item_description': item.item_description,
                'full_part_number': item.full_part_number,
                'uom': item.uom,
                'moq': item.moq,
                'lead_time': item.lead_time,
                'hsn_code': item.hsn_code,
                'bin_location': item.bin_location,
                'created_by': item.created_by,
                'created_at': item.created_at.isoformat() if item.created_at else None
            }
            for item in items
        ]
        
        return Response({
            'items': items_data,
            'count': len(items_data)
        })
            
    except Exception as e:
        logger.error(f"Error fetching factory items: {e}")
        return Response(
            {"error": "Failed to fetch factory items"}, 
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


class CombinedItemRequestView(APIView):
    def get(self, request, *args, **kwargs):
        try:
            status_filter = request.GET.get('status')
            if not status_filter:
                return Response({"error": "A 'status' query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

            statuses = [s.strip() for s in status_filter.split(',')]

            # Fetch purchase item requests
            purchase_requests = ItemRequest.objects.filter(status__in=statuses)
            purchase_serializer = ItemRequestSerializer(purchase_requests, many=True)
            purchase_data = purchase_serializer.data
            for item in purchase_data:
                item['type'] = 'purchase'
            
            # Fetch factory item requests using Django ORM
            factory_requests_qs = FactoryItemRequest.objects.filter(status__in=statuses)
            factory_requests = []
            for req in factory_requests_qs:
                factory_requests.append({
                    'request_id': req.request_id,
                    'requestor': req.requestor,
                    'productname': req.productname,
                    'productcode': req.productcode,
                    'makename': req.makename,
                    'makecode': req.makecode,
                    'mpnfull': req.mpnfull,
                    'mpncode': req.mpncode,  # NEW: From factory_mpns table
                    'ratingvalue': req.ratingvalue,
                    'description': req.description,  # NEW: From factory_ratings table
                    'packagecode': req.packagecode,
                    'packagedesc': req.packagedesc,  # NEW: From factory_packages table
                    'itemdesc': req.itemdesc,  # From factory_itemdescription table
                    'uom': req.uom,
                    'moq': req.moq,
                    'lead_time': req.lead_time,
                    'hsn_code': req.hsn_code,
                    'bin_location': req.bin_location,
                    'full_part_number': req.full_part_number,
                    'status': req.status,
                    'rejection_reason': req.rejection_reason,
                    'approved_by': req.approved_by,
                    'rejected_by': req.rejected_by,
                    'created_at': req.created_at.isoformat() if req.created_at else None,
                    'updated_at': req.updated_at.isoformat() if req.updated_at else None,
                })
            
            factory_serializer = FactoryItemRequestSerializer(factory_requests, many=True)
            factory_data = factory_serializer.data
            for item in factory_data:
                item['type'] = 'factory'
            
            # Combine and sort by creation date
            combined_data = sorted(
                purchase_data + factory_data, 
                key=lambda x: x.get('created_at', ''), 
                reverse=True
            )
            
            return Response(combined_data)

        except Exception as e:
            logger.error(f"Error in CombinedItemRequestView: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return Response(
                {"error": "Failed to fetch combined item requests"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class UpdateFactoryItemRequestView(APIView):
    def post(self, request, request_id, *args, **kwargs):
        try:
            try:
                item_request = FactoryItemRequest.objects.get(request_id=request_id)
            except FactoryItemRequest.DoesNotExist:
                return Response(
                    {"error": "Factory item request not found"},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Update fields from request data
            update_data = request.data
            
            # Map frontend field names to backend field names for factory items
            field_mapping = {
                'materialRatingCode': 'ratingvalue',
                'packageCode': 'packagecode',
                'mfgPartCode': 'mpncode',
                'productName': 'productname',
                'productCode': 'productcode',
                'make': 'makename',
                'makeCode': 'makecode',
                'mfgPartNo': 'mpnfull',
                'itemDescription': 'itemdesc',
                'package': 'packagedesc',
                'leadTime': 'lead_time',
                'hsnCode': 'hsn_code',
                'bin': 'bin_location',
            }
            
            # Track if we need to regenerate part number
            regenerate_part_number = False
            
            for key, value in update_data.items():
                # Map frontend field name to backend field name
                backend_key = field_mapping.get(key, key)
                
                if hasattr(item_request, backend_key):
                    old_value = getattr(item_request, backend_key)
                    if old_value != value:
                        setattr(item_request, backend_key, value)
                        # Check if this field affects part number
                        if backend_key in ['productcode', 'makecode', 'mpncode', 'ratingvalue', 'packagecode']:
                            regenerate_part_number = True
            
            # Regenerate full part number if needed
            if regenerate_part_number or 'cimcon_part_no' in update_data:
                product_code = item_request.productcode or "XXX"
                make_code = item_request.makecode or "XX"
                mpn_code = item_request.mpncode or "001"
                rating_code = (item_request.ratingvalue or "").replace(' ', '').upper()[:5]
                package_code = item_request.packagecode or "NONE"
                
                item_request.full_part_number = generate_factory_full_part_number(
                    product_code=product_code,
                    make_code=make_code,
                    mpn_code=mpn_code,
                    package_code=package_code,
                    rating_code=rating_code
                )
                logger.info(f"Regenerated part number: {item_request.full_part_number}")
            
            # Sync changes to master tables if needed
            if item_request.productid and item_request.itemdesc:
                # Update or create item description in factory_itemdescriptions
                FactoryItemDescription.objects.get_or_create(
                    productid=item_request.productid,
                    itemdesc=item_request.itemdesc
                )
            
            if item_request.productid and item_request.packagecode and item_request.packagedesc:
                # Update or create package in factory_packages
                FactoryPackage.objects.update_or_create(
                    productid=item_request.productid,
                    packagecode=item_request.packagecode,
                    defaults={'packagedesc': item_request.packagedesc}
                )
            
            item_request.save()
            
            return Response({
                "success": True, 
                "message": "Factory item request updated successfully.",
                "full_part_number": item_request.full_part_number
            })

        except Exception as e:
            logger.error(f"Error updating factory item request: {e}")
            import traceback
            logger.error(traceback.format_exc())
            return Response(
                {"error": f"Failed to update factory item request: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


@api_view(['POST'])
def approve_factory_item_request(request, request_id):
    """Approve a factory item request and add it to the item master table"""
    try:
        try:
            item_request = FactoryItemRequest.objects.get(request_id=request_id)
        except FactoryItemRequest.DoesNotExist:
            return Response({"error": "Item request not found"}, status=status.HTTP_404_NOT_FOUND)

        # Check if the item is already in the master table to prevent duplicates
        if FactoryItemMaster.objects.filter(full_part_number=item_request.full_part_number).exists():
            # If it already exists, just ensure the status is updated and return
            # Get approved_by from request data (sent by frontend) or fallback to request.user
            approved_by = request.data.get('approved_by') or getattr(request.user, 'username', 'Unknown')
            item_request.status = 'approved'
            item_request.approved_by = approved_by
            item_request.save()
            return Response({"success": True, "message": "Item already exists in master. Status updated."})

        # Update the status to 'approved'
        # Get approved_by from request data (sent by frontend) or fallback to request.user
        approved_by = request.data.get('approved_by') or getattr(request.user, 'username', 'Unknown')
        item_request.status = 'approved'
        item_request.approved_by = approved_by
        item_request.save()
        
        # Insert the item into the master table
        master_item = FactoryItemMaster.objects.create(
            product_name=item_request.productname,
            make_name=item_request.makename,
            mpn_full=item_request.mpnfull,
            material_rating=item_request.ratingvalue,
            package_type=item_request.packagecode,
            item_description=item_request.itemdesc,
            full_part_number=item_request.full_part_number,
            uom=item_request.uom,
            moq=item_request.moq or 0,
            lead_time=item_request.lead_time or 0,
            hsn_code=item_request.hsn_code,
            bin_location=item_request.bin_location,
            created_by=item_request.requestor
        )
        
        return Response({"success": True, "message": "Factory item request approved and added to master."})

    except Exception as e:
        logger.error(f"Error approving factory item request: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {"error": f"Failed to approve factory item request: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['POST'])
def reject_factory_item_request(request, request_id):
    """Reject a factory item request"""
    try:
        try:
            item_request = FactoryItemRequest.objects.get(request_id=request_id)
        except FactoryItemRequest.DoesNotExist:
            return Response({"error": "Item request not found"}, status=status.HTTP_404_NOT_FOUND)
        
        # Get rejected_by from request data (sent by frontend) or fallback to request.user
        rejected_by = request.data.get('rejected_by') or getattr(request.user, 'username', 'Unknown')
        logger.info(f"Rejecting item. User: {rejected_by}")
        rejection_reason = request.data.get('reason', '')
        
        item_request.status = 'rejected'
        item_request.rejected_by = rejected_by
        item_request.rejection_reason = rejection_reason
        item_request.save()
        
        return Response({"success": True, "message": "Factory item request rejected successfully."})

    except Exception as e:
        logger.error(f"Error rejecting factory item request: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return Response(
            {"error": f"Failed to reject factory item request: {str(e)}"},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def debug_factory_data(request):
    """Debug factory data structure"""
    try:
        # Get factory requests
        factory_requests_qs = FactoryItemRequest.objects.filter(status__in=['draft', 'rejected'])
        
        factory_requests = []
        for req in factory_requests_qs:
            factory_requests.append({
                'request_id': req.request_id,
                'requestor': req.requestor,
                'productname': req.productname,
                'status': req.status,
                'created_at': req.created_at.isoformat() if req.created_at else None,
            })
        
        # Test serialization
        if factory_requests:
            serializer = FactoryItemRequestSerializer(factory_requests, many=True)
            serialized_data = serializer.data
            
            return Response({
                "raw_data_sample": factory_requests[0] if factory_requests else None,
                "serialized_data_sample": serialized_data[0] if serialized_data else None,
                "raw_data_keys": list(factory_requests[0].keys()) if factory_requests else [],
                "serialized_data_keys": list(serialized_data[0].keys()) if serialized_data else [],
                "total_count": len(factory_requests)
            })
        else:
            return Response({
                "message": "No factory requests found",
                "raw_data_sample": None,
                "serialized_data_sample": None
            })
                
    except Exception as e:
        logger.error(f"Debug factory data failed: {e}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return Response({"error": str(e)}, status=500)