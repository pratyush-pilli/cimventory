import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Typography,
  Autocomplete,
  Grid,
  Stack,
  CircularProgress,
  Alert,
  TableSortLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Collapse,
  IconButton,
  Pagination,
  TableFooter,
  Skeleton,
  Card,
  CardContent,
  Divider,
  Avatar,
  Tooltip,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";

import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import RefreshIcon from "@mui/icons-material/Refresh";
import BusinessIcon from "@mui/icons-material/Business";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import PaymentIcon from "@mui/icons-material/Payment";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import SecurityIcon from "@mui/icons-material/Security";
import InventoryIcon from "@mui/icons-material/Inventory";
import PersonIcon from "@mui/icons-material/Person";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ReceiptIcon from "@mui/icons-material/Receipt";
import NotesIcon from "@mui/icons-material/Notes";
import DescriptionIcon from "@mui/icons-material/Description";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import axios from "axios";
import configuration from "../../../configuration";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { debounce } from "lodash";

interface InvoiceData {
  id: number;
  po_number: string;
  invoice_number: string;
  invoice_date: string;
  vendor_name: string;
  project_code: string;
  total_amount: number;
  purchase_invoice: string; // File path
  created_at: string;
  created_by: string;
  inward_entry_id: number;
  // Additional fields from PO
  po_date?: string;
  vendor_address?: string;
  vendor_email?: string;
  vendor_contact?: string;
  vendor_gstin?: string;
}

interface PaginatedResponse {
  results: InvoiceData[];
  count: number;
  next: string | null;
  previous: string | null;
  page_size: number;
  current_page: number;
  total_pages: number;
}

interface FilterOptions {
  projectCodes: string[];
  vendors: string[];
  poNumbers: string[];
}

type SortField =
  | "invoice_number"
  | "invoice_date"
  | "po_number"
  | "vendor_name"
  | "total_amount"
  | "created_at";
type SortDirection = "asc" | "desc";

const InvoiceTracker: React.FC = () => {
  // State Management
  const [paginatedData, setPaginatedData] = useState<PaginatedResponse>({
    results: [],
    count: 0,
    next: null,
    previous: null,
    page_size: 25,
    current_page: 1,
    total_pages: 0,
  });
  const [filterOptions, setFilterOptions] = useState<FilterOptions>({
    projectCodes: [],
    vendors: [],
    poNumbers: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(
    null
  );

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectCode, setSelectedProjectCode] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedPONumber, setSelectedPONumber] = useState("");
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);

  // Sort States
  const [sortField, setSortField] = useState<SortField>("invoice_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch data when filters or pagination change
  useEffect(() => {
    fetchInvoices();
  }, [
    currentPage,
    pageSize,
    sortField,
    sortDirection,
    selectedProjectCode,
    selectedVendor,
    selectedPONumber,
    startDate,
    endDate,
  ]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      setCurrentPage(1); // Reset to first page on search
      fetchInvoices(term);
    }, 500),
    [
      pageSize,
      sortField,
      sortDirection,
      selectedProjectCode,
      selectedVendor,
      selectedPONumber,
      startDate,
      endDate,
    ]
  );

  useEffect(() => {
    if (searchTerm) {
      debouncedSearch(searchTerm);
    } else {
      fetchInvoices();
    }
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchTerm, debouncedSearch]);

  const fetchInvoices = async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Build query parameters
      const params = new URLSearchParams({
        page: currentPage.toString(),
        page_size: pageSize.toString(),
        sort_field: sortField,
        sort_direction: sortDirection,
      });

      if (search || searchTerm) {
        params.append("search", search || searchTerm);
      }
      if (selectedProjectCode) {
        params.append("project_code", selectedProjectCode);
      }
      if (selectedVendor) {
        params.append("vendor", selectedVendor);
      }
      if (selectedPONumber) {
        params.append("po_number", selectedPONumber);
      }
      if (startDate) {
        params.append("start_date", startDate.format("YYYY-MM-DD"));
      }
      if (endDate) {
        params.append("end_date", endDate.format("YYYY-MM-DD"));
      }

      // Fetch all inward entries with invoice data
      const response = await axios.get(
        `${configuration.api_url}all-invoices/?${params}`
      );

      // Handle the paginated response
      const responseData = response.data;

      if (!responseData || !responseData.results) {
        console.error("Invalid response format:", responseData);
        setError("Invalid response format from server");
        return;
      }

      const invoices = responseData.results || [];

      // Update paginated data directly from backend response
      setPaginatedData({
        results: invoices,
        count: responseData.count || 0,
        next: responseData.next,
        previous: responseData.previous,
        page_size: responseData.page_size || pageSize,
        current_page: responseData.current_page || currentPage,
        total_pages: responseData.total_pages || 1,
      });

      // Update filter options based on all available data
      // We'll need to fetch all data for filter options (without pagination)
      try {
        const filterResponse = await axios.get(
          `${configuration.api_url}all-invoices/?page_size=1000`
        );
        const allInvoices = filterResponse.data?.results || [];

        setFilterOptions({
          projectCodes: [
            ...new Set(
              allInvoices
                .map((inv: InvoiceData) => inv.project_code)
                .filter(Boolean)
            ),
          ].sort(),
          vendors: [
            ...new Set(
              allInvoices
                .map((inv: InvoiceData) => inv.vendor_name)
                .filter(Boolean)
            ),
          ].sort(),
          poNumbers: [
            ...new Set(
              allInvoices
                .map((inv: InvoiceData) => inv.po_number)
                .filter(Boolean)
            ),
          ].sort(),
        });
      } catch (filterError) {
        console.error("Error fetching filter options:", filterError);
        // Continue without filter options if there's an error
      }
    } catch (error) {
      console.error("Error fetching invoices:", error);
      setError("Failed to fetch invoices. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedProjectCode("");
    setSelectedVendor("");
    setSelectedPONumber("");
    setStartDate(null);
    setEndDate(null);
    setSortField("invoice_date");
    setSortDirection("desc");
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    value: number
  ) => {
    setCurrentPage(value);
    setExpandedRow(null);
  };

  // Toggle row expansion
  const handleRowClick = (index: number) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  // Download invoice
  const downloadInvoice = async (invoice: InvoiceData) => {
    try {
      const response = await axios.get(
        `${configuration.api_url}download-invoice/${invoice.id}/`,
        { responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${invoice.invoice_number}_${invoice.po_number}.pdf`
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error downloading invoice:", error);
      alert("Failed to download invoice. Please try again.");
    }
  };

  // Preview invoice
  const previewInvoice = (invoice: InvoiceData) => {
    setSelectedInvoice(invoice);
    setPreviewDialogOpen(true);
  };

  // Active filters count
  const activeFiltersCount = [
    searchTerm,
    selectedProjectCode,
    selectedVendor,
    selectedPONumber,
    startDate,
    endDate,
  ].filter(Boolean).length;

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button onClick={() => fetchInvoices()} size="small">
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 600, color: "#1e293b" }}>
            Invoice Tracker
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {paginatedData.count.toLocaleString()} total invoices
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setShowFilters(!showFilters)}
            color={activeFiltersCount > 0 ? "primary" : "inherit"}
          >
            Filters {activeFiltersCount > 0 && `(${activeFiltersCount})`}
          </Button>
          <Button
            variant="outlined"
            startIcon={<RestartAltIcon />}
            onClick={resetFilters}
            disabled={activeFiltersCount === 0}
          >
            Reset
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => fetchInvoices()}
            disabled={loading}
          >
            Refresh
          </Button>
        </Stack>
      </Box>

      {/* Search Bar */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by invoice number, PO number, vendor name, or project code..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          InputProps={{
            startAdornment: (
              <SearchIcon sx={{ color: "text.secondary", mr: 1 }} />
            ),
          }}
          sx={{ maxWidth: 600 }}
        />
      </Box>

      {/* Advanced Filters */}
      <Collapse in={showFilters}>
        <Paper sx={{ p: 3, mb: 3, backgroundColor: "#f8fafc" }}>
          <Typography variant="h6" sx={{ mb: 2, color: "#374151" }}>
            Advanced Filters
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small">
                <InputLabel>Project Code</InputLabel>
                <Select
                  value={selectedProjectCode}
                  onChange={(e) => setSelectedProjectCode(e.target.value)}
                  label="Project Code"
                >
                  <MenuItem value="">All Projects</MenuItem>
                  {filterOptions.projectCodes.map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small">
                <InputLabel>Vendor</InputLabel>
                <Select
                  value={selectedVendor}
                  onChange={(e) => setSelectedVendor(e.target.value)}
                  label="Vendor"
                >
                  <MenuItem value="">All Vendors</MenuItem>
                  {filterOptions.vendors.map((vendor) => (
                    <MenuItem key={vendor} value={vendor}>
                      {vendor}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small">
                <InputLabel>PO Number</InputLabel>
                <Select
                  value={selectedPONumber}
                  onChange={(e) => setSelectedPONumber(e.target.value)}
                  label="PO Number"
                >
                  <MenuItem value="">All POs</MenuItem>
                  {filterOptions.poNumbers.map((po) => (
                    <MenuItem key={po} value={po}>
                      {po}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small">
                <InputLabel>Page Size</InputLabel>
                <Select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  label="Page Size"
                >
                  <MenuItem value={10}>10 per page</MenuItem>
                  <MenuItem value={25}>25 per page</MenuItem>
                  <MenuItem value={50}>50 per page</MenuItem>
                  <MenuItem value={100}>100 per page</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="Start Date"
                  value={startDate}
                  onChange={setStartDate}
                  slotProps={{ textField: { fullWidth: true, size: "small" } }}
                />
              </LocalizationProvider>
            </Grid>
            <Grid item xs={12} sm={6} md={6}>
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <DatePicker
                  label="End Date"
                  value={endDate}
                  onChange={setEndDate}
                  minDate={startDate || undefined}
                  slotProps={{ textField: { fullWidth: true, size: "small" } }}
                />
              </LocalizationProvider>
            </Grid>
          </Grid>
        </Paper>
      </Collapse>

      {/* Active Filters Display */}
      {activeFiltersCount > 0 && (
        <Box sx={{ mb: 3 }}>
          <Stack direction="row" spacing={1} flexWrap="wrap">
            {searchTerm && (
              <Chip
                label={`Search: "${searchTerm}"`}
                onDelete={() => setSearchTerm("")}
                color="primary"
                variant="outlined"
              />
            )}
            {selectedProjectCode && (
              <Chip
                label={`Project: ${selectedProjectCode}`}
                onDelete={() => setSelectedProjectCode("")}
                color="primary"
                variant="outlined"
              />
            )}
            {selectedVendor && (
              <Chip
                label={`Vendor: ${selectedVendor}`}
                onDelete={() => setSelectedVendor("")}
                color="primary"
                variant="outlined"
              />
            )}
            {selectedPONumber && (
              <Chip
                label={`PO: ${selectedPONumber}`}
                onDelete={() => setSelectedPONumber("")}
                color="primary"
                variant="outlined"
              />
            )}
            {startDate && (
              <Chip
                label={`From: ${startDate.format("DD/MM/YYYY")}`}
                onDelete={() => setStartDate(null)}
                color="primary"
                variant="outlined"
              />
            )}
            {endDate && (
              <Chip
                label={`To: ${endDate.format("DD/MM/YYYY")}`}
                onDelete={() => setEndDate(null)}
                color="primary"
                variant="outlined"
              />
            )}
          </Stack>
        </Box>
      )}

      {/* Table */}
      <TableContainer component={Paper} sx={{ boxShadow: 2 }}>
        <Table>
          <TableHead sx={{ backgroundColor: "#f1f5f9" }}>
            <TableRow>
              <TableCell>
                <TableSortLabel
                  active={sortField === "invoice_number"}
                  direction={
                    sortField === "invoice_number" ? sortDirection : "asc"
                  }
                  onClick={() => handleSort("invoice_number")}
                  sx={{ fontWeight: 600 }}
                >
                  Invoice Number
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "po_number"}
                  direction={sortField === "po_number" ? sortDirection : "asc"}
                  onClick={() => handleSort("po_number")}
                  sx={{ fontWeight: 600 }}
                >
                  PO Number
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "invoice_date"}
                  direction={
                    sortField === "invoice_date" ? sortDirection : "asc"
                  }
                  onClick={() => handleSort("invoice_date")}
                  sx={{ fontWeight: 600 }}
                >
                  Invoice Date
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "vendor_name"}
                  direction={
                    sortField === "vendor_name" ? sortDirection : "asc"
                  }
                  onClick={() => handleSort("vendor_name")}
                  sx={{ fontWeight: 600 }}
                >
                  Vendor Name
                </TableSortLabel>
              </TableCell>
              <TableCell>Project Code</TableCell>
              <TableCell align="right">
                <TableSortLabel
                  active={sortField === "total_amount"}
                  direction={
                    sortField === "total_amount" ? sortDirection : "asc"
                  }
                  onClick={() => handleSort("total_amount")}
                  sx={{ fontWeight: 600 }}
                >
                  Amount (₹)
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              Array.from({ length: pageSize }).map((_, index) => (
                <TableRow key={index}>
                  {Array.from({ length: 7 }).map((_, cellIndex) => (
                    <TableCell key={cellIndex}>
                      <Skeleton variant="text" width="100%" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : paginatedData.results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No invoices found matching your criteria.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.results.map((invoice, index) => (
                <React.Fragment key={invoice.id}>
                  {/* Main Row */}
                  <TableRow
                    hover
                    sx={{
                      cursor: "pointer",
                      "&:hover": { backgroundColor: "#f8fafc" },
                    }}
                    onClick={() => handleRowClick(index)}
                  >
                    <TableCell sx={{ fontWeight: 500 }}>
                      {invoice.invoice_number}
                    </TableCell>
                    <TableCell sx={{ fontWeight: 500 }}>
                      {invoice.po_number}
                    </TableCell>
                    <TableCell>
                      {dayjs(invoice.invoice_date).format("DD/MM/YYYY")}
                    </TableCell>
                    <TableCell>{invoice.vendor_name}</TableCell>
                    <TableCell>{invoice.project_code}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      ₹
                      {invoice.total_amount.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="center"
                      >
                        {/* <Tooltip title="Preview Invoice">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              previewInvoice(invoice);
                            }}
                            sx={{ color: "#3b82f6" }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip> */}
                        <Tooltip title="Download Invoice">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              downloadInvoice(invoice);
                            }}
                            sx={{ color: "#10b981" }}
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRowClick(index);
                            }}
                            sx={{ color: "#6b7280" }}
                          >
                            {expandedRow === index ? (
                              <ExpandLessIcon fontSize="small" />
                            ) : (
                              <ExpandMoreIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>

                  {/* Expanded Row */}
                  <TableRow>
                    <TableCell colSpan={7} sx={{ p: 0, border: 0 }}>
                      <Collapse
                        in={expandedRow === index}
                        timeout="auto"
                        unmountOnExit
                      >
                        <Box
                          sx={{
                            p: 4,
                            background:
                              "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
                            borderTop: "3px solid #10b981",
                            position: "relative",
                          }}
                        >
                          {/* Header */}
                          <Box sx={{ mb: 4 }}>
                            <Typography
                              variant="h5"
                              sx={{
                                fontWeight: 700,
                                color: "#1e293b",
                                mb: 1,
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <ReceiptIcon color="primary" />
                              Invoice Details
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                              Complete information for Invoice:{" "}
                              {invoice.invoice_number}
                            </Typography>
                          </Box>

                          {/* Main Content Grid */}
                          <Grid container spacing={3}>
                            {/* Invoice Information */}
                            <Grid item xs={12} lg={6}>
                              <Card elevation={3} sx={{ height: "100%" }}>
                                <CardContent>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      mb: 3,
                                      fontWeight: 600,
                                      color: "#10b981",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <DescriptionIcon />
                                    Invoice Information
                                  </Typography>
                                  <Stack spacing={2.5}>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Invoice Number
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600, mt: 0.5 }}
                                      >
                                        {invoice.invoice_number}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Invoice Date
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {dayjs(invoice.invoice_date).format(
                                          "DD/MM/YYYY"
                                        )}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Total Amount
                                      </Typography>
                                      <Typography
                                        variant="h6"
                                        sx={{
                                          fontWeight: 700,
                                          color: "#059669",
                                          mt: 0.5,
                                        }}
                                      >
                                        ₹
                                        {invoice.total_amount.toLocaleString(
                                          "en-IN",
                                          {
                                            maximumFractionDigits: 2,
                                            minimumFractionDigits: 2,
                                          }
                                        )}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Created By
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {invoice.created_by || "System"}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Created Date
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {dayjs(invoice.created_at).format(
                                          "DD/MM/YYYY HH:mm"
                                        )}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Grid>

                            {/* Purchase Order Information */}
                            <Grid item xs={12} lg={6}>
                              <Card elevation={3} sx={{ height: "100%" }}>
                                <CardContent>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      mb: 3,
                                      fontWeight: 600,
                                      color: "#3b82f6",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <BusinessIcon />
                                    Purchase Order Details
                                  </Typography>
                                  <Stack spacing={2.5}>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                        }}
                                      >
                                        PO Number
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600, mt: 0.5 }}
                                      >
                                        {invoice.po_number}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Project Code
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {invoice.project_code}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Vendor Name
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 600, mt: 0.5 }}
                                      >
                                        {invoice.vendor_name}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Vendor Email
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {invoice.vendor_email || "N/A"}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                        }}
                                      >
                                        Vendor Contact
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {invoice.vendor_contact || "N/A"}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Grid>

                            {/* File Actions */}
                            <Grid item xs={12}>
                              <Card elevation={3}>
                                <CardContent>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      mb: 3,
                                      fontWeight: 600,
                                      color: "#7c3aed",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <AttachFileIcon />
                                    Invoice File
                                  </Typography>
                                  <Stack direction="row" spacing={2}>
                                    {/* <Button
                                      variant="outlined"
                                      startIcon={<VisibilityIcon />}
                                      onClick={() => previewInvoice(invoice)}
                                      sx={{
                                        borderColor: "#3b82f6",
                                        color: "#3b82f6",
                                        "&:hover": {
                                          borderColor: "#2563eb",
                                          backgroundColor:
                                            "rgba(59, 130, 246, 0.04)",
                                        },
                                      }}
                                    >
                                      Preview Invoice
                                    </Button> */}
                                    <Button
                                      variant="contained"
                                      startIcon={<FileDownloadIcon />}
                                      onClick={() => downloadInvoice(invoice)}
                                      sx={{
                                        bgcolor: "#10b981",
                                        "&:hover": { bgcolor: "#059669" },
                                      }}
                                    >
                                      Download Invoice
                                    </Button>
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Grid>
                          </Grid>
                        </Box>
                      </Collapse>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))
            )}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={7}>
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    py: 2,
                  }}
                >
                  <Typography variant="body2" color="text.secondary">
                    Showing {(currentPage - 1) * pageSize + 1} -{" "}
                    {Math.min(currentPage * pageSize, paginatedData.count)} of{" "}
                    {paginatedData.count.toLocaleString()} results
                  </Typography>
                  <Pagination
                    count={paginatedData.total_pages}
                    page={currentPage}
                    onChange={handlePageChange}
                    color="primary"
                    shape="rounded"
                    showFirstButton
                    showLastButton
                  />
                </Box>
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </TableContainer>

      {/* Preview Dialog */}
      <Dialog
        open={previewDialogOpen}
        onClose={() => setPreviewDialogOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <DescriptionIcon color="primary" />
          <Box>
            <Typography variant="h6" fontWeight={600}>
              Invoice Preview
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {selectedInvoice?.invoice_number} - {selectedInvoice?.po_number}
            </Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {selectedInvoice && (
            <Box sx={{ mt: 2 }}>
              <iframe
                src={`${configuration.api_url}download-invoice/${selectedInvoice.id}/`}
                width="100%"
                height="600px"
                style={{ border: "none", borderRadius: "8px" }}
                title="Invoice Preview"
              />
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, gap: 2 }}>
          <Button
            onClick={() => setPreviewDialogOpen(false)}
            variant="outlined"
            sx={{ borderRadius: 2 }}
          >
            Close
          </Button>
          {selectedInvoice && (
            <Button
              onClick={() => downloadInvoice(selectedInvoice)}
              variant="contained"
              startIcon={<FileDownloadIcon />}
              sx={{
                bgcolor: "#10b981",
                "&:hover": { bgcolor: "#059669" },
                borderRadius: 2,
              }}
            >
              Download
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InvoiceTracker;
