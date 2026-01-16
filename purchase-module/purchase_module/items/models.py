from django.db import models
from django.utils import timezone
import os

# Function to determine file upload path based on cimcon_part_no
def item_file_path(instance, filename):
    # Get the cimcon_part_no (either from ItemMaster or ItemRequest)
    cimcon_part_no = getattr(instance, 'cimcon_part_no', 'temp')
    # Create a safe folder name
    safe_folder_name = cimcon_part_no.replace("/", "_").replace("\\", "_")
    # Return path structure: item_documents/CIMCON_PART_NO/filename
    return os.path.join('item_documents', safe_folder_name, filename)

class MainCategory(models.Model):
    id = models.IntegerField(primary_key=True)
    name = models.CharField(max_length=100, unique=True, db_index=True)
    code = models.CharField(max_length=3, unique=True, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['name']),
            models.Index(fields=['code']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

class SubCategory(models.Model):
    main_category = models.ForeignKey(
        MainCategory, 
        on_delete=models.CASCADE, 
        related_name="subcategories",
        null=True,
        blank=True,
        db_index=True
    )
    name = models.CharField(max_length=100, db_index=True)
    code = models.CharField(max_length=3, db_index=True)

    class Meta:
        unique_together = ('main_category', 'code')
        indexes = [
            models.Index(fields=['main_category', 'code']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name} ({self.main_category.code if self.main_category else 'N/A'})"
    
class ProductRating(models.Model):
    main_category = models.ForeignKey(
        MainCategory, 
        on_delete=models.CASCADE, 
        related_name="product_ratings",
        null=True,
        blank=True,
        db_index=True
    )
    sub_category = models.ForeignKey(
        SubCategory, 
        on_delete=models.CASCADE, 
        related_name="product_ratings",
        null=True,
        blank=True,
        db_index=True
    )
    name = models.CharField(max_length=1000, db_index=True)
    code = models.CharField(max_length=3, db_index=True)

    class Meta:
        unique_together = ('main_category', 'sub_category', 'code')
        indexes = [
            models.Index(fields=['main_category', 'code']),
            models.Index(fields=['sub_category', 'code']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

class Make(models.Model):
    main_category = models.ForeignKey(
        MainCategory, 
        on_delete=models.CASCADE, 
        related_name="makes",
        null=True,
        blank=True,
        db_index=True
    )
    name = models.CharField(max_length=500, db_index=True)
    code = models.CharField(max_length=2, db_index=True)

    class Meta:
        unique_together = ('main_category', 'code')
        indexes = [
            models.Index(fields=['main_category', 'code']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name} ({self.main_category.code if self.main_category else 'N/A'})"

class ProductModel(models.Model):
    main_category = models.ForeignKey(
        MainCategory, 
        on_delete=models.CASCADE, 
        related_name="product_models",
        null=True,
        blank=True,
        db_index=True
    )
    name = models.CharField(max_length=100, db_index=True)
    code = models.CharField(max_length=3, db_index=True)

    class Meta:
        unique_together = ('main_category', 'code')
        indexes = [
            models.Index(fields=['main_category', 'code']),
            models.Index(fields=['name']),
        ]

    def __str__(self):
        return f"{self.code} - {self.name}"

class Remarks(models.Model):
    main_category = models.ForeignKey(
        MainCategory, 
        on_delete=models.CASCADE, 
        related_name="remarks",
        null=True,
        blank=True,
        db_index=True
    )
    description = models.CharField(max_length=255, db_index=True)
    code = models.CharField(max_length=4, db_index=True)

    class Meta:
        indexes = [
            models.Index(fields=['main_category', 'code']),
            models.Index(fields=['description']),
        ]

    def __str__(self):
        return f"{self.code} - {self.description}"

class ItemMaster(models.Model):
    name = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, null=True)
    main_category = models.ForeignKey(
        MainCategory, 
        on_delete=models.CASCADE, 
        related_name="items",
        null=True,
        blank=True,
        db_index=True
    )
    sub_category = models.ForeignKey(
        SubCategory, 
        on_delete=models.CASCADE, 
        related_name="items",
        null=True,
        blank=True,
        db_index=True
    )
    product_rating = models.ForeignKey(
        ProductRating,
        on_delete=models.CASCADE, 
        null=True, 
        blank=True,
        related_name="items",
        db_index=True
    )
    make = models.ForeignKey(
        Make, 
        on_delete=models.CASCADE, 
        related_name="items", 
        null=True, 
        blank=True,
        db_index=True
    )
    product_model = models.ForeignKey(
        ProductModel, 
        on_delete=models.CASCADE, 
        related_name="items", 
        null=True, 
        blank=True,
        db_index=True
    )
    remarks = models.ForeignKey(
        Remarks, 
        on_delete=models.CASCADE, 
        related_name="items", 
        blank=True, 
        null=True,
        db_index=True
    )
    cimcon_part_no = models.CharField(max_length=17, unique=True, db_index=True)
    alternate_no = models.CharField(max_length=16, null=True, blank=True, db_index=True)
    mfg_part_no = models.CharField(max_length=255, blank=True, null=True, db_index=True)

    # Additional Fields
    package = models.CharField(max_length=255, blank=True, null=True)
    uom = models.CharField(max_length=255, blank=True, null=True)
    moq = models.IntegerField(blank=True, null=True)
    mfg_std_lead_time = models.IntegerField(blank=True, null=True)
    bin = models.CharField(max_length=255, blank=True, null=True)
    hsn_code = models.CharField(max_length=255, blank=True, null=True)

    # Metadata Fields
    created_at = models.DateTimeField(auto_now_add=True, null=True, blank=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, null=True, blank=True, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)
    item_image = models.ImageField(upload_to='item_images/', blank=True, null=True)

    # Add document field
    document = models.FileField(upload_to=item_file_path, blank=True, null=True)
    document_name = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['cimcon_part_no']),
            models.Index(fields=['name']),
            models.Index(fields=['main_category', 'sub_category']),
            models.Index(fields=['make', 'product_model']),
            models.Index(fields=['created_at']),
            models.Index(fields=['is_active']),
            models.Index(fields=['mfg_part_no']),
        ]

    def __str__(self):
        return f"{self.cimcon_part_no} - {self.name}"

class ItemRequest(models.Model):
    STATUS_CHOICES = (
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    )
    
    requestor = models.CharField(max_length=100, db_index=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='draft', db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
    rejection_reason = models.TextField(blank=True, null=True)
    
    # Item fields
    productName = models.CharField(max_length=255, db_index=True)
    productCode = models.CharField(max_length=3, db_index=True)
    mfgPartNo = models.CharField(max_length=255, db_index=True)
    mfgPartCode = models.CharField(max_length=3, db_index=True)
    itemDescription = models.TextField()
    itemCode = models.CharField(max_length=4, db_index=True)
    make = models.CharField(max_length=100, db_index=True)
    makeCode = models.CharField(max_length=2, db_index=True)
    type = models.CharField(max_length=100, db_index=True)
    typeCode = models.CharField(max_length=2, db_index=True)
    materialRating = models.CharField(max_length=100, blank=True, null=True)
    materialRatingCode = models.CharField(max_length=3, blank=True, null=True)
    package = models.CharField(max_length=255, blank=True, null=True)
    uom = models.CharField(max_length=50, blank=True, null=True)
    moq = models.IntegerField(blank=True, null=True)
    leadTime = models.IntegerField(blank=True, null=True)
    hsnCode = models.CharField(max_length=50, blank=True, null=True)
    bin = models.CharField(max_length=50, blank=True, null=True)
    cimcon_part_no = models.CharField(max_length=50, db_index=True)

    # Add document field
    document = models.FileField(upload_to=item_file_path, blank=True, null=True)
    document_name = models.CharField(max_length=255, blank=True, null=True)

    class Meta:
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['requestor', 'status']),
            models.Index(fields=['cimcon_part_no']),
            models.Index(fields=['productCode', 'makeCode']),
        ]
