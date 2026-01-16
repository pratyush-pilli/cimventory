"""
Factory module URL patterns
All factory-related endpoints are defined here
"""

from django.urls import path
from . import views

urlpatterns = [
    # MPN Management - Core functionality
    path('get-factory-mpns/', views.get_factory_mpns, name='get_factory_mpns'),
    path('create-factory-mpn/', views.create_factory_mpn, name='create_factory_mpn'),
    path('submit-factory-item/', views.submit_factory_item_request, name='submit_factory_item'),
    
    # Frontend compatibility endpoints
    path('mpns/', views.get_factory_mpns, name='factory_mpns_compat'),
    path('submit-item/', views.submit_factory_item_request, name='submit_item_compat'),
    
    # Factory Products (legacy endpoints)
    path('products/', views.get_factory_products, name='factory_products'),
    path('products/create/', views.create_factory_product, name='create_factory_product'),
    path('makes/create/', views.create_factory_make, name='create_factory_make'),
    path('product-models/create/', views.create_factory_product_model, name='create_factory_product_model'),
    path('ratings/', views.get_factory_ratings, name='factory_ratings'),
    path('ratings/create/', views.create_factory_rating, name='create_factory_rating'),
    path('packages/create/', views.create_factory_package, name='create_factory_package'),
    path('items/', views.get_factory_items, name='get_factory_items'),
    
    # Factory Related Options (for dropdowns)
    path('related-options/', views.get_factory_related_options, name='factory-related-options'),
    path('next-mpn-code/', views.get_next_mpn_code, name='get_next_mpn_code'),
    path('combined-item-requests/', views.CombinedItemRequestView.as_view(), name='combined_item_requests'),
    path('update-factory-item-request/<int:request_id>/', views.UpdateFactoryItemRequestView.as_view(), name='update_factory_item_request'),
    path('approve-factory-item-request/<int:request_id>/', views.approve_factory_item_request, name='approve_factory_item_request'),
    path('reject-factory-item-request/<int:request_id>/', views.reject_factory_item_request, name='reject_factory_item_request'),
    
    # Debug endpoint
    path('debug-data/', views.debug_factory_data, name='debug_factory_data'),
]