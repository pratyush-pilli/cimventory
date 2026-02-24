import os
import re
import logging
from datetime import datetime
from io import BytesIO
from reportlab.lib.utils import ImageReader
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm, inch
from reportlab.platypus import (
    BaseDocTemplate, Table, TableStyle, Paragraph, Spacer, 
    PageBreak, Frame, PageTemplate, LongTable, NextPageTemplate, FrameBreak, Image
)
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT, TA_JUSTIFY
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from django.conf import settings

logger = logging.getLogger(__name__)

class PurchaseOrderPDFGenerator:
    """Enhanced PDF generator for Purchase Orders with complete details"""
    
    def __init__(self):
        self.styles = None
        self.font_found = False
        self.current_dir = os.path.dirname(os.path.abspath(__file__))
        self.setup_fonts()

    def setup_fonts(self):
        """Setup Unicode-compatible fonts for currency symbols"""
        # Try multiple font paths for different systems
        potential_fonts = [
            # Windows paths
            'C:/Windows/Fonts/arial.ttf',
            'C:/Windows/Fonts/calibri.ttf',
            'C:/Windows/Fonts/tahoma.ttf',
            # Linux paths
            '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
            '/usr/share/fonts/TTF/arial.ttf',
            # macOS paths
            '/System/Library/Fonts/Arial.ttf',
            '/Library/Fonts/Arial.ttf',
            # Generic fallbacks
            os.path.join(os.path.dirname(__file__), 'fonts', 'arial.ttf'),
            os.path.join(settings.BASE_DIR, 'static', 'fonts', 'arial.ttf') if hasattr(settings, 'BASE_DIR') else None
        ]

        # Filter out None values
        potential_fonts = [font for font in potential_fonts if font is not None]

        # Try to register each font
        for font in potential_fonts:
            if os.path.exists(font):
                try:
                    pdfmetrics.registerFont(TTFont('CurrencyFont', font))
                    self.font_found = True
                    logger.info(f"Successfully registered font: {font}")
                    break
                except Exception as e:
                    logger.warning(f"Failed to register font {font}: {str(e)}")
                    continue

    def setup_styles(self):
        """Setup comprehensive PDF styles"""
        self.styles = getSampleStyleSheet()
        
        # Enhanced styles for better formatting
        self.styles.add(ParagraphStyle(
            name='CenterBold',
            parent=self.styles['Heading1'],
            alignment=TA_CENTER,
            fontSize=10,
            leading=12,
            fontName='Helvetica-Bold',
            spaceAfter=5,
        ))

        self.styles.add(ParagraphStyle(
            name='Normal-Bold',
            parent=self.styles['Normal'],
            fontName='Helvetica-Bold' if self.font_found else 'Helvetica-Bold',
            fontSize=9,
            wordWrap=True,
            leading=10
        ))

        # COMPACT TableContent style to prevent oversized rows
        self.styles.add(ParagraphStyle(
            name='TableContent',
            parent=self.styles['Normal'],
            fontSize=8,     # Reduced from 8.5 to 8
            leading=9,      # Reduced from 10 to 9 
            fontName='CurrencyFont' if self.font_found else 'Helvetica',
            alignment=TA_JUSTIFY,  # Add justify alignment for description column
            wordWrap=True,
            splitLongWords=True,
            allowWidows=1,  
            allowOrphans=1, 
            spaceAfter=0,   # Removed extra spacing
            spaceBefore=0,  # Removed extra spacing
            leftIndent=0,
            rightIndent=0,
            bulletIndent=0,
            firstLineIndent=0,
            keepWithNext=0
        ))

        # COMPACT Continuation row style 
        self.styles.add(ParagraphStyle(
            name='TableContentContinuation',
            parent=self.styles['TableContent'],
            fontSize=8,
            leading=9,      # Keep same as regular content
            alignment=TA_JUSTIFY,  # Add justify alignment for description continuation rows
            wordWrap=True,
            splitLongWords=True,
            allowWidows=1,
            allowOrphans=1,
            spaceAfter=0,   # No extra spacing
            spaceBefore=0
        ))

        self.styles.add(ParagraphStyle(
            name='TableContentNumeric',
            parent=self.styles['Normal'],
            fontSize=8,     # Reduced from 8.5 to 8
            leading=9,      # Reduced from 10 to 9
            alignment=TA_RIGHT,
            fontName='CurrencyFont' if self.font_found else 'Helvetica'
        ))

        self.styles.add(ParagraphStyle(
            name='TotalValueWords',
            parent=self.styles['Normal'],
            fontName='Helvetica-Bold',
            fontSize=9,
            wordWrap=True,
            leading=10
        ))

        self.styles.add(ParagraphStyle(
            name='TCHeading',
            parent=self.styles['Heading1'],
            alignment=TA_CENTER,
            fontSize=14,
            spaceAfter=10,
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='TCContent',
            parent=self.styles['Normal'],
            fontSize=8,
            leading=9,
            spaceAfter=0,
            alignment=TA_JUSTIFY,
        ))

        self.styles.add(ParagraphStyle(
            name='TCContentBold',
            parent=self.styles['TCContent'],
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='TCContentIndent1',
            parent=self.styles['TCContent'],
            leftIndent=6 * mm,
            firstLineIndent=-6 * mm,
        ))

        self.styles.add(ParagraphStyle(
            name='CTCContentIndent1',
            parent=self.styles['TCContent'],
            leftIndent=6 * mm,
            firstLineIndent=0,
        ))

        self.styles.add(ParagraphStyle(
            name='TCContentIndent1Bold',
            parent=self.styles['TCContentIndent1'],
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='CTCContentIndent1Bold',
            parent=self.styles['CTCContentIndent1'],
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='TCContentIndent2',
            parent=self.styles['TCContent'],
            leftIndent=10 * mm,
            firstLineIndent=-10 * mm,
        ))

        self.styles.add(ParagraphStyle(
            name='CTCContentIndent2',
            parent=self.styles['TCContent'],
            leftIndent=10 * mm,
            firstLineIndent=0,
        ))

        self.styles.add(ParagraphStyle(
            name='TCContentIndent2Bold',
            parent=self.styles['TCContentIndent2'],
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='CTCContentIndent2Bold',
            parent=self.styles['CTCContentIndent2'],
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='TCContentIndent3',
            parent=self.styles['TCContent'],
            leftIndent=14 * mm,
            firstLineIndent=-14 * mm,
        ))

        self.styles.add(ParagraphStyle(
            name='CTCContentIndent3',
            parent=self.styles['TCContent'],
            leftIndent=14 * mm,
            firstLineIndent=0,
        ))

        self.styles.add(ParagraphStyle(
            name='TCContentIndent3Bold',
            parent=self.styles['TCContentIndent3'],
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='CTCContentIndent3Bold',
            parent=self.styles['CTCContentIndent3'],
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='TCBullet',
            parent=self.styles['TCContent'],
            leftIndent=10 * mm,
            firstLineIndent=-4 * mm,
        ))

        self.styles.add(ParagraphStyle(
            name='TCBulletIndent1',
            parent=self.styles['TCBullet'],
            leftIndent=14 * mm,
        ))

        self.styles.add(ParagraphStyle(
            name='TCBulletIndent2',
            parent=self.styles['TCBullet'],
            leftIndent=18 * mm,
        ))

        self.styles.add(ParagraphStyle(
            name='TCBulletIndent3',
            parent=self.styles['TCBullet'],
            leftIndent=22 * mm,
        ))

        self.styles.add(ParagraphStyle(
            name='TCBulletBold',
            parent=self.styles['TCBullet'],
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='TCBulletIndent1Bold',
            parent=self.styles['TCBulletIndent1'],
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='TCBulletIndent2Bold',
            parent=self.styles['TCBulletIndent2'],
            fontName='Helvetica-Bold',
        ))

        self.styles.add(ParagraphStyle(
            name='TCBulletIndent3Bold',
            parent=self.styles['TCBulletIndent3'],
            fontName='Helvetica-Bold',
        ))

        # Title style
        self.styles.add(ParagraphStyle(
            name='POTitleStyle',
            parent=self.styles['CenterBold'],
            fontSize=16,
            leading=20,
            fontName='Helvetica-Bold'
        ))

    def get_currency_symbol(self, currency_code):
        """Get currency symbol for given code"""
        currency_symbols = {
            'AED': 'د.إ', 'CNY': '¥', 'JPY': '¥', 'EUR': '€', 'GBP': '£',
            'USD': '$', 'INR': '₹', 'CAD': 'C$', 'AUD': 'A$', 'SGD': 'S$',
            'HKD': 'HK$', 'KRW': '₩', 'RUB': '₽', 'THB': '฿', 'CHF': 'CHF',
            'TRY': '₺', 'SAR': 'ر.س', 'MYR': 'RM', 'IDR': 'Rp', 'PHP': '₱'
        }
        return currency_symbols.get(currency_code, currency_code)

    def create_page_decorations(self, header_path, footer_path):
        """Create page decoration function with enhanced error handling"""
        def add_page_decorations(canvas, doc):
            canvas.saveState()
            
            page_width, page_height = A4
            
            # Add border
            canvas.setStrokeColorRGB(0, 0, 0)
            canvas.setLineWidth(2)
            canvas.rect(5*mm, 5*mm, page_width-10*mm, page_height-10*mm)

            # Draw header if exists
            if header_path and os.path.exists(header_path):
                try:
                    img = ImageReader(header_path)
                    # Move header a little to the left (from 15*mm to 10*mm)
                    canvas.drawImage(img, 10*mm, page_height - 36*mm, width=185*mm, height=27*mm)
                except Exception as e:
                    logger.warning(f"Could not load header image: {e}")
            
            # Draw footer if exists
            if footer_path and os.path.exists(footer_path):
                try:
                    img = ImageReader(footer_path)
                    # Reduce width from 190mm to 160mm and center it
                    footer_width = 160*mm
                    footer_x = (page_width - footer_width) / 2  # Center horizontally
                    canvas.drawImage(img, footer_x, 15*mm, width=footer_width, height=22*mm)
                except Exception as e:
                    logger.warning(f"Could not load footer image: {e}")
            
            # Page number
            canvas.setFont('Helvetica', 9)
            canvas.drawString(page_width/2, 10*mm, f"Page {doc.page}")

            canvas.restoreState()
        
        return add_page_decorations

    def create_header_table(self, po_data):
        """Create comprehensive header table with all PO details"""
        
        po_details = po_data['po_details']
        supplier_data = po_data['supplier_data']
        invoice_to = po_data['invoice_to']
        terms = po_data['terms']
        delivery_address = po_data['delivery_address']
        formatted_po_date = po_data['formatted_po_date']

        supplier_block = (
            f"{supplier_data.get('name', 'N/A')}<br/>"
            f"{(supplier_data.get('address', '') or '').replace(chr(10), '<br/>')}<br/>"
            f"Email: {supplier_data.get('email', 'N/A')}<br/>"
            f"Contact: {supplier_data.get('contact_person', 'N/A')}<br/>"
            f"Mobile: {supplier_data.get('contact', 'N/A')}<br/>"
            f"GST: {supplier_data.get('gstin', 'N/A')}<br/>"
            f"State Code: {supplier_data.get('stateCode', 'N/A')}"
        )

        billing_block = (
            f"{invoice_to.get('name', 'CIMCON Software India Pvt. Ltd.')}<br/>"
            f"{(invoice_to.get('address', '') or '').replace(chr(10), '<br/>')}<br/>"
            f"GST: {invoice_to.get('gstin', 'N/A')}<br/>"
            f"PAN No: AABCC1410E<br/>State: Gujarat<br/>State Code: 24"
        )

        left_data = [
            [Paragraph("<b>Supplier Details:</b>", self.styles['Normal-Bold'])],
            [Paragraph(supplier_block, self.styles['Normal'])],
            [Paragraph("<b>Billing Address:</b>", self.styles['Normal-Bold'])],
            [Paragraph(billing_block, self.styles['Normal'])],
        ]
        left_table = Table(left_data, colWidths=[85*mm])
        left_table.setStyle(TableStyle([
            ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
            ('BACKGROUND', (0, 0), (0, 0), colors.lightgrey),
            ('BACKGROUND', (0, 2), (0, 2), colors.lightgrey),
        ]))

        right_data = [
            [Paragraph("<b>CIMCON PO Number</b>", self.styles['Normal-Bold']),
             Paragraph(f"{po_details.get('poNumber', 'N/A')}", self.styles['Normal'])],
            [Paragraph("<b>PO Date</b>", self.styles['Normal-Bold']),
             Paragraph(formatted_po_date, self.styles['Normal'])],
            [Paragraph("<b>Quote Ref. Number</b>", self.styles['Normal-Bold']),
             Paragraph(po_details.get('quoteRefNumber', 'N/A'), self.styles['Normal'])],
            [Paragraph("<b>PO Version</b>", self.styles['Normal-Bold']),
             Paragraph(po_details.get('version', '1.0'), self.styles['Normal'])],
            [Paragraph("<b>Project Code</b>", self.styles['Normal-Bold']),
             Paragraph(po_details.get('projectCode', 'N/A'), self.styles['Normal'])],
            [Paragraph("<b>Freight & Insurance</b>", self.styles['Normal-Bold']),
             Paragraph(terms.get('freightAndInsurance', 'N/A'), self.styles['Normal'])],
            [Paragraph("<b>Vendor Code</b>", self.styles['Normal-Bold']),
             Paragraph(supplier_data.get('vendorCode', 'N/A'), self.styles['Normal'])],
            [Paragraph("<b>Payment Terms</b>", self.styles['Normal-Bold']),
             Paragraph(terms.get('payment', 'N/A'), self.styles['Normal'])],
            [Paragraph("<b>Guarantee/Warranty</b>", self.styles['Normal-Bold']),
             Paragraph(terms.get('warranty', 'N/A'), self.styles['Normal'])],
            [Paragraph("<b>Installation</b>", self.styles['Normal-Bold']),
             Paragraph(terms.get('installation', 'Exclusive'), self.styles['Normal'])],
            [Paragraph("<b>Commissioning</b>", self.styles['Normal-Bold']),
             Paragraph(terms.get('commissioning', 'Exclusive'), self.styles['Normal'])],
            [Paragraph("<b>TPI Inspection</b>", self.styles['Normal-Bold']),
             Paragraph(terms.get('tpiInspection', 'N/A'), self.styles['Normal'])],
            [Paragraph("<b>Delivery Schedule</b>", self.styles['Normal-Bold']),
             Paragraph(terms.get('delivery', 'N/A'), self.styles['Normal'])],
            [Paragraph("<b>Delivery Address</b>", self.styles['Normal-Bold']),
             Paragraph(((delivery_address or 'N/A') or '').replace(chr(10), '<br/>'), self.styles['Normal'])],
        ]
        right_table = Table(right_data, colWidths=[45*mm, 60*mm])
        right_table.setStyle(TableStyle([
            ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]))

        left_table.wrap(85*mm, 10000)
        right_table.wrap(105*mm, 10000)
        outer_row_height = max(left_table._height, right_table._height)

        outer_table = Table(
            [[left_table, right_table]],
            colWidths=[85*mm, 105*mm],
            rowHeights=[outer_row_height],
        )
        outer_table.setStyle(TableStyle([
            ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
            ('INNERGRID', (0, 0), (-1, -1), 0.8, colors.black),
            ('VALIGN', (0, 0), (-1, -1), 'TOP'),
            ('LEFTPADDING', (0, 0), (-1, -1), 0),
            ('RIGHTPADDING', (0, 0), (-1, -1), 0),
            ('TOPPADDING', (0, 0), (-1, -1), 0),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
        ]))

        return outer_table

    def calculate_available_space(self, doc, current_page_content_height=0):
        """Calculate available vertical space on current page - OPTIMIZED FOR MAXIMUM UTILIZATION"""
        # Get total available height in the frame - be more aggressive
        total_frame_height = doc.height - (2 * 10)  # Reduced padding from 20 to 10 for maximum space
        
        # Subtract space already used by header, current content, etc.
        used_space = current_page_content_height
        
        # Reserve much less space for footer and margins - AGGRESSIVE SPACE UTILIZATION
        reserved_space = 15  # Reduced from 30 to 15
        
        available_space = total_frame_height - used_space - reserved_space
        
        # Minimum space required for a meaningful row
        min_required_space = 20  # Reduced from 25 to 20
        
        return max(available_space, min_required_space)

    def smart_description_split(self, description, available_height, style):
        """Split description based on available vertical space - OPTIMIZED FOR MORE TEXT"""
        if not description or len(str(description)) < 50:
            return [str(description) if description else "N/A"]
        
        text_str = str(description).strip()
        
        # Calculate how many lines can fit in available height - MORE AGGRESSIVE
        line_height = style.leading or style.fontSize * 1.2
        padding = 4  # Reduced from 6 to 4 - less padding for more text
        max_lines = max(1, int((available_height - padding) / line_height))
        
        # Calculate approximate characters per line (based on 55mm column width)
        avg_char_width = style.fontSize * 0.5  # Reduced from 0.55 to 0.5 for tighter text
        column_width_points = 55 * 2.83  # Convert mm to points
        chars_per_line = int(column_width_points / avg_char_width)
        
        # Total characters that can fit - INCREASE TEXT DENSITY
        max_chars = chars_per_line * max_lines
        
        # If description fits, return as single chunk
        if len(text_str) <= max_chars:
            return [text_str]
        
        # Split intelligently at sentence boundaries
        chunks = []
        sentences = text_str.replace('. ', '.|').split('|')
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
            
            potential_chunk = current_chunk + (" " + sentence if current_chunk else sentence)
            
            if len(potential_chunk) <= max_chars:
                current_chunk = potential_chunk
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                    current_chunk = sentence
                else:
                    # Single sentence too long, split by words
                    words = sentence.split()
                    temp_chunk = ""
                    for word in words:
                        if len(temp_chunk + " " + word) <= max_chars:
                            temp_chunk += " " + word if temp_chunk else word
                        else:
                            if temp_chunk:
                                chunks.append(temp_chunk.strip())
                                temp_chunk = word
                            else:
                                # Force break very long words
                                chunks.append(word[:max_chars])
                                temp_chunk = word[max_chars:]
                    current_chunk = temp_chunk
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks if chunks else ["N/A"]

    def create_single_table(self, items_data, fill_available_space=False, extra_style_commands=None):
        """Create a single table with given data, optionally filling available space"""
        col_widths = [12*mm, 32*mm, 67*mm, 18*mm, 14*mm, 18*mm, 22*mm]
        
        table = LongTable(
            items_data,
            colWidths=col_widths,
            repeatRows=1,
            splitByRow=True,
            spaceAfter=0,
            spaceBefore=0
        )
        table.hAlign = 'CENTER'
        
        # Clean, professional grid (avoid overlapping lines that look "dirty")
        style_commands = [
            ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
            ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.black),
            ('BACKGROUND', (0, 0), (-1, 0), colors.lightgrey),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
            ('VALIGN', (2, 1), (2, -1), 'TOP'),
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),
            ('ALIGN', (1, 0), (2, -1), 'LEFT'),
            ('ALIGN', (3, 0), (3, -1), 'CENTER'),
            ('ALIGN', (4, 0), (4, -1), 'CENTER'),
            ('ALIGN', (5, 0), (-1, -1), 'RIGHT'),
            ('ALIGN', (0, 0), (-1, 0), 'CENTER'),
            ('LEFTPADDING', (0, 0), (-1, -1), 3),
            ('RIGHTPADDING', (0, 0), (-1, -1), 3),
            ('TOPPADDING', (0, 0), (-1, -1), 2),
            ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
        ]

        if extra_style_commands:
            style_commands.extend(extra_style_commands)
        
        table.setStyle(TableStyle(style_commands))
        
        return table

    def create_items_table_dynamic(self, items, currency, totals, total_in_words, doc):
        """Create items table with DYNAMIC page-aware description handling - MAXIMUM SPACE UTILIZATION"""
        # Calculate initial available space more aggressively for the first page
        # Reduce the header space assumption for better utilization
        initial_available_space = self.calculate_available_space(doc, 120)  # Reduced from 150 to 120
        
        all_table_elements = []
        current_items_data = []
        
        # Add header row
        header_row = [
            Paragraph("<b>S/N</b>", self.styles['TableContent']),
            Paragraph("<b>CIMCON P/N</b>", self.styles['TableContent']),
            Paragraph("<b>Description</b>", self.styles['TableContent']),
            Paragraph("<b>HSN/SAC</b>", self.styles['TableContent']),
            Paragraph("<b>Qty.</b>", self.styles['TableContent']),
            Paragraph("<b>Unit Rate</b>", self.styles['TableContent']),
            Paragraph("<b>Total Amount</b>", self.styles['TableContent'])
        ]
        current_items_data.append(header_row)
        
        # Reduce initial used space even more - AGGRESSIVE SPACE UTILIZATION
        current_page_used_space = 15  # Reduced from 25 to 15
        
        # Process each item with dynamic space calculation
        for i, item in enumerate(items):
            try:
                # Extract item data
                cpn = item.get('item_no') or item.get('cimcon_part_no') or item.get('cimcon_part_number') or 'N/A'
                description = item.get('material_description') or item.get('description') or 'N/A'
                quantity = float(item.get('quantity', 0))
                uom = item.get('unit') or item.get('uom') or 'Nos'
                quantity_combined = f"{quantity} {uom}"
                unit_rate = float(item.get('unit_price', 0))
                total_amount = float(item.get('total_price', 0))
                hsn_code = item.get('hsn_code') or item.get('hsnSac') or item.get('hsn_sac') or 'N/A'
                
                # Calculate remaining space on current page
                remaining_space = initial_available_space - current_page_used_space
                
                # For the first item, be even more aggressive in using available space
                if i == 0:
                    # Give first item much more generous space calculation
                    remaining_space = max(remaining_space, 300)  # Increased from 200 to 300 for first item
                
                # Split description based on available space
                description_chunks = self.smart_description_split(
                    description, remaining_space, self.styles['TableContent']
                )
                
                # First chunk goes on current page
                if description_chunks:
                    first_chunk = description_chunks[0]
                    
                    # Estimate space needed for this row
                    estimated_row_height = self.estimate_row_height(first_chunk, self.styles['TableContent'])
                    
                    # For first item, be much more lenient about fitting on first page
                    space_threshold = remaining_space if i == 0 else remaining_space * 0.95  # Increased from 0.9 to 0.95
                    
                    # If row won't fit on current page, create new table (but be more lenient for first item)
                    if estimated_row_height > space_threshold and len(current_items_data) > 1:
                        # Create table with current data - FILL AVAILABLE SPACE
                        table = self.create_single_table(current_items_data, fill_available_space=True)
                        all_table_elements.append(table)
                        all_table_elements.append(PageBreak())
                        
                        # Start new table on next page
                        current_items_data = [header_row]  # Reset with header
                        current_page_used_space = 15  # Consistent reduced space
                        remaining_space = initial_available_space - 15
                        
                        # **FIX: Re-split the ENTIRE description for the new page with full space**
                        description_chunks = self.smart_description_split(  
                            description, remaining_space, self.styles['TableContent']
                        )
                        first_chunk = description_chunks[0]
                        estimated_row_height = self.estimate_row_height(first_chunk, self.styles['TableContent'])
                    
                    # Add the main row
                    current_items_data.append([
                        str(i+1),
                        Paragraph(str(cpn), self.styles['TableContent']),
                        Paragraph(first_chunk, self.styles['TableContent']),
                        Paragraph(str(hsn_code), self.styles['TableContent']),
                        Paragraph(f"{quantity:g}", self.styles['TableContentNumeric']),
                        Paragraph(f"{currency['symbol']} {unit_rate:.2f}", self.styles['TableContentNumeric']),
                        Paragraph(f"{currency['symbol']} {total_amount:.2f}", self.styles['TableContentNumeric'])
                    ])
                    
                    current_page_used_space += estimated_row_height
                    
                    # **FIX: Handle remaining chunks by reconstructing remaining text**
                    if len(description_chunks) > 1:
                        # Reconstruct remaining text from chunks 1 onwards
                        remaining_text = " ".join(description_chunks[1:])
                        
                        # Process remaining text in a loop, re-calculating chunks for each new page
                        while remaining_text.strip():
                            current_remaining_space = initial_available_space - current_page_used_space
                            
                            # Re-split remaining text based on current available space
                            remaining_chunks = self.smart_description_split(
                                remaining_text, current_remaining_space, self.styles['TableContent']
                            )
                            
                            if not remaining_chunks:
                                break
                                
                            # Take the first chunk that fits on current page
                            next_chunk = remaining_chunks[0]
                            chunk_height = self.estimate_row_height(next_chunk, self.styles['TableContent'])
                            
                            # If chunk won't fit, create new page - be more aggressive
                            if chunk_height > current_remaining_space * 0.98:  # Use 98% of space instead of 100%
                                # Create table with current data
                                table = self.create_single_table(current_items_data, fill_available_space=True)
                                all_table_elements.append(table)
                                all_table_elements.append(PageBreak())
                                
                                # Start new table
                                current_items_data = [header_row]
                                current_page_used_space = 15  # Consistent reduced space
                                current_remaining_space = initial_available_space - 15
                                
                                # Re-split with full page space
                                remaining_chunks = self.smart_description_split(
                                    remaining_text, current_remaining_space, self.styles['TableContent']
                                )
                                next_chunk = remaining_chunks[0]
                                chunk_height = self.estimate_row_height(next_chunk, self.styles['TableContent'])
                            
                            # Add continuation row
                            current_items_data.append([
                                "", "", 
                                Paragraph(next_chunk, self.styles['TableContent']),
                                "", "", "", ""
                            ])
                            current_page_used_space += chunk_height
                            
                            # Update remaining text by removing the processed chunk
                            if len(remaining_chunks) > 1:
                                remaining_text = " ".join(remaining_chunks[1:])
                            else:
                                remaining_text = ""
            
            except Exception as e:
                logger.error(f"Error processing item {i}: {e}")
                error_height = 25  # Reduced from 30 to 25
                
                if error_height > (initial_available_space - current_page_used_space):
                    table = self.create_single_table(current_items_data, fill_available_space=True)
                    all_table_elements.append(table)
                    all_table_elements.append(PageBreak())
                    current_items_data = [header_row]
                    current_page_used_space = 15
                
                current_items_data.append([
                    str(i+1), 
                    Paragraph("Error", self.styles['TableContent']), 
                    Paragraph("Error loading item", self.styles['TableContent']), 
                    Paragraph("N/A", self.styles['TableContent']), 
                    Paragraph("0", self.styles['TableContentNumeric']), 
                    Paragraph("0.00", self.styles['TableContentNumeric']), 
                    Paragraph("0.00", self.styles['TableContentNumeric'])
                ])
                current_page_used_space += error_height
        
        # Add totals section - REDUCED SPACE REQUIREMENT
        total_section_height = 120  # Reduced from 150 to 120
        
        if total_section_height > (initial_available_space - current_page_used_space):
            table = self.create_single_table(current_items_data, fill_available_space=True)
            all_table_elements.append(table)
            all_table_elements.append(PageBreak())
            current_items_data = [header_row]
        
        currency_code = (currency or {}).get('code') or ''

        totals_start_index = len(current_items_data)

        # Totals block (right side) to match sample
        current_items_data.extend([
            ["", "", "", "",
             Paragraph("<b>Taxable Value</b>", self.styles['TableContent']),
             Paragraph(f"<b>{currency_code}</b>", self.styles['TableContent']),
             Paragraph(f"<b>{totals.get('taxableValue', 0):.2f}</b>", self.styles['TableContentNumeric'])],
            ["", "", "", "",
             Paragraph("<b>GST</b>", self.styles['TableContent']),
             Paragraph(f"<b>{currency_code}</b>", self.styles['TableContent']),
             Paragraph(f"<b>{totals.get('gst', 0):.2f}</b>", self.styles['TableContentNumeric'])],
            ["", "", "", "",
             Paragraph("<b>Round Off</b>", self.styles['TableContent']),
             Paragraph(f"<b>{currency_code}</b>", self.styles['TableContent']),
             Paragraph(f"<b>{totals.get('roundOff', 0):.2f}</b>", self.styles['TableContentNumeric'])],
            ["", "", "", "",
             Paragraph("<b>Total</b>", self.styles['TableContent']),
             Paragraph(f"<b>{currency_code}</b>", self.styles['TableContent']),
             Paragraph(f"<b>{totals.get('totalAmount', 0):.2f}</b>", self.styles['TableContentNumeric'])],
        ])

        words_row_index = len(current_items_data)
        total_words_text = total_in_words or "Amount in words not available"
        current_items_data.append([
            Paragraph("<b>Total Value in words</b>", self.styles['TableContent']),
            "",
            Paragraph(str(total_words_text), self.styles['TableContent']),
            "", "", "", ""
        ])

        extra_style = []
        # Span left area empty for each totals row (cols 0-4)
        for r in range(totals_start_index, totals_start_index + 4):
            extra_style.append(('SPAN', (0, r), (3, r)))
            extra_style.append(('ALIGN', (4, r), (4, r), 'RIGHT'))
            extra_style.append(('ALIGN', (5, r), (5, r), 'CENTER'))
            extra_style.append(('VALIGN', (4, r), (6, r), 'MIDDLE'))

        # Total Value in words row spans
        extra_style.append(('SPAN', (0, words_row_index), (1, words_row_index)))
        extra_style.append(('SPAN', (2, words_row_index), (6, words_row_index)))
        extra_style.append(('BACKGROUND', (0, words_row_index), (1, words_row_index), colors.lightgrey))
        extra_style.append(('VALIGN', (0, words_row_index), (6, words_row_index), 'MIDDLE'))
        extra_style.append(('ALIGN', (0, words_row_index), (1, words_row_index), 'LEFT'))
        extra_style.append(('ALIGN', (2, words_row_index), (6, words_row_index), 'LEFT'))

        # Create final table - ALWAYS FILL SPACE FOR THE LAST TABLE ON PAGE
        final_table = self.create_single_table(
            current_items_data,
            fill_available_space=False,
            extra_style_commands=extra_style,
        )
        all_table_elements.append(final_table)

        notes_text = (
            "<font color=\"#0000FF\">"
            "<b><i>Notes:</i></b><br/>"
            "<b><i>The supplier invoice should clearly mention the CIMCON PO Number, PO Date, and Reference Number as quoted in the PO. "
            "Otherwise, the material will be rejected, and the invoice shall not be processed for accounting.</i></b>"
            "</font>"
        )

        signature_path = os.path.join(self.current_dir, 'assets', 'signature.png')
        signature_cell = ""
        if os.path.exists(signature_path):
            signature_cell = Image(signature_path, width=50 * mm, height=18 * mm)
            signature_cell.hAlign = 'RIGHT'

        footer_table = Table(
            [
                [
                    Paragraph(notes_text, self.styles['TableContent']),
                    signature_cell,
                ],
            ],
            colWidths=[120 * mm, 63 * mm],
        )
        footer_table.setStyle(
            TableStyle(
                [
                    ('BOX', (0, 0), (-1, -1), 0.8, colors.black),
                    ('INNERGRID', (0, 0), (-1, -1), 0.4, colors.black),
                    ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                    ('ALIGN', (1, 0), (1, -1), 'RIGHT'),
                    ('LEFTPADDING', (0, 0), (-1, -1), 3),
                    ('RIGHTPADDING', (0, 0), (-1, -1), 3),
                    ('TOPPADDING', (0, 0), (-1, -1), 2),
                    ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                ]
            )
        )

        all_table_elements.append(Spacer(1, 1 * mm))
        all_table_elements.append(footer_table)
        
        return all_table_elements

    def estimate_row_height(self, text, style):
        """Estimate the height needed for a row with given text - OPTIMIZED FOR TIGHTER SPACING"""
        if not text:
            return 18  # Reduced minimum row height from 20 to 18
        
        # Calculate number of lines needed
        avg_char_width = style.fontSize * 0.5  # Reduced from 0.55 to 0.5 for tighter text
        column_width_points = 55 * 2.83  # 55mm in points
        chars_per_line = int(column_width_points / avg_char_width)
        
        text_length = len(str(text))
        lines_needed = max(1, text_length // chars_per_line + 1)
        
        # Calculate total height with tighter spacing
        line_height = style.leading or (style.fontSize * 1.1)  # Reduced from 1.2 to 1.1
        padding = 4  # Reduced from 6 to 4
        
        return (lines_needed * line_height) + padding

    def create_items_table(self, items, currency, totals, total_in_words, doc=None):
        """Create items table with dynamic page handling"""
        if doc:
            return self.create_items_table_dynamic(items, currency, totals, total_in_words, doc)
        else:
            # Fallback to simple version if no doc provided
            return self.create_single_table(
                [
                    [
                        Paragraph("<b>Error</b>", self.styles['TableContent']),
                        Paragraph("<b>No document context</b>", self.styles['TableContent']),
                        "",
                        "",
                        "",
                        "",
                        "",
                        "",
                    ]
                ]
            )

    def add_terms_and_conditions(self, elements, terms_and_conditions, po_type=None):
        """Add comprehensive terms and conditions to the PDF"""
        elements.append(PageBreak())
        elements.append(Paragraph("COMMERCIAL TERMS AND CONDITIONS", self.styles['TCHeading']))
        elements.append(Spacer(1, 10 * mm))

        tc_content = (terms_and_conditions or "").strip() or None

        # Always ensure GTCA exists; frontend sometimes sends only commercial terms.
        def load_tc_file_content():
            tc_filename = "t&c_overseas.txt" if po_type == 'overseas' else "t&c.txt"
            tc_path = os.path.join(self.current_dir, tc_filename)
            if os.path.exists(tc_path):
                try:
                    with open(tc_path, 'r', encoding='utf-8') as tc_file:
                        logger.info(f"Loaded terms and conditions from file: {tc_path}")
                        return tc_file.read()
                except Exception as e:
                    logger.error(f"Error reading terms and conditions file: {e}")

            if po_type == 'overseas':
                fallback_path = os.path.join(self.current_dir, "t&c.txt")
                if os.path.exists(fallback_path):
                    try:
                        with open(fallback_path, 'r', encoding='utf-8') as tc_file:
                            logger.warning(
                                f"Overseas terms not found at {tc_path}; loaded domestic terms instead"
                            )
                        return tc_file.read()
                    except Exception as e:
                        logger.error(f"Error reading terms and conditions file: {e}")
            return None

        def extract_gtca(text: str):
            if not text:
                return None
            lines = text.splitlines()
            for i, raw in enumerate(lines):
                if " ".join((raw or "").strip().split()).lower() == "general terms and conditions agreement":
                    return "\n".join(lines[i:]).strip()
            return None

        file_tc = None
        if not tc_content:
            file_tc = load_tc_file_content()
            tc_content = file_tc
        else:
            normalized_all = " ".join(tc_content.split()).lower()
            if "general terms and conditions agreement" not in normalized_all:
                file_tc = load_tc_file_content()
                file_gtca = extract_gtca(file_tc or "")
                if file_gtca:
                    tc_content = f"{tc_content}\n\n{file_gtca}"

        if tc_content:
            def flush_commercial_paragraph(paragraph_lines, spacer_after_mm=1.5, style_name='TCContent'):
                if not paragraph_lines:
                    return
                text = " ".join(x.strip() for x in paragraph_lines if x and x.strip())
                if text:
                    elements.append(Paragraph(text, self.styles[style_name]))
                    if spacer_after_mm and spacer_after_mm > 0:
                        elements.append(Spacer(1, spacer_after_mm * mm))

            def pick_tc_style(line_text: str, *, bold: bool = False) -> str:
                base = 'TCContentBold' if bold else 'TCContent'
                if not line_text:
                    return base
                if line_text.startswith('•') or line_text.startswith('-') or line_text.startswith('–') or line_text.startswith('o '):
                    return 'TCBulletBold' if bold else 'TCBullet'

                # Hierarchy indentation:
                # 1
                #   1.1
                #     1.1.1
                m = re.match(r'^(\d+(?:\.\d+)*)(?:\.|\)|\s|$)', line_text)
                if m:
                    numbering = m.group(1)
                    depth = numbering.count('.') + 1
                    if depth <= 1:
                        return base
                    if depth == 2:
                        return 'CTCContentIndent1Bold' if bold else 'CTCContentIndent1'
                    if depth == 3:
                        return 'CTCContentIndent2' if not bold else 'CTCContentIndent2Bold'
                    return 'CTCContentIndent3' if not bold else 'CTCContentIndent3Bold'

                return base

            def is_section_heading(text: str) -> bool:
                if not text:
                    return False
                # e.g. "1. DEFINITIONS AND INTERPRETATION" or "1 DEFINITIONS AND INTERPRETATION"
                if re.match(r"^\d+(?:\.\d+)*(?:\.|\s)\s*[A-Z][A-Z\s&/\-()]+$", text):
                    return True
                return False

            lines = tc_content.split('\n')
            in_gtca = False
            current_para = []
            current_para_style = 'TCContent'
            current_number_depth = 0
            gtca_last_was_heading = False

            for raw_line in lines:
                line = (raw_line or "")
                line = line.replace("\t", " ")
                line = re.sub(r"\s+", " ", line).strip()
                normalized_line = " ".join(line.split()).lower()

                # Detect GTCA start (exact heading)
                if (not in_gtca) and normalized_line == "general terms and conditions agreement":
                    flush_commercial_paragraph(current_para, spacer_after_mm=1.5, style_name=current_para_style)
                    current_para = []
                    current_para_style = 'TCContent'

                    in_gtca = True
                    elements.append(NextPageTemplate('GTCAFirstTemplate'))
                    elements.append(PageBreak())

                    title_table = Table(
                        [[Paragraph("<b>General Terms and Conditions Agreement</b>", self.styles['CenterBold'])]],
                        colWidths=[170 * mm],
                    )
                    title_table.setStyle(
                        TableStyle(
                            [
                                ('BACKGROUND', (0, 0), (-1, -1), colors.HexColor('#D9D9D9')),
                                ('BOX', (0, 0), (-1, -1), 0.5, colors.black),
                                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                                ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
                                ('LEFTPADDING', (0, 0), (-1, -1), 4),
                                ('RIGHTPADDING', (0, 0), (-1, -1), 4),
                                ('TOPPADDING', (0, 0), (-1, -1), 2),
                                ('BOTTOMPADDING', (0, 0), (-1, -1), 2),
                            ]
                        )
                    )
                    elements.append(title_table)
                    elements.append(Spacer(1, 4 * mm))
                    elements.append(FrameBreak())

                    # After the first GTCA page, continue with 2-column template without title frame
                    elements.append(NextPageTemplate('GTCATemplate'))
                    continue

                if in_gtca:
                    # GTCA content should be dense (two-column)
                    if not line:
                        elements.append(Spacer(1, 1.5 * mm))
                        gtca_last_was_heading = False
                        continue

                    is_heading = is_section_heading(line)
                    style_name = 'TCContentBold' if is_heading else 'TCContent'
                    elements.append(Paragraph(line, self.styles[style_name]))
                    if is_heading or gtca_last_was_heading:
                        elements.append(Spacer(1, 1.5 * mm))
                    gtca_last_was_heading = is_heading
                    continue

                # Commercial terms formatting
                if not line:
                    flush_commercial_paragraph(current_para, spacer_after_mm=1.5, style_name=current_para_style)
                    current_para = []
                    current_para_style = 'TCContent'
                    current_number_depth = 0
                    continue

                is_main_heading = line.lower() == "commercial terms and conditions"
                is_numbered_title = bool(re.match(r"^\d+(?:\.\d+)*(?:\.|\)|\s)", line))
                is_bullet = line.startswith("•")

                if is_main_heading:
                    flush_commercial_paragraph(current_para, spacer_after_mm=1.5, style_name=current_para_style)
                    current_para = []
                    current_para_style = 'TCContent'
                    current_number_depth = 0
                    flush_commercial_paragraph([line], spacer_after_mm=1.5)
                    continue

                if is_numbered_title:
                    flush_commercial_paragraph(current_para, spacer_after_mm=1, style_name=current_para_style)
                    current_para = [line]
                    is_heading = is_section_heading(line)
                    current_para_style = pick_tc_style(line, bold=is_heading)
                    m_depth = re.match(r'^(\d+(?:\.\d+)*)', line)
                    if m_depth:
                        current_number_depth = m_depth.group(1).count('.') + 1
                    continue

                if is_bullet:
                    flush_commercial_paragraph(current_para, spacer_after_mm=1, style_name=current_para_style)
                    current_para = [line]
                    bullet_depth = max(0, min(3, current_number_depth - 1))
                    if bullet_depth <= 0:
                        current_para_style = 'TCBullet'
                    elif bullet_depth == 1:
                        current_para_style = 'TCBulletIndent1'
                    elif bullet_depth == 2:
                        current_para_style = 'TCBulletIndent2'
                    else:
                        current_para_style = 'TCBulletIndent3'
                    continue

                # Merge wrapped lines into a single paragraph
                current_para.append(line)

            flush_commercial_paragraph(current_para, spacer_after_mm=1.5, style_name=current_para_style)

        else:
            # Default terms if nothing found
            default_terms = [
                "1. All terms and conditions as per standard purchase order terms apply.",
                "2. Payment terms: As specified in purchase order.",
                "3. Delivery: As per schedule mentioned in purchase order.",
                "4. Quality: All materials must meet specified quality standards.",
                "5. Warranty: As per standard warranty terms.",
            ]
            for term in default_terms:
                elements.append(Paragraph(term, self.styles['TCContent']))
                elements.append(Spacer(1, 3 * mm))

    def generate_pdf(self, po_data, output_path=None):
        """Generate comprehensive PDF with dynamic page handling"""
        try:
            self.setup_styles()

            # Create buffer
            buffer = BytesIO()

            # PDF document setup
            doc = BaseDocTemplate(
                buffer,
                pagesize=A4,
                rightMargin=15*mm,
                leftMargin=15*mm,
                topMargin=15*mm,
                bottomMargin=15*mm
            )

            # Get asset paths
            header_path = os.path.join(self.current_dir, "assets", "header.png")
            footer_path = None

            # Calculate padding for proper spacing
            line_height = 14
            padding_lines = 5
            padding_pts = line_height * padding_lines

            # Create content frame with proper margins
            content_frame = Frame(
                doc.leftMargin,
                doc.bottomMargin + padding_pts,
                doc.width,
                doc.height - (2 * padding_pts),
                id='normal',
                showBoundary=0,
                leftPadding=5*mm,
                bottomPadding=5*mm,
                rightPadding=5*mm,
                topPadding=5*mm
            )

            # Two-column frame for GTCA section
            gtca_title_height = 18 * mm
            gtca_gutter = 8 * mm
            gtca_col_width = (doc.width - gtca_gutter) / 2
            gtca_cols_height = (doc.height - (2 * padding_pts)) - gtca_title_height

            gtca_title_frame = Frame(
                doc.leftMargin,
                doc.bottomMargin + padding_pts + gtca_cols_height,
                doc.width,
                gtca_title_height,
                id='gtca_title',
                showBoundary=0,
                leftPadding=5*mm,
                bottomPadding=0,
                rightPadding=5*mm,
                topPadding=0,
            )

            gtca_col1 = Frame(
                doc.leftMargin,
                doc.bottomMargin + padding_pts,
                gtca_col_width,
                gtca_cols_height,
                id='gtca_col1',
                showBoundary=0,
                leftPadding=5*mm,
                bottomPadding=5*mm,
                rightPadding=5*mm,
                topPadding=0,
            )

            gtca_col2 = Frame(
                doc.leftMargin + gtca_col_width + gtca_gutter,
                doc.bottomMargin + padding_pts,
                gtca_col_width,
                gtca_cols_height,
                id='gtca_col2',
                showBoundary=0,
                leftPadding=5*mm,
                bottomPadding=5*mm,
                rightPadding=5*mm,
                topPadding=0,
            )

            # Create page templates
            main_template = PageTemplate(
                id='MainTemplate',
                frames=[content_frame],
                onPage=self.create_page_decorations(header_path, footer_path)
            )

            gtca_first_template = PageTemplate(
                id='GTCAFirstTemplate',
                frames=[gtca_title_frame, gtca_col1, gtca_col2],
                onPage=self.create_page_decorations(header_path, footer_path)
            )

            gtca_template = PageTemplate(
                id='GTCATemplate',
                frames=[gtca_col1, gtca_col2],
                onPage=self.create_page_decorations(header_path, footer_path)
            )

            doc.addPageTemplates([main_template, gtca_first_template, gtca_template])

            # Create document elements
            elements = []
            
            # Title
            elements.append(Paragraph("<b>PURCHASE ORDER</b>", self.styles['POTitleStyle']))
            elements.append(Spacer(1, 5*mm))
            
            # Header table with all details
            header_table = self.create_header_table(po_data)
            elements.append(header_table)
            elements.append(Spacer(1, 5*mm))
            
            # Items table with DYNAMIC page handling - pass doc context
            items_table_elements = self.create_items_table(
                po_data.get('items', []), 
                po_data.get('currency', {'symbol': '₹', 'code': 'INR'}), 
                po_data.get('totals', {}), 
                po_data.get('total_in_words', ''),
                doc  # Pass document context for dynamic calculations
            )
            
            # Add all table elements (might be multiple tables with page breaks)
            if isinstance(items_table_elements, list):
                elements.extend(items_table_elements)
            else:
                elements.append(items_table_elements)
            
            # Terms and conditions
            self.add_terms_and_conditions(
                elements,
                po_data.get('terms_and_conditions', ''),
                po_type=po_data.get('po_type')
            )

            # Build document
            doc.build(elements)
            buffer.seek(0)
            
            # Save to file if path provided
            if output_path:
                try:
                    os.makedirs(os.path.dirname(output_path), exist_ok=True)
                    with open(output_path, 'wb') as f:
                        f.write(buffer.getvalue())
                    logger.info(f"PDF saved successfully to: {output_path}")
                except Exception as e:
                    logger.error(f"Error saving PDF to file: {e}")
                    
            return buffer
            
        except Exception as e:
            logger.error(f"Error generating PDF: {str(e)}", exc_info=True)
            raise