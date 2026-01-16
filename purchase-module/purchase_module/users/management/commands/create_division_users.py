from django.core.management.base import BaseCommand
from users.models import CustomUser, Division

class Command(BaseCommand):
    help = 'Create users based on existing division data'

    def handle(self, *args, **kwargs):
        users_data = [
            {"name": "Harsh Patel", "email": "harsh.patel@cimconautomation.com", "role": "Requisitor", "division_id": 1},
            {"name": "Rajnish Dashottar", "email": "rajnish.dashottar@cimconautomation.com", "role": "Approver", "division_id": 1},
            {"name": "Priyanshu Sharma", "email": "priyanshu.sharma@cimconautomation.com", "role": "Requisitor", "division_id": 1},
            {"name": "Rakesh Patel", "email": "rakesh.patel@cimconautomation.com", "role": "Requisitor", "division_id": 2},
            {"name": "Darshak Sanghavi", "email": "darshak.sanghavi@cimconautomation.com", "role": "Approver", "division_id": 2},
            {"name": "Dharamdev Singh", "email": "dharamdev@cimconautomation.com", "role": "Requisitor", "division_id": 2},
            {"name": "Manish Srivastav", "email": "manish.srivastava@cimconautomation.com", "role": "Requisitor", "division_id": 3},
            {"name": "Sandeep Jain", "email": "sjain@cimconautomation.com", "role": "Approver", "division_id": 3},
            {"name": "Jaydeep Khandavi", "email": "jaydeep.khandavi@cimconautomation.com", "role": "Requisitor", "division_id": 4},
            {"name": "Chaithra Hejmady", "email": "chaithra.hejmady@cimcondigital.com", "role": "Approver", "division_id": 4},
            {"name": "Azaz Khan", "email": "azazkhan@cimcondigital.com", "role": "Requisitor", "division_id": 5},
            {"name": "Prashant Kapadia", "email": "prashant.kapadia@cimcondigital.com", "role": "Approver", "division_id": 5},
            {"name": "Pratyush Pilli", "email": "pratyush.pilli@cimcondigital.com", "role": "Developer", "division_id": 6},
            {"name": "Saurabh Wani", "email": "saurabh.wani@cimcondigital.com", "role": "Developer", "division_id": 6},
            {"name": "Jutan Sharma", "email": "jutan.sharma@cimcondigital.com", "role": "Admin", "division_id": 2},
            {"name": "Ashish Solanki", "email": "ashish.solanki@cimconautomation.com", "role": "Purchaser", "division_id": 2},
            {"name": "Lokeshkumar Chainani", "email": "lokeshkumar.chainani@cimconautomation.com", "role": "Admin", "division_id": 2},
            {"name": "Accounts Accounts", "email": "banking@cimconautomation.com", "role": "Accounts", "division_id": 7},
            {"name": "Mahendra Khuteja", "email": "mahendra.khuteja@cimconautomation.com", "role": "Store", "division_id": 8},
]

        for user_data in users_data:
            try:
                # Create username from email (everything before @)
                username = user_data["email"].split('@')[0]
                
                # Create a basic password using their first name in lowercase + @123
                password = f"{user_data['name'].split()[0].lower()}@123"
                
                # Get existing division
                division = Division.objects.get(id=user_data["division_id"])
                
                # Split full name into first and last name
                name_parts = user_data["name"].split()
                first_name = name_parts[0]
                last_name = ' '.join(name_parts[1:]) if len(name_parts) > 1 else ''
                
                # Check if user already exists
                if not CustomUser.objects.filter(email=user_data["email"]).exists():
                    user = CustomUser.objects.create_user(
                        username=username,
                        email=user_data["email"],
                        password=password,
                        first_name=first_name,
                        last_name=last_name,
                        role=user_data["role"],
                        division=division,
                        is_active=True
                    )
                    
                    self.stdout.write(
                        self.style.SUCCESS(
                            f'Created user: {username} (Password: {password})'
                        )
                    )
                else:
                    self.stdout.write(
                        self.style.WARNING(
                            f'User {username} already exists, skipping...'
                        )
                    )
                    
            except Division.DoesNotExist:
                self.stdout.write(
                    self.style.ERROR(
                        f'Division {user_data["division_id"]} does not exist, skipping user {user_data["email"]}'
                    )
                )
            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(
                        f'Error creating user {user_data["email"]}: {str(e)}'
                    )
                )
                