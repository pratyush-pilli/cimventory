import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Chip,
  Button,
  TextField,
  Autocomplete,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stack,
  Avatar,
  LinearProgress,
  Collapse,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Badge,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Skeleton,
  Pagination,
  FormControlLabel,
  Switch,
  Tabs,
  Tab,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CardActions,
  CardHeader,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";

// Icons
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import InventoryIcon from "@mui/icons-material/Inventory";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import InfoIcon from "@mui/icons-material/Info";
import RefreshIcon from "@mui/icons-material/Refresh";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CategoryIcon from "@mui/icons-material/Category";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";
import TimelineIcon from "@mui/icons-material/Timeline";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import StorefrontIcon from "@mui/icons-material/Storefront";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import PieChartIcon from "@mui/icons-material/PieChart";

import axios from "axios";
import configuration from "../../../configuration";
import { Decimal } from "decimal.js";
import { debounce } from "lodash";

// Enhanced interfaces
interface LocationStock {
  total: number;
  allocated: number;
  available: number;
  outward: number;
  allocations: Array<{
    project_code: string;
    quantity: number;
    allocation_date: string;
    remarks: string;
  }>;
}

interface LocationStocks {
  [location: string]: LocationStock;
}

interface OutwardHistory {
  id: number;
  outward_date: string;
  quantity: number;
  location: string;
  project_code: string;
  document_type: string;
  document_number: string;
  status: string;
  outward_type: string;
}

interface ReturnableGatePassInfo {
  gate_pass_number: string;
  pass_type: string;
  issue_date: string;
  expected_return_date?: string;
  status: string;
  quantity: number;
  pending_quantity: number;
}

interface RejectedMaterialInfo {
  id: number;
  challan_number: string;
  client_name: string;
  return_date: string;
  reason_for_return: string;
  action_taken: string;
  quantity: number;
  condition: string;
  reason_details: string;
}

interface ItemDetailData {
  locationStocks: LocationStocks;
  outwardHistory: OutwardHistory[];
  returnableInfo: ReturnableGatePassInfo[];
  rejectedMaterials: RejectedMaterialInfo[];
  allocations: Array<{
    id: number;
    project_code: { code: string; name: string };
    allocated_quantity: number;
    allocation_date: string;
    status: string;
    location_allocations: Array<{
      location: string;
      quantity: number;
    }>;
  }>;
}

interface InventoryItem {
  id: number;
  material_group: string;
  item_no: string;
  description: string;
  make: string;
  total_stock: string;
  available_stock: string;
  allocated_stock: string;
  outward_stock: string;
  opening_stock: string;
  times_sq_stock: string;
  i_sq_stock: string;
  sakar_stock: string;
  pirana_stock: string;
  other_stock: string;
}

interface PaginatedResponse {
  results: InventoryItem[];
  count: number;
  next: string | null;
  previous: string | null;
  total_pages: number;
  current_page: number;
  page_size: number;
}

interface FilterOptions {
  material_groups: string[];
  makes: string[];
  locations: { value: string; label: string }[];
}

interface InventoryStats {
  total_items: number;
  low_stock_items: number;
  out_of_stock_items: number;
  available_stock_items: number;
  allocated_items: number;
  outward_items: number;
  stock_movement: number;
  location_distribution: {
    times_sq: number;
    i_sq: number;
    sakar: number;
    pirana: number;
    other: number;
  };
}

const LOCATION_DISPLAY_NAMES = {
  times_sq_stock: "Times Square",
  i_sq_stock: "iSquare",
  sakar_stock: "Sakar",
  pirana_stock: "Pirana",
  other_stock: "Other",
};

const InventoryForm: React.FC = () => {
  // State management
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [paginatedItems, setPaginatedItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedMaterialGroup, setSelectedMaterialGroup] = useState("");
  const [selectedMake, setSelectedMake] = useState("");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [itemDetails, setItemDetails] = useState<ItemDetailData | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info" as "success" | "error" | "info" | "warning",
  });
  const [viewMode, setViewMode] = useState<"card" | "table">("card");

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Computed values
  const materialGroups = useMemo(
    () =>
      [...new Set(allItems.map((item) => item.material_group))]
        .filter(Boolean)
        .sort(),
    [allItems]
  );

  const makes = useMemo(
    () =>
      [...new Set(allItems.map((item) => item.make))].filter(Boolean).sort(),
    [allItems]
  );

  const locations = [
    { value: "times_sq", label: "Times Square" },
    { value: "i_sq", label: "iSquare" },
    { value: "sakar", label: "Sakar" },
    { value: "pirana", label: "Pirana" },
    { value: "other", label: "Other" },
  ];

  // Statistics
  const stats = useMemo(() => {
    const totalItems = filteredItems.length;
    const lowStockItems = filteredItems.filter(
      (item) =>
        parseFloat(item.total_stock) < 10 && parseFloat(item.total_stock) > 0
    ).length;
    const outOfStockItems = filteredItems.filter(
      (item) => parseFloat(item.total_stock) === 0
    ).length;
    const availableStockItems = filteredItems.filter(
      (item) => parseFloat(item.available_stock) > 0
    ).length;
    const allocatedItems = filteredItems.reduce(
      (sum, item) => sum + parseFloat(item.allocated_stock || '0'),
      0
    );
    const outwardItems = filteredItems.reduce(
      (sum, item) => sum + parseFloat(item.outward_stock || '0'),
      0
    );
    const stockMovement = filteredItems.reduce(
      (sum, item) => sum + parseFloat(item.total_stock || '0'),
      0
    );
    const locationDistribution = {
      times_sq: filteredItems.reduce(
        (sum, item) => sum + parseFloat(item.times_sq_stock || '0'),
        0
      ),
      i_sq: filteredItems.reduce(
        (sum, item) => sum + parseFloat(item.i_sq_stock || '0'),
        0
      ),
      sakar: filteredItems.reduce(
        (sum, item) => sum + parseFloat(item.sakar_stock || '0'),
        0
      ),
      pirana: filteredItems.reduce(
        (sum, item) => sum + parseFloat(item.pirana_stock || '0'),
        0
      ),
      other: filteredItems.reduce(
        (sum, item) => sum + parseFloat(item.other_stock || '0'),
        0
      ),
    };

    return {
      total_items: totalItems,
      low_stock_items: lowStockItems,
      out_of_stock_items: outOfStockItems,
      available_stock_items: availableStockItems,
      allocated_items: allocatedItems,
      outward_items: outwardItems,
      stock_movement: stockMovement,
      location_distribution: locationDistribution,
    };
  }, [filteredItems]);

  // Debounced search
  const debouncedSetSearch = useCallback(
    debounce((value: string) => {
      setDebouncedSearchTerm(value);
      setCurrentPage(1);
    }, 300),
    []
  );

  useEffect(() => {
    debouncedSetSearch(searchTerm);
  }, [searchTerm, debouncedSetSearch]);

  // Fetch data from the existing API
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${configuration.api_url}inventory/`);

      // Transform data for display
      const transformedItems = response.data.map((item: any) => ({
        ...item,
        total_stock: new Decimal(item.total_stock || 0).toFixed(2),
        available_stock: new Decimal(item.available_stock || 0).toFixed(2),
        allocated_stock: new Decimal(item.allocated_stock || 0).toFixed(2),
        outward_stock: new Decimal(item.outward_stock || 0).toFixed(2),
        opening_stock: new Decimal(item.opening_stock || 0).toFixed(2),
        times_sq_stock: new Decimal(item.times_sq_stock || 0).toFixed(2),
        i_sq_stock: new Decimal(item.i_sq_stock || 0).toFixed(2),
        sakar_stock: new Decimal(item.sakar_stock || 0).toFixed(2),
        pirana_stock: new Decimal(item.pirana_stock || 0).toFixed(2),
        other_stock: new Decimal(item.other_stock || 0).toFixed(2),
      }));

      setAllItems(transformedItems);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setSnackbar({
        open: true,
        message: "Failed to fetch inventory data",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  // Client-side filtering and pagination
  useEffect(() => {
    let filtered = allItems.filter((item) => {
      const matchesSearch =
        !debouncedSearchTerm ||
        item.item_no
          ?.toLowerCase()
          .includes(debouncedSearchTerm.toLowerCase()) ||
        item.description
          ?.toLowerCase()
          .includes(debouncedSearchTerm.toLowerCase()) ||
        item.make?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
        item.material_group
          ?.toLowerCase()
          .includes(debouncedSearchTerm.toLowerCase());

      const matchesMaterialGroup =
        !selectedMaterialGroup || item.material_group === selectedMaterialGroup;

      const matchesMake = !selectedMake || item.make === selectedMake;

      const matchesLocation =
        !selectedLocation || parseFloat(item[`${selectedLocation}_stock`]) > 0;

      const matchesStockFilter = (() => {
        if (!stockFilter) return true;
        const total = parseFloat(item.total_stock);
        const available = parseFloat(item.available_stock);

        switch (stockFilter) {
          case "in_stock":
            return total > 0 && available > 0;
          case "low_stock":
            return total < 10 && total > 0;
          case "out_of_stock":
            return total === 0;
          default:
            return true;
        }
      })();

      return (
        matchesSearch &&
        matchesMaterialGroup &&
        matchesMake &&
        matchesLocation &&
        matchesStockFilter
      );
    });

    setFilteredItems(filtered);

    // Client-side pagination
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    setPaginatedItems(filtered.slice(startIndex, endIndex));
  }, [
    allItems,
    debouncedSearchTerm,
    selectedMaterialGroup,
    selectedMake,
    selectedLocation,
    stockFilter,
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle page change
  const handlePageChange = (
    event: React.ChangeEvent<unknown>,
    page: number
  ) => {
    setCurrentPage(page);
  };

  // Export function with client-side data
  

  const getStockStatus = (item: InventoryItem) => {
    const total = parseFloat(item.total_stock);
    const available = parseFloat(item.available_stock);

    if (total === 0)
      return {
        status: "out-of-stock",
        color: "error" as const,
        icon: WarningIcon,
      };
    if (total < 10)
      return {
        status: "low-stock",
        color: "warning" as const,
        icon: TrendingDownIcon,
      };
    if (available > 0)
      return {
        status: "in-stock",
        color: "success" as const,
        icon: CheckCircleIcon,
      };
    return {
      status: "allocated",
      color: "info" as const,
      icon: TrendingUpIcon,
    };
  };

  // Fetch detailed item information
  const fetchItemDetails = async (item: InventoryItem) => {
    setDetailsLoading(true);
    try {
      const [
        locationStocks,
        outwardHistory,
        returnableInfo,
        rejectedMaterials,
        allocations,
      ] = await Promise.all([
        axios.get(
          `${configuration.api_url}inventory/${item.id}/location-stock/`
        ),
        axios.get(
          `${configuration.api_url}inventory/${item.id}/outward-history/`
        ),
        axios.get(
          `${configuration.api_url}inventory/${item.id}/returnable-info/`
        ),
        axios.get(
          `${configuration.api_url}inventory/${item.id}/rejected-materials/`
        ),
        axios.get(
          `${configuration.api_url}allocations/?inventory_id=${item.id}`
        ),
      ]);

      setItemDetails({
        locationStocks: locationStocks.data,
        outwardHistory: outwardHistory.data.results || outwardHistory.data,
        returnableInfo: returnableInfo.data,
        rejectedMaterials: rejectedMaterials.data,
        allocations: allocations.data,
      });
    } catch (error) {
      console.error("Error fetching item details:", error);
      setSnackbar({
        open: true,
        message: "Failed to fetch item details",
        severity: "error",
      });
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleViewDetails = (item: InventoryItem) => {
    setSelectedItem(item);
    setDetailsOpen(true);
    setActiveTab(0);
    fetchItemDetails(item);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setDebouncedSearchTerm("");
    setSelectedMaterialGroup("");
    setSelectedMake("");
    setSelectedLocation("");
    setStockFilter("");
    setCurrentPage(1);
  };
  const exportToCsv = () => {
    try {
      const headers = [
        "Item No", "Description", "Make", "Material Group",
        "Total Stock", "Available Stock", "Allocated Stock", "Outward Stock",
        "Times Square", "iSquare", "Sakar", "Pirana", "Other"
      ];
  
      // Create CSV content
      let csvContent = headers.join(",") + "\n";
  
      filteredItems.forEach((item) => {
        const row = [
          `"${item.item_no || ''}"`,
          `"${item.description || ''}"`,
          `"${item.make || ''}"`,
          `"${item.material_group || ''}"`,
          item.total_stock || '0',
          item.available_stock || '0',
          item.allocated_stock || '0',
          item.outward_stock || '0',
          item.times_sq_stock || '0',
          item.i_sq_stock || '0',
          item.sakar_stock || '0',
          item.pirana_stock || '0',
          item.other_stock || '0'
        ];
        csvContent += row.join(",") + "\n";
      });
  
      // Create a download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      link.setAttribute("href", url);
      link.setAttribute("download", `inventory_export_${timestamp}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  
      setSnackbar({
        open: true,
        message: "Export completed successfully",
        severity: "success",
      });
    } catch (error) {
      console.error("Export failed:", error);
      setSnackbar({
        open: true,
        message: "Export failed",
        severity: "error",
      });
    }
  };
  const totalPages = Math.ceil(filteredItems.length / pageSize);

  // Loading skeleton
  const CardSkeleton = () => (
    <Grid container spacing={3}>
      {Array.from({ length: pageSize }).map((_, index) => (
        <Grid item xs={12} sm={6} md={4} lg={3} key={index}>
          <Card sx={{ height: 280 }}>
            <CardContent>
              <Skeleton variant="text" width="60%" height={28} />
              <Skeleton
                variant="text"
                width="100%"
                height={20}
                sx={{ mt: 1 }}
              />
              <Skeleton variant="text" width="80%" height={20} />
              <Skeleton
                variant="rectangular"
                height={60}
                sx={{ mt: 2, borderRadius: 1 }}
              />
              <Box
                sx={{ display: "flex", justifyContent: "space-between", mt: 2 }}
              >
                <Skeleton variant="circular" width={32} height={32} />
                <Skeleton
                  variant="rectangular"
                  width={80}
                  height={32}
                  sx={{ borderRadius: 1 }}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      ))}
    </Grid>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)",
        p: 3,
      }}
    >
      {/* Header with Stats */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Avatar
            sx={{
              background: "linear-gradient(45deg, #1e40af, #3b82f6)",
              width: 48,
              height: 48,
            }}
          >
            <InventoryIcon />
          </Avatar>
          <Box>
            <Typography variant="h4" fontWeight="700" sx={{ color: "#1e293b" }}>
              Smart Inventory Management
            </Typography>
            <Typography variant="subtitle1" color="text.secondary">
              Real-time inventory with {allItems.length.toLocaleString()} total
              items
            </Typography>
          </Box>
        </Stack>

        {/* Statistics Cards */}
        <Grid container spacing={2}>
          {/* Total Items Card */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              sx={{
                background: "linear-gradient(45deg, #3b82f6, #60a5fa)",
                color: "white",
                height: "100%",
                borderRadius: 2,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease-in-out',
                },
              }}
            >
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <InventoryIcon sx={{ fontSize: 36, mb: 1, opacity: 0.8 }} />
                <Typography variant="h6" fontWeight="600">
                  {stats.total_items.toLocaleString()}
                </Typography>
                <Typography variant="caption">Total Items</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Allocated Items Card */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              sx={{
                background: "linear-gradient(45deg, #8b5cf6, #a78bfa)",
                color: "white",
                height: "100%",
                borderRadius: 2,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease-in-out',
                },
              }}
            >
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <AssignmentIcon sx={{ fontSize: 36, mb: 1, opacity: 0.8 }} />
                <Typography variant="h6" fontWeight="600">
                  {stats.allocated_items.toLocaleString()}
                </Typography>
                <Typography variant="caption">Allocated Items</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Outward Items Card */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              sx={{
                background: "linear-gradient(45deg, #ec4899, #f472b6)",
                color: "white",
                height: "100%",
                borderRadius: 2,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease-in-out',
                },
              }}
            >
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <SwapHorizIcon sx={{ fontSize: 36, mb: 1, opacity: 0.8 }} />
                <Typography variant="h6" fontWeight="600">
                  {stats.outward_items.toLocaleString()}
                </Typography>
                <Typography variant="caption">Outward Items</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Stock Movement Card */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              sx={{
                background: "linear-gradient(45deg, #f59e0b, #fbbf24)",
                color: "white",
                height: "100%",
                borderRadius: 2,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease-in-out',
                },
              }}
            >
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <TimelineIcon sx={{ fontSize: 36, mb: 1, opacity: 0.8 }} />
                <Typography variant="h6" fontWeight="600">
                  {stats.stock_movement.toLocaleString()}
                </Typography>
                <Typography variant="caption">Stock Movement</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Location Distribution Card */}
          <Grid item xs={12} sm={6} md={2.4}>
            <Card
              sx={{
                background: "linear-gradient(45deg, #10b981, #34d399)",
                color: "white",
                height: "100%",
                borderRadius: 2,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease-in-out',
                },
              }}
            >
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <LocationOnIcon sx={{ fontSize: 36, mb: 1, opacity: 0.8 }} />
                <Typography variant="h6" fontWeight="600">
                  {Object.values(stats.location_distribution).reduce((a, b) => a + b, 0).toLocaleString()}
                </Typography>
                <Typography variant="caption">Total Items Across Locations</Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Location Distribution Details */}
        <Grid container spacing={2} sx={{ mt: 1, mb: 2 }}>
          {Object.entries({
            times_sq: 'Times Square',
            i_sq: 'iSquare',
            sakar: 'Sakar',
            pirana: 'Pirana',
            other: 'Other'
          }).map(([key, name]) => (
            <Grid item xs={6} sm={4} md={2.4} key={key}>
              <Card
                sx={{
                  background: 'rgba(255, 255, 255, 0.1)',
                  color: 'white',
                  height: '100%',
                  borderRadius: 2,
                  backdropFilter: 'blur(5px)',
                }}
              >
                <CardContent sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="subtitle2" fontWeight="500">
                    {name}
                  </Typography>
                  <Typography variant="body2">
                    {stats.location_distribution[key as keyof typeof stats.location_distribution].toLocaleString()}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Search and Filters */}
      <Paper
        sx={{
          p: 3,
          mb: 3,
          borderRadius: 3,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={2} alignItems="center">
            <TextField
              fullWidth
              placeholder="Search by item number, description, make, or material group..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon color="primary" />
                  </InputAdornment>
                ),
                sx: { borderRadius: 2 },
              }}
            />
            <Button
              variant={showFilters ? "contained" : "outlined"}
              onClick={() => setShowFilters(!showFilters)}
              startIcon={<FilterListIcon />}
              sx={{ minWidth: 120, borderRadius: 2 }}
            >
              Filters
            </Button>
            <Button
              variant="outlined"
              onClick={exportToCsv}
              startIcon={<FileDownloadIcon />}
              sx={{ minWidth: 120, borderRadius: 2 }}
              disabled={filteredItems.length === 0}
            >
              Export
            </Button>
            <FormControlLabel
              control={
                <Switch
                  checked={viewMode === "table"}
                  onChange={(e) =>
                    setViewMode(e.target.checked ? "table" : "card")
                  }
                />
              }
              label={
                viewMode === "table" ? <ViewListIcon /> : <ViewModuleIcon />
              }
            />
          </Stack>

          <Collapse in={showFilters}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={2.4}>
                <Autocomplete
                  options={materialGroups}
                  value={selectedMaterialGroup}
                  onChange={(_, value) => {
                    setSelectedMaterialGroup(value || "");
                    setCurrentPage(1);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Material Group"
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <CategoryIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <Autocomplete
                  options={makes}
                  value={selectedMake}
                  onChange={(_, value) => {
                    setSelectedMake(value || "");
                    setCurrentPage(1);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label="Make"
                      size="small"
                      InputProps={{
                        ...params.InputProps,
                        startAdornment: (
                          <InputAdornment position="start">
                            <BusinessIcon fontSize="small" />
                          </InputAdornment>
                        ),
                      }}
                    />
                  )}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Location</InputLabel>
                  <Select
                    value={selectedLocation}
                    onChange={(e) => {
                      setSelectedLocation(e.target.value);
                      setCurrentPage(1);
                    }}
                    label="Location"
                  >
                    <MenuItem value="">All Locations</MenuItem>
                    {locations.map((loc) => (
                      <MenuItem key={loc.value} value={loc.value}>
                        {loc.label}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <FormControl fullWidth size="small">
                  <InputLabel>Stock Status</InputLabel>
                  <Select
                    value={stockFilter}
                    onChange={(e) => {
                      setStockFilter(e.target.value);
                      setCurrentPage(1);
                    }}
                    label="Stock Status"
                  >
                    <MenuItem value="">All Stock</MenuItem>
                    <MenuItem value="in_stock">In Stock</MenuItem>
                    <MenuItem value="low_stock">Low Stock</MenuItem>
                    <MenuItem value="out_of_stock">Out of Stock</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid item xs={12} sm={6} md={2.4}>
                <Button
                  variant="outlined"
                  onClick={clearFilters}
                  fullWidth
                  sx={{ height: 40 }}
                >
                  Clear Filters
                </Button>
              </Grid>
            </Grid>

            <Box
              sx={{
                mt: 2,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="body2" color="text.secondary">
                Showing {paginatedItems.length} of{" "}
                {filteredItems.length.toLocaleString()} items
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2">Items per page:</Typography>
                <Select
                  size="small"
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  sx={{ minWidth: 70 }}
                >
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={20}>20</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                  <MenuItem value={100}>100</MenuItem>
                </Select>
              </Stack>
            </Box>
          </Collapse>
        </Stack>
      </Paper>

      {/* Content Area */}
      <Paper
        sx={{
          p: 3,
          borderRadius: 3,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(10px)",
          boxShadow: "0 8px 32px rgba(0,0,0,0.1)",
          minHeight: 600,
        }}
      >
        {loading ? (
          <CardSkeleton />
        ) : paginatedItems.length === 0 ? (
          // Empty State
          <Box sx={{ textAlign: "center", py: 8 }}>
            <InventoryIcon
              sx={{ fontSize: 64, color: "text.secondary", mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No inventory items found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Try adjusting your search criteria or filters
            </Typography>
            <Button variant="outlined" onClick={clearFilters}>
              Clear Filters
            </Button>
          </Box>
        ) : viewMode === "card" ? (
          // Card View
          <Grid container spacing={3}>
            {paginatedItems.map((item) => {
              const stockStatus = getStockStatus(item);
              const StatusIcon = stockStatus.icon;

              return (
                <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
                  <Card
                    sx={{
                      height: "100%",
                      borderRadius: 2,
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
                      },
                    }}
                  >
                    <CardContent
                      sx={{
                        p: 2.5,
                        height: "100%",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      {/* Header */}
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="flex-start"
                        sx={{ mb: 2 }}
                      >
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Typography variant="h6" fontWeight="600" noWrap>
                            {item.item_no}
                          </Typography>
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            noWrap
                          >
                            {item.material_group}
                          </Typography>
                        </Box>
                        <Chip
                          icon={<StatusIcon fontSize="small" />}
                          label={stockStatus.status.replace("-", " ")}
                          color={stockStatus.color}
                          size="small"
                          sx={{ textTransform: "capitalize" }}
                        />
                      </Stack>

                      {/* Description */}
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mb: 2,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden",
                          minHeight: 40,
                        }}
                      >
                        {item.description}
                      </Typography>

                      {/* Stock Information */}
                      <Box sx={{ mb: 2, flex: 1 }}>
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          sx={{ mb: 1 }}
                        >
                          <Typography variant="body2">Total Stock</Typography>
                          <Typography variant="body2" fontWeight="600">
                            {item.total_stock}
                          </Typography>
                        </Stack>
                        <LinearProgress
                          variant="determinate"
                          value={Math.min(
                            100,
                            (parseFloat(item.available_stock) /
                              Math.max(1, parseFloat(item.total_stock))) *
                              100
                          )}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: "grey.200",
                          }}
                        />
                        <Stack
                          direction="row"
                          justifyContent="space-between"
                          sx={{ mt: 1 }}
                        >
                          <Typography variant="caption">
                            Available: {item.available_stock}
                          </Typography>
                          <Typography variant="caption">
                            Allocated: {item.allocated_stock}
                          </Typography>
                        </Stack>
                      </Box>

                      {/* Actions */}
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                      >
                        <Typography variant="caption" color="text.secondary">
                          Make: {item.make}
                        </Typography>
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleViewDetails(item)}
                          startIcon={<InfoIcon />}
                          sx={{ borderRadius: 2 }}
                        >
                          Details
                        </Button>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        ) : (
          // Table View
          <TableContainer>
            <Table stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell>Item No</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Material Group</TableCell>
                  <TableCell>Make</TableCell>
                  <TableCell align="right">Total Stock</TableCell>
                  <TableCell align="right">Available</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedItems.map((item) => {
                  const stockStatus = getStockStatus(item);
                  const StatusIcon = stockStatus.icon;

                  return (
                    <TableRow key={item.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontWeight="600">
                          {item.item_no}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Tooltip title={item.description}>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{ maxWidth: 200 }}
                          >
                            {item.description}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>{item.material_group}</TableCell>
                      <TableCell>{item.make}</TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" fontWeight="600">
                          {item.total_stock}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="success.main">
                          {item.available_stock}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          icon={<StatusIcon fontSize="small" />}
                          label={stockStatus.status.replace("-", " ")}
                          color={stockStatus.color}
                          size="small"
                          sx={{ textTransform: "capitalize" }}
                        />
                      </TableCell>
                      <TableCell align="center">
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(item)}
                          color="primary"
                        >
                          <InfoIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        )}

        {/* Pagination */}
        {!loading && paginatedItems.length > 0 && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              mt: 3,
              pt: 2,
              borderTop: "1px solid #e0e0e0",
            }}
          >
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={handlePageChange}
              color="primary"
              size="large"
              showFirstButton
              showLastButton
              siblingCount={2}
              boundaryCount={1}
            />
          </Box>
        )}
      </Paper>

      {/* Details Dialog */}
      {selectedItem && (
        <DetailsDialog
          open={detailsOpen}
          onClose={() => setDetailsOpen(false)}
          item={selectedItem}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={snackbar.severity}
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

// Simplified Details Dialog using existing API
const DetailsDialog: React.FC<{
  open: boolean;
  onClose: () => void;
  item: InventoryItem | null;
}> = ({ open, onClose, item }) => {
  if (!item) return null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
          background: "linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)",
        },
      }}
    >
      <DialogTitle
        sx={{
          background: "linear-gradient(45deg, #667eea, #764ba2)",
          color: "white",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight="600">
            {item.item_no}
          </Typography>
          <Typography variant="body2" sx={{ opacity: 0.9 }}>
            {item.description}
          </Typography>
        </Box>
        <IconButton onClick={onClose} sx={{ color: "white" }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Stock Summary Cards */}
          <Grid item xs={12}>
            <Grid container spacing={2}>
              {[
                {
                  title: "Total Stock",
                  value: item.total_stock,
                  color: "#2196F3",
                },
                {
                  title: "Available",
                  value: item.available_stock,
                  color: "#4CAF50",
                },
                {
                  title: "Allocated",
                  value: item.allocated_stock,
                  color: "#FF9800",
                },
                {
                  title: "Outward",
                  value: item.outward_stock,
                  color: "#f44336",
                },
              ].map((stat, index) => (
                <Grid item xs={12} sm={6} md={3} key={index}>
                  <Card
                    sx={{
                      background: `linear-gradient(45deg, ${stat.color}, ${stat.color}dd)`,
                      color: "white",
                      borderRadius: 2,
                    }}
                  >
                    <CardContent sx={{ textAlign: "center", py: 2 }}>
                      <Typography variant="h5" fontWeight="600">
                        {stat.value}
                      </Typography>
                      <Typography variant="body2" sx={{ opacity: 0.9 }}>
                        {stat.title}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>

          {/* Location-wise Stock */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography
                  variant="h6"
                  gutterBottom
                  sx={{ display: "flex", alignItems: "center" }}
                >
                  <LocationOnIcon sx={{ mr: 1 }} />
                  Location-wise Stock Distribution
                </Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Location</TableCell>
                        <TableCell align="right">Stock</TableCell>
                        <TableCell align="center">Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {Object.entries(LOCATION_DISPLAY_NAMES).map(
                        ([key, name]) => {
                          const stockValue = parseFloat(
                            item[key as keyof InventoryItem] as string
                          );
                          return (
                            <TableRow key={key}>
                              <TableCell>{name}</TableCell>
                              <TableCell align="right">
                                <Typography
                                  variant="body2"
                                  fontWeight={stockValue > 0 ? 600 : 400}
                                  color={
                                    stockValue > 0
                                      ? "primary.main"
                                      : "text.secondary"
                                  }
                                >
                                  {stockValue.toFixed(2)}
                                </Typography>
                              </TableCell>
                              <TableCell align="center">
                                <Chip
                                  label={stockValue > 0 ? "Available" : "Empty"}
                                  size="small"
                                  color={stockValue > 0 ? "success" : "default"}
                                />
                              </TableCell>
                            </TableRow>
                          );
                        }
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </CardContent>
            </Card>
          </Grid>

          {/* Item Information */}
          <Grid item xs={12}>
            <Card sx={{ borderRadius: 2 }}>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Item Information
                </Typography>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Material Group
                    </Typography>
                    <Typography variant="body1" fontWeight="600">
                      {item.material_group}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Typography variant="body2" color="text.secondary">
                      Make
                    </Typography>
                    <Typography variant="body1" fontWeight="600">
                      {item.make}
                    </Typography>
                  </Grid>
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary">
                      Description
                    </Typography>
                    <Typography variant="body1">{item.description}</Typography>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </DialogContent>
    </Dialog>
  );
};

// Re-export the enhanced inventory component
import EnhancedInventory from "./EnhancedInventory";
export default EnhancedInventory;
