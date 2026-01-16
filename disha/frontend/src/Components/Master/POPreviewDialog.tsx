import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Box,
  Autocomplete,
  styled,
  InputAdornment,
  OutlinedInput,
  DialogContentText,
  Snackbar,
  Alert,
  Backdrop,
  CircularProgress,
} from "@mui/material";
import axios from "axios";
import configuration from "../../configuration";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { ToWords } from "to-words";
// import "./VendorUpdateDialog.scss";

interface POPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  selectedRows: any[];
  onGenerate: (poData: any, documentUrl: string) => void;
}

interface Currency {
  code: string;
  symbol: string;
}

interface LineItem {
  srNo: number;
  requisition_id: number;
  cpn: string;
  description: string;
  make: string;
  material_group: string;
  hsnSac: string;
  quantity: number;
  unitRate: number;
  taxableValue: number;
  gstPercentage: number;
  gst: number;
  totalAmount: number;
  uom: string;
}

interface Totals {
  quantity: number;
  taxableValue: number;
  gst: number;
  totalAmount: number;
  roundOff: number;
}

const POPreviewDialog: React.FC<POPreviewDialogProps> = ({
  open,
  onClose,
  selectedRows = [],
  onGenerate,
}) => {
  const [vendors, setVendors] = useState([]);
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [poData, setPOData] = useState({
    poDetails: {
      poNumber: "",
      poDate: new Date().toISOString().split("T")[0],
      poVersion: "",
      vendorCode: "",
      quoteRefNumber: "",
      projectCode: "",
    },
    invoiceTo: {
      name: "CIMCON Software India Pvt. Ltd.",
      address:
        "1105/1117, 11th floor, Times Square Arcade-1,\nOpp. Rambaug, Nr. Baghbaan Party Plot Cross Road,\nPaldi, Ahmedabad - 380059, Gujarat, India.",
      gstin: "24AABCC1410E1ZL",
      pan: "AABCC1410E",
      state: "Gujarat",
      stateCode: "24",
    },
    consignee: {
      name: "CIMCON Software India Pvt. Ltd.",
      address:
        "802, Sakar IV, Opp. Townhall,\nEllisbridge, Ashram Road\nAhmedabad - 380006, Gujarat, India",
      mobile: "8758006007",
      attention: "Ashish Solanki",
    },
    supplier: {
      name: "",
      address: "",
      email: "",
      contact: "",
      payment_term: "",
      contact_person: "",
      gstin: "",
      pan: "",
      state: "",
      stateCode: "",
      vendorCode: "",
    },
    terms: {
      payment: "100% Against Invoice",
      warranty: "1 year from date of invoice",
      delivery: "1 week from date of Purchase order",
      dispatch: "Freight & Insurance Extra",
      tpi: "TPI Inspection Exclusive",
      installation: "Installation & Comm. Exclusive",
    },
    notes: "NA",
    items: [],
  });

  const [selectedCurrency, setSelectedCurrency] = useState<Currency>({
    code: "INR",
    symbol: "₹",
  });

  const currencies: Currency[] = [
    { code: "INR", symbol: "₹" },
    { code: "USD", symbol: "$" },
    { code: "EUR", symbol: "€" },
    { code: "GBP", symbol: "£" },
    { code: "JPY", symbol: "¥" },
    { code: "CNY", symbol: "¥" },
    { code: "AUD", symbol: "A$" },
    { code: "CAD", symbol: "C$" },
    { code: "SGD", symbol: "S$" },
    { code: "AED", symbol: "د.إ" },
  ];

  const [deliverySchedule, setDeliverySchedule] = useState("Within 4 weeks");
  const [freightType, setFreightType] = useState("Inclusive");
  const [tpiType, setTpiType] = useState("");
  const [installationType, setInstallationType] = useState("");
  const [commissioningType, setCommissioningType] = useState("");

  const [lineItems, setLineItems] = useState<LineItem[]>([]);

  const [poDetails, setPODetails] = useState({
    freightAndInsurance: "Inclusive",
    tpiInspection: "Exclusive",
    installation: "Exclusive",
    commissioning: "Exclusive",
  });

  const [deliveryAddress, setDeliveryAddress] = useState(
    "CIMCON Software India Pvt. Ltd., 802, i-Square Corporate Park..."
  );

  const [error, setError] = useState("");

  const [termsAndConditions, setTermsAndConditions] = useState("");
  const [isTermsDialogOpen, setIsTermsDialogOpen] = useState(false);
  const [isTermsUpdated, setIsTermsUpdated] = useState(false);

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);

  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  const [vendorUpdateDialog, setVendorUpdateDialog] = useState({
    open: false,
    vendorId: null,
    vendorData: null,
  });

  const [apiLoading, setApiLoading] = useState<boolean>(false);

  const [termsConfirmationDialog, setTermsConfirmationDialog] = useState({
    open: false,
    message: "Do you want to change the Terms and Conditions?",
  });

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
    // Fetch vendors
    const fetchVendors = async () => {
      setApiLoading(true);
      try {
        const response = await axios.get(`${configuration.api_url}/vendors/`);
        setVendors(response.data);
      } catch (error) {
        console.error("Error fetching vendors:", error);
      } finally {
        setApiLoading(false);
      }
    };

    const fetchLatestPONumber = async () => {
      setApiLoading(true);
      try {
        const response = await axios.get(
          `${configuration.api_url}/get-latest-po-number/`
        );
        const latestPoNumber = response.data.latest_po_number;

        // Get order type from first selected row
        const orderType = selectedRows[0]?.order_type || "";

        // Generate the new PO number based on the latest one
        if (latestPoNumber) {
          const basePONumber = generateNewPONumber(latestPoNumber);

          // Append order type if available
          const newPoNumber = orderType
            ? `${basePONumber}-${orderType}`
            : basePONumber;

          setPOData((prev) => ({
            ...prev,
            poDetails: {
              ...prev.poDetails,
              poNumber: newPoNumber,
            },
          }));
        } else {
          // If no previous PO exists, set a default format with order type
          const defaultNumber = "CIMPO-2526" + "00001";
          const orderType = selectedRows[0]?.order_type || "";
          const poNumber = orderType
            ? `${defaultNumber}-${orderType}`
            : defaultNumber;

          setPOData((prev) => ({
            ...prev,
            poDetails: {
              ...prev.poDetails,
              poNumber: poNumber,
            },
          }));
        }
      } catch (error) {
        console.error("Error fetching latest PO number:", error);
      } finally {
        setApiLoading(false);
      }
    };

    if (open) {
      fetchVendors();
      fetchLatestPONumber();

      // Get unique project codes and quote ref numbers from selected items
      const uniqueProjectCodes = [
        ...new Set(
          selectedRows
            .map((item) => item.project_code)
            .filter((code) => code && code.trim() !== "")
        ),
      ];

      const uniqueQuoteRefs = [
        ...new Set(
          selectedRows
            .map((item) => item.quote_ref_number)
            .filter((ref) => ref && ref.trim() !== "")
        ),
      ];

      // Initialize items with proper quantities and UoM from selectedRows
      const items: LineItem[] = selectedRows.map((item, index) => ({
        srNo: index + 1,
        requisition_id: item.id,
        cpn: item.cimcon_part_number || "",
        description: item.material_description || "",
        make: item.make || "",
        material_group: item.material_group || "",
        hsnSac: item.hsn_code || "",
        quantity: Number(item.ordering_qty) || 0,
        unitRate: Number(item.unit_price) || 0,
        gstPercentage: 18,
        taxableValue: 0,
        gst: 0,
        totalAmount: 0,
        uom: item.unit,
      }));

      // Calculate initial values
      const calculatedItems = items.map((item) =>
        calculateLineItemValues(item)
      );
      setLineItems(calculatedItems);

      setPOData((prev) => ({
        ...prev,
        items: calculatedItems,
        poDetails: {
          ...prev.poDetails,
          projectCode: uniqueProjectCodes.join(", "),
          quoteRefNumber: uniqueQuoteRefs.join(", "),
        },
      }));

      setPODetails({
        freightAndInsurance: "Inclusive",
        tpiInspection: "Exclusive",
        installation: "Exclusive",
        commissioning: "Exclusive",
      });
    }
  }, [open, selectedRows]);

  const generateNewPONumber = (latestPoNumber: string) => {
    const parts = latestPoNumber.split("-");
    const sequencePart = parts[1];
    const newSequenceNumber = parseInt(sequencePart.slice(-5)) + 1; // Increment the last 5 digits
    return `${parts[0]}-${parts[1].slice(0, -5)}${String(
      newSequenceNumber
    ).padStart(5, "0")}`;
  };

  const handleVendorChange = (event) => {
    const vendor = vendors.find((v) => v.id === event.target.value);
    setSelectedVendor(vendor);
    console.log("Selected Vendor:", vendor);

    // Set vendor data in poData
    setPOData((prev) => ({
      ...prev,
      supplier: {
        name: vendor?.vendor_name || "",
        address: vendor?.address || "",
        email: vendor?.email_1 || vendor?.email_2 || "",
        contact: vendor?.mobile_no_1 || vendor?.mobile_no_2 || "",
        contact_person: vendor?.contact_person ? vendor.contact_person : "",
        payment_term: vendor?.payment_term ? vendor.payment_term : "-",
        gstin: vendor?.gst_number ? vendor.gst_number : "",
        pan: vendor?.pan_number ? vendor.pan_number : "",
        state: vendor?.state ? vendor.state : "",
        stateCode: vendor?.state_code ? vendor.state_code : "",
        vendorCode: vendor?.vendor_id ? vendor?.vendor_id : "",
      },
    }));

    // Check for missing important vendor information
    const hasMissingInfo =
      !vendor?.gst_number ||
      vendor?.gst_number === "-" ||
      !vendor?.pan_number ||
      vendor?.pan_number === "-" ||
      !vendor?.state ||
      vendor?.state === "-" ||
      !vendor?.state_code ||
      vendor?.state_code === "-" ||
      !vendor?.payment_term ||
      vendor?.payment_term === "-";

    // If there's missing info, open the update dialog
    if (hasMissingInfo && vendor) {
      setVendorUpdateDialog({
        open: true,
        vendorId: vendor.id,
        vendorData: {
          vendor_name: vendor.vendor_name,
          gst_number: vendor.gst_number || "",
          pan_number: vendor.pan_number || "",
          state: vendor.state || "",
          state_code: vendor.state_code || "",
          payment_term: vendor.payment_term || "",
          email_1: vendor.email_1 || "",
          mobile_no_1: vendor.mobile_no_1 || "",
          contact_person: vendor.contact_person || "",
        },
      });
    }
  };

  const handleChange = (section, field, value) => {
    setPOData((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [field]: value,
      },
    }));
  };

  const handlePriceChange = (index: number, value: string) => {
    const updatedItems = [...poData.items];
    updatedItems[index].price = parseFloat(value) || 0; // Update price
    updatedItems[index].amount = (
      updatedItems[index].orderingQty * updatedItems[index].price
    ).toFixed(2); // Recalculate amount
    setPOData((prev) => ({ ...prev, items: updatedItems }));
  };

  const handleOrderingQtyChange = (index: number, value: string) => {
    const updatedItems = [...poData.items];
    const numValue = parseFloat(value) || 0;
    const item = updatedItems[index];

    const validatedQty = numValue;

    updatedItems[index] = {
      ...item,
      orderingQty: validatedQty,
      amount: (validatedQty * item.price).toFixed(2),
    };

    setPOData((prev) => ({ ...prev, items: updatedItems }));
  };

  const handleSubmit = async () => {
    try {
      // Validate required fields
      if (!poData.poDetails.poNumber || !selectedVendor) {
        setError("Please fill in all required fields");
        return;
      }

      // Show custom dialog instead of window.confirm
      setTermsConfirmationDialog((prev) => ({ ...prev, open: true }));
    } catch (error) {
      console.error("Error generating PO:", error);
      alert("Failed to generate Purchase Order");
    }
  };

  const calculateLineItemValues = (item: LineItem): LineItem => {
    // Ensure we're working with numbers
    const quantity = Number(item.quantity) || 0;
    const unitRate = Number(item.unitRate) || 0;
    const gstPercentage = Number(item.gstPercentage) || 18;

    // Calculate values
    const taxableValue = quantity * unitRate;
    const gst = taxableValue * (gstPercentage / 100);
    const totalAmount = taxableValue + gst;

    return {
      ...item,
      quantity,
      unitRate,
      taxableValue: Number(taxableValue.toFixed(2)),
      gstPercentage,
      gst: Number(gst.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
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

  const calculateTotals = (): Totals => {
    const totals = lineItems.reduce(
      (acc, item) => ({
        quantity: acc.quantity + Number(item.quantity),
        taxableValue: acc.taxableValue + Number(item.taxableValue),
        gst: acc.gst + Number(item.gst),
        totalAmount: acc.totalAmount + Number(item.totalAmount),
      }),
      { quantity: 0, taxableValue: 0, gst: 0, totalAmount: 0 }
    );

    // Calculate round off
    const roundedTotal = Math.round(totals.totalAmount);
    const roundOff = roundedTotal - totals.totalAmount;

    return {
      ...totals,
      totalAmount: roundedTotal,
      roundOff: Number(roundOff.toFixed(2)),
    };
  };

  const handlePoDetailChange = (field: string, value: string) => {
    setPODetails((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleGstPercentageChange = (index: number, value: string) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = calculateLineItemValues({
      ...updatedItems[index],
      gstPercentage: Number(value) || 0,
    });
    setLineItems(updatedItems);
  };

  const handleDescriptionChange = (index: number, value: string) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = {
      ...updatedItems[index],
      description: value,
    };
    setLineItems(updatedItems);
  };

  const handleHsnChange = (index: number, value: string) => {
    const updatedItems = [...lineItems];
    updatedItems[index] = {
      ...updatedItems[index],
      hsnSac: value,
    };
    setLineItems(updatedItems);
  };

  const handleTermsSave = (newTerms) => {
    // Instead of relying on state update, pass the new terms directly to the function
    setTermsAndConditions(newTerms);
    setIsTermsDialogOpen(false);
    saveAndGeneratePO(newTerms); // Pass the new terms directly
  };

  const saveAndGeneratePO = async (directTerms = null) => {
    setApiLoading(true);
    try {
      // Validate required fields
      if (!poData.poDetails.poNumber || !selectedVendor) {
        setError("Please fill in all required fields");
        return;
      }

      // Use directTerms if provided (from dialog), otherwise use state
      const termsToUse =
        directTerms !== null ? directTerms : termsAndConditions;

      // Better extraction of attention from delivery address
      const extractAttention = (address) => {
        if (address.includes("Kind Attn:")) {
          const attentionPart = address.split("Kind Attn:")[1];
          return attentionPart
            ? attentionPart.trim().split(",")[0].split("Ph")[0].trim()
            : "Ashish Solanki";
        } else if (address.includes("Attn:")) {
          const attentionPart = address.split("Attn:")[1];
          return attentionPart
            ? attentionPart.trim().split(",")[0].split("Ph")[0].trim()
            : "Ashish Solanki";
        }
        return "Ashish Solanki";
      };

      // Better extraction of mobile from delivery address
      const extractMobile = (address) => {
        if (address.includes("Ph:")) {
          const phonePart = address.split("Ph:")[1];
          return phonePart
            ? phonePart
                .trim()
                .split(" ")[0]
                .replace(/[^0-9]/g, "")
            : "8758006007";
        } else if (address.includes("Ph.")) {
          const phonePart = address.split("Ph.")[1];
          return phonePart
            ? phonePart
                .trim()
                .split(" ")[0]
                .replace(/[^0-9]/g, "")
            : "8758006007";
        } else if (address.includes("Ph -")) {
          const phonePart = address.split("Ph -")[1];
          return phonePart
            ? phonePart
                .trim()
                .split(" ")[0]
                .replace(/[^0-9]/g, "")
            : "8758006007";
        }
        return "8758006007";
      };

      // Create the payload
      const poGenerationPayload = {
        poDetails: {
          poNumber: poData.poDetails.poNumber,
          poDate: poData.poDetails.poDate,
          poVersion: poData.poDetails.poVersion,
          quoteRefNumber: poData.poDetails.quoteRefNumber,
          projectCode: poData.poDetails.projectCode,
          vendorCode: poData.poDetails.vendorCode,
          supplier: poData.supplier,
          invoiceTo: poData.invoiceTo,
          consignee: {
            name: "CIMCON Software India Pvt. Ltd.",
            address: deliveryAddress,
            mobile: extractMobile(deliveryAddress),
            attention: extractAttention(deliveryAddress),
          },
          terms: {
            ...poData.terms,
            tpiInspection: poDetails.tpiInspection,
            installation: poDetails.installation,
            commissioning: poDetails.commissioning,
            delivery: deliverySchedule,
            freightAndInsurance: poDetails.freightAndInsurance,
          },
        },
        items: lineItems.map((item) => ({
          requisition_id: item.requisition_id,
          item_no: item.cpn || "",
          material_description: item.description || "",
          make: item.make || "",
          material_group: item.material_group || "",
          quantity: item.quantity || 0,
          unit: item.uom || "",
          unit_price: item.unitRate || 0,
          total_price: item.totalAmount || 0,
          hsn_sac: item.hsnSac || "",
          gst_percentage: item.gstPercentage || 0,
          taxable_value: item.taxableValue || 0,
        })),
        currency: selectedCurrency,
        deliveryAddress: deliveryAddress,
        deliverySchedule: deliverySchedule,
        totals: calculateTotals(),
        totalInWords: numberToWords(
          calculateTotals().totalAmount,
          selectedCurrency.code
        ),
        notes: "NA",
        status: "draft",
        terms_and_conditions: termsToUse,
      };
      const savePOPayload = {
        po_number: poData.poDetails.poNumber,
        po_date: poData.poDetails.poDate,
        quote_ref_number: poData.poDetails.quoteRefNumber || "",
        project_code: poData.poDetails.projectCode || "",
        vendor_name: selectedVendor?.vendor_name || "na",
        vendor_code: selectedVendor?.vendor_id || "", // Add this
        vendor_address: selectedVendor?.address || "na",
        vendor_email:
          selectedVendor?.email_1 || selectedVendor?.email_2 || "na",
        vendor_gstin: selectedVendor?.gst_number || "0", //
        // Adjust as needed
        vendor_pan: selectedVendor?.pan_number || "0",
        vendor_state: selectedVendor?.state || "na",
        vendor_state_code: selectedVendor?.state_code || "na",
        vendor_contact:
          selectedVendor?.mobile_no_1 || selectedVendor?.mobile_no_2 || "na",
        vendor_payment_terms: selectedVendor?.payment_term || "na",
        consignee_name: "CIMCON Software India Pvt. Ltd.",
        consignee_address: deliveryAddress, // Use the selected delivery address
        consignee_mobile:
          deliveryAddress.includes("Ph:") || deliveryAddress.includes("Ph.")
            ? deliveryAddress.split("Ph:")[1]?.trim().split(" ")[0] ||
              deliveryAddress.split("Ph.")[1]?.trim().split(" ")[0] ||
              "8758006007"
            : "8758006007",
        consignee_attention:
          deliveryAddress.includes("Attn:") ||
          deliveryAddress.includes("Kind Attn:")
            ? deliveryAddress.split("Attn:")[1]?.trim().split(" ")[0] ||
              deliveryAddress.split("Kind Attn:")[1]?.trim().split(" ")[0] ||
              "Ashish Solanki"
            : "Ashish Solanki",

        // Billing address fields
        invoice_name: poData.invoiceTo.name,
        invoice_address: poData.invoiceTo.address,
        invoice_gstin: poData.invoiceTo.gstin,
        invoice_pan: poData.invoiceTo.pan,
        invoice_state: poData.invoiceTo.state,
        invoice_state_code: poData.invoiceTo.stateCode,

        total_amount: calculateTotals().totalAmount || 0, // Ensure this is valid
        payment_terms: poData.terms.payment,
        warranty_terms: poData.terms.warranty,
        delivery_schedule: deliverySchedule,
        freight_terms: poDetails.freightAndInsurance || "",
        tpi_terms: poDetails.tpiInspection || "",
        installation_terms: poDetails.installation || "",
        commissioning: poDetails.commissioning || "",
        notes: poData.notes || "NA",
        status: "draft",
        items: lineItems.map((item) => ({
          requisition_id: item.requisition_id,
          item_no: item.cpn || "",
          material_description: item.description || "",
          make: item.make || "",
          material_group: item.material_group || "",
          quantity: item.quantity || 0,
          unit: item.uom || "",
          unit_price: item.unitRate || 0,
          total_price: item.totalAmount || 0,
          hsn_sac: item.hsnSac || "",
          gst_percentage: item.gstPercentage || 0,
          taxable_value: item.taxableValue || 0,
        })),
        currency_code: selectedCurrency.code,
        currency_symbol: selectedCurrency.symbol,
      };

      // First save the PO data to the database
      console.log("Payload field lengths:");
      console.log("PO Number Length:", savePOPayload.po_number.length);
      console.log("Vendor Name Length:", savePOPayload.vendor_name.length);
      console.log("Vendor GSTIN Length:", savePOPayload.vendor_gstin.length);
      console.log("Invoice Name Length:", savePOPayload.invoice_name.length);
      console.log("Project Code Length:", savePOPayload.project_code.length);
      console.log(
        "Quote Ref Number Length:",
        savePOPayload.quote_ref_number.length
      );
      console.log("Data to be saved");
      console.log(savePOPayload);
      await axios.post(`${configuration.api_url}save-po/`, savePOPayload);
      console.log("PO saved successfully!");

      // Then generate the PDF
      const generateResponse = await axios.post(
        `${configuration.api_url}/master/generate-po/`,
        poGenerationPayload,
        { responseType: "blob" }
      );

      // Handle PDF generation and download
      const pdfBlob = new Blob([generateResponse.data], {
        type: "application/pdf",
      });

      // Create a download link and click it
      const downloadUrl = window.URL.createObjectURL(pdfBlob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${poData.poDetails.poNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Show a success message
      setSnackbar({
        open: true,
        message: "PO saved and generated successfully",
        severity: "success",
      });

      // Call onGenerate with the PO data to trigger parent refresh
      onGenerate(poGenerationPayload);

      // Close the dialog after a short delay
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error) {
      console.error("Error in save and generate PO:", error);
      // Extract more error details if available
      if (error.response && error.response.data) {
        const reader = new FileReader();
        reader.onload = () => {
          const errorText = reader.result;
          console.error("Server error details:", errorText);
          alert(`Failed to process Purchase Order: ${errorText}`);
        };
        reader.readAsText(error.response.data);
      } else {
        alert("Failed to process Purchase Order");
      }
    } finally {
      setApiLoading(false);
    }
  };

  const handleTermsConfirmation = async (confirmed: boolean) => {
    setTermsConfirmationDialog((prev) => ({ ...prev, open: false }));

    if (confirmed) {
      const originalTerms = await fetchOriginalTerms();
      setTermsAndConditions(originalTerms);
      setIsTermsDialogOpen(true);
    } else {
      const originalTerms = await fetchOriginalTerms();
      setTermsAndConditions(originalTerms);
      saveAndGeneratePO(originalTerms);
    }
  };

  const TermsDialog = ({ open, onClose, onSave }) => {
    const [termsText, setTermsText] = useState(termsAndConditions);

    useEffect(() => {
      setTermsText(termsAndConditions); // Reset text when dialog opens
    }, [open, termsAndConditions]); // Update when termsAndConditions changes

    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>Edit Terms and Conditions</DialogTitle>
        <DialogContent sx={{ maxHeight: "80vh", overflowY: "auto" }}>
          <TextField
            multiline
            rows={20}
            fullWidth
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            variant="outlined"
            InputProps={{
              style: { height: "100%" },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => {
              onSave(termsText);
              onClose();
            }}
            variant="contained"
            color="primary"
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const fetchOriginalTerms = async () => {
    try {
      const response = await axios.get(`${configuration.api_url}/terms-conds/`);
      return response.data; // Assuming the T&C is returned as plain text
    } catch (error) {
      console.error("Error fetching original T&C:", error);
      return ""; // Return empty string on error
    }
  };

  const handleDialogClose = () => {
    setConfirmDialogOpen(true);
  };

  const handleConfirmClose = () => {
    setConfirmDialogOpen(false);
    onClose();
  };

  const handleCancelClose = () => {
    setConfirmDialogOpen(false);
  };

  const handleVendorDataUpdate = async (formData) => {
    setApiLoading(true);
    try {
      if (!vendorUpdateDialog.vendorId) {
        console.error("Missing vendor ID");
        return;
      }

      // Log the form data being sent
      console.log("Form data being sent:", {
        payment_term: formData.get("payment_term"),
        vendor_name: formData.get("vendor_name"),
        // Log other relevant fields
      });

      const response = await axios.put(
        `${configuration.api_url}/quick-update-vendor/${vendorUpdateDialog.vendorId}/`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );

      // Log the response data
      console.log("API Response:", response.data);

      // Get the updated vendor data from the response
      const updatedVendorData = response.data.data;
      console.log("Updated vendor data:", updatedVendorData);

      // Update local vendor data with the response data
      const updatedVendors = vendors.map((v) =>
        v.id === vendorUpdateDialog.vendorId
          ? { ...v, ...updatedVendorData }
          : v
      );
      setVendors(updatedVendors);

      // Update selected vendor
      const updatedVendor = updatedVendors.find(
        (v) => v.id === vendorUpdateDialog.vendorId
      );
      console.log("Updated selected vendor:", updatedVendor);
      setSelectedVendor(updatedVendor);

      // Update PO data with new vendor info
      setPOData((prev) => {
        const newSupplierData = {
          name: updatedVendor?.vendor_name || "",
          address: updatedVendor?.address || "",
          email: updatedVendor?.email_1 || updatedVendor?.email_2 || "",
          contact:
            updatedVendor?.mobile_no_1 || updatedVendor?.mobile_no_2 || "",
          contact_person: updatedVendor?.contact_person || "",
          payment_term: updatedVendor?.payment_term || "-",
          gstin: updatedVendor?.gst_number || "",
          pan: updatedVendor?.pan_number || "",
          state: updatedVendor?.state || "",
          stateCode: updatedVendor?.state_code || "",
          vendorCode: updatedVendor?.vendor_id || "",
        };
        console.log("New supplier data being set:", newSupplierData);
        return {
          ...prev,
          supplier: newSupplierData,
        };
      });

      // Show success message
      setSnackbar({
        open: true,
        message: "Vendor information updated successfully",
        severity: "success",
      });

      // Close the dialog
      setVendorUpdateDialog({
        open: false,
        vendorId: null,
        vendorData: null,
      });
    } catch (error) {
      console.error("Error updating vendor data:", error);
      console.error("Error details:", error.response?.data);
      setSnackbar({
        open: true,
        message:
          "Failed to update vendor information: " +
          (error.response?.data?.error || error.message),
        severity: "error",
      });
    } finally {
      setApiLoading(false);
    }
  };

  const VendorUpdateDialog = () => {
    const [localVendorData, setLocalVendorData] = useState(
      vendorUpdateDialog.vendorData || {}
    );
    // State to track file uploads
    const [uploadedFiles, setUploadedFiles] = useState({
      pan_card: null,
      gst_certificate: null,
      incorporation_certificate: null,
      cancelled_cheque: null,
      tan_allotment_letter: null,
      udyam_certificate_msme: null,
      vendor_reg_form: null,
    });

    // Update local state when the dialog opens with new vendor data
    useEffect(() => {
      if (vendorUpdateDialog.open && vendorUpdateDialog.vendorData) {
        setLocalVendorData(vendorUpdateDialog.vendorData);
        // Reset file state when dialog opens
        setUploadedFiles({
          pan_card: null,
          gst_certificate: null,
          incorporation_certificate: null,
          cancelled_cheque: null,
          tan_allotment_letter: null,
          udyam_certificate_msme: null,
          vendor_reg_form: null,
        });
      }
    }, [vendorUpdateDialog.open, vendorUpdateDialog.vendorId]);

    // Handle file change
    const handleFileChange = (e) => {
      const { name, files } = e.target;
      if (files && files.length > 0) {
        setUploadedFiles((prev) => ({
          ...prev,
          [name]: files[0],
        }));
      }
    };

    // If dialog is closed or no data, don't render
    if (!vendorUpdateDialog.open || !vendorUpdateDialog.vendorData) return null;

    // Add logging for local vendor data changes
    const handleFieldChange = (field, value) => {
      console.log(`Updating field ${field} to:`, value);
      setLocalVendorData((prev) => {
        const newData = {
          ...prev,
          [field]: value,
        };
        console.log("New local vendor data:", newData);
        return newData;
      });
    };

    // Modify handleSubmit to ensure payment terms are included
    const handleSubmit = () => {
      const formData = new FormData();

      // Add text fields with explicit type checking
      Object.entries(localVendorData).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          // Ensure value is converted to string
          formData.append(key, String(value));
        }
      });

      // Add files
      Object.entries(uploadedFiles).forEach(([key, file]) => {
        if (file) {
          console.log(`Adding file for ${key}:`, file.name);
          formData.append(key, file);
        }
      });

      // Log the complete form data
      console.log("Form data being submitted:", {
        textFields: Object.fromEntries(
          Array.from(formData.entries()).filter(
            ([_, value]) => !(value instanceof File)
          )
        ),
        files: Object.fromEntries(
          Array.from(formData.entries())
            .filter(([_, value]) => value instanceof File)
            .map(([key, file]) => [key, (file as File).name])
        ),
      });

      // Explicitly check payment terms
      if (!formData.get("payment_term")) {
        console.warn("Payment terms not found in form data");
      }

      handleVendorDataUpdate(formData);
    };

    return (
      <Dialog
        open={vendorUpdateDialog.open}
        onClose={() =>
          setVendorUpdateDialog((prev) => ({ ...prev, open: false }))
        }
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Update Vendor Information</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Some important vendor information is missing or incomplete. Please
            update the details below.
          </DialogContentText>

          <Grid container spacing={2}>
            <Grid item xs={12}>
              <Typography variant="subtitle2" color="primary">
                Vendor: {localVendorData.vendor_name}
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="GST Number"
                fullWidth
                value={localVendorData.gst_number || ""}
                onChange={(e) =>
                  handleFieldChange("gst_number", e.target.value)
                }
                error={!localVendorData.gst_number}
                helperText={
                  !localVendorData.gst_number ? "GST Number is required" : ""
                }
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="PAN Number"
                fullWidth
                value={localVendorData.pan_number || ""}
                onChange={(e) =>
                  handleFieldChange("pan_number", e.target.value)
                }
                error={!localVendorData.pan_number}
                helperText={
                  !localVendorData.pan_number ? "PAN Number is required" : ""
                }
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="State"
                fullWidth
                value={localVendorData.state || ""}
                onChange={(e) => handleFieldChange("state", e.target.value)}
                error={!localVendorData.state}
                helperText={!localVendorData.state ? "State is required" : ""}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="State Code"
                fullWidth
                value={localVendorData.state_code || ""}
                onChange={(e) =>
                  handleFieldChange("state_code", e.target.value)
                }
                error={!localVendorData.state_code}
                helperText={
                  !localVendorData.state_code ? "State Code is required" : ""
                }
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Payment Terms"
                fullWidth
                value={localVendorData.payment_term || ""}
                onChange={(e) =>
                  handleFieldChange("payment_term", e.target.value)
                }
                error={
                  !localVendorData.payment_term ||
                  localVendorData.payment_term === "-"
                }
                helperText={
                  !localVendorData.payment_term ||
                  localVendorData.payment_term === "-"
                    ? "Payment Terms are required"
                    : ""
                }
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Email"
                type="email"
                fullWidth
                value={localVendorData.email_1 || ""}
                onChange={(e) => handleFieldChange("email_1", e.target.value)}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Mobile Number"
                fullWidth
                value={localVendorData.mobile_no_1 || ""}
                onChange={(e) =>
                  handleFieldChange("mobile_no_1", e.target.value)
                }
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                label="Contact Person"
                fullWidth
                value={localVendorData.contact_person || ""}
                onChange={(e) =>
                  handleFieldChange("contact_person", e.target.value)
                }
              />
            </Grid>

            {/* Add file upload fields */}
            <Grid item xs={12}>
              <Typography variant="subtitle1" sx={{ mt: 2, mb: 1 }}>
                Document Uploads
              </Typography>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">PAN Card*</Typography>
                <input
                  type="file"
                  name="pan_card"
                  id="pan_card-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                {uploadedFiles.pan_card && (
                  <Typography variant="body2" color="primary">
                    Selected: {uploadedFiles.pan_card.name}
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">GST Certificate*</Typography>
                <input
                  type="file"
                  name="gst_certificate"
                  id="gst_certificate-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                {uploadedFiles.gst_certificate && (
                  <Typography variant="body2" color="primary">
                    Selected: {uploadedFiles.gst_certificate.name}
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">
                  Incorporation Certificate*
                </Typography>
                <input
                  type="file"
                  name="incorporation_certificate"
                  id="incorporation_certificate-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                {uploadedFiles.incorporation_certificate && (
                  <Typography variant="body2" color="primary">
                    Selected: {uploadedFiles.incorporation_certificate.name}
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">Cancelled Cheque*</Typography>
                <input
                  type="file"
                  name="cancelled_cheque"
                  id="cancelled_cheque-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                {uploadedFiles.cancelled_cheque && (
                  <Typography variant="body2" color="primary">
                    Selected: {uploadedFiles.cancelled_cheque.name}
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">
                  TAN Allotment Letter*
                </Typography>
                <input
                  type="file"
                  name="tan_allotment_letter"
                  id="tan_allotment_letter-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                {uploadedFiles.tan_allotment_letter && (
                  <Typography variant="body2" color="primary">
                    Selected: {uploadedFiles.tan_allotment_letter.name}
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">
                  UDYAM Certificate (MSME)
                </Typography>
                <input
                  type="file"
                  name="udyam_certificate_msme"
                  id="udyam_certificate_msme-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                {uploadedFiles.udyam_certificate_msme && (
                  <Typography variant="body2" color="primary">
                    Selected: {uploadedFiles.udyam_certificate_msme.name}
                  </Typography>
                )}
              </Box>
            </Grid>

            <Grid item xs={12} md={6}>
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2">
                  Vendor Registration Form*
                </Typography>
                <input
                  type="file"
                  name="vendor_reg_form"
                  id="vendor_reg_form-upload"
                  onChange={handleFileChange}
                  accept=".pdf,.jpg,.jpeg,.png"
                />
                {uploadedFiles.vendor_reg_form && (
                  <Typography variant="body2" color="primary">
                    Selected: {uploadedFiles.vendor_reg_form.name}
                  </Typography>
                )}
              </Box>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setVendorUpdateDialog((prev) => ({ ...prev, open: false }))
            }
          >
            Cancel
          </Button>
          <Button variant="contained" color="primary" onClick={handleSubmit}>
            Update Vendor
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <>
      <Dialog open={open} onClose={handleDialogClose} maxWidth="lg" fullWidth>
        <Backdrop
          sx={{
            color: "#fff",
            zIndex: (theme) => theme.zIndex.drawer + 1,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
          }}
          open={apiLoading}
        >
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 2,
            }}
          >
            <CircularProgress color="inherit" size={60} />
            <Typography variant="h6" color="inherit">
              Processing... Please wait
            </Typography>
          </Box>
        </Backdrop>
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
                  <Autocomplete
                    options={vendors}
                    getOptionLabel={(option) => option.vendor_name}
                    value={selectedVendor}
                    onChange={(event, newValue) =>
                      handleVendorChange({ target: { value: newValue?.id } })
                    }
                    renderInput={(params) => (
                      <TextField {...params} size="small" fullWidth />
                    )}
                  />
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    size="small"
                    value={poData.supplier.address}
                    onChange={(e) =>
                      handleChange("supplier", "address", e.target.value)
                    }
                    sx={{ mt: 1 }}
                  />
                  <Typography sx={{ mt: 1 }}>
                    Kind Attention: {poData.supplier.contact_person} (
                    {poData.supplier.contact})
                  </Typography>
                  <Typography>Email: {poData.supplier.email}</Typography>
                  <Typography>GST: {poData.supplier.gstin}</Typography>
                  <Typography>PAN No: {poData.supplier.pan}</Typography>
                  <Typography>State: {poData.supplier.state}</Typography>
                  <Typography>
                    State Code: {poData.supplier.stateCode}
                  </Typography>
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
                  <Typography>PAN No: AABCC1410E</Typography>
                  <Typography>State: Gujarat</Typography>
                  <Typography>State Code: 24</Typography>
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
                      <TableCell>{poData.poDetails.poNumber}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>PO Date</TableCell>
                      <TableCell>{poData.poDetails.poDate}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        PO Version
                      </TableCell>
                      <TableCell>01</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Quote Ref. Number
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={poData.poDetails.quoteRefNumber}
                          onChange={(e) =>
                            handleChange(
                              "poDetails",
                              "quoteRefNumber",
                              e.target.value
                            )
                          }
                          size="small"
                          fullWidth
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Project Code
                      </TableCell>
                      <TableCell>{poData.poDetails.projectCode}</TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Freight & Insurance
                      </TableCell>
                      <TableCell>
                        <Select
                          value={poDetails.freightAndInsurance}
                          onChange={(e) =>
                            handlePoDetailChange(
                              "freightAndInsurance",
                              e.target.value
                            )
                          }
                          size="small"
                          fullWidth
                          sx={selectStyles.select}
                        >
                          <MenuItem
                            value="Inclusive"
                            sx={selectStyles.menuItem}
                          >
                            Inclusive
                          </MenuItem>
                          <MenuItem
                            value="Exclusive"
                            sx={selectStyles.menuItem}
                          >
                            Exclusive
                          </MenuItem>
                        </Select>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Payment Terms
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={poData.terms.payment}
                          onChange={(e) =>
                            setPOData((prev) => ({
                              ...prev,
                              terms: {
                                ...prev.terms,
                                payment: e.target.value,
                              },
                            }))
                          }
                          size="small"
                          fullWidth
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Guarantee/Warranty
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={poData.terms.warranty}
                          onChange={(e) =>
                            setPOData((prev) => ({
                              ...prev,
                              terms: {
                                ...prev.terms,
                                warranty: e.target.value,
                              },
                            }))
                          }
                          size="small"
                          fullWidth
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        TPI Inspection
                      </TableCell>
                      <TableCell>
                        <Select
                          value={poDetails.tpiInspection}
                          onChange={(e) =>
                            handlePoDetailChange(
                              "tpiInspection",
                              e.target.value
                            )
                          }
                          size="small"
                          fullWidth
                          sx={selectStyles.select}
                        >
                          <MenuItem
                            value="Inclusive"
                            sx={selectStyles.menuItem}
                          >
                            Inclusive
                          </MenuItem>
                          <MenuItem
                            value="Exclusive"
                            sx={selectStyles.menuItem}
                          >
                            Exclusive
                          </MenuItem>
                        </Select>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Installation
                      </TableCell>
                      <TableCell>
                        <Select
                          value={poDetails.installation}
                          onChange={(e) =>
                            handlePoDetailChange("installation", e.target.value)
                          }
                          size="small"
                          fullWidth
                          sx={selectStyles.select}
                        >
                          <MenuItem
                            value="Inclusive"
                            sx={selectStyles.menuItem}
                          >
                            Inclusive
                          </MenuItem>
                          <MenuItem
                            value="Exclusive"
                            sx={selectStyles.menuItem}
                          >
                            Exclusive
                          </MenuItem>
                        </Select>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Commissioning
                      </TableCell>
                      <TableCell>
                        <Select
                          value={poDetails.commissioning}
                          onChange={(e) =>
                            handlePoDetailChange(
                              "commissioning",
                              e.target.value
                            )
                          }
                          size="small"
                          fullWidth
                          sx={selectStyles.select}
                        >
                          <MenuItem
                            value="Inclusive"
                            sx={selectStyles.menuItem}
                          >
                            Inclusive
                          </MenuItem>
                          <MenuItem
                            value="Exclusive"
                            sx={selectStyles.menuItem}
                          >
                            Exclusive
                          </MenuItem>
                        </Select>
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Delivery Schedule
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={deliverySchedule}
                          onChange={(e) => setDeliverySchedule(e.target.value)}
                          size="small"
                          fullWidth
                        />
                      </TableCell>
                    </TableRow>
                    <TableRow>
                      <TableCell sx={{ fontWeight: "bold" }}>
                        Vendor Code
                      </TableCell>
                      <TableCell>{selectedVendor?.vendor_id || ""}</TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                <Typography
                  variant="subtitle1"
                  sx={{ fontWeight: "bold", mt: 2 }}
                >
                  Delivery Address:
                </Typography>
                <Box>
                  <Select
                    value={deliveryAddress}
                    onChange={(e) =>
                      setDeliveryAddress(e.target.value as string)
                    }
                    size="small"
                    fullWidth
                    sx={selectStyles.select}
                  >
                    <MenuItem
                      value="CIMCON Software India Pvt. Ltd., 802, i-Square Corporate Park, Science City Road, Sola, Ahmedabad - 380060, Gujarat, India, Kind Attn: Hitesh Patel, Ph. - 9558017841"
                      sx={selectStyles.menuItem}
                    >
                      i-Square
                    </MenuItem>
                    <MenuItem
                      value="CIMCON Software India Pvt. Ltd. 904, Sakar IV, Opp. Townhall, Ellisbridge, Ashram Road Ahmedabad - 380006, Gujarat, India Kind Attn: Mahendra Khuteja Ph: 84019 52547"
                      sx={selectStyles.menuItem}
                    >
                      Sakar
                    </MenuItem>
                    <MenuItem
                      value="CIMCON SOFTWARE INDIA PVT. LTD. PS PATEL INDUSTRIAL ESTATE 1 OAD GAM KAMOD PIRANA ROAD KAMOD RING ROAD PIRANA 382427 Kind Attn: Hitesh Patel Ph: 7567113222"
                      sx={selectStyles.menuItem}
                    >
                      Pirana
                    </MenuItem>
                    <MenuItem
                      value="CIMCON Software India Pvt Ltd D22-23, Santosh Sadan Race Course, Dehradun - 248001, Dehradun, Kind Attn: Mr. Rajendra Ph. 94111 53770"
                      sx={selectStyles.menuItem}
                    >
                      Dehradun
                    </MenuItem>
                    <MenuItem
                      value="CIMCON Software India Pvt. Ltd. 1106/1117, 11th floor, Times Square Arcade – 1, Opp. Rambaug, Near Baghbaan Party Plot Cross Road, Thaltej, Ahmedabad – 380059, India. Kind Attn: Ashish Solanki Ph: 8758006007"
                      sx={selectStyles.menuItem}
                    >
                      Times Square
                    </MenuItem>
                  </Select>
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    {deliveryAddress}
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            {/* Add Currency Selection */}
            <Box sx={{ mb: 2 }}>
              <Select
                value={selectedCurrency.code}
                onChange={(e) =>
                  setSelectedCurrency(
                    currencies.find((c) => c.code === e.target.value) ||
                      currencies[0]
                  )
                }
                size="small"
              >
                {currencies.map((currency) => (
                  <MenuItem key={currency.code} value={currency.code}>
                    {currency.code} ({currency.symbol})
                  </MenuItem>
                ))}
              </Select>
            </Box>

            {/* Items Table */}
            <TableContainer sx={{ mt: 3, overflow: "visible" }}>
              <Table
                size="small"
                sx={{
                  "& th, & td": {
                    border: "1px solid #000",
                    padding: "8px",
                    verticalAlign: "middle",
                  },
                  tableLayout: "fixed",
                }}
              >
                <TableHead>
                  <TableRow sx={{ backgroundColor: "#f5f5f5" }}>
                    <TableCell sx={{ width: "40px" }}>S/N</TableCell>
                    <TableCell sx={{ width: "120px" }}>CIMCON P/N</TableCell>
                    <TableCell sx={{ width: "200px" }}>Description</TableCell>
                    <TableCell sx={{ width: "100px" }}>HSN/SAC</TableCell>
                    <TableCell sx={{ width: "130px" }}>Qty.</TableCell>
                    <TableCell sx={{ width: "100px" }}>Unit Rate</TableCell>
                    <TableCell sx={{ width: "90px" }}>Taxable Value</TableCell>
                    <TableCell sx={{ width: "100px" }}>GST</TableCell>
                    <TableCell sx={{ width: "120px" }}>Total Amount</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lineItems.map((item, index) => (
                    <TableRow key={index}>
                      <TableCell align="center">{item.srNo}</TableCell>
                      <TableCell>{item.cpn}</TableCell>
                      <TableCell>
                        <TextField
                          value={item.description}
                          onChange={(e) =>
                            handleDescriptionChange(index, e.target.value)
                          }
                          size="small"
                          fullWidth
                          multiline
                          rows={2}
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          value={item.hsnSac}
                          onChange={(e) =>
                            handleHsnChange(index, e.target.value)
                          }
                          size="small"
                          fullWidth
                        />
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <OutlinedInput
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              handleQuantityChange(index, e.target.value)
                            }
                            size="small"
                            fullWidth
                            inputProps={{
                              // inputProps: {
                              min: 0,
                              style: { textAlign: "right" },
                              // },
                            }}
                          />
                          <Typography sx={{ ml: 1, whiteSpace: "nowrap" }}>
                            {item.uom}
                          </Typography>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <Typography sx={{ mr: 0.5 }}>
                            {selectedCurrency.symbol}
                          </Typography>
                          <TextField
                            type="number"
                            value={item.unitRate}
                            onChange={(e) =>
                              handleUnitRateChange(index, e.target.value)
                            }
                            size="small"
                            fullWidth
                            InputProps={{
                              inputProps: {
                                min: 0,
                                style: { textAlign: "right" },
                              },
                            }}
                          />
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {selectedCurrency.symbol} {item.taxableValue.toFixed(2)}
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: "flex", alignItems: "center" }}>
                          <OutlinedInput
                            type="number"
                            value={item.gstPercentage}
                            onChange={(e) =>
                              handleGstPercentageChange(index, e.target.value)
                            }
                            size="small"
                            fullWidth
                            inputProps={{
                              inputProps: {
                                min: 0,
                                style: { textAlign: "right" },
                              },
                            }}
                          />
                          <Typography sx={{ ml: 1 }}>%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="right">
                        {selectedCurrency.symbol} {item.totalAmount.toFixed(2)}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Total row */}
                  <TableRow sx={{ backgroundColor: "#f9f9f9" }}>
                    <TableCell
                      colSpan={4}
                      align="right"
                      sx={{ fontWeight: "bold" }}
                    >
                      Total
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      {calculateTotals().quantity} {lineItems[0]?.uom || "Nos"}
                    </TableCell>
                    <TableCell />
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      {selectedCurrency.symbol}{" "}
                      {calculateTotals().taxableValue.toFixed(2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      {selectedCurrency.symbol}{" "}
                      {calculateTotals().gst.toFixed(2)}
                    </TableCell>
                    <TableCell align="right" sx={{ fontWeight: "bold" }}>
                      {selectedCurrency.symbol}{" "}
                      {calculateTotals().totalAmount.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>

            {/* Total in Words */}
            <Box sx={{ mt: 2, border: "1px solid #000", p: 1 }}>
              <Typography>
                Total Value (in words):{" "}
                {numberToWords(
                  calculateTotals().totalAmount,
                  selectedCurrency.code
                )}
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" color="primary">
            Generate PO
          </Button>
        </DialogActions>

        <TermsDialog
          open={isTermsDialogOpen}
          onClose={() => setIsTermsDialogOpen(false)}
          onSave={handleTermsSave}
        />
      </Dialog>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialogOpen}
        onClose={handleCancelClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
        sx={{
          "& .MuiDialog-paper": {
            borderRadius: "12px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.15)",
          },
        }}
      >
        <DialogTitle
          id="alert-dialog-title"
          sx={{
            bgcolor: "rgba(33, 150, 243, 0.05)",
            borderBottom: "1px solid rgba(0,0,0,0.1)",
            py: 2,
            fontWeight: 600,
          }}
        >
          {"Confirm Close"}
        </DialogTitle>
        <DialogContent sx={{ mt: 2, px: 3, py: 2 }}>
          <DialogContentText id="alert-dialog-description">
            Are you sure you want to close this window? Any unsaved changes will
            be lost.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, pt: 1 }}>
          <Button
            onClick={handleCancelClose}
            sx={{
              color: "#7c4dff",
              "&:hover": {
                backgroundColor: "rgba(124, 77, 255, 0.1)",
              },
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirmClose}
            variant="contained"
            color="error"
            sx={{
              borderRadius: "8px",
              "&:hover": {
                boxShadow: "0 4px 12px rgba(211, 47, 47, 0.2)",
              },
            }}
            autoFocus
          >
            Close Without Saving
          </Button>
        </DialogActions>
      </Dialog>

      {/* Add the Vendor Update Dialog */}
      <VendorUpdateDialog />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Add this new Terms Confirmation Dialog */}
      <Dialog
        open={termsConfirmationDialog.open}
        onClose={() =>
          setTermsConfirmationDialog((prev) => ({ ...prev, open: false }))
        }
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Confirm Action</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {termsConfirmationDialog.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => handleTermsConfirmation(false)}
            color="primary"
          >
            No
          </Button>
          <Button
            onClick={() => handleTermsConfirmation(true)}
            color="primary"
            variant="contained"
          >
            Yes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

const numberToWords = (num: number, currencyCode: string): string => {
  // Configuration for different currencies
  const currencyConfigs = {
    INR: {
      localeCode: "en-IN",
      options: {
        currency: true,
        currencyOptions: { name: "Rupee", plural: "Rupees" },
      },
    },
    USD: {
      localeCode: "en-US",
      options: {
        currency: true,
        currencyOptions: { name: "Dollar", plural: "Dollars" },
      },
    },
    EUR: {
      localeCode: "en",
      options: {
        currency: true,
        currencyOptions: { name: "Euro", plural: "Euros" },
      },
    },
    GBP: {
      localeCode: "en-GB",
      options: {
        currency: true,
        currencyOptions: { name: "Pound", plural: "Pounds" },
      },
    },
    JPY: {
      localeCode: "en",
      options: {
        currency: true,
        currencyOptions: { name: "Yen", plural: "Yen" },
      },
    },
    CNY: {
      localeCode: "en",
      options: {
        currency: true,
        currencyOptions: { name: "Yuan", plural: "Yuan" },
      },
    },
    AUD: {
      localeCode: "en-AU",
      options: {
        currency: true,
        currencyOptions: {
          name: "Australian Dollar",
          plural: "Australian Dollars",
        },
      },
    },
    CAD: {
      localeCode: "en-CA",
      options: {
        currency: true,
        currencyOptions: {
          name: "Canadian Dollar",
          plural: "Canadian Dollars",
        },
      },
    },
    SGD: {
      localeCode: "en",
      options: {
        currency: true,
        currencyOptions: {
          name: "Singapore Dollar",
          plural: "Singapore Dollars",
        },
      },
    },
    AED: {
      localeCode: "en",
      options: {
        currency: true,
        currencyOptions: { name: "Dirham", plural: "Dirhams" },
      },
    },
  };

  // Get configuration for the current currency or use USD as fallback
  const config = currencyConfigs[currencyCode] || currencyConfigs.USD;

  // Initialize the converter with the appropriate locale
  const toWords = new ToWords(config.localeCode);

  // Convert the number to words with proper currency formatting
  const result = toWords.convert(num, config.options);

  // Return with proper formatting
  return result.charAt(0).toUpperCase() + result.slice(1);
};

export default POPreviewDialog;
