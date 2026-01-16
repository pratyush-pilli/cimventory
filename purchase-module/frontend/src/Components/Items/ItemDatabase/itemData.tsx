import React, { useEffect, useState } from "react";
import {
  DataGrid,
  GridColDef,
  GridFilterModel,
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarFilterButton,
  GridToolbarColumnsButton,
  GridToolbarDensitySelector,
} from "@mui/x-data-grid";
import axios from "axios";
import {
  Box,
  TextField,
  Snackbar,
  Alert,
  IconButton,
  Typography,
  Paper,
  Button,
  Tooltip,
  Chip,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Divider,
  CircularProgress,
  useTheme,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import configuration from "../../../configuration";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InputAdornment from "@mui/material/InputAdornment";

// Define interface for CustomToolbarProps
interface CustomToolbarProps {
  data: any[];
}

// Function to export data to CSV
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

// Custom toolbar with better styling
function CustomToolbar() {
  return (
    <GridToolbarContainer sx={{ p: 1, justifyContent: "space-between" }}>
      <Box>
        <GridToolbarColumnsButton sx={{ mr: 1 }} />
        <GridToolbarFilterButton sx={{ mr: 1 }} />
        <GridToolbarExport
          printOptions={{ disableToolbarButton: true }}
          csvOptions={{
            fileName: "ItemMasterData",
            delimiter: ",",
            utf8WithBom: true,
          }}
        />
      </Box>
    </GridToolbarContainer>
  );
}

const ItemMasterDataGrid = () => {
  const theme = useTheme();
  const [items, setItems] = useState<any[]>([]);
  const [filteredItems, setFilteredItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Advanced filtering states
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({
    make: "",
    partNumber: "",
    description: "",
  });

  // Add this state near your other states
  const [paginationModel, setPaginationModel] = useState({
    pageSize: 15,
    page: 0,
  });

  const CustomToolbar: React.FC<CustomToolbarProps> = ({ data }) => {
    const handleExport = () => {
      exportToCsv(data, "filtered-report.csv");
    };

    return (
      <GridToolbarContainer>
        <GridToolbarColumnsButton />
        <GridToolbarFilterButton />
        <GridToolbarDensitySelector
          slotProps={{ tooltip: { title: "Change density" } }}
        />
        <Box sx={{ flexGrow: 1 }} />
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

  // Get unique makes for the filter dropdown
  const uniqueMakes = [...new Set(items.map((item) => item.make))]
    .filter(Boolean)
    .sort();

  useEffect(() => {
    fetchItems();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [items, searchTerm, filterCriteria]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${configuration.api_url}item-master-data/`);
      console.log("Item data:", response.data);
      setItems(response.data);
      setSuccess("Items fetched successfully.");
    } catch (error) {
      console.error("Error fetching items:", error);
      setError("Failed to fetch items.");
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let result = [...items];

    // Apply search term filter (searches across multiple fields)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          (item.name && item.name.toLowerCase().includes(searchLower)) ||
          (item.cimcon_part_no &&
            item.cimcon_part_no.toLowerCase().includes(searchLower)) ||
          (item.description &&
            item.description.toLowerCase().includes(searchLower)) ||
          (item.mfg_part_no &&
            item.mfg_part_no.toLowerCase().includes(searchLower))
      );
    }

    // Apply advanced filters
    if (filterCriteria.make) {
      result = result.filter((item) => item.make === filterCriteria.make);
    }

    if (filterCriteria.partNumber) {
      const partNumLower = filterCriteria.partNumber.toLowerCase();
      result = result.filter(
        (item) =>
          (item.cimcon_part_no &&
            item.cimcon_part_no.toLowerCase().includes(partNumLower)) ||
          (item.mfg_part_no &&
            item.mfg_part_no.toLowerCase().includes(partNumLower))
      );
    }

    if (filterCriteria.description) {
      const descLower = filterCriteria.description.toLowerCase();
      result = result.filter(
        (item) =>
          item.description && item.description.toLowerCase().includes(descLower)
      );
    }

    setFilteredItems(result);
  };

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  const handleClearSearch = () => {
    setSearchTerm("");
  };

  const handleFilterChange = (field: string, value: string) => {
    setFilterCriteria((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setFilterCriteria({
      make: "",
      partNumber: "",
      description: "",
    });
  };

  const columns: GridColDef[] = [
    {
      field: "serialNumber",
      headerName: "Sr No",
      width: 80,
      renderCell: (params) => {
        return params.api.getRowIndexRelativeToVisibleRows(params.row.id) + 1;
      },
      sortable: false,
      filterable: false,
      headerAlign: "center",
      align: "center",
    },
    {
      field: "alternate_no",
      headerName: "Alt No",
      width: 130,
      renderCell: (params) => (
        <Tooltip title={params.value || ""}>
          <div style={{ whiteSpace: "normal", wordWrap: "break-word" }}>
            {params.value}
          </div>
        </Tooltip>
      ),
    },
    {
      field: "mfg_part_no",
      headerName: "Mfg Part",
      width: 130,
      renderCell: (params) => (
        <Tooltip title={params.value || ""}>
          <div
            style={{
              whiteSpace: "normal",
              wordWrap: "break-word",
              fontWeight: 500,
            }}
          >
            {params.value}
          </div>
        </Tooltip>
      ),
    },
    {
      field: "cimcon_part_no",
      headerName: "Cimcon Part",
      width: 150,
      renderCell: (params) => (
        <Tooltip title={params.value || ""}>
          <div
            style={{
              whiteSpace: "normal",
              wordWrap: "break-word",
              fontWeight: 500,
              color: theme.palette.primary.main,
            }}
          >
            {params.value}
          </div>
        </Tooltip>
      ),
    },
    {
      field: "make",
      headerName: "Make",
      width: 120,
      renderCell: (params) => (
        <Tooltip title={params.value || ""}>
          <Chip
            label={params.value || "N/A"}
            size="small"
            variant="outlined"
            color="primary"
          />
        </Tooltip>
      ),
    },
    {
      field: "name",
      headerName: "Item Name",
      width: 200,
      renderCell: (params) => (
        <Tooltip title={params.value || ""}>
          <div
            style={{
              whiteSpace: "normal",
              wordWrap: "break-word",
              fontWeight: 500,
            }}
          >
            {params.value}
          </div>
        </Tooltip>
      ),
    },
    {
      field: "description",
      headerName: "Description",
      width: 250,
      renderCell: (params) => (
        <Tooltip title={params.value || ""}>
          <div style={{ whiteSpace: "normal", wordWrap: "break-word" }}>
            {params.value}
          </div>
        </Tooltip>
      ),
    },
    {
      field: "package",
      headerName: "Package",
      width: 100,
      editable: true,
      renderCell: (params) => (
        <Tooltip title={params.value || "Not specified"}>
          <div>{params.value || "-"}</div>
        </Tooltip>
      ),
    },
    {
      field: "packaging",
      headerName: "Packing",
      width: 100,
      editable: true,
      renderCell: (params) => (
        <Tooltip title={params.value || "Not specified"}>
          <div>{params.value || "-"}</div>
        </Tooltip>
      ),
    },
    {
      field: "uom",
      headerName: "UOM",
      width: 80,
      editable: true,
      renderCell: (params) => (
        <Tooltip title={params.value || "Not specified"}>
          <div>{params.value || "-"}</div>
        </Tooltip>
      ),
    },
    {
      field: "spq",
      headerName: "SPQ",
      width: 80,
      editable: true,
      type: "number",
      renderCell: (params) => (
        <Tooltip title={params.value || "Not specified"}>
          <div>{params.value || "-"}</div>
        </Tooltip>
      ),
    },
    {
      field: "mfg_std_lead_time",
      headerName: "Lead Time",
      width: 100,
      editable: true,
      type: "number",
      renderCell: (params) => (
        <Tooltip title={`${params.value || "Not specified"} days`}>
          <div>{params.value ? `${params.value} days` : "-"}</div>
        </Tooltip>
      ),
    },
    {
      field: "bin",
      headerName: "Bin",
      width: 100,
      editable: true,
      renderCell: (params) => (
        <Tooltip title={params.value || "Not specified"}>
          <div>{params.value || "-"}</div>
        </Tooltip>
      ),
    },
    {
      field: "hsn_code",
      headerName: "HSN",
      width: 100,
      editable: true,
      renderCell: (params) => (
        <Tooltip title={params.value || "Not specified"}>
          <div>{params.value || "-"}</div>
        </Tooltip>
      ),
    },
    {
      field: "document",
      headerName: "Document",
      width: 120,
      sortable: false,
      filterable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => {
        const hasDocument =
          params.row.document ||
          params.row.document_name ||
          params.row.has_document ||
          params.row.document_url;

        return hasDocument ? (
          <Tooltip title="Download Document">
            <IconButton
              color="primary"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                window.open(
                  `${configuration.api_url}/item-document/master/${params.row.id}/`,
                  "_blank"
                );
              }}
            >
              <FileDownloadIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <Typography variant="caption" color="text.secondary">
            No document
          </Typography>
        );
      },
    },
  ];

  return (
    <Paper elevation={3} sx={{ p: 3, borderRadius: 2, height: "100%" }}>
      <Typography
        variant="h5"
        gutterBottom
        sx={{
          color: "#1976d2",
          fontWeight: 600,
          mb: 3,
          display: "flex",
          alignItems: "center",
        }}
      >
        Item Master Database
        <Chip
          label={`${filteredItems.length} items`}
          color="primary"
          size="small"
          sx={{ ml: 2 }}
        />
      </Typography>

      {/* Main search bar with clear button */}
      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search Items (Name, Part Numbers, Description)"
          placeholder="Type to search across all fields..."
          variant="outlined"
          fullWidth
          value={searchTerm}
          onChange={handleSearchChange}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="primary" />
              </InputAdornment>
            ),
            endAdornment: searchTerm && (
              <InputAdornment position="end">
                <IconButton size="small" onClick={handleClearSearch}>
                  <ClearIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Advanced filters accordion */}
      <Accordion
        expanded={advancedFilterOpen}
        onChange={() => setAdvancedFilterOpen(!advancedFilterOpen)}
        sx={{
          mb: 3,
          borderRadius: 1,
          boxShadow: "none",
          border: "1px solid #e0e0e0",
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon />}
          sx={{ bgcolor: "#f5f5f5" }}
        >
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <FilterListIcon sx={{ mr: 1, color: "primary.main" }} />
            <Typography>Advanced Filters</Typography>
            {(filterCriteria.make ||
              filterCriteria.partNumber ||
              filterCriteria.description) && (
              <Chip
                label="Filters active"
                color="primary"
                size="small"
                sx={{ ml: 2 }}
              />
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Grid container spacing={2}>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Make</InputLabel>
                <Select
                  value={filterCriteria.make}
                  onChange={(e) => handleFilterChange("make", e.target.value)}
                  label="Make"
                >
                  <MenuItem value="">
                    <em>All Makes</em>
                  </MenuItem>
                  {uniqueMakes.map((make) => (
                    <MenuItem key={make} value={make}>
                      {make}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Part Number"
                variant="outlined"
                fullWidth
                size="small"
                value={filterCriteria.partNumber}
                onChange={(e) =>
                  handleFilterChange("partNumber", e.target.value)
                }
                placeholder="Search by part number..."
              />
            </Grid>
            <Grid item xs={12} md={4}>
              <TextField
                label="Description"
                variant="outlined"
                fullWidth
                size="small"
                value={filterCriteria.description}
                onChange={(e) =>
                  handleFilterChange("description", e.target.value)
                }
                placeholder="Search by description..."
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={clearAllFilters}
                  startIcon={<ClearIcon />}
                  size="small"
                >
                  Clear All Filters
                </Button>
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Active filters display */}
      {(filterCriteria.make ||
        filterCriteria.partNumber ||
        filterCriteria.description) && (
        <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Typography variant="body2" sx={{ mr: 1, color: "text.secondary" }}>
            Active filters:
          </Typography>
          {filterCriteria.make && (
            <Chip
              label={`Make: ${filterCriteria.make}`}
              size="small"
              onDelete={() => handleFilterChange("make", "")}
              color="primary"
              variant="outlined"
            />
          )}
          {filterCriteria.partNumber && (
            <Chip
              label={`Part #: ${filterCriteria.partNumber}`}
              size="small"
              onDelete={() => handleFilterChange("partNumber", "")}
              color="primary"
              variant="outlined"
            />
          )}
          {filterCriteria.description && (
            <Chip
              label={`Desc: ${filterCriteria.description}`}
              size="small"
              onDelete={() => handleFilterChange("description", "")}
              color="primary"
              variant="outlined"
            />
          )}
        </Box>
      )}

      {loading ? (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: 400,
          }}
        >
          <CircularProgress />
          <Typography variant="body1" sx={{ ml: 2 }}>
            Loading item data...
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            height: advancedFilterOpen
              ? "calc(100vh - 250px)"
              : "calc(100vh - 200px)",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            "& .MuiDataGrid-root": {
              border: "none",
              flex: 1,
              backgroundColor: "white",
              "& .MuiDataGrid-cell": {
                borderBottom: "1px solid #f0f0f0",
                padding: "8px",
                "&:focus": {
                  outline: "none",
                },
              },
              "& .MuiDataGrid-columnHeaders": {
                backgroundColor: "#f5f5f5",
                borderBottom: "2px solid #e0e0e0",
              },
              "& .MuiDataGrid-virtualScroller": {
                overflow: "auto",
              },
              "& .MuiDataGrid-footerContainer": {
                borderTop: "2px solid #e0e0e0",
                position: "sticky",
                bottom: 0,
                backgroundColor: "white",
              },
              "& .MuiDataGrid-cell:first-child": {
                backgroundColor: "#f5f5f5",
                fontWeight: 500,
              },
            },
          }}
        >
          <DataGrid
            rows={filteredItems}
            rowHeight={90}
            columns={columns}
            loading={loading}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 15, page: 0 },
              },
            }}
            pageSizeOptions={[15, 25, 50, 100]}
            disableRowSelectionOnClick
            getRowId={(row) => row.id}
            slots={{
              toolbar: CustomToolbar,
            }}
            slotProps={{
              toolbar: { data: filteredItems },
            }}
            density="compact"
            autoHeight={false}
            sx={{
              width: "100%",
              height: "100%",
              overflow: "hidden",
              "& .MuiDataGrid-main": { overflow: "auto" },
              "& .MuiDataGrid-row": {
                "&:hover": {
                  backgroundColor: "rgba(25, 118, 210, 0.08)",
                },
                "&:nth-of-type(even)": {
                  backgroundColor: "rgba(0, 0, 0, 0.02)",
                },
              },
              "& .MuiDataGrid-columnHeader": {
                padding: "8px",
                "& .MuiDataGrid-columnHeaderTitle": {
                  fontWeight: 600,
                  fontSize: "0.875rem",
                },
              },
            }}
          />
        </Box>
      )}

      <Snackbar
        open={snackbarOpen || Boolean(success) || Boolean(error)}
        autoHideDuration={6000}
        onClose={() => {
          setSnackbarOpen(false);
          setError("");
          setSuccess("");
        }}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => {
            setSnackbarOpen(false);
            setError("");
            setSuccess("");
          }}
          severity={error ? "error" : "success"}
          sx={{ width: "100%" }}
          elevation={6}
          variant="filled"
        >
          {error || success}
        </Alert>
      </Snackbar>
    </Paper>
  );
};

export default ItemMasterDataGrid;
