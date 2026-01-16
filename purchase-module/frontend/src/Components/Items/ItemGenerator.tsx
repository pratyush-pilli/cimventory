import React, { useState, useEffect } from "react";
import {
  Box,
  TextField,
  Button,
  Typography,
  Grid,
  Paper,
  IconButton,
  Tooltip,
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import configuration from "../../configuration";
import "./ItemGenerator.scss";
import axios from "axios";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloseIcon from "@mui/icons-material/Close";

// Simplified interfaces
interface Item {
  id: string;
  code: string;
  name: string;
}

interface ItemFormData {
  productName: string;
  productCode: string;
  mfgPartNo: string;
  mfgPartCode: string;
  itemDescription: string;
  itemCode: string;
  make: string;
  makeCode: string;
  type: string;
  typeCode: string;
  materialRating: string;
  materialRatingCode: string;
  // Additional fields
  package: string;
  uom: string;
  moq: number;
  leadTime: number;
  hsnCode: string;
  bin: string;
  document?: File | null;
  documentName: string;
}

// Define maximum lengths based on your models
const maxLengths = {
  productName: 255,
  mfgPartNo: 255,
  itemDescription: 255,
  make: 100,
  type: 100,
  materialRating: 100,
  package: 255,
  uom: 50,
  hsnCode: 50,
  bin: 50,
};

const ItemGenerator: React.FC = () => {
  // Basic state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [userInfo, setUserInfo] = useState({
    firstName: "",
    displayName: "",
    lastName: "",
    fullName: "",
    username: "Anonymous",
  });

  // Items state
  const [products, setProducts] = useState<Item[]>([]);
  const [makes, setMakes] = useState<Item[]>([]);
  const [types, setTypes] = useState<Item[]>([]);
  const [ratings, setRatings] = useState<Item[]>([]);

  // Form state
  const [formData, setFormData] = useState<ItemFormData>({
    productName: "",
    productCode: "",
    mfgPartNo: "",
    mfgPartCode: "",
    itemDescription: "",
    itemCode: "",
    make: "",
    makeCode: "",
    type: "",
    typeCode: "",
    materialRating: "",
    materialRatingCode: "",
    package: "",
    uom: "",
    moq: 0,
    leadTime: 0,
    hsnCode: "",
    bin: "",
    documentName: "",
    document: null,
  });

  // Dialog state
  const [dialog, setDialog] = useState({
    open: false,
    type: "",
    name: "",
  });

  // UI state
  const [productSelected, setProductSelected] = useState(false);
  const [formModified, setFormModified] = useState(false);

  // Add state for username input
  const [showUsernameInput, setShowUsernameInput] = useState(false);

  // Fetch initial products and username on component mount
  useEffect(() => {
    fetchProducts();
    fetchUsername();
  }, []);

  // Fetch current username
  const fetchUsername = async () => {
    try {
      // Use the central userInfo object
      const userInfoObj = JSON.parse(localStorage.getItem("userInfo") || "{}");

      // Extract name from userInfo
      const displayName = userInfoObj.name || "";
      const firstName = userInfoObj.first_name || "";
      const lastName = userInfoObj.last_name || "";
      const username = userInfoObj.username || "Anonymous";
      const email = userInfoObj.email || "";

      setUserInfo({
        firstName,
        lastName,
        displayName,
        fullName: displayName,
        username,
      });

      console.log("Using user info:", {
        displayName,
        firstName,
        lastName,
        username,
        email,
      });
    } catch (err) {
      console.error("Error setting user info:", err);
      setUserInfo({
        firstName: "Anonymous",
        lastName: "User",
        username: "Anonymous",
        displayName: "Anonymous",
        fullName: "Anonymous",
      });
    }
  };

  // Show notifications
  const showNotification = (message: string, isError = false) => {
    if (isError) {
      setError(message);
      setTimeout(() => setError(null), 2000); // Clear error after 2 seconds
    } else {
      setSuccess(message);
      setTimeout(() => setSuccess(null), 2000); // Clear success after 2 seconds
    }
  };

  // Fetch products
  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${configuration.api_url}/options/`);
      if (response.data && response.data.categories) {
        setProducts(response.data.categories);
      }
    } catch (err) {
      showNotification("Failed to load products", true);
      console.error("Error fetching products:", err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch related items for a product
  const fetchRelatedItems = async (productId: string) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}/related-options/?main_category_id=${productId}`
      );

      if (response.data) {
        // Deduplicate ratings by name
        const uniqueRatings =
          response.data.ratings?.reduce((acc: Item[], current: Item) => {
            if (!acc.some((item) => item.name === current.name)) {
              acc.push(current);
            }
            return acc;
          }, []) || [];

        setMakes(response.data.makes || []);
        setTypes(response.data.types || []);
        setRatings(uniqueRatings); // Set deduplicated ratings
      }
    } catch (err) {
      showNotification("Failed to load related items", true);
      console.error("Error fetching related items:", err);
    } finally {
      setLoading(false);
    }
  };

  // Generate code based on name and type
  const generateCode = async (
    name: string,
    type: string,
    productId?: string
  ) => {
    if (!name) return "";

    try {
      // Map frontend types to backend expected types
      let mappedType = type;
      if (type === "mfg_part") mappedType = "product_model";
      else if (type === "description") mappedType = "remarks";

      const data = {
        type: mappedType,
        name,
        main_category_id:
          productId ||
          (mappedType !== "productName" ? selectedProductId() : undefined),
      };

      console.log("Generating code with data:", data);

      const response = await axios.post(
        `${configuration.api_url}/generate-code/`,
        data
      );

      if (response.data && response.data.code) {
        return response.data.code;
      }
      return "";
    } catch (err) {
      console.error(`Error generating ${type} code:`, err);
      return "";
    }
  };

  // Get selected product ID
  const selectedProductId = (): string | undefined => {
    const product = products.find((p) => p.name === formData.productName);
    return product?.id;
  };

  // Handle product selection
  const handleProductSelect = async (product: Item | null) => {
    if (!product) {
      resetForm();
      return;
    }

    try {
      setLoading(true);

      // Generate code based on name
      const productCode = await generateCode(product.name, "productName");

      // Update form with product info
      setFormData((prev) => ({
        ...prev,
        productName: product.name,
        productCode: productCode || product.code, // Use generated code or existing code
        // Reset other fields
        make: "",
        makeCode: "",
        type: "",
        typeCode: "",
        materialRating: "",
        materialRatingCode: "",
        mfgPartNo: "",
        mfgPartCode: "",
        itemDescription: "",
        itemCode: "",
      }));

      setProductSelected(true);
      setFormModified(false);

      // Fetch related items
      await fetchRelatedItems(product.id);
    } catch (err) {
      showNotification("Error selecting product", true);
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      productName: "",
      productCode: "",
      mfgPartNo: "",
      mfgPartCode: "",
      itemDescription: "",
      itemCode: "",
      make: "",
      makeCode: "",
      type: "",
      typeCode: "",
      materialRating: "",
      materialRatingCode: "",
      package: "",
      uom: "",
      moq: 0,
      leadTime: 0,
      hsnCode: "",
      bin: "",
      documentName: "",
      document: null,
    });
    setProductSelected(false);
    setFormModified(false);
  };

  // Handle make selection
  const handleMakeSelect = (make: Item | null) => {
    if (!make) {
      setFormData((prev) => ({
        ...prev,
        make: "",
        makeCode: "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      make: make.name,
      makeCode: make.code,
    }));

    setFormModified(true);
  };

  // Handle type selection
  const handleTypeSelect = (type: Item | null) => {
    if (!type) {
      setFormData((prev) => ({
        ...prev,
        type: "",
        typeCode: "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      type: type.name,
      typeCode: type.code,
    }));

    setFormModified(true);
  };

  // Handle rating selection
  const handleRatingSelect = (rating: Item | null) => {
    if (!rating) {
      setFormData((prev) => ({
        ...prev,
        materialRating: "",
        materialRatingCode: "",
      }));
      return;
    }

    setFormData((prev) => ({
      ...prev,
      materialRating: rating.name,
      materialRatingCode: rating.code,
    }));

    setFormModified(true);
  };

  // Update the handleTextChange function to properly reflect the database model
  const handleTextChange = async (
    field: string,
    value: string,
    codeField?: string,
    codeType?: string
  ) => {
    // Update the field value immediately
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // If this is a field that needs code generation
    if (codeField && codeType && value) {
      const productId = selectedProductId();
      if (!productId && codeType !== "productName") {
        showNotification("Please select a product first", true);
        return;
      }

      try {
        // Call the correct endpoint with the database model in mind
        const response = await axios.post(
          `${configuration.api_url}/generate-code/`,
          {
            type: codeType,
            name: value,
            main_category_id: productId,
          }
        );

        if (response.data && response.data.code) {
          setFormData((prev) => ({
            ...prev,
            [codeField]: response.data.code,
          }));
        }
      } catch (error) {
        console.error(`Error generating ${codeType} code:`, error);
      }
    }

    setFormModified(true);
  };

  // Handle adding new parameter
  const handleOpenDialog = (type: string) => {
    let dialogType = type;

    // Map frontend types to backend expected types
    if (type === "mfg_part") {
      dialogType = "product_model";
    } else if (type === "description") {
      dialogType = "remarks";
    }

    if (dialogType !== "productName" && !selectedProductId()) {
      showNotification("Please select a product first", true);
      return;
    }

    setDialog({
      open: true,
      type: dialogType,
      name: "",
    });
  };

  // Handle adding new parameter
  const handleAddNewParameter = async () => {
    const { type, name } = dialog;
    if (!name.trim()) {
      showNotification("Name is required", true);
      return;
    }

    try {
      setLoading(true);
      const productId = selectedProductId();

      if (type !== "productName" && !productId) {
        showNotification("Please select a product first", true);
        return;
      }

      // Generate code - For debugging
      console.log(
        `Generating code for type: ${type}, name: ${name}, productId: ${productId}`
      );

      const generatedCode = await generateCode(name, type, productId);
      console.log(`Generated code: ${generatedCode}`);

      if (!generatedCode) {
        showNotification(`Failed to generate code for ${type}`, true);
        return;
      }

      // Create the parameter
      const requestData = {
        type: type, // Use the exact type from dialog
        name: name,
        code: generatedCode,
        main_category_id: type !== "productName" ? productId : undefined,
      };

      console.log("Sending request data:", requestData);

      const response = await axios.post(
        `${configuration.api_url}/create-parameter/`,
        requestData
      );

      console.log("Parameter creation response:", response.data);

      if (response.data) {
        // Process the response - assume we get id, name (or description) and code
        const newItem = {
          id: response.data.id
            ? response.data.id.toString()
            : Date.now().toString(),
          name: type === "remarks" ? name : response.data.name || name,
          code: response.data.code || generatedCode,
        };

        console.log("Created new item:", newItem);

        // Add to the appropriate collection
        if (type === "productName") {
          setProducts((prev) => [...prev, newItem]);
          // Auto-select if no product selected
          if (!formData.productName) {
            handleProductSelect(newItem);
          }
        } else if (type === "make") {
          setMakes((prev) => [...prev, newItem]);
          if (!formData.make) {
            handleMakeSelect(newItem);
          }
        } else if (type === "type") {
          setTypes((prev) => [...prev, newItem]);
          if (!formData.type) {
            handleTypeSelect(newItem);
          }
        } else if (type === "rating") {
          setRatings((prev) => [...prev, newItem]);
          if (!formData.materialRating) {
            handleRatingSelect(newItem);
          }
        }

        showNotification(`New ${type} added successfully`);
      }
    } catch (err: any) {
      console.error(`Error creating ${type}:`, err);
      const errorMessage =
        err.response?.data?.error || `Failed to create ${type}`;
      showNotification(errorMessage, true);
    } finally {
      setLoading(false);
      setDialog({ open: false, type: "", name: "" });
    }
  };

  // Add file handling functions
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      setFormData((prev) => ({
        ...prev,
        document: file,
        documentName: file.name,
      }));
      setFormModified(true);
    }
  };

  // Add this function to handle file removal
  const handleRemoveFile = () => {
    setFormData((prev) => ({
      ...prev,
      document: null,
      documentName: "",
    }));
  };

  // Update handleSubmit to include file upload
  const handleSubmit = async () => {
    // Validate required fields
    if (
      !formData.productName ||
      !formData.mfgPartNo ||
      !formData.itemDescription
    ) {
      showNotification("Please fill in all required fields.", true);
      return;
    }

    try {
      setLoading(true);

      const ratingCode = formData.materialRatingCode || "000";
      const cimconPartNo = `${formData.productCode}${formData.typeCode}${formData.makeCode}${formData.mfgPartCode}${formData.itemCode}${ratingCode}`;

      // Get displayName directly from localStorage
      const displayName =
        localStorage.getItem("displayName") || "Anonymous User";

      // Create FormData object for file upload
      const submitData = new FormData();

      // Add all form fields
      submitData.append("status", "draft");
      submitData.append("requestor", displayName);
      submitData.append("productName", formData.productName);
      submitData.append("productCode", formData.productCode);
      submitData.append("mfgPartNo", formData.mfgPartNo);
      submitData.append("mfgPartCode", formData.mfgPartCode);
      submitData.append("itemDescription", formData.itemDescription);
      submitData.append("itemCode", formData.itemCode);
      submitData.append("make", formData.make);
      submitData.append("makeCode", formData.makeCode);
      submitData.append("type", formData.type);
      submitData.append("typeCode", formData.typeCode);
      submitData.append("materialRating", formData.materialRating);
      submitData.append("materialRatingCode", formData.materialRatingCode);
      submitData.append("package", formData.package);
      submitData.append("uom", formData.uom);
      submitData.append(
        "moq",
        formData.moq !== 0 ? String(formData.moq) : null
      );
      submitData.append(
        "leadTime",
        formData.leadTime !== 0 ? String(formData.leadTime) : null
      );
      submitData.append("bin", formData.bin);
      submitData.append("hsnCode", formData.hsnCode);
      submitData.append("cimcon_part_no", cimconPartNo);

      // Add file if present
      if (formData.document) {
        submitData.append("document", formData.document);
        submitData.append("document_name", formData.documentName);
      }

      const response = await axios.post(
        `${configuration.api_url}/request-item/`,
        submitData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      showNotification(
        "Item request submitted successfully! Awaiting approval."
      );
      resetForm();
    } catch (error) {
      console.error("Error submitting item request:", error);
      const errorMessage =
        error.response?.data?.error ||
        "An unexpected error occurred. Please try again.";
      showNotification(errorMessage, true);
    } finally {
      setLoading(false);
    }
  };

  // Handler for manual username entry
  const handleUsernameSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (userInfo.username && userInfo.username.trim() !== "") {
      localStorage.setItem("username", userInfo.username);
      setShowUsernameInput(false);
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1000, margin: "auto" }}>
      {/* Error/Success notifications */}
      <Box>
        {error && (
          <Snackbar
            open={!!error}
            autoHideDuration={2000}
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
            >
              {error}
            </Alert>
          </Snackbar>
        )}
        {success && (
          <Snackbar
            open={!!success}
            autoHideDuration={2000}
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
            >
              {success}
            </Alert>
          </Snackbar>
        )}
      </Box>

      {/* Username Input Dialog */}
      <Dialog open={showUsernameInput} onClose={() => {}}>
        <DialogTitle>Enter Your Name</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 2 }}>
            Please enter your name to continue. This will be used to track who
            created items.
          </Typography>
          <form onSubmit={handleUsernameSubmit}>
            <TextField
              autoFocus
              fullWidth
              label="Your Name"
              value={userInfo.username}
              onChange={(e) =>
                setUserInfo((prev) => ({ ...prev, username: e.target.value }))
              }
              sx={{ mt: 1 }}
            />
          </form>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={handleUsernameSubmit}
            disabled={!userInfo.username || userInfo.username.trim() === ""}
          >
            Continue
          </Button>
        </DialogActions>
      </Dialog>

      <Paper elevation={3} sx={{ p: 3 }}>
        <Box
          display="flex"
          justifyContent="space-between"
          alignItems="center"
          mb={2}
        >
          <Typography variant="h5">Generate New Item</Typography>
          <Typography variant="caption" color="textSecondary">
            User: {userInfo.displayName}
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Product Name Selection */}
          <Grid item xs={12}>
            <Box display="flex" alignItems="center" gap={1}>
              <Autocomplete
                fullWidth
                options={products}
                getOptionLabel={(option) => option.name}
                value={
                  products.find((p) => p.name === formData.productName) || null
                }
                onChange={(_, newValue) => handleProductSelect(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Product Name"
                    variant="outlined"
                    required
                  />
                )}
                blurOnSelect
                selectOnFocus
                autoHighlight
                openOnFocus
              />
              <Tooltip title="Add New Product">
                <IconButton onClick={() => handleOpenDialog("productName")}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </Box>
            {formData.productCode && (
              <Typography
                variant="caption"
                color="textSecondary"
                display="block"
              >
                Product Code: {formData.productCode}
              </Typography>
            )}
          </Grid>

          {productSelected && (
            <>
              {/* Manufacturing Part Number */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Manufacturing Part Number"
                  value={formData.mfgPartNo}
                  onChange={(e) =>
                    handleTextChange(
                      "mfgPartNo",
                      e.target.value,
                      "mfgPartCode",
                      "mfg_part"
                    )
                  }
                  variant="outlined"
                  fullWidth
                  required
                  slotProps={{ input: { inputProps: { maxLength: 255 } } }}
                />
                {formData.mfgPartCode && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    MFG Code: {formData.mfgPartCode}
                  </Typography>
                )}
              </Grid>

              {/* Item Description */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Item Description"
                  value={formData.itemDescription}
                  onChange={(e) =>
                    handleTextChange(
                      "itemDescription",
                      e.target.value,
                      "itemCode",
                      "description"
                    )
                  }
                  variant="outlined"
                  fullWidth
                  required
                  slotProps={{ input: { inputProps: { maxLength: 255 } } }}
                />
                {formData.itemCode && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    Item Code: {formData.itemCode}
                  </Typography>
                )}
              </Grid>

              {/* Make */}
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Autocomplete
                    fullWidth
                    options={makes}
                    getOptionLabel={(option) => option.name}
                    value={makes.find((m) => m.name === formData.make) || null}
                    onChange={(_, newValue) => handleMakeSelect(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Make"
                        variant="outlined"
                        required
                        // slotProps={{
                        //   input: { inputProps: { maxLength: 100 } },
                        // }}
                      />
                    )}
                    blurOnSelect
                    selectOnFocus
                    autoHighlight
                    openOnFocus
                  />
                  <Tooltip title="Add New Make">
                    <IconButton onClick={() => handleOpenDialog("make")}>
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                {formData.makeCode && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    Make Code: {formData.makeCode}
                  </Typography>
                )}
              </Grid>

              {/* Type */}
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Autocomplete
                    fullWidth
                    options={types}
                    getOptionLabel={(option) => option.name}
                    value={types.find((t) => t.name === formData.type) || null}
                    onChange={(_, newValue) => handleTypeSelect(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Type"
                        variant="outlined"
                        required
                        // slotProps={{
                        //   input: { inputProps: { maxLength: 100 } },
                        // }}
                      />
                    )}
                    blurOnSelect
                    selectOnFocus
                    autoHighlight
                    openOnFocus
                  />
                  <Tooltip title="Add New Type">
                    <IconButton onClick={() => handleOpenDialog("type")}>
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                {formData.typeCode && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    Type Code: {formData.typeCode}
                  </Typography>
                )}
              </Grid>

              {/* Material Rating */}
              <Grid item xs={12} md={6}>
                <Box display="flex" alignItems="center" gap={1}>
                  <Autocomplete
                    fullWidth
                    options={ratings}
                    getOptionLabel={(option) => option.name}
                    value={
                      ratings.find((r) => r.name === formData.materialRating) ||
                      null
                    }
                    onChange={(_, newValue) => handleRatingSelect(newValue)}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Material Rating"
                        variant="outlined"
                        required
                        // slotProps={{
                        //   input: { inputProps: { maxLength: 100 } },
                        // }}
                      />
                    )}
                    blurOnSelect
                    selectOnFocus
                    autoHighlight
                    openOnFocus
                  />
                  <Tooltip title="Add New Rating">
                    <IconButton onClick={() => handleOpenDialog("rating")}>
                      <AddIcon />
                    </IconButton>
                  </Tooltip>
                </Box>
                {formData.materialRatingCode && (
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    display="block"
                  >
                    Rating Code: {formData.materialRatingCode}
                  </Typography>
                )}
              </Grid>

              {/* Additional Fields */}
              <Grid item xs={12} md={6}>
                <TextField
                  label="Package"
                  value={formData.package}
                  onChange={(e) => handleTextChange("package", e.target.value)}
                  variant="outlined"
                  fullWidth
                  slotProps={{ input: { inputProps: { maxLength: 255 } } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="UOM"
                  value={formData.uom}
                  onChange={(e) => handleTextChange("uom", e.target.value)}
                  variant="outlined"
                  fullWidth
                  slotProps={{ input: { inputProps: { maxLength: 50 } } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="MOQ"
                  type="number"
                  value={formData.moq || ""}
                  onChange={(e) => {
                    const value = Math.max(0, Number(e.target.value));
                    setFormData((prev) => ({ ...prev, moq: value }));
                  }}
                  variant="outlined"
                  fullWidth
                  slotProps={{ input: { inputProps: { min: 0 } } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Lead Time (days)"
                  type="number"
                  value={formData.leadTime || ""}
                  onChange={(e) => {
                    const value = Math.max(0, Number(e.target.value));
                    setFormData((prev) => ({ ...prev, leadTime: value }));
                  }}
                  variant="outlined"
                  fullWidth
                  slotProps={{ input: { inputProps: { min: 0 } } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="HSN Code"
                  value={formData.hsnCode}
                  onChange={(e) => handleTextChange("hsnCode", e.target.value)}
                  variant="outlined"
                  fullWidth
                  slotProps={{ input: { inputProps: { maxLength: 50 } } }}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  label="Bin Location"
                  value={formData.bin}
                  onChange={(e) => handleTextChange("bin", e.target.value)}
                  variant="outlined"
                  fullWidth
                  slotProps={{ input: { inputProps: { maxLength: 50 } } }}
                />
              </Grid>

              {/* Final CIMCON Part Number Preview */}
              {formModified &&
                formData.productCode &&
                formData.typeCode &&
                formData.makeCode &&
                formData.mfgPartCode &&
                formData.itemCode && (
                  <Grid item xs={12}>
                    <Paper elevation={1} sx={{ p: 2, bgcolor: "#f5f5f5" }}>
                      <Typography
                        variant="subtitle1"
                        gutterBottom
                        fontWeight="bold"
                      >
                        Generated CIMCON Part Number:
                      </Typography>
                      <Typography variant="body1">
                        {`${formData.productCode}-${formData.typeCode}-${
                          formData.makeCode
                        }-${formData.materialRatingCode || "000"}-${
                          formData.mfgPartCode
                        }-${formData.itemCode}`}
                      </Typography>
                    </Paper>
                  </Grid>
                )}

              {/* Submit Button */}
              <Grid item xs={12}>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  onClick={handleSubmit}
                  disabled={loading || !formModified}
                >
                  {loading ? <CircularProgress size={24} /> : "Generate Item"}
                </Button>
              </Grid>

              {/* Add this within the form */}
              <Grid item xs={12}>
                <Typography variant="subtitle1">Document Upload</Typography>
                <Box
                  sx={{
                    border: "1px dashed grey",
                    p: 2,
                    textAlign: "center",
                    mt: 1,
                    borderRadius: 1,
                    bgcolor: formData.document ? "#f0f8ff" : "inherit",
                  }}
                >
                  <input
                    type="file"
                    id="file-upload"
                    style={{ display: "none" }}
                    onChange={handleFileChange}
                  />
                  <label htmlFor="file-upload">
                    <Button
                      component="span"
                      startIcon={<CloudUploadIcon />}
                      variant="outlined"
                    >
                      {formData.document ? "Change File" : "Upload Document"}
                    </Button>
                  </label>
                  {formData.document && (
                    <Box
                      mt={2}
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                    >
                      <Typography variant="body2" sx={{ mr: 1 }}>
                        Selected file: {formData.documentName}
                      </Typography>
                      <IconButton
                        onClick={handleRemoveFile}
                        size="small"
                        color="error"
                        sx={{ p: 0.5 }}
                        aria-label="remove file"
                      >
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  )}
                </Box>
              </Grid>
            </>
          )}
        </Grid>
      </Paper>

      {/* Dialog for adding new parameters */}
      <Dialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, type: "", name: "" })}
      >
        <DialogTitle>
          Add New{" "}
          {dialog.type === "productName"
            ? "Product"
            : dialog.type === "make"
            ? "Make"
            : dialog.type === "type"
            ? "Type"
            : dialog.type === "rating"
            ? "Rating"
            : dialog.type === "product_model"
            ? "Manufacturing Part"
            : dialog.type === "remarks"
            ? "Item Description"
            : "Parameter"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Name"
            fullWidth
            value={dialog.name}
            onChange={(e) =>
              setDialog((prev) => ({ ...prev, name: e.target.value }))
            }
          />
          <Typography variant="caption" color="textSecondary" sx={{ mt: 1 }}>
            Maximum length: {maxLengths[dialog.type] || 255} characters
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setDialog({ open: false, type: "", name: "" })}
          >
            Cancel
          </Button>
          <Button
            onClick={handleAddNewParameter}
            color="primary"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemGenerator;
