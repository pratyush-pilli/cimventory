import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  IconButton,
  Chip,
  Alert,
  Grid,
  Autocomplete,
} from "@mui/material";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CancelIcon from "@mui/icons-material/Cancel";
import VisibilityIcon from "@mui/icons-material/Visibility";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import configuration from "../../configuration";
import axios from "axios";

interface ItemRequest {
  id: string;
  request_id?: string;
  type?: 'purchase' | 'factory';
  requestor: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  productName: string;
  productCode: string;
  mfgPartNo: string;
  mfgPartCode: string;
  itemDescription: string;
  itemCode: string;
  make: string;
  makeCode: string;
  materialRating: string;
  materialRatingCode: string;
  package: string;
  uom: string;
  moq: number;
  leadTime: number;
  hsnCode: string;
  bin: string;
  cimcon_part_no: string;
  typeCode?: string;
  // Common document fields
  document_name?: string;
  document?: boolean | string | null;
  has_document?: boolean;
  document_url?: string;
}

interface Item {
  id: string;
  code: string;
  name: string;
}

const ItemApproval: React.FC = () => {
  const [requests, setRequests] = useState<ItemRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedRequest, setSelectedRequest] = useState<ItemRequest | null>(
    null
  );
  const [rejectReason, setRejectReason] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedRequest, setEditedRequest] = useState<ItemRequest | null>(null);

  // Reference data for dropdowns
  const [products, setProducts] = useState<Item[]>([]);
  const [makes, setMakes] = useState<Item[]>([]);
  const [types, setTypes] = useState<Item[]>([]);
  const [ratings, setRatings] = useState<Item[]>([]);

  useEffect(() => {
    fetchPendingRequests();
    fetchProducts();
  }, []);

  useEffect(() => {
    if (selectedRequest && selectedRequest.productCode) {
      fetchRelatedItems(selectedRequest.productCode);
    }
  }, [selectedRequest]);

  const fetchPendingRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}factory/combined-item-requests/?status=pending`
      );
      console.log("Pending requests data:", response.data);
      setRequests(response.data);
    } catch (err) {
      setError("Failed to load pending requests");
      console.error("Error fetching requests:", err);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${configuration.api_url}options/`);
      if (response.data && response.data.categories) {
        setProducts(response.data.categories);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  const fetchRelatedItems = async (productId: string) => {
    try {
      // Get the actual ID from the product name
      const product = products.find((p) => p.code === productId);
      if (!product) {
        console.error("Product not found for ID:", productId);
        return;
      }

      const response = await axios.get(
        `${configuration.api_url}/related-options/?main_category_id=${product.id}`
      );

      if (response.data) {
        setMakes(response.data.makes || []);
        setTypes(response.data.types || []);
        setRatings(response.data.ratings || []);
      }
    } catch (err) {
      console.error("Error fetching related items:", err);
    }
  };

  const handleViewRequest = (request: ItemRequest) => {
    setSelectedRequest(request);
    setEditedRequest({ ...request });
    setEditMode(false);
    setDialogOpen(true);
  };

  const handleApproveRequest = async (item: ItemRequest) => {
    try {
      setLoading(true);
      const endpoint = item.type === 'factory'
        ? `${configuration.api_url}factory/approve-factory-item-request/${item.id}/`
        : `${configuration.api_url}/approve-item-request/${item.id}/`;

      const response = await axios.post(endpoint);
      console.log("Approval response:", response.data);
      setSuccess("Request approved successfully");
      fetchPendingRequests();
    } catch (err) {
      console.error("Error approving request:", err);
      console.error("Error details:", err.response?.data);
      setError(err.response?.data?.error || "Failed to approve request");
    } finally {
      setLoading(false);
    }
  };

  const openRejectDialog = (request: ItemRequest) => {
    setSelectedRequest(request);
    setRejectReason("");
    setRejectDialogOpen(true);
  };

  const handleRejectRequest = async () => {
    if (!selectedRequest) return;

    try {
      setLoading(true);
      const endpoint = selectedRequest.type === 'factory'
        ? `${configuration.api_url}factory/reject-factory-item-request/${selectedRequest.id}/`
        : `${configuration.api_url}/reject-item-request/${selectedRequest.id}/`;

      await axios.post(
        endpoint,
        {
          reason: rejectReason,
        }
      );
      setSuccess("Request rejected");
      setRejectDialogOpen(false);
      fetchPendingRequests();
    } catch (err) {
      setError("Failed to reject request");
      console.error("Error rejecting request:", err);
    } finally {
      setLoading(false);
    }
  };

  const toggleEditMode = () => {
    setEditMode(!editMode);
  };

  const handleTextChange = async (
    field: string,
    value: string,
    codeField?: string,
    codeType?: string
  ) => {
    if (!editedRequest) return;

    // Update the field value immediately
    setEditedRequest((prev) => ({
      ...prev!,
      [field]: value,
    }));

    // If this is a field that needs code generation
    if (codeField && codeType && value) {
      // For product name, we don't need a product ID
      const productId =
        editedRequest.productCode !== field
          ? products.find((p) => p.name === editedRequest.productName)?.id
          : undefined;

      if (!productId && codeType !== "productName") {
        console.error("Product ID not found for code generation");
        return;
      }

      try {
        // Map frontend types to backend expected types
        let mappedType = codeType;
        if (codeType === "mfg_part") mappedType = "product_model";
        else if (codeType === "description") mappedType = "remarks";

        const response = await axios.post(
          `${configuration.api_url}/generate-code/`,
          {
            type: mappedType,
            name: value,
            main_category_id: productId,
          }
        );

        if (response.data && response.data.code) {
          setEditedRequest((prev) => ({
            ...prev!,
            [codeField]: response.data.code,
          }));

          // Update CIMCON part number whenever a code changes
          setTimeout(() => updateCimconPartNumber(), 0);
        }
      } catch (error) {
        console.error(`Error generating ${codeType} code:`, error);
      }
    }
  };

  const updateCimconPartNumber = () => {
    if (!editedRequest) return;

    const ratingCode = editedRequest.materialRatingCode || "000";
    // Concatenate all codes WITHOUT dashes
    const cimconPartNo = `${editedRequest.productCode}${editedRequest.typeCode}${editedRequest.makeCode}${editedRequest.mfgPartCode}${editedRequest.itemCode}${ratingCode}`;

    setEditedRequest({
      ...editedRequest,
      cimcon_part_no: cimconPartNo,
    });
  };

  const handleProductSelect = (product: Item | null) => {
    if (!editedRequest || !product) return;

    setEditedRequest({
      ...editedRequest,
      productName: product.name,
      productCode: product.code,
    });

    updateCimconPartNumber();
    fetchRelatedItems(product.id);
  };

  const handleMakeSelect = (make: Item | null) => {
    if (!editedRequest || !make) return;

    setEditedRequest({
      ...editedRequest,
      make: make.name,
      makeCode: make.code,
    });

    updateCimconPartNumber();
  };

  const handleTypeSelect = (type: Item | null) => {
    if (!editedRequest || !type) return;

    setEditedRequest({
      ...editedRequest,
      type: type.name,
      typeCode: type.code,
    });

    updateCimconPartNumber();
  };

  const handleRatingSelect = (rating: Item | null) => {
    if (!editedRequest || !rating) return;

    setEditedRequest({
      ...editedRequest,
      materialRating: rating.name,
      materialRatingCode: rating.code,
    });

    updateCimconPartNumber();
  };

  const saveChanges = async () => {
    if (!editedRequest) return;

    try {
      setLoading(true);

      // Update the request with edited data
      await axios.post(
        `${configuration.api_url}/update-item-request/${editedRequest.id}/`,
        editedRequest
      );

      setSuccess("Changes saved successfully");
      setDialogOpen(false);
      fetchPendingRequests();
    } catch (err) {
      setError("Failed to save changes");
      console.error("Error saving changes:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: "auto" }}>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>
          {error}
        </Alert>
      )}
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>
          {success}
        </Alert>
      )}

      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Item Code Requests
        </Typography>

        {loading && (
          <CircularProgress sx={{ display: "block", margin: "20px auto" }} />
        )}

        {!loading && requests.length === 0 ? (
          <Typography>No pending requests</Typography>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Requestor</TableCell>
                  <TableCell>Product Name</TableCell>
                  <TableCell>Part Number</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell>Document</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {requests.map((request) => (
                  <TableRow key={request.id || request.request_id}>
                    <TableCell>{request.requestor}</TableCell>
                    <TableCell>{request.productName || request.productname}</TableCell>
                    <TableCell>{request.cimcon_part_no || request.full_part_number}</TableCell>
                    <TableCell>
                      <Chip
                        label={request.status}
                        color={
                          request.status === "approved"
                            ? "success"
                            : request.status === "rejected"
                            ? "error"
                            : "warning"
                        }
                        size="small"
                      />
                    </TableCell>
                    <TableCell>
                      {new Date(request.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      {request.document ||
                      request.document_name ||
                      request.has_document === true ||
                      request.document_url ? (
                        <Chip
                          icon={<AttachFileIcon />}
                          label="Yes"
                          size="small"
                          color="primary"
                        />
                      ) : (
                        <Chip label="No" size="small" />
                      )}
                    </TableCell>
                    <TableCell>
                      <IconButton
                        onClick={() => handleViewRequest(request)}
                        title="View Details"
                      >
                        <VisibilityIcon />
                      </IconButton>
                      {request.status === "pending" && (
                        <>
                          <IconButton
                            onClick={() => handleApproveRequest(request)}
                            color="success"
                            title="Approve"
                          >
                            <CheckCircleIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => openRejectDialog(request)}
                            color="error"
                            title="Reject"
                          >
                            <CancelIcon />
                          </IconButton>
                        </>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      {/* View/Edit Request Dialog */}
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Request Details</DialogTitle>
        <DialogContent>
          {editedRequest && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={3}>
                {/* Product Name */}
                <Grid item xs={12}>
                  <Typography variant="body1">
                    <strong>Product Name:</strong> {editedRequest.productName}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    Product Code: {editedRequest.productCode}
                  </Typography>
                </Grid>

                {/* MFG Part Number */}
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    <strong>MFG Part No:</strong> {editedRequest.mfgPartNo}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    MFG Code: {editedRequest.mfgPartCode}
                  </Typography>
                </Grid>

                {/* Item Description */}
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    <strong>Description:</strong>{" "}
                    {editedRequest.itemDescription}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    Item Code: {editedRequest.itemCode}
                  </Typography>
                </Grid>

                {/* Make */}
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    <strong>Make:</strong> {editedRequest.make}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    Make Code: {editedRequest.makeCode}
                  </Typography>
                </Grid>

                {/* Type */}
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    <strong>Type:</strong> {editedRequest.type}
                  </Typography>
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    Type Code: {editedRequest.typeCode}
                  </Typography>
                </Grid>

                {/* Material Rating */}
                <Grid item xs={12} md={6}>
                  <Typography variant="body1">
                    <strong>Material Rating:</strong>{" "}
                    {editedRequest.materialRating || "N/A"}
                  </Typography>
                  {editedRequest.materialRatingCode && (
                    <Typography
                      variant="caption"
                      color="textSecondary"
                      display="block"
                    >
                      Rating Code: {editedRequest.materialRatingCode}
                    </Typography>
                  )}
                </Grid>

                {/* Additional fields */}
                {editedRequest.package && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1">
                      <strong>Package:</strong> {editedRequest.package}
                    </Typography>
                  </Grid>
                )}

                {editedRequest.uom && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1">
                      <strong>UOM:</strong> {editedRequest.uom}
                    </Typography>
                  </Grid>
                )}

                {editedRequest.moq !== undefined &&
                  editedRequest.moq !== null && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="body1">
                        <strong>MOQ:</strong> {editedRequest.moq}
                      </Typography>
                    </Grid>
                  )}

                {editedRequest.leadTime !== undefined &&
                  editedRequest.leadTime !== null && (
                    <Grid item xs={12} md={6}>
                      <Typography variant="body1">
                        <strong>Lead Time:</strong> {editedRequest.leadTime}{" "}
                        days
                      </Typography>
                    </Grid>
                  )}

                {editedRequest.hsnCode && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1">
                      <strong>HSN Code:</strong> {editedRequest.hsnCode}
                    </Typography>
                  </Grid>
                )}

                {editedRequest.bin && (
                  <Grid item xs={12} md={6}>
                    <Typography variant="body1">
                      <strong>Bin Location:</strong> {editedRequest.bin}
                    </Typography>
                  </Grid>
                )}

                {/* Generated Part Number */}
                <Grid item xs={12}>
                  <Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: "#f5f5f5" }}>
                    <Typography
                      variant="subtitle1"
                      gutterBottom
                      fontWeight="bold"
                    >
                      Generated CIMCON Part Number:
                    </Typography>
                    <Typography variant="body1">
                      {editedRequest.cimcon_part_no}
                    </Typography>
                  </Paper>
                </Grid>

                {/* Document section */}
                {(editedRequest.document ||
                  editedRequest.document_name ||
                  editedRequest.has_document === true ||
                  editedRequest.document_url) && (
                  <Grid item xs={12}>
                    <Paper
                      elevation={1}
                      sx={{ p: 2, mt: 2, bgcolor: "#f0f8ff" }}
                    >
                      <Box
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                      >
                        <Box display="flex" alignItems="center">
                          <AttachFileIcon sx={{ mr: 1 }} color="primary" />
                          <Typography variant="body1">
                            Document:{" "}
                            {editedRequest.document_name ||
                              "Attached documentation"}
                          </Typography>
                        </Box>
                        <Button
                          size="small"
                          startIcon={<FileDownloadIcon />}
                          href={`${configuration.api_url}/item-document/request/${editedRequest.id}/`}
                          target="_blank"
                          variant="contained"
                          color="primary"
                        >
                          Download
                        </Button>
                      </Box>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
          {selectedRequest && selectedRequest.status === "pending" && (
            <>
              <Button
                onClick={() => handleApproveRequest(selectedRequest)}
                color="success"
                variant="contained"
              >
                Approve
              </Button>
              <Button
                onClick={() => {
                  setDialogOpen(false);
                  openRejectDialog(selectedRequest);
                }}
                color="error"
                variant="contained"
              >
                Reject
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
      >
        <DialogTitle>Reject Request</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Reason for Rejection"
            fullWidth
            multiline
            rows={4}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRejectDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleRejectRequest} color="error">
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemApproval;