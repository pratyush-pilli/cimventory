import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Box,
  Paper,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  IconButton,
  FormHelperText,
  TableContainer,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useSnackbar } from "notistack";
import axios from "axios";
import configuration from "../../../configuration";

const DOCUMENT_TYPES = [
  {
    value: "challan",
    label: "Delivery Challan",
    description: "For direct delivery to project sites",
    requiresApproval: false,
  },
  {
    value: "billing",
    label: "Billing Instructions",
    description: "For billing and invoicing purposes",
    requiresApproval: false,
  },
];

const ALLOCATION_TYPES = [
  {
    value: "allocated",
    label: "Allocated Stock",
    description: "Use stock that has been allocated to this project",
  },
  {
    value: "available",
    label: "Available Stock",
    description: "Use stock that is available but not allocated",
  },
];

interface OutwardDialogProps {
  open: boolean;
  onClose: () => void;
  item: any;
  onSubmit: (data: any) => void;
}

const OutwardDialog: React.FC<OutwardDialogProps> = ({
  open,
  onClose,
  item,
  onSubmit,
}) => {
  const [formData, setFormData] = useState({
    outward_type: "allocated",
    document_type: "",
    document_number: "",
    remarks: "",
    location_quantities: {},
  });
  const [loading, setLoading] = useState(false);
  const [stockDetails, setStockDetails] = useState(null);
  const [errors, setErrors] = useState<{
    document_type?: string;
    outward_type?: string;
    document_number?: string;
    quantity?: string;
  }>({});
  const { enqueueSnackbar } = useSnackbar();

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      setFormData({
        outward_type: "allocated",
        document_type: "",
        document_number: "",
        remarks: "",
        location_quantities: {},
      });
      setErrors({});
      if (item?.inventory_id) {
        fetchStockDetails(item.inventory_id, item.project_code);
      }
    }
  }, [open, item]);

  const fetchStockDetails = async (
    inventoryId: number,
    projectCode: string
  ) => {
    try {
      setLoading(true);
      // Call both endpoints to get all required data
      const [stockResponse, locationResponse] = await Promise.all([
        axios.get(
          `${configuration.api_url}stock-details/${inventoryId}/${projectCode}/`
        ),
        axios.get(
          `${configuration.api_url}inventory/${inventoryId}/location-stock/`
        ),
      ]);

      console.log("Stock Details Response:", stockResponse.data);
      console.log("Location Stock Response:", locationResponse.data);

      setStockDetails({
        ...stockResponse.data,
        locationStocks: locationResponse.data,
      });
    } catch (error) {
      console.error("Error fetching stock details:", error);
      enqueueSnackbar("Failed to fetch stock details", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    const totalQuantity = Object.values(formData.location_quantities).reduce(
      (sum: number, qty: number) => sum + (Number(qty) || 0),
      0
    );

    if (!formData.outward_type) {
      newErrors["outward_type"] = "Please select an outward type";
    }

    if (!formData.document_type) {
      newErrors["document_type"] = "Please select a document type";
    }

    if (totalQuantity <= 0) {
      newErrors["quantity"] = "Total quantity must be greater than 0";
    }

    if (formData.document_type && !formData.document_number) {
      newErrors["document_number"] = "Document number is required";
    }

    // Validate quantities against available stock
    Object.entries(formData.location_quantities).forEach(([location, qty]) => {
      const stockType = formData.outward_type;
      const locationData = stockDetails?.locationStocks?.[location];

      // Calculate allocated quantity for current project with null checks
      const projectAllocated =
        locationData?.allocations
          ?.filter((alloc) => alloc.project_code === item?.project_code)
          ?.reduce((sum, alloc) => sum + (alloc.quantity || 0), 0) || 0;

      const maxQty =
        stockType === "allocated"
          ? projectAllocated
          : locationData?.available || 0;

      if (Number(qty) > maxQty) {
        newErrors[
          `quantity_${location}`
        ] = `Cannot exceed ${stockType} quantity (${maxQty})`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    try {
      setLoading(true);

      // Transform the location quantities to match what the backend expects
      const transformedQuantities = {};
      Object.entries(formData.location_quantities).forEach(
        ([location, qty]) => {
          // Don't transform the location name - use it as is
          transformedQuantities[location] = qty;
        }
      );

      const payload = {
        inventory_id: item.inventory_id,
        project_code: item.project_code,
        outward_type: formData.outward_type,
        document_type: formData.document_type,
        document_number: formData.document_number,
        remarks: formData.remarks || "NA",
        location_quantities: transformedQuantities,
      };

      console.log("Sending outward payload:", payload);
      onSubmit(payload);
    } catch (error) {
      console.error("Error processing outward:", error);
      enqueueSnackbar("Failed to process outward", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Process Outward
        <IconButton
          onClick={onClose}
          sx={{ position: "absolute", right: 8, top: 8 }}
        >
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          {/* Document Type Selection */}
          <Grid item xs={12}>
            <FormControl fullWidth error={!!errors.document_type}>
              <InputLabel>Document Type</InputLabel>
              <Select
                value={formData.document_type}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    document_type: e.target.value,
                  }))
                }
                label="Document Type"
              >
                {DOCUMENT_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box>
                      <Typography variant="subtitle1">{type.label}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {type.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              {errors.document_type && (
                <FormHelperText>{errors.document_type}</FormHelperText>
              )}
            </FormControl>
          </Grid>
          {/* Outward Type Selection */}
          <Grid item xs={12}>
            <FormControl fullWidth error={!!errors.outward_type}>
              <InputLabel>Outward Type</InputLabel>
              <Select
                value={formData.outward_type}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    outward_type: e.target.value,
                  }))
                }
                label="Outward Type"
              >
                {ALLOCATION_TYPES.map((type) => (
                  <MenuItem key={type.value} value={type.value}>
                    <Box>
                      <Typography variant="subtitle1">{type.label}</Typography>
                      <Typography variant="caption" color="textSecondary">
                        {type.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
              {errors.outward_type && (
                <FormHelperText>{errors.outward_type}</FormHelperText>
              )}
            </FormControl>
          </Grid>

          {/* Document Number */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Document Number"
              value={formData.document_number}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  document_number: e.target.value,
                }))
              }
              error={!!errors.document_number}
              helperText={errors.document_number}
            />
          </Grid>

          {/* Location-wise Stock */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>
              Location-wise Stock
            </Typography>
            <TableContainer component={Paper}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Location</TableCell>
                    <TableCell align="right">Allocated Stock</TableCell>
                    <TableCell align="right">Available Stock</TableCell>
                    <TableCell align="right">Outward Quantity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {[
                    { key: "Times Square", label: "Times Square" },
                    { key: "iSquare", label: "iSquare" },
                    { key: "Sakar", label: "Sakar" },
                    { key: "Pirana", label: "Pirana" },
                    { key: "Other", label: "Other" },
                  ].map(({ key, label }) => {
                    const locationData = stockDetails?.locationStocks?.[
                      key
                    ] || {
                      total: 0,
                      allocated: 0,
                      available: 0,
                      allocations: [],
                    };

                    // Add null checks and logging
                    console.log("Current item:", item);
                    console.log("Current project code:", item?.project_code);
                    console.log("Location Data:", locationData);

                    // Calculate allocated quantity for current project with null checks
                    const projectAllocated =
                      locationData.allocations
                        ?.filter(
                          (alloc) => alloc.project_code === item?.project_code
                        )
                        ?.reduce(
                          (sum, alloc) => sum + (alloc.quantity || 0),
                          0
                        ) || 0;

                    return (
                      <TableRow key={key}>
                        <TableCell>{label}</TableCell>
                        <TableCell align="right">{projectAllocated}</TableCell>
                        <TableCell align="right">
                          {locationData.available}
                        </TableCell>
                        <TableCell align="right">
                          <TextField
                            type="number"
                            size="small"
                            value={formData.location_quantities[key] || ""}
                            onChange={(e) => {
                              const maxQty =
                                formData.outward_type === "allocated"
                                  ? projectAllocated
                                  : locationData.available;

                              const value = Math.max(
                                0,
                                Math.min(Number(e.target.value), maxQty)
                              );

                              setFormData((prev) => ({
                                ...prev,
                                location_quantities: {
                                  ...prev.location_quantities,
                                  [key]: value || "",
                                },
                              }));
                            }}
                            inputProps={{
                              min: 0,
                              max:
                                formData.outward_type === "allocated"
                                  ? projectAllocated
                                  : locationData.available,
                            }}
                            error={!!errors[`quantity_${key}`]}
                            helperText={errors[`quantity_${key}`]}
                            disabled={
                              formData.outward_type === "allocated"
                                ? projectAllocated <= 0
                                : locationData.available <= 0
                            }
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
            {/* Total quantity display */}
            <Box sx={{ mt: 2, textAlign: "right" }}>
              <Typography variant="subtitle1">
                Total Outward Quantity:{" "}
                {Object.values(formData.location_quantities).reduce(
                  (sum, qty) => sum + (Number(qty) || 0),
                  0
                )}
              </Typography>
            </Box>
          </Grid>

          {/* Remarks */}
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={3}
              label="Remarks"
              value={formData.remarks}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  remarks: e.target.value,
                }))
              }
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={loading}>
          Process Outward
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OutwardDialog;
