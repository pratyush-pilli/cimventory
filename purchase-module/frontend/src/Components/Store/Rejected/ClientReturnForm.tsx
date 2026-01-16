import React, { useState, useEffect } from "react";
import {
  Box,
  Button,
  Paper,
  Typography,
  TextField,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  FormHelperText,
  Snackbar,
  Alert,
  Autocomplete,
  AlertTitle,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { useFormik } from "formik";
import * as Yup from "yup";
import axios from "axios";
import { format } from "date-fns";
import configuration from "../../../configuration";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import HighlightOffIcon from "@mui/icons-material/HighlightOff";

const ClientReturnForm = ({ onSuccess, onCancel }) => {
  const [inventoryItems, setInventoryItems] = useState([]);
  const [projectCodes, setProjectCodes] = useState([]);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileError, setFileError] = useState("");
  const [deliveryChallans, setDeliveryChallans] = useState([]);
  const [selectedChallan, setSelectedChallan] = useState(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    challan_number: "",
    client_name: "",
    return_date: new Date().toISOString().split("T")[0],
    project_code_id: "",
    reason_for_return: "",
    remarks: "",
    items: [],
  });
  const [filteredInventoryItems, setFilteredInventoryItems] = useState([]);
  const [challanDocument, setChallanDocument] = useState({
    path: "",
    filename: "",
  });
  const [submissionError, setSubmissionError] = useState("");

  useEffect(() => {
    console.log("ClientReturnForm mounted/updated", new Date().toISOString());
    return () => {
      console.log("ClientReturnForm unmounted", new Date().toISOString());
    };
  }, []);

  useEffect(() => {
    // Fetch inventory items
    axios
      .get("/inventory/")
      .then((response) => {
        // Handle different possible response formats
        if (Array.isArray(response.data)) {
          setInventoryItems(response.data);
        } else if (
          response.data &&
          response.data.results &&
          Array.isArray(response.data.results)
        ) {
          setInventoryItems(response.data.results);
        } else {
          console.warn("Unexpected inventory items format:", response.data);
          setInventoryItems([]);
        }
      })
      .catch((error) => {
        console.error("Error fetching inventory items:", error);
        setInventoryItems([]); // Set to empty array on error
      });

    // Fetch project codes
    axios
      .get("/api/project-codes/")
      .then((response) => {
        if (response.data && response.data.results) {
          setProjectCodes(response.data.results);
        } else if (Array.isArray(response.data)) {
          setProjectCodes(response.data);
        } else {
          console.warn("Unexpected project codes format:", response.data);
          setProjectCodes([]);
        }
      })
      .catch((error) => {
        console.error("Error fetching project codes:", error);
        setProjectCodes([]);
      });

    // Fetch delivery challans
    const fetchDeliveryChallans = async () => {
      setLoading(true);
      try {
        const response = await axios.get(
          `${configuration.api_url}delivery-challans/`
        );
        setDeliveryChallans(response.data || []);
      } catch (error) {
        console.error("Error fetching delivery challans:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDeliveryChallans();
  }, []);

  const formik = useFormik({
    initialValues: {
      challan_number: "",
      client_name: "",
      return_date: new Date().toISOString().split("T")[0],
      project_code_id: "",
      reason_for_return: "",
      remarks: "",
      items: [],
    },
    validationSchema: Yup.object({
      challan_number: Yup.string().required("Challan number is required"),
      client_name: Yup.string().required("Client name is required"),
      return_date: Yup.string().required("Return date is required"),
      reason_for_return: Yup.string().required("Reason for return is required"),
      items: Yup.array()
        .min(1, "At least one item is required")
        .of(
          Yup.object().shape({
            inventory_id: Yup.number().required("Item is required"),
            quantity: Yup.number()
              .positive("Quantity must be positive")
              .required("Quantity is required"),
            action: Yup.string().required("Action is required"),
            condition: Yup.string().required("Condition is required"),
            location: Yup.string().when("action", {
              is: (val) => val === "add_to_stock",
              then: () =>
                Yup.string().required(
                  "Location is required for items added to stock"
                ),
              otherwise: () => Yup.string().notRequired(),
            }),
          })
        ),
    }),
    onSubmit: (values, { setSubmitting, resetForm }) => {
      console.log("Form submission started", values);

      // Debug the different items by action type
      const itemsToAddToStock = values.items.filter(
        (item) => item.action === "add_to_stock"
      );
      const itemsToDiscard = values.items.filter(
        (item) => item.action === "discard"
      );

      console.log("Items to add to stock:", itemsToAddToStock);
      console.log("Items to discard:", itemsToDiscard);

      // Check if we have a selected challan document or a new uploaded file
      if (!selectedFile && !challanDocument.path) {
        setFileError("Delivery challan document is required");
        setSubmitting(false);
        return;
      }

      // Special validation for items to add to stock
      const invalidStockItems = itemsToAddToStock.filter(
        (item) => !item.location
      );
      if (invalidStockItems.length > 0) {
        console.log(
          "Invalid stock items (missing location):",
          invalidStockItems
        );
        setSnackbar({
          open: true,
          message: "Some items marked 'Add to Stock' are missing a location",
          severity: "error",
        });
        setSubmitting(false);
        return;
      }

      // Format the data for API
      const formData = new FormData();

      // If we have a new uploaded file, add it to the form data
      if (selectedFile) {
        formData.append("document", selectedFile);
        console.log("Using uploaded file:", selectedFile.name);
      } else {
        console.log("Using existing document path:", challanDocument.path);
      }

      // Get current user information
      const username = localStorage.getItem("username") || "system";

      // Convert values to JSON and append as 'data' field
      const processedValues = {
        ...values,
        return_date: values.return_date,
        document_path: challanDocument.path,
        created_by: username, // Add created_by field
      };

      formData.append("data", JSON.stringify(processedValues));

      // For debugging - log the FormData contents
      console.log("Form data structure:", JSON.stringify(processedValues));

      // Submit the form with full URL
      const apiUrl = `${configuration.api_url}rejected-material/create/`;
      console.log("Submitting to URL:", apiUrl);

      // Add timeout protection to ensure setSubmitting(false) is always called
      const submissionTimeout = setTimeout(() => {
        console.log("Submission timeout reached, resetting submission state");
        setSubmitting(false);
      }, 30000); // 30 second timeout

      axios
        .post(apiUrl, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
        .then((response) => {
          clearTimeout(submissionTimeout);
          console.log("Success response:", response.data);
          setSnackbar({
            open: true,
            message: "Rejected material return created successfully",
            severity: "success",
          });
          resetForm();
          setSelectedFile(null);
          setChallanDocument({ path: "", filename: "" });
          setSelectedChallan(null);

          // Call the success callback
          if (onSuccess) {
            onSuccess();
          }
        })
        .catch((error) => {
          clearTimeout(submissionTimeout);
          console.error("Error details:", error);
          // More detailed error logging
          let errorMessage = "Failed to create rejected material return";

          if (error.response) {
            console.error("Error response data:", error.response.data);
            console.error("Error response status:", error.response.status);
            errorMessage = error.response.data?.error || errorMessage;
          } else if (error.request) {
            console.error("No response received:", error.request);
            errorMessage =
              "No response from server. Please check your connection.";
          } else {
            console.error("Error setting up request:", error.message);
            errorMessage = error.message || errorMessage;
          }

          setSubmissionError(errorMessage);
          setSnackbar({
            open: true,
            message: errorMessage,
            severity: "error",
          });
        })
        .finally(() => {
          clearTimeout(submissionTimeout);
          console.log("Form submission completed");
          setSubmitting(false);
        });
    },
  });

  const handleAddItem = () => {
    formik.setFieldValue("items", [
      ...formik.values.items,
      {
        inventory_id: "",
        quantity: 1,
        action: "",
        condition: "",
        location: "",
        reason_details: "",
      },
    ]);
  };

  const handleRemoveItem = (index) => {
    const newItems = [...formik.values.items];
    newItems.splice(index, 1);
    formik.setFieldValue("items", newItems);
  };

  const handleItemChange = (index, field, value) => {
    const newItems = [...formik.values.items];
    newItems[index][field] = value;

    // If changing action to "add_to_stock", ensure we validate location
    if (field === "action" && value === "add_to_stock") {
      console.log(
        `Item ${index} changed to add_to_stock, current location:`,
        newItems[index].location
      );
      // Keep location if it exists, otherwise set a default
      if (!newItems[index].location) {
        // You might want to prompt the user instead of setting a default
        console.log(`Setting default location for item ${index}`);
      }
    }
    // If action changed and not "add_to_stock", clear location
    else if (field === "action" && value !== "add_to_stock") {
      console.log(`Item ${index} changed to ${value}, clearing location`);
      newItems[index].location = "";
    }

    formik.setFieldValue("items", newItems);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    setSelectedFile(file);
    setFileError("");
  };

  const handleChallanSelect = (event, challan) => {
    setSelectedChallan(challan);

    if (challan) {
      console.log("Selected challan:", challan);

      // Format the date properly for the form
      let returnDate = new Date().toISOString().split("T")[0];
      if (challan.date) {
        try {
          returnDate = challan.date;
        } catch (error) {
          console.error("Error parsing challan date:", error);
        }
      }

      // Store document path
      if (challan.document_path) {
        const filename = challan.document_path.split("/").pop() || "";
        setChallanDocument({
          path: challan.document_path,
          filename: filename,
        });
        // Clear any file error since we'll use the existing document
        setFileError("");
      }

      // Filter inventory items to only include those from the challan
      const filteredItems = challan.items.map((item) => ({
        id: item.inventory_id,
        item_no: item.item_no,
        description: item.description,
        make: item.make,
        material_group: item.material_group,
        quantity: item.quantity,
      }));

      setFilteredInventoryItems(filteredItems);

      // Update form with challan info
      formik.setValues({
        challan_number: challan.document_number || "",
        client_name: challan.ship_to || "Not specified",
        return_date: returnDate,
        project_code_id: challan.project_code ? challan.project_code.id : "",
        reason_for_return: "",
        remarks: "",
        items: [], // Start with empty items array
      });
    } else {
      // Reset form and filtered items if no challan is selected
      formik.resetForm();
      setFilteredInventoryItems([]);
      setChallanDocument({ path: "", filename: "" });
    }
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box component={Paper} p={3} my={2}>
        <Typography variant="h5" mb={3}>
          Client Returns - Rejected Material Inward
        </Typography>

        {submissionError && (
          <Grid item xs={12}>
            <Alert severity="error" sx={{ mb: 2 }}>
              <AlertTitle>Submission Error</AlertTitle>
              {submissionError}
            </Alert>
          </Grid>
        )}

        <form onSubmit={formik.handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                id="challan-select"
                options={deliveryChallans}
                getOptionLabel={(option) =>
                  `${option.document_number} - ${
                    option.project_code?.name || "No Project"
                  }`
                }
                value={selectedChallan}
                onChange={handleChallanSelect}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Select Delivery Challan"
                    variant="outlined"
                    fullWidth
                    required
                    helperText="Select from existing delivery challans"
                  />
                )}
                loading={loading}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                name="challan_number"
                label="Delivery Challan Number"
                value={formik.values.challan_number}
                onChange={formik.handleChange}
                error={
                  formik.touched.challan_number &&
                  Boolean(formik.errors.challan_number)
                }
                helperText={
                  formik.touched.challan_number && formik.errors.challan_number
                }
                InputProps={{
                  readOnly: !!selectedChallan,
                }}
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                name="client_name"
                label="Client Name"
                value={formik.values.client_name}
                onChange={formik.handleChange}
                error={
                  formik.touched.client_name &&
                  Boolean(formik.errors.client_name)
                }
                helperText={
                  formik.touched.client_name && formik.errors.client_name
                }
              />
            </Grid>

            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                type="date"
                name="return_date"
                label="Return Date"
                value={formik.values.return_date || ""}
                onChange={formik.handleChange}
                error={
                  formik.touched.return_date &&
                  Boolean(formik.errors.return_date)
                }
                helperText={
                  formik.touched.return_date && formik.errors.return_date
                }
                InputLabelProps={{ shrink: true }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              {selectedChallan ? (
                <TextField
                  fullWidth
                  label="Project Code"
                  value={
                    selectedChallan.project_code
                      ? `${selectedChallan.project_code.code} - ${selectedChallan.project_code.name}`
                      : "None"
                  }
                  InputProps={{
                    readOnly: true,
                  }}
                />
              ) : (
                <FormControl fullWidth>
                  <InputLabel id="project-code-label">Project Code</InputLabel>
                  <Select
                    labelId="project-code-label"
                    name="project_code_id"
                    value={formik.values.project_code_id || ""}
                    onChange={(e) => {
                      formik.setFieldValue(
                        "project_code_id",
                        e.target.value === "" ? null : e.target.value
                      );
                    }}
                  >
                    <MenuItem value="">None</MenuItem>
                    {Array.isArray(projectCodes) &&
                      projectCodes.map((code) => (
                        <MenuItem key={code.id} value={code.id}>
                          {code.code} - {code.name}
                        </MenuItem>
                      ))}
                  </Select>
                </FormControl>
              )}
            </Grid>

            <Grid item xs={12} md={6}>
              {challanDocument.path ? (
                <Box>
                  <Typography
                    variant="body2"
                    color="textSecondary"
                    gutterBottom
                  >
                    Delivery Challan Document
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      p: 1,
                      border: "1px solid #e0e0e0",
                      borderRadius: 1,
                    }}
                  >
                    <InsertDriveFileIcon color="primary" sx={{ mr: 1 }} />
                    <Box sx={{ flex: 1, overflow: "hidden" }}>
                      <Typography variant="body2" noWrap>
                        {challanDocument.filename}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Using existing document from selected challan
                      </Typography>
                    </Box>
                    <IconButton
                      size="small"
                      color="primary"
                      onClick={() => {
                        // Clear document and allow user to upload new one
                        setChallanDocument({ path: "", filename: "" });
                      }}
                    >
                      <HighlightOffIcon />
                    </IconButton>
                  </Box>
                </Box>
              ) : (
                <TextField
                  fullWidth
                  type="file"
                  InputLabelProps={{ shrink: true }}
                  label="Upload Delivery Challan"
                  onChange={handleFileChange}
                  error={!!fileError}
                  helperText={
                    fileError || "Upload a document if not using existing one"
                  }
                />
              )}
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                name="reason_for_return"
                label="Reason for Return"
                multiline
                rows={2}
                value={formik.values.reason_for_return}
                onChange={formik.handleChange}
                error={
                  formik.touched.reason_for_return &&
                  Boolean(formik.errors.reason_for_return)
                }
                helperText={
                  formik.touched.reason_for_return &&
                  formik.errors.reason_for_return
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                name="remarks"
                label="Additional Remarks"
                multiline
                rows={2}
                value={formik.values.remarks}
                onChange={formik.handleChange}
              />
            </Grid>

            <Grid item xs={12}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
              >
                <Typography variant="h6">Items</Typography>
                <Button
                  startIcon={<AddIcon />}
                  variant="outlined"
                  onClick={handleAddItem}
                >
                  Add Item
                </Button>
              </Box>

              {formik.values.items.length === 0 ? (
                <Typography color="text.secondary" align="center" my={2}>
                  No items added. Click "Add Item" to add items.
                </Typography>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Item</TableCell>
                        <TableCell>Quantity</TableCell>
                        <TableCell>Action</TableCell>
                        <TableCell>Location</TableCell>
                        <TableCell>Condition</TableCell>
                        <TableCell>Details</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {formik.values.items.map((item, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <FormControl fullWidth size="small">
                              <InputLabel id={`item-select-label-${index}`}>
                                Select Item
                              </InputLabel>
                              <Select
                                labelId={`item-select-label-${index}`}
                                value={item.inventory_id || ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "inventory_id",
                                    e.target.value
                                  )
                                }
                                error={
                                  formik.touched.items?.[index]?.inventory_id &&
                                  Boolean(
                                    formik.errors.items?.[index]?.inventory_id
                                  )
                                }
                                label="Select Item"
                              >
                                <MenuItem value="">Select Item</MenuItem>
                                {selectedChallan &&
                                Array.isArray(filteredInventoryItems) ? (
                                  filteredInventoryItems.map((inv) => (
                                    <MenuItem key={inv.id} value={inv.id}>
                                      <Box>
                                        <Typography variant="body2">
                                          {inv.item_no} - {inv.description}
                                        </Typography>
                                        <Typography
                                          variant="caption"
                                          color="textSecondary"
                                        >
                                          Make: {inv.make} | Material Group:{" "}
                                          {inv.material_group} | Qty:{" "}
                                          {inv.quantity}
                                        </Typography>
                                      </Box>
                                    </MenuItem>
                                  ))
                                ) : (
                                  <MenuItem value="" disabled>
                                    No items available
                                  </MenuItem>
                                )}
                              </Select>
                              {formik.touched.items?.[index]?.inventory_id &&
                                formik.errors.items?.[index]?.inventory_id && (
                                  <FormHelperText error>
                                    {formik.errors.items?.[index]?.inventory_id}
                                  </FormHelperText>
                                )}
                            </FormControl>
                          </TableCell>

                          <TableCell>
                            <TextField
                              size="small"
                              type="number"
                              value={item.quantity}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "quantity",
                                  e.target.value
                                )
                              }
                              error={
                                formik.touched.items?.[index]?.quantity &&
                                Boolean(formik.errors.items?.[index]?.quantity)
                              }
                            />
                          </TableCell>

                          <TableCell>
                            <FormControl size="small" fullWidth>
                              <Select
                                value={item.action || ""}
                                onChange={(e) =>
                                  handleItemChange(
                                    index,
                                    "action",
                                    e.target.value
                                  )
                                }
                                error={
                                  formik.touched.items?.[index]?.action &&
                                  Boolean(formik.errors.items?.[index]?.action)
                                }
                              >
                                <MenuItem value="">Select</MenuItem>
                                <MenuItem value="add_to_stock">
                                  Add to Stock
                                </MenuItem>
                                <MenuItem value="discard">
                                  Discard/Scrap
                                </MenuItem>
                              </Select>
                            </FormControl>
                          </TableCell>

                          <TableCell>
                            <FormControl
                              size="small"
                              fullWidth
                              disabled={item.action !== "add_to_stock"}
                            >
                              <Select
                                value={item.location || ""}
                                onChange={(e) => {
                                  console.log(
                                    `Location changed for item ${index} to ${e.target.value}`
                                  );
                                  handleItemChange(
                                    index,
                                    "location",
                                    e.target.value
                                  );
                                }}
                                error={
                                  item.action === "add_to_stock" &&
                                  formik.touched.items?.[index]?.location &&
                                  Boolean(
                                    formik.errors.items?.[index]?.location
                                  )
                                }
                              >
                                <MenuItem value="">Select Location</MenuItem>
                                <MenuItem value="times_sq_stock">
                                  Times Square
                                </MenuItem>
                                <MenuItem value="i_sq_stock">iSquare</MenuItem>
                                <MenuItem value="sakar_stock">Sakar</MenuItem>
                                <MenuItem value="pirana_stock">Pirana</MenuItem>
                                <MenuItem value="other_stock">Other</MenuItem>
                              </Select>
                              {item.action === "add_to_stock" &&
                                formik.touched.items?.[index]?.location &&
                                formik.errors.items?.[index]?.location && (
                                  <FormHelperText error>
                                    {formik.errors.items?.[index]?.location}
                                  </FormHelperText>
                                )}
                            </FormControl>
                          </TableCell>

                          <TableCell>
                            <TextField
                              size="small"
                              value={item.condition || ""}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "condition",
                                  e.target.value
                                )
                              }
                              error={
                                formik.touched.items?.[index]?.condition &&
                                Boolean(formik.errors.items?.[index]?.condition)
                              }
                            />
                          </TableCell>

                          <TableCell>
                            <TextField
                              size="small"
                              value={item.reason_details || ""}
                              onChange={(e) =>
                                handleItemChange(
                                  index,
                                  "reason_details",
                                  e.target.value
                                )
                              }
                            />
                          </TableCell>

                          <TableCell>
                            <IconButton
                              onClick={() => handleRemoveItem(index)}
                              color="error"
                            >
                              <DeleteIcon />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {formik.touched.items &&
                formik.errors.items &&
                typeof formik.errors.items === "string" && (
                  <FormHelperText error>{formik.errors.items}</FormHelperText>
                )}
            </Grid>

            <Grid item xs={12} mt={2}>
              <Box display="flex" justifyContent="flex-end">
                <Button onClick={onCancel} sx={{ mr: 2 }}>
                  Cancel
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  type="submit"
                  disabled={formik.isSubmitting}
                  onClick={() => {
                    console.log("Submit button clicked");
                    console.log("Current form values:", formik.values);
                    console.log("Form errors:", formik.errors);
                  }}
                >
                  {formik.isSubmitting ? "Submitting..." : "Submit"}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </form>

        <Snackbar
          open={snackbar.open}
          autoHideDuration={6000}
          onClose={() => setSnackbar({ ...snackbar, open: false })}
        >
          <Alert
            onClose={() => setSnackbar({ ...snackbar, open: false })}
            severity={snackbar.severity}
            sx={{ width: "100%" }}
          >
            {snackbar.message}
          </Alert>
        </Snackbar>
      </Box>
    </LocalizationProvider>
  );
};

export default ClientReturnForm;
