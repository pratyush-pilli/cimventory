import React, { useState, useEffect } from "react";
import {
  DataGrid,
  GridColDef,
  GridRowSelectionModel,
  GridToolbar,
} from "@mui/x-data-grid";
import {
  Box,
  Button,
  Snackbar,
  Alert,
  Typography,
  Select,
  MenuItem,
  Chip,
  IconButton,
  FormControl,
  InputLabel,
  Pagination,
} from "@mui/material";
import axios from "axios";
import "./master.scss";
import CircularProgress from "@mui/material/CircularProgress";
import AddIcon from "@mui/icons-material/Add";
import POPreviewDialog from "./POPreviewDialog";
import configuration from "../../configuration";
import HomeIcon from "@mui/icons-material/Home";
import { useNavigate } from "react-router-dom";
import EditIcon from "@mui/icons-material/Edit";
import SaveIcon from "@mui/icons-material/Save";
import CancelIcon from "@mui/icons-material/Cancel";
import { GridRowModes, GridRowModesModel, GridRowId } from "@mui/x-data-grid";
import FilterListIcon from "@mui/icons-material/FilterList";
import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";
import TextField from "@mui/material/TextField";
import Grid from "@mui/material/Grid";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InputAdornment from "@mui/material/InputAdornment";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import RefreshIcon from "@mui/icons-material/Refresh";
import {
  NavigateBefore,
  NavigateNext,
  FirstPage,
  LastPage,
} from "@mui/icons-material";

interface CustomToolbarProps {
  data: any[];
}

const CustomToolbar: React.FC<CustomToolbarProps> = ({ data }) => {
  const handleExport = () => {
    exportToCsv(data, "master-data.csv");
  };

  // return (
  //   <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end", p: 1 }}>
  //     <Button
  //       onClick={handleExport}
  //       startIcon={<FileDownloadIcon />}
  //       variant="outlined"
  //       size="small"
  //     >
  //       Export CSV
  //     </Button>
  //   </Box>
  // );
};

const MasterSheet: React.FC = () => {
  const [selectedRows, setSelectedRows] = useState<GridRowSelectionModel>([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [poDialogOpen, setPODialogOpen] = useState(false);
  const [rowModesModel, setRowModesModel] = useState<GridRowModesModel>({});
  const navigate = useNavigate();
  const [filterPanelOpen, setFilterPanelOpen] = useState(false);
  const [filters, setFilters] = useState({
    indentDateFrom: "",
    indentDateTo: "",
    projectCode: "",
    status: "",
    cimconPartNo: "",
    mfgPartNo: "",
    materialDescription: "",
    make: "",
    materialGroup: "",
  });
  const [filteredRows, setFilteredRows] = useState([]);
  const [paginationModel, setPaginationModel] = useState({
    page: 0,
    pageSize: 15,
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const apiURL = `${configuration.api_url}master/`;

  // // Fetch data
  const fetchData = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await axios.get(`${apiURL}?approved_status=true`);
      console.log("API response data example:", response.data[0]);

      // Sort by ID descending to show newest items first
      const sortedData = response.data.sort((a, b) => b.id - a.id);
      setRows(sortedData);

      // Reset to first page when data is refreshed
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
    } catch (error) {
      console.error("Error fetching data:", error);
      setError("Failed to fetch data. Please try again later.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

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

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (rows.length > 0) {
      applyFilters();
    } else {
      setFilteredRows([]);
    }
  }, [rows, filters]);

  useEffect(() => {
    console.log("Rows updated:", rows);
  }, [rows]);

  // Handle success snackbar close
  const handleSnackbarClose = () => {
    setSnackbarOpen(false);
    setError("");
    setSuccess("");
  };

  // Handle cell edit
  const handleProcessRowUpdate = async (newRow) => {
    try {
      // Calculate balance quantity
      newRow.balance_quantity = newRow.soh - newRow.required_quantity;

      // Update backend with new data
      await axios.put(`${apiURL}${newRow.id}/`, newRow);
      setSuccess("Entry updated successfully.");
      setRows((prevRows) =>
        prevRows.map((row) => (row.id === newRow.id ? { ...newRow } : row))
      );
    } catch (error) {
      console.error("Error updating data:", error);
      setError("Failed to update data. Please try again.");
    } finally {
      setSnackbarOpen(true);
    }
    return newRow;
  };

  // Handle row edit errors
  const handleProcessRowUpdateError = (error) => {
    console.error("Row update error:", error);
    setError("Error updating row. Please check your inputs.");
    setSnackbarOpen(true);
  };

  const handleEditClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.Edit } });
  };

  const handleSaveClick = (id: GridRowId) => () => {
    setRowModesModel({ ...rowModesModel, [id]: { mode: GridRowModes.View } });
  };

  const handleCancelClick = (id: GridRowId) => () => {
    setRowModesModel({
      ...rowModesModel,
      [id]: { mode: GridRowModes.View, ignoreModifications: true },
    });
  };

  // Define columns dynamically with editable fields
  const columns: GridColDef[] = [
    {
      field: "id",
      headerName: "S. No.",
      width: 90,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "indent_number",
      headerName: "Indent Number",
      width: 150,
      align: "center",
      headerAlign: "center",
    },
    {
      field: "indent_date",
      headerName: "Indent Date",
      width: 150,
      editable: false,
      align: "center",
      headerAlign: "center",
      valueFormatter: (params) => {
        if (!params.value) return "";
        const date = new Date(params.value);
        return date instanceof Date && !isNaN(date.getTime())
          ? date.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "";
      },
      renderCell: (params) => {
        const date = new Date(params.value);
        return date instanceof Date && !isNaN(date.getTime())
          ? date.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })
          : "";
      },
    },
    {
      field: "order_type",
      headerName: "Order Type",
      width: 150,
      editable: false,
      align: "center",
      headerAlign: "center",
      renderCell: (params) => {
        // Add debugging to see the actual value
        // console.log("Order type value:", params.value, typeof params.value);

        const orderTypeMap = {
          SUP: "Supply",
          ITC: "ITC",
          ONM: "O&M",
          CON: "Contract",
          FRE: "Freight",
          SER: "Service",
        };

        // Add more robust checking and trimming
        const value = params.value ? String(params.value).trim() : "";

        return value ? (
          <Chip
            label={orderTypeMap[value] || value}
            size="small"
            color="primary"
            variant="outlined"
          />
        ) : (
          "-"
        );
      },
    },
    {
      field: "project_code",
      headerName: "Project Code",
      width: 150,
      editable: false,
    },
    {
      field: "ordering_status",
      headerName: "Ordering Status",
      width: 140,
      align: "center",
      headerAlign: "center",
      editable: false,
      renderCell: (params) => {
        // Simply use whatever status comes from the backend
        const status = params.row.ordering_status || "In Progress";

        // Basic styling based on status
        const getStatusConfig = (status) => {
          switch (status.toLowerCase()) {
            case "ordered":
              return { color: "#7c4dff", bg: "rgba(124, 77, 255, 0.1)" };
            case "partially ordered":
              return { color: "#ff9800", bg: "rgba(255, 152, 0, 0.1)" };
            case "delivered":
              return { color: "#00c853", bg: "rgba(0, 200, 83, 0.1)" };
            case "partially delivered":
              return { color: "#ff9800", bg: "rgba(255, 152, 0, 0.1)" };
            case "cancelled":
              return { color: "#ff5252", bg: "rgba(255, 82, 82, 0.1)" };
            default: // in progress
              return { color: "#2196f3", bg: "rgba(33, 150, 243, 0.1)" };
          }
        };

        const { color, bg } = getStatusConfig(status);

        return (
          <Chip
            label={status}
            sx={{
              backgroundColor: bg,
              color: color,
              fontWeight: 600,
              minWidth: "100px",
              "&.MuiChip-root": {
                height: "28px",
              },
              "&:hover": {
                backgroundColor: bg,
                opacity: 0.9,
              },
            }}
          />
        );
      },
    },
    {
      field: "batch_id",
      headerName: "Requisition Batch",
      width: 130,
      editable: false,
    },
    {
      field: "cimcon_part_number",
      headerName: "CIMCON Part No.",
      width: 150,
      editable: false,
    },
    {
      field: "mfg_part_number",
      headerName: "Mfg. Part No.",
      width: 150,
      editable: false,
    },
    {
      field: "material_description",
      headerName: "Material Desc.",
      width: 180,
      editable: false,
    },
    { field: "make", headerName: "Make", width: 150, editable: false },
    {
      field: "material_group",
      headerName: "Material Group",
      width: 150,
      editable: false,
    },
    {
      field: "required_quantity",
      headerName: "Required Qty",
      width: 150,
      editable: false,
    },
    { field: "unit", headerName: "UoM", width: 100, editable: false },
    {
      field: "required_by",
      headerName: "Required By",
      width: 150,
      editable: false,
    },
    { field: "soh", headerName: "SOH", width: 150, editable: false },
    {
      field: "balance_quantity",
      headerName: "Balance Qty",
      width: 150,
      editable: false,
    },
    {
      field: "ordering_qty",
      headerName: "Ordering Qty",
      width: 150,
      editable: false,
    },

    {
      field: "project_name",
      headerName: "Project Name",
      width: 200,
      editable: false,
    },
    { field: "remarks", headerName: "Remarks", width: 200, editable: false },
  ];

  // Add after state declarations
  const generatePO = async (poData: any) => {
    try {
      // Refresh the data from the server to get the latest status
      await fetchData(false);

      // Update the local state to ensure UI is in sync
      setRows((prevRows) =>
        prevRows.map((row) => {
          const isIncluded = poData.items.some(
            (item) => item.requisition_id === row.id
          );

          if (isIncluded) {
            return {
              ...row,
              ordering_status: "Ordered",
            };
          }
          return row;
        })
      );

      setSuccess("Purchase Order generated and saved successfully");
      setSnackbarOpen(true);
      setPODialogOpen(false);

      // Clear selections after successful PO generation
      setSelectedRows([]);
    } catch (error) {
      console.error("Error processing PO:", error);
      setError(
        error.response?.data?.error || "Failed to process Purchase Order"
      );
      setSnackbarOpen(true);
    }
  };

  const handleGeneratePOClick = () => {
    const selectedData = rows.filter((row) => selectedRows.includes(row.id));
    if (selectedData.length === 0) {
      setError("Please select at least one row");
      setSnackbarOpen(true);
      return;
    }

    // Check if order_type exists at all first
    const hasOrderType = selectedData.some((item) =>
      item.hasOwnProperty("order_type")
    );

    if (!hasOrderType) {
      setError(
        "Order type information is missing from the database. Please contact your administrator."
      );
      setSnackbarOpen(true);
      return;
    }

    // Check if all selected items have the same order_type
    const orderTypes = [
      ...new Set(selectedData.map((item) => item.order_type)),
    ];

    if (orderTypes.length > 1) {
      setError(
        "Cannot generate PO with different order types. Please select items with the same order type."
      );
      setSnackbarOpen(true);
      return;
    }

    setPODialogOpen(true);
  };

  const applyFilters = () => {
    let result = [...rows];

    // Apply indent date range filter
    if (filters.indentDateFrom) {
      const fromDate = new Date(filters.indentDateFrom);
      result = result.filter((item) => {
        const itemDate = new Date(item.indent_date);
        return itemDate >= fromDate;
      });
    }

    if (filters.indentDateTo) {
      const toDate = new Date(filters.indentDateTo);
      toDate.setHours(23, 59, 59, 999); // End of day
      result = result.filter((item) => {
        const itemDate = new Date(item.indent_date);
        return itemDate <= toDate;
      });
    }

    // Apply project code filter
    if (filters.projectCode) {
      result = result.filter((item) =>
        item.project_code
          ?.toLowerCase()
          .includes(filters.projectCode.toLowerCase())
      );
    }

    // Apply status filter
    if (filters.status) {
      result = result.filter((item) => item.ordering_status === filters.status);
    }

    // Apply CIMCON part number filter
    if (filters.cimconPartNo) {
      result = result.filter((item) =>
        item.cimcon_part_number
          ?.toLowerCase()
          .includes(filters.cimconPartNo.toLowerCase())
      );
    }

    // Apply MFG part number filter
    if (filters.mfgPartNo) {
      result = result.filter((item) =>
        item.mfg_part_number
          ?.toLowerCase()
          .includes(filters.mfgPartNo.toLowerCase())
      );
    }

    // Apply material description filter
    if (filters.materialDescription) {
      result = result.filter((item) =>
        item.material_description
          ?.toLowerCase()
          .includes(filters.materialDescription.toLowerCase())
      );
    }

    // Apply make filter
    if (filters.make) {
      result = result.filter((item) =>
        item.make?.toLowerCase().includes(filters.make.toLowerCase())
      );
    }

    // Apply material group filter
    if (filters.materialGroup) {
      result = result.filter((item) =>
        item.material_group
          ?.toLowerCase()
          .includes(filters.materialGroup.toLowerCase())
      );
    }

    setFilteredRows(result);
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      indentDateFrom: "",
      indentDateTo: "",
      projectCode: "",
      status: "",
      cimconPartNo: "",
      mfgPartNo: "",
      materialDescription: "",
      make: "",
      materialGroup: "",
    });
  };

  // Extract unique values for dropdowns
  const uniqueProjectCodes = [
    ...new Set(rows.map((item) => item.project_code)),
  ].filter(Boolean);
  const uniqueMakes = [...new Set(rows.map((item) => item.make))].filter(
    Boolean
  );
  const uniqueMaterialGroups = [
    ...new Set(rows.map((item) => item.material_group)),
  ].filter(Boolean);
  const statusOptions = [
    "In Progress",
    "Ordered",
    "Partially Ordered",
    "Delivered",
    "Partially Delivered",
    "Cancelled",
    "On Hold",
  ];

  // Add this function before the return statement
  const isRowSelectable = (params) => {
    // Prevent selection of rows with "Ordered" status
    return params.row.ordering_status !== "Ordered";
  };

  // Update the onRowSelectionModelChange handler
  const handleRowSelectionChange = (newSelection) => {
    // Filter out any "Ordered" items that might have been selected
    const selectableRows = newSelection.filter((id) => {
      const row = (filteredRows.length > 0 ? filteredRows : rows).find(
        (r) => r.id === id
      );
      return row && row.ordering_status !== "Ordered";
    });
    setSelectedRows(selectableRows);
  };

  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await fetchData(false);
      // Show success message
      setSnackbar({
        open: true,
        message: "Data refreshed successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Failed to refresh data",
        severity: "error",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Calculate pagination info
  const totalRows = filteredRows.length > 0 ? filteredRows.length : rows.length;
  const totalPages = Math.ceil(totalRows / paginationModel.pageSize);
  const startIndex = paginationModel.page * paginationModel.pageSize + 1;
  const endIndex = Math.min(
    (paginationModel.page + 1) * paginationModel.pageSize,
    totalRows
  );

  // Pagination handlers
  const handlePageChange = (newPage: number) => {
    setPaginationModel((prev) => ({ ...prev, page: newPage }));
  };

  const handlePageSizeChange = (newPageSize: number) => {
    setPaginationModel({ page: 0, pageSize: newPageSize });
  };

  // Update the CustomPaginationControls component for better responsiveness
  const CustomPaginationControls = ({
    position,
  }: {
    position: "top" | "bottom";
  }) => (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", md: "row" }, // Stack on mobile, row on desktop
        justifyContent: "space-between",
        alignItems: { xs: "stretch", md: "center" },
        gap: { xs: 2, md: 0 },
        p: 2,
        backgroundColor: position === "top" ? "#f8f9fa" : "#f5f5f5",
        borderRadius: position === "top" ? "8px 8px 0 0" : "0 0 8px 8px",
        border: "1px solid #e0e0e0",
        borderBottom: position === "top" ? "none" : "1px solid #e0e0e0",
        borderTop: position === "bottom" ? "none" : "1px solid #e0e0e0",
      }}
    >
      {/* Left side - Items per page */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          flexWrap: "wrap",
          justifyContent: { xs: "center", md: "flex-start" },
        }}
      >
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Items per page</InputLabel>
          <Select
            value={paginationModel.pageSize}
            onChange={(e) => handlePageSizeChange(Number(e.target.value))}
            label="Items per page"
          >
            <MenuItem value={15}>15 per page</MenuItem>
            <MenuItem value={25}>25 per page</MenuItem>
            <MenuItem value={50}>50 per page</MenuItem>
            <MenuItem value={100}>100 per page</MenuItem>
          </Select>
        </FormControl>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            fontSize: { xs: "0.75rem", md: "0.875rem" },
            textAlign: { xs: "center", md: "left" },
          }}
        >
          Showing {totalRows > 0 ? startIndex : 0} to {endIndex} of {totalRows}{" "}
          entries
        </Typography>
      </Box>

      {/* Right side - Page navigation */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          flexWrap: "wrap",
          justifyContent: { xs: "center", md: "flex-end" },
        }}
      >
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{
            mr: { xs: 0, md: 2 },
            fontSize: { xs: "0.75rem", md: "0.875rem" },
          }}
        >
          Page {paginationModel.page + 1} of {totalPages}
        </Typography>

        {/* Navigation buttons container */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          {/* First Page */}
          <IconButton
            onClick={() => handlePageChange(0)}
            disabled={paginationModel.page === 0}
            size="small"
            title="First Page"
          >
            <FirstPage />
          </IconButton>

          {/* Previous Page */}
          <IconButton
            onClick={() => handlePageChange(paginationModel.page - 1)}
            disabled={paginationModel.page === 0}
            size="small"
            title="Previous Page"
          >
            <NavigateBefore />
          </IconButton>

          {/* Page Numbers - Hide on very small screens */}
          <Box sx={{ display: { xs: "none", sm: "block" } }}>
            <Pagination
              count={totalPages}
              page={paginationModel.page + 1}
              onChange={(_, page) => handlePageChange(page - 1)}
              size="small"
              showFirstButton={false}
              showLastButton={false}
              siblingCount={0} // Reduce siblings on smaller screens
              boundaryCount={1}
              sx={{
                "& .MuiPaginationItem-root": {
                  minWidth: "28px",
                  height: "28px",
                  fontSize: "0.75rem",
                },
              }}
            />
          </Box>

          {/* Next Page */}
          <IconButton
            onClick={() => handlePageChange(paginationModel.page + 1)}
            disabled={paginationModel.page >= totalPages - 1}
            size="small"
            title="Next Page"
          >
            <NavigateNext />
          </IconButton>

          {/* Last Page */}
          <IconButton
            onClick={() => handlePageChange(totalPages - 1)}
            disabled={paginationModel.page >= totalPages - 1}
            size="small"
            title="Last Page"
          >
            <LastPage />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box
      className="master-container"
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden", // Prevent main container overflow
        padding: "16px", // Add some padding
        boxSizing: "border-box",
      }}
    >
      <Box className="header-section" sx={{ flexShrink: 0, mb: 2 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            gap: { xs: 2, md: 0 },
            width: "100%",
          }}
        >
          <Box>
            <Typography
              variant="h4"
              className="title"
              sx={{ fontSize: { xs: "1.5rem", md: "2rem" } }}
            >
              Master Database
            </Typography>
            <Typography
              variant="subtitle1"
              className="subtitle"
              sx={{ fontSize: { xs: "0.875rem", md: "1rem" } }}
            >
              View and manage all approved requisitions
            </Typography>
          </Box>
          <Button
            variant="outlined"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            startIcon={
              isRefreshing ? <CircularProgress size={20} /> : <RefreshIcon />
            }
            sx={{
              height: "fit-content",
              minWidth: { xs: "100%", md: "auto" },
            }}
          >
            {isRefreshing ? "Refreshing..." : "Refresh Data"}
          </Button>
        </Box>
      </Box>

      <Box
        className="grid-container"
        sx={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          overflow: "hidden",
          maxWidth: "100%", // Prevent horizontal overflow
        }}
      >
        <Box
          sx={{
            mb: 2,
            display: "flex",
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          <Button
            variant="contained"
            color="primary"
            onClick={handleGeneratePOClick}
            disabled={selectedRows.length === 0}
            startIcon={<AddIcon />}
            sx={{
              minWidth: { xs: "100%", md: "auto" },
            }}
          >
            Generate PO
          </Button>
        </Box>

        {/* Filter Panel with overflow control */}
        <Box
          className="filter-panel"
          sx={{ mb: 2, flexShrink: 0, maxWidth: "100%" }}
        >
          <Accordion
            expanded={filterPanelOpen}
            onChange={() => setFilterPanelOpen(!filterPanelOpen)}
            sx={{
              borderRadius: "8px",
              overflow: "hidden",
              boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
              maxWidth: "100%",
            }}
          >
            <AccordionSummary
              expandIcon={<ExpandMoreIcon />}
              sx={{
                backgroundColor: "#f5f9ff",
                borderBottom: "1px solid #e0e0e0",
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center" }}>
                <FilterListIcon sx={{ mr: 1, color: "primary.main" }} />
                <Typography variant="subtitle1" fontWeight="600">
                  Filter Requisitions
                </Typography>
                {Object.values(filters).some((value) => value !== "") && (
                  <Chip
                    label="Filters Applied"
                    color="primary"
                    size="small"
                    sx={{ ml: 2 }}
                  />
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails sx={{ p: 3, backgroundColor: "#fafafa" }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={3}>
                  <TextField
                    label="Indent Date From"
                    type="date"
                    size="small"
                    fullWidth
                    value={filters.indentDateFrom}
                    onChange={(e) =>
                      handleFilterChange("indentDateFrom", e.target.value)
                    }
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    label="Indent Date To"
                    type="date"
                    size="small"
                    fullWidth
                    value={filters.indentDateTo}
                    onChange={(e) =>
                      handleFilterChange("indentDateTo", e.target.value)
                    }
                    InputLabelProps={{
                      shrink: true,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth variant="outlined" size="small">
                    <InputLabel>Project Code</InputLabel>
                    <Select
                      value={filters.projectCode}
                      onChange={(e) =>
                        handleFilterChange("projectCode", e.target.value)
                      }
                      label="Project Code"
                    >
                      <MenuItem value="">
                        <em>All Project Codes</em>
                      </MenuItem>
                      {uniqueProjectCodes.sort().map((code) => (
                        <MenuItem key={code} value={code}>
                          {code}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth variant="outlined" size="small">
                    <InputLabel>Status</InputLabel>
                    <Select
                      value={filters.status}
                      onChange={(e) =>
                        handleFilterChange("status", e.target.value)
                      }
                      label="Status"
                    >
                      <MenuItem value="">
                        <em>All Statuses</em>
                      </MenuItem>
                      {statusOptions.map((status) => (
                        <MenuItem key={status} value={status}>
                          {status}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    label="CIMCON Part No."
                    size="small"
                    fullWidth
                    value={filters.cimconPartNo}
                    onChange={(e) =>
                      handleFilterChange("cimconPartNo", e.target.value)
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    label="MFG Part No."
                    size="small"
                    fullWidth
                    value={filters.mfgPartNo}
                    onChange={(e) =>
                      handleFilterChange("mfgPartNo", e.target.value)
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <TextField
                    label="Material Description"
                    size="small"
                    fullWidth
                    value={filters.materialDescription}
                    onChange={(e) =>
                      handleFilterChange("materialDescription", e.target.value)
                    }
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth variant="outlined" size="small">
                    <InputLabel>Make</InputLabel>
                    <Select
                      value={filters.make}
                      onChange={(e) =>
                        handleFilterChange("make", e.target.value)
                      }
                      label="Make"
                    >
                      <MenuItem value="">
                        <em>All Makes</em>
                      </MenuItem>
                      {uniqueMakes.sort().map((make) => (
                        <MenuItem key={make} value={make}>
                          {make}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <FormControl fullWidth variant="outlined" size="small">
                    <InputLabel>Material Group</InputLabel>
                    <Select
                      value={filters.materialGroup}
                      onChange={(e) =>
                        handleFilterChange("materialGroup", e.target.value)
                      }
                      label="Material Group"
                    >
                      <MenuItem value="">
                        <em>All Material Groups</em>
                      </MenuItem>
                      {uniqueMaterialGroups.sort().map((group) => (
                        <MenuItem key={group} value={group}>
                          {group}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} md={3}>
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={clearFilters}
                    startIcon={<ClearIcon />}
                    fullWidth
                    sx={{ height: "40px" }}
                  >
                    Clear Filters
                  </Button>
                </Grid>
              </Grid>

              {/* Active filters summary */}
              {Object.values(filters).some((value) => value !== "") && (
                <Box sx={{ mt: 2, pt: 2, borderTop: "1px solid #e0e0e0" }}>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    gutterBottom
                  >
                    Active filters:
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                    {filters.indentDateFrom && (
                      <Chip
                        label={`From: ${new Date(
                          filters.indentDateFrom
                        ).toLocaleDateString()}`}
                        onDelete={() =>
                          handleFilterChange("indentDateFrom", "")
                        }
                        size="small"
                      />
                    )}
                    {filters.indentDateTo && (
                      <Chip
                        label={`To: ${new Date(
                          filters.indentDateTo
                        ).toLocaleDateString()}`}
                        onDelete={() => handleFilterChange("indentDateTo", "")}
                        size="small"
                      />
                    )}
                    {filters.projectCode && (
                      <Chip
                        label={`Project: ${filters.projectCode}`}
                        onDelete={() => handleFilterChange("projectCode", "")}
                        size="small"
                      />
                    )}
                    {filters.status && (
                      <Chip
                        label={`Status: ${filters.status}`}
                        onDelete={() => handleFilterChange("status", "")}
                        size="small"
                      />
                    )}
                    {filters.cimconPartNo && (
                      <Chip
                        label={`CIMCON Part: ${filters.cimconPartNo}`}
                        onDelete={() => handleFilterChange("cimconPartNo", "")}
                        size="small"
                      />
                    )}
                    {filters.mfgPartNo && (
                      <Chip
                        label={`MFG Part: ${filters.mfgPartNo}`}
                        onDelete={() => handleFilterChange("mfgPartNo", "")}
                        size="small"
                      />
                    )}
                    {filters.materialDescription && (
                      <Chip
                        label={`Description: ${filters.materialDescription}`}
                        onDelete={() =>
                          handleFilterChange("materialDescription", "")
                        }
                        size="small"
                      />
                    )}
                    {filters.make && (
                      <Chip
                        label={`Make: ${filters.make}`}
                        onDelete={() => handleFilterChange("make", "")}
                        size="small"
                      />
                    )}
                    {filters.materialGroup && (
                      <Chip
                        label={`Material Group: ${filters.materialGroup}`}
                        onDelete={() => handleFilterChange("materialGroup", "")}
                        size="small"
                      />
                    )}
                  </Box>
                </Box>
              )}

              <Box
                sx={{
                  mt: 2,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {filteredRows.length} requisitions found
                </Typography>
              </Box>
            </AccordionDetails>
          </Accordion>
        </Box>

        {loading ? (
          <Box
            className="loading-container"
            sx={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <CircularProgress size={48} />
            <Typography variant="h6" color="text.secondary">
              Loading Master Data...
            </Typography>
          </Box>
        ) : (
          <Box
            sx={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
              maxWidth: "100%", // Prevent overflow
              overflow: "hidden",
            }}
          >
            {/* Top Pagination Controls with overflow fix */}
            <Box
              sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                justifyContent: "space-between",
                alignItems: { xs: "stretch", sm: "center" },
                gap: { xs: 1, sm: 2 },
                p: { xs: 1, sm: 2 },
                backgroundColor: "#f8f9fa",
                borderRadius: "8px 8px 0 0",
                border: "1px solid #e0e0e0",
                borderBottom: "none",
                flexShrink: 0,
                maxWidth: "100%",
                overflow: "hidden",
              }}
            >
              {/* Left side - Items per page */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: { xs: 1, sm: 2 },
                  flexWrap: "wrap",
                  justifyContent: { xs: "center", sm: "flex-start" },
                  minWidth: 0, // Allow shrinking
                }}
              >
                <FormControl size="small" sx={{ minWidth: 120, maxWidth: 140 }}>
                  <InputLabel>Items per page</InputLabel>
                  <Select
                    value={paginationModel.pageSize}
                    onChange={(e) =>
                      handlePageSizeChange(Number(e.target.value))
                    }
                    label="Items per page"
                  >
                    <MenuItem value={15}>15 per page</MenuItem>
                    <MenuItem value={25}>25 per page</MenuItem>
                    <MenuItem value={50}>50 per page</MenuItem>
                    <MenuItem value={100}>100 per page</MenuItem>
                  </Select>
                </FormControl>

                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontSize: { xs: "0.7rem", sm: "0.875rem" },
                    textAlign: { xs: "center", sm: "left" },
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  Showing {totalRows > 0 ? startIndex : 0} to {endIndex} of{" "}
                  {totalRows} entries
                </Typography>
              </Box>

              {/* Right side - Page navigation */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  justifyContent: { xs: "center", sm: "flex-end" },
                  flexShrink: 0,
                  minWidth: 0,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    fontSize: { xs: "0.7rem", sm: "0.875rem" },
                    whiteSpace: "nowrap",
                    mr: 1,
                  }}
                >
                  Page {paginationModel.page + 1} of {totalPages}
                </Typography>

                {/* Navigation buttons */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.25 }}>
                  <IconButton
                    onClick={() => handlePageChange(0)}
                    disabled={paginationModel.page === 0}
                    size="small"
                    title="First Page"
                    sx={{ minWidth: "28px", height: "28px" }}
                  >
                    <FirstPage fontSize="small" />
                  </IconButton>

                  <IconButton
                    onClick={() => handlePageChange(paginationModel.page - 1)}
                    disabled={paginationModel.page === 0}
                    size="small"
                    title="Previous Page"
                    sx={{ minWidth: "28px", height: "28px" }}
                  >
                    <NavigateBefore fontSize="small" />
                  </IconButton>

                  {/* Compact pagination for small screens */}
                  <Box sx={{ display: { xs: "none", md: "block" } }}>
                    <Pagination
                      count={totalPages}
                      page={paginationModel.page + 1}
                      onChange={(_, page) => handlePageChange(page - 1)}
                      size="small"
                      showFirstButton={false}
                      showLastButton={false}
                      siblingCount={0}
                      boundaryCount={1}
                      sx={{
                        "& .MuiPaginationItem-root": {
                          minWidth: "24px",
                          height: "24px",
                          fontSize: "0.7rem",
                          margin: "0 1px",
                        },
                      }}
                    />
                  </Box>

                  <IconButton
                    onClick={() => handlePageChange(paginationModel.page + 1)}
                    disabled={paginationModel.page >= totalPages - 1}
                    size="small"
                    title="Next Page"
                    sx={{ minWidth: "28px", height: "28px" }}
                  >
                    <NavigateNext fontSize="small" />
                  </IconButton>

                  <IconButton
                    onClick={() => handlePageChange(totalPages - 1)}
                    disabled={paginationModel.page >= totalPages - 1}
                    size="small"
                    title="Last Page"
                    sx={{ minWidth: "28px", height: "28px" }}
                  >
                    <LastPage fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            </Box>

            {/* DataGrid Container with strict overflow control */}
            <Box
              sx={{
                flex: 1,
                minHeight: 0,
                border: "1px solid #e0e0e0",
                borderTop: "none",
                borderBottom: "1px solid #e0e0e0",
                overflow: "hidden",
                maxWidth: "100%",
                height: "100%", // Ensure explicit height
              }}
            >
              <DataGrid
                rows={filteredRows.length > 0 ? filteredRows : rows}
                rowHeight={90}
                columns={columns}
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                pageSizeOptions={[15, 25, 50, 100]}
                checkboxSelection
                disableRowSelectionOnClick
                isRowSelectable={isRowSelectable}
                onRowSelectionModelChange={handleRowSelectionChange}
                slots={{
                  toolbar: GridToolbar,
                  footer: () => null,
                }}
                rowSelectionModel={selectedRows}
                getRowId={(row) => row.id}
                processRowUpdate={handleProcessRowUpdate}
                onProcessRowUpdateError={handleProcessRowUpdateError}
                editMode="row"
                rowModesModel={rowModesModel}
                onRowModesModelChange={(newModel) => setRowModesModel(newModel)}
                className="data-grid"
                density="compact"
                hideFooterPagination
                sx={{
                  width: "100%",
                  height: "100%",
                  border: "none",
                  // Force proper scrolling behavior
                  "& .MuiDataGrid-main": {
                    overflow: "visible", // Allow main to show scrollbars
                  },
                  "& .MuiDataGrid-virtualScroller": {
                    overflow: "auto !important", // Force scrollbars to show
                    maxWidth: "100%",
                    maxHeight: "100%",
                    // Enhanced scrollbar visibility - make them always visible
                    "&::-webkit-scrollbar": {
                      width: "14px",
                      height: "14px",
                      backgroundColor: "#f1f1f1",
                    },
                    "&::-webkit-scrollbar-track": {
                      backgroundColor: "#f1f1f1",
                      borderRadius: "7px",
                      border: "1px solid #e0e0e0",
                    },
                    "&::-webkit-scrollbar-thumb": {
                      backgroundColor: "#888",
                      borderRadius: "7px",
                      border: "2px solid #f1f1f1",
                      "&:hover": {
                        backgroundColor: "#555",
                      },
                      "&:active": {
                        backgroundColor: "#333",
                      },
                    },
                    "&::-webkit-scrollbar-corner": {
                      backgroundColor: "#f1f1f1",
                    },
                    // For Firefox - force visible scrollbars
                    scrollbarWidth: "auto", // Changed from "thin" to "auto"
                    scrollbarColor: "#888 #f1f1f1",
                  },
                  // Force scrollbar to always be visible
                  "& .MuiDataGrid-virtualScrollerContent": {
                    overflow: "visible",
                  },
                  "& .MuiDataGrid-virtualScrollerRenderZone": {
                    overflow: "visible",
                  },
                  "& .MuiDataGrid-footerContainer": {
                    display: "none",
                  },
                  // Responsive column adjustments
                  "& .MuiDataGrid-columnHeaders": {
                    fontSize: { xs: "0.7rem", md: "0.875rem" },
                    minHeight: "40px !important",
                    maxHeight: "40px !important",
                    position: "sticky",
                    top: 0,
                    zIndex: 1,
                  },
                  "& .MuiDataGrid-cell": {
                    fontSize: { xs: "0.7rem", md: "0.875rem" },
                    padding: { xs: "2px 4px", md: "4px 8px" },
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  },
                  // Ensure rows don't overflow
                  "& .MuiDataGrid-row": {
                    maxWidth: "100%",
                    "&[data-selectable='false']": {
                      backgroundColor: "#f5f5f5",
                      opacity: 0.6,
                      "& .MuiCheckbox-root": {
                        display: "none",
                      },
                    },
                  },
                  // Control column widths to prevent overflow
                  "& .MuiDataGrid-columnHeader": {
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  },
                }}
              />
            </Box>

            {/* Export Button */}
            <Box
              sx={{
                mt: 2,
                display: "flex",
                justifyContent: { xs: "center", md: "flex-end" },
                flexShrink: 0,
                maxWidth: "100%",
              }}
            >
              {/* <Button
                onClick={() =>
                  exportToCsv(
                    filteredRows.length > 0 ? filteredRows : rows,
                    "master-data.csv"
                  )
                }
                startIcon={<FileDownloadIcon />}
                variant="outlined"
                size="small"
                sx={{ minWidth: { xs: "150px", md: "auto" } }}
              >
                Export CSV
              </Button> */}
            </Box>
          </Box>
        )}
      </Box>

      <Snackbar
        open={!!error || !!success}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={error ? "error" : "success"}
          sx={{ width: "100%" }}
        >
          {error || success}
        </Alert>
      </Snackbar>

      {poDialogOpen && (
        <POPreviewDialog
          open={poDialogOpen}
          onClose={() => setPODialogOpen(false)}
          selectedRows={rows.filter((row) => selectedRows.includes(row.id))}
          onGenerate={generatePO}
        />
      )}
    </Box>
  );
};

export default MasterSheet;
