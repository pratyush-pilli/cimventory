import pandas as pd
from django.core.management.base import BaseCommand
from vendor.models import Vendor


class Command(BaseCommand):
    help = "Import vendor data from an Excel file into the database"
    
    def handle(self, *args, **options):
        file_path = r"C:/Users/pratyushp/Desktop/Purchase/VENDOR DATABASE FY2024-25.xlsx"
        try:
            # Load Excel file into a pandas DataFrame
            data = pd.read_excel(file_path)
            
            # Clean column names by stripping whitespace
            data.columns = data.columns.str.strip()

            for index, row in data.iterrows():
                # Get vendor name and check if it's valid
                vendor_name = row.get("Vendor Name")
                if pd.isna(vendor_name) or not vendor_name:
                    self.stdout.write(self.style.ERROR(f"Skipping row {index}: No vendor name provided"))
                    continue

                # Clean vendor name
                vendor_name = str(vendor_name).strip()
                
                # Clean and prepare data
                mobile_no_1 = str(row.get("Mobile No.1", "")).strip() if not pd.isna(row.get("Mobile No.1", "")) else None
                mobile_no_2 = str(row.get("Mobile No.2", "")).strip() if not pd.isna(row.get("Mobile No.2", "")) else None
                email_1 = str(row.get("Email 1", "")).strip() if not pd.isna(row.get("Email 1", "")) else None
                email_2 = str(row.get("Email 2", "")).strip() if not pd.isna(row.get("Email 2", "")) else None

                # Replace empty strings and dashes with None
                email_1 = None if not email_1 or email_1 == "-" else email_1
                email_2 = None if not email_2 or email_2 == "-" else email_2

                try:
                    # Create or update vendor
                    Vendor.objects.update_or_create(
                        vendor_name=vendor_name,
                        defaults={
                            # "registration_form_received": str(row.get("VENDOR REGISTRATION FORM RECEIVED", "")).upper() == "YES",
                            "product_category": row.get("Product Category") if not pd.isna(row.get("Product Category")) else None,
                            "contact_person": row.get("Contact Person") if not pd.isna(row.get("Contact Person")) else None,
                            "mobile_no_1": mobile_no_1,
                            "mobile_no_2": mobile_no_2,
                            "email_1": email_1,
                            "email_2": email_2,
                            "website": row.get("Website") if not pd.isna(row.get("Website")) else None,
                            "address": row.get("Address") if not pd.isna(row.get("Address")) else None,
                            "payment_term": row.get("PAYMENT TERM") if not pd.isna(row.get("PAYMENT TERM")) else None
                        }
                    )
                    
                    self.stdout.write(self.style.SUCCESS(
                        f"Processed vendor: {vendor_name} with "
                        f"Email 1: {email_1}, Email 2: {email_2}"
                    ))

                except Exception as e:
                    self.stdout.write(self.style.ERROR(
                        f"Error processing vendor '{vendor_name}' at row {index}: {str(e)}"
                    ))
                    continue

        except Exception as e:
            self.stdout.write(self.style.ERROR(f"An error occurred: {str(e)}"))

