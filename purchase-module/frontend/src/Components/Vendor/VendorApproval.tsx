import React, { useEffect, useState, useMemo } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Snackbar,
  Alert,
  Chip,
  Link,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  Avatar,
  Tooltip,
  Badge,
  LinearProgress,
  TableSortLabel,
} from "@mui/material";

import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import BusinessIcon from "@mui/icons-material/Business";
import PersonIcon from "@mui/icons-material/Person";
import EmailIcon from "@mui/icons-material/Email";
import PhoneIcon from "@mui/icons-material/Phone";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import DescriptionIcon from "@mui/icons-material/Description";
import VerifiedIcon from "@mui/icons-material/Verified";
import PendingIcon from "@mui/icons-material/Pending";
import SearchIcon from "@mui/icons-material/Search";
import FilterListIcon from "@mui/icons-material/FilterList";
import CheckIcon from "@mui/icons-material/Check";
import CloseIcon from "@mui/icons-material/Close";
import DownloadIcon from "@mui/icons-material/Download";
import axios from "axios";
import configuration from "../../configuration";

// Enhanced Vendor interface with all available fields
interface Vendor {
  id: number;
  vendor_id: string;
  vendor_name: string;
  status: "pending" | "approved" | "rejected";
  product_category: string;
  contact_person: string;
  mobile_no_1: string;
  mobile_no_2: string;
  email_1: string;
  email_2: string;
  website: string;
  address: string;
  payment_term: string;
  registration_form_received: boolean;
  pan_card: string | null;
  gst_certificate: string | null;
  incorporation_certificate: string | null;
  cancelled_cheque: string | null;
  tan_allotment_letter: string | null;
  udyam_certificate_msme: string | null;
  vendor_reg_form: string | null;
  remarks?: string;
}

type SortField =
  | "vendor_id"
  | "vendor_name"
  | "contact_person"
  | "email_1"
  | "product_category"
  | "status";
type SortDirection = "asc" | "desc";

const VendorApproval: React.FC = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [selectedVendors, setSelectedVendors] = useState<number[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  // Sorting state
  const [sortField, setSortField] = useState<SortField>("vendor_id");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<number[]>([]);
  const [remarks, setRemarks] = useState<string>("");
  const [rejectDialogOpen, setRejectDialogOpen] = useState<boolean>(false);
  const [vendorToReject, setVendorToReject] = useState<number | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState<boolean>(false);
  const [bulkRejectDialogOpen, setBulkRejectDialogOpen] =
    useState<boolean>(false);

  useEffect(() => {
    fetchPendingVendors();
  }, []);

  // Computed filtered and sorted vendors
  const filteredAndSortedVendors = useMemo(() => {
    // First filter
    let filtered = vendors.filter(
      (vendor) =>
        vendor.vendor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.vendor_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.contact_person
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        vendor.email_1?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        vendor.product_category
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase())
    );

    // Then sort
    filtered.sort((a, b) => {
      let aValue: any = a[sortField];
      let bValue: any = b[sortField];

      // Handle null/undefined values
      if (!aValue) aValue = "";
      if (!bValue) bValue = "";

      // Convert to strings for comparison (handles vendor_id sorting properly)
      if (typeof aValue === "string") {
        aValue = aValue.toLowerCase();
      }
      if (typeof bValue === "string") {
        bValue = bValue.toLowerCase();
      }

      let comparison = 0;
      if (aValue > bValue) {
        comparison = 1;
      } else if (aValue < bValue) {
        comparison = -1;
      }

      return sortDirection === "desc" ? comparison * -1 : comparison;
    });

    return filtered;
  }, [vendors, searchTerm, sortField, sortDirection]);

  const fetchPendingVendors = async () => {
    setLoading(true);
    try {
      const response = await axios.get(
        `${configuration.api_url}/vendors/pending/`
      );
      setVendors(response.data);
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error fetching vendors",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  // Handle sorting
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      // If same field, toggle direction
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // If different field, set new field with ascending direction
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const handleVendorSelect = (vendorId: number) => {
    setSelectedVendors((prev) => {
      if (prev.includes(vendorId)) {
        return prev.filter((id) => id !== vendorId);
      } else {
        return [...prev, vendorId];
      }
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedVendors(filteredAndSortedVendors.map((vendor) => vendor.id));
    } else {
      setSelectedVendors([]);
    }
  };

  const downloadDocument = async (
    vendorId: number,
    fieldName: string,
    documentName: string
  ) => {
    try {
      const response = await axios.get(
        `${configuration.api_url}/vendors/${vendorId}/download/${fieldName}/`,
        {
          responseType: "blob",
          headers: {
            Accept: "application/octet-stream",
          },
        }
      );

      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;

      const contentDisposition = response.headers["content-disposition"];
      let filename = `${documentName}_${vendorId}`;

      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(
          /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        );
        if (filenameMatch && filenameMatch[1]) {
          filename = filenameMatch[1].replace(/['"]/g, "");
        }
      }

      link.download = filename;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setSnackbar({
        open: true,
        message: `${documentName} downloaded successfully`,
        severity: "success",
      });
    } catch (error: any) {
      console.error("Download error:", error);

      if (error.response?.status === 404) {
        setSnackbar({
          open: true,
          message: `${documentName} not found`,
          severity: "error",
        });
      } else {
        setSnackbar({
          open: true,
          message: `Error downloading ${documentName}`,
          severity: "error",
        });
      }
    }
  };

  const handleQuickApprove = async (vendorId: number) => {
    setActionLoading((prev) => [...prev, vendorId]);
    try {
      await axios.post(
        `${configuration.api_url}/vendors/${vendorId}/approve/`,
        {
          status: "approved",
        }
      );

      setVendors(vendors.filter((vendor) => vendor.id !== vendorId));
      setSnackbar({
        open: true,
        message: "Vendor approved successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error approving vendor",
        severity: "error",
      });
    } finally {
      setActionLoading((prev) => prev.filter((id) => id !== vendorId));
    }
  };

  const handleQuickReject = (vendorId: number) => {
    setVendorToReject(vendorId);
    setRemarks("");
    setRejectDialogOpen(true);
  };

  const confirmRejection = async () => {
    if (!remarks.trim()) {
      setSnackbar({
        open: true,
        message: "Please provide rejection remarks",
        severity: "error",
      });
      return;
    }

    setActionLoading((prev) => [...prev, vendorToReject!]);
    try {
      await axios.post(
        `${configuration.api_url}/vendors/${vendorToReject}/approve/`,
        {
          status: "rejected",
          remarks: remarks,
        }
      );

      setVendors(vendors.filter((vendor) => vendor.id !== vendorToReject));
      setRejectDialogOpen(false);
      setVendorToReject(null);
      setRemarks("");

      setSnackbar({
        open: true,
        message: "Vendor rejected successfully",
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error rejecting vendor",
        severity: "error",
      });
    } finally {
      setActionLoading((prev) => prev.filter((id) => id !== vendorToReject));
    }
  };

  const handleBulkApprove = async () => {
    if (selectedVendors.length === 0) return;

    setLoading(true);
    try {
      const promises = selectedVendors.map((vendorId) =>
        axios.post(`${configuration.api_url}/vendors/${vendorId}/approve/`, {
          status: "approved",
        })
      );
      await Promise.all(promises);

      setVendors(
        vendors.filter((vendor) => !selectedVendors.includes(vendor.id))
      );
      setSelectedVendors([]);

      setSnackbar({
        open: true,
        message: `${selectedVendors.length} vendors approved successfully`,
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error approving vendors",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBulkReject = () => {
    if (selectedVendors.length === 0) return;
    setBulkRejectDialogOpen(true);
  };

  const confirmBulkRejection = async () => {
    if (!remarks.trim()) {
      setSnackbar({
        open: true,
        message: "Please provide rejection remarks",
        severity: "error",
      });
      return;
    }

    setLoading(true);
    try {
      const promises = selectedVendors.map((vendorId) =>
        axios.post(`${configuration.api_url}/vendors/${vendorId}/approve/`, {
          status: "rejected",
          remarks: remarks,
        })
      );
      await Promise.all(promises);

      setVendors(
        vendors.filter((vendor) => !selectedVendors.includes(vendor.id))
      );
      setSelectedVendors([]);
      setRemarks("");
      setBulkRejectDialogOpen(false);

      setSnackbar({
        open: true,
        message: `${selectedVendors.length} vendors rejected successfully`,
        severity: "success",
      });
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error rejecting vendors",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const viewVendorDetails = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setDetailDialogOpen(true);
  };

  const getDocumentCount = (vendor: Vendor) => {
    const docs = [
      vendor.pan_card,
      vendor.gst_certificate,
      vendor.incorporation_certificate,
      vendor.cancelled_cheque,
      vendor.tan_allotment_letter,
      vendor.udyam_certificate_msme,
      vendor.vendor_reg_form,
    ];
    return docs.filter(Boolean).length;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return { color: "#f59e0b", bg: "rgba(245, 158, 11, 0.1)" };
      case "approved":
        return { color: "#10b981", bg: "rgba(16, 185, 129, 0.1)" };
      case "rejected":
        return { color: "#ef4444", bg: "rgba(239, 68, 68, 0.1)" };
      default:
        return { color: "#6b7280", bg: "rgba(107, 114, 128, 0.1)" };
    }
  };

  const renderDocumentLink = (
    documentUrl: string | null,
    documentName: string,
    vendorId: number,
    fieldName: string
  ) => {
    if (!documentUrl)
      return (
        <Chip label="Missing" size="small" color="error" variant="outlined" />
      );
    return (
      <Tooltip title={`Download ${documentName}`}>
        <Chip
          label="Download"
          size="small"
          color="success"
          variant="outlined"
          icon={<DownloadIcon />}
          onClick={(e) => {
            e.stopPropagation();
            downloadDocument(vendorId, fieldName, documentName);
          }}
          sx={{ cursor: "pointer" }}
        />
      </Tooltip>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, color: "#1e293b" }}>
            Vendor Approval
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {filteredAndSortedVendors.length} vendors pending approval
            {searchTerm && ` (filtered from ${vendors.length} total)`}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 2 }}>
          <TextField
            placeholder="Search vendors..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            size="small"
            sx={{ minWidth: 300 }}
            InputProps={{
              startAdornment: (
                <SearchIcon sx={{ color: "text.secondary", mr: 1 }} />
              ),
            }}
          />
        </Box>
      </Box>

      {/* Sorting Info */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          Sorted by: {sortField.replace("_", " ")} (
          {sortDirection === "asc" ? "A-Z" : "Z-A"})
        </Typography>
      </Box>

      {/* Bulk Actions Bar */}
      {selectedVendors.length > 0 && (
        <Card
          elevation={3}
          sx={{
            mb: 3,
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
          }}
        >
          <CardContent sx={{ py: 2 }}>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h6">
                {selectedVendors.length} vendor
                {selectedVendors.length > 1 ? "s" : ""} selected
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  startIcon={<CheckIcon />}
                  onClick={handleBulkApprove}
                  disabled={loading}
                  sx={{
                    bgcolor: "rgba(16, 185, 129, 0.2)",
                    "&:hover": { bgcolor: "rgba(16, 185, 129, 0.3)" },
                  }}
                >
                  Approve All
                </Button>
                <Button
                  variant="contained"
                  startIcon={<CloseIcon />}
                  onClick={handleBulkReject}
                  disabled={loading}
                  sx={{
                    bgcolor: "rgba(239, 68, 68, 0.2)",
                    "&:hover": { bgcolor: "rgba(239, 68, 68, 0.3)" },
                  }}
                >
                  Reject All
                </Button>
                <Button
                  variant="outlined"
                  onClick={() => setSelectedVendors([])}
                  sx={{ borderColor: "white", color: "white" }}
                >
                  Clear Selection
                </Button>
              </Stack>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Loading Bar */}
      {loading && <LinearProgress sx={{ mb: 2 }} />}

      {/* Vendors Table */}
      <TableContainer component={Paper} elevation={3} sx={{ borderRadius: 2 }}>
        <Table>
          <TableHead
            sx={{
              background: "linear-gradient(145deg, #f8fafc 0%, #e2e8f0 100%)",
            }}
          >
            <TableRow>
              <TableCell padding="checkbox">
                <Checkbox
                  checked={
                    filteredAndSortedVendors.length > 0 &&
                    selectedVendors.length === filteredAndSortedVendors.length
                  }
                  indeterminate={
                    selectedVendors.length > 0 &&
                    selectedVendors.length < filteredAndSortedVendors.length
                  }
                  onChange={(e) => handleSelectAll(e.target.checked)}
                />
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "vendor_id"}
                  direction={sortField === "vendor_id" ? sortDirection : "asc"}
                  onClick={() => handleSort("vendor_id")}
                  sx={{ fontWeight: 600 }}
                >
                  Vendor ID
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
              <TableCell>
                <TableSortLabel
                  active={sortField === "contact_person"}
                  direction={
                    sortField === "contact_person" ? sortDirection : "asc"
                  }
                  onClick={() => handleSort("contact_person")}
                  sx={{ fontWeight: 600 }}
                >
                  Contact
                </TableSortLabel>
              </TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "product_category"}
                  direction={
                    sortField === "product_category" ? sortDirection : "asc"
                  }
                  onClick={() => handleSort("product_category")}
                  sx={{ fontWeight: 600 }}
                >
                  Category
                </TableSortLabel>
              </TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Documents</TableCell>
              <TableCell>
                <TableSortLabel
                  active={sortField === "status"}
                  direction={sortField === "status" ? sortDirection : "asc"}
                  onClick={() => handleSort("status")}
                  sx={{ fontWeight: 600 }}
                >
                  Status
                </TableSortLabel>
              </TableCell>
              <TableCell align="center" sx={{ fontWeight: 600 }}>
                Actions
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredAndSortedVendors.map((vendor) => (
              <TableRow
                key={vendor.id}
                hover
                sx={{ "&:hover": { backgroundColor: "#f8fafc" } }}
              >
                <TableCell padding="checkbox">
                  <Checkbox
                    checked={selectedVendors.includes(vendor.id)}
                    onChange={() => handleVendorSelect(vendor.id)}
                  />
                </TableCell>

                {/* Vendor ID */}
                <TableCell>
                  <Typography
                    variant="body2"
                    sx={{ fontWeight: 600, color: "#1e40af" }}
                  >
                    {vendor.vendor_id}
                  </Typography>
                </TableCell>

                {/* Vendor Name */}
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Avatar sx={{ bgcolor: "#3b82f6", width: 32, height: 32 }}>
                      <BusinessIcon fontSize="small" />
                    </Avatar>
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                      {vendor.vendor_name}
                    </Typography>
                  </Box>
                </TableCell>

                {/* Contact Info */}
                <TableCell>
                  <Box>
                    <Typography
                      variant="body2"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 0.5,
                      }}
                    >
                      <PersonIcon fontSize="small" color="action" />
                      {vendor.contact_person || "N/A"}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 0.5,
                        mb: 0.5,
                      }}
                    >
                      <EmailIcon fontSize="small" color="action" />
                      {vendor.email_1 || "N/A"}
                    </Typography>
                    <Typography
                      variant="body2"
                      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                      <PhoneIcon fontSize="small" color="action" />
                      {vendor.mobile_no_1 || "N/A"}
                    </Typography>
                  </Box>
                </TableCell>

                {/* Category */}
                <TableCell>
                  <Chip
                    label={vendor.product_category || "Not specified"}
                    size="small"
                    variant="outlined"
                    sx={{ fontWeight: 500 }}
                  />
                </TableCell>

                {/* Documents */}
                <TableCell>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Badge
                      badgeContent={getDocumentCount(vendor)}
                      color={
                        getDocumentCount(vendor) >= 5 ? "success" : "warning"
                      }
                      max={7}
                    >
                      <DescriptionIcon color="action" />
                    </Badge>
                    <Typography variant="caption" color="text.secondary">
                      {getDocumentCount(vendor)}/7 docs
                    </Typography>
                  </Box>
                </TableCell>

                {/* Status */}
                <TableCell>
                  <Chip
                    label={vendor.status.toUpperCase()}
                    size="small"
                    icon={
                      vendor.status === "pending" ? (
                        <PendingIcon />
                      ) : (
                        <VerifiedIcon />
                      )
                    }
                    sx={{
                      backgroundColor: getStatusColor(vendor.status).bg,
                      color: getStatusColor(vendor.status).color,
                      fontWeight: 600,
                    }}
                  />
                </TableCell>

                {/* Actions */}
                <TableCell align="center">
                  <Stack direction="row" spacing={1} justifyContent="center">
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => viewVendorDetails(vendor)}
                        sx={{ color: "#3b82f6" }}
                      >
                        <VisibilityIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Quick Approve">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleQuickApprove(vendor.id)}
                          disabled={actionLoading.includes(vendor.id)}
                          sx={{ color: "#10b981" }}
                        >
                          <CheckCircleIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Quick Reject">
                      <span>
                        <IconButton
                          size="small"
                          onClick={() => handleQuickReject(vendor.id)}
                          disabled={actionLoading.includes(vendor.id)}
                          sx={{ color: "#ef4444" }}
                        >
                          <CancelIcon />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {filteredAndSortedVendors.length === 0 && !loading && (
          <Box sx={{ p: 4, textAlign: "center" }}>
            <Typography variant="h6" color="text.secondary">
              {searchTerm
                ? "No vendors found matching your search"
                : "No vendors pending approval"}
            </Typography>
          </Box>
        )}
      </TableContainer>

      {/* Vendor Details Dialog */}
      <Dialog
        open={detailDialogOpen}
        onClose={() => setDetailDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle
          sx={{ bgcolor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Avatar sx={{ bgcolor: "#3b82f6" }}>
              <BusinessIcon />
            </Avatar>
            <Box>
              <Typography variant="h6">
                {selectedVendor?.vendor_name}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Vendor ID: {selectedVendor?.vendor_id}
              </Typography>
            </Box>
          </Box>
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {selectedVendor && (
            <Grid container spacing={3}>
              {/* Basic Information */}
              <Grid item xs={12} md={6}>
                <Card elevation={1} sx={{ height: "100%" }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: "#1e40af" }}>
                      Basic Information
                    </Typography>
                    <Stack spacing={2}>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Contact Person
                        </Typography>
                        <Typography variant="body2">
                          {selectedVendor.contact_person || "N/A"}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Product Category
                        </Typography>
                        <Typography variant="body2">
                          {selectedVendor.product_category || "N/A"}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Payment Terms
                        </Typography>
                        <Typography variant="body2">
                          {selectedVendor.payment_term || "N/A"}
                        </Typography>
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Website
                        </Typography>
                        {selectedVendor.website ? (
                          <Link
                            href={
                              selectedVendor.website.startsWith("http")
                                ? selectedVendor.website
                                : `https://${selectedVendor.website}`
                            }
                            target="_blank"
                          >
                            {selectedVendor.website}
                          </Link>
                        ) : (
                          <Typography variant="body2">N/A</Typography>
                        )}
                      </Box>
                      <Box>
                        <Typography variant="caption" color="text.secondary">
                          Address
                        </Typography>
                        <Typography variant="body2">
                          {selectedVendor.address || "N/A"}
                        </Typography>
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>

              {/* Documents */}
              <Grid item xs={12} md={6}>
                <Card elevation={1} sx={{ height: "100%" }}>
                  <CardContent>
                    <Typography variant="h6" sx={{ mb: 2, color: "#059669" }}>
                      Documents ({getDocumentCount(selectedVendor)}/7)
                    </Typography>
                    <Stack spacing={1.5}>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2">PAN Card</Typography>
                        {renderDocumentLink(
                          selectedVendor.pan_card,
                          "PAN Card",
                          selectedVendor.id,
                          "pan_card"
                        )}
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2">GST Certificate</Typography>
                        {renderDocumentLink(
                          selectedVendor.gst_certificate,
                          "GST Certificate",
                          selectedVendor.id,
                          "gst_certificate"
                        )}
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2">
                          Incorporation Certificate
                        </Typography>
                        {renderDocumentLink(
                          selectedVendor.incorporation_certificate,
                          "Incorporation Certificate",
                          selectedVendor.id,
                          "incorporation_certificate"
                        )}
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2">
                          Cancelled Cheque
                        </Typography>
                        {renderDocumentLink(
                          selectedVendor.cancelled_cheque,
                          "Cancelled Cheque",
                          selectedVendor.id,
                          "cancelled_cheque"
                        )}
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2">
                          TAN Allotment Letter
                        </Typography>
                        {renderDocumentLink(
                          selectedVendor.tan_allotment_letter,
                          "TAN Allotment Letter",
                          selectedVendor.id,
                          "tan_allotment_letter"
                        )}
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2">
                          MSME Certificate
                        </Typography>
                        {renderDocumentLink(
                          selectedVendor.udyam_certificate_msme,
                          "MSME Certificate",
                          selectedVendor.id,
                          "udyam_certificate_msme"
                        )}
                      </Box>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <Typography variant="body2">
                          Vendor Registration Form
                        </Typography>
                        {renderDocumentLink(
                          selectedVendor.vendor_reg_form,
                          "Vendor Registration Form",
                          selectedVendor.id,
                          "vendor_reg_form"
                        )}
                      </Box>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDetailDialogOpen(false)}>Close</Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleIcon />}
            onClick={() => {
              if (selectedVendor) {
                handleQuickApprove(selectedVendor.id);
                setDetailDialogOpen(false);
              }
            }}
          >
            Approve
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<CancelIcon />}
            onClick={() => {
              if (selectedVendor) {
                handleQuickReject(selectedVendor.id);
                setDetailDialogOpen(false);
              }
            }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Vendor</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Please provide reasons for rejection. These remarks will be shown to
            the vendor.
          </Typography>
          <TextField
            label="Rejection Remarks"
            multiline
            rows={4}
            fullWidth
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            required
            placeholder="Explain what the vendor needs to correct or provide"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmRejection} variant="contained" color="error">
            Confirm Rejection
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Rejection Dialog */}
      <Dialog
        open={bulkRejectDialogOpen}
        onClose={() => setBulkRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Reject Multiple Vendors</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Please provide reasons for rejecting {selectedVendors.length}{" "}
            vendors.
          </Typography>
          <TextField
            label="Rejection Remarks"
            multiline
            rows={4}
            fullWidth
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            required
            placeholder="Explain what the vendors need to correct or provide"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkRejectDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={confirmBulkRejection}
            variant="contained"
            color="error"
          >
            Reject {selectedVendors.length} Vendors
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VendorApproval;
