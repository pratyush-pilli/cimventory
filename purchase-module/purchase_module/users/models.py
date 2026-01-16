from django.contrib.auth.models import AbstractUser
from django.db import models

class Division(models.Model):
    division_name = models.CharField(max_length=255)
    
    def __str__(self):
        return self.division_name

class User(models.Model):
    ROLE_CHOICES = [
        ('Requisitor', 'Requisitor'),
        ('Approver', 'Approver'),
    ]
    name = models.CharField(max_length=255)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    division = models.ForeignKey(Division, on_delete=models.CASCADE, related_name='user_divisions')
    
class CustomUser(AbstractUser):
    ROLE_CHOICES = [
        ('Requisitor', 'Requisitor'),
        ('Approver', 'Approver'),
        ('Developer', 'Developer'),
    ]
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    division = models.ForeignKey(Division, on_delete=models.CASCADE, related_name='custom_users')
    
    
    def get_full_name(self):
        return f"{self.first_name} {self.last_name}"

    # Add unique related_name attributes for groups and user_permissions
    groups = models.ManyToManyField(
        'auth.Group',
        related_name='custom_user_groups',
        blank=True
    )
    user_permissions = models.ManyToManyField(
        'auth.Permission',
        related_name='custom_user_permissions',
        blank=True
    )

    def __str__(self):
        return f"{self.username} ({self.role})"

class RolePermission(models.Model):
    """
    Model to store role permissions
    """
    role_name = models.CharField(max_length=50, unique=True, db_index=True)
    description = models.TextField(blank=True, null=True)
    allowed_paths = models.JSONField(default=list)  # Store as JSON array
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'role_permissions'
        ordering = ['role_name']

    def __str__(self):
        return self.role_name

    def get_allowed_paths(self):
        """Get allowed paths as a list"""
        if isinstance(self.allowed_paths, list):
            return self.allowed_paths
        return []

    def set_allowed_paths(self, paths):
        """Set allowed paths"""
        if isinstance(paths, list):
            self.allowed_paths = paths
        else:
            self.allowed_paths = []