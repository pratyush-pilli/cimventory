import csv
import os
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from store.models import Inventory, InwardEntry

csv.field_size_limit(1000000)


class Command(BaseCommand):
    help = 'Import inventory data from CSV file exported from frontend'

    def add_arguments(self, parser):
        parser.add_argument('csv_file', type=str, help='Path to CSV file')
        parser.add_argument(
            '--update-existing',
            action='store_true',
            help='Update existing inventory records instead of skipping',
        )
        parser.add_argument(
            '--preview',
            action='store_true',
            help='Preview import without making changes',
        )

    def handle(self, *args, **options):
        csv_file = options['csv_file']
        update_existing = options['update_existing']
        preview_only = options['preview']

        if not os.path.exists(csv_file):
            raise CommandError(f'CSV file not found: {csv_file}')

        self.stdout.write(f'Loading CSV file: {csv_file}')

        try:
            with open(csv_file, 'r', encoding='utf-8') as file:
                reader = csv.DictReader(file)
                rows = list(reader)
                self.stdout.write(f'Loaded {len(rows)} rows')
        except Exception as e:
            raise CommandError(f'Error reading CSV file: {e}')

        if preview_only:
            self.preview_import(rows)
        else:
            self.import_inventory_data(rows, update_existing)

    def clean_numeric_value(self, value):
        """Clean and convert value to Decimal"""
        if not value or value == '' or value == '0':
            return Decimal('0')

        try:
            # Remove quotes and clean the value
            cleaned = str(value).strip('"\'')

            # Handle comma-separated numbers
            cleaned = cleaned.replace(',', '')

            return Decimal(str(float(cleaned)))
        except (ValueError, TypeError):
            return Decimal('0')

    def clean_string_value(self, value):
        """Clean string values"""
        if not value or value == '':
            return None
        return str(value).strip('"\'')

    def preview_import(self, rows):
        """Preview what will be imported"""
        self.stdout.write('\n=== IMPORT PREVIEW (First 5 rows) ===')

        for i, row in enumerate(rows[:5], 1):
            self.stdout.write(f'\nRow {i}:')
            self.stdout.write(f'  ID: {row.get("ID", "N/A")}')
            self.stdout.write(f'  Item No: {row.get("Item No", "N/A")}')
            self.stdout.write(f'  Description: {row.get("Description", "N/A")[:50]}...')
            self.stdout.write(f'  Make: {row.get("Make", "N/A")}')
            self.stdout.write(f'  Material Group: {row.get("Material Group", "N/A")}')
            self.stdout.write(f'  Opening Stock: {row.get("Opening Stock", "N/A")}')
            self.stdout.write(f'  Total Stock: {row.get("Total Stock", "N/A")}')
            self.stdout.write(f'  Available Stock: {row.get("Available Stock", "N/A")}')
            self.stdout.write(f'  Allocated Stock: {row.get("Allocated Stock", "N/A")}')
            self.stdout.write(f'  Outward Stock: {row.get("Outward Stock", "N/A")}')
            self.stdout.write(f'  Times Square: {row.get("Times Square", "N/A")}')
            self.stdout.write(f'  iSquare: {row.get("iSquare", "N/A")}')
            self.stdout.write(f'  Sakar: {row.get("Sakar", "N/A")}')
            self.stdout.write(f'  Pirana: {row.get("Pirana", "N/A")}')
            self.stdout.write(f'  Other: {row.get("Other", "N/A")}')
            self.stdout.write(f'  Remarks: {row.get("Remarks", "N/A")}')
            self.stdout.write(f'  Inward Entry ID: {row.get("Inward Entry ID", "N/A")}')

    def import_inventory_data(self, rows, update_existing):
        """Import inventory data from CSV rows"""
        success_count = 0
        error_count = 0
        updated_count = 0
        created_count = 0

        self.stdout.write(f'\nStarting import of {len(rows)} records...')

        with transaction.atomic():
            for index, row in enumerate(rows, 1):
                try:
                    # Extract required fields
                    item_no = self.clean_string_value(row.get("Item No"))
                    if not item_no:
                        self.stdout.write(f'Row {index}: Skipping - no item_no')
                        continue

                    # Prepare inventory data
                    inventory_data = {
                        'item_no': item_no,
                        'material_group': self.clean_string_value(row.get("Material Group")),
                        'description': self.clean_string_value(row.get("Description")),
                        'make': self.clean_string_value(row.get("Make")),
                        'opening_stock': self.clean_numeric_value(row.get("Opening Stock")),
                        'total_stock': self.clean_numeric_value(row.get("Total Stock")),
                        'available_stock': self.clean_numeric_value(row.get("Available Stock")),
                        'allocated_stock': self.clean_numeric_value(row.get("Allocated Stock")),
                        'times_sq_stock': self.clean_numeric_value(row.get("Times Square")),
                        'i_sq_stock': self.clean_numeric_value(row.get("iSquare")),
                        'sakar_stock': self.clean_numeric_value(row.get("Sakar")),
                        'pirana_stock': self.clean_numeric_value(row.get("Pirana")),
                        'other_stock': self.clean_numeric_value(row.get("Other")),
                        'remarks': self.clean_string_value(row.get("Remarks")),
                    }

                    # Handle InwardEntry foreign key
                    inward_entry_id = row.get("Inward Entry ID")
                    if inward_entry_id and inward_entry_id != '':
                        try:
                            inward_entry = InwardEntry.objects.get(id=int(inward_entry_id))
                            inventory_data['inward_entry'] = inward_entry
                        except (InwardEntry.DoesNotExist, ValueError):
                            self.stdout.write(f'Row {index}: Warning - InwardEntry {inward_entry_id} not found')
                    else:
                        inventory_data['inward_entry'] = None

                    # Check if inventory exists
                    inventory, created = Inventory.objects.get_or_create(
                        item_no=item_no,
                        defaults=inventory_data
                    )

                    if created:
                        created_count += 1
                        self.stdout.write(f'Row {index}: Created new inventory for {item_no}')
                    elif update_existing:
                        updated_count += 1
                        self.stdout.write(f'Row {index}: Updated existing inventory for {item_no}')

                        # Update all fields
                        for field, value in inventory_data.items():
                            setattr(inventory, field, value)

                    # Save the inventory (this will trigger calculations)
                    inventory.save()
                    success_count += 1

                    if index % 100 == 0:
                        self.stdout.write(f'Processed {index} records...')

                except Exception as e:
                    error_count += 1
                    self.stdout.write(self.style.ERROR(f'Row {index}: Error - {e}'))
                    continue

        self.stdout.write(self.style.SUCCESS(f'\n=== IMPORT SUMMARY ==='))
        self.stdout.write(f'Total processed: {success_count}')
        self.stdout.write(f'Created new: {created_count}')
        self.stdout.write(f'Updated existing: {updated_count}')
        self.stdout.write(f'Errors: {error_count}')

        if success_count > 0:
            self.stdout.write(self.style.SUCCESS('Import completed successfully!'))
        else:
            self.stdout.write(self.style.WARNING('No records were imported.'))
