import uuid
import datetime
from django.db import models
from django.core import validators
from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone

from users.models import Division   

User = get_user_model()

class Project(models.Model):
    """
    Represents a project with its associated metadata.
    """
    project_code = models.CharField(max_length=50, unique=True, primary_key=True)
    client_project_name = models.CharField(max_length=255, db_index=True)
    bill_to = models.TextField(null = True, blank= True)
    ship_to = models.TextField(null = True, blank= True)
    approved_by = models.CharField(max_length=255)
    submitted_by = models.CharField(max_length=255)
    requested_by = models.CharField(max_length=255)
    division = models.ForeignKey(Division, on_delete=models.CASCADE, related_name='project', db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['project_code', 'division']),
        ]

    def __str__(self):
        return f"{self.project_code} - {self.client_project_name}"

    def get_required_items(self):
        """Get all required items for this project with their quantities."""
        return Requisition.objects.filter(
            project=self,
            approved_status=True
        ).values(
            'cimcon_part_number',
            'material_description',
            'make',
            'material_group',
            'req_qty'
        )

class DivisionQuerySet(models.QuerySet):
    def for_division(self, division):
        """Filter requisitions by division through project relationship"""
        return self.filter(project__division=division)
    
    def for_user_division(self, user):
        """Filter requisitions by user's division"""
        if hasattr(user, 'division') and user.division:
            return self.for_division(user.division)
        return self.none()

class DivisionManager(models.Manager):
    def get_queryset(self):
        return DivisionQuerySet(self.model, using=self._db)
    
    def for_division(self, division):
        return self.get_queryset().for_division(division)
    
    def for_user_division(self, user):
        return self.get_queryset().for_user_division(user)

class Requisition(models.Model):
    """
    Represents a requisition linked to a project.
    """
    class OrderType(models.TextChoices):
        SUPPLY = 'SUP', 'Supply'
        ITC = 'ITC', 'ITC'
        ONM = 'ONM', 'O&M'
        CON = 'CON', 'Contract'
        FRE = 'FRE', 'Freight'
        SER = 'SER', 'Service'
    
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="requisitions", null=True, blank=True, db_index=True)
    batch_id = models.CharField(max_length=50, db_index=True)
    item_no = models.PositiveIntegerField(blank=True, null=True)
    cimcon_part_number = models.CharField(
        max_length=17,
        blank=True,
        null=True,
        db_index=True,
        validators=[
            validators.RegexValidator(
                r'^[A-Za-z0-9]{14,}$',
                'CIMCON Part Number must be greater than or equal to 14 and less than or equal to 17 alphanumeric characters.'
            )
        ],
    )
    mfg_part_number = models.CharField(max_length=255, blank=True, null=True)
    material_description = models.TextField(blank=True, null=True)
    make = models.CharField(max_length=255, blank=True, null=True)
    material_group = models.CharField(max_length=100, blank=True, null=True)
    req_qty = models.PositiveIntegerField(blank=True, null=True)
    unit = models.CharField(max_length=50, blank=True, null=True)
    required_by_date = models.DateField(null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)
    approved_status = models.BooleanField(default=False, db_index=True)
    verification_status = models.BooleanField(default=False)
    master_entry_exists = models.BooleanField(default=False)
    requisition_date = models.DateField(default=datetime.date)
    submitted_by = models.CharField(max_length=50, blank=True, null=True)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected')
    ], default='pending', db_index=True)
    rejection_remarks = models.TextField(null=True, blank=True)

    order_type = models.CharField(
        max_length=3,
        choices=OrderType.choices,
        default=OrderType.SUPPLY,
        verbose_name="Order Type"
    )

    # Add custom managers
    objects = DivisionManager()
    all_objects = models.Manager()  # Access to all records without filtering

    class Meta:
        ordering = ['-id']
        indexes = [
            models.Index(fields=['batch_id', 'status']),
            models.Index(fields=['project', 'approved_status']),
            models.Index(fields=['cimcon_part_number', 'status']),
        ]

    def __str__(self):
        return f"Requisition #{self.item_no} for Project '{self.project.project_code}'"

    def save(self, *args, **kwargs):
        """Ensure requisition belongs to correct division"""
        if self.project and self.project.division:
            # Additional validation can be added here
            pass
        super().save(*args, **kwargs)
    
    def get_division(self):
        """Get the division this requisition belongs to"""
        return self.project.division if self.project else None

    def get_required_items(self):
        """Get all required items for this project with their quantities."""
        return Requisition.objects.filter(
            project=self,
            approved_status=True
        ).values(
            'cimcon_part_number',
            'material_description',
            'make',
            'material_group',
            'req_qty'
        )

class RequisitionHistory(models.Model):
    """
    Tracks the revision history of requisitions including all changes and approvals.
    """
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, db_index=True)
    field_name = models.CharField(max_length=255, db_index=True)
    old_value = models.TextField(null=True, blank=True)
    new_value = models.TextField(null=True, blank=True)
    changed_by = models.CharField(max_length=255, null=True, blank=True)
    approved_by = models.CharField(max_length=255, null=True, blank=True)
    changed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    revision_number = models.IntegerField()
    remarks = models.TextField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['requisition', 'field_name']),
            models.Index(fields=['changed_at', 'field_name']),
        ]

    def __str__(self):
        return f"History for {self.requisition} - {self.field_name}"

    @property
    def is_approved(self):
        return self.approval_status and self.approved_by is not None

    @classmethod
    def log_change(cls, requisition, field_name, old_value, new_value, changed_by, approved_by=None, remarks=None):
        """
        Helper method to create a history record for a change.
        """
        latest_revision = cls.objects.filter(
            requisition=requisition
        ).only('revision_number').order_by('-revision_number').first()
        
        revision_number = (latest_revision.revision_number + 1) if latest_revision else 1

        return cls.objects.create(
            requisition=requisition,
            field_name=field_name,
            old_value=str(old_value) if old_value is not None else None,
            new_value=str(new_value) if new_value is not None else None,
            changed_by=changed_by,
            approved_by=approved_by,
            remarks=remarks,
            revision_number=revision_number
        )

    def approve(self, user, remarks=None):
        """
        Approve this revision.
        """
        if not self.approval_status:
            self.approval_status = True
            self.approved_by = user.username
            self.approved_at = datetime.datetime.now()
            if remarks:
                self.remarks = remarks
            self.save()

    def get_change_description(self):
        """
        Returns a human-readable description of the change.
        """
        return f"Changed {self.field_name} from '{self.old_value}' to '{self.new_value}'"

 