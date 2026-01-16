from django.core.management.base import BaseCommand
from users.models import Division, CustomUser

class Command(BaseCommand):
    help = "Populate divisions and users."

    def handle(self, *args, **kwargs):
        data = {
            "Sakar IV": [
                {"username": "sakar_requisitor", "email": "harsh.patel@cimconautomation.com", "role": "Requisitor"},
                {"username": "sakar_requisitor", "email": "priyanshu.sharma@cimconautomation.com", "role": "Requisitor"},
                {"username": "sakari_approver", "email": "rajnish.dashottar@cimconautomation.com", "role": "Approver"},
            ],
            "Times Square": [
                {"username": "times_requisitor", "email": "rakesh.patel@cimconautomation.com", "role": "Requisitor"},
                {"username": "times_requisitor", "email": "dharamdev@cimconautomation.com", "role": "Requisitor"},
                {"username": "times_approver", "email": "darshak.sanghavi@cimconautomation.com", "role": "Approver"},
            ],
            "Dehradun": [
                {"username": "dehradun_requisitor", "email": "manish.srivastava@cimconautomation.com", "role": "Requisitor"},
                {"username": "dehradun_approver", "email": "sjain@cimconautomation.com", "role": "Approver"},
            ],
            "Admin": [
                {"username": "admin_requisitor", "email": "jaydeep.khandavi@cimconautomation.com", "role": "Requisitor"},
                {"username": "admin_approver", "email": "chaithra.hejmady@cimcondigital.com", "role": "Approver"},
            ],
            "IT": [
                {"username": "it_requisitor", "email": "azazkhan@cimcondigital.com", "role": "Requisitor"},
                {"username": "it_approver", "email": "prashant.kapadia@cimcondigital.com", "role": "Approver"},
            ],
            # Add other divisions here...
        }

        for division_name, users in data.items():
            division, _ = Division.objects.get_or_create(division_name=division_name)
            for user_data in users:
                username = user_data["username"]
                email = user_data["email"]
                role = user_data["role"]

                password = f"{username}_123"  # Default password

                user, created = CustomUser.objects.get_or_create(
                    username=username,
                    email=email,
                    role=role,
                    division=division,
                )
                if created:
                    user.set_password(password)
                    user.save()
                    self.stdout.write(f"Created user: {username} with password: {password}")
                else:
                    self.stdout.write(f"User already exists: {username}")
