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
import axios from "axios";
import configuration from "../../../configuration";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDayjs } from "@mui/x-date-pickers/AdapterDayjs";
import dayjs, { Dayjs } from "dayjs";
import { debounce } from "lodash";
import POAnalyticsDashboard from "./POAnalyticsDashboard";
import { Fade } from "@mui/material";
import AssessmentIcon from "@mui/icons-material/Assessment";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
type POInwardStatus = "open" | "partially_inwarded" | "completed";
type POStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "ordered"
  | "delivered"
  | "cancelled";
type SortField =
  | "po_number"
  | "po_date"
  | "vendor_name"
  | "total_amount"
  | "inward_status"
  | "status";
type SortDirection = "asc" | "desc";

interface POLineItem {
  id: number;
  item_no: string;
  material_description: string;
  make: string;
  material_group: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  inwarded_quantity: number;
  already_inwarded: number;
  remaining_quantity: number;
  inward_status: POInwardStatus;
  expected_delivery?: string;
}

interface PurchaseOrderData {
  po_number: string;
  po_date: string;
  quote_ref_number: string | null;
  project_code: string;
  vendor_name: string;
  vendor_address: string;
  vendor_email: string | null;
  vendor_gstin: string | null;
  vendor_contact: string | null;
  vendor_payment_terms: string | null;
  total_amount: number;
  payment_terms: string;
  warranty_terms: string;
  delivery_schedule: string;
  dispatch_terms?: string;
  freight_terms?: string;
  tpi_terms: string;
  installation_terms: string;
  consignee_name: string | null;
  consignee_address: string | null;
  consignee_mobile: string | null;
  consignee_attention: string | null;
  invoice_name: string | null;
  invoice_address: string | null;
  invoice_gstin: string | null;
  status: string;
  notes: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  inward_status: POInwardStatus;
  total_inwarded_quantity: number;
  remaining_quantity?: number;
  approval_status: boolean;
  rejection_status: boolean;
  approval_date: string | null;
  approved_by: string | null;
  rejection_remarks: string | null;
  rejected_by: string | null;
  rejection_date: string | null;
  line_items: POLineItem[];
}

interface PaginatedResponse {
  results: PurchaseOrderData[];
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
  statuses: string[];
}

const POFilter: React.FC = () => {
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
    statuses: [],
  });
  const [loading, setLoading] = useState(false);
  // Analytics State
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProjectCode, setSelectedProjectCode] = useState("");
  const [selectedVendor, setSelectedVendor] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedInwardStatus, setSelectedInwardStatus] = useState<
    POInwardStatus | ""
  >("");
  const [startDate, setStartDate] = useState<Dayjs | null>(null);
  const [endDate, setEndDate] = useState<Dayjs | null>(null);

  // Sort States
  const [sortField, setSortField] = useState<SortField>("po_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  // Fetch filter options on component mount
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch data when filters or pagination change
  useEffect(() => {
    fetchPurchaseOrders();
  }, [
    currentPage,
    pageSize,
    sortField,
    sortDirection,
    selectedProjectCode,
    selectedVendor,
    selectedStatus,
    selectedInwardStatus,
    startDate,
    endDate,
  ]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      setCurrentPage(1); // Reset to first page on search
      fetchPurchaseOrders(term);
    }, 500),
    [
      currentPage,
      pageSize,
      sortField,
      sortDirection,
      selectedProjectCode,
      selectedVendor,
      selectedStatus,
      selectedInwardStatus,
      startDate,
      endDate,
    ]
  );

  useEffect(() => {
    if (searchTerm) {
      debouncedSearch(searchTerm);
    } else {
      fetchPurchaseOrders();
    }
    return () => {
      debouncedSearch.cancel();
    };
  }, [searchTerm, debouncedSearch]);

  const fetchFilterOptions = async () => {
    // This can be empty now since we set filter options in fetchPurchaseOrders
    // Or you can keep it as a fallback
    try {
      const response = await axios.get(
        `${configuration.api_url}/po-filter-options/`
      );
      if (response.data) {
        setFilterOptions(response.data);
      }
    } catch (error) {
      console.error("Error fetching filter options:", error);
      // Fallback will be set in fetchPurchaseOrders
    }
  };

  const fetchPurchaseOrders = async (search?: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        `${configuration.api_url}/project-codes-with-po-details/`
      );

      // Process and enrich data with inward status
      const enrichedPOs = await Promise.all(
        response.data.map(async (po: any) => {
          try {
            const statusResponse = await axios.get(
              `${configuration.api_url}/po-inward-status/${po.po_number}/`
            );
            return {
              ...po,
              inward_status: statusResponse.data?.status || "open",
              line_items:
                po.line_items?.map((item: any) => ({
                  ...item,
                  quantity: Number(item.quantity),
                  inwarded_quantity: Number(item.inwarded_quantity || 0),
                  already_inwarded: Number(item.already_inwarded || 0),
                })) || [],
            };
          } catch (error) {
            console.error(
              `Error fetching status for PO ${po.po_number}:`,
              error
            );
            return {
              ...po,
              inward_status: "open" as POInwardStatus,
              line_items:
                po.line_items?.map((item: any) => ({
                  ...item,
                  quantity: Number(item.quantity),
                  inwarded_quantity: Number(item.inwarded_quantity || 0),
                  already_inwarded: Number(item.already_inwarded || 0),
                })) || [],
            };
          }
        })
      );

      // Filter and sort data on the frontend
      let filteredPOs = enrichedPOs.filter((po) => {
        // First filter by approval_status
        if (po.approval_status !== true) return false;

        // Search filter (use the search parameter or current searchTerm)
        const searchQuery = search || searchTerm;
        const searchMatch =
          !searchQuery ||
          po.po_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
          po.vendor_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          po.project_code.toLowerCase().includes(searchQuery.toLowerCase());

        // Project code filter
        const projectMatch =
          !selectedProjectCode || po.project_code === selectedProjectCode;

        // Vendor filter
        const vendorMatch =
          !selectedVendor || po.vendor_name === selectedVendor;

        // Status filter
        const statusMatch = !selectedStatus || po.status === selectedStatus;

        // Inward status filter
        const inwardStatusMatch =
          !selectedInwardStatus || po.inward_status === selectedInwardStatus;

        // Date range filter
        const poDate = dayjs(po.po_date);
        const dateMatch =
          (!startDate || poDate.isAfter(startDate.subtract(1, "day"))) &&
          (!endDate || poDate.isBefore(endDate.add(1, "day")));

        return (
          searchMatch &&
          projectMatch &&
          vendorMatch &&
          statusMatch &&
          inwardStatusMatch &&
          dateMatch
        );
      });

      // Sort the filtered results
      filteredPOs.sort((a, b) => {
        let aValue: any = a[sortField];
        let bValue: any = b[sortField];

        // Handle different data types
        if (sortField === "po_date") {
          aValue = new Date(aValue).getTime();
          bValue = new Date(bValue).getTime();
        } else if (sortField === "total_amount") {
          aValue = Number(aValue);
          bValue = Number(bValue);
        } else if (typeof aValue === "string") {
          aValue = aValue.toLowerCase();
          bValue = bValue.toLowerCase();
        }

        if (sortDirection === "asc") {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // Implement client-side pagination
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const paginatedResults = filteredPOs.slice(startIndex, endIndex);

      setPaginatedData({
        results: paginatedResults,
        count: filteredPOs.length,
        next: endIndex < filteredPOs.length ? "next" : null,
        previous: startIndex > 0 ? "previous" : null,
        page_size: pageSize,
        current_page: currentPage,
        total_pages: Math.ceil(filteredPOs.length / pageSize),
      });

      // Update filter options based on all approved POs
      const approvedPOs = enrichedPOs.filter(
        (po) => po.approval_status === true
      );
      setFilterOptions({
        projectCodes: [
          ...new Set(approvedPOs.map((po) => po.project_code)),
        ].sort(),
        vendors: [...new Set(approvedPOs.map((po) => po.vendor_name))].sort(),
        statuses: [...new Set(approvedPOs.map((po) => po.status))].sort(),
      });
    } catch (error) {
      console.error("Error fetching purchase orders:", error);
      setError("Failed to fetch purchase orders. Please try again.");
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
    setCurrentPage(1); // Reset to first page when sorting
  };

  // Reset all filters
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedProjectCode("");
    setSelectedVendor("");
    setSelectedStatus("");
    setSelectedInwardStatus("");
    setStartDate(null);
    setEndDate(null);
    setSortField("po_date");
    setSortDirection("desc");
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    value: number
  ) => {
    setCurrentPage(value);
    setExpandedRow(null); // Close expanded rows when changing pages
  };

  // Toggle row expansion
  const handleRowClick = (index: number) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  // Get status styling
  const getStatusColor = (status: string) => {
    const normalizedStatus = status?.toLowerCase();
    switch (normalizedStatus) {
      case "pending_approval":
        return { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" };
      case "approved":
        return { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" };
      case "rejected":
        return { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" };
      case "ordered":
        return { color: "#3b82f6", bg: "rgba(59, 130, 246, 0.1)" };
      case "delivered":
        return { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" };
      case "cancelled":
        return { color: "#6b7280", bg: "rgba(107, 114, 128, 0.1)" };
      default:
        return { color: "#6b7280", bg: "rgba(107, 114, 128, 0.1)" };
    }
  };

  const getInwardStatusColor = (status: POInwardStatus | undefined) => {
    switch (status) {
      case "completed":
        return { color: "#00c853", bg: "rgba(0, 200, 83, 0.1)" };
      case "partially_inwarded":
        return { color: "#ff9800", bg: "rgba(255, 152, 0, 0.1)" };
      case "open":
        return { color: "#2196f3", bg: "rgba(33, 150, 243, 0.1)" };
      default:
        return { color: "#666", bg: "rgba(0, 0, 0, 0.1)" };
    }
  };

  const formatStatus = (status: string) => {
    return status.replace("_", " ").toUpperCase();
  };

  const formatInwardStatus = (status: POInwardStatus | undefined) => {
    if (!status) return "OPEN";
    return status.replace("_", " ").toUpperCase();
  };

  // Document preview
  const previewDocument = (poNumber: string) => {
    try {
      const previewUrl = `${configuration.api_url}/download-po/${poNumber}`;
      window.open(previewUrl, "_blank");
    } catch (error) {
      console.error("Error previewing document:", error);
      alert("Failed to preview the document. Please try again.");
    }
  };

  // Active filters count
  const activeFiltersCount = [
    searchTerm,
    selectedProjectCode,
    selectedVendor,
    selectedStatus,
    selectedInwardStatus,
    startDate,
    endDate,
  ].filter(Boolean).length;

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert
          severity="error"
          action={
            <Button onClick={() => fetchPurchaseOrders()} size="small">
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
            Purchase Orders
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {showAnalytics 
              ? "Analytics Dashboard" 
              : `${paginatedData.count.toLocaleString()} total purchase orders`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={2}>
          {!showAnalytics ? (
            <>
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
                onClick={() => fetchPurchaseOrders()}
                disabled={loading}
              >
                Refresh
              </Button>
            </>
          ) : (
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => setShowAnalytics(false)}
            >
              Back to Filter
            </Button>
          )}
          
          {/* Analytics Toggle Button */}
          <Button
            variant={showAnalytics ? "contained" : "outlined"}
            startIcon={<AssessmentIcon />}
            onClick={() => setShowAnalytics(!showAnalytics)}
            color={showAnalytics ? "primary" : "inherit"}
            sx={{
              background: showAnalytics 
                ? "linear-gradient(135deg, #667eea 0%, #764ba2 100%)"
                : "transparent",
              color: showAnalytics ? "white" : "inherit",
              "&:hover": {
                background: showAnalytics 
                  ? "linear-gradient(135deg, #764ba2 0%, #667eea 100%)"
                  : "rgba(102, 126, 234, 0.1)",
              },
              transition: "all 0.3s ease-in-out",
            }}
          >
            {showAnalytics ? "Analytics View" : "Analytics"}
          </Button>
        </Stack>
      </Box>
      {/* Conditional Content */}
      {showAnalytics ? (
        <Fade in={showAnalytics} timeout={500}>
          <div>
            <POAnalyticsDashboard />
          </div>
        </Fade>
      ) : (
        <Fade in={!showAnalytics} timeout={500}>
      <div>
      {/* Search Bar */}
      <Box sx={{ mb: 2 }}>
        <TextField
          fullWidth
          placeholder="Search by PO number, vendor name, or project code..."
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
                <InputLabel>Status</InputLabel>
                <Select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="pending_approval">Pending Approval</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="rejected">Rejected</MenuItem>
                  <MenuItem value="ordered">Ordered</MenuItem>
                  <MenuItem value="delivered">Delivered</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <FormControl fullWidth size="small">
                <InputLabel>Inward Status</InputLabel>
                <Select
                  value={selectedInwardStatus}
                  onChange={(e) =>
                    setSelectedInwardStatus(
                      e.target.value as POInwardStatus | ""
                    )
                  }
                  label="Inward Status"
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="partially_inwarded">
                    Partially Inwarded
                  </MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
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
            {selectedStatus && (
              <Chip
                label={`Status: ${formatStatus(selectedStatus)}`}
                onDelete={() => setSelectedStatus("")}
                color="primary"
                variant="outlined"
              />
            )}
            {selectedInwardStatus && (
              <Chip
                label={`Inward: ${formatInwardStatus(selectedInwardStatus)}`}
                onDelete={() => setSelectedInwardStatus("")}
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
                  active={sortField === "po_date"}
                  direction={sortField === "po_date" ? sortDirection : "asc"}
                  onClick={() => handleSort("po_date")}
                  sx={{ fontWeight: 600 }}
                >
                  PO Date
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
              {/* NEW: Version column */}
              <TableCell>Version</TableCell>
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
              <TableCell>
                <TableSortLabel
                  active={sortField === "inward_status"}
                  direction={
                    sortField === "inward_status" ? sortDirection : "asc"
                  }
                  onClick={() => handleSort("inward_status")}
                  sx={{ fontWeight: 600 }}
                >
                  Inward Status
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              // Loading skeleton
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
                    No purchase orders found matching your criteria.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              paginatedData.results.map((po, index) => (
                <React.Fragment key={po.po_number}>
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
                      {po.po_number}
                    </TableCell>
                    <TableCell>
                      {dayjs(po.po_date).format("DD/MM/YYYY")}
                    </TableCell>
                    <TableCell>{po.vendor_name}</TableCell>
                    <TableCell>{po.project_code}</TableCell>
                    {/* NEW: Version display; backend returns version as string */}
                    <TableCell>{po.version || "1.0"}</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 500 }}>
                      {po.total_amount.toLocaleString("en-IN", {
                        maximumFractionDigits: 2,
                        minimumFractionDigits: 2,
                      })}
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={formatInwardStatus(po.inward_status)}
                        size="small"
                        sx={{
                          backgroundColor: getInwardStatusColor(
                            po.inward_status
                          ).bg,
                          color: getInwardStatusColor(po.inward_status).color,
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="center"
                      >
                        <Button
                          variant="outlined"
                          size="small"
                          startIcon={<VisibilityIcon />}
                          onClick={(e) => {
                            e.stopPropagation();
                            previewDocument(po.po_number);
                          }}
                        >
                          View
                        </Button>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(index);
                          }}
                        >
                          {expandedRow === index ? (
                            <ExpandLessIcon />
                          ) : (
                            <ExpandMoreIcon />
                          )}
                        </IconButton>
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
                            borderTop: "3px solid #3b82f6",
                            position: "relative",
                          }}
                        >
                          {/* Status Badge */}
                          <Box
                            sx={{
                              position: "absolute",
                              top: 16,
                              right: 16,
                              display: "flex",
                              gap: 1,
                            }}
                          >
                            <Chip
                              label={`Approved by: ${
                                po.approved_by || "System"
                              }`}
                              size="small"
                              icon={<PersonIcon />}
                              sx={{
                                backgroundColor: "#dcfce7",
                                color: "#166534",
                                fontWeight: 500,
                              }}
                            />
                            <Chip
                              label={`Approved: ${dayjs(
                                po.approval_date
                              ).format("DD/MM/YYYY")}`}
                              size="small"
                              icon={<CalendarTodayIcon />}
                              sx={{
                                backgroundColor: "#dbeafe",
                                color: "#1e40af",
                                fontWeight: 500,
                              }}
                            />
                          </Box>

                          {/* Header with PO Summary */}
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
                              Purchase Order Details
                            </Typography>
                            <Typography variant="body1" color="text.secondary">
                              Complete information for PO: {po.po_number}
                            </Typography>
                          </Box>

                          {/* Main Content Grid */}
                          <Grid container spacing={3}>
                            {/* PO Basic Information */}
                            <Grid item xs={12} lg={4}>
                              <Card
                                elevation={3}
                                sx={{
                                  height: "100%",
                                  background:
                                    "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <CardContent>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      mb: 3,
                                      fontWeight: 600,
                                      color: "#1e40af",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <BusinessIcon />
                                    Order Information
                                  </Typography>
                                  <Stack spacing={2.5}>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Quote Reference
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.quote_ref_number || "N/A"}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Project Code
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.project_code}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
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
                                        {po.total_amount.toLocaleString(
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
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Created By
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.created_by || "System"}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Created Date
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {dayjs(po.created_at).format(
                                          "DD/MM/YYYY HH:mm"
                                        )}
                                      </Typography>
                                    </Box>
                                    {po.remaining_quantity && (
                                      <Box>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            color: "#64748b",
                                            textTransform: "uppercase",
                                            fontWeight: 600,
                                            letterSpacing: 0.5,
                                          }}
                                        >
                                          Remaining Quantity
                                        </Typography>
                                        <Typography
                                          variant="body2"
                                          sx={{
                                            fontWeight: 500,
                                            mt: 0.5,
                                            color:
                                              po.remaining_quantity > 0
                                                ? "#dc2626"
                                                : "#059669",
                                          }}
                                        >
                                          {po.remaining_quantity}
                                        </Typography>
                                      </Box>
                                    )}
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Grid>

                            {/* Vendor Information */}
                            <Grid item xs={12} lg={4}>
                              <Card
                                elevation={3}
                                sx={{
                                  height: "100%",
                                  background:
                                    "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
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
                                    <BusinessIcon />
                                    Vendor Details
                                  </Typography>
                                  <Stack spacing={2.5}>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Vendor Name
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontWeight: 600,
                                          mt: 0.5,
                                          color: "#1e293b",
                                        }}
                                      >
                                        {po.vendor_name}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                        }}
                                      >
                                        <LocationOnIcon fontSize="small" />
                                        Address
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontWeight: 400,
                                          mt: 0.5,
                                          lineHeight: 1.6,
                                        }}
                                      >
                                        {po.vendor_address}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                        }}
                                      >
                                        <EmailIcon fontSize="small" />
                                        Email
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.vendor_email || "N/A"}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                        }}
                                      >
                                        <PhoneIcon fontSize="small" />
                                        Contact
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.vendor_contact || "N/A"}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        GSTIN
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.vendor_gstin || "N/A"}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Payment Terms
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.vendor_payment_terms || "N/A"}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Grid>

                            {/* Terms & Conditions */}
                            <Grid item xs={12} lg={4}>
                              <Card
                                elevation={3}
                                sx={{
                                  height: "100%",
                                  background:
                                    "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <CardContent>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      mb: 3,
                                      fontWeight: 600,
                                      color: "#059669",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <SecurityIcon />
                                    Terms & Conditions
                                  </Typography>
                                  <Stack spacing={2.5}>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                        }}
                                      >
                                        <PaymentIcon fontSize="small" />
                                        Payment Terms
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.payment_terms}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Warranty Terms
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.warranty_terms}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.5,
                                        }}
                                      >
                                        <LocalShippingIcon fontSize="small" />
                                        Delivery Schedule
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.delivery_schedule}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Freight Terms
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.freight_terms || "N/A"}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        TPI Terms
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.tpi_terms}
                                      </Typography>
                                    </Box>
                                    <Box>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Installation Terms
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.installation_terms}
                                      </Typography>
                                    </Box>
                                  </Stack>
                                </CardContent>
                              </Card>
                            </Grid>

                            {/* Consignee Information */}
                            <Grid item xs={12} lg={6}>
                              <Card
                                elevation={3}
                                sx={{
                                  background:
                                    "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <CardContent>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      mb: 3,
                                      fontWeight: 600,
                                      color: "#dc2626",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <LocationOnIcon />
                                    Consignee Details
                                  </Typography>
                                  <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Consignee Name
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontWeight: 600,
                                          mt: 0.5,
                                          color: "#1e293b",
                                        }}
                                      >
                                        {po.consignee_name || "N/A"}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Consignee Address
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontWeight: 400,
                                          mt: 0.5,
                                          lineHeight: 1.6,
                                        }}
                                      >
                                        {po.consignee_address || "N/A"}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Contact Person
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.consignee_attention || "N/A"}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={6}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Mobile
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.consignee_mobile || "N/A"}
                                      </Typography>
                                    </Grid>
                                  </Grid>
                                </CardContent>
                              </Card>
                            </Grid>

                            {/* Invoice Information */}
                            <Grid item xs={12} lg={6}>
                              <Card
                                elevation={3}
                                sx={{
                                  background:
                                    "linear-gradient(145deg, #ffffff 0%, #f1f5f9 100%)",
                                  border: "1px solid #e2e8f0",
                                }}
                              >
                                <CardContent>
                                  <Typography
                                    variant="h6"
                                    sx={{
                                      mb: 3,
                                      fontWeight: 600,
                                      color: "#ea580c",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 1,
                                    }}
                                  >
                                    <ReceiptIcon />
                                    Invoice Details
                                  </Typography>
                                  <Grid container spacing={2}>
                                    <Grid item xs={12}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Invoice Name
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontWeight: 600,
                                          mt: 0.5,
                                          color: "#1e293b",
                                        }}
                                      >
                                        {po.invoice_name || "N/A"}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Invoice Address
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{
                                          fontWeight: 400,
                                          mt: 0.5,
                                          lineHeight: 1.6,
                                        }}
                                      >
                                        {po.invoice_address || "N/A"}
                                      </Typography>
                                    </Grid>
                                    <Grid item xs={12}>
                                      <Typography
                                        variant="caption"
                                        sx={{
                                          color: "#64748b",
                                          textTransform: "uppercase",
                                          fontWeight: 600,
                                          letterSpacing: 0.5,
                                        }}
                                      >
                                        Invoice GSTIN
                                      </Typography>
                                      <Typography
                                        variant="body2"
                                        sx={{ fontWeight: 500, mt: 0.5 }}
                                      >
                                        {po.invoice_gstin || "N/A"}
                                      </Typography>
                                    </Grid>
                                  </Grid>
                                </CardContent>
                              </Card>
                            </Grid>

                            {/* Notes Section */}
                            {po.notes && po.notes !== "NA" && (
                              <Grid item xs={12}>
                                <Card
                                  elevation={3}
                                  sx={{
                                    background:
                                      "linear-gradient(145deg, #fffbeb 0%, #fef3c7 100%)",
                                    border: "1px solid #f59e0b",
                                  }}
                                >
                                  <CardContent>
                                    <Typography
                                      variant="h6"
                                      sx={{
                                        mb: 2,
                                        fontWeight: 600,
                                        color: "#92400e",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: 1,
                                      }}
                                    >
                                      <NotesIcon />
                                      Notes
                                    </Typography>
                                    <Typography
                                      variant="body2"
                                      sx={{ fontWeight: 400, lineHeight: 1.6 }}
                                    >
                                      {po.notes}
                                    </Typography>
                                  </CardContent>
                                </Card>
                              </Grid>
                            )}
                          </Grid>

                          {/* Line Items Section */}
                          {po.line_items && po.line_items.length > 0 && (
                            <Box sx={{ mt: 4 }}>
                              <Typography
                                variant="h6"
                                sx={{
                                  mb: 3,
                                  fontWeight: 600,
                                  color: "#1e293b",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 1,
                                }}
                              >
                                <InventoryIcon />
                                Line Items ({po.line_items.length})
                              </Typography>
                              <TableContainer
                                component={Paper}
                                elevation={3}
                                sx={{
                                  borderRadius: 2,
                                  overflow: "hidden",
                                }}
                              >
                                <Table size="small">
                                  <TableHead
                                    sx={{
                                      background:
                                        "linear-gradient(145deg, #1e293b 0%, #334155 100%)",
                                    }}
                                  >
                                    <TableRow>
                                      <TableCell
                                        sx={{
                                          fontWeight: 700,
                                          color: "white",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Item No
                                      </TableCell>
                                      <TableCell
                                        sx={{
                                          fontWeight: 700,
                                          color: "white",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Description
                                      </TableCell>
                                      <TableCell
                                        sx={{
                                          fontWeight: 700,
                                          color: "white",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Make/Group
                                      </TableCell>
                                      <TableCell
                                        align="right"
                                        sx={{
                                          fontWeight: 700,
                                          color: "white",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Quantity
                                      </TableCell>
                                      <TableCell
                                        align="right"
                                        sx={{
                                          fontWeight: 700,
                                          color: "white",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Unit Price
                                      </TableCell>
                                      <TableCell
                                        align="right"
                                        sx={{
                                          fontWeight: 700,
                                          color: "white",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Total Price
                                      </TableCell>
                                      <TableCell
                                        align="right"
                                        sx={{
                                          fontWeight: 700,
                                          color: "white",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Inwarded
                                      </TableCell>
                                      <TableCell
                                        align="right"
                                        sx={{
                                          fontWeight: 700,
                                          color: "white",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Remaining
                                      </TableCell>
                                      <TableCell
                                        align="center"
                                        sx={{
                                          fontWeight: 700,
                                          color: "white",
                                          fontSize: "0.875rem",
                                        }}
                                      >
                                        Status
                                      </TableCell>
                                    </TableRow>
                                  </TableHead>
                                  <TableBody>
                                    {po.line_items.map((item, idx) => (
                                      <TableRow
                                        key={idx}
                                        sx={{
                                          "&:nth-of-type(odd)": {
                                            backgroundColor: "#f8fafc",
                                          },
                                          "&:hover": {
                                            backgroundColor: "#e2e8f0",
                                          },
                                        }}
                                      >
                                        <TableCell sx={{ fontWeight: 500 }}>
                                          {item.item_no}
                                        </TableCell>
                                        <TableCell>
                                          <Box>
                                            <Typography
                                              variant="body2"
                                              sx={{ fontWeight: 500 }}
                                            >
                                              {item.material_description}
                                            </Typography>
                                            {item.material_group && (
                                              <Chip
                                                label={item.material_group}
                                                size="small"
                                                sx={{
                                                  mt: 0.5,
                                                  fontSize: "0.75rem",
                                                  height: 20,
                                                }}
                                              />
                                            )}
                                          </Box>
                                        </TableCell>
                                        <TableCell>
                                          <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 500 }}
                                          >
                                            {item.make}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                          <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 600 }}
                                          >
                                            {item.quantity}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                          <Typography
                                            variant="body2"
                                            sx={{ fontWeight: 500 }}
                                          >
                                            ₹
                                            {item.unit_price.toLocaleString(
                                              "en-IN",
                                              {
                                                maximumFractionDigits: 2,
                                                minimumFractionDigits: 2,
                                              }
                                            )}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                          <Typography
                                            variant="body2"
                                            sx={{
                                              fontWeight: 600,
                                              color: "#059669",
                                            }}
                                          >
                                            ₹
                                            {item.total_price.toLocaleString(
                                              "en-IN",
                                              {
                                                maximumFractionDigits: 2,
                                                minimumFractionDigits: 2,
                                              }
                                            )}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                          <Typography
                                            variant="body2"
                                            sx={{
                                              fontWeight: 600,
                                              color: "#1e40af",
                                            }}
                                          >
                                            {item.inwarded_quantity}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="right">
                                          <Typography
                                            variant="body2"
                                            sx={{
                                              fontWeight: 600,
                                              color:
                                                item.remaining_quantity > 0
                                                  ? "#dc2626"
                                                  : "#059669",
                                            }}
                                          >
                                            {item.remaining_quantity}
                                          </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                          <Chip
                                            label={formatInwardStatus(
                                              item.inward_status
                                            )}
                                            size="small"
                                            sx={{
                                              backgroundColor:
                                                getInwardStatusColor(
                                                  item.inward_status
                                                ).bg,
                                              color: getInwardStatusColor(
                                                item.inward_status
                                              ).color,
                                              fontSize: "0.75rem",
                                              fontWeight: 600,
                                            }}
                                          />
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </TableContainer>
                            </Box>
                          )}
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
          </div>
        </Fade>
      )}
    </Box>
  );
};

export default POFilter;