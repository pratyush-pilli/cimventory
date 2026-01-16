"""
Factory Models Module

Django models for factory-specific database tables.
Replaces raw SQL operations with Django ORM.
"""

from django.db import models
from django.utils import timezone
from django.db.models import Max
import os


class FactoryProduct(models.Model):
    """Factory products model - Main table"""
    productid = models.AutoField(primary_key=True)
    productname = models.CharField(max_length=255, db_index=True)
    productcode = models.CharField(max_length=255, unique=True, db_index=True)
    
    class Meta:
        db_table = 'factory_products'
        ordering = ['productname']
        indexes = [
            models.Index(fields=['productname']),
            models.Index(fields=['productcode']),
        ]
    
    def __str__(self):
        return f"{self.productcode} - {self.productname}"


class FactoryMake(models.Model):
    """Factory makes model - linked to FactoryProduct"""
    makeid = models.AutoField(primary_key=True)
    productid = models.ForeignKey(
        FactoryProduct,
        on_delete=models.CASCADE,
        related_name='makes',
        db_column='productid'
    )
    makename = models.CharField(max_length=255, db_index=True)
    makecode = models.CharField(max_length=255, db_index=True)
    
    class Meta:
        db_table = 'factory_makes'
        ordering = ['makename']
        unique_together = (('productid', 'makecode'),)
        indexes = [
            models.Index(fields=['productid', 'makecode']),
            models.Index(fields=['makename']),
            models.Index(fields=['makecode']),
        ]
    
    def __str__(self):
        return f"{self.makecode} - {self.makename}"


class FactoryMPN(models.Model):
    """Factory Manufacturing Part Numbers model - linked to FactoryMake (which is linked to FactoryProduct)"""
    mpnid = models.AutoField(primary_key=True)
    makeid = models.ForeignKey(
        FactoryMake,
        on_delete=models.CASCADE,
        related_name='mpns',
        db_column='makeid'
    )
    mpncode = models.CharField(max_length=255, db_index=True)
    mpnfull = models.CharField(max_length=255, db_index=True)
    
    class Meta:
        db_table = 'factory_mpns'
        ordering = ['mpnfull']
        unique_together = (('makeid', 'mpncode'),)
        indexes = [
            models.Index(fields=['makeid', 'mpncode']),
            models.Index(fields=['mpncode']),
            models.Index(fields=['mpnfull']),
        ]
    
    def __str__(self):
        return f"{self.mpncode} - {self.mpnfull}"
    
    @property
    def productid(self):
        """Access product through make"""
        return self.makeid.productid if self.makeid else None
    
    @property
    def product(self):
        """Access product object through make"""
        return self.makeid.productid if self.makeid else None


class FactoryRating(models.Model):
    """Factory ratings model - linked to FactoryProduct"""
    ratingid = models.AutoField(primary_key=True)
    productid = models.ForeignKey(
        FactoryProduct,
        on_delete=models.CASCADE,
        related_name='ratings',
        db_column='productid'
    )
    ratingvalue = models.CharField(max_length=255, db_index=True)
    description = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'factory_ratings'
        ordering = ['ratingvalue']
        unique_together = (('productid', 'ratingvalue'),)
        indexes = [
            models.Index(fields=['productid', 'ratingvalue']),
            models.Index(fields=['ratingvalue']),
        ]
    
    def __str__(self):
        return self.ratingvalue


class FactoryPackage(models.Model):
    """Factory packages model - linked to FactoryProduct"""
    packageid = models.AutoField(primary_key=True)
    productid = models.ForeignKey(
        FactoryProduct,
        on_delete=models.CASCADE,
        related_name='packages',
        db_column='productid'
    )
    packagecode = models.CharField(max_length=255, db_index=True)
    packagedesc = models.TextField(blank=True, null=True)
    
    class Meta:
        db_table = 'factory_packages'
        ordering = ['packagecode']
        unique_together = (('productid', 'packagecode'),)
        indexes = [
            models.Index(fields=['productid', 'packagecode']),
            models.Index(fields=['packagecode']),
        ]
    
    def __str__(self):
        return f"{self.packagecode} - {self.packagedesc or ''}"


class FactoryItemDescription(models.Model):
    """Factory item descriptions model - linked to FactoryProduct"""
    itemdescid = models.AutoField(primary_key=True)
    productid = models.ForeignKey(
        FactoryProduct,
        on_delete=models.CASCADE,
        related_name='item_descriptions',
        db_column='productid'
    )
    itemdesc = models.TextField()
    
    class Meta:
        db_table = 'factory_itemdescriptions'
        ordering = ['itemdescid']
        indexes = [
            models.Index(fields=['productid']),
        ]
    
    def __str__(self):
        return self.itemdesc[:50] + "..." if len(self.itemdesc) > 50 else self.itemdesc


class FactoryItemRequest(models.Model):
    """Factory item request model - for pending/approval items"""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('pending', 'Pending'),
        ('approved', 'Approved'),
        ('rejected', 'Rejected'),
    ]
    
    request_id = models.AutoField(primary_key=True)
    requestor = models.CharField(max_length=255, db_index=True)
    
    # Foreign key references (optional, for linking to master tables)
    productid = models.ForeignKey(
        FactoryProduct,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='item_requests',
        db_column='productid'
    )
    makeid = models.ForeignKey(
        FactoryMake,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='item_requests',
        db_column='makeid'
    )
    
    # Stored text values (for flexibility and historical data)
    productname = models.CharField(max_length=255, db_index=True)
    productcode = models.CharField(max_length=255, db_index=True)
    makename = models.CharField(max_length=255, db_index=True)
    makecode = models.CharField(max_length=255, db_index=True)
    mpnfull = models.CharField(max_length=255, db_index=True)
    ratingvalue = models.CharField(max_length=255, blank=True, null=True)
    packagecode = models.CharField(max_length=255, blank=True, null=True)
    itemdesc = models.TextField()
    uom = models.CharField(max_length=50, blank=True, null=True)
    moq = models.IntegerField(default=0, blank=True, null=True)
    lead_time = models.IntegerField(default=0, blank=True, null=True)
    hsn_code = models.CharField(max_length=50, blank=True, null=True)
    bin_location = models.CharField(max_length=50, blank=True, null=True)
    full_part_number = models.CharField(max_length=255, db_index=True)
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='draft',
        db_index=True
    )
    
    # Approval/rejection fields
    rejection_reason = models.TextField(blank=True, null=True)
    approved_by = models.CharField(max_length=255, blank=True, null=True)
    rejected_by = models.CharField(max_length=255, blank=True, null=True)
    
    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True, db_index=True)
    
    class Meta:
        db_table = 'factory_itemrequest'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['status', 'created_at']),
            models.Index(fields=['requestor', 'status']),
            models.Index(fields=['full_part_number']),
            models.Index(fields=['productcode', 'makecode']),
        ]
    
    def __str__(self):
        return f"{self.full_part_number} - {self.status}"


class FactoryItemMaster(models.Model):
    """Factory item master model - for approved items"""
    item_id = models.AutoField(primary_key=True)
    product_name = models.CharField(max_length=255, db_index=True)
    make_name = models.CharField(max_length=255, db_index=True)
    mpn_full = models.CharField(max_length=255, db_index=True)
    material_rating = models.CharField(max_length=255, blank=True, null=True)
    package_type = models.CharField(max_length=255, blank=True, null=True)
    item_description = models.TextField()
    full_part_number = models.CharField(max_length=255, unique=True, db_index=True)
    uom = models.CharField(max_length=50, blank=True, null=True)
    moq = models.IntegerField(default=0, blank=True, null=True)
    lead_time = models.IntegerField(default=0, blank=True, null=True)
    hsn_code = models.CharField(max_length=50, blank=True, null=True)
    bin_location = models.CharField(max_length=50, blank=True, null=True)
    created_by = models.CharField(max_length=255, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = 'factory_itemmaster'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['product_name']),
            models.Index(fields=['make_name']),
            models.Index(fields=['full_part_number']),
            models.Index(fields=['created_at']),
        ]
    
    def __str__(self):
        return f"{self.full_part_number} - {self.product_name}"
