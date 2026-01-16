from django.db import models
from django.db.models import Sum 
from django.utils import timezone
from decimal import Decimal
from django.core.exceptions import ValidationError
from indent.models import Project
from master.models import Master
from django.db.models.signals import pre_save
from django.dispatch import receiver
from django.db import transaction

class ProjectCode(models.Model):
    """
    Represents a project code that can be associated with stock allocations.
    """
    code = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="store", null=True, blank=True, db_index=True)
    name = models.CharField(max_length=200, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['code']),
        ]

    def __str__(self):
        return str(self.code.project_code) if self.code else self.name


class Inventory(models.Model):
    """
    Represents the inventory of items, including stock levels and calculations.
    """
    inward_entry = models.ForeignKey('InwardEntry', on_delete=models.CASCADE, 
                                     related_name='inventory_entries', null=True, blank=True, db_index=True)
    material_group = models.CharField(max_length=150, blank=True, null=True, db_index=True)
    item_no = models.CharField(max_length=150, blank=True, null=True, db_index=True)
    description = models.TextField(blank=True, null=True)
    make = models.CharField(max_length=130, blank=True, null=True, db_index=True)
    opening_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    allocated_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0, db_index=True)
    available_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0, db_index=True)
    total_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0, db_index=True)
    times_sq_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    i_sq_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    sakar_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    pirana_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    other_stock = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    remarks = models.TextField(blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['item_no']),
            models.Index(fields=['material_group']),
            models.Index(fields=['make']),
            models.Index(fields=['total_stock', 'available_stock']),
            models.Index(fields=['item_no', 'material_group']),
        ]

    @property
    def outward_stock(self):
        """Calculate total outward stock with optimized query"""
        if not self.pk:
            return 0
        total = self.stockoutward_set.aggregate(total=Sum('quantity'))['total']
        return total if total is not None else 0

    def calculate_available_stock(self):
        """Recalculate available stock considering location-wise allocations and outwards"""
        # Calculate total stock from all locations
        total_location_stock = (
            self.times_sq_stock +
            self.i_sq_stock +
            self.sakar_stock +
            self.pirana_stock +
            self.other_stock
        )
        
        # Optimized query with select_related
        total_allocated = LocationWiseAllocation.objects.filter(
            stock_allocation__inventory=self,
            stock_allocation__status='allocated'
        ).aggregate(
            total=Sum('quantity')
        )['total'] or Decimal('0')

        # Optimized outward calculation
        total_outward = self.stockoutward_set.aggregate(
            total=Sum('quantity')
        )['total'] or Decimal('0')

        self.total_stock = total_location_stock
        self.allocated_stock = total_allocated
        self.available_stock = total_location_stock - total_allocated

    def get_allocated_stock(self):
        """Get total allocated stock for this inventory item with optimized query"""
        allocated_stock = StockAllocation.objects.filter(
            inventory=self,
            status='allocated'
        ).aggregate(
            total=models.Sum('allocated_quantity')
        )['total'] or Decimal('0')
        return allocated_stock

    def get_remaining_stock(self):
        """Get remaining stock available for allocation"""
        return self.available_stock - self.get_allocated_stock()

    def update_master_soh(self):
        """Update the SOH in the master table based on the item code."""
        try:
            master_entry = Master.objects.get(cimcon_part_number=self.item_no)
            master_entry.soh = self.total_stock
            master_entry.save()
        except Master.DoesNotExist:
            print(f"No master entry found for item code: {self.item_no}")
        except Exception as e:
            print(f"Error updating master SOH for item code {self.item_no}: {e}")

    def calculate_total_stock(self):
        """Calculate total stock (SOH)."""
        total_location_stock = (
            self.times_sq_stock +
            self.i_sq_stock +
            self.sakar_stock +
            self.pirana_stock +
            self.other_stock
        )
        
        self.total_stock = total_location_stock
        return self.total_stock

    def save(self, *args, **kwargs):
        # Only calculate stocks if we have a primary key (not on initial creation)
        if self.pk:
            self.calculate_available_stock()
        else:
            # For new records, just calculate total stock without relationships
            self.total_stock = (
                self.times_sq_stock +
                self.i_sq_stock +
                self.sakar_stock +
                self.pirana_stock +
                self.other_stock
            )
            self.available_stock = self.total_stock

        # Calculate total stock is safe to call
        self.calculate_total_stock()
        super().save(*args, **kwargs)
        
        # Now that we have a primary key, we can update master SOH
        self.update_master_soh()

    def get_location_stock_details(self, location_field):
        """Get detailed stock information for a specific location with optimized queries"""
        current_stock = getattr(self, location_field)
        
        # Optimized query with select_related
        allocated_stock = LocationWiseAllocation.objects.filter(
            stock_allocation__inventory=self,
            stock_allocation__status='allocated',
            location=location_field
        ).select_related('stock_allocation').aggregate(
            total=Sum('quantity')
        )['total'] or Decimal('0')

        # Optimized outward query
        outward_stock = self.stockoutward_set.filter(
            location=location_field
        ).aggregate(
            total=Sum('quantity')
        )['total'] or Decimal('0')

        # Calculate location-specific available stock
        location_available_stock = current_stock - allocated_stock

        return {
            'total': current_stock,
            'allocated': allocated_stock,
            'available': location_available_stock,
            'outward': outward_stock
        }


class LocationWiseAllocation(models.Model):
    """
    Represents location-wise allocation details for each stock allocation
    """
    stock_allocation = models.ForeignKey('StockAllocation', on_delete=models.CASCADE, related_name='location_allocations', db_index=True)
    location = models.CharField(max_length=50, choices=[
        ('times_sq_stock', 'Times Square'),
        ('i_sq_stock', 'iSquare'),
        ('sakar_stock', 'Sakar'),
        ('pirana_stock', 'Pirana'),
        ('other_stock', 'Other')
    ], db_index=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2, db_index=True)
    
    class Meta:
        indexes = [
            models.Index(fields=['stock_allocation', 'location']),
            models.Index(fields=['location', 'quantity']),
        ]
    
    def save(self, *args, **kwargs):
        with transaction.atomic():
            super().save(*args, **kwargs)
            
            # Update inventory's available stock calculation
            inventory = self.stock_allocation.inventory
            inventory.calculate_available_stock()
            inventory.save()


class StockAllocation(models.Model):
    """
    Enhanced StockAllocation model to track project and location details
    """
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, related_name='allocations', db_index=True)
    project_code = models.ForeignKey(ProjectCode, on_delete=models.CASCADE, related_name='stock_allocations', db_index=True)
    allocated_quantity = models.DecimalField(max_digits=10, decimal_places=2, db_index=True)
    allocation_date = models.DateField(auto_now_add=True, db_index=True)
    remarks = models.TextField(blank=True, null=True)
    is_partial = models.BooleanField(default=False, db_index=True)
    status = models.CharField(max_length=20, choices=[
        ('allocated', 'Allocated'),
        ('partially_outward', 'Partially Outward'),
        ('fully_outward', 'Fully Outward'),
        ('cancelled', 'Cancelled')
    ], default='allocated', db_index=True)
    parent_allocation = models.ForeignKey('self', null=True, blank=True, on_delete=models.SET_NULL, related_name='reallocations')
    reallocation_date = models.DateTimeField(null=True, blank=True)
    reallocation_reason = models.TextField(null=True, blank=True)

    class Meta:
        indexes = [
            models.Index(fields=['inventory', 'status']),
            models.Index(fields=['project_code', 'status']),
            models.Index(fields=['allocation_date', 'status']),
            models.Index(fields=['inventory', 'project_code']),
        ]

    def save(self, *args, **kwargs):
        is_new = self.pk is None
        super().save(*args, **kwargs)
        
        if is_new:  # Only update on creation
            # Update inventory allocated_stock
            self.inventory.allocated_stock += self.allocated_quantity
            self.inventory.calculate_available_stock()
            self.inventory.save()

    def can_reallocate(self):
        """Check if this allocation can be reallocated"""
        return (
            self.status == 'allocated' and 
            self.allocated_quantity > 0 and
            not self.outwards.exists()
        )
        
    def reallocate(self, new_project_code, quantity, location, remarks=None):
        """Reallocate stock to a new project while maintaining allocation history"""
        if not self.can_reallocate():
            raise ValidationError("This allocation cannot be reallocated")
            
        if quantity > self.allocated_quantity:
            raise ValidationError("Cannot reallocate more than allocated quantity")
            
        with transaction.atomic():
            # Reduce quantity from current allocation
            self.allocated_quantity -= quantity
            if self.allocated_quantity == 0:
                self.status = 'fully_outward'
            else:
                self.status = 'partially_outward'
            self.save()
            
            # Create new allocation
            new_allocation = StockAllocation.objects.create(
                inventory=self.inventory,
                project_code=new_project_code,
                allocated_quantity=quantity,
                remarks=remarks or f"Reallocated from {self.project_code}",
                parent_allocation=self,
                reallocation_date=timezone.now()
            )
            
            # Create location wise allocation
            LocationWiseAllocation.objects.create(
                stock_allocation=new_allocation,
                location=location,
                quantity=quantity
            )
            
            return new_allocation

class InwardEntry(models.Model):
    """
    Represents an inward entry for received items against a purchase order.
    """
    INWARD_STATUS_CHOICES = [
        ('Ordered', 'Ordered'),
        ('Partially Delivered', 'Partially Delivered'),
        ('Delivered', 'Delivered'),
    ]

    po_number = models.CharField(max_length=100, db_index=True)
    received_date = models.DateField(db_index=True)
    location = models.CharField(max_length=100, db_index=True)
    remarks = models.TextField(blank=True, null=True)
    inward_status = models.CharField(
        max_length=20,
        choices=INWARD_STATUS_CHOICES,
        default='Ordered',
        db_index=True
    )

    # Item details
    item_code = models.CharField(max_length=100, db_index=True)
    description = models.TextField()
    make = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    material_group = models.CharField(max_length=50, blank=True, null=True, db_index=True)
    ordered_quantity = models.DecimalField(max_digits=10, decimal_places=2, blank=True, null=True)
    quantity_received = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    already_inwarded = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    
    # Add purchase invoice field
    purchase_invoice = models.FileField(upload_to='purchase_invoices/', blank=True, null=True)
    invoice_number = models.CharField(max_length=100, blank=True, null=True, db_index=True)
    invoice_date = models.DateField(blank=True, null=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['po_number', 'item_code']),
            models.Index(fields=['received_date', 'inward_status']),
            models.Index(fields=['location', 'received_date']),
            models.Index(fields=['invoice_number', 'invoice_date']),
        ]

    def __str__(self):
        return f"Inward Entry for PO: {self.po_number} - Item: {self.item_code} (Received: {self.quantity_received})"

    def update_inward_status(self):
        """Update the inward status based on ordered and received quantities"""
        if self.quantity_received == 0:
            self.inward_status = 'Ordered'
        elif self.quantity_received < self.ordered_quantity:
            self.inward_status = 'Partially Delivered'
        else:
            self.inward_status = 'Delivered'

    def save(self, *args, **kwargs):
        # Update already_inwarded
        self.already_inwarded += self.quantity_received
        
        # Update inward status
        self.update_inward_status()
        
        # Save the InwardEntry first
        super().save(*args, **kwargs)


class StockOutward(models.Model):
    LOCATION_CHOICES = [
        ('times_sq_stock', 'Times Square'),
        ('i_sq_stock', 'iSquare'),
        ('sakar_stock', 'Sakar'),
        ('pirana_stock', 'Pirana'),
        ('other_stock', 'Other'),
    ]

    # Add indexes for frequently queried fields
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, db_index=True)
    project_code = models.ForeignKey(ProjectCode, on_delete=models.CASCADE, db_index=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    location = models.CharField(max_length=50, choices=LOCATION_CHOICES, db_index=True)
    outward_type = models.CharField(max_length=20, choices=[
        ('allocated', 'Allocated Stock'),
        ('available', 'Available Stock')
    ], db_index=True)
    document_type = models.CharField(max_length=20, choices=[
        ('challan', 'Delivery Challan'),
        ('instructions', 'Billing Instructions')
    ], db_index=True)
    document_number = models.CharField(max_length=50, db_index=True)
    remarks = models.TextField(blank=True)
    status = models.CharField(max_length=20, default='draft', db_index=True)
    stock_allocation = models.ForeignKey(
        StockAllocation, 
        on_delete=models.SET_NULL, 
        null=True, 
        blank=True,
        related_name='outwards'
    )
    outward_date = models.DateTimeField(auto_now_add=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        # Add indexes for common query patterns
        indexes = [
            models.Index(fields=['outward_date', 'status']),
            models.Index(fields=['inventory', 'project_code']),
            models.Index(fields=['document_type', 'document_number']),
            models.Index(fields=['inventory', 'outward_date']),
            models.Index(fields=['project_code', 'outward_date']),
        ]
        # Order by most recent first
        ordering = ['-outward_date']

    def save(self, *args, **kwargs):
        with transaction.atomic():
            if not self.pk:  # Only on creation
                inventory = self.inventory
                current_stock = getattr(inventory, self.location)
                
                # Validate stock availability
                if current_stock < self.quantity:
                    raise ValidationError(
                        f"Insufficient stock at {self.get_location_display()}: "
                        f"Available {current_stock}, Requested {self.quantity}"
                    )

                # Update location stock
                setattr(inventory, self.location, current_stock - self.quantity)

                if self.outward_type == 'allocated':
                    # Find allocation for this location
                    location_allocation = LocationWiseAllocation.objects.filter(
                        stock_allocation__inventory=inventory,
                        stock_allocation__project_code=self.project_code,
                        stock_allocation__status='allocated',
                        location=self.location
                    ).select_related('stock_allocation').first()

                    if not location_allocation:
                        raise ValidationError(
                            f"No allocation found for {self.get_location_display()} "
                            f"for project {self.project_code}"
                        )

                    if location_allocation.quantity < self.quantity:
                        raise ValidationError(
                            f"Insufficient allocated stock at {self.get_location_display()}: "
                            f"Allocated {location_allocation.quantity}, Requested {self.quantity}"
                        )

                    # Update location allocation
                    location_allocation.quantity -= self.quantity
                    location_allocation.save()

                    # Update main allocation
                    allocation = location_allocation.stock_allocation
                    allocation.allocated_quantity -= self.quantity
                    if allocation.allocated_quantity <= 0:
                        allocation.status = 'fully_outward'
                    else:
                        allocation.status = 'partially_outward'
                    allocation.save()

                # Recalculate inventory totals
                inventory.calculate_available_stock()
                inventory.save()

            super().save(*args, **kwargs)

    def get_location_display_name(self):
        return dict(self.LOCATION_CHOICES).get(self.location, self.location)

    def __str__(self):
        return f"Outward {self.id} - {self.inventory.item_no} - {self.quantity}"
    
    
    
    
    
class ReturnableGatePass(models.Model):
    PASS_TYPE_CHOICES = [
        ('outward', 'Outward - External'),
        ('internal', 'Internal Transfer')
    ]
    
    STATUS_CHOICES = [
        ('issued', 'Issued'),
        ('partially_returned', 'Partially Returned'),
        ('fully_returned', 'Fully Returned'),
        ('overdue', 'Overdue'),
        ('cancelled', 'Cancelled')
    ]
    
    gate_pass_number = models.CharField(max_length=20, unique=True, db_index=True)
    pass_type = models.CharField(max_length=20, choices=PASS_TYPE_CHOICES, db_index=True)
    issue_date = models.DateField(db_index=True)
    expected_return_date = models.DateField(null=True, blank=True, db_index=True)
    issued_to = models.CharField(max_length=255, db_index=True)
    issued_to_contact = models.CharField(max_length=20, null=True, blank=True)
    purpose = models.TextField()
    source_location = models.CharField(max_length=100, db_index=True)
    destination_location = models.CharField(max_length=100, null=True, blank=True)
    project_code = models.ForeignKey('store.ProjectCode', on_delete=models.SET_NULL, null=True, blank=True, db_index=True)
    remarks = models.TextField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='issued', db_index=True)
    created_by = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    document_path = models.CharField(max_length=255, null=True, blank=True)
    
    def __str__(self):
        return f"Gate Pass {self.gate_pass_number} - {self.get_status_display()}"
        
    def update_status(self):
        """Update gate pass status based on item returns"""
        if self.expected_return_date and self.expected_return_date < timezone.now().date() and self.status in ['issued', 'partially_returned']:
            self.status = 'overdue'
            self.save()
            return
            
        items = self.items.all()
        if not items:
            return
            
        returned_qty = sum(item.returned_quantity for item in items)
        total_qty = sum(item.quantity for item in items)
        
        if returned_qty == 0:
            new_status = 'issued'
        elif returned_qty < total_qty:
            new_status = 'partially_returned'
        else:
            new_status = 'fully_returned'
            
        if new_status != self.status:
            self.status = new_status
            self.save()

class ReturnableGatePassItem(models.Model):
    gate_pass = models.ForeignKey(ReturnableGatePass, related_name='items', on_delete=models.CASCADE, db_index=True)
    inventory = models.ForeignKey('store.Inventory', on_delete=models.CASCADE, db_index=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    returned_quantity = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    source_location = models.CharField(max_length=50, db_index=True)
    destination_location = models.CharField(max_length=50, null=True, blank=True)
    condition_on_issue = models.TextField(null=True, blank=True)
    condition_on_return = models.TextField(null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)
    
    def __str__(self):
        return f"{self.inventory.item_no} - {self.quantity} units"
        
class ReturnableGatePassReturn(models.Model):
    gate_pass = models.ForeignKey(ReturnableGatePass, related_name='returns', on_delete=models.CASCADE, db_index=True)
    return_date = models.DateField(db_index=True)
    received_by = models.CharField(max_length=100)
    remarks = models.TextField(null=True, blank=True)
    
    def __str__(self):
        return f"Return for {self.gate_pass.gate_pass_number} on {self.return_date}"

class ReturnableGatePassReturnItem(models.Model):
    gate_pass_return = models.ForeignKey(ReturnableGatePassReturn, related_name='items', on_delete=models.CASCADE, db_index=True)
    gate_pass_item = models.ForeignKey(ReturnableGatePassItem, related_name='return_entries', on_delete=models.CASCADE, db_index=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    condition = models.CharField(max_length=100, null=True, blank=True)
    remarks = models.TextField(null=True, blank=True)
    
    def __str__(self):
        return f"Return of {self.quantity} units of {self.gate_pass_item.inventory.item_no}"
    
    
    
    
    
class RejectedMaterialReturn(models.Model):
    RETURN_STATUS_CHOICES = [
        ('pending', 'Pending Processing'),
        ('added_to_stock', 'Added to Stock'),
        ('discarded', 'Discarded/Scrapped'),
    ]
    
    challan_number = models.CharField(max_length=50, db_index=True)
    client_name = models.CharField(max_length=200, db_index=True)
    return_date = models.DateField(db_index=True)
    project_code = models.ForeignKey(ProjectCode, on_delete=models.SET_NULL, null=True, blank=True, db_index=True)
    reason_for_return = models.TextField()
    action_taken = models.CharField(max_length=20, choices=RETURN_STATUS_CHOICES, default='pending', db_index=True)
    remarks = models.TextField(blank=True, null=True)
    document_path = models.CharField(max_length=255, null=True, blank=True)
    created_by = models.CharField(max_length=100)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    def __str__(self):
        return f"Return #{self.id} - {self.challan_number}"

class RejectedMaterialItem(models.Model):
    material_return = models.ForeignKey(RejectedMaterialReturn, related_name='items', on_delete=models.CASCADE, db_index=True)
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, db_index=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    location = models.CharField(max_length=50, choices=[
        ('times_sq_stock', 'Times Square'),
        ('i_sq_stock', 'iSquare'),
        ('sakar_stock', 'Sakar'),
        ('pirana_stock', 'Pirana'),
        ('other_stock', 'Other'),
    ], blank=True, null=True)
    condition = models.CharField(max_length=100)
    action = models.CharField(max_length=20, choices=[
        ('add_to_stock', 'Add to Stock'),
        ('discard', 'Discard/Scrap'),
    ], db_index=True)
    reason_details = models.TextField(blank=True, null=True)
    
    def __str__(self):
        return f"{self.inventory.item_no} - {self.quantity} units"
    
    
    
    
    
class DeliveryChallan(models.Model):
    """
    Represents a delivery challan document generated from outward transactions.
    """
    document_number = models.CharField(max_length=50, unique=True, db_index=True)
    project_code = models.ForeignKey(ProjectCode, on_delete=models.CASCADE, db_index=True)
    date = models.DateField(db_index=True)
    reference_no = models.CharField(max_length=100, blank=True, null=True)
    mode_of_transport = models.CharField(max_length=100, blank=True, null=True)
    vehicle_no = models.CharField(max_length=50, blank=True, null=True)
    dispatch_from = models.CharField(max_length=100, blank=True, null=True)
    place_of_supply = models.CharField(max_length=100, blank=True, null=True)
    bill_to = models.TextField(blank=True, null=True)
    ship_to = models.TextField(blank=True, null=True)
    remarks = models.TextField(blank=True, null=True)
    document_path = models.CharField(max_length=255, null=True, blank=True)
    cgst = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    sgst = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    igst = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    total_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    created_by = models.CharField(max_length=100, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    def __str__(self):
        return f"Delivery Challan {self.document_number}"
    
    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['document_number']),
            models.Index(fields=['date']),
            models.Index(fields=['project_code']),
            models.Index(fields=['created_at']),
        ]

class DeliveryChallanItem(models.Model):
    """
    Represents an item listed in a delivery challan.
    """
    challan = models.ForeignKey(DeliveryChallan, related_name='items', on_delete=models.CASCADE, db_index=True)
    inventory = models.ForeignKey(Inventory, on_delete=models.CASCADE, db_index=True)
    item_no = models.CharField(max_length=150, db_index=True)
    description = models.TextField()
    make = models.CharField(max_length=130, blank=True, null=True)
    material_group = models.CharField(max_length=150, blank=True, null=True)
    hsn_code = models.CharField(max_length=50, blank=True, null=True)
    quantity = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=12, decimal_places=2)
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    uom = models.CharField(max_length=20, default="NOS")
    
    def __str__(self):
        return f"{self.item_no} - {self.quantity} {self.uom}"
    
    
    
    
    