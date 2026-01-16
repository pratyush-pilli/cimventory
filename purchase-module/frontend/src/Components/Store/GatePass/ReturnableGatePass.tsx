import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  TextField,
  Button,
  Grid,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Divider,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Autocomplete,
} from "@mui/material";
import { Add as AddIcon, Delete as DeleteIcon } from "@mui/icons-material";
import axios from "axios";
import { useSnackbar } from "notistack";
import configuration from "../../../configuration";
import GatePassList from "./GatePassList";
import "./GatePass.scss";
import { styled } from "@mui/material/styles";

interface GatePassItem {
  inventory_id: number;
  item_no: string;
  description: string;
  make: string;
  quantity: number;
  source_location: string;
  destination_location?: string;
  condition?: string;
  remarks?: string;
}

const UploadBox = styled(Box)(({ theme }) => ({
  border: `2px dashed ${theme.palette.primary.main}`,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2),
  textAlign: "center",
  backgroundColor: theme.palette.background.default,
  cursor: "pointer",
  marginBottom: theme.spacing(2),
  "&:hover": {
    backgroundColor: theme.palette.action.hover,
  },
}));

const ReturnableGatePass = () => {
  const [tabValue, setTabValue] = useState(0);
  const [passType, setPassType] = useState("outward");
  const [formData, setFormData] = useState({
    issue_date: new Date().toISOString().split("T")[0],
    expected_return_date: "",
    issued_to: "",
    issued_to_contact: "",
    purpose: "",
    project_code_id: null,
    remarks: "",
    created_by: localStorage.getItem("username") || "system",
  });
  const [items, setItems] = useState<GatePassItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedInventory, setSelectedInventory] = useState(null);
  const [itemQuantity, setItemQuantity] = useState(1);
  const [itemSourceLocation, setItemSourceLocation] = useState("");
  const [itemDestLocation, setItemDestLocation] = useState("");
  const [itemCondition, setItemCondition] = useState("");
  const [itemRemarks, setItemRemarks] = useState("");
  const { enqueueSnackbar } = useSnackbar();
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [selectedProjectCode, setSelectedProjectCode] = useState("");
  const [projectCodes, setProjectCodes] = useState([]);
  const [filteredInventoryItems, setFilteredInventoryItems] = useState([]);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [filePreview, setFilePreview] = useState<string | null>(null);

  useEffect(() => {
    fetchInventoryItems();
    fetchProjectCodes();
  }, []);

  const fetchInventoryItems = async () => {
    try {
      const response = await axios.get(`${configuration.api_url}inventory/`);
      const items = response.data;
      setInventoryItems(items);

      // Also set filteredInventoryItems to show all items initially
      setFilteredInventoryItems(items);
    } catch (error) {
      console.error("Error fetching inventory items:", error);
      enqueueSnackbar("Failed to fetch inventory items", { variant: "error" });
    }
  };

  const fetchProjectCodes = async () => {
    try {
      const response = await axios.get(
        `${configuration.api_url}project-codes/`
      );
      setProjectCodes(response.data);
    } catch (error) {
      console.error("Error fetching project codes:", error);
      enqueueSnackbar("Failed to fetch project codes", { variant: "error" });
    }
  };

  const fetchItemsByProjectCode = async (projectCode) => {
    // If no project code is selected, show all inventory items
    if (!projectCode) {
      console.log("No project code selected, showing all inventory items");
      setFilteredInventoryItems(inventoryItems);
      return;
    }

    try {
      const response = await axios.get(
        `${configuration.api_url}project-requirements/${projectCode}/`
      );

      if (response.data && response.data.length > 0) {
        // Extract unique inventory items from project requirements
        const projectItems = response.data.map((item) => ({
          id: item.inventory_id,
          item_no: item.item_no,
          description: item.description,
          make: item.make,
          material_group: item.material_group,
          // Include other location stock fields
          times_sq_stock: item.times_sq_stock || 0,
          i_sq_stock: item.i_sq_stock || 0,
          sakar_stock: item.sakar_stock || 0,
          pirana_stock: item.pirana_stock || 0,
          other_stock: item.other_stock || 0,
        }));

        console.log(
          `Found ${projectItems.length} items for project ${projectCode}`
        );
        setFilteredInventoryItems(projectItems);
      } else {
        console.log(`No items found for project ${projectCode}`);
        setFilteredInventoryItems([]);
      }
    } catch (error) {
      console.error("Error fetching items by project code:", error);
      enqueueSnackbar("Failed to fetch items for selected project", {
        variant: "error",
      });
      // Fall back to showing all inventory items
      setFilteredInventoryItems(inventoryItems);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handlePassTypeChange = (event) => {
    setPassType(event.target.value);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;

    // Convert project_code_id to a number or null
    if (name === "project_code_id") {
      setFormData({
        ...formData,
        [name]: value === "" ? null : parseInt(value, 10),
      });
    } else {
      // Handle other fields normally
      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleOpenDialog = () => {
    setDialogOpen(true);
    setSelectedInventory(null);
    setItemQuantity(1);
    setItemSourceLocation("");
    setItemDestLocation("");
    setItemCondition("");
    setItemRemarks("");
  };

  const handleAddItem = () => {
    if (!selectedInventory) {
      enqueueSnackbar("Please select an inventory item", {
        variant: "warning",
      });
      return;
    }

    if (itemQuantity <= 0) {
      enqueueSnackbar("Quantity must be greater than zero", {
        variant: "warning",
      });
      return;
    }

    if (!itemSourceLocation) {
      enqueueSnackbar("Please select a source location", {
        variant: "warning",
      });
      return;
    }

    if (passType === "internal" && !itemDestLocation) {
      enqueueSnackbar(
        "Please select a destination location for internal transfer",
        { variant: "warning" }
      );
      return;
    }

    // Check if source and destination are the same for internal transfer
    if (passType === "internal" && itemSourceLocation === itemDestLocation) {
      enqueueSnackbar("Source and destination locations cannot be the same", {
        variant: "warning",
      });
      return;
    }

    // Check stock availability at source location
    const stockAtSource = selectedInventory[itemSourceLocation] || 0;
    if (stockAtSource < itemQuantity) {
      enqueueSnackbar(
        `Insufficient stock at selected location. Available: ${stockAtSource}, Required: ${itemQuantity}`,
        { variant: "error" }
      );
      return;
    }

    const newItem: GatePassItem = {
      inventory_id: selectedInventory.id,
      item_no: selectedInventory.item_no,
      description: selectedInventory.description,
      make: selectedInventory.make,
      quantity: itemQuantity,
      source_location: itemSourceLocation,
      destination_location:
        passType === "internal" ? itemDestLocation : undefined,
      condition: itemCondition,
      remarks: itemRemarks,
    };

    setItems((prev) => [...prev, newItem]);
    setDialogOpen(false);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setUploadedFile(file);
      setFileError("");

      // Create a preview URL for the file
      if (file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = () => {
          setFilePreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setFilePreview(null);
      }
    }
  };

  const handleRemoveFile = () => {
    setUploadedFile(null);
    setFilePreview(null);
    // Also clear the file input
    const fileInput = document.getElementById(
      "gate-pass-document"
    ) as HTMLInputElement;
    if (fileInput) {
      fileInput.value = "";
    }
  };

  const handleSubmit = async () => {
    try {
      console.log("Submit button clicked");

      // Basic validation
      if (!formData.issue_date) {
        enqueueSnackbar("Issue date is required", { variant: "warning" });
        return;
      }

      if (passType === "outward") {
        if (!formData.issued_to) {
          enqueueSnackbar("Issued To is required for outward gate pass", {
            variant: "warning",
          });
          return;
        }

        if (!formData.expected_return_date) {
          enqueueSnackbar(
            "Expected return date is required for outward gate pass",
            { variant: "warning" }
          );
          return;
        }
      }

      if (!formData.purpose) {
        enqueueSnackbar("Purpose is required", { variant: "warning" });
        return;
      }

      if (items.length === 0) {
        enqueueSnackbar("Please add at least one item", { variant: "warning" });
        return;
      }

      // File validation - make it mandatory
      if (!uploadedFile) {
        setFileError("Supporting document is required");
        enqueueSnackbar("Please upload a supporting document", {
          variant: "warning",
        });
        return;
      }

      // Create FormData for submission
      const formDataObj = new FormData();

      // Add the file
      formDataObj.append("document", uploadedFile);

      // Add JSON data
      const jsonData = {
        ...formData,
        pass_type: passType,
        issued_to:
          passType === "internal" && !formData.issued_to
            ? "Internal Transfer"
            : formData.issued_to,
        source_location: items[0]?.source_location?.split("_")[0] || "",
        destination_location:
          passType === "internal" && items[0]?.destination_location
            ? items[0].destination_location.split("_")[0]
            : "",
        expected_return_date: formData.expected_return_date || null,
        items: items.map((item) => ({
          inventory_id: item.inventory_id,
          quantity: item.quantity,
          source_location: item.source_location,
          destination_location: item.destination_location || null,
          condition: item.condition || "",
          remarks: item.remarks || "",
        })),
      };

      // Add the JSON data as a string
      formDataObj.append("data", JSON.stringify(jsonData));

      console.log("File being uploaded:", uploadedFile);
      console.log("JSON data:", JSON.stringify(jsonData, null, 2));

      // Make the API call
      const response = await axios.post(
        `${configuration.api_url}gate-pass/create/`,
        formDataObj,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      console.log("API response:", response.data);

      if (response.data.success) {
        enqueueSnackbar(
          `Gate pass created successfully: ${response.data.gate_pass_number}`,
          { variant: "success" }
        );

        // Logging the document URL if available
        if (response.data.document_url) {
          console.log("Document URL:", response.data.document_url);
        }

        // Reset form
        setFormData({
          issue_date: new Date().toISOString().split("T")[0],
          expected_return_date: "",
          issued_to: "",
          issued_to_contact: "",
          purpose: "",
          project_code_id: null,
          remarks: "",
          created_by: localStorage.getItem("username") || "system",
        });
        setItems([]);
        setUploadedFile(null);
        setFilePreview(null);

        // Switch to list tab
        setTabValue(1);
        setRefreshTrigger(Date.now());
      }
    } catch (error) {
      console.error("Error creating gate pass:", error);
      console.error("Error response:", error.response?.data);

      const errorMessage =
        error.response?.data?.error ||
        error.response?.data?.message ||
        "Failed to create gate pass";

      enqueueSnackbar(errorMessage, { variant: "error" });
    }
  };

  const formatLocationName = (location: string) => {
    return location
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
      .replace(" Stock", "");
  };

  const handleProjectCodeChange = (event) => {
    const projectCode = event.target.value;
    console.log(`Project code changed to: ${projectCode}`);

    setSelectedProjectCode(projectCode);
    setFormData((prev) => ({
      ...prev,
      project_code_id: projectCode,
    }));

    // If the project code is cleared, set all inventory items
    if (!projectCode) {
      console.log("Project code cleared, resetting to all inventory items");
      setFilteredInventoryItems(inventoryItems);
    } else {
      fetchItemsByProjectCode(projectCode);
    }
  };

  return (
    <Box className="gate-pass-container">
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>
          Returnable Gate Pass System
        </Typography>

        <Tabs value={tabValue} onChange={handleTabChange} sx={{ mb: 3 }}>
          <Tab label="Create Gate Pass" />
          <Tab label="View Gate Passes" />
        </Tabs>

        {tabValue === 0 && (
          <Box>
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <FormControl fullWidth>
                  <InputLabel>Gate Pass Type</InputLabel>
                  <Select
                    value={passType}
                    onChange={handlePassTypeChange}
                    label="Gate Pass Type"
                  >
                    <MenuItem value="outward">
                      Outward - External Return
                    </MenuItem>
                    <MenuItem value="internal">Internal Transfer</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Issue Date"
                  type="date"
                  name="issue_date"
                  value={formData.issue_date}
                  onChange={handleFormChange}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>

              {passType === "outward" && (
                <>
                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Issued To"
                      name="issued_to"
                      value={formData.issued_to}
                      onChange={handleFormChange}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Contact Number"
                      name="issued_to_contact"
                      value={formData.issued_to_contact}
                      onChange={handleFormChange}
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      label="Expected Return Date"
                      type="date"
                      name="expected_return_date"
                      value={formData.expected_return_date}
                      onChange={handleFormChange}
                      InputLabelProps={{ shrink: true }}
                    />
                  </Grid>
                </>
              )}

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Purpose"
                  name="purpose"
                  value={formData.purpose}
                  onChange={handleFormChange}
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Remarks (Optional)"
                  name="remarks"
                  value={formData.remarks}
                  onChange={handleFormChange}
                  multiline
                  rows={2}
                />
              </Grid>

              <Grid item xs={12} md={6}>
                <FormControl fullWidth margin="normal">
                  <InputLabel id="project-code-label">Project Code</InputLabel>
                  <Select
                    labelId="project-code-label"
                    name="project_code_id"
                    value={formData.project_code_id || ""}
                    onChange={handleFormChange}
                  >
                    <MenuItem value="">None</MenuItem>
                    {projectCodes.map((code) => (
                      <MenuItem key={code.id} value={code.id}>
                        {code.code} - {code.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Supporting Document <span style={{ color: "red" }}>*</span>
                </Typography>

                {!uploadedFile ? (
                  <>
                    <input
                      accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
                      id="gate-pass-document"
                      type="file"
                      onChange={handleFileChange}
                      style={{ display: "none" }}
                    />
                    <label htmlFor="gate-pass-document">
                      <UploadBox>
                        <Typography
                          variant="body1"
                          color="primary"
                          gutterBottom
                        >
                          Click to upload document
                        </Typography>
                        <Typography variant="caption" color="textSecondary">
                          Accepted formats: PDF, Word, Excel, Images
                        </Typography>
                      </UploadBox>
                    </label>
                    {fileError && (
                      <Typography variant="caption" color="error">
                        {fileError}
                      </Typography>
                    )}
                  </>
                ) : (
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      p: 2,
                      border: "1px solid #ddd",
                      borderRadius: 1,
                    }}
                  >
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="body2">
                        {uploadedFile.name} (
                        {(uploadedFile.size / 1024).toFixed(2)} KB)
                      </Typography>
                      {filePreview && (
                        <Box sx={{ mt: 1 }}>
                          <img
                            src={filePreview}
                            alt="Preview"
                            style={{ maxHeight: 100, maxWidth: 200 }}
                          />
                        </Box>
                      )}
                    </Box>
                    <Box>
                      <IconButton
                        onClick={handleRemoveFile}
                        color="error"
                        title="Remove file"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Box>
                  </Box>
                )}
              </Grid>
            </Grid>

            <Divider sx={{ my: 3 }} />

            <Box
              sx={{
                mb: 2,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <Typography variant="h6">Items</Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenDialog}
              >
                Add Item
              </Button>
            </Box>

            {items.length === 0 ? (
              <Typography color="textSecondary" sx={{ mb: 2 }}>
                No items added yet. Click "Add Item" to add items to the gate
                pass.
              </Typography>
            ) : (
              <Table sx={{ mb: 3 }}>
                <TableHead>
                  <TableRow>
                    <TableCell>Item Code</TableCell>
                    <TableCell>Description</TableCell>
                    <TableCell>Make</TableCell>
                    <TableCell>Quantity</TableCell>
                    <TableCell>Source Location</TableCell>
                    {passType === "internal" && (
                      <TableCell>Destination</TableCell>
                    )}
                    <TableCell>Remarks</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item, index) => (
                    <TableRow key={`${item.inventory_id}-${index}`}>
                      <TableCell>{item.item_no}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell>{item.make}</TableCell>
                      <TableCell>{item.quantity}</TableCell>
                      <TableCell>
                        {formatLocationName(item.source_location)}
                      </TableCell>
                      {passType === "internal" && item.destination_location && (
                        <TableCell>
                          {formatLocationName(item.destination_location)}
                        </TableCell>
                      )}
                      <TableCell>{item.remarks || "-"}</TableCell>
                      <TableCell>
                        <IconButton
                          onClick={() => handleRemoveItem(index)}
                          size="small"
                          color="error"
                        >
                          <DeleteIcon />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            <Box sx={{ mt: 3, display: "flex", justifyContent: "flex-end" }}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleSubmit}
                disabled={items.length === 0}
              >
                Create Gate Pass
              </Button>
            </Box>

            {/* Add Item Dialog */}
            <Dialog
              open={dialogOpen}
              onClose={() => setDialogOpen(false)}
              maxWidth="md"
              fullWidth
            >
              <DialogTitle>Add Item to Gate Pass</DialogTitle>
              <DialogContent>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  <Grid item xs={12}>
                    <Autocomplete
                      fullWidth
                      options={
                        filteredInventoryItems.length > 0
                          ? filteredInventoryItems
                          : inventoryItems
                      }
                      getOptionLabel={(option) =>
                        `${option.item_no} - ${option.description}`
                      }
                      onChange={(event, newValue) =>
                        setSelectedInventory(newValue)
                      }
                      noOptionsText="No items found"
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Select Item"
                          variant="outlined"
                          helperText={
                            filteredInventoryItems.length === 0
                              ? "No items found for selected project"
                              : ""
                          }
                        />
                      )}
                    />
                  </Grid>

                  {selectedInventory && (
                    <>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Quantity"
                          type="number"
                          value={itemQuantity}
                          onChange={(e) =>
                            setItemQuantity(Number(e.target.value))
                          }
                          InputProps={{ inputProps: { min: 1 } }}
                        />
                      </Grid>

                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Source Location</InputLabel>
                          <Select
                            value={itemSourceLocation}
                            onChange={(e) =>
                              setItemSourceLocation(e.target.value)
                            }
                            label="Source Location"
                          >
                            {[
                              "times_sq_stock",
                              "i_sq_stock",
                              "sakar_stock",
                              "pirana_stock",
                              "other_stock",
                            ].map((loc) => (
                              <MenuItem
                                key={loc}
                                value={loc}
                                disabled={selectedInventory[loc] <= 0}
                              >
                                {formatLocationName(loc)} (
                                {selectedInventory[loc] || 0})
                              </MenuItem>
                            ))}
                          </Select>
                        </FormControl>
                      </Grid>

                      {passType === "internal" && (
                        <Grid item xs={12} md={6}>
                          <FormControl fullWidth>
                            <InputLabel>Destination Location</InputLabel>
                            <Select
                              value={itemDestLocation}
                              onChange={(e) =>
                                setItemDestLocation(e.target.value)
                              }
                              label="Destination Location"
                            >
                              {[
                                "times_sq_stock",
                                "i_sq_stock",
                                "sakar_stock",
                                "pirana_stock",
                                "other_stock",
                              ].map((loc) => (
                                <MenuItem
                                  key={loc}
                                  value={loc}
                                  disabled={loc === itemSourceLocation}
                                >
                                  {formatLocationName(loc)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>
                      )}

                      <Grid item xs={12} md={passType === "internal" ? 6 : 12}>
                        <TextField
                          fullWidth
                          label="Condition"
                          value={itemCondition}
                          onChange={(e) => setItemCondition(e.target.value)}
                        />
                      </Grid>

                      <Grid item xs={12}>
                        <TextField
                          fullWidth
                          label="Remarks"
                          value={itemRemarks}
                          onChange={(e) => setItemRemarks(e.target.value)}
                          multiline
                          rows={2}
                        />
                      </Grid>
                    </>
                  )}
                </Grid>
              </DialogContent>
              <DialogActions>
                <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button
                  onClick={handleAddItem}
                  variant="contained"
                  color="primary"
                >
                  Add Item
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        )}

        {tabValue === 1 && <GatePassList refreshTrigger={refreshTrigger} />}
      </Paper>
    </Box>
  );
};

export default ReturnableGatePass;
