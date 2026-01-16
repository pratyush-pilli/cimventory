from django.db import models
from django.utils import timezone
from decimal import Decimal
from django.core.exceptions import ValidationError
import re

class PONumberSequence(models.Model):
    financial_year = models.CharField(max_length=4, unique=True)  # e.g., "2425" for 2024-25
    last_sequence = models.IntegerField(default=0)

    class Meta:
        db_table = 'po_number_sequence'

    def __str__(self):
        return f"FY {self.financial_year}: {self.last_sequence}"

class PurchaseOrder(models.Model):
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending_approval', 'Pending Approval'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
        ('ordered', 'Ordered'),
        ('partially_ordered', 'Partially Ordered'),
        ('delivered', 'Delivered'),
        ('partially_delivered', 'Partially Delivered'),
        ('cancelled', 'Cancelled'),
        ('on_hold', 'On Hold')
    ]

    # PO Details
    po_number = models.CharField(max_length=100, unique=True)
    po_date = models.DateField(default=timezone.now)
    quote_ref_number = models.CharField(max_length=100, blank=True, null=True)
    project_code = models.CharField(max_length=100, blank=True, null=True)
    version = models.DecimalField(max_digits=3, decimal_places=1, default=1.0)

    # Vendor Details
    vendor_name = models.CharField(max_length=200)
    vendor_address = models.TextField()
    vendor_email = models.EmailField(blank=True, null=True)
    vendor_gstin = models.CharField(max_length=15, blank=True, null=True)
    vendor_pan = models.CharField(max_length=15, blank=True, null=True)
    vendor_state = models.CharField(max_length=100, blank=True, null=True)
    vendor_state_code = models.CharField(max_length=100, blank=True, null=True)
    vendor_contact = models.CharField(max_length=100, blank=True, null=True)
    vendor_payment_terms = models.TextField(blank=True, null=True)
    
    
    
    # Financial Details
    total_amount = models.DecimalField(max_digits=12, decimal_places=2)
    vendor_code = models.CharField(max_length=100, blank=True, null=True)
    # Terms and Conditions
    payment_terms = models.TextField(default="100% Against Invoice")
    warranty_terms = models.TextField(default="1 year from date of invoice")
    delivery_schedule = models.TextField(default="1 week from date of Purchase order")
    
    freight_terms = models.TextField(default="Freight & Insurance Extra")
    tpi_terms = models.TextField(default="TPI Inspection Exclusive")
    installation_terms = models.TextField(default="Installation Exclusive")
    commissioning = models.TextField(default="Commissioning Exclusive")
    
    # Additional fields
    #Consignee Details and Invoice Details
    consignee_name = models.CharField(max_length=200, blank=True, null=True)
    consignee_address = models.TextField(blank=True, null=True)
    consignee_mobile = models.CharField(max_length=15, blank=True, null=True)
    consignee_attention = models.CharField(max_length=100, blank=True, null=True)
    invoice_name = models.CharField(max_length=200, blank=True, null=True)
    invoice_address = models.TextField(blank=True, null=True)
    invoice_gstin = models.CharField(max_length=15, blank=True, null=True)
    
    # Status and Tracking
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft')
    notes = models.TextField(blank=True, default="NA")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.CharField(max_length=100, null=True)  # User who created the PO
    inward_status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='open'
    )
    total_inwarded_quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )

    # Add approval status field
    approval_status = models.BooleanField(default=False)
    rejection_status = models.BooleanField(default=False)
    approval_date = models.DateTimeField(null=True, blank=True)
    approved_by = models.CharField(max_length=100, null=True, blank=True)
    rejection_remarks = models.TextField(null=True, blank=True)
    rejected_by = models.CharField(max_length=100, null=True, blank=True)
    rejection_date = models.DateTimeField(null=True, blank=True)
    currency_code = models.CharField(max_length=10)
    currency_symbol = models.CharField(max_length=10)
    is_revised = models.BooleanField(
    default=False,
    help_text="Whether this PO has been revised")
    revision_number = models.IntegerField(
    default=1,
    help_text="Revision number for this PO")
    class Meta:
        db_table = 'purchase_orders'
        ordering = ['-created_at']

    @staticmethod
    def generate_po_number() -> str:
        """Generate a PO number in the format CIMPO-YYYYXXXXX"""
        current_date = timezone.now()
        
        # Determine financial year
        if current_date.month >= 4:  # April onwards
            financial_year = f"{str(current_date.year)[2:]}{str(current_date.year + 1)[2:]}"
        else:  # January to March
            financial_year = f"{str(current_date.year - 1)[2:]}{str(current_date.year)[2:]}"

        # Get or create sequence for current financial year
        sequence_obj, created = PONumberSequence.objects.get_or_create(
            financial_year=financial_year
        )

        # Increment sequence
        sequence_obj.last_sequence += 1
        sequence_obj.save()

        # Format sequence number to 5 digits
        sequence_number = str(sequence_obj.last_sequence).zfill(5)

        # Generate PO number
        po_number = f"CIMPO-{financial_year}{sequence_number}"

        return po_number

    # def clean(self):
    #     """Validate PO number format"""
    #     if self.po_number:
    #         pattern = r'^CIMPO-\d{9}$'
    #         if not re.match(pattern, self.po_number):
    #             raise ValidationError({
    #                 'po_number': 'Invalid PO number format. Should be CIMPO-YYYYXXXXX'
    #             })

    def save(self, *args, **kwargs):
        if not self.po_number:
            self.po_number = self.generate_po_number()
        self.clean()
        super().save(*args, **kwargs)

    def increment_version(self):
        self.version = (self.version or Decimal('1.0')) + Decimal('1.0')

    def __str__(self):
        return f"{self.po_number}"

class POLineItem(models.Model):
    purchase_order = models.ForeignKey(
        PurchaseOrder, 
        on_delete=models.CASCADE,
        related_name='line_items'
    )
    requisition_id = models.IntegerField()
    item_no = models.CharField(max_length=100)  # CPN
    material_description = models.TextField()
    make =  models.CharField(max_length=100, null=True, blank=True)  # Add this line
    material_group = models.CharField(max_length=100, null=True, blank=True)  # Add this line
    hsn_code = models.CharField(max_length=20, null=True, blank=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    unit = models.CharField(max_length=20)
    unit_price = models.DecimalField(max_digits=10, decimal_places=2)
    total_price = models.DecimalField(max_digits=12, decimal_places=2)
    expected_delivery = models.DateField(null=True, blank=True)
    inwarded_quantity = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0
    )
    added_in_revision = models.DecimalField(
        max_digits=3,
        decimal_places=1,
        null=True,
        blank=True,
        help_text="Version number when this item was added to the PO"
    )
    is_revised = models.BooleanField(
        default=False,
        help_text="Whether this item was modified in a revision"
    )
    
    class Meta:
        db_table = 'po_line_items'

    def save(self, *args, **kwargs):
        # Auto-calculate total price
        self.total_price = self.quantity * self.unit_price
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.purchase_order.po_number} - {self.item_no}"

class POHistory(models.Model):
    ACTION_TYPES = [
        ('created', 'Created'),
        ('updated', 'Updated'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    purchase_order = models.ForeignKey(
        PurchaseOrder,
        on_delete=models.CASCADE,
        related_name='history'
    )
    action = models.CharField(max_length=50)
    description = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.CharField(max_length=100)

     # Version transition (optional for non-revision actions)
    previous_version = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)
    new_version = models.DecimalField(max_digits=3, decimal_places=1, null=True, blank=True)


    class Meta:
        db_table = 'po_history'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.purchase_order.po_number} - {self.action}"