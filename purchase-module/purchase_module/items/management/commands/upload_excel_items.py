import os
import pandas as pd
from django.core.management.base import BaseCommand
from django.core.exceptions import ObjectDoesNotExist
from items.models import MainCategory, SubCategory, ProductRating, Make, ProductModel, Remarks, ItemMaster
import traceback

class Command(BaseCommand):
    help = "Import data from an Excel file into Django models"
    
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # We don't need to initialize verbosity here anymore

    # Remove this method entirely
    # def add_arguments(self, parser):
    #     parser.add_argument(
    #         '-v', '--verbosity',
    #         action='store',
    #         dest='verbosity',
    #         default=1,
    #         type=int,
    #         help='Verbosity level; 0=minimal output, 1=normal output, 2=verbose output, 3=very verbose output',
    #     )

    def handle(self, *args, **options):
        self.verbosity = options.get('verbosity', 1)  # Get verbosity from Django's options
        # Rest of the code remains the same
        file_path = os.path.join(os.path.dirname(__file__), "final_import_data from prityush - with MPN - 06august.xlsx")
        if not os.path.exists(file_path):
            self.stderr.write(self.style.ERROR(f"File not found: {file_path}"))
            return

        self.stdout.write(self.style.SUCCESS("Starting data import..."))

        try:
            xls = pd.ExcelFile(file_path)
            
            # Create error log file
            error_log_path = os.path.join(os.path.dirname(__file__), "import_errors.log")
            with open(error_log_path, 'a') as f:  # Append mode
                f.write("Data Import Error Log\n")
                f.write("="*50 + "\n\n")
            
            # First import MainCategory as it's needed by all others
            self.import_main_category(xls, error_log_path)
            
            # Then import all dependent models
            self.import_sub_category(xls, error_log_path)
            self.import_product_rating(xls, error_log_path)
            self.import_make(xls, error_log_path)
            self.import_product_model(xls, error_log_path)
            self.import_remarks(xls, error_log_path)
            self.import_item_master(xls, error_log_path)

            self.stdout.write(self.style.SUCCESS("Data import completed successfully!"))
            self.stdout.write(self.style.WARNING(f"Check {error_log_path} for any errors that occurred during import."))

        except Exception as e:
            error_msg = f"FATAL ERROR reading the Excel file: {str(e)}\n{traceback.format_exc()}"
            self.stderr.write(self.style.ERROR(error_msg))
            with open(error_log_path, 'a') as f:
                f.write("\nFATAL ERROR:\n")
                f.write(error_msg)

    def log_error(self, error_log_path, sheet_name, row_data, error_msg):
        """Helper method to log errors consistently"""
        error_entry = f"""
ERROR in {sheet_name} sheet:
Row data: {row_data}
Error: {error_msg}
{"-"*50}
"""
        with open(error_log_path, 'a') as f:
            f.write(error_entry)
        self.stderr.write(self.style.ERROR(f"Error logged for {sheet_name} - see log for details"))

    def import_main_category(self, xls, error_log_path):
        sheet_name = "MainCategory"
        df = xls.parse(sheet_name)
        total_rows = len(df)
        success_count = 0
        
        self.stdout.write(f"\nImporting {sheet_name} ({total_rows} rows)...")
        
        for index, row in df.iterrows():
            try:
                # Convert row to dict for better error logging
                row_data = {k: v for k, v in row.items()}
                
                # Skip completely empty rows
                if all(pd.isna(v) for v in row_data.values()):
                    continue
                
                # Validate required fields
                if pd.isna(row["ID"]) or pd.isna(row["main_category_code"]) or pd.isna(row["main_category_name"]):
                    raise ValueError("Missing required field (ID, code, or name)")
                
                obj, created = MainCategory.objects.update_or_create(
                    id=int(row["ID"]),  # Ensure ID is integer
                    defaults={
                        "code": str(row["main_category_code"]).strip(),
                        "name": str(row["main_category_name"]).strip()
                    }
                )
                success_count += 1
                if created:
                    self.stdout.write(f"Created MainCategory: ID={obj.id}, Code={obj.code}")
                else:
                    if self.verbosity >= 2:
                        self.stdout.write(f"Updated MainCategory: ID={obj.id}")
                    
            except Exception as e:
                error_msg = f"Row {index+2} (Excel row {index+2}): {str(e)}\n{traceback.format_exc()}"
                self.log_error(error_log_path, sheet_name, row_data, error_msg)
        
        self.stdout.write(self.style.SUCCESS(
            f"MainCategory import complete: {success_count} succeeded, {total_rows-success_count} failed"
        ))

    def import_sub_category(self, xls, error_log_path):
        sheet_name = "SubCategory"
        df = xls.parse(sheet_name)
        total_rows = len(df)
        success_count = 0
        
        self.stdout.write(f"\nImporting {sheet_name} ({total_rows} rows)...")
        
        for index, row in df.iterrows():
            try:
                row_data = {k: v for k, v in row.items()}
                
                # Skip completely empty rows
                if all(pd.isna(v) for v in row_data.values()):
                    continue
                
                # Validate required fields
                if pd.isna(row["main_category_id"]) or pd.isna(row["sub_category_code"]) or pd.isna(row["sub_category_name"]):
                    raise ValueError("Missing required field (main_category_id, code, or name)")
                
                # Get main category
                try:
                    main_category = MainCategory.objects.get(id=int(row["main_category_id"]))
                except MainCategory.DoesNotExist:
                    raise ValueError(f"MainCategory with ID {row['main_category_id']} does not exist")
                
                # Clean data - truncate to 5 characters instead of 2
                code = str(row["sub_category_code"]).strip()[:5]  # Allow up to 5 chars
                name = str(row["sub_category_name"]).strip()
                
                obj, created = SubCategory.objects.update_or_create(
                    code=code,
                    main_category=main_category,
                    defaults={"name": name}
                )
                success_count += 1
                if created:
                    self.stdout.write(f"Created SubCategory: {code} - {name}")
                else:
                    if self.verbosity >= 2:
                        self.stdout.write(f"Updated SubCategory: {code}")
                    
            except Exception as e:
                error_msg = f"Row {index+2}: {str(e)}\n{traceback.format_exc()}"
                self.log_error(error_log_path, sheet_name, row_data, error_msg)
        
        self.stdout.write(self.style.SUCCESS(
            f"SubCategory import complete: {success_count} succeeded, {total_rows-success_count} failed"
        ))

    def import_product_rating(self, xls, error_log_path):
        sheet_name = "ProductRating"
        df = xls.parse(sheet_name)
        total_rows = len(df)
        success_count = 0
        
        self.stdout.write(f"\nImporting {sheet_name} ({total_rows} rows)...")
        
        for index, row in df.iterrows():
            try:
                row_data = {k: v for k, v in row.items()}
                
                # Skip completely empty rows
                if all(pd.isna(v) for v in row_data.values()):
                    continue
                
                # REMOVE THIS VALIDATION - let missing data fail naturally
                # required_fields = ["main_category_id", "product_rating_code", "product_rating_name"]
                # if any(pd.isna(row[field]) for field in required_fields if field in row):
                #     raise ValueError(f"Missing one or more required fields: {required_fields}")
                
                # Get main category - let it fail if missing
                try:
                    main_category = MainCategory.objects.get(id=int(row["main_category_id"]))
                except (MainCategory.DoesNotExist, ValueError, KeyError):
                    raise ValueError(f"Invalid or missing main_category_id: {row.get('main_category_id', 'N/A')}")
                
                # Get sub category if provided - check if column exists first
                sub_category = None
                if 'sub_category_code' in row and not pd.isna(row["sub_category_code"]):
                    sub_category = SubCategory.objects.filter(
                        code=str(row["sub_category_code"]).strip(),
                        main_category=main_category
                    ).first()
                    if not sub_category:
                        self.stdout.write(self.style.WARNING(
                            f"Row {index+2}: SubCategory {row['sub_category_code']} not found, proceeding without it"
                        ))
                
                # Clean and format code - let it fail if missing
                code = str(row["product_rating_code"]).zfill(3)
                name = str(row["product_rating_name"]).strip()
                
                obj, created = ProductRating.objects.update_or_create(
                    code=code,
                    main_category=main_category,
                    sub_category=sub_category,
                    defaults={"name": name}
                )
                success_count += 1
                if self.verbosity >= 2:
                    self.stdout.write(f"{'Created' if created else 'Updated'} ProductRating: {code} - {name}")
                    
            except Exception as e:
                error_msg = f"Row {index+2}: {str(e)}\n{traceback.format_exc()}"
                self.log_error(error_log_path, sheet_name, row_data, error_msg)
        
        self.stdout.write(self.style.SUCCESS(
            f"ProductRating import complete: {success_count} succeeded, {total_rows-success_count} failed"
        ))

    def import_make(self, xls, error_log_path):
        sheet_name = "Make"
        df = xls.parse(sheet_name)
        total_rows = len(df)
        success_count = 0
        
        self.stdout.write(f"\nImporting {sheet_name} ({total_rows} rows)...")
        
        for index, row in df.iterrows():
            try:
                row_data = {k: v for k, v in row.items()}
                
                # Skip completely empty rows
                if all(pd.isna(v) for v in row_data.values()):
                    continue
                
                # Only validate main_category_id is required
                if pd.isna(row["main_category_id"]):
                    raise ValueError("Missing required field (main_category_id)")
                
                # Get main category
                try:
                    main_category = MainCategory.objects.get(id=int(row["main_category_id"]))
                except MainCategory.DoesNotExist:
                    raise ValueError(f"MainCategory with ID {row['main_category_id']} does not exist")
                
                # Handle missing make_code and make_name with defaults
                if pd.isna(row["make_code"]):
                    continue  # Skip rows with no make_code
                
                code = str(row["make_code"]).strip()
                
                # If make_name is missing, use "NA"
                if pd.isna(row["make_name"]):
                    name = "NA"
                else:
                    name = str(row["make_name"]).strip()
                
                obj, created = Make.objects.update_or_create(
                    code=code,
                    main_category=main_category,
                    defaults={"name": name}
                )
                success_count += 1
                if self.verbosity >= 2:
                    self.stdout.write(f"{'Created' if created else 'Updated'} Make: {code} - {name}")
                    
            except Exception as e:
                error_msg = f"Row {index+2}: {str(e)}\n{traceback.format_exc()}"
                self.log_error(error_log_path, sheet_name, row_data, error_msg)
        
        self.stdout.write(self.style.SUCCESS(
            f"Make import complete: {success_count} succeeded, {total_rows-success_count} failed"
        ))

    def import_product_model(self, xls, error_log_path):
        sheet_name = "ProductModel"
        df = xls.parse(sheet_name)
        total_rows = len(df)
        success_count = 0
        
        self.stdout.write(f"\nImporting {sheet_name} ({total_rows} rows)...")
        
        for index, row in df.iterrows():
            try:
                row_data = {k: v for k, v in row.items()}
                
                # Skip completely empty rows
                if all(pd.isna(v) for v in row_data.values()):
                    continue
                
                # Only validate main_category_id is required
                if pd.isna(row["main_category_id"]):
                    raise ValueError("Missing required field (main_category_id)")
                
                # Get main category
                try:
                    main_category = MainCategory.objects.get(id=int(row["main_category_id"]))
                except MainCategory.DoesNotExist:
                    raise ValueError(f"MainCategory with ID {row['main_category_id']} does not exist")
                
                # Handle missing product_model_code - use "000" as default
                if pd.isna(row["product_model_code"]):
                    code = "000"
                else:
                    code = str(row["product_model_code"]).zfill(3)
                
                # Handle missing product_model_name - use "NA" as default
                if pd.isna(row["product_model_name"]):
                    name = "NA"
                else:
                    name = str(row["product_model_name"]).strip()
                
                obj, created = ProductModel.objects.update_or_create(
                    code=code,
                    main_category=main_category,
                    defaults={"name": name}
                )
                success_count += 1
                if self.verbosity >= 2:
                    self.stdout.write(f"{'Created' if created else 'Updated'} ProductModel: {code} - {name}")
                    
            except Exception as e:
                error_msg = f"Row {index+2}: {str(e)}\n{traceback.format_exc()}"
                self.log_error(error_log_path, sheet_name, row_data, error_msg)
        
        self.stdout.write(self.style.SUCCESS(
            f"ProductModel import complete: {success_count} succeeded, {total_rows-success_count} failed"
        ))

    def import_remarks(self, xls, error_log_path):
        sheet_name = "Remarks"
        df = xls.parse(sheet_name)
        total_rows = len(df)
        success_count = 0
        
        self.stdout.write(f"\nImporting {sheet_name} ({total_rows} rows)...")
        
        for index, row in df.iterrows():
            try:
                row_data = {k: v for k, v in row.items()}
                
                # Skip completely empty rows
                if all(pd.isna(v) for v in row_data.values()):
                    continue
                
                # Only validate main_category_id is required
                if pd.isna(row["main_category_id"]):
                    raise ValueError("Missing required field (main_category_id)")
                
                # Get main category
                try:
                    main_category = MainCategory.objects.get(id=int(row["main_category_id"]))
                except MainCategory.DoesNotExist:
                    raise ValueError(f"MainCategory with ID {row['main_category_id']} does not exist")
                
                # Handle missing remarks_code - use "000" as default
                if pd.isna(row["remarks_code"]):
                    code = "000"
                else:
                    code = str(row["remarks_code"]).zfill(3)
                
                # Handle missing remarks_description - use "NA" as default
                if pd.isna(row["remarks_description"]):
                    description = "NA"
                else:
                    description = str(row["remarks_description"]).strip()
                
                obj, created = Remarks.objects.update_or_create(
                    code=code,
                    main_category=main_category,
                    defaults={"description": description}
                )
                success_count += 1
                if self.verbosity >= 2:
                    self.stdout.write(f"{'Created' if created else 'Updated'} Remarks: {code} - {description[:30]}...")
                    
            except Exception as e:
                error_msg = f"Row {index+2}: {str(e)}\n{traceback.format_exc()}"
                self.log_error(error_log_path, sheet_name, row_data, error_msg)
        
        self.stdout.write(self.style.SUCCESS(
            f"Remarks import complete: {success_count} succeeded, {total_rows-success_count} failed"
        ))

    def import_item_master(self, xls, error_log_path):
        sheet_name = "ItemMaster"
        df = xls.parse(sheet_name).fillna('')
        total_rows = len(df)
        success_count = 0
        
        self.stdout.write(f"\nImporting {sheet_name} ({total_rows} rows)...")
        
        for index, row in df.iterrows():
            try:
                row_data = {k: v for k, v in row.items()}
                
                # Skip completely empty rows
                if all(v == '' for v in row_data.values()):
                    continue
                
                # Validate required fields
                if not row["cimcon_part_no"]:
                    raise ValueError("cimcon_part_no is required")
                
                part_no = str(row["cimcon_part_no"]).strip()
                
                # Update part number validation to allow up to 16 characters
                if len(part_no) < 12:
                    raise ValueError(f"Part number '{part_no}' is too short (min 12 chars)")
                elif len(part_no) > 16:  # Keep at 16 characters
                    raise ValueError(f"Part number '{part_no}' is too long (max 16 chars)")
                
                # Extract codes from cimcon_part_no
                main_cat_code = part_no[:3]
                sub_cat_code = part_no[3:4]
                rating_code = part_no[4:7]
                make_code = part_no[7:9]
                model_code = part_no[9:12]
                remarks_code = part_no[12:15] if len(part_no) > 12 else "000"
                
                # Get main category
                main_category = MainCategory.objects.filter(code=main_cat_code).first()
                if not main_category:
                    raise ValueError(f"MainCategory with code {main_cat_code} not found")
                
                # Get all related objects
                sub_category = SubCategory.objects.filter(
                    code=sub_cat_code, 
                    main_category=main_category
                ).first()
                
                product_rating = ProductRating.objects.filter(
                    code=rating_code, 
                    main_category=main_category
                ).first()
                if not product_rating:
                    # Try creating the product rating on the fly if it doesn't exist
                    product_rating = ProductRating.objects.create(
                        code=rating_code,
                        name=f"Auto-generated {rating_code}",
                        main_category=main_category,
                        sub_category=sub_category
                    )
                    self.stdout.write(self.style.WARNING(
                        f"Row {index+2}: Created missing ProductRating with code {rating_code} for main category {main_cat_code}"
                    ))
                
                make = Make.objects.filter(
                    code=make_code, 
                    main_category=main_category
                ).first()
                if not make:
                    # Try creating the make on the fly if it doesn't exist
                    make = Make.objects.create(
                        code=make_code,
                        name=f"Auto-generated {make_code}",
                        main_category=main_category
                    )
                    self.stdout.write(self.style.WARNING(
                        f"Row {index+2}: Created missing Make with code {make_code} for main category {main_cat_code}"
                    ))
                
                product_model = ProductModel.objects.filter(
                    code=model_code, 
                    main_category=main_category
                ).first()
                if not product_model:
                    # Try creating the product model on the fly if it doesn't exist
                    product_model = ProductModel.objects.create(
                        code=model_code,
                        name=f"Auto-generated {model_code}",
                        main_category=main_category
                    )
                    self.stdout.write(self.style.WARNING(
                        f"Row {index+2}: Created missing ProductModel with code {model_code} for main category {main_cat_code}"
                    ))
                
                remarks = Remarks.objects.filter(
                    code=remarks_code, 
                    main_category=main_category
                ).first()
                if not remarks and remarks_code != "000":
                    # Try creating the remarks on the fly if it doesn't exist
                    remarks = Remarks.objects.create(
                        code=remarks_code,
                        description=f"Auto-generated remarks {remarks_code}",
                        main_category=main_category
                    )
                    self.stdout.write(self.style.WARNING(
                        f"Row {index+2}: Created missing Remarks with code {remarks_code} for main category {main_cat_code}"
                    ))
                
                # Handle deescription typo in column name
                description = ""
                if "description" in row:
                    description = str(row["description"]).strip()
                elif "deescription" in row:
                    description = str(row["deescription"]).strip()
                
                # Convert numeric values
                try:
                    moq = int(row["spq"]) if row["spq"] not in ['', None] else None
                except ValueError:
                    moq = None
                    self.stdout.write(self.style.WARNING(
                        f"Row {index+2}: Invalid MOQ value '{row['spq']}', using None"
                    ))
                
                try:
                    lead_time = int(row["mfg_std_lead_time"]) if row["mfg_std_lead_time"] not in ['', None] else None
                except ValueError:
                    lead_time = None
                    self.stdout.write(self.style.WARNING(
                        f"Row {index+2}: Invalid lead time value '{row['mfg_std_lead_time']}', using None"
                    ))
                
                # Create or update the item
                obj, created = ItemMaster.objects.update_or_create(
                    cimcon_part_no=part_no,
                    defaults={
                        "name": str(row["name"]).strip() if row["name"] else part_no,
                        "description": description,
                        "main_category": main_category,
                        "sub_category": sub_category,
                        "product_rating": product_rating,
                        "make": make,
                        "product_model": product_model,
                        "remarks": remarks,
                        "package": str(row["package"]).strip() if "package" in row else "",
                        "uom": str(row["uom"]).strip() if "uom" in row else "",
                        "moq": moq,
                        "mfg_std_lead_time": lead_time,
                        "bin": str(row["bin"]).strip() if "bin" in row else "",
                        "hsn_code": str(row["hsn_code"]).strip() if "hsn_code" in row else "",
                        "mfg_part_no": str(row["Mfg Code"]).strip() if "Mfg Code" in row else "",
                        "is_active": True
                    }
                )
                success_count += 1
                if self.verbosity >= 2:
                    self.stdout.write(f"{'Created' if created else 'Updated'} Item: {part_no}")
                
            except Exception as e:
                error_msg = f"Row {index+2}: {str(e)}\n{traceback.format_exc()}"
                self.log_error(error_log_path, sheet_name, row_data, error_msg)
        
        self.stdout.write(self.style.SUCCESS(
            f"ItemMaster import complete: {success_count} succeeded, {total_rows-success_count} failed"
        ))