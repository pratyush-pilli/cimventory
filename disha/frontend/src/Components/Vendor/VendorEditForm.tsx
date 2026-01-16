import React, { useState, useEffect, useCallback } from "react";
import {
  Button,
  TextField,
  Grid,
  Typography,
  Snackbar,
  Alert,
  Box,
  CircularProgress,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import axios from "axios";
import configuration from "../../configuration";
import "./VendorRegistration.scss"; // Reuse the same styles

// Move EditDialog outside of the main component
const EditDialog = ({
  open,
  onClose,
  formData,
  setFormData,
  selectedVendor,
  onSubmit,
}) => (
  <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
    <DialogTitle>
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Edit Vendor Details</Typography>
        <IconButton onClick={onClose}>
          <CloseIcon />
        </IconButton>
      </Box>
    </DialogTitle>
    <DialogContent>
      <form onSubmit={onSubmit}>
        <Grid container spacing={3}>
          {/* Registration Form Received Checkbox */}
          <Grid item xs={12}>
            <Box
              sx={{
                p: 2,
                backgroundColor: "#f5f7ff",
                borderRadius: "8px",
                border: "1px solid #e0e6ff",
              }}
            >
              <FormControlLabel
                control={
                  <Checkbox
                    checked={formData?.registration_form_received || false}
                    onChange={(e) => {
                      const { name, checked } = e.target;
                      setFormData((prev) => ({
                        ...prev,
                        [name]: checked,
                      }));
                    }}
                    name="registration_form_received"
                    color="primary"
                  />
                }
                label="Registration Form Received"
              />
            </Box>
          </Grid>

          {/* Basic Information Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2 }}>
              Basic Information
            </Typography>
          </Grid>

          {/* Form Fields */}
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Vendor Name"
              name="vendor_name"
              value={formData?.vendor_name || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Product Category"
              name="product_category"
              value={formData?.product_category || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
              required
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Contact Person"
              name="contact_person"
              value={formData?.contact_person || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Mobile Number 1"
              name="mobile_no_1"
              value={formData?.mobile_no_1 || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Mobile Number 2"
              name="mobile_no_2"
              value={formData?.mobile_no_2 || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Primary Email"
              name="email_1"
              type="email"
              value={formData?.email_1 || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Secondary Email"
              name="email_2"
              type="email"
              value={formData?.email_2 || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
            />
          </Grid>

          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address"
              name="address"
              multiline
              rows={4}
              value={formData?.address || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="url"
              label="Website"
              name="website"
              value={formData?.website || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
              placeholder="https://"
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Payment Term"
              name="payment_term"
              value={formData?.payment_term || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="GST Number"
              name="gst_number"
              value={formData?.gst_number || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
              inputProps={{ maxLength: 15 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="PAN Number"
              name="pan_number"
              value={formData?.pan_number || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
              inputProps={{ maxLength: 10 }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="State"
              name="state"
              value={formData?.state || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
            />
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="State Code"
              name="state_code"
              value={formData?.state_code || ""}
              onChange={(e) => {
                const { name, value } = e.target;
                setFormData((prev) => ({
                  ...prev,
                  [name]: value,
                }));
              }}
              inputProps={{ maxLength: 2 }}
            />
          </Grid>

          {/* Rejection Remarks Section - if present */}
          {formData?.remarks && (
            <Grid item xs={12}>
              <Box
                sx={{
                  p: 2,
                  backgroundColor: "#fff9f9",
                  borderRadius: "8px",
                  border: "1px solid #ffcccc",
                  mb: 3,
                }}
              >
                <Typography variant="h6" color="error" gutterBottom>
                  Rejection Remarks
                </Typography>
                <Typography variant="body1">{formData.remarks}</Typography>
                <Typography
                  variant="body2"
                  color="textSecondary"
                  sx={{ mt: 1 }}
                >
                  Please address these concerns before resubmitting.
                </Typography>
              </Box>
            </Grid>
          )}

          {/* Document Upload Section */}
          <Grid item xs={12}>
            <Typography variant="h6" sx={{ mb: 2, mt: 2 }}>
              Documents
            </Typography>
          </Grid>

          {/* Document Upload Fields from VendorRegistration.tsx */}
          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData?.pan_card ? "has-file" : ""
                }`}
                htmlFor="pan-card-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">PAN Card</div>
                  <div className="sub-text">
                    {formData?.pan_card
                      ? "File uploaded"
                      : "Upload PDF, JPG, or PNG file"}
                  </div>
                </div>
              </label>
              <input
                id="pan-card-input"
                type="file"
                name="pan_card"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files && e.target.name) {
                    setFormData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.files[0],
                    }));
                  }
                }}
              />
            </div>
          </Grid>

          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData?.gst_certificate ? "has-file" : ""
                }`}
                htmlFor="gst-certificate-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">GST Certificate</div>
                  <div className="sub-text">
                    {formData?.gst_certificate
                      ? "File uploaded"
                      : "Upload PDF, JPG, or PNG file"}
                  </div>
                </div>
              </label>
              <input
                id="gst-certificate-input"
                type="file"
                name="gst_certificate"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files && e.target.name) {
                    setFormData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.files[0],
                    }));
                  }
                }}
              />
            </div>
          </Grid>

          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData?.incorporation_certificate ? "has-file" : ""
                }`}
                htmlFor="incorporation-certificate-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">Incorporation Certificate</div>
                  <div className="sub-text">
                    {formData?.incorporation_certificate
                      ? "File uploaded"
                      : "Upload PDF, JPG, or PNG file"}
                  </div>
                </div>
              </label>
              <input
                id="incorporation-certificate-input"
                type="file"
                name="incorporation_certificate"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files && e.target.name) {
                    setFormData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.files[0],
                    }));
                  }
                }}
              />
            </div>
          </Grid>

          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData?.cancelled_cheque ? "has-file" : ""
                }`}
                htmlFor="cancelled-cheque-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">Cancelled Cheque</div>
                  <div className="sub-text">
                    {formData?.cancelled_cheque
                      ? "File uploaded"
                      : "Upload PDF, JPG, or PNG file"}
                  </div>
                </div>
              </label>
              <input
                id="cancelled-cheque-input"
                type="file"
                name="cancelled_cheque"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files && e.target.name) {
                    setFormData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.files[0],
                    }));
                  }
                }}
              />
            </div>
          </Grid>

          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData?.tan_allotment_letter ? "has-file" : ""
                }`}
                htmlFor="tan-allotment-letter-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">TAN Allotment Letter</div>
                  <div className="sub-text">
                    {formData?.tan_allotment_letter
                      ? "File uploaded"
                      : "Upload PDF, JPG, or PNG file"}
                  </div>
                </div>
              </label>
              <input
                id="tan-allotment-letter-input"
                type="file"
                name="tan_allotment_letter"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files && e.target.name) {
                    setFormData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.files[0],
                    }));
                  }
                }}
              />
            </div>
          </Grid>

          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData?.udyam_certificate_msme ? "has-file" : ""
                }`}
                htmlFor="udyam-certificate-msme-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">UDYAM Certificate (MSME)</div>
                  <div className="sub-text">
                    {formData?.udyam_certificate_msme
                      ? "File uploaded"
                      : "Upload PDF, JPG, or PNG file"}
                  </div>
                </div>
              </label>
              <input
                id="udyam-certificate-msme-input"
                type="file"
                name="udyam_certificate_msme"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files && e.target.name) {
                    setFormData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.files[0],
                    }));
                  }
                }}
              />
            </div>
          </Grid>
          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData?.vendor_reg_form ? "has-file" : ""
                }`}
                htmlFor="vendor-reg-form-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">Vendor Registration Form</div>
                  <div className="sub-text">
                    {formData?.vendor_reg_form
                      ? "File uploaded"
                      : "Upload PDF, JPG, or PNG file"}
                  </div>
                </div>
              </label>
              <input
                id="vendor-reg-form-input"
                type="file"
                name="vendor_reg_form"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files && e.target.name) {
                    setFormData((prev) => ({
                      ...prev,
                      [e.target.name]: e.target.files[0],
                    }));
                  }
                }}
              />
            </div>
          </Grid>

          {/* Submit Buttons */}
          <Grid item xs={12}>
            <Box
              sx={{
                display: "flex",
                gap: 2,
                justifyContent: "flex-end",
                mt: 2,
              }}
            >
              <Button variant="outlined" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" color="primary">
                Update & Submit for Approval
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>
    </DialogContent>
  </Dialog>
);

const VendorEditForm: React.FC = () => {
  const [rejectedVendors, setRejectedVendors] = useState<any[]>([]);
  const [selectedVendor, setSelectedVendor] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });

  useEffect(() => {
    fetchRejectedVendors();
  }, []);

  const fetchRejectedVendors = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}/vendors/rejected/`
      );
      setRejectedVendors(response.data);
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error fetching rejected vendors",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = async (vendor: any) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}/vendors/${vendor.id}/`
      );
      setSelectedVendor(response.data);
      setFormData(response.data);
      setDialogOpen(true);
    } catch (error) {
      console.error("Error fetching vendor details:", error);
      setSnackbar({
        open: true,
        message: "Error fetching vendor details",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const formDataToSubmit = new FormData();

        // Add all fields except vendor_id (to avoid max length validation error)
        Object.keys(formData).forEach((key) => {
          if (key !== "id" && key !== "vendor_id" && formData[key] !== null) {
            if (
              key.includes("_certificate") ||
              key.includes("_card") ||
              key.includes("_cheque") ||
              key.includes("_letter")
            ) {
              if (formData[key] instanceof File) {
                formDataToSubmit.append(key, formData[key]);
              }
            } else {
              // Handle boolean values properly
              if (typeof formData[key] === "boolean") {
                formDataToSubmit.append(key, formData[key] ? "true" : "false");
              } else {
                formDataToSubmit.append(key, formData[key]);
              }
            }
          }
        });

        // Explicitly set status to pending for re-approval
        formDataToSubmit.append("status", "pending");

        console.log("Submitting vendor for approval...");

        const response = await axios.put(
          `${configuration.api_url}/vendors/${selectedVendor.id}/`,
          formDataToSubmit,
          {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          }
        );

        console.log("Update response:", response.data);

        setSnackbar({
          open: true,
          message: "Vendor information updated and submitted for approval!",
          severity: "success",
        });

        setDialogOpen(false);
        setSelectedVendor(null);
        setFormData(null);
        fetchRejectedVendors();
      } catch (error) {
        console.error("Error updating vendor:", error);
        let errorMessage = "Error updating vendor information";
        if (error.response && error.response.data) {
          errorMessage = error.response.data.error || errorMessage;
        }

        setSnackbar({
          open: true,
          message: errorMessage,
          severity: "error",
        });
      }
    },
    [selectedVendor, formData, fetchRejectedVendors]
  );

  // Main render
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Rejected Vendors
      </Typography>
      <Grid container spacing={3}>
        {rejectedVendors.length === 0 ? (
          <Grid item xs={12}>
            <Typography textAlign="center" color="textSecondary">
              No rejected vendors found
            </Typography>
          </Grid>
        ) : (
          rejectedVendors.map((vendor) => (
            <Grid item xs={12} md={6} key={vendor.id}>
              <Card sx={{ height: "100%" }}>
                <CardContent>
                  <Typography variant="h6">{vendor.vendor_name}</Typography>
                  <Typography color="textSecondary">
                    ID: {vendor.vendor_id}
                  </Typography>
                  <Typography color="error" sx={{ mt: 1 }}>
                    Status: Rejected
                  </Typography>
                  {vendor.remarks && (
                    <Typography
                      color="textSecondary"
                      sx={{
                        mt: 1,
                        fontSize: "0.875rem",
                        display: "-webkit-box",
                        overflow: "hidden",
                        WebkitBoxOrient: "vertical",
                        WebkitLineClamp: 2,
                      }}
                    >
                      Reason: {vendor.remarks}
                    </Typography>
                  )}
                  <Button
                    variant="contained"
                    sx={{ mt: 2 }}
                    onClick={() => handleEditClick(vendor)}
                  >
                    Edit Vendor
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))
        )}
      </Grid>

      {formData && (
        <EditDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          formData={formData}
          setFormData={setFormData}
          selectedVendor={selectedVendor}
          onSubmit={handleSubmit}
        />
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
};

export default VendorEditForm;
