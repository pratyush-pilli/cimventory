import pandas as pd
import os
from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from store.models import Inventory


class Command(BaseCommand):
    help = 'Import stock data from Excel file to Inventory model'

    def add_arguments(self, parser):
        parser.add_argument('excel_file', type=str, help='Path to Excel file')
        parser.add_argument(
            '--update-existing',
            action='store_true',
            help='Update existing inventory records',
        )
        parser.add_argument(
            '--preview',
            action='store_true',
            help='Preview import without making changes',
        )
        parser.add_argument(
            '--rows',
            type=int,
            default=5,
            help='Number of rows to preview (default: 5)',
        )
        parser.add_argument(
            '--aggregate-unmapped',
            action='store_true',
            help='Aggregate unmapped location columns into other_stock',
        )

    def handle(self, *args, **options):
        excel_file = options['excel_file']
        update_existing = options['update_existing']
        preview_only = options['preview']
        preview_rows = options['rows']
        aggregate_unmapped = options['aggregate_unmapped']

        if not os.path.exists(excel_file):
            raise CommandError(f'Excel file not found: {excel_file}')

        self.stdout.write(f'Loading Excel file: {excel_file}')
        
        try:
            df = pd.read_excel(excel_file)
            self.stdout.write(f'Loaded {len(df)} rows and {len(df.columns)} columns')
        except Exception as e:
            raise CommandError(f'Error reading Excel file: {e}')

        # Display available columns
        self.stdout.write('\n=== AVAILABLE COLUMNS ===')
        for i, col in enumerate(df.columns, 1):
            self.stdout.write(f'{i:2d}. {col}')

        # Setup column mappings
        field_mapping, unmapped_location_cols = self.setup_column_mappings(df, aggregate_unmapped)
        
        if not field_mapping:
            self.stdout.write(self.style.ERROR('No column mappings found. Please check Excel column names.'))
            return

        if aggregate_unmapped and unmapped_location_cols:
            self.stdout.write(f'\n=== UNMAPPED LOCATION COLUMNS (will be aggregated into other_stock) ===')
            for col in unmapped_location_cols:
                self.stdout.write(f'- {col}')

        if preview_only:
            self.preview_import(df, field_mapping, unmapped_location_cols, preview_rows, aggregate_unmapped)
        else:
            self.import_stock_data(df, field_mapping, unmapped_location_cols, update_existing, aggregate_unmapped)

    def setup_column_mappings(self, df, aggregate_unmapped=False):
        """Setup automatic column mappings and identify unmapped location columns"""
        potential_mappings = {
            'material_group': ['material_group', 'material group', 'mat_group', 'category'],
            'item_no': ['item_no', 'item_code', 'part_number', 'cimcon_part_number', 'item code'],
            'description': ['description', 'item_description', 'desc', 'material_description'],
            'make': ['make', 'manufacturer', 'brand'],
            'times_sq_stock': ['times_sq', 'times_square', 'times sq', 'times square stock', 'ts_stock'],
            'i_sq_stock': ['i_sq', 'isquare', 'i square', 'i_square_stock', 'is_stock'],
            'sakar_stock': ['sakar', 'sakar_stock', 'sakar stock'],
            'pirana_stock': ['pirana', 'pirana_stock', 'pirana stock'],
            'other_stock': ['other', 'other_stock', 'other stock', 'misc', 'miscellaneous']
        }

        field_mapping = {}
        mapped_columns = set()
        excel_columns_lower = [str(col).lower() for col in df.columns]

        for model_field, possible_names in potential_mappings.items():
            for possible_name in possible_names:
                if possible_name.lower() in excel_columns_lower:
                    actual_col = df.columns[excel_columns_lower.index(possible_name.lower())]
                    field_mapping[model_field] = actual_col
                    mapped_columns.add(actual_col)
                    self.stdout.write(f"Mapped '{actual_col}' -> {model_field}")
                    break

        # Find unmapped location columns if aggregation is enabled
        unmapped_location_cols = []
        if aggregate_unmapped:
            location_keywords = ['stock', 'qty', 'quantity', 'location', 'warehouse', 'store']
            numeric_keywords = ['count', 'amount', 'total']
            
            for col in df.columns:
                if col not in mapped_columns:
                    col_lower = str(col).lower()
                    # Check if column might contain stock/quantity data
                    is_location_col = (
                        any(keyword in col_lower for keyword in location_keywords) or
                        any(keyword in col_lower for keyword in numeric_keywords) or
                        # Check if column contains mostly numeric data
                        self.is_numeric_column(df[col])
                    )
                    
                    if is_location_col:
                        unmapped_location_cols.append(col)

        self.stdout.write(f'\nMapped {len(field_mapping)} fields')
        if unmapped_location_cols:
            self.stdout.write(f'Found {len(unmapped_location_cols)} unmapped location columns')
        
        return field_mapping, unmapped_location_cols

    def is_numeric_column(self, series):
        """Check if a pandas series contains mostly numeric data"""
        try:
            # Try to convert to numeric, count successful conversions
            numeric_series = pd.to_numeric(series, errors='coerce')
            non_null_count = series.notna().sum()
            numeric_count = numeric_series.notna().sum()
            
            # Consider it numeric if >70% of non-null values are numeric
            if non_null_count > 0:
                return (numeric_count / non_null_count) > 0.7
            return False
        except:
            return False

    def clean_numeric_value(self, value):
        """Clean and convert value to Decimal"""
        if pd.isna(value) or value == '' or value is None:
            return Decimal('0')
        
        try:
            cleaned = str(value).replace(',', '').replace(' ', '')
            return Decimal(str(float(cleaned)))
        except (ValueError, TypeError):
            return Decimal('0')

    def aggregate_unmapped_locations(self, row, unmapped_cols):
        """Aggregate values from unmapped location columns"""
        total = Decimal('0')
        for col in unmapped_cols:
            value = self.clean_numeric_value(row.get(col, 0))
            total += value
        return total

    def preview_import(self, df, field_mapping, unmapped_location_cols, num_rows, aggregate_unmapped):
        """Preview what will be imported"""
        self.stdout.write(f'\n=== IMPORT PREVIEW (First {num_rows} rows) ===')
        
        for index, row in df.head(num_rows).iterrows():
            self.stdout.write(f'\nRow {index + 1}:')
            
            for model_field, excel_col in field_mapping.items():
                value = row.get(excel_col, 'N/A')
                if model_field.endswith('_stock'):
                    value = self.clean_numeric_value(value)
                self.stdout.write(f'  {model_field}: {value}')
            
            if aggregate_unmapped and unmapped_location_cols:
                aggregated_value = self.aggregate_unmapped_locations(row, unmapped_location_cols)
                current_other = self.clean_numeric_value(row.get(field_mapping.get('other_stock', ''), 0))
                total_other = current_other + aggregated_value
                self.stdout.write(f'  other_stock (aggregated): {total_other} (original: {current_other} + unmapped: {aggregated_value})')

    def import_stock_data(self, df, field_mapping, unmapped_location_cols, update_existing, aggregate_unmapped):
        """Import stock data from DataFrame to Inventory model"""
        success_count = 0
        error_count = 0
        updated_count = 0
        created_count = 0

        self.stdout.write(f'\nStarting import of {len(df)} records...')

        with transaction.atomic():
            for index, row in df.iterrows():
                try:
                    # Extract item_no (required field)
                    item_no_col = field_mapping.get('item_no')
                    if not item_no_col or pd.isna(row[item_no_col]):
                        self.stdout.write(f'Row {index + 1}: Skipping - no item_no')
                        continue

                    item_no = str(row[item_no_col]).strip()
                    if not item_no:
                        continue

                    # Prepare inventory data
                    inventory_data = {
                        'item_no': item_no,
                        'material_group': str(row.get(field_mapping.get('material_group', ''), '')).strip() or None,
                        'description': str(row.get(field_mapping.get('description', ''), '')).strip() or None,
                        'make': str(row.get(field_mapping.get('make', ''), '')).strip() or None,
                    }

                    # Extract location stock values
                    location_stocks = {}
                    for location_field in ['times_sq_stock', 'i_sq_stock', 'sakar_stock', 'pirana_stock', 'other_stock']:
                        excel_col = field_mapping.get(location_field)
                        if excel_col:
                            location_stocks[location_field] = self.clean_numeric_value(row[excel_col])
                        else:
                            location_stocks[location_field] = Decimal('0')

                    # Aggregate unmapped locations into other_stock if enabled
                    if aggregate_unmapped and unmapped_location_cols:
                        aggregated_value = self.aggregate_unmapped_locations(row, unmapped_location_cols)
                        location_stocks['other_stock'] += aggregated_value

                    # Check if inventory exists
                    inventory, created = Inventory.objects.get_or_create(
                        item_no=item_no,
                        defaults=inventory_data
                    )

                    if created:
                        created_count += 1
                        self.stdout.write(f'Row {index + 1}: Created new inventory for {item_no}')
                    elif update_existing:
                        updated_count += 1
                        self.stdout.write(f'Row {index + 1}: Updated existing inventory for {item_no}')
                        
                        # Update fields if they have values
                        for field, value in inventory_data.items():
                            if value and field != 'item_no':
                                setattr(inventory, field, value)

                    # Update location stocks
                    for location_field, stock_value in location_stocks.items():
                        setattr(inventory, location_field, stock_value)

                    # Save the inventory (this will trigger calculate_total_stock)
                    inventory.save()
                    success_count += 1

                    if (index + 1) % 100 == 0:
                        self.stdout.write(f'Processed {index + 1} records...')

                except Exception as e:
                    error_count += 1
                    self.stdout.write(self.style.ERROR(f'Row {index + 1}: Error - {e}'))
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
