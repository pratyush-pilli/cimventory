import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogActions,
  Button,
  Box,
  Typography,
  Snackbar,
  Alert,
  Grid,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  CircularProgress,
} from "@mui/material";

interface POLineItem {
  id: number;
  srNo: number;
  cpn: string;
  description: string;
  hsnSac: string;
  quantity: number;
  uom: string;
  unitRate: number;
  taxableValue: number;
  gstPercentage: number;
  gst: number;
  totalAmount: number;
}

interface POEditDialogProps {
  open: boolean;
  po: any;
  onClose: () => void;
  onSubmit: (updatedItems: POLineItem[]) => Promise<void>;
}

const POEditDialog: React.FC<POEditDialogProps> = ({
  open,
  po,
  onClose,
  onSubmit,
}) => {
  const [lineItems, setLineItems] = useState<POLineItem[]>([]);
  const [updating, setUpdating] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState({
    code: "INR",
    symbol: "₹",
  });
  const [poDetails, setPODetails] = useState({
    freightAndInsurance: "Inclusive",
    tpiInspection: "Exclusive",
    installation: "Exclusive",
    commissioning: "Exclusive",
  });
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliverySchedule, setDeliverySchedule] = useState("Within 4 weeks");

  const currencies = [
    { code: "INR", symbol: "₹" },
    { code: "USD", symbol: "$" },
    { code: "EUR", symbol: "€" },
    { code: "GBP", symbol: "£" },
  ];

  const selectStyles = {
    select: {
      height: "30px",
      "&.MuiSelect-select": {
        padding: "2px 8px",
      },
    },
    menuItem: {
      fontSize: "14px",
      padding: "4px 8px",
    },
  };

  useEffect(() => {
    if (po?.line_items) {
      const items = po.line_items.map((item: any, index: number) => ({
        id: index + 1,
        srNo: index + 1,
        cpn: item.item_no,
        description: item.material_description,
        hsnSac: item.hsn_code || "",
        quantity: item.quantity,
        uom: item.uom || "Nos",
        unitRate: item.unit_price,
        taxableValue: item.quantity * item.unit_price,
        gstPercentage: 18,
        gst: item.quantity * item.unit_price * 0.18,
        totalAmount: item.quantity * item.unit_price * 1.18,
      }));
      setLineItems(items);
    }
  }, [po]);

  const calculateLineItemValues = (item: POLineItem): POLineItem => {
    const taxableValue = item.quantity * item.unitRate;
    const gst = taxableValue * (item.gstPercentage / 100);
    return {
      ...item,
      taxableValue,
      gst,
      totalAmount: taxableValue + gst,
    };
  };

  const handleQuantityChange = (index: number, value: string) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = calculateLineItemValues({
      ...updatedItems[index],
      quantity: Number(value) || 0,
    });
    setLineItems(updatedItems);
  };

  const handleUnitRateChange = (index: number, value: string) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = calculateLineItemValues({
      ...updatedItems[index],
      unitRate: Number(value) || 0,
    });
    setLineItems(updatedItems);
  };

  const handleGstPercentageChange = (index: number, value: string) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = calculateLineItemValues({
      ...updatedItems[index],
      gstPercentage: Number(value) || 0,
    });
    setLineItems(updatedItems);
  };

  const calculateTotals = () => {
    return lineItems.reduce(
      (acc, item) => ({
        quantity: acc.quantity + item.quantity,
        taxableValue: acc.taxableValue + item.taxableValue,
        gst: acc.gst + item.gst,
        totalAmount: acc.totalAmount + item.totalAmount,
      }),
      { quantity: 0, taxableValue: 0, gst: 0, totalAmount: 0 }
    );
  };

  const handleSubmit = async () => {
    try {
      setUpdating(true);
      await onSubmit(lineItems);
    } catch (error) {
      console.error("Error updating PO:", error);
    } finally {
      setUpdating(false);
    }
  };

  return (
    <>
      {/* Full-screen loading overlay */}
      {updating && (
        <Box
          sx={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 10000, // Higher than dialog z-index
          }}
        >
          <CircularProgress size={60} sx={{ color: "white", mb: 2 }} />
          <Typography
            variant="h6"
            sx={{
              color: "white",
              fontWeight: "bold",
              textAlign: "center",
            }}
          >
            Please wait, processing...
          </Typography>
        </Box>
      )}

      <Dialog
        open={open}
        onClose={() => !updating && onClose()} // Prevent closing during update
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Typography variant="h5" align="center" sx={{ fontWeight: "bold" }}>
            PURCHASE ORDER
          </Typography>
        </DialogTitle>
        <DialogContent sx={{ p: 2 }}>
          <Box sx={{ border: "1px solid #000", p: 2 }}>
            {/* Two-column layout for header */}
            <Grid container>
              {/* Left column - Supplier Details */}
              <Grid item xs={6} sx={{ borderRight: "1px solid #000", pr: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: "bold" }}>
                  Supplier Details:
                </Typography>
                <Box>
                  <Typography variant="body1">{po?.vendor_name}</Typography>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    size="small"
                    value={po?.vendor_address}
                    sx={{ mt: 1 }}
                    disabled={updating} // Disable during update
                  />
                  <Typography sx={{ mt: 1 }}>
                    Kind Attention: {po?.vendor_contact}
                  </Typography>
                  <Typography>Email: {po?.vendor_email}</Typography>
                  <Typography>GST: {po?.vendor_gstin}</Typography>
                </Box>

                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: "bold", mt: 2 }}
                >
                  Billing Address:
                </Typography>
                <Box>
                  <Typography>CIMCON Software India Pvt. Ltd.</Typography>
                  <Typography>
                    1106/1117, 11th floor, Times Square Arcade – 1,
                  </Typography>
                  <Typography>
                    Opp. Rambaug, Near Baghbaan Party Plot Cross Road,
                  </Typography>
                  <Typography>Thaltej, Ahmedabad – 380059, India.</Typography>
                  <Typography>GST: 24AABCC1410E1ZL</Typography>
                </Box>
              </Grid>

              {/* Right column - PO Details */}
              <Grid item xs={6} sx={{ pl: 2 }}>
                <Table
                  size="small"
                  sx={{ "& td": { border: "1px solid #000" } }}
                >
                  <TableBody>
                    <TableRow>
                      <TableCell sx={{ width: "40%", fontWeight: "bold" }}>
                        CIMCON PO Number
                      </TableCell>
                      <TableCell>{po?.po_number}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>PO Date</TableCell>
                      <TableCell>
                        <TextField
                          type="date"
                          size="small"
                          fullWidth
                          value={po?.po_date}
                          disabled={updating} // Disable during update
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Quote Ref. Number
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={po?.quote_ref_number}
                          disabled={updating} // Disable during update
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Project Code
                      </TableCell>
                      <TableCell>{po?.project_code}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Freight & Insurance
                      </TableCell>
                      <TableCell>
                        <Select
                          value={poDetails.freightAndInsurance}
                          onChange={(e) =>
                            setPODetails({
                              ...poDetails,
                              freightAndInsurance: e.target.value,
                            })
                          }
                          size="small"
                          fullWidth
                          sx={selectStyles.select}
                          disabled={updating} // Disable during update
                        >
                          <MenuItem value="Inclusive">Inclusive</MenuItem>
                          <MenuItem value="Exclusive">Exclusive</MenuItem>
                        </Select>
                      </TableCell>
                    </TableRow>
                    {/* Add other rows similar to POPreviewDialog */}
                  </TableBody>
                </Table>
              </Grid>
            </Grid>

            {/* Currency Selection */}
            <Box sx={{ mb: 2, mt: 2 }}>
              <Select
                value={selectedCurrency.code}
                onChange={(e) =>
                  setSelectedCurrency(
                    currencies.find((c) => c.code === e.target.value) ||
                      currencies[0]
                  )
                }
                size="small"
                disabled={updating} // Disable during update
              >
                {currencies.map((currency) => (
                  <MenuItem key={currency.code} value={currency.code}>
                    {currency.code} ({currency.symbol})
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Items Table */}
            <TableContainer sx={{ mt: 3 }}>
              <Table
                size="small"
                sx={{
                  "& th, & td": {
                    border: "1px solid #000",
                    padding: "8px",
                  },
                }}
              >
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableCell>S/N</TableCell>
                    <TableCell>CIMCON P/N</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>HSN/SAC</TableCell>
                    <TableCell>Qty.</TableCell>
                    <TableCell>Unit Rate</TableCell>
                    <TableCell>Taxable Value</TableCell>
                    <TableCell>GST</TableCell>
                    <TableCell>Total Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell>{item.srNo}</TableCell>
                      <TableCell>{item.cpn}</TableCell>
                      <TableCell>
                        <TextField
                          value={item.description}
                          multiline
                          rows={2}
                          fullWidth
                          size="small"
                          disabled={updating} // Disable during update
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.hsnSac}
                          size="small"
                          fullWidth
                          disabled={updating} // Disable during update
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            handleQuantityChange(index, e.target.value)
                          }
                          size="small"
                          fullWidth
                          disabled={updating} // Disable during update
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.unitRate}
                          onChange={(e) =>
                            handleUnitRateChange(index, e.target.value)
                          }
                          size="small"
                          fullWidth
                          disabled={updating} // Disable during update
                        />
                      </TableCell>
                      <TableCell align="right">
                        {selectedCurrency.symbol} {item.taxableValue.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <TextField
                          type="number"
                          value={item.gstPercentage}
                          onChange={(e) =>
                            handleGstPercentageChange(index, e.target.value)
                          }
                          size="small"
                          InputProps={{
                            endAdornment: "%",
                          }}
                          disabled={updating} // Disable during update
                        />
                      </TableCell>
                      <TableCell align="right">
                        {selectedCurrency.symbol} {item.totalAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Totals Row */}
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableCell
                      colSpan={4}
                      align="right"
                      sx={{ fontWeight: "bold" }}
                    >
                      Total
                    </TableCell>
                    <TableCell align="right">
                      {calculateTotals().quantity}
                    </TableCell>
                    <TableCell />
                    <TableCell align="right">
                      {selectedCurrency.symbol}{" "}
                      {calculateTotals().taxableValue.toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      {selectedCurrency.symbol}{" "}
                      {calculateTotals().gst.toFixed(2)}
                    </TableCell>
                    <TableCell align="right">
                      {selectedCurrency.symbol}{" "}
                      {calculateTotals().totalAmount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Amount in Words */}
            <Box sx={{ mt: 2, border: "1px solid #000", p: 1 }}>
              <Typography>
                Amount in words: {/* Add number to words conversion */}
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button
            onClick={onClose}
            disabled={updating} // Disable cancel during update
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            color="primary"
            disabled={updating} // Disable button during update
          >
            {updating ? "Processing..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default POEditDialog;
