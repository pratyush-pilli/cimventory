import pandas as pd
from django.core.management.base import BaseCommand
from items.models import MainCategory, SubCategory

class Command(BaseCommand):
    help = 'Import subcategories from an Excel file'

    def handle(self, *args, **kwargs):
        df = pd.read_excel('C:/Users/pratyushp/Desktop/Purchase Module Docs/item-master-types.xlsx')
        
        for index, row in df.iterrows():
            name = row['name']  # Adjust column name as needed
            code = row['code']  # Adjust column name as needed
            main_category_id = row['main_category_id']  # Adjust column name as needed

            # Get the main category instance using the id
            main_category = MainCategory.objects.get(id=main_category_id)

            # Create the SubCategory instance
            SubCategory.objects.create(
                main_category=main_category,
                name=name,
                code=code
            )