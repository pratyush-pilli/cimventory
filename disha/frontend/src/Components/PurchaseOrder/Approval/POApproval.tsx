import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Card,
  CardHeader,
  CardContent,
  CardActions,
  Divider,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Avatar,
  Tab,
  Tabs,
  InputAdornment,
  OutlinedInput,
  Stack,
  Badge,
  useTheme,
  useMediaQuery,
} from "@mui/material";
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  ExpandMore as ExpandMoreIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  Business as BusinessIcon,
  LocalShipping as ShippingIcon,
  ListAlt as ListAltIcon,
  Description as DescriptionIcon,
  Assignment as AssignmentIcon,
  AttachMoney as AttachMoneyIcon,
  EventNote as EventNoteIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  AccountCircle as AccountCircleIcon,
  Download as DownloadIcon,
} from "@mui/icons-material";
import axios from "axios";
import "./po_approval.scss";
import configuration from "../../../configuration";

interface POItem {
  id: number;
  item_no: string;
  material_description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  make: string;
  material_group: string;
  unit: string;
  requisition_id: number;
  expected_delivery: string | null;
  inwarded_quantity: number;
  added_in_revision?: number;  // ✅ Add this
  is_revised?: boolean;  // ✅ Add this
}

interface PurchaseOrder {
  po_number: string;
  po_date: string;
  quote_ref_number: string | null;
  project_code: string;
  version?: number;

  // Vendor Details
  vendor_name: string;
  vendor_address: string;
  vendor_email: string | null;
  vendor_gstin: string | null;
  vendor_pan: string | null;
  vendor_state: string | null;
  vendor_state_code: string | null;
  vendor_contact: string | null;
  vendor_payment_terms: string | null;

  // Financial Details
  total_amount: number;

  // Terms and Conditions
  payment_terms: string;
  warranty_terms: string;
  delivery_schedule: string;
  freight_terms: string;
  tpi_terms: string;
  installation_terms: string;

  // Consignee Details
  consignee_name: string | null;
  consignee_address: string | null;
  consignee_mobile: string | null;
  consignee_attention: string | null;

  // Invoice Details
  invoice_name: string | null;
  invoice_address: string | null;
  invoice_gstin: string | null;

  // Status and Tracking
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  inward_status: string;
  total_inwarded_quantity: number;

  items?: POItem[];
  line_items?: POItem[];

  // Added for currency information
  currency_code?: string;
  currency_symbol?: string;
}

// Create a new interface for tab panels
interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`po-tabpanel-${index}`}
      aria-labelledby={`po-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 2 }}>{children}</Box>}
    </div>
  );
}

const POApproval: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [filteredPOs, setFilteredPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPO, setExpandedPO] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [tabValue, setTabValue] = useState<Record<string, number>>({});
  const [rejectionDialog, setRejectionDialog] = useState<{
    open: boolean;
    poNumber: string;
    reason: string;
  }>({
    open: false,
    poNumber: "",
    reason: "",
  });
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({
    open: false,
    message: "",
    severity: "success",
  });
  const [poHistory, setPOHistory] = useState<Record<string, any[]>>({});
  const [showOnlyRevised, setShowOnlyRevised] = useState(false);  // ✅ Add this



  useEffect(() => {
    fetchPendingPOs();
  }, []);

  useEffect(() => {
    // Filter POs based on search term and revision filter
    let filtered = purchaseOrders;
    
    // Apply revision filter
    if (showOnlyRevised) {
      filtered = filtered.filter(po => po.version && Number(po.version) > 1);
    }
    
    // Apply search filter
    if (searchTerm.trim() !== "") {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (po) =>
          po.po_number.toLowerCase().includes(term) ||
          po.vendor_name.toLowerCase().includes(term) ||
          po.project_code.toLowerCase().includes(term)
      );
    }
    
    setFilteredPOs(filtered);
  }, [searchTerm, purchaseOrders, showOnlyRevised]);

  const fetchPendingPOs = async (revisedOnly = false) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}/pending-approval/${revisedOnly ? '?revised_only=true' : ''}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
  
      // Ensure each PO has an items array, even if empty
      const processedData = (response.data || []).map((po: PurchaseOrder) => ({
        ...po,
        items: po.items || po.line_items || [],
      }));
  
      setPurchaseOrders(processedData);
      setFilteredPOs(processedData);
    } catch (error) {
      console.error("Error fetching POs:", error);
      showSnackbar("Failed to load purchase orders", "error");
      setPurchaseOrders([]);
      setFilteredPOs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPOHistory = async (poNumber: string) => {
    try {
      const response = await axios.get(
        `${configuration.api_url}/po-history/${poNumber}/`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      setPOHistory(prev => ({ ...prev, [poNumber]: response.data }));
    } catch (error) {
      console.error("Error fetching PO history:", error);
    }
  };
  const handleApprove = async (poNumber: string) => {
    try {
      await axios.post(
        `${configuration.api_url}/approve/${poNumber}/`,
        {},
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      showSnackbar("Purchase order approved successfully", "success");
      fetchPendingPOs();
    } catch (error) {
      console.error("Error approving PO:", error);
      showSnackbar("Failed to approve purchase order", "error");
    }
  };

  const handleReject = async () => {
    if (!rejectionDialog.reason.trim()) {
      showSnackbar("Rejection remarks are required", "error");
      return;
    }

    try {
      await axios.post(
        `${configuration.api_url}/reject/${rejectionDialog.poNumber}/`,
        { rejection_remarks: rejectionDialog.reason },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      setRejectionDialog({ open: false, poNumber: "", reason: "" });
      showSnackbar("Purchase order rejected successfully", "success");
      fetchPendingPOs();
    } catch (error) {
      console.error("Error rejecting PO:", error);
      showSnackbar("Failed to reject purchase order", "error");
    }
  };

  const showSnackbar = (message: string, severity: "success" | "error") => {
    setSnackbar({ open: true, message, severity });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number, po?: PurchaseOrder) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: po?.currency_code || "INR",
      currencyDisplay: "symbol",
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const handleExpandClick = (poNumber: string) => {
    setExpandedPO(expandedPO === poNumber ? null : poNumber);
    // Initialize tab value for this PO if needed
    if (!tabValue[poNumber]) {
      setTabValue((prev) => ({ ...prev, [poNumber]: 0 }));
    }
  };

  const handleTabChange = (poNumber: string, newValue: number) => {
    setTabValue((prev) => ({ ...prev, [poNumber]: newValue }));
  };

  // Add download function
  const downloadPODocument = async (poNumber: string, vendorName: string) => {
    try {
      const response = await axios.get(
        `${configuration.api_url}/download-po/${poNumber}/`,
        {
          responseType: "blob", // Important for file downloads
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
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

  if (loading) {
    return (
      <Box className="po-approval-container" sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ fontWeight: 500 }}>
          Purchase Order Approval
        </Typography>
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      </Box>
    );
  }

  return (
    <Box className="po-approval-container" sx={{ p: 3 }}>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" sx={{ fontWeight: 500 }}>
          Purchase Order Approval
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <OutlinedInput
            placeholder="Search PO, Vendor, Project..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            startAdornment={
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            }
            sx={{ width: { xs: 150, sm: 250 } }}
          />
          <Button
            variant={showOnlyRevised ? "contained" : "outlined"}
            color="warning"
            startIcon={<EventNoteIcon />}
            onClick={() => {
              const newValue = !showOnlyRevised;
              setShowOnlyRevised(newValue);
              fetchPendingPOs(newValue);  // Pass the new value to fetch the correct data
            }}
            size="small"
            sx={{ whiteSpace: 'nowrap' }}
          >
            {showOnlyRevised ? 'Show All' : 'Revised Only'}
          </Button>
          <Tooltip title="Refresh">
            <IconButton onClick={fetchPendingPOs} color="primary">
              <Badge badgeContent={filteredPOs.length} color="primary">
                <FilterListIcon />
              </Badge>
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {filteredPOs.length === 0 ? (
        <Paper sx={{ p: 4, textAlign: "center" }}>
          <Typography variant="h6" color="textSecondary">
            No pending purchase orders found
          </Typography>
          <Typography variant="body2" color="textSecondary" sx={{ mt: 1 }}>
            All purchase orders have been processed or none are available for
            review
          </Typography>
        </Paper>
      ) : (
        <Stack spacing={2}>
          {filteredPOs.map((po) => (
            <Card key={po.po_number} sx={{ mb: 2, overflow: "visible" }}>
              <CardHeader
                avatar={
                  <Avatar sx={{ bgcolor: theme.palette.primary.main }}>
                    <DescriptionIcon />
                  </Avatar>
                }
                title={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                    <Typography variant="h6" component="span">
                      {po.po_number}
                    </Typography>
                    <Chip
                      label="Pending Approval"
                      color="warning"
                      size="small"
                      sx={{ ml: 1 }}
                    />
                    {po.version && Number(po.version) > 1 && (
                      <Chip
                        label={`Revision v${Number(po.version).toFixed(1)}`}
                        color="error"
                        size="small"
                        icon={<EventNoteIcon />}
                        sx={{ fontWeight: 'bold' }}
                      />
                    )}
                  </Box>
                }
                subheader={
                  <Box>
                    {po.version && Number(po.version) > 1 && (
                      <Alert 
                        severity="warning" 
                        sx={{ mb: 1, py: 0.5 }}
                        icon={<EventNoteIcon />}
                        action={
                          <Button 
                            size="small" 
                            color="inherit"
                            onClick={(e) => {
                              e.stopPropagation();
                              fetchPOHistory(po.po_number);
                              
                            }}
                          >
                            View Changes
                          </Button>
                        }
                      >
                        <Typography variant="body2" fontWeight="bold">
                          This PO has been revised - Please review changes carefully
                        </Typography>
                      </Alert>
                    )}
                  <Grid container spacing={2} sx={{ mt: 0.5 }}>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <BusinessIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          {po.vendor_name}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <AssignmentIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          Project: {po.project_code}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <EventNoteIcon fontSize="small" color="action" />
                        <Typography variant="body2">
                          Date: {formatDate(po.po_date)}
                        </Typography>
                      </Box>
                    </Grid>
                    <Grid item xs={12} sm={6} md={3}>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <AttachMoneyIcon fontSize="small" color="action" />
                        <Typography variant="body2" fontWeight="bold">
                          Amount: {formatCurrency(po.total_amount, po)}
                        </Typography>
                      </Box>
                    </Grid>
                  </Grid>
                </Box>
                }
                action={
                  <Box sx={{ display: "flex", gap: 1 }}>
                    <Tooltip title="Download PO">
                      <IconButton
                        color="primary"
                        onClick={() =>
                          downloadPODocument(po.po_number, po.vendor_name)
                        }
                        aria-label="download purchase order"
                      >
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Approve">
                      <IconButton
                        color="success"
                        onClick={() => handleApprove(po.po_number)}
                        aria-label="approve purchase order"
                      >
                        <CheckCircleIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Reject">
                      <IconButton
                        color="error"
                        onClick={() =>
                          setRejectionDialog({
                            open: true,
                            poNumber: po.po_number,
                            reason: "",
                          })
                        }
                        aria-label="reject purchase order"
                      >
                        <CancelIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip
                      title={
                        expandedPO === po.po_number
                          ? "Hide Details"
                          : "Show Details"
                      }
                    >
                      <IconButton
                        onClick={() => handleExpandClick(po.po_number)}
                        aria-expanded={expandedPO === po.po_number}
                        aria-label="show more"
                      >
                        {expandedPO === po.po_number ? (
                          <KeyboardArrowUpIcon />
                        ) : (
                          <KeyboardArrowDownIcon />
                        )}
                      </IconButton>
                    </Tooltip>
                  </Box>
                }
              />

              {expandedPO === po.po_number && (
                <CardContent sx={{ pt: 0 }}>
                  <Divider sx={{ mb: 2 }} />

                  <Box sx={{ borderBottom: 1, borderColor: "divider" }}>
                    <Tabs
                      value={tabValue[po.po_number] || 0}
                      onChange={(_, newValue) =>
                        handleTabChange(po.po_number, newValue)
                      }
                      variant={isMobile ? "scrollable" : "standard"}
                      scrollButtons={isMobile ? "auto" : undefined}
                    >
                      <Tab
                        label="Line Items"
                        icon={<ListAltIcon />}
                        iconPosition="start"
                        id={`po-tab-0-${po.po_number}`}
                        aria-controls={`po-tabpanel-0-${po.po_number}`}
                      />
                      <Tab
                        label="Vendor Details"
                        icon={<BusinessIcon />}
                        iconPosition="start"
                        id={`po-tab-1-${po.po_number}`}
                        aria-controls={`po-tabpanel-1-${po.po_number}`}
                      />
                      <Tab
                        label="Shipping"
                        icon={<ShippingIcon />}
                        iconPosition="start"
                        id={`po-tab-2-${po.po_number}`}
                        aria-controls={`po-tabpanel-2-${po.po_number}`}
                      />
                      <Tab
                        label="Terms"
                        icon={<DescriptionIcon />}
                        iconPosition="start"
                        id={`po-tab-3-${po.po_number}`}
                        aria-controls={`po-tabpanel-3-${po.po_number}`}
                      />
                    </Tabs>
                  </Box>

                  <TabPanel value={tabValue[po.po_number] || 0} index={0}>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small" aria-label="line items table">
                        <TableHead>
                          <TableRow
                            sx={{ backgroundColor: theme.palette.action.hover }}
                          >
                            <TableCell>Item No</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Make</TableCell>
                            <TableCell align="right">Quantity</TableCell>
                            <TableCell align="right">Unit Price</TableCell>
                            <TableCell align="right">Total Price</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {(po.items || po.line_items || []).length > 0 ? (
                            (po.items || po.line_items || []).map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{item.item_no}</TableCell>
                                <TableCell>
                                  <Tooltip title={item.material_description}>
                                    <Typography
                                      sx={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        display: "-webkit-box",
                                        WebkitLineClamp: 2,
                                        WebkitBoxOrient: "vertical",
                                        maxWidth: "250px",
                                      }}
                                    >
                                      {item.material_description}
                                    </Typography>
                                  </Tooltip>
                                </TableCell>
                                <TableCell>{item.make}</TableCell>
                                <TableCell align="right">
                                  {item.quantity} {item.unit}
                                </TableCell>
                                <TableCell align="right">
                                  {formatCurrency(item.unit_price, po)}
                                </TableCell>
                                <TableCell align="right">
                                  {formatCurrency(item.total_price, po)}
                                </TableCell>
                              </TableRow>
                            ))
                          ) : (
                            <TableRow>
                              <TableCell colSpan={6} align="center">
                                <Typography variant="subtitle2">
                                  No line items found
                                </Typography>
                              </TableCell>
                            </TableRow>
                          )}
                          {(po.items || po.line_items || []).length > 0 && (
                            <TableRow
                              sx={{
                                backgroundColor: theme.palette.action.hover,
                              }}
                            >
                              <TableCell
                                colSpan={5}
                                align="right"
                                sx={{ fontWeight: "bold" }}
                              >
                                Total Amount:
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{ fontWeight: "bold" }}
                              >
                                {formatCurrency(po.total_amount, po)}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </TabPanel>

                  <TabPanel value={tabValue[po.po_number] || 0} index={1}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: "bold",
                              mb: 2,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <BusinessIcon sx={{ mr: 1 }} /> Vendor Information
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Name:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.vendor_name}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Address:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.vendor_address}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Contact:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.vendor_contact || "N/A"}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Email:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.vendor_email || "N/A"}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                GSTIN:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.vendor_gstin || "N/A"}
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                PAN:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.vendor_pan || "N/A"}
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                State:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.vendor_state || "N/A"}
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                State Code:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.vendor_state_code || "N/A"}
                              </Typography>
                            </Grid>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Payment Terms:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.vendor_payment_terms || "N/A"}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                          <Typography
                            variant="subtitle1"
                            sx={{
                              fontWeight: "bold",
                              mb: 2,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <AssignmentIcon sx={{ mr: 1 }} /> PO Information
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                PO Number:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.po_number}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                PO Date:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {formatDate(po.po_date)}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Project Code:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.project_code}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Quote Reference:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.quote_ref_number || "N/A"}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Total Amount:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2" fontWeight="bold">
                                {formatCurrency(po.total_amount, po)}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Paper>
                      </Grid>
                    </Grid>
                  </TabPanel>

                  <TabPanel value={tabValue[po.po_number] || 0} index={2}>
                    <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: "bold",
                          mb: 2,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <ShippingIcon sx={{ mr: 1 }} /> Delivery Address
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={3}>
                          <Typography variant="body2" color="textSecondary">
                            Name:
                          </Typography>
                          <Typography variant="body1">
                            {po.consignee_name || "N/A"}
                          </Typography>
                        </Grid>

                        {/* <Grid item xs={12} sm={6} md={3}>
                          <Typography variant="body2" color="textSecondary">
                            Attention:
                          </Typography>
                          <Typography variant="body1">
                            {po.consignee_attention || "N/A"}
                          </Typography>
                        </Grid> */}

                        {/* <Grid item xs={12} sm={6} md={3}>
                          <Typography variant="body2" color="textSecondary">
                            Mobile:
                          </Typography>
                          <Typography variant="body1">
                            {po.consignee_mobile || "N/A"}
                          </Typography>
                        </Grid> */}

                        {/* <Grid item xs={12} sm={6} md={3}>
                          <Typography variant="body2" color="textSecondary">
                            Delivery Schedule:
                          </Typography>
                          <Typography variant="body1">
                            {po.delivery_schedule}
                          </Typography>
                        </Grid> */}

                        <Grid item xs={12}>
                          <Typography variant="body2" color="textSecondary">
                            Address:
                          </Typography>
                          <Typography variant="body1">
                            {po.consignee_address || "N/A"}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography
                        variant="subtitle1"
                        sx={{
                          fontWeight: "bold",
                          mb: 2,
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <AccountCircleIcon sx={{ mr: 1 }} /> Billing Address
                      </Typography>
                      <Grid container spacing={2}>
                        <Grid item xs={12} sm={6} md={4}>
                          <Typography variant="body2" color="textSecondary">
                            Name:
                          </Typography>
                          <Typography variant="body1">
                            {po.invoice_name || "N/A"}
                          </Typography>
                        </Grid>

                        <Grid item xs={12} sm={6} md={4}>
                          <Typography variant="body2" color="textSecondary">
                            GSTIN:
                          </Typography>
                          <Typography variant="body1">
                            {po.invoice_gstin || "N/A"}
                          </Typography>
                        </Grid>

                        <Grid item xs={12}>
                          <Typography variant="body2" color="textSecondary">
                            Address:
                          </Typography>
                          <Typography variant="body1">
                            {po.invoice_address || "N/A"}
                          </Typography>
                        </Grid>
                      </Grid>
                    </Paper>
                  </TabPanel>

                  <TabPanel value={tabValue[po.po_number] || 0} index={3}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: "bold", mb: 2 }}
                          >
                            Payment & Warranty
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Payment Terms:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.payment_terms}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Warranty Terms:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.warranty_terms}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Paper>
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <Paper variant="outlined" sx={{ p: 2, height: "100%" }}>
                          <Typography
                            variant="subtitle1"
                            sx={{ fontWeight: "bold", mb: 2 }}
                          >
                            Shipping & Installation
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Freight & Insurance:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.freight_terms}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                TPI Terms:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.tpi_terms}
                              </Typography>
                            </Grid>

                            <Grid item xs={4}>
                              <Typography variant="body2" color="textSecondary">
                                Installation Terms:
                              </Typography>
                            </Grid>
                            <Grid item xs={8}>
                              <Typography variant="body2">
                                {po.installation_terms}
                              </Typography>
                            </Grid>
                          </Grid>
                        </Paper>
                      </Grid>
                    </Grid>
                  </TabPanel>

                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "flex-end",
                      mt: 2,
                      gap: 1,
                    }}
                  >
                    <Button
                      variant="outlined"
                      color="primary"
                      startIcon={<DownloadIcon />}
                      onClick={() =>
                        downloadPODocument(po.po_number, po.vendor_name)
                      }
                    >
                      Download PO
                    </Button>
                    <Button
                      variant="contained"
                      color="primary"
                      startIcon={<CheckCircleIcon />}
                      onClick={() => handleApprove(po.po_number)}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="contained"
                      color="error"
                      startIcon={<CancelIcon />}
                      onClick={() =>
                        setRejectionDialog({
                          open: true,
                          poNumber: po.po_number,
                          reason: "",
                        })
                      }
                    >
                      Reject
                    </Button>
                  </Box>
                </CardContent>
              )}
            </Card>
          ))}
        </Stack>
      )}

      <Dialog
        open={rejectionDialog.open}
        onClose={() =>
          setRejectionDialog({ open: false, poNumber: "", reason: "" })
        }
        maxWidth="sm"
        fullWidth
        aria-labelledby="rejection-dialog-title"
      >
        <DialogTitle id="rejection-dialog-title">
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <CancelIcon color="error" sx={{ mr: 1 }} />
            Reject Purchase Order
          </Box>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
            Please provide a reason for rejecting this purchase order
          </Typography>
          <TextField
            autoFocus
            margin="dense"
            label="Rejection Remarks"
            fullWidth
            multiline
            rows={4}
            value={rejectionDialog.reason}
            onChange={(e) =>
              setRejectionDialog((prev) => ({
                ...prev,
                reason: e.target.value,
              }))
            }
            required
            placeholder="Enter detailed reason for rejection..."
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setRejectionDialog({ open: false, poNumber: "", reason: "" })
            }
          >
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            color="error"
            variant="contained"
            disabled={!rejectionDialog.reason.trim()}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
      {/* Add this after your rejection dialog */}
      <Dialog
        open={Object.keys(poHistory).length > 0}
        onClose={() => setPOHistory({})}
        maxWidth="md"
        fullWidth
      >
  <DialogTitle>Revision History - PO {Object.keys(poHistory)[0]}</DialogTitle>
  <DialogContent>
    {Object.keys(poHistory)[0] && poHistory[Object.keys(poHistory)[0]]?.map((entry, index) => (
      <Box key={index} sx={{ mb: 3, p: 2, border: '1px solid #eee', borderRadius: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="subtitle1" fontWeight="bold">
            {entry.action} by {entry.changed_by}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {new Date(entry.changed_at).toLocaleString()}
          </Typography>
        </Box>
        
        {entry.changes.length > 0 && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="subtitle2" gutterBottom>Changes:</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Field</TableCell>
                    <TableCell>Old Value</TableCell>
                    <TableCell>New Value</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {entry.changes.map((change, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>{change.field}</TableCell>
                      <TableCell sx={{ 
                        color: 'error.main',
                        textDecoration: change.type === 'updated' ? 'line-through' : 'none'
                      }}>
                        {String(change.old || '—')}
                      </TableCell>
                      <TableCell sx={{ 
                        color: 'success.main',
                        fontWeight: change.type === 'updated' ? 'bold' : 'normal'
                      }}>
                        {String(change.new || '—')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}
        
              {entry.notes && (
                <Box sx={{ mt: 2, p: 1, bgcolor: '#f5f5f5', borderRadius: 1 }}>
                  <Typography variant="body2">
                    <strong>Notes:</strong> {entry.notes}
                  </Typography>
                </Box>
              )}
            </Box>
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPOHistory({})}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          elevation={6}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default POApproval;
