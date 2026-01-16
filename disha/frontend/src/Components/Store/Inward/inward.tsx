import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  TextField,
  MenuItem,
  Autocomplete,
  Typography,
  Grid,
  Snackbar,
  Alert,
  IconButton,
  Backdrop,
  CircularProgress,
  Card,
  CardContent,
  CardHeader,
  Paper,
  Chip,
  Stack,
  Tooltip,
  LinearProgress,
  Divider,
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
  Collapse,
  InputAdornment,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridRowModesModel,
  GridRowModes,
  GridRowEditStopReasons,
} from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import InventoryIcon from "@mui/icons-material/Inventory";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SendIcon from "@mui/icons-material/Send";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DescriptionIcon from "@mui/icons-material/Description";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DeleteIcon from "@mui/icons-material/Delete";
import axios from "axios";
import configuration from "../../../configuration";
import "./inward.scss";

const InwardForm: React.FC = () => {
  const [formData, setFormData] = useState({
    poNumber: "",
    location: "",
    remarks: "",
    received_date: new Date().toISOString().split("T")[0],
  });

  const [invoiceData, setInvoiceData] = useState({
    invoice_number: "",
    invoice_date: new Date().toISOString().split("T")[0],
    purchase_invoice: null as File | null,
  });

  const [poNumbers, setPONumbers] = useState<string[]>([]);
  const [selectedItems, setSelectedItems] = useState<any[]>([]);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [snackbarSeverity, setSnackbarSeverity] = useState<
    "success" | "error" | "warning" | "info"
  >("success");
  const [loading, setLoading] = useState(false);
  const [poDetails, setPODetails] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const fetchPONumbers = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${configuration.api_url}all-po-numbers/`
        );
        setPONumbers(response.data);
      } catch (error) {
        console.error("Error fetching PO numbers:", error);
        showSnackbar("Failed to load PO numbers", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchPONumbers();
  }, []);

  const showSnackbar = (
    message: string,
    severity: "success" | "error" | "warning" | "info" = "success"
  ) => {
    setSnackbarMessage(message);
    setSnackbarSeverity(severity);
    setSnackbarOpen(true);
  };

  const fetchPODetails = async (poNumber: string) => {
    setLoading(true);
    try {
      const [poResponse, inwardStatusResponse] = await Promise.all([
        axios.get(`${configuration.api_url}/purchase-orders/${poNumber}/`),
        axios.get(`${configuration.api_url}/po-inward-status/${poNumber}/`),
      ]);

      setPODetails(poResponse.data);

      if (poResponse.data.inward_status === "completed") {
        showSnackbar("This PO has been completely inwarded", "info");
        setSelectedItems([]);
        return;
      }

      if (poResponse.data) {
        const items = poResponse.data.line_items.map(
          (item: any, index: number) => ({
            id: item.item_no || `item_${index}`,
            itemCode: item.item_no,
            description: item.material_description || "N/A",
            material_group: item.material_group || "Unknown",
            make: item.make || "Unknown",
            unit_price: Number(item.unit_price) || 0,
            total_price:
              Number(item.unit_price || 0) * Number(item.quantity || 0),
            orderedQuantity: Number(item.quantity),
            already_inwarded: Number(item.inwarded_quantity || 0),
            remaining_quantity: Number(
              item.remaining_quantity || item.quantity
            ),
            received_date: new Date(),
            receivedQuantity: 0,
            inward_status: item.inward_status || "open",
          })
        );
        setSelectedItems(items);
      } else {
        setSelectedItems([]);
      }
    } catch (error) {
      console.error("Error fetching PO details:", error);
      showSnackbar("Error fetching PO details", "error");
      setSelectedItems([]);
    } finally {
      setLoading(false);
    }
  };

  const handlePOSelect = (event: any, newValue: string | null) => {
    if (newValue) {
      setFormData((prev) => ({ ...prev, poNumber: newValue }));
      fetchPODetails(newValue);
    } else {
      setFormData((prev) => ({ ...prev, poNumber: "" }));
      setSelectedItems([]);
      setPODetails(null);
    }
  };

  const handleEditItem = (item: any) => {
    setEditingItem({ ...item });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = () => {
    const remaining =
      editingItem.orderedQuantity - (editingItem.already_inwarded || 0);

    if (editingItem.receivedQuantity > remaining) {
      showSnackbar(
        `Cannot receive more than remaining quantity (${remaining})`,
        "warning"
      );
      return;
    }

    if (editingItem.receivedQuantity < 0) {
      showSnackbar("Received quantity cannot be negative", "error");
      return;
    }

    const updatedItems = selectedItems.map((item) =>
      item.id === editingItem.id ? { ...editingItem } : item
    );
    setSelectedItems(updatedItems);
    setEditDialogOpen(false);
    setEditingItem(null);
    showSnackbar("Item updated successfully", "success");
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setInvoiceData((prev) => ({
        ...prev,
        purchase_invoice: file,
      }));
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setInvoiceData((prev) => ({
        ...prev,
        purchase_invoice: file,
      }));
    }
  };

  const removeFile = () => {
    setInvoiceData((prev) => ({
      ...prev,
      purchase_invoice: null,
    }));
  };

  const openInvoiceDialog = () => {
    if (!formData.poNumber) {
      showSnackbar("Please select a Purchase Order first", "warning");
      return;
    }
    setInvoiceDialogOpen(true);
  };

  const closeInvoiceDialog = () => {
    setInvoiceDialogOpen(false);
  };

  const handleSaveInvoiceDetails = () => {
    if (!invoiceData.purchase_invoice) {
      showSnackbar("Please upload an invoice file", "warning");
      return;
    }
    if (!invoiceData.invoice_number) {
      showSnackbar("Please enter invoice number", "warning");
      return;
    }
    if (!invoiceData.invoice_date) {
      showSnackbar("Please enter invoice date", "warning");
      return;
    }

    closeInvoiceDialog();
    showSnackbar("Invoice details saved successfully!", "success");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invoiceData.purchase_invoice) {
      showSnackbar("Please upload purchase invoice first", "warning");
      openInvoiceDialog();
      return;
    }

    if (!invoiceData.invoice_number) {
      showSnackbar("Please enter invoice number", "warning");
      openInvoiceDialog();
      return;
    }

    if (!invoiceData.invoice_date) {
      showSnackbar("Please enter invoice date", "warning");
      openInvoiceDialog();
      return;
    }

    setLoading(true);

    const itemsToSubmit = selectedItems.filter(
      (item) => item.receivedQuantity && item.receivedQuantity > 0
    );

    if (itemsToSubmit.length === 0) {
      showSnackbar(
        "Please enter received quantities for at least one item",
        "warning"
      );
      setLoading(false);
      return;
    }

    if (!formData.location) {
      showSnackbar("Please select a delivery location", "warning");
      setLoading(false);
      return;
    }

    const formDataToSend = new FormData();

    if (invoiceData.purchase_invoice) {
      formDataToSend.append("purchase_invoice", invoiceData.purchase_invoice);
    }
    formDataToSend.append("invoice_number", invoiceData.invoice_number);
    formDataToSend.append("invoice_date", invoiceData.invoice_date);

    formDataToSend.append("poNumber", formData.poNumber);
    formDataToSend.append("receivedDate", formData.received_date);
    formDataToSend.append("location", formData.location);
    formDataToSend.append("remarks", formData.remarks || "NA");
    formDataToSend.append(
      "items",
      JSON.stringify(
        itemsToSubmit.map((item) => ({
          itemCode: item.itemCode,
          description: item.description,
          material_group: item.material_group,
          make: item.make,
          unit_price: item.unit_price,
          total_price: item.total_price,
          orderedQuantity: Number(item.orderedQuantity),
          already_inwarded: Number(item.already_inwarded || 0),
          received_date:
            item.received_date instanceof Date
              ? item.received_date.toISOString().split("T")[0]
              : item.received_date,
          quantityReceived: Number(item.receivedQuantity || 0),
        }))
      )
    );

    try {
      await axios.post(`${configuration.api_url}save_inward/`, formDataToSend, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      showSnackbar("Inward entry saved successfully!", "success");

      if (formData.poNumber) {
        await fetchPODetails(formData.poNumber);
      }

      setFormData((prev) => ({
        ...prev,
        location: "",
        remarks: "",
      }));

      setSelectedItems((prev) =>
        prev.map((item) => ({
          ...item,
          receivedQuantity: 0,
        }))
      );

      setInvoiceData({
        invoice_number: "",
        invoice_date: new Date().toISOString().split("T")[0],
        purchase_invoice: null,
      });
    } catch (error: any) {
      console.error("Error saving inward entry:", error);
      showSnackbar(
        error.response?.data?.message || "Error saving inward entry",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const getTotalProgress = () => {
    if (!selectedItems.length) return 0;
    const totalOrdered = selectedItems.reduce(
      (sum, item) => sum + item.orderedQuantity,
      0
    );
    const totalInwarded = selectedItems.reduce(
      (sum, item) => sum + (item.already_inwarded || 0),
      0
    );
    return totalOrdered > 0 ? (totalInwarded / totalOrdered) * 100 : 0;
  };

  const toggleRowExpansion = (itemId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
    }
    setExpandedRows(newExpanded);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "partially_inwarded":
        return "warning";
      case "open":
        return "info";
      default:
        return "default";
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc", p: 3 }}>
      <Backdrop
        sx={{
          color: "#fff",
          zIndex: (theme) => theme.zIndex.drawer + 1,
          backgroundColor: "rgba(0, 0, 0, 0.7)",
        }}
        open={loading}
      >
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 2,
          }}
        >
          <CircularProgress color="inherit" size={60} />
          <Typography variant="h6" color="inherit">
            Processing... Please wait
          </Typography>
        </Box>
      </Backdrop>

      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h3"
          sx={{
            fontWeight: 800,
            color: "#1e293b",
            mb: 1,
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            backgroundClip: "text",
            textFillColor: "transparent",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          Material Inward
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Receive and track incoming inventory efficiently
        </Typography>
      </Box>

      <Card elevation={3} sx={{ mb: 4, borderRadius: 3 }}>
        <CardHeader
          title="Inward Information"
          titleTypographyProps={{
            variant: "h6",
            fontWeight: 600,
            color: "#10b981",
          }}
          avatar={<LocalShippingIcon sx={{ color: "#10b981", fontSize: 28 }} />}
        />
        <CardContent>
          <Box component="form" onSubmit={handleSubmit}>
            <Grid container spacing={3}>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Purchase Order *
                </Typography>
                <Autocomplete
                  options={poNumbers}
                  value={formData.poNumber}
                  onChange={handlePOSelect}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      fullWidth
                      placeholder="Search PO Number..."
                      variant="outlined"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <SearchIcon sx={{ color: "action.active", mr: 1 }} />
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Delivery Location *
                </Typography>
                <TextField
                  select
                  fullWidth
                  value={formData.location}
                  onChange={(e) =>
                    setFormData({ ...formData, location: e.target.value })
                  }
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <LocationOnIcon sx={{ color: "action.active", mr: 1 }} />
                    ),
                  }}
                >
                  <MenuItem value="Times Square">Times Square</MenuItem>
                  <MenuItem value="iSquare">iSquare</MenuItem>
                  <MenuItem value="Sakar">Sakar</MenuItem>
                  <MenuItem value="Pirana">Pirana</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Received Date *
                </Typography>
                <TextField
                  type="date"
                  fullWidth
                  value={formData.received_date}
                  onChange={(e) =>
                    setFormData({ ...formData, received_date: e.target.value })
                  }
                  variant="outlined"
                  InputProps={{
                    startAdornment: (
                      <CalendarTodayIcon
                        sx={{ color: "action.active", mr: 1 }}
                      />
                    ),
                  }}
                />
              </Grid>
              <Grid item xs={12} md={3}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                  Actions
                </Typography>
                <Stack direction="row" spacing={1}>
                  <Button
                    variant="outlined"
                    size="large"
                    startIcon={<AttachFileIcon />}
                    onClick={openInvoiceDialog}
                    disabled={!formData.poNumber}
                    sx={{
                      borderColor: "#3b82f6",
                      color: "#3b82f6",
                      "&:hover": {
                        borderColor: "#2563eb",
                        backgroundColor: "rgba(59, 130, 246, 0.04)",
                      },
                      borderRadius: 2,
                      fontWeight: 600,
                      py: 1.5,
                      flex: 1,
                    }}
                  >
                    Upload Invoice
                  </Button>
                  <Button
                    type="submit"
                    variant="contained"
                    size="large"
                    startIcon={<SendIcon />}
                    disabled={
                      !formData.poNumber ||
                      !formData.location ||
                      selectedItems.length === 0 ||
                      !invoiceData.purchase_invoice
                    }
                    sx={{
                      bgcolor: "#10b981",
                      "&:hover": { bgcolor: "#059669" },
                      borderRadius: 2,
                      fontWeight: 600,
                      py: 1.5,
                      flex: 1,
                    }}
                  >
                    Submit Inward
                  </Button>
                </Stack>
              </Grid>
              {(formData.location === "Other" || formData.remarks) && (
                <Grid item xs={12}>
                  <Typography
                    variant="subtitle2"
                    sx={{ mb: 1, fontWeight: 600 }}
                  >
                    Remarks
                  </Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={2}
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData({ ...formData, remarks: e.target.value })
                    }
                    variant="outlined"
                    placeholder="Enter any remarks..."
                  />
                </Grid>
              )}
            </Grid>
          </Box>
        </CardContent>
      </Card>

      {invoiceData.purchase_invoice && (
        <Card
          elevation={2}
          sx={{ mb: 4, borderRadius: 3, border: "2px solid #10b981" }}
        >
          <CardContent>
            <Stack direction="row" alignItems="center" spacing={2}>
              <CheckCircleIcon sx={{ color: "#10b981", fontSize: 32 }} />
              <Box sx={{ flex: 1 }}>
                <Typography variant="h6" fontWeight={600} color="#10b981">
                  Purchase Invoice Ready
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Invoice: {invoiceData.invoice_number} | Date:{" "}
                  {invoiceData.invoice_date} | File:{" "}
                  {invoiceData.purchase_invoice.name}
                </Typography>
              </Box>
              <Button
                variant="outlined"
                size="small"
                startIcon={<EditIcon />}
                onClick={openInvoiceDialog}
                sx={{
                  borderColor: "#3b82f6",
                  color: "#3b82f6",
                  "&:hover": {
                    borderColor: "#2563eb",
                    backgroundColor: "rgba(59, 130, 246, 0.04)",
                  },
                }}
              >
                Edit
              </Button>
            </Stack>
          </CardContent>
        </Card>
      )}

      {poDetails && (
        <Card elevation={3} sx={{ mb: 4, borderRadius: 3 }}>
          <CardContent>
            <Grid container spacing={3} alignItems="center">
              <Grid item xs={12} md={6}>
                <Stack direction="row" alignItems="center" spacing={2}>
                  <AssignmentIcon sx={{ color: "#3b82f6", fontSize: 32 }} />
                  <Box>
                    <Typography variant="h6" fontWeight={600} color="#3b82f6">
                      PO: {formData.poNumber}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {poDetails.vendor_name}
                    </Typography>
                  </Box>
                </Stack>
              </Grid>
              <Grid item xs={12} md={3}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Inward Progress
                  </Typography>
                  <LinearProgress
                    variant="determinate"
                    value={getTotalProgress()}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: "rgba(16, 185, 129, 0.1)",
                      "& .MuiLinearProgress-bar": {
                        bgcolor: "#10b981",
                        borderRadius: 4,
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {getTotalProgress().toFixed(1)}% Complete
                  </Typography>
                </Box>
              </Grid>
              <Grid item xs={12} md={3}>
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Chip
                    label={
                      poDetails.inward_status
                        ?.replace("_", " ")
                        .toUpperCase() || "OPEN"
                    }
                    color={getStatusColor(poDetails.inward_status)}
                  />
                  <Chip
                    label={`₹${Number(
                      poDetails.total_amount || 0
                    ).toLocaleString("en-IN")}`}
                    variant="outlined"
                    color="primary"
                  />
                </Stack>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      <Card elevation={3} sx={{ borderRadius: 3 }}>
        <CardHeader
          title={
            <Stack direction="row" alignItems="center" spacing={2}>
              <InventoryIcon sx={{ color: "#059669", fontSize: 28 }} />
              <Box>
                <Typography variant="h6" fontWeight={600} color="#059669">
                  Items to Receive
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {selectedItems.length} items • Click edit to enter quantities
                </Typography>
              </Box>
            </Stack>
          }
          action={
            selectedItems.length > 0 && (
              <Chip
                label={`${
                  selectedItems.filter((item) => item.receivedQuantity > 0)
                    .length
                } items to receive`}
                color="success"
                variant="outlined"
              />
            )
          }
        />
        <CardContent sx={{ p: 0 }}>
          {selectedItems.length > 0 ? (
            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: "#f8fafc" }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Item Details</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>
                      Ordered
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>
                      Inwarded
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>
                      Remaining
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>
                      To Receive
                    </TableCell>
                    <TableCell align="center" sx={{ fontWeight: 600 }}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {selectedItems.map((item, index) => {
                    const remaining =
                      item.orderedQuantity - (item.already_inwarded || 0);
                    return (
                      <React.Fragment key={item.id}>
                        <TableRow
                          hover
                          sx={{ "&:hover": { bgcolor: "#f8fafc" } }}
                        >
                          <TableCell>
                            <Box>
                              <Typography
                                variant="subtitle2"
                                fontWeight={600}
                                color="#1e40af"
                              >
                                {item.itemCode}
                              </Typography>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                noWrap
                              >
                                {item.description}
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={1}
                                sx={{ mt: 0.5 }}
                              >
                                <Chip
                                  label={item.make}
                                  size="small"
                                  variant="outlined"
                                />
                                <Chip
                                  label={item.material_group}
                                  size="small"
                                  variant="outlined"
                                />
                              </Stack>
                            </Box>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={item.orderedQuantity}
                              size="small"
                              color="primary"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={item.already_inwarded || 0}
                              size="small"
                              color="success"
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={remaining}
                              size="small"
                              color={remaining > 0 ? "warning" : "success"}
                              variant="outlined"
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              label={item.receivedQuantity || 0}
                              size="small"
                              color={
                                item.receivedQuantity > 0
                                  ? "success"
                                  : "default"
                              }
                              variant={
                                item.receivedQuantity > 0
                                  ? "filled"
                                  : "outlined"
                              }
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Stack
                              direction="row"
                              spacing={1}
                              justifyContent="center"
                            >
                              <Tooltip title="Edit Quantity">
                                <IconButton
                                  size="small"
                                  onClick={() => handleEditItem(item)}
                                  sx={{ color: "#3b82f6" }}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="View Details">
                                <IconButton
                                  size="small"
                                  onClick={() => toggleRowExpansion(item.id)}
                                  sx={{ color: "#6b7280" }}
                                >
                                  {expandedRows.has(item.id) ? (
                                    <ExpandLessIcon fontSize="small" />
                                  ) : (
                                    <ExpandMoreIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </Tooltip>
                            </Stack>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell colSpan={6} sx={{ p: 0, border: 0 }}>
                            <Collapse in={expandedRows.has(item.id)}>
                              <Box sx={{ p: 3, bgcolor: "#f8fafc" }}>
                                <Grid container spacing={2}>
                                  <Grid item xs={6} md={3}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Unit Price
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      fontWeight={500}
                                    >
                                      ₹
                                      {Number(item.unit_price).toLocaleString(
                                        "en-IN"
                                      )}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6} md={3}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Total Price
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      fontWeight={500}
                                    >
                                      ₹
                                      {Number(item.total_price).toLocaleString(
                                        "en-IN"
                                      )}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6} md={3}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Status
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      fontWeight={500}
                                    >
                                      {item.inward_status
                                        ?.replace("_", " ")
                                        .toUpperCase()}
                                    </Typography>
                                  </Grid>
                                  <Grid item xs={6} md={3}>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      Received Date
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      fontWeight={500}
                                    >
                                      {item.received_date instanceof Date
                                        ? item.received_date.toLocaleDateString()
                                        : new Date(
                                            item.received_date
                                          ).toLocaleDateString()}
                                    </Typography>
                                  </Grid>
                                </Grid>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Paper
              elevation={0}
              sx={{
                p: 6,
                textAlign: "center",
                bgcolor: "#f8fafc",
                borderRadius: 2,
                border: "2px dashed #d1d5db",
                m: 3,
              }}
            >
              <InventoryIcon sx={{ fontSize: 64, color: "#9ca3af", mb: 2 }} />
              <Typography variant="h6" color="text.secondary" sx={{ mb: 1 }}>
                Select a Purchase Order
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Choose a PO number from the dropdown to view and receive items
              </Typography>
            </Paper>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={editDialogOpen}
        onClose={() => setEditDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <EditIcon color="primary" />
          Edit Received Quantity
        </DialogTitle>
        <DialogContent>
          {editingItem && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                {editingItem.itemCode}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {editingItem.description}
              </Typography>

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">
                    Ordered
                  </Typography>
                  <Typography variant="h6" color="primary">
                    {editingItem.orderedQuantity}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">
                    Already Inwarded
                  </Typography>
                  <Typography variant="h6" color="success.main">
                    {editingItem.already_inwarded || 0}
                  </Typography>
                </Grid>
                <Grid item xs={4}>
                  <Typography variant="caption" color="text.secondary">
                    Remaining
                  </Typography>
                  <Typography variant="h6" color="warning.main">
                    {editingItem.orderedQuantity -
                      (editingItem.already_inwarded || 0)}
                  </Typography>
                </Grid>
              </Grid>

              <TextField
                fullWidth
                label="Quantity to Receive"
                type="number"
                value={editingItem.receivedQuantity || ""}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    receivedQuantity: Number(e.target.value),
                  })
                }
                inputProps={{
                  min: 0,
                  max:
                    editingItem.orderedQuantity -
                    (editingItem.already_inwarded || 0),
                }}
                helperText={`Maximum: ${
                  editingItem.orderedQuantity -
                  (editingItem.already_inwarded || 0)
                }`}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Received Date"
                type="date"
                value={
                  editingItem.received_date instanceof Date
                    ? editingItem.received_date.toISOString().split("T")[0]
                    : editingItem.received_date
                }
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    received_date: new Date(e.target.value),
                  })
                }
                InputLabelProps={{ shrink: true }}
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 1 }}>
          <Button
            onClick={() => setEditDialogOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveEdit}
            variant="contained"
            sx={{
              bgcolor: "#10b981",
              "&:hover": { bgcolor: "#059669" },
              borderRadius: 2,
            }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={invoiceDialogOpen}
        onClose={closeInvoiceDialog}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: "linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
            color: "white",
            borderRadius: "12px 12px 0 0",
          }}
        >
          <DescriptionIcon />
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Upload Purchase Invoice
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              PO: {formData.poNumber}
            </Typography>
          </Box>
        </DialogTitle>

        <DialogContent sx={{ p: 4 }}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <Typography
                variant="h6"
                fontWeight={600}
                sx={{ mb: 2, color: "#1e293b" }}
              >
                Invoice Document
              </Typography>

              <Box
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                sx={{
                  border: `3px dashed ${dragActive ? "#10b981" : "#d1d5db"}`,
                  borderRadius: 3,
                  p: 4,
                  textAlign: "center",
                  backgroundColor: dragActive
                    ? "rgba(16, 185, 129, 0.05)"
                    : "#f8fafc",
                  transition: "all 0.3s ease",
                  cursor: "pointer",
                  "&:hover": {
                    borderColor: "#10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.05)",
                  },
                }}
                onClick={() =>
                  document.getElementById("invoice-file-input")?.click()
                }
              >
                {invoiceData.purchase_invoice ? (
                  <Box>
                    <CheckCircleIcon
                      sx={{ fontSize: 48, color: "#10b981", mb: 2 }}
                    />
                    <Typography
                      variant="h6"
                      fontWeight={600}
                      color="#10b981"
                      sx={{ mb: 1 }}
                    >
                      File Uploaded Successfully!
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      {invoiceData.purchase_invoice.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Click to change file or drag and drop a new one
                    </Typography>
                  </Box>
                ) : (
                  <Box>
                    <CloudUploadIcon
                      sx={{ fontSize: 64, color: "#6b7280", mb: 2 }}
                    />
                    <Typography
                      variant="h6"
                      fontWeight={600}
                      color="#374151"
                      sx={{ mb: 1 }}
                    >
                      Upload Purchase Invoice
                    </Typography>
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ mb: 2 }}
                    >
                      Drag and drop your invoice file here, or click to browse
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Supports PDF, JPG, PNG, DOC, DOCX (Max 10MB)
                    </Typography>
                  </Box>
                )}
              </Box>

              <input
                id="invoice-file-input"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileChange}
                style={{ display: "none" }}
              />

              {invoiceData.purchase_invoice && (
                <Box
                  sx={{ mt: 2, display: "flex", alignItems: "center", gap: 1 }}
                >
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DeleteIcon />}
                    onClick={removeFile}
                    sx={{
                      borderColor: "#ef4444",
                      color: "#ef4444",
                      "&:hover": {
                        borderColor: "#dc2626",
                        backgroundColor: "rgba(239, 68, 68, 0.04)",
                      },
                    }}
                  >
                    Remove File
                  </Button>
                </Box>
              )}
            </Grid>

            <Grid item xs={12}>
              <Typography
                variant="h6"
                fontWeight={600}
                sx={{ mb: 2, color: "#1e293b" }}
              >
                Invoice Details
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Invoice Number *"
                value={invoiceData.invoice_number}
                onChange={(e) =>
                  setInvoiceData((prev) => ({
                    ...prev,
                    invoice_number: e.target.value,
                  }))
                }
                variant="outlined"
                placeholder="Enter invoice number"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <DescriptionIcon sx={{ color: "action.active" }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Invoice Date *"
                type="date"
                value={invoiceData.invoice_date}
                onChange={(e) =>
                  setInvoiceData((prev) => ({
                    ...prev,
                    invoice_date: e.target.value,
                  }))
                }
                variant="outlined"
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <CalendarTodayIcon sx={{ color: "action.active" }} />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={closeInvoiceDialog}
            variant="outlined"
            sx={{
              borderRadius: 2,
              borderColor: "#6b7280",
              color: "#6b7280",
              "&:hover": {
                borderColor: "#4b5563",
                backgroundColor: "rgba(107, 114, 128, 0.04)",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSaveInvoiceDetails}
            variant="contained"
            sx={{
              bgcolor: "#10b981",
              "&:hover": { bgcolor: "#059669" },
              borderRadius: 2,
              fontWeight: 600,
            }}
          >
            Save Invoice Details
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbarOpen(false)}
          severity={snackbarSeverity}
          sx={{
            borderRadius: 2,
            fontWeight: 500,
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default InwardForm;
