import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  TextField,
  Checkbox,
  FormControlLabel,
  Grid,
  Box,
  Typography,
  Chip,
} from "@mui/material";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import axios from "axios";
import { useSnackbar } from "notistack";
import configuration from "../../../configuration";

const GatePassReturn = ({ open, onClose, gatePass, onReturnProcessed }) => {
  const [returnDate, setReturnDate] = useState(new Date());
  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [returnItems, setReturnItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (open && gatePass) {
      fetchGatePassItems(gatePass.id);
    }
  }, [open, gatePass]);

  const fetchGatePassItems = async (id) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}gate-pass/${id}/`
      );

      // Initialize return items with pending quantities
      const items = response.data.items.map((item) => ({
        gate_pass_item_id: item.id,
        item_no: item.item_no,
        description: item.description,
        make: item.make,
        total_quantity: item.quantity,
        returned_quantity: item.returned_quantity,
        pending_quantity: item.pending_quantity,
        quantity: 0, // Default return quantity
        checked: false,
        condition: "",
        remarks: "",
      }));

      setReturnItems(items);
    } catch (error) {
      console.error("Error fetching gate pass items:", error);
      enqueueSnackbar("Failed to fetch gate pass items", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleItemCheck = (index, checked) => {
    setReturnItems((prev) => {
      const newItems = [...prev];
      newItems[index].checked = checked;

      // If checked, set quantity to pending quantity
      if (checked) {
        newItems[index].quantity = newItems[index].pending_quantity;
      } else {
        newItems[index].quantity = 0;
      }

      return newItems;
    });
  };

  const handleQuantityChange = (index, value) => {
    const parsedValue = parseFloat(value);

    if (isNaN(parsedValue) || parsedValue < 0) {
      return;
    }

    setReturnItems((prev) => {
      const newItems = [...prev];
      const item = newItems[index];

      // Ensure quantity doesn't exceed pending quantity
      const validQuantity = Math.min(parsedValue, item.pending_quantity);

      // Update quantity and checked status
      newItems[index].quantity = validQuantity;
      newItems[index].checked = validQuantity > 0;

      return newItems;
    });
  };

  const handleReturnAll = () => {
    setReturnItems((prev) => {
      return prev.map((item) => ({
        ...item,
        quantity: item.pending_quantity,
        checked: item.pending_quantity > 0,
      }));
    });
  };

  const handleClearAll = () => {
    setReturnItems((prev) => {
      return prev.map((item) => ({
        ...item,
        quantity: 0,
        checked: false,
        condition: "",
        remarks: "",
      }));
    });
  };

  const handleSubmit = async () => {
    // Validate form
    if (!receivedBy.trim()) {
      enqueueSnackbar("Please enter who received the items", {
        variant: "warning",
      });
      return;
    }

    const selectedItems = returnItems.filter(
      (item) => item.checked && item.quantity > 0
    );

    if (selectedItems.length === 0) {
      enqueueSnackbar("Please select at least one item to return", {
        variant: "warning",
      });
      return;
    }

    try {
      setLoading(true);

      const payload = {
        return_date: returnDate.toISOString().split("T")[0],
        received_by: receivedBy,
        remarks: remarks,
        items: selectedItems.map((item) => ({
          gate_pass_item_id: item.gate_pass_item_id,
          quantity: item.quantity,
          condition: item.condition,
          remarks: item.remarks,
        })),
      };

      const response = await axios.post(
        `${configuration.api_url}gate-pass/${gatePass.id}/return/`,
        payload
      );

      if (response.data.success) {
        enqueueSnackbar("Return processed successfully", {
          variant: "success",
        });
        onReturnProcessed();
      }
    } catch (error) {
      console.error("Error processing return:", error);
      enqueueSnackbar(
        error.response?.data?.error || "Failed to process return",
        { variant: "error" }
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>Process Return - {gatePass?.gate_pass_number}</DialogTitle>
      <DialogContent>
        {loading ? (
          <Typography>Loading...</Typography>
        ) : (
          <>
            <Grid container spacing={3} sx={{ mb: 3 }}>
              <Grid item xs={12} md={4}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Return Date"
                    value={returnDate}
                    onChange={(date) => setReturnDate(date)}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Received By"
                  value={receivedBy}
                  onChange={(e) => setReceivedBy(e.target.value)}
                  required
                />
              </Grid>
              <Grid item xs={12} md={4}>
                <TextField
                  fullWidth
                  label="Remarks"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  multiline
                  rows={1}
                />
              </Grid>
            </Grid>

            <Box
              sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}
            >
              <Typography variant="h6">Return Items</Typography>
              <Box>
                <Button
                  variant="outlined"
                  color="primary"
                  onClick={handleReturnAll}
                  sx={{ mr: 1 }}
                >
                  Return All
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={handleClearAll}
                >
                  Clear All
                </Button>
              </Box>
            </Box>

            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox"></TableCell>
                  <TableCell>Item Code</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Make</TableCell>
                  <TableCell>Total Qty</TableCell>
                  <TableCell>Returned Qty</TableCell>
                  <TableCell>Pending Qty</TableCell>
                  <TableCell>Return Qty</TableCell>
                  <TableCell>Condition on Return</TableCell>
                  <TableCell>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {returnItems.map((item, index) => (
                  <TableRow key={item.gate_pass_item_id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={item.checked}
                        onChange={(e) =>
                          handleItemCheck(index, e.target.checked)
                        }
                        disabled={item.pending_quantity === 0}
                      />
                    </TableCell>
                    <TableCell>{item.item_no}</TableCell>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.make}</TableCell>
                    <TableCell>{item.total_quantity}</TableCell>
                    <TableCell>{item.returned_quantity}</TableCell>
                    <TableCell>
                      {item.pending_quantity > 0 ? (
                        <Chip
                          label={item.pending_quantity}
                          color="primary"
                          size="small"
                        />
                      ) : (
                        <Chip
                          label="Fully Returned"
                          color="success"
                          size="small"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <TextField
                        type="number"
                        value={item.quantity}
                        onChange={(e) =>
                          handleQuantityChange(index, e.target.value)
                        }
                        InputProps={{
                          inputProps: {
                            min: 0,
                            max: item.pending_quantity,
                            step: 1,
                          },
                        }}
                        disabled={!item.checked || item.pending_quantity === 0}
                        size="small"
                        sx={{ width: "80px" }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={item.condition}
                        onChange={(e) => {
                          const newItems = [...returnItems];
                          newItems[index].condition = e.target.value;
                          setReturnItems(newItems);
                        }}
                        disabled={!item.checked || item.quantity === 0}
                        size="small"
                        sx={{ width: "120px" }}
                      />
                    </TableCell>
                    <TableCell>
                      <TextField
                        value={item.remarks}
                        onChange={(e) => {
                          const newItems = [...returnItems];
                          newItems[index].remarks = e.target.value;
                          setReturnItems(newItems);
                        }}
                        disabled={!item.checked || item.quantity === 0}
                        size="small"
                        sx={{ width: "120px" }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="primary"
          disabled={
            loading ||
            returnItems.filter((item) => item.checked && item.quantity > 0)
              .length === 0
          }
        >
          Process Return
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default GatePassReturn;
