import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Snackbar,
  Alert,
  CircularProgress,
  Grid,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Select,
  MenuItem,
  InputAdornment,
  FormControl,
  InputLabel,
  Autocomplete,
} from "@mui/material";
import {
  Edit as EditIcon,
  Warning as WarningIcon,
  Person as PersonIcon,
  DateRange as DateIcon,
  ExpandMore as ExpandMoreIcon,
  Download as DownloadIcon,
  Add as AddIcon,
} from "@mui/icons-material";
import axios from "axios";
import "./po_edit.scss";
import configuration from "../../../configuration";
import { format } from "date-fns";
import { ToWords } from "to-words";

interface POLineItem {
  id: number;
  item_no: string;
  material_description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  make: string;
  material_group: string;
  unit: string;
  hsn_code?: string;
  gst_percentage?: number;
}
interface Currency {
  code: string;
  symbol: string;
}
interface PurchaseOrder {
  po_number: string;
  vendor_name: string;
  po_date: string;
  total_amount: number;
  project_code: string;
  status: string;
  rejection_remarks: string;
  rejected_by: string;
  rejection_date: string;
  line_items: POLineItem[];
  vendor_address: string;
  vendor_email: string;
  vendor_contact: string;
  vendor_payment_terms: string;
  quote_ref_number: string;
  payment_terms: string;
  warranty_terms: string;
  delivery_schedule: string;
  dispatch_terms: string;
  commissioning_terms: string;
  tpi_terms: string;
  installation_terms: string;
  consignee_name: string;
  consignee_address: string;
  consignee_mobile: string;
  consignee_attention: string;
  invoice_name: string;
  invoice_address: string;
  invoice_gstin: string;
  version?: string | number;
  approval_status?: boolean;
}

const POEdit: React.FC = () => {
  const [rejectedPOs, setRejectedPOs] = useState<PurchaseOrder[]>([]);
  const [approvedPOs, setApprovedPOs] = useState<PurchaseOrder[]>([]);
  const [activeTab, setActiveTab] = useState<'rejected' | 'approved'>('rejected');
  const [loading, setLoading] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [snackbarState, setSnackbarState] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error" | "warning",
  });
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [addItemsDialogOpen, setAddItemsDialogOpen] = useState(false);
  const [selectedNewItems, setSelectedNewItems] = useState<number[]>([]);

  useEffect(() => {
    fetchRejectedPOs();
    fetchApprovedPOs();
    fetchVendors();
  }, []);

  const fetchRejectedPOs = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${configuration.api_url}/rejected-pos/`
      );
      setRejectedPOs(response.data);
    } catch (error) {
      showSnackbar("Failed to fetch rejected purchase orders", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchVendors = async () => {
    try {
      const response = await axios.get(`${configuration.api_url}/vendors/`);
      setVendors(response.data);
    } catch (error) {
      console.error("Error fetching vendors:", error);
    }
  };

  const fetchApprovedPOs = async () => {
    try {
      const response = await axios.get(`${configuration.api_url}/project-codes-with-po-details/`);
      setApprovedPOs(response.data || []);
    } catch (error) {
      console.error('Failed to fetch approved POs', error);
    }
  };

  const fetchAvailableItemsForProject = async (projectCode: string) => {
    if (!projectCode) return;
    
    try {
      setLoading(true);
      // Fetch all approved master items for this project
      const response = await axios.get(
        `${configuration.api_url}/master/?approved_status=true`
      );
      
      const allMasterItems = response.data;
      console.log('All Master Items:', allMasterItems); // DEBUG: See all items
      
      // Filter items that:
      // 1. Match the project code
      // 2. Don't have a po_number (not in any PO yet)
      // 3. Are not already in the current PO being edited
      const currentItemNos = selectedPO?.line_items.map(item => item.item_no) || [];
      
      const available = allMasterItems.filter((item: any) => 
        item.project_code === projectCode &&
        (!item.po_number || item.po_number === '') &&
        !currentItemNos.includes(item.cimcon_part_number)  // ✅ Changed from cimcon_part_no
      );
      
      console.log('Filtered Available Items:', available); // DEBUG: See filtered items
      console.log('Current PO Items:', currentItemNos); // DEBUG: See what's already in PO
      
      setAvailableItems(available);
      setAddItemsDialogOpen(true);
    } catch (error) {
      console.error('Error fetching available items:', error);
      showSnackbar('Failed to fetch available items', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPO = (po: PurchaseOrder) => {
    setSelectedPO(po);
    setOpenDialog(true);

    // Find the matching vendor if any
    if (vendors.length > 0) {
      const matchedVendor = vendors.find(
        (v) => v.vendor_name === po.vendor_name
      );
      if (matchedVendor) {
        setSelectedVendor(matchedVendor);
      }
    }
  };

  const handleAddSelectedItems = () => {
    if (!selectedPO || selectedNewItems.length === 0) return;
    
    // Get the selected master items
    const itemsToAdd = availableItems.filter((item: any) => 
      selectedNewItems.includes(item.id)
    );
    
    // Convert master items to PO line items format
    const newLineItems = itemsToAdd.map((item: any) => ({
      id: Date.now() + Math.random(), // Temporary ID for new items
      item_no: item.cimcon_part_number,  // ✅ Changed from cimcon_part_no
      material_description: item.material_description,
      quantity: item.required_quantity || item.ordering_qty || 1,  // ✅ Changed from quantity
      unit_price: 0, // User will need to fill this
      total_price: 0,
      make: item.make || '',
      material_group: item.material_group || '',
      unit: item.unit || 'Nos',  // ✅ This is correct
      hsn_code: item.hsn_code || '',
      gst_percentage: 18,
      requisition_id: item.id, // Store the master ID
    }));
    
    // Add to existing line items
    setSelectedPO((prev) => ({
      ...prev!,
      line_items: [...prev!.line_items, ...newLineItems],
    }));
    
    setAddItemsDialogOpen(false);
    setSelectedNewItems([]);
    showSnackbar(`Added ${newLineItems.length} item(s) to PO`, 'success');
  };

  const downloadPODocument = async (poNumber: string, vendorName: string) => {
    try {
      const response = await axios.get(
        `${configuration.api_url}/download-po/${poNumber}/`,
        {
          responseType: "blob", // Important for file downloads
        }
      );

      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;

      // Create filename
      const vendorNameSafe = vendorName.replace(/[^a-zA-Z0-9]/g, "_");
      const filename = `Purchase_Order_${poNumber}_${vendorNameSafe}.pdf`;
      link.setAttribute("download", filename);

      // Append to html link element page
      document.body.appendChild(link);

      // Start download
      link.click();

      // Clean up and remove the link
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);

      showSnackbar("PO document downloaded successfully", "success");
    } catch (error: any) {
      console.error("Download error:", error);
      showSnackbar("Failed to download PO document", "error");
    }
  };

  const handleUpdatePO = async () => {
    if (!selectedPO) return;

    try {
      setLoading(true);

      // Check if this is an approved PO being revised - MUST BE BEFORE ANY DATA PREPARATION
      const isApproved = selectedPO.status === 'approved' || selectedPO.approval_status;
      if (isApproved) {
        const currentVersion = Number(selectedPO.version || 1);
        const nextVersion = (currentVersion + 1).toFixed(1);
        const confirmed = window.confirm(
          `⚠️ REVISION CONFIRMATION\n\n` +
          `This PO is currently APPROVED. Saving will:\n` +
          `• Create a new revision (v${currentVersion.toFixed(1)} → v${nextVersion})\n` +
          `• Reset approval status to PENDING\n` +
          `• Require re-approval from admin\n\n` +
          `Do you want to proceed with this revision?`
        );
        if (!confirmed) {
          setLoading(false);
          return;
        }
      }

      // Calculate totals
      const totals = calculateTotals();

      // Convert line items to the format expected by backend
      const itemsForBackend = selectedPO.line_items.map((item, index) => {
        const basePrice = item.quantity * item.unit_price;
        const gstPercentage = item.gst_percentage || 18;
        const gstAmount = (basePrice * gstPercentage) / 100;

        return {
          // Frontend display fields
          srNo: index + 1,
          cpn: item.item_no,
          description: item.material_description,
          hsnSac: item.hsn_code || "",
          quantity: item.quantity,
          uom: item.unit || "Nos",
          unitRate: item.unit_price,
          taxableValue: basePrice,
          gstPercentage: gstPercentage,
          gst: gstAmount,
          totalAmount: basePrice + gstAmount,

          // Backend expected fields
          item_no: item.item_no,
          material_description: item.material_description,
          unit: item.unit || "Nos",
          unit_price: item.unit_price,
          total_price: basePrice + gstAmount,
          make: item.make || "",
          material_group: item.material_group || "",
          hsn_code: item.hsn_code || "",
          hsn_sac: item.hsn_code || "",
          gst_value: gstAmount,
          gst_percentage: gstPercentage,
          taxable_value: basePrice,
          id: item.id,
        };
      });

      //  FIXED: Match the exact structure the backend expects
      const updateData = {
        // Backend expects 'po_details' object with these exact field names
        po_details: {
          vendor_name: selectedPO.vendor_name,
          vendor_address: selectedPO.vendor_address,
          vendor_email: selectedPO.vendor_email,
          vendor_contact: selectedPO.vendor_contact,
          vendor_payment_terms: selectedPO.vendor_payment_terms,
          vendor_gstin: selectedPO.vendor_gstin || "",
          vendor_pan: selectedPO.vendor_pan || "",
          vendor_state: selectedPO.vendor_state || "",
          vendor_state_code: selectedPO.vendor_state_code || "",

          project_code: selectedPO.project_code,
          quote_ref_number: selectedPO.quote_ref_number,

          payment_terms: selectedPO.payment_terms,
          warranty_terms: selectedPO.warranty_terms,
          delivery_schedule: selectedPO.delivery_schedule,
          freight_terms: selectedPO.dispatch_terms, // Note: frontend uses 'dispatch_terms'
          tpi_terms: selectedPO.tpi_terms,
          installation_terms: selectedPO.installation_terms,
          commissioning_terms: selectedPO.commissioning_terms, // Add this field

          consignee_name: selectedPO.consignee_name,
          consignee_address: selectedPO.consignee_address,
          consignee_mobile: selectedPO.consignee_mobile,
          consignee_attention: selectedPO.consignee_attention,

          invoice_name: selectedPO.invoice_name,
          invoice_address: selectedPO.invoice_address,
          invoice_gstin: selectedPO.invoice_gstin,
        },

        // Line items for backend processing
        line_items: selectedPO.line_items.map((item) => ({
          id: item.id,
          item_no: item.item_no,
          material_description: item.material_description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total_price:
            item.quantity *
            item.unit_price *
            (1 + (item.gst_percentage || 18) / 100),
          make: item.make || "",
          material_group: item.material_group || "",
          unit: item.unit || "Nos",
          hsn_code: item.hsn_code || "",
          hsnSac: item.hsn_code || "",
          hsn_sac: item.hsn_code || "",
          gst_value:
            (item.quantity * item.unit_price * (item.gst_percentage || 18)) /
            100,
          gst_percentage: item.gst_percentage || 18,
          taxable_value: item.quantity * item.unit_price,
        })),

        // Items array (for PDF generation)
        items: itemsForBackend,
        
        // Totals
        totals: {
          totalAmount: totals.totalAmount,
          taxableValue: totals.taxableValue,
          gst: totals.gst,
          roundOff: totals.roundOff,
          quantity: totals.quantity,
        },

        // Additional required fields that backend expects
        deliveryAddress: selectedPO.consignee_address || "",
        currency: selectedCurrency,
        totalInWords: numberToWords(totals.totalAmount, selectedCurrency.code),
        terms_and_conditions: "",
      };

      console.log("Sending update data:", updateData);

      const response = await axios.put(
        `${configuration.api_url}/update-po/${selectedPO.po_number}`,
        updateData
      );

      showSnackbar(
        isApproved
          ? `Revision v${Number(selectedPO.version || 1) + 1} created and sent for re-approval`
          : "Purchase order updated and sent for approval",
        "success"
      );

      // Download the updated PO document
      setTimeout(() => {
        downloadPODocument(selectedPO.po_number, selectedPO.vendor_name);
      }, 1000);

      setOpenDialog(false);
      fetchRejectedPOs();
      fetchApprovedPOs();
    } catch (error: any) {
      console.error("Update error:", error);
      const errorMessage =
        error.response?.data?.error || "Failed to update purchase order";
      showSnackbar(errorMessage, "error");
    } finally {
      setLoading(false);
    }
  };

  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "warning"
  ) => {
    setSnackbarState({
      open: true,
      message,
      severity,
    });
  };

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>({
    code: "INR",
    symbol: "₹",
  });

  const currencies = [
    { code: "INR", symbol: "₹" },
    { code: "USD", symbol: "$" },
    { code: "EUR", symbol: "€" },
    { code: "GBP", symbol: "£" },
    { code: "JPY", symbol: "¥" },
    { code: "CNY", symbol: "¥" },
    { code: "AUD", symbol: "A$" },
    { code: "CAD", symbol: "C$" },
    { code: "SGD", symbol: "S$" },
    { code: "AED", symbol: "د.إ" },
  ];

  const numberToWords = (num: number, currencyCode: string): string => {
    // Configuration for different currencies
    const currencyConfigs = {
      INR: {
        localeCode: "en-IN",
        options: {
          currency: true,
          currencyOptions: { name: "Rupee", plural: "Rupees" },
        },
      },
      USD: {
        localeCode: "en-US",
        options: {
          currency: true,
          currencyOptions: { name: "Dollar", plural: "Dollars" },
        },
      },
      EUR: {
        localeCode: "en",
        options: {
          currency: true,
          currencyOptions: { name: "Euro", plural: "Euros" },
        },
      },
      GBP: {
        localeCode: "en-GB",
        options: {
          currency: true,
          currencyOptions: { name: "Pound", plural: "Pounds" },
        },
      },
      JPY: {
        localeCode: "en",
        options: {
          currency: true,
          currencyOptions: { name: "Yen", plural: "Yen" },
        },
      },
      CNY: {
        localeCode: "en",
        options: {
          currency: true,
          currencyOptions: { name: "Yuan", plural: "Yuan" },
        },
      },
      AUD: {
        localeCode: "en-AU",
        options: {
          currency: true,
          currencyOptions: {
            name: "Australian Dollar",
            plural: "Australian Dollars",
          },
        },
      },
      CAD: {
        localeCode: "en-CA",
        options: {
          currency: true,
          currencyOptions: {
            name: "Canadian Dollar",
            plural: "Canadian Dollars",
          },
        },
      },
      SGD: {
        localeCode: "en",
        options: {
          currency: true,
          currencyOptions: {
            name: "Singapore Dollar",
            plural: "Singapore Dollars",
          },
        },
      },
      AED: {
        localeCode: "en",
        options: {
          currency: true,
          currencyOptions: { name: "Dirham", plural: "Dirhams" },
        },
      },
    };

    // Get configuration for the current currency or use USD as fallback
    const config = currencyConfigs[currencyCode] || currencyConfigs.USD;

    // Initialize the converter with the appropriate locale
    const toWords = new ToWords(config.localeCode);

    // Convert the number to words with proper currency formatting
    const result = toWords.convert(num, config.options);

    // Return with proper formatting
    return result.charAt(0).toUpperCase() + result.slice(1);
  };

  const handleLineItemChange = (index: number, field: string, value: any) => {
    const updatedItems = [...selectedPO!.line_items];
    const item = { ...updatedItems[index] };

    item[field] = value;

    // Recalculate totals
    if (
      field === "quantity" ||
      field === "unit_price" ||
      field === "gst_percentage"
    ) {
      const basePrice = item.quantity * item.unit_price;
      const gstAmount = (basePrice * (item.gst_percentage || 18)) / 100;
      item.total_price = basePrice + gstAmount;
    }

    updatedItems[index] = item;

    setSelectedPO((prev) => ({
      ...prev!,
      line_items: updatedItems,
      total_amount: updatedItems.reduce((sum, i) => sum + i.total_price, 0),
    }));
  };

  // Add selectStyles object for consistent styling
  const selectStyles = {
    select: {
      height: "30px",
      "&.MuiSelect-select": {
        padding: "2px 8px",
      },
    },
    menuItem: {
      fontSize: "14px",
      padding: "4px 8px",
    },
  };

  // Calculate totals for line items similar to POPreviewDialog
  const calculateTotals = () => {
    if (!selectedPO?.line_items)
      return {
        quantity: 0,
        taxableValue: 0,
        gst: 0,
        totalAmount: 0,
        roundOff: 0,
      };

    const totals = selectedPO.line_items.reduce(
      (acc, item) => {
        const basePrice = item.quantity * item.unit_price;
        const gst = basePrice * ((item.gst_percentage || 18) / 100);
        return {
          quantity: acc.quantity + item.quantity,
          taxableValue: acc.taxableValue + basePrice,
          gst: acc.gst + gst,
          totalAmount: acc.totalAmount + (basePrice + gst),
        };
      },
      { quantity: 0, taxableValue: 0, gst: 0, totalAmount: 0 }
    );

    // Calculate round off
    const roundedTotal = Math.round(totals.totalAmount);
    const roundOff = roundedTotal - totals.totalAmount;

    return {
      ...totals,
      totalAmount: roundedTotal,
      roundOff: Number(roundOff.toFixed(2)),
    };
  };

  // Add these handler functions for PO detail changes
  const handlePODetailChange = (field: string, value: any) => {
    setSelectedPO((prev) => ({
      ...prev!,
      [field]: value,
    }));
  };

  const handleVendorChange = (event, newValue) => {
    setSelectedVendor(newValue);
    if (newValue) {
      setSelectedPO((prev) => ({
        ...prev!,
        vendor_name: newValue.vendor_name || "",
        vendor_address: newValue.address || "",
        vendor_email: newValue.email_1 || newValue.email_2 || "",
        vendor_contact: newValue.mobile_no_1 || newValue.mobile_no_2 || "",
        vendor_gstin: newValue.gst_number || "",
        vendor_pan: newValue.pan_number || "",
        vendor_state: newValue.state || "",
        vendor_state_code: newValue.state_code || "",
        vendor_payment_terms: newValue.payment_term || "",
      }));
    }
  };

  return (
    <Box className="po-edit">
      <Container maxWidth="xl">
      <Paper elevation={3} className="header-section">
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h5" className="title">
              {activeTab === 'rejected' ? 'Rejected Purchase Orders' : 'Approved Purchase Orders - Edit & Revise'}
            </Typography>
            <Box display="flex" gap={2}>
              <Chip 
                label={`Rejected (${rejectedPOs.length})`}
                color={activeTab === 'rejected' ? 'error' : 'default'}
                onClick={() => setActiveTab('rejected')}
                sx={{ cursor: 'pointer', fontWeight: activeTab === 'rejected' ? 'bold' : 'normal' }}
              />
              <Chip 
                label={`Approved (${approvedPOs.length})`}
                color={activeTab === 'approved' ? 'success' : 'default'}
                onClick={() => setActiveTab('approved')}
                sx={{ cursor: 'pointer', fontWeight: activeTab === 'approved' ? 'bold' : 'normal' }}
              />
            </Box>
          </Box>
          {loading && (
            <Box className="loading-overlay">
              <CircularProgress />
            </Box>
          )}
        </Paper>

        <Grid container spacing={3} className="po-cards">
        {(activeTab === 'rejected' ? rejectedPOs : approvedPOs).map((po) => (
            <Grid item xs={12} md={6} lg={4} key={po.po_number}>
              <Card className="po-card">
                <CardContent>
                  <Box className="po-header">
                    <Typography variant="h6" className="po-number">
                      {po.po_number}
                    </Typography>
                    <Chip
                      label={activeTab === 'rejected' ? 'Rejected' : `Approved v${Number(po.version || 1).toFixed(1)}`}
                      color={activeTab === 'rejected' ? 'error' : 'success'}
                      size="small"
                      className="status-chip"
                    />
                  </Box>

                  <Box className="po-details">
                    <Typography className="vendor-name">
                      <strong>Vendor:</strong> {po.vendor_name}
                    </Typography>
                    <Typography className="project-code">
                      <strong>Project:</strong> {po.project_code}
                    </Typography>
                    <Typography className="amount">
                      <strong>Amount:</strong> ₹
                      {po.total_amount.toLocaleString()}
                    </Typography>
                  </Box>

                  {activeTab === 'rejected' && (
                    <>
                      <Box className="rejection-details">
                        <Typography className="rejection-info">
                          <DateIcon fontSize="small" />
                          {format(new Date(po.rejection_date), "dd/MM/yyyy HH:mm")}
                        </Typography>
                      </Box>

                      <Box className="rejection-remarks">
                        <Typography>
                          <WarningIcon color="error" fontSize="small" />
                          <strong>Remarks:</strong> {po.rejection_remarks}
                        </Typography>
                      </Box>
                    </>
                  )}
                  
                  {activeTab === 'approved' && (
                    <Box className="approval-info" sx={{ mt: 1 }}>
                      <Typography variant="body2" color="text.secondary">
                        <strong>Approved on:</strong> {po.approval_date ? format(new Date(po.approval_date), "dd/MM/yyyy HH:mm") : 'N/A'}
                      </Typography>
                      <Typography variant="body2" color="primary" sx={{ mt: 0.5 }}>
                        💡 Click Edit to create a new revision
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                <CardActions className="card-actions">
                  <Button
                    startIcon={<EditIcon />}
                    variant="contained"
                    color={activeTab === 'approved' ? 'warning' : 'primary'}
                    onClick={() => handleEditPO(po)}
                    fullWidth
                  >
                    {activeTab === 'approved' ? 'Edit & Revise' : 'Edit PO'}
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>

        <Dialog
          open={openDialog}
          onClose={() => setOpenDialog(false)}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Typography variant="h5" align="center" sx={{ fontWeight: "bold" }}>
              PURCHASE ORDER
            </Typography>
          </DialogTitle>
          <DialogContent sx={{ p: 2 }}>
          {selectedPO && (selectedPO.status === 'approved' || selectedPO.approval_status) && (
              <Alert severity="warning" icon={<WarningIcon />} sx={{ mb: 2, fontWeight: 'bold' }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 1 }}>
                  ⚠️ EDITING APPROVED PO - REVISION MODE
                </Typography>
                <Typography variant="body2">
                  - Current Version: <strong>v{Number(selectedPO.version || 1).toFixed(1)}</strong> (Approved)
                </Typography>
                <Typography variant="body2">
                  - After Save: <strong>v{(Number(selectedPO.version || 1) + 1).toFixed(1)}</strong> (Pending Re-Approval)
                </Typography>
                <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
                  Changes will create a new revision and reset approval status.
                </Typography>
              </Alert>
            )}
            <Box sx={{ border: "1px solid #000", p: 2 }}>
              {/* Two-column layout for header */}
              <Grid container>
                {/* Left column - Supplier Details */}
                <Grid item xs={6} sx={{ borderRight: "1px solid #000", pr: 2 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                    Supplier Details:
                  </Typography>
                  <Box>
                    <Autocomplete
                      options={vendors}
                      getOptionLabel={(option) => option.vendor_name}
                      value={selectedVendor}
                      onChange={handleVendorChange}
                      renderInput={(params) => (
                        <TextField {...params} size="small" fullWidth />
                      )}
                    />
                    <TextField
                      fullWidth
                      multiline
                      rows={3}
                      size="small"
                      value={selectedPO?.vendor_address}
                      onChange={(e) =>
                        handlePODetailChange("vendor_address", e.target.value)
                      }
                      sx={{ mt: 1 }}
                    />
                    <Typography sx={{ mt: 1 }}>
                      Kind Attention: {selectedPO?.vendor_contact}
                    </Typography>
                    <Typography>Email: {selectedPO?.vendor_email}</Typography>
                    <Typography>
                      GST: {selectedPO?.vendor_gstin || "-"}
                    </Typography>
                    <Typography>
                      PAN No: {selectedPO?.vendor_pan || "-"}
                    </Typography>
                    <Typography>
                      State: {selectedPO?.vendor_state || "-"}
                    </Typography>
                    <Typography>
                      State Code: {selectedPO?.vendor_state_code || "-"}
                    </Typography>
                  </Box>

                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: "bold", mt: 2 }}
                  >
                    Billing Address:
                  </Typography>
                  <Box>
                    <Typography>CIMCON Software India Pvt. Ltd.</Typography>
                    <Typography>
                      1106/1117, 11th floor, Times Square Arcade – 1,
                    </Typography>
                    <Typography>
                      Opp. Rambaug, Near Baghbaan Party Plot Cross Road,
                    </Typography>
                    <Typography>Thaltej, Ahmedabad – 380059, India.</Typography>
                    <Typography>GST: 24AABCC1410E1ZL</Typography>
                    <Typography>PAN No: AABCC1410E</Typography>
                    <Typography>State: Gujarat</Typography>
                    <Typography>State Code: 24</Typography>
                  </Box>
                </Grid>

                {/* Right column - PO Details */}
                <Grid item xs={6} sx={{ pl: 2 }}>
                  <Table
                    size="small"
                    sx={{ "& td": { border: "1px solid #000" } }}
                  >
                    <TableBody>
                      <TableRow>
                        <TableCell sx={{ width: "40%", fontWeight: "bold" }}>
                          CIMCON PO Number
                        </TableCell>
                        <TableCell>{selectedPO?.po_number}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          PO Date
                        </TableCell>
                        <TableCell>
                          <TextField
                            type="date"
                            size="small"
                            fullWidth
                            value={selectedPO?.po_date?.split("T")[0] || ""}
                            onChange={(e) =>
                              handlePODetailChange("po_date", e.target.value)
                            }
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          PO Version
                        </TableCell>
                        <TableCell>
                          <Box display="flex" alignItems="center" gap={1}>
                            <Typography>
                              v{selectedPO?.version ? Number(selectedPO.version).toFixed(1) : '1.0'}
                            </Typography>
                            {selectedPO && (selectedPO.status === 'approved' || selectedPO.approval_status) && (
                              <Chip 
                                label={`Will become v${(Number(selectedPO.version || 1) + 1).toFixed(1)}`} 
                                size="small" 
                                color="warning"
                              />
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Quote Ref. Number
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={selectedPO?.quote_ref_number || ""}
                            onChange={(e) =>
                              handlePODetailChange(
                                "quote_ref_number",
                                e.target.value
                              )
                            }
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Project Code
                        </TableCell>
                        <TableCell>{selectedPO?.project_code}</TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Freight & Insurance
                        </TableCell>
                        <TableCell>
                          <Select
                            value={selectedPO?.dispatch_terms || "Exclusive"}
                            onChange={(e) =>
                              handlePODetailChange(
                                "dispatch_terms",
                                e.target.value
                              )
                            }
                            size="small"
                            fullWidth
                            sx={selectStyles.select}
                          >
                            <MenuItem
                              value="Inclusive"
                              sx={selectStyles.menuItem}
                            >
                              Inclusive
                            </MenuItem>
                            <MenuItem
                              value="Exclusive"
                              sx={selectStyles.menuItem}
                            >
                              Exclusive
                            </MenuItem>
                          </Select>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Payment Terms
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={selectedPO?.payment_terms || ""}
                            onChange={(e) =>
                              handlePODetailChange(
                                "payment_terms",
                                e.target.value
                              )
                            }
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Guarantee/Warranty
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={selectedPO?.warranty_terms || ""}
                            onChange={(e) =>
                              handlePODetailChange(
                                "warranty_terms",
                                e.target.value
                              )
                            }
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          TPI Inspection
                        </TableCell>
                        <TableCell>
                          <Select
                            value={selectedPO?.tpi_terms || "Exclusive"}
                            onChange={(e) =>
                              handlePODetailChange("tpi_terms", e.target.value)
                            }
                            size="small"
                            fullWidth
                            sx={selectStyles.select}
                          >
                            <MenuItem
                              value="Inclusive"
                              sx={selectStyles.menuItem}
                            >
                              Inclusive
                            </MenuItem>
                            <MenuItem
                              value="Exclusive"
                              sx={selectStyles.menuItem}
                            >
                              Exclusive
                            </MenuItem>
                          </Select>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Installation
                        </TableCell>
                        <TableCell>
                          <Select
                            value={
                              selectedPO?.installation_terms || "Exclusive"
                            }
                            onChange={(e) =>
                              handlePODetailChange(
                                "installation_terms",
                                e.target.value
                              )
                            }
                            size="small"
                            fullWidth
                            sx={selectStyles.select}
                          >
                            <MenuItem
                              value="Inclusive"
                              sx={selectStyles.menuItem}
                            >
                              Inclusive
                            </MenuItem>
                            <MenuItem
                              value="Exclusive"
                              sx={selectStyles.menuItem}
                            >
                              Exclusive
                            </MenuItem>
                          </Select>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Commissioning
                        </TableCell>
                        <TableCell>
                          <Select
                            value={
                              selectedPO?.commissioning_terms || "Exclusive"
                            }
                            onChange={(e) =>
                              handlePODetailChange(
                                "commissioning_terms",
                                e.target.value
                              )
                            }
                            size="small"
                            fullWidth
                            sx={selectStyles.select}
                          >
                            <MenuItem
                              value="Inclusive"
                              sx={selectStyles.menuItem}
                            >
                              Inclusive
                            </MenuItem>
                            <MenuItem
                              value="Exclusive"
                              sx={selectStyles.menuItem}
                            >
                              Exclusive
                            </MenuItem>
                          </Select>
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Delivery Schedule
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={selectedPO?.delivery_schedule || ""}
                            onChange={(e) =>
                              handlePODetailChange(
                                "delivery_schedule",
                                e.target.value
                              )
                            }
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                      </TableRow>
                      <TableRow>
                        <TableCell sx={{ fontWeight: "bold" }}>
                          Vendor Code
                        </TableCell>
                        <TableCell>{selectedPO?.vendor_code || "-"}</TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: "bold", mt: 2 }}
                  >
                    Delivery Address:
                  </Typography>
                  <Box>
                    <Select
                      value={selectedPO?.consignee_address || ""}
                      onChange={(e) => {
                        const address = e.target.value;
                        handlePODetailChange("consignee_address", address);
                        // Also update consignee name based on address
                        if (address.includes("CIMCON Software")) {
                          handlePODetailChange(
                            "consignee_name",
                            "CIMCON Software India Pvt. Ltd."
                          );
                        }
                      }}
                      fullWidth
                      size="small"
                      sx={selectStyles.select}
                    >
                      <MenuItem
                        value="CIMCON Software India Pvt. Ltd., 802, i-Square Corporate Park, Science City Road, Sola, Ahmedabad - 380060, Gujarat, India, Kind Attn: Hitesh Patel, Ph. - 9558017841"
                        sx={selectStyles.menuItem}
                      >
                        i-Square
                      </MenuItem>
                      <MenuItem
                        value="CIMCON Software India Pvt. Ltd. 904, Sakar IV, Opp. Townhall, Ellisbridge, Ashram Road Ahmedabad - 380006, Gujarat, India Kind Attn: Mahendra Khuteja Ph: 84019 52547"
                        sx={selectStyles.menuItem}
                      >
                        Sakar
                      </MenuItem>
                      <MenuItem
                        value="CIMCON Software India Pvt Ltd D22-23, Santosh Sadan Race Course, Dehradun - 248001, Dehradun, Kind Attn: Mr. Rajendra Ph. 94111 53770"
                        sx={selectStyles.menuItem}
                      >
                        Dehradun
                      </MenuItem>
                      <MenuItem
                        value="CIMCON SOFTWARE INDIA PVT. LTD. PS PATEL INDUSTRIAL ESTATE 1 OAD GAM KAMOD PIRANA ROAD KAMOD RING ROAD PIRANA 382427 Kind Attn: Hitesh Patel Ph: 7567113222"
                        sx={selectStyles.menuItem}
                      >
                        Pirana
                      </MenuItem>
                      <MenuItem
                        value="CIMCON Software India Pvt. Ltd. 1106/1117, 11th floor, Times Square Arcade – 1, Opp. Rambaug, Near Baghbaan Party Plot Cross Road, Thaltej, Ahmedabad – 380059, India. Kind Attn: Ashish Solanki Ph: 8758006007"
                        sx={selectStyles.menuItem}
                      >
                        Times Square
                      </MenuItem>
                    </Select>
                    <Typography variant="body2" sx={{ mt: 1 }}>
                      {selectedPO?.consignee_address}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Currency Selection */}
              <Box sx={{ mb: 2, mt: 2 }}>
                <Select
                  value={selectedCurrency.code}
                  onChange={(e) =>
                    setSelectedCurrency(
                      currencies.find((c) => c.code === e.target.value) ||
                        currencies[0]
                    )
                  }
                  size="small"
                >
                  {currencies.map((currency) => (
                    <MenuItem key={currency.code} value={currency.code}>
                      {currency.code} ({currency.symbol})
                    </MenuItem>
                  ))}
                </Select>
              </Box>
              <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">Line Items</Typography>
                <Button
                  variant="outlined"
                  color="primary"
                  startIcon={<AddIcon />}
                  onClick={() => fetchAvailableItemsForProject(selectedPO?.project_code || '')}
                  disabled={!selectedPO?.project_code}
                >
                  Add Items from Master
                </Button>
              </Box>
              {/* Line Items Table */}
              <TableContainer sx={{ mt: 3, overflow: "visible" }}>
                <Table
                  size="small"
                  sx={{
                    "& th, & td": {
                      border: "1px solid #000",
                      padding: "8px",
                      verticalAlign: "middle",
                    },
                    tableLayout: "fixed",
                  }}
                >
                  <TableHead>
                    <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                      <TableCell sx={{ width: "40px" }}>S/N</TableCell>
                      <TableCell sx={{ width: "120px" }}>CIMCON P/N</TableCell>
                      <TableCell sx={{ width: "200px" }}>Description</TableCell>
                      <TableCell sx={{ width: "100px" }}>HSN/SAC</TableCell>
                      <TableCell sx={{ width: "100px" }}>Qty.</TableCell>
                      <TableCell sx={{ width: "120px" }}>Unit Rate</TableCell>
                      <TableCell sx={{ width: "120px" }}>
                        Taxable Value
                      </TableCell>
                      <TableCell sx={{ width: "80px" }}>GST %</TableCell>
                      <TableCell sx={{ width: "120px" }}>
                        Total Amount
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {selectedPO?.line_items.map((item, index) => (
                      <TableRow key={item.id}>
                        <TableCell align="center">{index + 1}</TableCell>
                        <TableCell>{item.item_no}</TableCell>
                        <TableCell>
                          <TextField
                            value={item.material_description}
                            onChange={(e) =>
                              handleLineItemChange(
                                index,
                                "material_description",
                                e.target.value
                              )
                            }
                            size="small"
                            fullWidth
                            multiline
                            rows={2}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={item.hsn_code || ""}
                            onChange={(e) =>
                              handleLineItemChange(
                                index,
                                "hsn_code",
                                e.target.value
                              )
                            }
                            size="small"
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <TextField
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleLineItemChange(
                                  index,
                                  "quantity",
                                  Number(e.target.value)
                                )
                              }
                              size="small"
                              fullWidth
                              InputProps={{
                                inputProps: {
                                  min: 0,
                                  style: { textAlign: "right" },
                                },
                              }}
                            />
                            <Typography sx={{ ml: 1, whiteSpace: "nowrap" }}>
                              {item.unit}
                            </Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Typography sx={{ mr: 0.5 }}>
                              {selectedCurrency.symbol}
                            </Typography>
                            <TextField
                              type="number"
                              value={item.unit_price}
                              onChange={(e) =>
                                handleLineItemChange(
                                  index,
                                  "unit_price",
                                  Number(e.target.value)
                                )
                              }
                              size="small"
                              fullWidth
                              InputProps={{
                                inputProps: {
                                  min: 0,
                                  style: { textAlign: "right" },
                                },
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {selectedCurrency.symbol}{" "}
                          {(item.quantity * item.unit_price).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <TextField
                              type="number"
                              value={item.gst_percentage || 18}
                              onChange={(e) =>
                                handleLineItemChange(
                                  index,
                                  "gst_percentage",
                                  Number(e.target.value)
                                )
                              }
                              size="small"
                              fullWidth
                              InputProps={{
                                inputProps: {
                                  min: 0,
                                  style: { textAlign: "right" },
                                },
                                endAdornment: (
                                  <InputAdornment position="end">
                                    %
                                  </InputAdornment>
                                ),
                              }}
                            />
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {selectedCurrency.symbol}{" "}
                          {item.total_price.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}

                    {/* Total row */}
                    <TableRow sx={{ backgroundColor: "#f9f9f9" }}>
                      <TableCell
                        colSpan={4}
                        align="right"
                        sx={{ fontWeight: "bold" }}
                      >
                        Total
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>
                        {calculateTotals().quantity}{" "}
                        {selectedPO?.line_items[0]?.unit || "Nos"}
                      </TableCell>
                      <TableCell />
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>
                        {selectedCurrency.symbol}{" "}
                        {calculateTotals().taxableValue.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>
                        {selectedCurrency.symbol}{" "}
                        {calculateTotals().gst.toFixed(2)}
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: "bold" }}>
                        {selectedCurrency.symbol}{" "}
                        {calculateTotals().totalAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>

                    {/* Round off row */}
                    <TableRow>
                      <TableCell
                        colSpan={8}
                        align="right"
                        sx={{ fontWeight: "bold" }}
                      >
                        Round Off:
                      </TableCell>
                      <TableCell align="right">
                        {selectedCurrency.symbol}{" "}
                        {calculateTotals().roundOff.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Total in Words */}
              <Box sx={{ mt: 2, border: "1px solid #000", p: 1 }}>
                <Typography>
                  Total Value (in words):{" "}
                  {numberToWords(
                    calculateTotals().totalAmount,
                    selectedCurrency.code
                  )}
                </Typography>
              </Box>
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button
              onClick={handleUpdatePO}
              variant="contained"
              color="primary"
              startIcon={<DownloadIcon />}
              disabled={loading}
            >
              {loading ? "Updating..." : "Update and Download"}
            </Button>
          </DialogActions>
          <Dialog
          open={addItemsDialogOpen}
          onClose={() => setAddItemsDialogOpen(false)}
          maxWidth="xl"
          fullWidth
        >
          <DialogTitle>
            <Box display="flex" justifyContent="space-between" alignItems="center">
              <Typography variant="h6">
                Add Items from Master - Project: {selectedPO?.project_code}
              </Typography>
              <Box display="flex" gap={2} alignItems="center">
                <Chip 
                  label={`${selectedNewItems.length} selected`} 
                  color="primary" 
                  size="small"
                />
                <Typography variant="body2" color="text.secondary">
                  {availableItems.length} available item(s)
                </Typography>
              </Box>
            </Box>
          </DialogTitle>
          <DialogContent>
            {loading ? (
              <Box display="flex" justifyContent="center" p={3}>
                <CircularProgress />
              </Box>
            ) : availableItems.length === 0 ? (
              <Alert severity="info" sx={{ mt: 2 }}>
                <Typography variant="body1" gutterBottom>
                  <strong>No available items found</strong>
                </Typography>
                <Typography variant="body2">
                  Possible reasons:
                </Typography>
                <ul>
                  <li>All items for this project are already in POs</li>
                  <li>No approved master items exist for project code: {selectedPO?.project_code}</li>
                  <li>All items are already in the current PO</li>
                </ul>
              </Alert>
            ) : (
              <TableContainer sx={{ maxHeight: 500 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ bgcolor: 'background.paper' }}>
                        <input
                          type="checkbox"
                          style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedNewItems(availableItems.map(item => item.id));
                            } else {
                              setSelectedNewItems([]);
                            }
                          }}
                          checked={selectedNewItems.length === availableItems.length && availableItems.length > 0}
                        />
                      </TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>CPN</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>Description</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>Make</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>Material Group</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>Quantity</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>UOM</TableCell>
                      <TableCell sx={{ fontWeight: 'bold', bgcolor: 'background.paper' }}>HSN Code</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {availableItems.map((item: any) => (
                      <TableRow 
                        key={item.id}
                        hover
                        selected={selectedNewItems.includes(item.id)}
                        sx={{ 
                          cursor: 'pointer',
                          '&.Mui-selected': { bgcolor: 'action.selected' }
                        }}
                        onClick={() => {
                          if (selectedNewItems.includes(item.id)) {
                            setSelectedNewItems(selectedNewItems.filter(id => id !== item.id));
                          } else {
                            setSelectedNewItems([...selectedNewItems, item.id]);
                          }
                        }}
                      >
                        <TableCell padding="checkbox">
                          <input
                            type="checkbox"
                            style={{ cursor: 'pointer', width: '18px', height: '18px' }}
                            checked={selectedNewItems.includes(item.id)}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (e.target.checked) {
                                setSelectedNewItems([...selectedNewItems, item.id]);
                              } else {
                                setSelectedNewItems(selectedNewItems.filter(id => id !== item.id));
                              }
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight="medium">
                            {item.cimcon_part_number || 'N/A'}  {/* ✅ Changed */}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{ maxWidth: 300 }}>
                            {item.material_description || 'N/A'}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.make || 'N/A'}</TableCell>
                        <TableCell>{item.material_group || 'N/A'}</TableCell>
                        <TableCell>{item.required_quantity || item.ordering_qty || 0}</TableCell>  {/* ✅ Changed */}
                        <TableCell>{item.unit || 'Nos'}</TableCell>
                        <TableCell>{item.hsn_code || '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button 
              onClick={() => {
                setAddItemsDialogOpen(false);
                setSelectedNewItems([]);
              }}
              variant="outlined"
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleAddSelectedItems}
              disabled={selectedNewItems.length === 0}
              startIcon={<AddIcon />}
            >
              Add {selectedNewItems.length} Item(s) to PO
            </Button>
          </DialogActions>
        </Dialog>
        </Dialog>

        <Snackbar
          open={snackbarState.open}
          autoHideDuration={6000}
          onClose={() => setSnackbarState({ ...snackbarState, open: false })}
          anchorOrigin={{ vertical: "top", horizontal: "right" }}
        >
          <Alert
            severity={snackbarState.severity}
            onClose={() => setSnackbarState({ ...snackbarState, open: false })}
          >
            {snackbarState.message}
          </Alert>
        </Snackbar>
      </Container>
    </Box>
  );
};

export default POEdit;
