from django.core.management.base import BaseCommand
from users.models import CustomUser

class Command(BaseCommand):
    help = 'Update existing users to enable staff status'

    def handle(self, *args, **kwargs):
        # Update all existing users
        CustomUser.objects.all().update(is_staff=True)
        
        self.stdout.write(
            self.style.SUCCESS('Successfully updated users')
        ) 