import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";
import ItemGenerator from "./ItemGenerator";
import FactoryItemForm from "./FactoryItemForm";
import configuration, { apiClient } from "../../configuration";
import axios from "axios";

interface Item {
  id: string;
  code: string;
  name: string;
}

interface FactoryFormData {
  productName: string;
  productCode: string;
  make: string;
  makeCode: string;
  mfgPartNo: string;
  mfgPartCode: string;
  itemDescription: string;
  itemCode: string;
  materialRating: string;
  materialRatingCode: string;
  package: string;
  uom: string;
  moq: number;
  leadTime: number;
  hsnCode: string;
  bin: string;
  cimcon_part_no: string;
}

const TeamItemGenerator: React.FC = () => {
  const [selectedTeam, setSelectedTeam] = useState<"purchase" | "factory" | "">(
    ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Factory form state
  const [factoryFormData, setFactoryFormData] = useState<FactoryFormData>({
    productName: "",
    productCode: "",
    make: "",
    makeCode: "",
    mfgPartNo: "",
    mfgPartCode: "",
    itemDescription: "",
    itemCode: "",
    materialRating: "",
    materialRatingCode: "",
    package: "",
    uom: "",
    moq: 0,
    leadTime: 0,
    hsnCode: "",
    bin: "",
    cimcon_part_no: "",
  });

  // Factory data state
  const [factoryProducts, setFactoryProducts] = useState<Item[]>([]);
  const [factoryMakes, setFactoryMakes] = useState<Item[]>([]);
  const [factoryRatings, setFactoryRatings] = useState<Item[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<
    "productName" | "make" | "rating" | "mpn" | "package" | "itemDescription" | ""
  >("");
  const [dialogValue, setDialogValue] = useState("");

  // Fetch factory data when factory team is selected
  useEffect(() => {
    if (selectedTeam === "factory") {
      fetchFactoryData();
    }
  }, [selectedTeam]);

  const fetchFactoryData = async () => {
    try {
      setLoading(true);

      // Fetch factory products
      const productsResponse = await apiClient.get("factory/products/");
      if (productsResponse.data?.products) {
        setFactoryProducts(productsResponse.data.products);
      }

      // Fetch factory related items
      const relatedResponse = await apiClient.get("factory/related-options/");
      if (relatedResponse.data) {
        setFactoryMakes(relatedResponse.data.makes || []);
        setFactoryRatings(relatedResponse.data.ratings || []);
      }
    } catch (error) {
      console.error("Error fetching factory data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Generate code for factory form
  const generateFactoryCode = async (
    name: string,
    type: string,
    productId?: string
  ): Promise<string> => {
    if (!name) return "";

    try {
      // For factory, format codes to specific lengths
      let code = "";
      
      if (type === "productName") {
        // Product: 3 characters
        code = name.substring(0, 3).toUpperCase().padEnd(3, "X").substring(0, 3);
      } else if (type === "make") {
        // Make: 2 characters
        const words = name.trim().split(/\s+/);
        if (words.length > 1) {
          code = words.slice(0, 2).map(w => w[0] || "").join("").toUpperCase().padEnd(2, "X").substring(0, 2);
        } else {
          code = name.substring(0, 2).toUpperCase().padEnd(2, "X").substring(0, 2);
        }
      } else if (type === "package") {
        // Package: 2 characters (NA if empty)
        code = name ? name.substring(0, 2).toUpperCase().padEnd(2, "N").substring(0, 2) : "NA";
      } else if (type === "materialRating" || type === "rating") {
        // Rating: 5 characters
        code = name.substring(0, 5).toUpperCase().padEnd(5, "0").substring(0, 5);
      } else {
        // For other types, use backend
        const response = await axios.post(
          `${configuration.api_url}/generate-code/`,
          {
            type: type,
            name: name,
            main_category_id: productId,
            team_type: "factory",
          }
        );
        code = response.data?.code || "";
      }
      
      return code;
    } catch (error) {
      console.error(`Error generating ${type} code:`, error);
      return "";
    }
  };

  // Handle text change for factory form
  const handleFactoryTextChange = async (
    field: string,
    value: string,
    codeField?: string,
    codeType?: string
  ) => {
    setFactoryFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Auto-detect code generation for certain fields
    let actualCodeType = codeType;
    let actualCodeField = codeField;
    
    if (field === "package" && !codeType) {
      actualCodeType = "package";
      actualCodeField = "packageCode";
    } else if (field === "materialRating" && !codeType) {
      actualCodeType = "materialRating";
      actualCodeField = "materialRatingCode";
    } else if (field === "itemDescription" && !codeType) {
      actualCodeType = "itemDescription";
      actualCodeField = "itemCode";
    } else if (field === "mfgPartNo" && !codeType) {
      // MPN code will be auto-generated based on Make
      actualCodeField = "mfgPartCode";
    }

    // Generate code if needed
    if (actualCodeField && actualCodeType && value) {
      const productId = factoryProducts.find(
        (p) => p.name === factoryFormData.productName
      )?.id;

      if (actualCodeType !== "productName" && actualCodeType !== "package" && !productId) {
        // For most fields, product is required, but package can be generated without product
        if (actualCodeType !== "package") {
          // Don't generate code yet, but still update CIMCON part number
          await updateCimconPartNo(field, value, actualCodeField);
          return;
        }
      }

      const code = await generateFactoryCode(value, actualCodeType, productId);
      if (code) {
        setFactoryFormData((prev) => ({
          ...prev,
          [actualCodeField]: code,
        }));
      }
    }

    // Update CIMCON part number
    await updateCimconPartNo(field, value, actualCodeField);
  };

  // Handle dropdown change for factory form
  const handleFactoryDropdownChange = async (
    field: string,
    codeField: string,
    item: Item | null
  ) => {
    if (!item) {
      setFactoryFormData((prev) => ({
        ...prev,
        [field]: "",
        [codeField]: "",
      }));
      await updateCimconPartNo(field, "", codeField);
      return;
    }

    setFactoryFormData((prev) => ({
      ...prev,
      [field]: item.name,
      [codeField]: item.code,
    }));

    // Update CIMCON part number
    await updateCimconPartNo(field, item.name, codeField);
  };

  // Handle code change for factory form
  const handleFactoryCodeChange = async (field: string, value: string) => {
    setFactoryFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
    await updateCimconPartNo(field, value, field);
  };

  // Update CIMCON part number
  const updateCimconPartNo = async (
    field: string,
    value: string,
    codeField?: string
  ) => {
    // Format: Product(3) + Make(4) + MPN(3) + Rating(5) + Package(2) = 17 characters
    // Structure: ProductName - Make - MPN - RATING - PACKAGE (hyphens only for understanding, not in actual code)
    // Example: RES0402001000143KSE (no hyphens)
    
    // Ensure codes are formatted correctly
    const productCode = (factoryFormData.productCode || "").substring(0, 3).padEnd(3, "X").substring(0, 3).toUpperCase();
    const makeCode = (factoryFormData.makeCode || "").substring(0, 2).padEnd(2, "X").substring(0, 2).toUpperCase();
    const ratingCode = (factoryFormData.materialRatingCode || factoryFormData.materialRating || "").substring(0, 5).padEnd(5, "0").substring(0, 5).toUpperCase();
    const packageCode = (factoryFormData.package || "").substring(0, 2).padEnd(2, "N").substring(0, 2).toUpperCase() || "NA";
    
    // Get MPN code - if Make is selected, get next MPN code
    let mpnCode = factoryFormData.mfgPartCode || "001";
    
    if (field === "make" || (field === "mfgPartNo" && factoryFormData.makeCode)) {
      // Get the Make ID
      const makeId = factoryMakes.find(m => m.name === factoryFormData.make || m.code === factoryFormData.makeCode)?.id;
      
      if (makeId) {
        try {
          const mpnResponse = await apiClient.get(`next-mpn-code/?make_id=${makeId}`);
          if (mpnResponse.data?.mpn_code) {
            mpnCode = mpnResponse.data.mpn_code;
            // Update the MPN code in form data
            setFactoryFormData((prev) => ({
              ...prev,
              mfgPartCode: mpnCode,
            }));
          }
        } catch (error) {
          console.error("Error getting next MPN code:", error);
          mpnCode = "001"; // Default fallback
        }
      }
    }
    
    // Ensure MPN is 3 digits
    mpnCode = mpnCode.padStart(3, "0").substring(0, 3);
    
    // Order: Product - Make - MPN - Rating - Package (no hyphens)
    const cimconPartNo = `${productCode}${makeCode}${mpnCode}${ratingCode}${packageCode}`;

    setFactoryFormData((prev) => ({
      ...prev,
      cimcon_part_no: cimconPartNo,
    }));
  };

  // Handle dialog for adding new factory parameters
  const handleFactoryOpenDialog = (type: string) => {
    setDialogType(type as any);
    setDialogValue("");
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setDialogType("");
    setDialogValue("");
  };

  const handleDialogSubmit = async () => {
    try {
      if (!dialogValue.trim()) {
        handleDialogClose();
        return;
      }

      const selectedProductId = factoryProducts.find(
        (p) => p.name === factoryFormData.productName
      )?.id;

      if (dialogType === "productName") {
        const resp = await apiClient.post("factory/products/create/", {
          product_name: dialogValue.trim(),
        });
        const created = resp.data?.product as Item | undefined;
        if (created) {
          setFactoryProducts((prev) => [created, ...prev]);
          setFactoryFormData((prev) => ({
            ...prev,
            productName: created.name,
            productCode: created.code,
          }));
        }
        await fetchFactoryData();
      } else if (dialogType === "make") {
        if (!selectedProductId) {
          alert("Please select a product before adding a make.");
          return;
        }
        const resp = await apiClient.post("factory/makes/create/", {
          make_name: dialogValue.trim(),
          product_id: selectedProductId,
        });
        const created = resp.data?.make as Item | undefined;
        if (created) {
          setFactoryMakes((prev) => [created, ...prev]);
          setFactoryFormData((prev) => ({
            ...prev,
            make: created.name,
            makeCode: created.code,
          }));
        }
      } else if (dialogType === "rating") {
        if (!selectedProductId) {
          alert("Please select a product before adding a rating.");
          return;
        }
        const resp = await apiClient.post("factory/ratings/create/", {
          rating_name: dialogValue.trim(),
          product_id: selectedProductId,
        });
        const created = resp.data?.rating as Item | undefined;
        if (created) {
          setFactoryRatings((prev) => [created, ...prev]);
          setFactoryFormData((prev) => ({
            ...prev,
            materialRating: created.name,
            materialRatingCode: created.code,
          }));
        }
      } else if (dialogType === "mpn") {
        setFactoryFormData((prev) => ({ ...prev, mfgPartNo: dialogValue.trim() }));
      } else if (dialogType === "package") {
        setFactoryFormData((prev) => ({ ...prev, package: dialogValue.trim() }));
      } else if (dialogType === "itemDescription") {
        setFactoryFormData((prev) => ({ ...prev, itemDescription: dialogValue.trim() }));
      }
      
      if (dialogType === "productName" || dialogType === "make" || dialogType === "rating") {
        setSuccess(`${dialogType === "productName" ? "Product" : dialogType === "make" ? "Make" : "Rating"} created successfully!`);
      }
    } catch (e: any) {
      console.error("Error creating factory entity:", e);
      setError(e.response?.data?.error || "Failed to create. Please try again.");
    } finally {
      handleDialogClose();
    }
  };

  // Handle factory form submission
  const handleFactorySubmit = async () => {
    try {
      setLoading(true);
      const displayName =
        localStorage.getItem("displayName") || "Anonymous User";

      const factoryData = {
        productName: factoryFormData.productName,
        productCode: factoryFormData.productCode,
        make: factoryFormData.make,
        makeCode: factoryFormData.makeCode,
        mfgPartNo: factoryFormData.mfgPartNo,
        mfgPartCode: factoryFormData.mfgPartCode,
        itemDescription: factoryFormData.itemDescription,
        itemCode: factoryFormData.itemCode,
        materialRating: factoryFormData.materialRating,
        materialRatingCode: factoryFormData.materialRatingCode,
        package: factoryFormData.package,
        uom: factoryFormData.uom,
        moq: factoryFormData.moq || 0,
        leadTime: factoryFormData.leadTime || 0,
        hsnCode: factoryFormData.hsnCode,
        bin: factoryFormData.bin,
        requestor: displayName,
      };

      const response = await apiClient.post(
        "factory/submit-factory-item/",
        factoryData
      );

      if (response.data?.success) {
        setSuccess(response.data.message || "Factory item created successfully!");
        // Reset form
        setFactoryFormData({
          productName: "",
          productCode: "",
          make: "",
          makeCode: "",
          mfgPartNo: "",
          mfgPartCode: "",
          itemDescription: "",
          itemCode: "",
          materialRating: "",
          materialRatingCode: "",
          package: "",
          uom: "",
          moq: 0,
          leadTime: 0,
          hsnCode: "",
          bin: "",
          cimcon_part_no: "",
        });
      }
    } catch (error: any) {
      console.error("Error submitting factory item:", error);
      let errorMessage = "Failed to submit factory item";
      
      if (error.response?.data) {
        // Backend returns error in 'error' field, with optional 'details'
        errorMessage = error.response.data.error || error.response.data.message || errorMessage;
        if (error.response.data.details) {
          errorMessage += `: ${error.response.data.details}`;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: "auto" }}>
      {/* Error/Success notifications */}
      <Box>
        {error && (
          <Snackbar
            open={!!error}
            autoHideDuration={4000}
            onClose={() => setError(null)}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert
              severity="error"
              sx={{
                width: "100%",
                minWidth: "400px",
                fontSize: "1rem",
                "& .MuiAlert-message": {
                  fontSize: "1rem",
                },
                "& .MuiAlert-icon": {
                  fontSize: "2rem",
                },
                padding: "10px 20px",
                backgroundColor: "#fdeded",
                color: "#5f2120",
                border: "1px solid #ef5350",
              }}
              onClose={() => setError(null)}
            >
              {error}
            </Alert>
          </Snackbar>
        )}
        {success && (
          <Snackbar
            open={!!success}
            autoHideDuration={4000}
            onClose={() => setSuccess(null)}
            anchorOrigin={{ vertical: "top", horizontal: "center" }}
          >
            <Alert
              severity="success"
              sx={{
                width: "100%",
                minWidth: "400px",
                fontSize: "1rem",
                "& .MuiAlert-message": {
                  fontSize: "1rem",
                },
                "& .MuiAlert-icon": {
                  fontSize: "2rem",
                },
                padding: "10px 20px",
                backgroundColor: "#edf7ed",
                color: "#1e4620",
                border: "1px solid #4caf50",
              }}
              onClose={() => setSuccess(null)}
            >
              {success}
            </Alert>
          </Snackbar>
        )}
      </Box>
      <Paper elevation={3} sx={{ p: 3 }}>
        {/* Team Selection Dropdown */}
        <Box sx={{ mb: 3 }}>
          <FormControl fullWidth>
            <InputLabel id="team-select-label">Select Team</InputLabel>
            <Select
              labelId="team-select-label"
              id="team-select"
              value={selectedTeam}
              label="Select Team"
              onChange={(e) => {
                setSelectedTeam(e.target.value as "purchase" | "factory" | "");
              }}
            >
              <MenuItem value="">
                <em>None</em>
              </MenuItem>
              <MenuItem value={"purchase"}>Purchase Team</MenuItem>
              <MenuItem value={"factory"}>Factory Team</MenuItem>
            </Select>
          </FormControl>
        </Box>

        {/* Conditional Rendering */}
        {loading && (
          <Box display="flex" justifyContent="center" p={3}>
            <CircularProgress />
          </Box>
        )}

        {selectedTeam === "purchase" && !loading && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Purchase Team - Item Generator
            </Typography>
            <ItemGenerator />
          </Box>
        )}

        {selectedTeam === "factory" && !loading && (
          <Box>
            <Typography variant="h5" gutterBottom>
              Factory Team - Item Generator
            </Typography>
            <Box sx={{ mt: 2 }}>
              <FactoryItemForm
                editedItem={factoryFormData}
                handleTextChange={handleFactoryTextChange}
                handleDropdownChange={handleFactoryDropdownChange}
                handleCodeChange={handleFactoryCodeChange}
                products={factoryProducts}
                makes={factoryMakes}
                ratings={factoryRatings}
                handleOpenDialog={handleFactoryOpenDialog}
              />
              <Box sx={{ mt: 3 }}>
                <button
                  onClick={handleFactorySubmit}
                  disabled={loading}
                  style={{
                    padding: "10px 20px",
                    fontSize: "16px",
                    backgroundColor: "#1976d2",
                    color: "white",
                    border: "none",
                    borderRadius: "4px",
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Submitting..." : "Submit Factory Item"}
                </button>
              </Box>
            </Box>
          </Box>
        )}

        {!selectedTeam && (
          <Box sx={{ textAlign: "center", py: 5 }}>
            <Typography variant="body1" color="textSecondary">
              Please select a team to continue
            </Typography>
          </Box>
        )}
      </Paper>
      {/* Add New Dialog */}
      <Dialog open={dialogOpen} onClose={handleDialogClose} fullWidth maxWidth="sm">
        <DialogTitle>
          {dialogType === "productName" && "Add New Product"}
          {dialogType === "make" && "Add New Make"}
          {dialogType === "rating" && "Add New Material Rating"}
          {dialogType === "mpn" && "Add New MPN"}
          {dialogType === "package" && "Add New Package"}
          {dialogType === "itemDescription" && "Add New Item Description"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={dialogValue}
            onChange={(e) => setDialogValue(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleDialogSubmit} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TeamItemGenerator;
