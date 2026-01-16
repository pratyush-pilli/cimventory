from django.core.management.base import BaseCommand
from users.models import Division, User

class Command(BaseCommand):
    help = "Populate the database with initial divisions and users."

    def handle(self, *args, **kwargs):
        # Divisions and their corresponding users
        data = {
            "Sakar IV": [
                {"name": "Harsh Patel", "email": "harsh.patel@cimconautomation.com", "role": "Requisitor"},
                {"name": "Rajnish Dashottar", "email": "rajnish.dashottar@cimconautomation.com", "role": "Approver"},
                {"name": "Priyanshu Sharma", "email": "priyanshu.sharma@cimconautomation.com", "role": "Requisitor"},
            ],
            "Times Square": [
                {"name": "Rakesh Patel", "email": "rakesh.patel@cimconautomation.com", "role": "Requisitor"},
                {"name": "Darshak Sanghavi", "email": "darshak.sanghavi@cimconautomation.com", "role": "Approver"},
                {"name": "Dharamdev Singh", "email": "dharamdev@cimconautomation.com", "role": "Requisitor"},
            ],
            "Dehradun": [
                {"name": "Manish Srivastav", "email": "manish.srivastava@cimconautomation.com", "role": "Requisitor"},
                {"name": "Sandeep Jain", "email": "sjain@cimconautomation.com", "role": "Approver"},
            ],
            "Admin": [
                {"name": "Jaydeep Khandavi", "email": "jaydeep.khandavi@cimconautomation.com", "role": "Requisitor"},
                {"name": "Chaithra Hejmady", "email": "chaithra.hejmady@cimcondigital.com", "role": "Approver"},
            ],
            "IT": [
                {"name": "Azaz Khan", "email": "azazkhan@cimcondigital.com", "role": "Requisitor"},
                {"name": "Prashant Kapadia", "email": "prashant.kapadia@cimcondigital.com", "role": "Approver"},
            ],
            "Developer": [
                {"name": "Pratyush Pilli", "email": "pratyush.pilli@cimcondigital.com", "role": "Developer"},
                {"name": "Saurabh Wani", "email": "saurabh.wani@cimcondigital.com", "role": "Developer"}
            ],
            "Accounts": [
                {"name": "Accounts Accounts", "email": "banking@cimconautomation.com", "role": "Accounts"},
            ],
            "Store": [
                {"name": "Mahendra Khuteja", "email": "mahendra.khuteja@cimconautomation.com", "role": "Store"},
            ]     
                   
        }

        # Insert divisions and users
        for division_name, users in data.items():
            division, created = Division.objects.get_or_create(division_name=division_name)
            for user_data in users:
                User.objects.get_or_create(
                    name=user_data["name"],
                    email=user_data["email"],
                    role=user_data["role"],
                    division=division,
                )

        self.stdout.write(self.style.SUCCESS("Database populated successfully!"))
