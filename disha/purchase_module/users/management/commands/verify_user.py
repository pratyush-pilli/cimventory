from django.core.management.base import BaseCommand
from users.models import CustomUser

class Command(BaseCommand):
    help = 'Verify user credentials'

    def add_arguments(self, parser):
        parser.add_argument('username', type=str)
        parser.add_argument('password', type=str)

    def handle(self, *args, **kwargs):
        username = kwargs['username']
        password = kwargs['password']
        
        try:
            user = CustomUser.objects.get(username=username)
            if user.check_password(password):
                self.stdout.write(
                    self.style.SUCCESS(
                        f'Credentials are valid for user: {username}\n'
                        f'Role: {user.role}\n'
                        f'Division: {user.division.id}\n'
                        f'Full Name: {user.first_name} {user.last_name}'
                    )
                )
            else:
                self.stdout.write(
                    self.style.ERROR(
                        f'Invalid password for user: {username}'
                    )
                )
        except CustomUser.DoesNotExist:
            self.stdout.write(
                self.style.ERROR(
                    f'User not found: {username}'
                )
            ) 