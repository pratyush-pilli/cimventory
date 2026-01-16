import React, { useState, useEffect, useMemo } from "react";
import {
  DataGrid,
  GridColDef,
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarFilterButton,
  GridToolbarColumnsButton,
} from "@mui/x-data-grid";
import {
  Box,
  TextField,
  Snackbar,
  Alert,
  Typography,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  CircularProgress,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  InputAdornment,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import RefreshIcon from "@mui/icons-material/Refresh";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import axios from "axios";
import configuration from "../../../configuration";

// Custom toolbar component
interface CustomToolbarProps {
  data: any[];
}

const CustomToolbar: React.FC<CustomToolbarProps> = ({ data }) => {
  const handleExport = () => {
    exportToCsv(data, "po-line-items.csv");
  };

  return (
    <GridToolbarContainer sx={{ p: 1, justifyContent: "space-between" }}>
      <Box>
        <GridToolbarColumnsButton sx={{ mr: 1 }} />
        <GridToolbarFilterButton sx={{ mr: 1 }} />
        <GridToolbarExport
          printOptions={{ disableToolbarButton: true }}
          csvOptions={{
            fileName: "POLineItems",
            delimiter: ",",
            utf8WithBom: true,
          }}
        />
      </Box>
      <Button
        onClick={handleExport}
        startIcon={<FileDownloadIcon />}
        variant="outlined"
        size="small"
      >
        Export Filtered
      </Button>
    </GridToolbarContainer>
  );
};

const POLineItems: React.FC = () => {
  const theme = useTheme();
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);

  // Filter states
  const [filterCriteria, setFilterCriteria] = useState({
    status: "",
    vendor: "",
    projectCode: "",
    poNumber: "",
  });
  // Common exportToCsv function to be used across components
  const exportToCsv = (data: any[], filename: string) => {
    if (!data || !data.length) {
      console.error("No data to export");
      return;
    }

    // Extract column headers from the first item's keys
    // Filter out unwanted fields
    const excludeFields = ["id", "document_url", "has_document"];
    const item = data[0];
    const headers = Object.keys(item).filter(
      (key) => !excludeFields.includes(key)
    );

    // Create CSV header row
    let csv = headers.join(",") + "\n";

    // Add data rows
    data.forEach((row) => {
      const values = headers.map((header) => {
        const value = row[header];
        // Handle null/undefined values
        if (value === null || value === undefined) return "";

        // Format values that contain commas or quotes
        const cellValue = String(value).replace(/"/g, '""');
        return cellValue.includes(",") ||
          cellValue.includes('"') ||
          cellValue.includes("\n")
          ? `"${cellValue}"`
          : cellValue;
      });

      csv += values.join(",") + "\n";
    });

    // Create a blob from the CSV string
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

    // Create a download link and trigger the download
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  const fetchLineItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}/po-line-items/`
      );
      setLineItems(response.data);
      setSuccess("Line items loaded successfully");
    } catch (error) {
      console.error("Error fetching line items:", error);
      setError("Failed to fetch line items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLineItems();
    // Set up polling for automatic updates
    const interval = setInterval(fetchLineItems, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    applyFilters();
  }, [lineItems, searchTerm, filterCriteria]);

  // Get unique values for filters
  const uniqueVendors = useMemo(
    () => [...new Set(lineItems.map((item) => item.vendor_name))].sort(),
    [lineItems]
  );

  const uniqueProjectCodes = useMemo(
    () => [...new Set(lineItems.map((item) => item.project_code))].sort(),
    [lineItems]
  );

  const uniquePONumbers = useMemo(
    () => [...new Set(lineItems.map((item) => item.po_number))].sort(),
    [lineItems]
  );

  const applyFilters = () => {
    let result = [...lineItems];

    // Apply search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.material_description?.toLowerCase().includes(searchLower) ||
          item.item_no?.toLowerCase().includes(searchLower) ||
          item.make?.toLowerCase().includes(searchLower) ||
          item.po_number?.toLowerCase().includes(searchLower)
      );
    }

    // Apply advanced filters
    if (filterCriteria.status) {
      result = result.filter(
        (item) => item.inward_status === filterCriteria.status
      );
    }
    if (filterCriteria.vendor) {
      result = result.filter(
        (item) => item.vendor_name === filterCriteria.vendor
      );
    }
    if (filterCriteria.projectCode) {
      result = result.filter(
        (item) => item.project_code === filterCriteria.projectCode
      );
    }
    if (filterCriteria.poNumber) {
      result = result.filter(
        (item) => item.po_number === filterCriteria.poNumber
      );
    }

    setFilteredItems(result);
  };

  const getInwardStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return { color: "#00c853", bg: "rgba(0, 200, 83, 0.1)" };
      case "partially_inwarded":
        return { color: "#ff9800", bg: "rgba(255, 152, 0, 0.1)" };
      case "open":
        return { color: "#2196f3", bg: "rgba(33, 150, 243, 0.1)" };
      default:
        return { color: "text.primary", bg: "transparent" };
    }
  };

  const columns: GridColDef[] = [
    {
      field: "po_number",
      headerName: "PO Number",
      width: 170,
      renderCell: (params) => (
        <Tooltip title={params.value}>
          <Chip
            label={params.value}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Tooltip>
      ),
    },
    {
      field: "item_no",
      headerName: "Item No",
      width: 130,
    },
    {
      field: "material_description",
      headerName: "Description",
      width: 250,
      renderCell: (params) => (
        <Tooltip title={params.value}>
          <Typography
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {params.value}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: "make",
      headerName: "Make",
      width: 120,
    },
    {
      field: "material_group",
      headerName: "Material Group",
      width: 120,
    },
    {
      field: "quantity",
      headerName: "Ordered Qty",
      width: 120,
      type: "number",
      align: "right",
      headerAlign: "right",
    },
    {
      field: "inwarded_quantity",
      headerName: "Inwarded Qty",
      width: 120,
      type: "number",
      align: "right",
      headerAlign: "right",
    },
    {
      field: "remaining_quantity",
      headerName: "Remaining",
      width: 120,
      type: "number",
      align: "right",
      headerAlign: "right",
    },
    {
      field: "unit_price",
      headerName: "Unit Price",
      width: 120,
      type: "number",
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <Typography>
          ₹{" "}
          {params.value.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Typography>
      ),
    },
    {
      field: "total_price",
      headerName: "Total Price",
      width: 120,
      type: "number",
      align: "right",
      headerAlign: "right",
      renderCell: (params) => (
        <Typography>
          ₹{" "}
          {params.value.toLocaleString("en-IN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </Typography>
      ),
    },
    {
      field: "inward_status",
      headerName: "Status",
      width: 150,
      renderCell: (params) => {
        const status = params.value;
        const statusColors = getInwardStatusColor(status);
        return (
          <Chip
            label={status.replace("_", " ").toUpperCase()}
            sx={{
              backgroundColor: statusColors.bg,
              color: statusColors.color,
              fontWeight: 500,
            }}
            size="small"
          />
        );
      },
    },
    // {
    //   field: "expected_delivery",
    //   headerName: "Expected Delivery",
    //   width: 150,
    //   renderCell: (params) =>
    //     params.value ? new Date(params.value).toLocaleDateString() : "N/A",
    // },
  ];

  return (
    <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: "100%" }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Typography
          variant="h5"
          sx={{ color: theme.palette.primary.main, fontWeight: 600 }}
        >
          Purchase Order Line Items
          <Chip
            label={`${filteredItems.length} items`}
            color="primary"
            size="small"
            sx={{ ml: 2 }}
          />
        </Typography>
        <Tooltip title="Refresh Data">
          <IconButton onClick={fetchLineItems} color="primary">
            <RefreshIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Search Bar */}
      <TextField
        fullWidth
        variant="outlined"
        placeholder="Search by item number, description, make..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        sx={{ mb: 2 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon color="action" />
            </InputAdornment>
          ),
          endAdornment: searchTerm && (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setSearchTerm("")}>
                <ClearIcon />
              </IconButton>
            </InputAdornment>
          ),
        }}
      />

      {/* Advanced Filters */}
      <Accordion
        expanded={advancedFilterOpen}
        onChange={() => setAdvancedFilterOpen(!advancedFilterOpen)}
        sx={{ mb: 2 }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <FilterListIcon sx={{ mr: 1 }} />
            <Typography>Advanced Filters</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Status</InputLabel>
                <Select
                  value={filterCriteria.status}
                  onChange={(e) =>
                    setFilterCriteria({
                      ...filterCriteria,
                      status: e.target.value,
                    })
                  }
                  label="Status"
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="open">Open</MenuItem>
                  <MenuItem value="partially_inwarded">
                    Partially Inwarded
                  </MenuItem>
                  <MenuItem value="completed">Completed</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Vendor</InputLabel>
                <Select
                  value={filterCriteria.vendor}
                  onChange={(e) =>
                    setFilterCriteria({
                      ...filterCriteria,
                      vendor: e.target.value,
                    })
                  }
                  label="Vendor"
                >
                  <MenuItem value="">All</MenuItem>
                  {uniqueVendors.map((vendor) => (
                    <MenuItem key={vendor} value={vendor}>
                      {vendor}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>Project Code</InputLabel>
                <Select
                  value={filterCriteria.projectCode}
                  onChange={(e) =>
                    setFilterCriteria({
                      ...filterCriteria,
                      projectCode: e.target.value,
                    })
                  }
                  label="Project Code"
                >
                  <MenuItem value="">All</MenuItem>
                  {uniqueProjectCodes.map((code) => (
                    <MenuItem key={code} value={code}>
                      {code}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth>
                <InputLabel>PO Number</InputLabel>
                <Select
                  value={filterCriteria.poNumber}
                  onChange={(e) =>
                    setFilterCriteria({
                      ...filterCriteria,
                      poNumber: e.target.value,
                    })
                  }
                  label="PO Number"
                >
                  <MenuItem value="">All</MenuItem>
                  {uniquePONumbers.map((po) => (
                    <MenuItem key={po} value={po}>
                      {po}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="outlined"
              startIcon={<ClearIcon />}
              onClick={() => {
                setFilterCriteria({
                  status: "",
                  vendor: "",
                  projectCode: "",
                  poNumber: "",
                });
                setSearchTerm("");
              }}
            >
              Clear All Filters
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* DataGrid */}
      <Box sx={{ height: "calc(100vh - 350px)", width: "100%" }}>
        {loading ? (
          <Box
            sx={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              height: "100%",
            }}
          >
            <CircularProgress />
            <Typography sx={{ ml: 2 }}>Loading line items...</Typography>
          </Box>
        ) : (
          <DataGrid
            rows={filteredItems}
            columns={columns}
            pageSize={15}
            rowsPerPageOptions={[15, 25, 50, 100]}
            disableSelectionOnClick
            slots={{
              toolbar: CustomToolbar,
            }}
            slotProps={{
              toolbar: { data: filteredItems },
            }}
            getRowId={(row) => row.id}
            sx={{
              "& .MuiDataGrid-row": {
                "&:nth-of-type(even)": {
                  backgroundColor: "rgba(0, 0, 0, 0.02)",
                },
              },
            }}
          />
        )}
      </Box>

      <Snackbar
        open={Boolean(error) || Boolean(success)}
        autoHideDuration={6000}
        onClose={() => {
          setError("");
          setSuccess("");
        }}
      >
        <Alert
          severity={error ? "error" : "success"}
          onClose={() => {
            setError("");
            setSuccess("");
          }}
        >
          {error || success}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default POLineItems;
