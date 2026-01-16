# Stock Import Documentation

## Overview
This documentation explains how to import stock data from Excel sheets into your inventory system without disturbing the existing model structure.

## Current Inventory Model Structure
Your `Inventory` model has the following location-specific stock fields:
- `times_sq_stock` - Times Square location
- `i_sq_stock` - iSquare location  
- `sakar_stock` - Sakar location
- `pirana_stock` - Pirana location
- `other_stock` - Other/miscellaneous locations

The model automatically calculates `total_stock` as the sum of all location stocks.

## Handling Unmapped Locations

**NEW FEATURE**: The import system can now automatically aggregate locations that don't match your model fields into the `other_stock` field.

### How It Works
- The system identifies Excel columns that contain stock/quantity data but don't match your 5 defined locations
- These unmapped location columns are automatically summed and added to `other_stock`
- This preserves all your stock data without requiring model changes

### Usage
```bash
# Preview with unmapped location aggregation
python manage.py import_stock "Stock Sheet 15042025_R3.xlsx" --preview --aggregate-unmapped

# Import with unmapped location aggregation
python manage.py import_stock "Stock Sheet 15042025_R3.xlsx" --update-existing --aggregate-unmapped
```

## Import Methods

### Method 1: Django Management Command (Recommended)

#### Preview Import
```bash
python manage.py import_stock "Stock Sheet 15042025_R3.xlsx" --preview
```

#### Import New Records Only
```bash
python manage.py import_stock "Stock Sheet 15042025_R3.xlsx"
```

#### Import and Update Existing Records
```bash
python manage.py import_stock "Stock Sheet 15042025_R3.xlsx" --update-existing
```

#### Import with Unmapped Location Aggregation
```bash
python manage.py import_stock "Stock Sheet 15042025_R3.xlsx" --update-existing --aggregate-unmapped
```

#### Preview More Rows
```bash
python manage.py import_stock "Stock Sheet 15042025_R3.xlsx" --preview --rows 10
```

### Method 2: Standalone Python Script

#### Run Analysis First
```bash
cd purchase-module
python analyze_excel.py
```

#### Run Import
```bash
cd purchase-module
python stock_import.py
```

## Column Mapping Strategy

The import system automatically maps Excel columns to model fields using these patterns:

### Main Fields
- **material_group**: `material_group`, `material group`, `mat_group`, `category`
- **item_no**: `item_no`, `item_code`, `part_number`, `cimcon_part_number`, `item code`
- **description**: `description`, `item_description`, `desc`, `material_description`
- **make**: `make`, `manufacturer`, `brand`

### Location Stock Fields
- **times_sq_stock**: `times_sq`, `times_square`, `times sq`, `times square stock`, `ts_stock`
- **i_sq_stock**: `i_sq`, `isquare`, `i square`, `i_square_stock`, `is_stock`
- **sakar_stock**: `sakar`, `sakar_stock`, `sakar stock`
- **pirana_stock**: `pirana`, `pirana_stock`, `pirana stock`
- **other_stock**: `other`, `other_stock`, `other stock`, `misc`, `miscellaneous`

### Unmapped Location Detection
When `--aggregate-unmapped` is used, the system identifies unmapped columns by:
- Column names containing keywords: `stock`, `qty`, `quantity`, `location`, `warehouse`, `store`, `count`, `amount`, `total`
- Columns with >70% numeric data
- These are then summed into `other_stock`

## Excel File Requirements

1. **File Format**: `.xlsx` format
2. **Required Column**: At least one column that maps to `item_no` (item code/part number)
3. **Location Columns**: Columns containing stock quantities for different locations
4. **Numeric Values**: Stock quantities should be numeric (commas are automatically removed)

## Import Process

1. **Analysis**: The system first analyzes your Excel structure
2. **Mapping**: Automatically maps Excel columns to model fields
3. **Unmapped Detection**: Identifies location columns not in your model (if `--aggregate-unmapped` used)
4. **Preview**: Shows what will be imported (recommended first step)
5. **Validation**: Checks for required fields and data integrity
6. **Import**: Creates new records or updates existing ones
7. **Aggregation**: Sums unmapped locations into `other_stock`
8. **Calculation**: Automatically calculates total stock and updates related fields

## Safety Features

- **Transaction Safety**: All imports run in database transactions
- **Duplicate Handling**: Uses `item_no` to identify existing records
- **Data Validation**: Cleans numeric values and handles missing data
- **Error Reporting**: Detailed error messages for failed imports
- **Preview Mode**: Test imports without making changes
- **Unmapped Location Handling**: Preserves all stock data by aggregating into `other_stock`

## Example: Handling Multiple Locations

If your Excel has these columns:
```
Item Code | Times Square | iSquare | Sakar | Pirana | Mumbai | Delhi | Bangalore | Other
ABC123    | 10          | 5       | 3     | 2      | 7      | 4     | 6        | 1
```

**Without `--aggregate-unmapped`:**
- Only Times Square, iSquare, Sakar, Pirana, and Other columns are imported
- Mumbai, Delhi, Bangalore data is ignored

**With `--aggregate-unmapped`:**
- Times Square → `times_sq_stock` = 10
- iSquare → `i_sq_stock` = 5  
- Sakar → `sakar_stock` = 3
- Pirana → `pirana_stock` = 2
- Other + Mumbai + Delhi + Bangalore → `other_stock` = 1 + 7 + 4 + 6 = 18

## Troubleshooting

### Common Issues

1. **Column Not Found**
   - Check Excel column names match expected patterns
   - Use preview mode to see available columns
   - Manually verify column names in Excel

2. **Import Errors**
   - Check for duplicate item codes in Excel
   - Ensure numeric columns contain valid numbers
   - Verify Excel file is not corrupted

3. **Missing Data**
   - Empty cells are treated as zero for stock quantities
   - Missing item codes cause rows to be skipped

4. **Unmapped Locations Not Detected**
   - Ensure column names contain relevant keywords
   - Check that columns have numeric data
   - Use preview mode to see which columns are detected

### Manual Column Mapping

If automatic mapping fails, the standalone script offers manual mapping:
```python
# Run the script and follow prompts
python stock_import.py
```

## Example Usage

### Step 1: Preview Your Import with Unmapped Aggregation
```bash
python manage.py import_stock "Stock Sheet 15042025_R3.xlsx" --preview --aggregate-unmapped --rows 5
```

### Step 2: Review the Output
The system will show:
- Available Excel columns
- Automatic column mappings
- Unmapped location columns that will be aggregated
- Preview of first 5 rows with aggregated `other_stock` values

### Step 3: Run the Import
```bash
python manage.py import_stock "Stock Sheet 15042025_R3.xlsx" --update-existing --aggregate-unmapped
```

## Best Practices

1. **Always Preview First**: Use `--preview` to verify mappings and aggregation
2. **Use Unmapped Aggregation**: Add `--aggregate-unmapped` to preserve all location data
3. **Backup Database**: Take a backup before large imports
4. **Test with Small Files**: Test with a subset of data first
5. **Verify Results**: Check a few records manually after import
6. **Monitor Performance**: Large imports may take time

## Model Impact

The import process:
- ✅ Preserves existing model structure
- ✅ Maintains all relationships and constraints
- ✅ Triggers model's `save()` method for proper calculations
- ✅ Updates `total_stock`, `available_stock` automatically
- ✅ Aggregates unmapped locations into `other_stock`
- ✅ Maintains data integrity

## Support

If you encounter issues:
1. Check this documentation
2. Use preview mode to debug
3. Verify Excel column names
4. Check for data format issues
5. Review error messages carefully
6. Use `--aggregate-unmapped` to handle additional locations
