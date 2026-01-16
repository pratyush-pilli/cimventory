import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Divider,
} from "@mui/material";
import { message } from "antd";
import { saveAs } from "file-saver";
import configuration from "../../../configuration";
import { useSnackbar } from "notistack";
import axios from "axios";
import { Decimal } from "decimal.js";

interface LineItem {
  sr_no: number;
  id: number;
  inventory_id: number;
  item_code: string;
  description: string;
  hsn_code: string;
  quantity: number;
  rate: number;
  amount: number;
  uom: string;
  location_quantities: { [key: string]: number };
  make?: string;
  material_group?: string;
}

interface PreviewData {
  company_details: {
    name: string;
    address: string;
    gstin: string;
    cin: string;
    email: string;
  };
  project_details: {
    code: string;
    name: string;
    bill_to: string;
    ship_to: string;
  };
  items: LineItem[];
  summary: {
    total_amount: number;
    total_items: number;
    total_quantity: number;
  };
  document_number: string;
}

interface DocumentPreviewProps {
  open: boolean;
  onClose: (success?: boolean) => void;
  onGenerate: (
    data: any
  ) => Promise<{ download_url: string; file_name: string }>;
  previewData: PreviewData;
  outwardType: "allocated" | "available";
}

// Update the API endpoint constants
const API_ENDPOINTS = {
  PREVIEW_DOCUMENT: "preview-document/",
  PROCESS_OUTWARD_AND_DOCUMENT: "process-outward-and-document/",
};

export const DocumentPreview: React.FC<DocumentPreviewProps> = ({
  open,
  onClose,
  onGenerate,
  previewData,
  outwardType,
}) => {
  const [formData, setFormData] = useState({
    // Document Details
    documentNumber: "",
    date: new Date().toISOString().split("T")[0],
    referenceNo: "",
    projectCode: "",
    projectName: "",
    modeOfTransport: "",
    vehicleNo: "",
    supplyDate: "",
    dispatchFrom: "",
    placeOfSupply: "",
    remarks: "",
    billTo: "",
    shipTo: "",
    items: [] as LineItem[],
    // Tax fields
    cgst: 0,
    sgst: 0,
    igst: 0,
  });

  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (previewData && previewData.project_details) {
      console.log("Raw preview items:", previewData.items);

      setFormData((prev) => {
        const newFormData = {
          ...prev,
          documentNumber: previewData.document_number || "",
          billTo: previewData.project_details.bill_to || "",
          shipTo: previewData.project_details.ship_to || "",
          projectCode: previewData.project_details.code || "",
          projectName: previewData.project_details.name || "",
          items: previewData.items.map((item, index) => {
            console.log(`Processing item ${item.item_code}:`, {
              id: item.id,
              inventory_id: item.inventory_id,
              hsn_code: item.hsn_code,
            });

            const hsnCode =
              item.hsn_code || item.item_code?.split("-")[0] || "";

            return {
              ...item,
              sr_no: index + 1,
              id: item.id || item.inventory_id,
              inventory_id: item.id || item.inventory_id,
              hsn_code: hsnCode,
              rate: parseFloat(item.rate?.toString() || "0"),
              make: item.make || "CIMCON",
              material_group: item.material_group || "",
              quantity: Object.values(item.location_quantities || {}).reduce(
                (sum, qty) => sum + Number(qty),
                0
              ),
              amount:
                parseFloat(item.rate?.toString() || "0") *
                Object.values(item.location_quantities || {}).reduce(
                  (sum, qty) => sum + Number(qty),
                  0
                ),
            };
          }),
        };
        return newFormData;
      });
    }
  }, [previewData]);

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData((prev) => {
      const updatedItems = [...prev.items];

      updatedItems[index] = {
        ...updatedItems[index],
        [field]: value,
        amount:
          field === "rate"
            ? new Decimal(value).times(updatedItems[index].quantity).toNumber()
            : field === "quantity"
            ? new Decimal(updatedItems[index].rate).times(value).toNumber()
            : new Decimal(updatedItems[index].rate)
                .times(updatedItems[index].quantity)
                .toNumber(),
      };

      // Add validation for HSN code
      if (field === "hsn_code" && !value.trim()) {
        message.warning(
          `HSN/SAC code is required for item ${updatedItems[index].item_code}`
        );
      }

      return { ...prev, items: updatedItems };
    });
  };

  const handleTaxChange = (
    taxType: "cgst" | "sgst" | "igst",
    value: string
  ) => {
    const numValue = parseFloat(value) || 0;
    setFormData((prev) => ({
      ...prev,
      [taxType]: numValue,
    }));
  };

  const calculateTotalAmount = () => {
    const subtotal = formData.items.reduce((sum, item) => {
      return new Decimal(sum).plus(new Decimal(item.amount)).toNumber();
    }, 0);

    const cgstAmount = new Decimal(subtotal)
      .times(formData.cgst)
      .dividedBy(100);
    const sgstAmount = new Decimal(subtotal)
      .times(formData.sgst)
      .dividedBy(100);
    const igstAmount = new Decimal(subtotal)
      .times(formData.igst)
      .dividedBy(100);

    return new Decimal(subtotal)
      .plus(cgstAmount)
      .plus(sgstAmount)
      .plus(igstAmount)
      .toNumber();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      // First validate that all items have HSN codes
      const missingHsnItems = formData.items.filter(
        (item) => !item.hsn_code || item.hsn_code.trim() === ""
      );
      if (missingHsnItems.length > 0) {
        enqueueSnackbar(
          `Please provide HSN codes for all items: ${missingHsnItems
            .map((item) => item.item_code)
            .join(", ")}`,
          { variant: "error" }
        );
        return;
      }

      // Prepare the combined data for both outward and document
      const combinedData = {
        outward: {
          document_type: "challan",
          document_number: formData.documentNumber,
          remarks: formData.remarks || "",
          project_code: formData.projectCode,
          project_name: formData.projectName,
          outward_items: formData.items.map((item) => ({
            inventory_id: item.id || item.inventory_id,
            project_code: formData.projectCode,
            location_quantities: item.location_quantities,
            outward_type: outwardType,
            item_no: item.item_code,
            description: item.description,
            make: item.make || "",
            material_group: item.material_group || "",
          })),
        },
        document: {
          document_number: formData.documentNumber,
          date: formData.date,
          project_code: formData.projectCode,
          project_name: formData.projectName,
          reference_no: formData.referenceNo || "",
          mode_of_transport: formData.modeOfTransport || "",
          vehicle_no: formData.vehicleNo || "",
          supply_date: formData.supplyDate || formData.date,
          dispatch_from: formData.dispatchFrom || "",
          place_of_supply: formData.placeOfSupply || "",
          bill_to: formData.billTo || "",
          ship_to: formData.shipTo || "",
          remarks: formData.remarks || "",
          outward_items: formData.items.map((item) => ({
            inventory_id: item.id || item.inventory_id,
            item_no: item.item_code,
            description: item.description,
            make: item.make || "",
            material_group: item.material_group || "",
            hsn_code: item.hsn_code,
            rate: parseFloat(item.rate || "0"),
            quantity: Object.values(item.location_quantities || {}).reduce(
              (sum, qty) => sum + Number(qty),
              0
            ),
            location_quantities: item.location_quantities,
          })),
          cgst: formData.cgst || 0,
          sgst: formData.sgst || 0,
          igst: formData.igst || 0,
        },
      };

      console.log("Submitting data:", combinedData);

      const response = await axios.post(
        `${configuration.api_url}${API_ENDPOINTS.PROCESS_OUTWARD_AND_DOCUMENT}`,
        combinedData
      );

      if (response.data.download_url) {
        const baseUrl = configuration.api_url;
        const downloadUrl = `${baseUrl}${response.data.download_url}`;
        console.log("Download URL:", downloadUrl);

        message.success("Outward processed successfully!");
        enqueueSnackbar(
          "Outward processed and document generated successfully!",
          {
            variant: "success",
            autoHideDuration: 5000,
            anchorOrigin: { vertical: "top", horizontal: "center" },
          }
        );

        // Download the document
        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = response.data.file_name || "document.xlsx";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        onClose(true);
      } else {
        throw new Error("No download URL received");
      }
    } catch (error) {
      console.error("Error in document generation:", error);
      console.error("Full error object:", {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
          headers: error.config?.headers,
        },
      });

      let errorMessage = "Failed to generate document";
      let errorDetails = "";

      if (error.response && error.response.data) {
        console.error("Error details:", error.response.data);

        if (typeof error.response.data === "object") {
          if (error.response.data.error) {
            errorMessage = error.response.data.error;
          }
          if (error.response.data.details) {
            errorDetails = error.response.data.details;
          }
        } else if (typeof error.response.data === "string") {
          errorMessage = error.response.data;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      message.error(errorMessage);
      enqueueSnackbar(
        errorDetails ? `${errorMessage}: ${errorDetails}` : errorMessage,
        {
          variant: "error",
          autoHideDuration: 10000,
          style: { whiteSpace: "pre-line" },
        }
      );
    }
  };

  const validateForm = () => {
    // Implement form validation logic here
    return true; // Placeholder return, actual implementation needed
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Typography variant="h6" align="center">
          Delivery Challan
        </Typography>
      </DialogTitle>
      <DialogContent>
        <Box sx={{ p: 2 }}>
          {/* Company Header */}
          <Typography variant="h6" align="center" gutterBottom>
            {previewData?.company_details?.name}
          </Typography>
          <Typography variant="body2" align="center" gutterBottom>
            {previewData?.company_details?.address}
          </Typography>
          <Typography variant="body2" align="center" gutterBottom>
            GSTIN: {previewData?.company_details?.gstin}
          </Typography>

          {/* Document Details Grid */}
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {/* Left Column */}
            <Grid item xs={6}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Document Number"
                    value={formData.documentNumber}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        documentNumber: e.target.value,
                      }))
                    }
                    size="small"
                    required
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Billing Address:</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={formData.billTo}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        billTo: e.target.value,
                      }))
                    }
                    size="small"
                    required
                    placeholder="No billing address available"
                    error={!formData.billTo}
                    helperText={
                      !formData.billTo ? "Billing address is required" : ""
                    }
                  />
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2">Shipping Address:</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={4}
                    value={formData.shipTo}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        shipTo: e.target.value,
                      }))
                    }
                    size="small"
                    placeholder="No shipping address available"
                    error={!formData.shipTo}
                    helperText={
                      !formData.shipTo ? "Shipping address is recommended" : ""
                    }
                  />
                </Grid>
              </Grid>
            </Grid>

            {/* Right Column */}
            <Grid item xs={6}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Challan Date"
                    type="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, date: e.target.value }))
                    }
                    size="small"
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Ref No."
                    value={formData.referenceNo}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        referenceNo: e.target.value,
                      }))
                    }
                    size="small"
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Project Code"
                    value={formData.projectCode}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        projectCode: e.target.value,
                      }))
                    }
                    size="small"
                    disabled
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Project Name"
                    value={formData.projectName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        projectName: e.target.value,
                      }))
                    }
                    size="small"
                    disabled
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Mode of Transport"
                    value={formData.modeOfTransport}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        modeOfTransport: e.target.value,
                      }))
                    }
                    size="small"
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Veh. No."
                    value={formData.vehicleNo}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        vehicleNo: e.target.value,
                      }))
                    }
                    size="small"
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Date of Supply"
                    type="date"
                    value={formData.supplyDate}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        supplyDate: e.target.value,
                      }))
                    }
                    size="small"
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Dispatch From"
                    value={formData.dispatchFrom}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        dispatchFrom: e.target.value,
                      }))
                    }
                    size="small"
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Place of Supply"
                    value={formData.placeOfSupply}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        placeOfSupply: e.target.value,
                      }))
                    }
                    size="small"
                    required
                  />
                </Grid>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    label="Remarks"
                    value={formData.remarks}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        remarks: e.target.value,
                      }))
                    }
                    size="small"
                  />
                </Grid>
              </Grid>
            </Grid>
          </Grid>

          {/* Tax Fields */}
          <Grid container spacing={2} sx={{ mt: 2 }}>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="CGST (%)"
                type="number"
                value={formData.cgst}
                onChange={(e) => handleTaxChange("cgst", e.target.value)}
                size="small"
                inputProps={{ min: 0, max: 100, step: "0.01" }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="SGST (%)"
                type="number"
                value={formData.sgst}
                onChange={(e) => handleTaxChange("sgst", e.target.value)}
                size="small"
                inputProps={{ min: 0, max: 100, step: "0.01" }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="IGST (%)"
                type="number"
                value={formData.igst}
                onChange={(e) => handleTaxChange("igst", e.target.value)}
                size="small"
                inputProps={{ min: 0, max: 100, step: "0.01" }}
              />
            </Grid>
          </Grid>

          {/* Items Table */}
          <TableContainer component={Paper} sx={{ mt: 3 }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Sr.No.</TableCell>
                  <TableCell>Item No.</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Make</TableCell>
                  <TableCell>Material Group</TableCell>
                  <TableCell>HSN/SAC</TableCell>
                  <TableCell align="right">Quantity</TableCell>
                  <TableCell align="right">Rate</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {formData.items?.length > 0 ? (
                  <>
                    {formData.items.map((item, index) => (
                      <TableRow key={item.sr_no}>
                        <TableCell>{item.sr_no}</TableCell>
                        <TableCell>{item.item_code}</TableCell>
                        <TableCell>{item.description}</TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.make || ""}
                            onChange={(e) =>
                              handleItemChange(index, "make", e.target.value)
                            }
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.material_group || ""}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "material_group",
                                e.target.value
                              )
                            }
                            fullWidth
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            value={item.hsn_code || ""}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "hsn_code",
                                e.target.value.trim()
                              )
                            }
                            onBlur={(e) => {
                              if (!e.target.value.trim()) {
                                message.error(
                                  `HSN/SAC code is required for item ${item.item_code}`
                                );
                              }
                            }}
                            error={!item.hsn_code}
                            helperText={
                              !item.hsn_code ? "HSN/SAC code is required" : ""
                            }
                            fullWidth
                            required
                            placeholder="Enter HSN/SAC code"
                            InputProps={{
                              style: {
                                backgroundColor: !item.hsn_code
                                  ? "#fff4f4"
                                  : "white",
                              },
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">{item.quantity}</TableCell>
                        <TableCell align="right">
                          <TextField
                            size="small"
                            type="number"
                            value={item.rate || 0}
                            onChange={(e) =>
                              handleItemChange(
                                index,
                                "rate",
                                parseFloat(e.target.value) || 0
                              )
                            }
                            inputProps={{ min: 0, step: "0.01" }}
                            required
                          />
                        </TableCell>
                        <TableCell align="right">
                          {item.amount.toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow>
                      <TableCell colSpan={8} align="right">
                        <strong>Sub Total:</strong>
                      </TableCell>
                      <TableCell align="right">
                        {formData.items
                          .reduce((sum, item) => sum + item.amount, 0)
                          .toFixed(2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={8} align="right">
                        <strong>CGST ({formData.cgst}%):</strong>
                      </TableCell>
                      <TableCell align="right">
                        {(
                          (formData.items.reduce(
                            (sum, item) => sum + item.amount,
                            0
                          ) *
                            formData.cgst) /
                          100
                        ).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={8} align="right">
                        <strong>SGST ({formData.sgst}%):</strong>
                      </TableCell>
                      <TableCell align="right">
                        {(
                          (formData.items.reduce(
                            (sum, item) => sum + item.amount,
                            0
                          ) *
                            formData.sgst) /
                          100
                        ).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={8} align="right">
                        <strong>IGST ({formData.igst}%):</strong>
                      </TableCell>
                      <TableCell align="right">
                        {(
                          (formData.items.reduce(
                            (sum, item) => sum + item.amount,
                            0
                          ) *
                            formData.igst) /
                          100
                        ).toFixed(2)}
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell colSpan={8} align="right">
                        <strong>Total Amount:</strong>
                      </TableCell>
                      <TableCell align="right">
                        {calculateTotalAmount().toFixed(2)}
                      </TableCell>
                    </TableRow>
                  </>
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      No items to display
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Note Section */}
          <Box sx={{ mt: 3 }}>
            <Typography variant="body2" sx={{ whiteSpace: "pre-line" }}>
              NOTE: Kindly check material in Good condition before taking
              delivery from Transporter. If any Damages occurred then revert
              immediately within 1 Working Day. There will not be acceptance of
              any damage complaint after 2 days of Receiving Material. Contact
              your Sales Person Immediately If any Damages Occurred
            </Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" color="primary" onClick={handleSubmit}>
          Generate & Download Document
        </Button>
      </DialogActions>
    </Dialog>
  );
};
