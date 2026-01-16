from django.db import models
from django.core import validators
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver
from purchase_order.models import PurchaseOrder, POLineItem

class Master(models.Model):
    """
    Represents details of an indent related to a requisition.
    """
    # Auto-incrementing primary key
    id = models.AutoField(primary_key=True)  # This will auto-increment starting from 1

    # Foreign Key to Requisition model (batch_id as the linking field in the 'Indent' app)
    requisition = models.ForeignKey(
        'indent.Requisition',  # Specify the app label and model name
        on_delete=models.CASCADE,  # Deleting a requisition will delete related Master records
        related_name="masters",
        null=True  # Enables reverse relationship
    )
    
    # Ordering Status choices
    IN_PROGRESS = 'In Progress'
    ORDERED = 'Ordered'
    PARTIAL_ORDERED = 'Partially Ordered'
    PARTIAL_DELIVERED = 'Partially Delivered'
    DELIVERED = 'Delivered'
    CANCELLED = 'Cancelled'

    STATUS_CHOICES = [
        (IN_PROGRESS, 'In Progress'),
        (ORDERED, 'Ordered'),
        (DELIVERED, 'Delivered'),
        (CANCELLED, 'Cancelled'),
        (PARTIAL_ORDERED, 'Partially Ordered'),
        (PARTIAL_DELIVERED, 'Partially Delivered'),
    ]

    indent_date = models.DateField()  # "Indent Date"
    ordering_status = models.CharField(
        max_length=20, choices=STATUS_CHOICES, default=IN_PROGRESS
    )  # "Ordering Status"
    indent_number = models.CharField(max_length=50, null=True, blank=True)  # "Indent No."
    cimcon_part_number = models.CharField(
        max_length=17, 
        null=True, 
        blank=True,
        validators=[
            validators.RegexValidator(
                r'^[A-Za-z0-9]{14,17}$',
                'CIMCON Part Number must be between 14 and 17 alphanumeric characters.'
            )
        ]
    )  # "CIMCON Part Number"
    mfg_part_number = models.CharField(max_length=100, null=True, blank=True)  # "Mfg. Part Number"
    material_description = models.TextField()  # "Material Description"
    make = models.CharField(max_length=100, null=True, blank=True)  # "Make"
    material_group = models.CharField(max_length=100, null=True, blank=True)  # "Material Group"
    required_quantity = models.IntegerField()  # "Req. Qty"
    unit = models.CharField(max_length=20)  # "Unit"
    required_by = models.DateField(null=True, blank=True)  # "Required By (Target Date)"
    soh = models.IntegerField(null=True, blank=True)  # "SOH"
    balance_quantity = models.IntegerField(null=True, blank=True)  # "Balance Qty."
    ordering_qty = models.IntegerField(null=True, blank=True)  # "Ordering Qty."
    verification_date = models.DateTimeField(
        default=timezone.now,
        null=True, 
        blank=True
    )  # Add verification date with default
    batch_id = models.CharField(max_length=100, blank = True, null=True)  # Add this field    
    ORDER_CHOICES = [
        ('SUP', 'Supply'),
        ('ITC', 'ITC'),
        ('ONM', 'O&M'),
        ('CON', 'Contract'),
        ('FRE', 'Freight'),
        ('SER', 'Service'),
    ]
    
    order_type = models.CharField(
        max_length=3,
        choices=ORDER_CHOICES,
        default='SUP',
        verbose_name="Order Type"
    )
    
    @property
    def calculate_balance_quantity(self):
        return self.required_quantity - (self.soh if self.soh is not None else 0)

    project_code = models.CharField(max_length=100)  # "Project Code"
    project_name = models.CharField(max_length=255)  # "Project Name"
    remarks = models.TextField(null=True, blank=True)  # "Remarks"
    # verification_date = models.DateTimeField(auto_now_add=True)  # Add verification date field

    def __str__(self):
        return f"{self.indent_number} - {self.project_name} ({self.ordering_status})"

    class Meta:
        ordering = ['id']  # Sort by id in ascending order

@receiver(post_save, sender=POLineItem)
def update_master_status(sender, instance, created, **kwargs):
    if created and instance.requisition_id:
        try:
            from master.models import Master
            master = Master.objects.get(id=instance.requisition_id)
            master.ordering_status = Master.ORDERED  # Using the constant from the model
            master.save()
        except Master.DoesNotExist:
            pass
        except Exception as e:
            logger.error(f"Error updating master status: {str(e)}")
