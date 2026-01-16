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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  InputAdornment,
  Pagination,
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
  FormControlLabel,
  Switch,
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
import LocationOnIcon from "@mui/icons-material/LocationOn";
import CategoryIcon from "@mui/icons-material/Category";
import BusinessIcon from "@mui/icons-material/Business";
import CloseIcon from "@mui/icons-material/Close";
import TimelineIcon from "@mui/icons-material/Timeline";
import AssignmentIcon from "@mui/icons-material/Assignment";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import ReportProblemIcon from "@mui/icons-material/ReportProblem";
import LocalShippingIcon from "@mui/icons-material/LocalShipping";
import StorefrontIcon from "@mui/icons-material/Storefront";
import AccountBalanceIcon from "@mui/icons-material/AccountBalance";
import PieChartIcon from "@mui/icons-material/PieChart";
import ViewListIcon from "@mui/icons-material/ViewList";
import ViewModuleIcon from "@mui/icons-material/ViewModule";

import axios from "axios";
import configuration from "../../../configuration";
import { Decimal } from "decimal.js";

// Professional color palette
const colors = {
  primary: {
    main: "#1e40af",
    light: "#3b82f6",
    dark: "#1e3a8a",
  },
  success: {
    main: "#10b981",
    light: "#34d399",
    dark: "#059669",
  },
  warning: {
    main: "#f59e0b",
    light: "#fbbf24",
    dark: "#d97706",
  },
  error: {
    main: "#ef4444",
    light: "#f87171",
    dark: "#dc2626",
  },
  info: {
    main: "#0ea5e9",
    light: "#38bdf8",
    dark: "#0284c7",
  },
  neutral: {
    50: "#f8fafc",
    100: "#f1f5f9",
    200: "#e2e8f0",
    300: "#cbd5e1",
    400: "#94a3b8",
    500: "#64748b",
    600: "#475569",
    700: "#334155",
    800: "#1e293b",
    900: "#0f172a",
  },
};

// Interfaces
interface InventoryItem {
  id: number;
  material_group: string;
  item_no: string;
  description: string;
  make: string;
  opening_stock: string;
  allocated_stock: string;
  available_stock: string;
  total_stock: string;
  outward_stock: string;
  times_sq_stock: string;
  i_sq_stock: string;
  sakar_stock: string;
  pirana_stock: string;
  other_stock: string;
  remarks: string;
  inward_entry_id: number;
}

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

interface ItemDetailData {
  locationStocks: LocationStocks;
  outwardHistory: OutwardHistory[];
  returnableInfo: any[];
  rejectedMaterials: any[];
  allocations: any[];
}

const LOCATION_DISPLAY_NAMES = {
  "Times Square": "Times Square",
  iSquare: "iSquare",
  Sakar: "Sakar",
  Pirana: "Pirana",
  Other: "Other",
};

const EnhancedInventory: React.FC = () => {
  // State management
  const [allItems, setAllItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [paginatedItems, setPaginatedItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
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
  const [showCategorized, setShowCategorized] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedMetric, setSelectedMetric] = useState("");

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

  // Material group categorization
  const categorizedItems = useMemo(() => {
    const grouped = filteredItems.reduce((acc, item) => {
      const group = item.material_group || "Uncategorized";
      if (!acc[group]) {
        acc[group] = [];
      }
      acc[group].push(item);
      return acc;
    }, {} as Record<string, InventoryItem[]>);
    return grouped;
  }, [filteredItems]);

  // Statistics with inventory value
  const stats = useMemo(() => {
    const totalItems = filteredItems.length;
    const lowStockItems = filteredItems.filter(
      (item) =>
        parseFloat(item.total_stock) < 10 && parseFloat(item.total_stock) > 0
    ).length;
    const outOfStockItems = filteredItems.filter(
      (item) => parseFloat(item.total_stock) === 0
    ).length;

    // Calculate inventory value (placeholder calculation - will be updated when prices are added)
    const inventoryValue = filteredItems.reduce((total, item) => {
      // For now, using a placeholder value of ₹100 per unit
      // This will be replaced with actual item.unit_price when available
      const placeholderPrice = 100;
      return total + parseFloat(item.total_stock) * placeholderPrice;
    }, 0);

    const allocatedItems = filteredItems.reduce((total, item) => {
      return total + parseFloat(item.allocated_stock);
    }, 0);

    const outwardItems = filteredItems.reduce((total, item) => {
      return total + parseFloat(item.outward_stock);
    }, 0);

    const stockMovement = filteredItems.reduce((total, item) => {
      return total + parseFloat(item.total_stock);
    }, 0);

    const locationDistribution = filteredItems.reduce(
      (acc, item) => {
        acc.times_sq = (acc.times_sq || 0) + parseFloat(item.times_sq_stock || '0');
        acc.i_sq = (acc.i_sq || 0) + parseFloat(item.i_sq_stock || '0');
        acc.sakar = (acc.sakar || 0) + parseFloat(item.sakar_stock || '0');
        acc.pirana = (acc.pirana || 0) + parseFloat(item.pirana_stock || '0');
        acc.other = (acc.other || 0) + parseFloat(item.other_stock || '0');
        return acc;
      },
      { times_sq: 0, i_sq: 0, sakar: 0, pirana: 0, other: 0 }
    );

    return {
      total_items: totalItems,
      low_stock_items: lowStockItems,
      out_of_stock_items: outOfStockItems,
      inventory_value: inventoryValue,
      allocated_items: allocatedItems,
      outward_items: outwardItems,
      stock_movement: stockMovement,
      location_distribution: locationDistribution,
    };
  }, [filteredItems]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${configuration.api_url}inventory/`);

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

  // Filtering and pagination
  useEffect(() => {
    let filtered = allItems.filter((item) => {
      const matchesSearch =
        !searchTerm ||
        item.item_no?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.material_group?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesMaterialGroup =
        !selectedMaterialGroup || item.material_group === selectedMaterialGroup;

      const matchesMake = !selectedMake || item.make === selectedMake;

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
        matchesStockFilter
      );
    });

    setFilteredItems(filtered);

    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    setPaginatedItems(filtered.slice(startIndex, endIndex));
  }, [
    allItems,
    searchTerm,
    selectedMaterialGroup,
    selectedMake,
    stockFilter,
    currentPage,
    pageSize,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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

  const handleViewDetails = (item: InventoryItem) => {
    setSelectedItem(item);
    setDetailsOpen(true);
    setActiveTab(0);
    fetchItemDetails(item);
  };

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedMaterialGroup("");
    setSelectedMake("");
    setStockFilter("");
    setCurrentPage(1);
  };

  const exportToCsv = () => {
    try {
      const headers = [
        "ID", "Item No", "Description", "Make", "Material Group",
        "Opening Stock", "Total Stock", "Available Stock", "Allocated Stock", "Outward Stock",
        "Times Square", "iSquare", "Sakar", "Pirana", "Other",
        "Remarks", "Inward Entry ID"
      ];
  
      // Create CSV content
      let csvContent = headers.join(",") + "\n";
  
      filteredItems.forEach((item) => {
        const row = [
          item.id || '',
          `"${item.item_no || ''}"`,
          `"${item.description || ''}"`,
          `"${item.make || ''}"`,
          `"${item.material_group || ''}"`,
          item.opening_stock || '0',
          item.total_stock || '0',
          item.available_stock || '0',
          item.allocated_stock || '0',
          item.outward_stock || '0',
          item.times_sq_stock || '0',
          item.i_sq_stock || '0',
          item.sakar_stock || '0',
          item.pirana_stock || '0',
          item.other_stock || '0',
          `"${item.remarks || ''}"`,
          item.inward_entry_id || ''
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

  // Tab panel component
  const TabPanel = ({
    children,
    value,
    index,
  }: {
    children: React.ReactNode;
    value: number;
    index: number;
  }) => (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );

  return (
    <Box
      sx={{
        minHeight: "100vh",
        background: `linear-gradient(135deg, ${colors.neutral[50]} 0%, ${colors.neutral[100]} 100%)`,
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
          boxShadow: `0 8px 32px ${colors.neutral[300]}40`,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 3 }}>
          <Avatar
            sx={{
              background: `linear-gradient(45deg, ${colors.primary.main}, ${colors.primary.light})`,
              width: 48,
              height: 48,
            }}
          >
            <InventoryIcon sx={{ color: "white" }} />
          </Avatar>
          <Box>
            <Typography
              variant="h4"
              fontWeight="700"
              sx={{ color: colors.neutral[800] }}
            >
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
          <Grid item xs={12} sm={6} md={1.714}>
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
              onClick={() => {
                setSelectedMaterialGroup("");
                setSelectedMake("");
                setStockFilter("");
                setCurrentPage(1);
                setSelectedMetric("total_items");
                setShowDetails(true);
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

          {/* Low Stock Card */}
          <Grid item xs={12} sm={6} md={1.714}>
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
              onClick={() => {
                setStockFilter("low_stock");
                setCurrentPage(1);
                setSelectedMetric("low_stock");
                setShowDetails(true);
              }}
            >
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <TrendingDownIcon sx={{ fontSize: 36, mb: 1, opacity: 0.8 }} />
                <Typography variant="h6" fontWeight="600">
                  {stats.low_stock_items.toLocaleString()}
                </Typography>
                <Typography variant="caption">Low Stock</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Out of Stock Card */}
          <Grid item xs={12} sm={6} md={1.714}>
            <Card
              sx={{
                background: "linear-gradient(45deg, #f44336, #d32f2f)",
                color: "white",
                height: "100%",
                borderRadius: 2,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease-in-out',
                },
              }}
              onClick={() => {
                setStockFilter("out_of_stock");
                setCurrentPage(1);
                setSelectedMetric("out_of_stock");
                setShowDetails(true);
              }}
            >
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <WarningIcon sx={{ fontSize: 36, mb: 1, opacity: 0.8 }} />
                <Typography variant="h6" fontWeight="600">
                  {stats.out_of_stock_items.toLocaleString()}
                </Typography>
                <Typography variant="caption">Out of Stock</Typography>
              </CardContent>
            </Card>
          </Grid>

          {/* Allocated Items Card */}
          <Grid item xs={12} sm={6} md={1.714}>
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
              onClick={() => {
                setSelectedMaterialGroup("");
                setSelectedMake("");
                setStockFilter("");
                setCurrentPage(1);
                setSelectedMetric("allocated_items");
                setShowDetails(true);
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
          <Grid item xs={12} sm={6} md={1.714}>
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
              onClick={() => {
                setSelectedMaterialGroup("");
                setSelectedMake("");
                setStockFilter("");
                setCurrentPage(1);
                setSelectedMetric("outward_items");
                setShowDetails(true);
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
          <Grid item xs={12} sm={6} md={1.714}>
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
              onClick={() => {
                setSelectedMaterialGroup("");
                setSelectedMake("");
                setStockFilter("");
                setCurrentPage(1);
                setSelectedMetric("stock_movement");
                setShowDetails(true);
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
          <Grid item xs={12} sm={6} md={1.714}>
            <Card
              sx={{
                background: "linear-gradient(45deg, #06b6d4, #22d3ee)",
                color: "white",
                height: "100%",
                borderRadius: 2,
                '&:hover': {
                  transform: 'translateY(-4px)',
                  transition: 'transform 0.3s ease-in-out',
                },
              }}
              onClick={() => {
                setSelectedMaterialGroup("");
                setSelectedMake("");
                setStockFilter("");
                setCurrentPage(1);
                setSelectedMetric("location_distribution");
                setShowDetails(true);
              }}
            >
              <CardContent sx={{ textAlign: "center", py: 1.5 }}>
                <LocationOnIcon sx={{ fontSize: 36, mb: 1, opacity: 0.8 }} />
                <Typography variant="h6" fontWeight="600">
                  {Object.values(stats.location_distribution || {}).reduce((a, b) => a + b, 0).toLocaleString()}
                </Typography>
                <Typography variant="caption">Quantity Across Locations</Typography>
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
          boxShadow: `0 8px 32px ${colors.neutral[300]}40`,
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
                    <SearchIcon sx={{ color: colors.primary.main }} />
                  </InputAdornment>
                ),
                sx: { borderRadius: 2 },
              }}
            />
            <Button
              variant={showFilters ? "contained" : "outlined"}
              onClick={() => setShowFilters(!showFilters)}
              startIcon={<FilterListIcon />}
              sx={{
                minWidth: 120,
                borderRadius: 2,
                backgroundColor: showFilters
                  ? colors.primary.main
                  : "transparent",
              }}
            >
              Filters
            </Button>
            <Button
              variant="outlined"
              onClick={() => exportToCsv()}
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
            <FormControlLabel
              control={
                <Switch
                  checked={showCategorized}
                  onChange={(e) => setShowCategorized(e.target.checked)}
                />
              }
              label={
                <Stack direction="row" alignItems="center" spacing={1}>
                  <CategoryIcon />
                  <Typography variant="body2">Categorize</Typography>
                </Stack>
              }
            />
          </Stack>

          {showFilters && (
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
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
              <Grid item xs={12} sm={6} md={3}>
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
              <Grid item xs={12} sm={6} md={3}>
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
              <Grid item xs={12} sm={6} md={3}>
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
          )}

          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="body2" color="text.secondary">
              Showing {paginatedItems.length} of{" "}
              {filteredItems.length.toLocaleString()} items
            </Typography>
          </Box>
        </Stack>
      </Paper>

      {/* Content Area */}
      <Paper
        sx={{
          p: 3,
          borderRadius: 3,
          background: "rgba(255,255,255,0.95)",
          backdropFilter: "blur(10px)",
          boxShadow: `0 8px 32px ${colors.neutral[300]}40`,
          minHeight: 600,
        }}
      >
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
            <CircularProgress size={60} sx={{ color: colors.primary.main }} />
          </Box>
        ) : paginatedItems.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 8 }}>
            <InventoryIcon
              sx={{ fontSize: 64, color: colors.neutral[400], mb: 2 }}
            />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No inventory items found
            </Typography>
            <Button variant="outlined" onClick={clearFilters}>
              Clear Filters
            </Button>
          </Box>
        ) : showCategorized ? (
          // Categorized View
          <Box>
            {Object.entries(categorizedItems).map(([group, items]) => (
              <Accordion key={group} defaultExpanded sx={{ mb: 2 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Stack direction="row" alignItems="center" spacing={2}>
                    <CategoryIcon sx={{ color: colors.primary.main }} />
                    <Typography variant="h6" fontWeight="600">
                      {group}
                    </Typography>
                    <Chip
                      label={`${items.length} items`}
                      size="small"
                      color="primary"
                    />
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Grid container spacing={2}>
                    {items.slice(0, 12).map((item) => {
                      const stockStatus = getStockStatus(item);
                      const StatusIcon = stockStatus.icon;

                      return (
                        <Grid item xs={12} sm={6} md={4} lg={3} key={item.id}>
                          <Card
                            sx={{
                              height: "100%",
                              borderRadius: 2,
                              border: `1px solid ${colors.neutral[200]}`,
                              transition: "all 0.3s ease",
                              cursor: "pointer",
                              "&:hover": {
                                transform: "translateY(-2px)",
                                boxShadow: `0 8px 25px ${colors.neutral[400]}40`,
                                borderColor: colors.primary.light,
                              },
                            }}
                            onClick={() => handleViewDetails(item)}
                          >
                            <CardHeader
                              avatar={
                                <Avatar sx={{ bgcolor: colors.neutral[100] }}>
                                  <InventoryIcon
                                    sx={{ color: colors.neutral[600] }}
                                  />
                                </Avatar>
                              }
                              action={
                                <Chip
                                  icon={<StatusIcon fontSize="small" />}
                                  label={stockStatus.status.replace("-", " ")}
                                  color={stockStatus.color}
                                  size="small"
                                  sx={{ textTransform: "capitalize" }}
                                />
                              }
                              title={
                                <Typography
                                  variant="subtitle2"
                                  fontWeight="600"
                                  noWrap
                                >
                                  {item.item_no}
                                </Typography>
                              }
                              subheader={
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  noWrap
                                >
                                  {item.make}
                                </Typography>
                              }
                            />
                            <CardContent sx={{ pt: 0 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  display: "-webkit-box",
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical",
                                  overflow: "hidden",
                                  minHeight: 32,
                                  fontSize: "0.75rem",
                                }}
                              >
                                {item.description}
                              </Typography>
                              <Stack
                                direction="row"
                                justifyContent="space-between"
                                sx={{ mt: 1 }}
                              >
                                <Typography variant="caption">
                                  Stock: {item.total_stock}
                                </Typography>
                                <Button
                                  size="small"
                                  variant="text"
                                  onClick={() => handleViewDetails(item)}
                                  sx={{ fontSize: "0.7rem", p: 0.5 }}
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
                  {items.length > 12 && (
                    <Box sx={{ textAlign: "center", mt: 2 }}>
                      <Typography variant="body2" color="text.secondary">
                        Showing 12 of {items.length} items in this category
                      </Typography>
                    </Box>
                  )}
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        ) : viewMode === "card" ? (
          // Card View (existing implementation)
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
                      border: `1px solid ${colors.neutral[200]}`,
                      transition: "all 0.3s ease",
                      cursor: "pointer",
                      "&:hover": {
                        transform: "translateY(-4px)",
                        boxShadow: `0 12px 40px ${colors.neutral[400]}40`,
                        borderColor: colors.primary.light,
                      },
                    }}
                    onClick={() => handleViewDetails(item)}
                  >
                    <CardHeader
                      avatar={
                        <Avatar sx={{ bgcolor: colors.neutral[100] }}>
                          <InventoryIcon sx={{ color: colors.neutral[600] }} />
                        </Avatar>
                      }
                      action={
                        <Chip
                          icon={<StatusIcon fontSize="small" />}
                          label={stockStatus.status.replace("-", " ")}
                          color={stockStatus.color}
                          size="small"
                          sx={{ textTransform: "capitalize" }}
                        />
                      }
                      title={
                        <Typography variant="h6" fontWeight="600" noWrap>
                          {item.item_no}
                        </Typography>
                      }
                      subheader={
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          noWrap
                        >
                          {item.material_group}
                        </Typography>
                      }
                    />

                    <CardContent sx={{ pt: 0 }}>
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

                      <Stack spacing={1} sx={{ mb: 2 }}>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2">Total</Typography>
                          <Typography variant="body2" fontWeight="600">
                            {item.total_stock}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography
                            variant="body2"
                            color="success.main"
                          >
                            Available
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight="600"
                            color="success.main"
                          >
                            {item.available_stock}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography
                            variant="body2"
                            color="warning.main"
                          >
                            Allocated
                          </Typography>
                          <Typography
                            variant="body2"
                            fontWeight="600"
                            color="warning.main"
                          >
                            {item.allocated_stock}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="info.main">Opening</Typography>
                          <Typography variant="body2" fontWeight="600" color="info.main">
                            {item.opening_stock}
                          </Typography>
                        </Stack>
                        <Stack direction="row" justifyContent="space-between">
                          <Typography variant="body2" color="error.main">Outward</Typography>
                          <Typography variant="body2" fontWeight="600" color="error.main">
                            {item.outward_stock}
                          </Typography>
                        </Stack>
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
                          backgroundColor: colors.neutral[200],
                          "& .MuiLinearProgress-bar": {
                            backgroundColor: colors.success.main,
                          },
                        }}
                      />
                    </CardContent>

                    <CardActions
                      sx={{ justifyContent: "space-between", px: 2, pb: 2 }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Make: {item.make}
                      </Typography>
                      <Button
                        size="small"
                        variant="contained"
                        onClick={() => handleViewDetails(item)}
                        startIcon={<InfoIcon />}
                        sx={{
                          borderRadius: 2,
                          backgroundColor: colors.primary.main,
                          "&:hover": {
                            backgroundColor: colors.primary.dark,
                          },
                        }}
                      >
                        Details
                      </Button>
                    </CardActions>
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
                  <TableCell align="right">Opening Stock</TableCell>
                  <TableCell align="right">Total Stock</TableCell>
                  <TableCell align="right">Available</TableCell>
                  <TableCell align="right">Allocated</TableCell>
                  <TableCell align="right">Outward Stock</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Remarks</TableCell>
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
                          {item.id}
                        </Typography>
                      </TableCell>
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
                        <Typography variant="body2" color="info.main">
                          {item.opening_stock}
                        </Typography>
                      </TableCell>
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
                      <TableCell align="right">
                        <Typography variant="body2" color="warning.main">
                          {item.allocated_stock}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="body2" color="error.main">
                          {item.outward_stock}
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
                      <TableCell>
                        <Tooltip title={item.remarks || 'No remarks'}>
                          <Typography variant="body2" noWrap sx={{ maxWidth: 150 }}>
                            {item.remarks || '-'}
                          </Typography>
                        </Tooltip>
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
        {!loading && paginatedItems.length > 0 && !showCategorized && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              mt: 3,
              pt: 2,
              borderTop: `1px solid ${colors.neutral[200]}`,
            }}
          >
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={(_, page) => setCurrentPage(page)}
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

      {/* Enhanced Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            background: `linear-gradient(135deg, ${colors.neutral[50]} 0%, ${colors.neutral[100]} 100%)`,
          },
        }}
      >
        <DialogTitle
          sx={{
            background: `linear-gradient(45deg, ${colors.primary.main}, ${colors.primary.light})`,
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="h6" fontWeight="600" sx={{ color: "white" }}>
              {selectedItem?.item_no}
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, color: "white" }}>
              {selectedItem?.description}
            </Typography>
          </Box>
          <IconButton
            onClick={() => setDetailsOpen(false)}
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {detailsLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
              <CircularProgress size={60} />
            </Box>
          ) : (
            <>
              <Tabs
                value={activeTab}
                onChange={(_, newValue) => setActiveTab(newValue)}
                sx={{ borderBottom: 1, borderColor: "divider" }}
              >
                <Tab icon={<PieChartIcon />} label="Stock Overview" />
                <Tab icon={<LocationOnIcon />} label="Locations" />
                <Tab icon={<AssignmentIcon />} label="Allocations" />
                <Tab icon={<LocalShippingIcon />} label="Outward History" />
                <Tab icon={<SwapHorizIcon />} label="Gate Pass" />
                <Tab icon={<ReportProblemIcon />} label="Rejected" />
              </Tabs>

              <TabPanel value={activeTab} index={0}>
                {/* Stock Overview */}
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ borderRadius: 2 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Stock Summary
                        </Typography>
                        <Stack spacing={2}>
                          {[
                            {
                              label: "Opening Stock",
                              value: selectedItem?.opening_stock,
                              color: colors.info.main,
                            },
                            {
                              label: "Total Stock",
                              value: selectedItem?.total_stock,
                              color: colors.primary.main,
                            },
                            {
                              label: "Available",
                              value: selectedItem?.available_stock,
                              color: colors.success.main,
                            },
                            {
                              label: "Allocated",
                              value: selectedItem?.allocated_stock,
                              color: colors.warning.main,
                            },
                            {
                              label: "Outward",
                              value: selectedItem?.outward_stock,
                              color: colors.error.main,
                            },
                          ].map((stat, index) => (
                            <Stack
                              key={index}
                              direction="row"
                              justifyContent="space-between"
                              alignItems="center"
                            >
                              <Typography variant="body2">
                                {stat.label}
                              </Typography>
                              <Typography
                                variant="h6"
                                sx={{ color: stat.color }}
                              >
                                {stat.value}
                              </Typography>
                            </Stack>
                          ))}
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Card sx={{ borderRadius: 2 }}>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Item Information
                        </Typography>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">
                              Material Group
                            </Typography>
                            <Typography variant="body2">
                              {selectedItem?.material_group}
                            </Typography>
                          </Stack>
                          <Stack direction="row" justifyContent="space-between">
                            <Typography variant="body2" color="text.secondary">
                              Make
                            </Typography>
                            <Typography variant="body2">
                              {selectedItem?.make}
                            </Typography>
                          </Stack>
                        </Stack>
                      </CardContent>
                    </Card>
                  </Grid>
                </Grid>
              </TabPanel>

              <TabPanel value={activeTab} index={1}>
                {/* Location-wise Stock */}
                <Grid container spacing={2}>
                  {itemDetails?.locationStocks &&
                    Object.entries(itemDetails.locationStocks).map(
                      ([location, stock]) => (
                        <Grid item xs={12} sm={6} md={4} key={location}>
                          <Card sx={{ borderRadius: 2, height: "100%" }}>
                            <CardContent>
                              <Stack
                                direction="row"
                                alignItems="center"
                                spacing={1}
                                sx={{ mb: 2 }}
                              >
                                <LocationOnIcon
                                  sx={{ color: colors.primary.main }}
                                />
                                <Typography variant="h6">{location}</Typography>
                              </Stack>
                              <Stack spacing={1}>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                >
                                  <Typography variant="body2">Total</Typography>
                                  <Typography variant="body2" fontWeight="600">
                                    {stock.total}
                                  </Typography>
                                </Stack>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                >
                                  <Typography
                                    variant="body2"
                                    color="success.main"
                                  >
                                    Available
                                  </Typography>
                                  <Typography variant="body2" fontWeight="600">
                                    {stock.available}
                                  </Typography>
                                </Stack>
                                <Stack
                                  direction="row"
                                  justifyContent="space-between"
                                >
                                  <Typography
                                    variant="body2"
                                    color="warning.main"
                                  >
                                    Allocated
                                  </Typography>
                                  <Typography variant="body2" fontWeight="600">
                                    {stock.allocated}
                                  </Typography>
                                </Stack>
                              </Stack>
                            </CardContent>
                          </Card>
                        </Grid>
                      )
                    )}
                </Grid>
              </TabPanel>

              <TabPanel value={activeTab} index={2}>
                {/* Allocations */}
                <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: colors.neutral[100] }}>
                        <TableCell>Project Code</TableCell>
                        <TableCell>Project Name</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Date</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {itemDetails?.allocations?.map((allocation, index) => (
                        <TableRow key={index}>
                          <TableCell>{allocation.project_code?.code}</TableCell>
                          <TableCell>{allocation.project_code?.name}</TableCell>
                          <TableCell align="right">
                            {allocation.allocated_quantity}
                          </TableCell>
                          <TableCell>
                            {new Date(
                              allocation.allocation_date
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={allocation.status}
                              size="small"
                              color={
                                allocation.status === "allocated"
                                  ? "success"
                                  : "default"
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </TabPanel>

              <TabPanel value={activeTab} index={3}>
                {/* Outward History */}
                <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                  <Table>
                    <TableHead>
                      <TableRow sx={{ backgroundColor: colors.neutral[100] }}>
                        <TableCell>Date</TableCell>
                        <TableCell>Project</TableCell>
                        <TableCell align="right">Quantity</TableCell>
                        <TableCell>Document</TableCell>
                        <TableCell>Status</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {itemDetails?.outwardHistory?.map((outward, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            {new Date(
                              outward.outward_date
                            ).toLocaleDateString()}
                          </TableCell>
                          <TableCell>{outward.project_code}</TableCell>
                          <TableCell align="right">
                            {outward.quantity}
                          </TableCell>
                          <TableCell>{outward.document_number}</TableCell>
                          <TableCell>
                            <Chip
                              label={outward.status}
                              size="small"
                              color="primary"
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </TabPanel>

              <TabPanel value={activeTab} index={4}>
                {/* Returnable Gate Pass Info */}
                <Box>
                  {itemDetails?.returnableInfo?.length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      textAlign="center"
                      py={4}
                    >
                      No returnable gate pass records found
                    </Typography>
                  ) : (
                    <List>
                      {itemDetails?.returnableInfo?.map((gatePass, index) => (
                        <ListItem key={index} divider>
                          <ListItemIcon>
                            <SwapHorizIcon sx={{ color: colors.info.main }} />
                          </ListItemIcon>
                          <ListItemText
                            primary={`Gate Pass: ${gatePass.gate_pass_number}`}
                            secondary={`Type: ${gatePass.pass_type} | Status: ${gatePass.status} | Quantity: ${gatePass.quantity}`}
                          />
                        </ListItem>
                      ))}
                    </List>
                  )}
                </Box>
              </TabPanel>

              <TabPanel value={activeTab} index={5}>
                {/* Rejected Materials */}
                <Box>
                  {itemDetails?.rejectedMaterials?.length === 0 ? (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      textAlign="center"
                      py={4}
                    >
                      No rejected material records found
                    </Typography>
                  ) : (
                    <List>
                      {itemDetails?.rejectedMaterials?.map(
                        (rejected, index) => (
                          <ListItem key={index} divider>
                            <ListItemIcon>
                              <ReportProblemIcon
                                sx={{ color: colors.error.main }}
                              />
                            </ListItemIcon>
                            <ListItemText
                              primary={`Challan: ${rejected.challan_number}`}
                              secondary={`Reason: ${rejected.reason_for_return} | Quantity: ${rejected.quantity} | Action: ${rejected.action_taken}`}
                            />
                          </ListItem>
                        )
                      )}
                    </List>
                  )}
                </Box>
              </TabPanel>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Management Insights Dialog */}
      <Dialog
        open={showDetails}
        onClose={() => setShowDetails(false)}
        maxWidth="md"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 3,
            maxHeight: '90vh'
          }
        }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Stack direction="row" alignItems="center" spacing={2}>
            <Avatar sx={{ bgcolor: 'primary.main' }}>
              {selectedMetric === "total_items" && <InventoryIcon />}
              {selectedMetric === "low_stock" && <TrendingDownIcon />}
              {selectedMetric === "out_of_stock" && <WarningIcon />}
              {selectedMetric === "allocated_items" && <AssignmentIcon />}
              {selectedMetric === "outward_items" && <SwapHorizIcon />}
              {selectedMetric === "stock_movement" && <TimelineIcon />}
              {selectedMetric === "location_distribution" && <LocationOnIcon />}
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight="600">
                {selectedMetric === "total_items" && "Inventory Overview"}
                {selectedMetric === "low_stock" && "Low Stock Analysis"}
                {selectedMetric === "out_of_stock" && "Critical Stock Status"}
                {selectedMetric === "allocated_items" && "Resource Allocation"}
                {selectedMetric === "outward_items" && "Movement Analysis"}
                {selectedMetric === "stock_movement" && "Stock Flow Summary"}
                {selectedMetric === "location_distribution" && "Geographic Distribution"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedMetric === "total_items" && "Complete inventory health assessment"}
                {selectedMetric === "low_stock" && "Items requiring immediate attention"}
                {selectedMetric === "out_of_stock" && "Critical items needing urgent restocking"}
                {selectedMetric === "allocated_items" && "Resources committed to projects"}
                {selectedMetric === "outward_items" && "Items in transit or delivered"}
                {selectedMetric === "stock_movement" && "Recent inventory changes and trends"}
                {selectedMetric === "location_distribution" && "Stock distribution across locations"}
              </Typography>
            </Box>
          </Stack>
        </DialogTitle>
        <DialogContent>
          {selectedMetric === "location_distribution" ? (
            // Location distribution specific view
            <Grid container spacing={3} sx={{ mt: 2 }}>
              {Object.entries({
                times_sq: 'Times Square',
                i_sq: 'iSquare',
                sakar: 'Sakar',
                pirana: 'Pirana',
                other: 'Other'
              }).map(([key, name]) => (
                <Grid item xs={12} sm={6} md={4} key={key}>
                  <Card sx={{ height: '100%' }}>
                    <CardContent sx={{ textAlign: 'center' }}>
                      <Typography variant="h4" color="primary" fontWeight="600">
                        {stats.location_distribution?.[key as keyof typeof stats.location_distribution]?.toLocaleString() || '0'}
                      </Typography>
                      <Typography variant="subtitle1" fontWeight="500">
                        {name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Items in this location
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          ) : (
            // Item details for other metrics
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6" gutterBottom sx={{ mb: 3, color: 'primary.main' }}>
                📦 Item Details - {selectedMetric === "total_items" ? "All Items" :
                  selectedMetric === "low_stock" ? "Low Stock Items" :
                  selectedMetric === "out_of_stock" ? "Out of Stock Items" :
                  selectedMetric === "allocated_items" ? "Allocated Items" :
                  selectedMetric === "outward_items" ? "Outward Items" :
                  selectedMetric === "stock_movement" ? "Items with Stock Movement" : "Items"}
              </Typography>

              <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
                <Table>
                  <TableHead>
                    <TableRow sx={{ backgroundColor: 'grey.50' }}>
                      <TableCell><strong>Item No</strong></TableCell>
                      <TableCell><strong>Description</strong></TableCell>
                      <TableCell><strong>Make</strong></TableCell>
                      <TableCell><strong>Material Group</strong></TableCell>
                      <TableCell align="right"><strong>Stock</strong></TableCell>
                      {selectedMetric === "allocated_items" && <TableCell align="right"><strong>Allocated</strong></TableCell>}
                      {selectedMetric === "outward_items" && <TableCell align="right"><strong>Outward</strong></TableCell>}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {(() => {
                      let items = [];
                      switch (selectedMetric) {
                        case "total_items":
                          items = filteredItems;
                          break;
                        case "low_stock":
                          items = filteredItems.filter(item => parseFloat(item.total_stock) < 10 && parseFloat(item.total_stock) > 0);
                          break;
                        case "out_of_stock":
                          items = filteredItems.filter(item => parseFloat(item.total_stock) === 0);
                          break;
                        case "allocated_items":
                          items = filteredItems.filter(item => parseFloat(item.allocated_stock) > 0);
                          break;
                        case "outward_items":
                          items = filteredItems.filter(item => parseFloat(item.outward_stock) > 0);
                          break;
                        case "stock_movement":
                          items = filteredItems.filter(item => parseFloat(item.total_stock) > 0);
                          break;
                        default:
                          items = [];
                      }
                      return items.slice(0, 100);
                    })().map((item) => (
                      <TableRow key={item.id} hover>
                        <TableCell>{item.item_no}</TableCell>
                        <TableCell>
                          <Typography variant="body2" sx={{
                            maxWidth: 300,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap'
                          }}>
                            {item.description}
                          </Typography>
                        </TableCell>
                        <TableCell>{item.make}</TableCell>
                        <TableCell>{item.material_group}</TableCell>
                        <TableCell align="right">{parseFloat(item.total_stock).toLocaleString()}</TableCell>
                        {selectedMetric === "allocated_items" && <TableCell align="right">{parseFloat(item.allocated_stock).toLocaleString()}</TableCell>}
                        {selectedMetric === "outward_items" && <TableCell align="right">{parseFloat(item.outward_stock).toLocaleString()}</TableCell>}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {(() => {
                  let items = [];
                  switch (selectedMetric) {
                    case "total_items":
                      items = filteredItems;
                      break;
                    case "low_stock":
                      items = filteredItems.filter(item => parseFloat(item.total_stock) < 10 && parseFloat(item.total_stock) > 0);
                      break;
                    case "out_of_stock":
                      items = filteredItems.filter(item => parseFloat(item.total_stock) === 0);
                      break;
                    case "allocated_items":
                      items = filteredItems.filter(item => parseFloat(item.allocated_stock) > 0);
                      break;
                    case "outward_items":
                      items = filteredItems.filter(item => parseFloat(item.outward_stock) > 0);
                      break;
                    case "stock_movement":
                      items = filteredItems.filter(item => parseFloat(item.total_stock) > 0);
                      break;
                    default:
                      items = [];
                  }
                  return items.length;
                })() > 100 && (
                  <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: 'center' }}>
                    Showing first 100 items. Use filters to narrow down results.
                  </Typography>
                )}
              </TableContainer>

              {/* Summary Statistics */}
              <Grid container spacing={2} sx={{ mt: 3 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ bgcolor: 'primary.light', color: 'white' }}>
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h6">
                        {(() => {
                          let items = [];
                          switch (selectedMetric) {
                            case "total_items":
                              items = filteredItems;
                              break;
                            case "low_stock":
                              items = filteredItems.filter(item => parseFloat(item.total_stock) < 10 && parseFloat(item.total_stock) > 0);
                              break;
                            case "out_of_stock":
                              items = filteredItems.filter(item => parseFloat(item.total_stock) === 0);
                              break;
                            case "allocated_items":
                              items = filteredItems.filter(item => parseFloat(item.allocated_stock) > 0);
                              break;
                            case "outward_items":
                              items = filteredItems.filter(item => parseFloat(item.outward_stock) > 0);
                              break;
                            case "stock_movement":
                              items = filteredItems.filter(item => parseFloat(item.total_stock) > 0);
                              break;
                            default:
                              items = [];
                          }
                          return items.length;
                        })()}
                      </Typography>
                      <Typography variant="body2">Total Items</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card sx={{ bgcolor: 'success.light', color: 'white' }}>
                    <CardContent sx={{ textAlign: 'center', py: 2 }}>
                      <Typography variant="h6">
                        {(() => {
                          let items = [];
                          switch (selectedMetric) {
                            case "total_items":
                              items = filteredItems;
                              break;
                            case "low_stock":
                              items = filteredItems.filter(item => parseFloat(item.total_stock) < 10 && parseFloat(item.total_stock) > 0);
                              break;
                            case "out_of_stock":
                              items = filteredItems.filter(item => parseFloat(item.total_stock) === 0);
                              break;
                            case "allocated_items":
                              items = filteredItems.filter(item => parseFloat(item.allocated_stock) > 0);
                              break;
                            case "outward_items":
                              items = filteredItems.filter(item => parseFloat(item.outward_stock) > 0);
                              break;
                            case "stock_movement":
                              items = filteredItems.filter(item => parseFloat(item.total_stock) > 0);
                              break;
                            default:
                              items = [];
                          }
                          return items.reduce((sum, item) => sum + parseFloat(item.total_stock || '0'), 0).toLocaleString();
                        })()}
                      </Typography>
                      <Typography variant="body2">Total Stock</Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {selectedMetric === "allocated_items" && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'warning.light', color: 'white' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h6">
                          {(() => {
                            const items = filteredItems.filter(item => parseFloat(item.allocated_stock) > 0);
                            return items.reduce((sum, item) => sum + parseFloat(item.allocated_stock || '0'), 0).toLocaleString();
                          })()}
                        </Typography>
                        <Typography variant="body2">Total Allocated</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                {selectedMetric === "outward_items" && (
                  <Grid item xs={12} sm={6} md={3}>
                    <Card sx={{ bgcolor: 'info.light', color: 'white' }}>
                      <CardContent sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="h6">
                          {(() => {
                            const items = filteredItems.filter(item => parseFloat(item.outward_stock) > 0);
                            return items.reduce((sum, item) => sum + parseFloat(item.outward_stock || '0'), 0).toLocaleString();
                          })()}
                        </Typography>
                        <Typography variant="body2">Total Outward</Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowDetails(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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

export default EnhancedInventory;
