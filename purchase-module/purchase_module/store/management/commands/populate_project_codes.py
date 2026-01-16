from django.core.management.base import BaseCommand
from indent.models import Project
from store.models import ProjectCode

class Command(BaseCommand):
    help = 'Populates ProjectCode table from existing Projects'

    def handle(self, *args, **options):
        projects = Project.objects.all()
        created_count = 0

        for project in projects:
            project_code, created = ProjectCode.objects.get_or_create(
                code=project,
                defaults={'name': project.client_project_name}  # Adjust field name
            )
            if created:
                created_count += 1

        self.stdout.write(
            self.style.SUCCESS(
                f'Successfully created {created_count} project codes'
            )
        ) 