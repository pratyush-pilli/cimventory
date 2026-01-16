import React, { useEffect, useState } from "react";
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbarContainer,
  GridToolbarExport,
  GridToolbarFilterButton,
  GridToolbarColumnsButton,
} from "@mui/x-data-grid";
import axios from "axios";
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  CircularProgress,
  useTheme,
  Link,
  Button,
} from "@mui/material";
import configuration from "../../configuration";
import "../Master/master.scss";
import SearchIcon from "@mui/icons-material/Search";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FilterListIcon from "@mui/icons-material/FilterList";
import ClearIcon from "@mui/icons-material/Clear";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import BusinessIcon from "@mui/icons-material/Business";
import InputAdornment from "@mui/material/InputAdornment";
import DescriptionIcon from "@mui/icons-material/Description";
import NoDocumentIcon from "@mui/icons-material/DoNotDisturbAlt";

// Custom toolbar with better styling
interface CustomToolbarProps {
  data: any[];
}

const CustomToolbar: React.FC<CustomToolbarProps> = ({ data }) => {
  const handleExport = () => {
    exportToCsv(data, "vendor-data.csv");
  };

  return (
    <GridToolbarContainer sx={{ p: 1, justifyContent: "space-between" }}>
      <Box>
        <GridToolbarColumnsButton sx={{ mr: 1 }} />
        <GridToolbarFilterButton sx={{ mr: 1 }} />
        <GridToolbarExport
          printOptions={{ disableToolbarButton: true }}
          csvOptions={{
            fileName: "VendorData",
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

const VendorDataGrid = () => {
  const theme = useTheme();
  const [vendors, setVendors] = useState<any[]>([]);
  const [filteredVendors, setFilteredVendors] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Advanced filtering states
  const [advancedFilterOpen, setAdvancedFilterOpen] = useState(false);
  const [filterCriteria, setFilterCriteria] = useState({
    category: "",
    paymentTerm: "",
    hasDocuments: "",
  });

  // Get unique categories for the filter dropdown
  const uniqueCategories = [
    ...new Set(vendors.map((vendor) => vendor.product_category)),
  ]
    .filter(Boolean)
    .sort();

  // Get unique payment terms for the filter dropdown
  const uniquePaymentTerms = [
    ...new Set(vendors.map((vendor) => vendor.payment_term)),
  ]
    .filter(Boolean)
    .sort();

  useEffect(() => {
    fetchVendors();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [vendors, searchTerm, filterCriteria]);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}/vendors/approved/`
      );
      setVendors(response.data);
      setSuccess("Vendors loaded successfully");
    } catch (error) {
      console.error("Error fetching vendors:", error);
      setError("Failed to fetch vendors.");
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
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
  const applyFilters = () => {
    let result = [...vendors];

    // Apply search term filter (searches across multiple fields)
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      result = result.filter(
        (vendor) =>
          (vendor.vendor_name &&
            vendor.vendor_name.toLowerCase().includes(searchLower)) ||
          (vendor.vendor_id &&
            vendor.vendor_id.toLowerCase().includes(searchLower)) ||
          (vendor.contact_person &&
            vendor.contact_person.toLowerCase().includes(searchLower)) ||
          (vendor.email_1 && vendor.email_1.toLowerCase().includes(searchLower))
      );
    }

    // Apply advanced filters
    if (filterCriteria.category) {
      result = result.filter(
        (vendor) => vendor.product_category === filterCriteria.category
      );
    }

    if (filterCriteria.paymentTerm) {
      result = result.filter(
        (vendor) => vendor.payment_term === filterCriteria.paymentTerm
      );
    }

    if (filterCriteria.hasDocuments) {
      if (filterCriteria.hasDocuments === "yes") {
        result = result.filter(
          (vendor) =>
            vendor.pan_card ||
            vendor.gst_certificate ||
            vendor.incorporation_certificate ||
            vendor.cancelled_cheque ||
            vendor.tan_allotment_letter ||
            vendor.vendor_reg_form ||
            vendor.udyam_certificate_msme
        );
      } else if (filterCriteria.hasDocuments === "no") {
        result = result.filter(
          (vendor) =>
            !vendor.pan_card &&
            !vendor.gst_certificate &&
            !vendor.incorporation_certificate &&
            !vendor.cancelled_cheque &&
            !vendor.tan_allotment_letter &&
            !vendor.vendor_reg_form &&
            !vendor.udyam_certificate_msme
        );
      }
    }

    setFilteredVendors(result);
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
      category: "",
      paymentTerm: "",
      hasDocuments: "",
    });
  };

  const renderDownloadLink = (
    params: GridRenderCellParams,
    fieldName: string,
    displayName: string
  ) => {
    const hasDocument = Boolean(params.value);

    return (
      <Tooltip
        title={
          hasDocument ? `Download ${displayName}` : `No ${displayName} uploaded`
        }
      >
        <Box>
          {hasDocument ? (
            <IconButton
              color="primary"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                window.open(
                  `${configuration.api_url}/vendors/${params.row.id}/download/${fieldName}/`,
                  "_blank"
                );
              }}
            >
              <FileDownloadIcon />
            </IconButton>
          ) : (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "flex", alignItems: "center" }}
            >
              <NoDocumentIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.6 }} />
              Not available
            </Typography>
          )}
        </Box>
      </Tooltip>
    );
  };

  const columns: GridColDef[] = [
    {
      field: "vendor_id",
      headerName: "Vendor ID",
      width: 120,
      renderCell: (params) => (
        <Tooltip title={params.value || ""}>
          <Chip
            label={params.value || "N/A"}
            size="small"
            color="primary"
            variant="outlined"
          />
        </Tooltip>
      ),
    },
    {
      field: "vendor_name",
      headerName: "Vendor Name",
      width: 200,
      renderCell: (params) => (
        <Tooltip title={params.value || ""}>
          <Box sx={{ display: "flex", alignItems: "center" }}>
            <BusinessIcon
              sx={{ mr: 1, color: theme.palette.primary.main, fontSize: 20 }}
            />
            <Typography sx={{ fontWeight: "medium" }}>
              {params.value || "N/A"}
            </Typography>
          </Box>
        </Tooltip>
      ),
    },
    {
      field: "product_category",
      headerName: "Product Category",
      width: 180,
      renderCell: (params) => (
        <Tooltip title={params.value || "No category specified"}>
          <Typography>{params.value || "-"}</Typography>
        </Tooltip>
      ),
    },
    {
      field: "contact_person",
      headerName: "Contact Person",
      width: 180,
      renderCell: (params) => (
        <Tooltip title={params.value || "No contact person specified"}>
          <Typography>{params.value || "-"}</Typography>
        </Tooltip>
      ),
    },
    {
      field: "mobile_no_1",
      headerName: "Primary Mobile",
      width: 150,
      renderCell: (params) => (
        <Tooltip
          title={params.value ? `Call: ${params.value}` : "No mobile number"}
        >
          <Typography>{params.value || "-"}</Typography>
        </Tooltip>
      ),
    },
    {
      field: "mobile_no_2",
      headerName: "Secondary Mobile",
      width: 150,
      renderCell: (params) => (
        <Tooltip
          title={params.value ? `Call: ${params.value}` : "No secondary mobile"}
        >
          <Typography>{params.value || "-"}</Typography>
        </Tooltip>
      ),
    },
    {
      field: "email_1",
      headerName: "Primary Email",
      width: 200,
      renderCell: (params) => (
        <Tooltip
          title={params.value ? `Email: ${params.value}` : "No email specified"}
        >
          <Link
            href={params.value ? `mailto:${params.value}` : "#"}
            color={params.value ? "primary" : "inherit"}
            sx={{ textDecoration: params.value ? "underline" : "none" }}
            onClick={(e) => {
              if (!params.value) e.preventDefault();
            }}
          >
            {params.value || "-"}
          </Link>
        </Tooltip>
      ),
    },
    {
      field: "email_2",
      headerName: "Secondary Email",
      width: 200,
      renderCell: (params) => (
        <Tooltip
          title={params.value ? `Email: ${params.value}` : "No secondary email"}
        >
          <Link
            href={params.value ? `mailto:${params.value}` : "#"}
            color={params.value ? "primary" : "inherit"}
            sx={{ textDecoration: params.value ? "underline" : "none" }}
            onClick={(e) => {
              if (!params.value) e.preventDefault();
            }}
          >
            {params.value || "-"}
          </Link>
        </Tooltip>
      ),
    },
    {
      field: "website",
      headerName: "Website",
      width: 180,
      renderCell: (params) => {
        // Ensure the URL has http/https prefix
        let url = params.value;
        if (url && !/^https?:\/\//i.test(url)) {
          url = "https://" + url;
        }

        return (
          <Tooltip
            title={
              params.value ? `Visit website: ${params.value}` : "No website"
            }
          >
            <Link
              href={url || "#"}
              target="_blank"
              rel="noopener noreferrer"
              color={params.value ? "primary" : "inherit"}
              sx={{ textDecoration: params.value ? "underline" : "none" }}
              onClick={(e) => {
                if (!params.value) e.preventDefault();
              }}
            >
              {params.value || "-"}
            </Link>
          </Tooltip>
        );
      },
    },
    {
      field: "address",
      headerName: "Address",
      width: 250,
      renderCell: (params) => (
        <Tooltip title={params.value || "No address specified"}>
          <Typography
            sx={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {params.value || "-"}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: "payment_term",
      headerName: "Payment Term",
      width: 150,
      renderCell: (params) => (
        <Tooltip title={params.value || "No payment terms specified"}>
          <Chip
            label={params.value || "Not specified"}
            size="small"
            color={params.value ? "default" : "default"}
            variant="outlined"
          />
        </Tooltip>
      ),
    },
    // Add these fields to the columns array, before the document columns

    {
      field: "gst_number",
      headerName: "GST Number",
      width: 180,
      renderCell: (params) => (
        <Tooltip title={params.value || "No GST Number available"}>
          <Typography>{params.value || "-"}</Typography>
        </Tooltip>
      ),
    },
    {
      field: "pan_number",
      headerName: "PAN Number",
      width: 150,
      renderCell: (params) => (
        <Tooltip title={params.value || "No PAN Number available"}>
          <Typography fontWeight={params.value ? "medium" : "normal"}>
            {params.value || "-"}
          </Typography>
        </Tooltip>
      ),
    },
    {
      field: "state",
      headerName: "State",
      width: 150,
      renderCell: (params) => (
        <Tooltip title={params.value || "State not specified"}>
          <Typography>{params.value || "-"}</Typography>
        </Tooltip>
      ),
    },
    {
      field: "state_code",
      headerName: "State Code",
      width: 110,
      renderCell: (params) => (
        <Tooltip
          title={params.value ? `State Code: ${params.value}` : "No state code"}
        >
          <Chip
            label={params.value || "N/A"}
            size="small"
            variant="outlined"
            color="default"
          />
        </Tooltip>
      ),
    },
    {
      field: "pan_card",
      headerName: "PAN Card",
      width: 130,
      renderCell: (params) =>
        renderDownloadLink(params, "pan_card", "PAN Card"),
    },
    {
      field: "gst_certificate",
      headerName: "GST Cert.",
      width: 130,
      renderCell: (params) =>
        renderDownloadLink(params, "gst_certificate", "GST Certificate"),
    },
    {
      field: "incorporation_certificate",
      headerName: "Incorporation",
      width: 130,
      renderCell: (params) =>
        renderDownloadLink(
          params,
          "incorporation_certificate",
          "Incorporation Certificate"
        ),
    },
    {
      field: "cancelled_cheque",
      headerName: "Cheque",
      width: 130,
      renderCell: (params) =>
        renderDownloadLink(params, "cancelled_cheque", "Cancelled Cheque"),
    },
    {
      field: "tan_allotment_letter",
      headerName: "TAN Letter",
      width: 130,
      renderCell: (params) =>
        renderDownloadLink(params, "tan_allotment_letter", "TAN Letter"),
    },
    {
      field: "vendor_reg_form",
      headerName: "Reg. Form",
      width: 130,
      renderCell: (params) =>
        renderDownloadLink(params, "vendor_reg_form", "Registration Form"),
    },
    {
      field: "udyam_certificate_msme",
      headerName: "UDYAM Cert.",
      width: 130,
      renderCell: (params) =>
        renderDownloadLink(
          params,
          "udyam_certificate_msme",
          "UDYAM Certificate"
        ),
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
        Vendor Database
        <Chip
          label={`${filteredVendors.length} vendors`}
          color="primary"
          size="small"
          sx={{ ml: 2 }}
        />
      </Typography>

      {/* Main search bar with clear button */}
      <Box sx={{ mb: 2 }}>
        <TextField
          label="Search Vendors"
          placeholder="Search by name, ID, contact person, or email..."
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
            {(filterCriteria.category ||
              filterCriteria.paymentTerm ||
              filterCriteria.hasDocuments) && (
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
                <InputLabel>Product Category</InputLabel>
                <Select
                  value={filterCriteria.category}
                  onChange={(e) =>
                    handleFilterChange("category", e.target.value)
                  }
                  label="Product Category"
                >
                  <MenuItem value="">
                    <em>All Categories</em>
                  </MenuItem>
                  {uniqueCategories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Payment Term</InputLabel>
                <Select
                  value={filterCriteria.paymentTerm}
                  onChange={(e) =>
                    handleFilterChange("paymentTerm", e.target.value)
                  }
                  label="Payment Term"
                >
                  <MenuItem value="">
                    <em>All Payment Terms</em>
                  </MenuItem>
                  {uniquePaymentTerms.map((term) => (
                    <MenuItem key={term} value={term}>
                      {term}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={4}>
              <FormControl fullWidth variant="outlined" size="small">
                <InputLabel>Has Documents</InputLabel>
                <Select
                  value={filterCriteria.hasDocuments}
                  onChange={(e) =>
                    handleFilterChange("hasDocuments", e.target.value)
                  }
                  label="Has Documents"
                >
                  <MenuItem value="">
                    <em>All Vendors</em>
                  </MenuItem>
                  <MenuItem value="yes">With Documents</MenuItem>
                  <MenuItem value="no">Without Documents</MenuItem>
                </Select>
              </FormControl>
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
      {(filterCriteria.category ||
        filterCriteria.paymentTerm ||
        filterCriteria.hasDocuments) && (
        <Box sx={{ mb: 2, display: "flex", flexWrap: "wrap", gap: 1 }}>
          <Typography variant="body2" sx={{ mr: 1, color: "text.secondary" }}>
            Active filters:
          </Typography>
          {filterCriteria.category && (
            <Chip
              label={`Category: ${filterCriteria.category}`}
              size="small"
              onDelete={() => handleFilterChange("category", "")}
              color="primary"
              variant="outlined"
            />
          )}
          {filterCriteria.paymentTerm && (
            <Chip
              label={`Payment: ${filterCriteria.paymentTerm}`}
              size="small"
              onDelete={() => handleFilterChange("paymentTerm", "")}
              color="primary"
              variant="outlined"
            />
          )}
          {filterCriteria.hasDocuments && (
            <Chip
              label={`Documents: ${
                filterCriteria.hasDocuments === "yes"
                  ? "Available"
                  : "Not available"
              }`}
              size="small"
              onDelete={() => handleFilterChange("hasDocuments", "")}
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
            Loading vendor data...
          </Typography>
        </Box>
      ) : (
        <Box
          sx={{
            height: advancedFilterOpen
              ? "calc(100vh - 300px)"
              : "calc(100vh - 240px)",
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
                overflowX: "hidden",
              },
              "& .MuiDataGrid-footerContainer": {
                borderTop: "2px solid #e0e0e0",
              },
            },
          }}
        >
          <DataGrid
            rows={filteredVendors}
            columns={columns}
            initialState={{
              pagination: {
                paginationModel: { pageSize: 15, page: 0 },
              },
            }}
            pageSizeOptions={[15, 25, 50, 100]}
            disableRowSelectionOnClick
            getRowId={(row) => row.id || row.vendor_id}
            slots={{
              toolbar: CustomToolbar,
            }}
            slotProps={{
              toolbar: { data: filteredVendors },
            }}
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

export default VendorDataGrid;
