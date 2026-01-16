from django.core.management.base import BaseCommand
from vendor.models import Vendor

class Command(BaseCommand):
    help = 'Add vendor IDs to existing vendors in sequential order'

    def handle(self, *args, **kwargs):
        vendors = Vendor.objects.all().order_by('id')
        total_vendors = vendors.count()
        
        self.stdout.write(f"Found {total_vendors} vendors. Starting to add vendor IDs...")
        
        for index, vendor in enumerate(vendors, start=1):
            vendor_id = f'CIMVED{index:07d}'
            vendor.vendor_id = vendor_id
            vendor.save()
            self.stdout.write(f"Updated vendor {vendor.vendor_name} with ID: {vendor_id}")
        
        self.stdout.write(self.style.SUCCESS(f'Successfully updated {total_vendors} vendors with IDs')) 