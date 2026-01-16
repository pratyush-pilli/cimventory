from django.core.management.base import BaseCommand
from vendor.models import Vendor

class Command(BaseCommand):
    help = 'Update vendor status from pending to approved and set approval_status to True'

    def handle(self, *args, **kwargs):
        # Get all vendors with pending status
        pending_vendors = Vendor.objects.filter(status='pending')
        total_vendors = pending_vendors.count()
        
        self.stdout.write(f"Found {total_vendors} pending vendors. Starting to update status...")
        
        try:
            # Update all pending vendors
            for vendor in pending_vendors:
                vendor.status = 'approved'
                vendor.approval_status = True
                vendor.save()
                self.stdout.write(f"Updated vendor {vendor.vendor_name} (ID: {vendor.vendor_id})")
            
            self.stdout.write(
                self.style.SUCCESS(f'Successfully updated {total_vendors} vendors to approved status')
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f'Error updating vendors: {str(e)}')
            ) 