import React, { useState } from "react";
import axios from "axios";
import { useSnackbar } from "notistack";
import configuration from "../../../configuration";
import {
  Paper,
  Typography,
  Box,
  TextField,
  Button,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import { RequiredItem } from "../types";
import { DocumentPreview } from "./DocumentPreview";
import { FixedSizeList } from "react-window";

interface OutwardCartProps {
  items: {
    [key: number]: {
      item: RequiredItem;
      locationQuantities: { [location: string]: number };
    };
  };
  projectCode: string;
  onRemoveItem: (inventoryId: number, location: string) => void;
  onUpdateQuantity: (
    inventoryId: number,
    location: string,
    quantity: number,
    operation?: "increment" | "decrement" | "set"
  ) => void;
  onSubmit: (data: any) => void;
  documentType: string;
  documentNumber: string;
  remarks: string;
  onDocumentTypeChange: (value: string) => void;
  onDocumentNumberChange: (value: string) => void;
  onRemarksChange: (value: string) => void;
  outwardType: "allocated" | "available";
}

const formatLocationName = (location: string): string => {
  return location
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .replace(" Stock", "");
};

const calculateTotalItems = (items: OutwardCartProps["items"]): number => {
  return Object.values(items).reduce((total, { locationQuantities }) => {
    return (
      total +
      Object.values(locationQuantities).reduce((sum, qty) => sum + qty, 0)
    );
  }, 0);
};

export const OutwardCart: React.FC<OutwardCartProps> = ({
  items,
  projectCode,
  onRemoveItem,
  onUpdateQuantity,
  onSubmit,
  documentType,
  documentNumber,
  remarks,
  onDocumentTypeChange,
  onDocumentNumberChange,
  onRemarksChange,
  outwardType,
}) => {
  const totalItems = calculateTotalItems(items);
  const hasItems = Object.keys(items).length > 0;
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  const handlePreview = async () => {
    try {
      // Validate required fields
      if (!documentNumber || documentNumber.trim() === "") {
        throw new Error("Document number is required.");
      }
      if (!projectCode || projectCode.trim() === "") {
        throw new Error("Project code is required.");
      }

      const outwardData = {
        documentType: documentType,
        documentNumber: documentNumber,
        remarks: remarks,
        projectCode: projectCode,
        outwardType: outwardType,
        outwardItems: Object.entries(items).map(([inventoryId, itemData]) => ({
          inventory_id: Number(inventoryId),
          item_no: itemData.item.item_no,
          description: itemData.item.description,
          location_quantities: itemData.locationQuantities,
          outward_type: outwardType,
          make: itemData.item.make || "CIMCON",
          material_group: itemData.item.material_group || "",
          hsn_code: itemData.item.hsn_code || "",
          rate: parseFloat(itemData.item.rate?.toString() || "0"),
          quantity: Object.values(itemData.locationQuantities || {}).reduce(
            (sum, qty) => sum + Number(qty),
            0
          ),
        })),
      };

      console.log("Sending preview request with data:", outwardData);

      const response = await axios.post(
        `${configuration.api_url}preview-document/`,
        outwardData
      );

      console.log("Preview response:", response.data);
      setPreviewData(response.data);
      setShowPreview(true);
    } catch (error) {
      console.error("Error generating preview:", error);
      enqueueSnackbar(
        error.response?.data?.error ||
          error.message ||
          "Failed to generate preview",
        { variant: "error" }
      );
    }
  };

  const calculateTotalAmount = () => {
    const subtotal = formData.items.reduce((sum, item) => sum + item.amount, 0);
    const cgstAmount = (subtotal * formData.cgst) / 100;
    const sgstAmount = (subtotal * formData.sgst) / 100;
    const igstAmount = (subtotal * formData.igst) / 100;
    return subtotal + cgstAmount + sgstAmount + igstAmount;
  };

  const handleDocumentGeneration = async (formData) => {
    try {
      const response = await axios.post(
        `${configuration.api_url}process-outward-and-document/`,
        formData
      );
      return response.data;
    } catch (error) {
      console.error("Error generating documents:", error);
      throw error;
    }
  };

  const renderRow = ({ index, style }) => {
    const entries = Object.entries(items);
    const [inventoryId, { item, locationQuantities }] = entries[index];

    return (
      <ListItem style={style}>
        <ListItemText
          primary={item.item_no}
          secondary={
            <Box>
              <Typography variant="body2">{item.description}</Typography>
              {Object.entries(locationQuantities).map(
                ([location, quantity]) => (
                  <Box
                    key={location}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      mt: 1,
                      gap: 1,
                    }}
                  >
                    <Typography variant="caption">
                      {formatLocationName(location)}:
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={() =>
                          onUpdateQuantity(
                            Number(inventoryId),
                            location,
                            quantity,
                            "decrement"
                          )
                        }
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <TextField
                        size="small"
                        type="number"
                        value={quantity}
                        onChange={(e) =>
                          onUpdateQuantity(
                            Number(inventoryId),
                            location,
                            Number(e.target.value),
                            "set"
                          )
                        }
                        sx={{
                          width: "100px",
                          "& input": {
                            textAlign: "center",
                            padding: "6px 8px",
                          },
                        }}
                        inputProps={{
                          min: 0,
                          style: { textAlign: "center" },
                        }}
                      />
                      <IconButton
                        size="small"
                        onClick={() =>
                          onUpdateQuantity(
                            Number(inventoryId),
                            location,
                            quantity,
                            "increment"
                          )
                        }
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() =>
                          onRemoveItem(Number(inventoryId), location)
                        }
                        sx={{ ml: 1 }}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                )
              )}
            </Box>
          }
        />
      </ListItem>
    );
  };

  return (
    <>
      <Paper
        sx={{ p: 2, height: "100%", display: "flex", flexDirection: "column" }}
      >
        <Typography variant="h6" gutterBottom>
          Outward Cart
        </Typography>

        {/* Document Details */}
        <Box sx={{ mb: 2 }}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <FormControl fullWidth size="small">
                <InputLabel>Document Type</InputLabel>
                <Select
                  value={documentType}
                  label="Document Type"
                  onChange={(e) => onDocumentTypeChange(e.target.value)}
                >
                  <MenuItem value="challan">Delivery Challan</MenuItem>
                  <MenuItem value="instructions">Billing Instructions</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Document Number"
                value={documentNumber}
                onChange={(e) => onDocumentNumberChange(e.target.value)}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                size="small"
                label="Remarks"
                multiline
                rows={2}
                value={remarks}
                onChange={(e) => onRemarksChange(e.target.value)}
              />
            </Grid>
          </Grid>
        </Box>

        <Divider sx={{ my: 2 }} />

        {/* Cart Items */}
        <Box sx={{ flexGrow: 1, overflow: "auto" }}>
          {hasItems ? (
            <FixedSizeList
              height={400}
              width="100%"
              itemSize={100}
              itemCount={Object.keys(items).length}
            >
              {renderRow}
            </FixedSizeList>
          ) : (
            <Typography
              variant="body2"
              color="text.secondary"
              textAlign="center"
            >
              No items in cart
            </Typography>
          )}
        </Box>

        {/* Cart Summary */}
        <Box sx={{ mt: 2 }}>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="subtitle1" gutterBottom>
            Total Items: {totalItems}
          </Typography>
          <Button
            variant="contained"
            fullWidth
            disabled={!hasItems || !documentType || !documentNumber}
            onClick={handlePreview}
          >
            Preview Document
          </Button>
        </Box>
      </Paper>

      <DocumentPreview
        open={showPreview}
        onClose={() => setShowPreview(false)}
        onGenerate={handleDocumentGeneration}
        previewData={previewData}
        outwardType={outwardType}
      />
    </>
  );
};

export default OutwardCart;
