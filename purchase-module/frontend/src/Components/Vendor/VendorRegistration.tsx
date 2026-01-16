import React, { useState } from "react";
import {
  Button,
  TextField,
  FormControlLabel,
  Checkbox,
  Grid,
  Typography,
  Snackbar,
  Alert,
  Box,
} from "@mui/material";
import axios from "axios";
import configuration from "../../configuration";
import "./VendorRegistration.scss";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";

interface VendorFormData {
  registration_form_received: boolean;
  product_category: string;
  vendor_name: string;
  contact_person: string;
  mobile_no_1: string;
  mobile_no_2: string;
  email_1: string;
  email_2: string;
  website: string;
  address: string;
  payment_term: string;
  pan_card: File | null;
  gst_certificate: File | null;
  incorporation_certificate: File | null;
  cancelled_cheque: File | null;
  tan_allotment_letter: File | null;
  udyam_certificate_msme: File | null;
  vendor_reg_form: File | null;
  gst_number: string;
  pan_number: string;
  state: string;
  state_code: string;
}

const VendorRegistration: React.FC = () => {
  const initialFormData: VendorFormData = {
    registration_form_received: false,
    product_category: "",
    vendor_name: "",
    contact_person: "",
    mobile_no_1: "",
    mobile_no_2: "",
    email_1: "",
    email_2: "",
    website: "",
    address: "",
    payment_term: "",
    pan_card: null,
    gst_certificate: null,
    incorporation_certificate: null,
    cancelled_cheque: null,
    tan_allotment_letter: null,
    udyam_certificate_msme: null,
    vendor_reg_form: null,
    gst_number: "",
    pan_number: "",
    state: "",
    state_code: "",
  };

  const [formData, setFormData] = useState<VendorFormData>(initialFormData);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success" as "success" | "error",
  });
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.name) {
      setFormData((prev) => ({
        ...prev,
        [e.target.name]: e.target.files[0],
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);

    try {
      const response = await axios.get(
        `${configuration.api_url}/vendors/last-vendor-id/`
      );
      let nextVendorId;

      if (response.data && response.data.vendor_id) {
        const lastNumber = parseInt(response.data.vendor_id.slice(6));
        nextVendorId = `CIMVID${String(lastNumber + 1).padStart(5, "0")}`;
      } else {
        nextVendorId = "CIMVID00001";
      }

      const formDataToSubmit = new FormData();
      formDataToSubmit.append("vendor_id", nextVendorId);

      Object.keys(formData).forEach((key) => {
        if (
          [
            "pan_card",
            "gst_certificate",
            "incorporation_certificate",
            "cancelled_cheque",
            "tan_allotment_letter",
            "udyam_certificate_msme",
          ].includes(key) &&
          formData[key]
        ) {
          formDataToSubmit.append(key, formData[key]);
        } else {
          formDataToSubmit.append(key, formData[key]);
        }
      });
      console.log("Form data to submit:", formDataToSubmit);
      await axios.post(`${configuration.api_url}/vendors/`, formDataToSubmit, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSnackbar({
        open: true,
        message: "Vendor registered successfully!",
        severity: "success",
      });
      setFormData(initialFormData);
      setSubmitted(false);
    } catch (error) {
      setSnackbar({
        open: true,
        message: "Error registering vendor. Please try again.",
        severity: "error",
      });
    }
  };

  return (
    <Box
      sx={{
        padding: { xs: "20px", md: "40px" },
        maxWidth: "1000px",
        margin: "20px auto",
        backgroundColor: "#ffffff",
        borderRadius: "12px",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.08)",
      }}
    >
      <Typography
        variant="h4"
        component="h1"
        sx={{
          mb: 4,
          color: "#1a237e",
          textAlign: "center",
          fontWeight: "600",
          position: "relative",
          "&:after": {
            content: '""',
            position: "absolute",
            bottom: "-10px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "60px",
            height: "4px",
            backgroundColor: "#1a237e",
            borderRadius: "2px",
          },
        }}
      >
        Vendor Registration Form
      </Typography>

      <form onSubmit={handleSubmit}>
        <Grid container spacing={4}>
          <Grid item xs={12}>
            <Typography
              variant="h6"
              sx={{
                mb: 2,
                color: "#1a237e",
                fontWeight: "500",
                borderBottom: "2px solid #e0e6ff",
                paddingBottom: "8px",
              }}
            ></Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Product Category *"
              name="product_category"
              value={formData.product_category}
              onChange={handleChange}
              error={submitted && !formData.product_category}
              helperText={
                submitted && !formData.product_category
                  ? "Product Category is required"
                  : ""
              }
              sx={{
                "& .MuiOutlinedInput-root": {
                  "&:hover fieldset": {
                    borderColor: "#1a237e",
                  },
                },
                "& .MuiInputLabel-root.Mui-focused": {
                  color: "#1a237e",
                },
              }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Vendor Name *"
              name="vendor_name"
              value={formData.vendor_name}
              onChange={handleChange}
              error={submitted && !formData.vendor_name}
              helperText={
                submitted && !formData.vendor_name
                  ? "Vendor Name is required"
                  : ""
              }
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Contact Person *"
              name="contact_person"
              value={formData.contact_person}
              onChange={handleChange}
              error={submitted && !formData.contact_person}
              helperText={
                submitted && !formData.contact_person
                  ? "Contact Person is required"
                  : ""
              }
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Mobile Number 1*"
              name="mobile_no_1"
              value={formData.mobile_no_1}
              onChange={handleChange}
              inputProps={{ maxLength: 20 }}
              error={submitted && !formData.mobile_no_1}
              helperText={
                submitted && !formData.mobile_no_1
                  ? "Mobile Number 1 is required"
                  : ""
              }
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Mobile Number 2"
              name="mobile_no_2"
              value={formData.mobile_no_2}
              onChange={handleChange}
              inputProps={{ maxLength: 20 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="email"
              label="Primary Email*"
              name="email_1"
              value={formData.email_1}
              onChange={handleChange}
              error={submitted && !formData.email_1}
              helperText={
                submitted && !formData.email_1
                  ? "Primary Email is required"
                  : ""
              }
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="email"
              label="Secondary Email"
              name="email_2"
              value={formData.email_2}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              type="url"
              label="Website"
              name="website"
              value={formData.website}
              onChange={handleChange}
              placeholder="https://"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              multiline
              rows={4}
              label="Address"
              name="address"
              value={formData.address}
              onChange={handleChange}
              error={submitted && !formData.address}
              helperText={
                submitted && !formData.address ? "Address is required" : ""
              }
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="GST Number"
              name="gst_number"
              value={formData.gst_number}
              onChange={handleChange}
              inputProps={{ maxLength: 15 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="PAN Number"
              name="pan_number"
              value={formData.pan_number}
              onChange={handleChange}
              inputProps={{ maxLength: 10 }}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="State"
              name="state"
              value={formData.state}
              onChange={handleChange}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="State Code"
              name="state_code"
              value={formData.state_code}
              onChange={handleChange}
              inputProps={{ maxLength: 2 }}
              helperText="2-digit state code"
            />
          </Grid>
          <Grid item xs={12}>
            <Typography
              variant="h6"
              sx={{
                mb: 3,
                mt: 2,
                color: "#1a237e",
                fontWeight: "500",
                borderBottom: "2px solid #e0e6ff",
                paddingBottom: "8px",
              }}
            >
              Required Documents
            </Typography>
          </Grid>

          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData.pan_card ? "has-file" : ""
                }`}
                htmlFor="pan-card-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">PAN Card*</div>
                  <div className="sub-text">Upload PDF, JPG, or PNG file</div>
                  {formData.pan_card && (
                    <div className="file-name">{formData.pan_card.name}</div>
                  )}
                </div>
              </label>
              <input
                id="pan-card-input"
                type="file"
                name="pan_card"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
            </div>
          </Grid>
          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData.gst_certificate ? "has-file" : ""
                }`}
                htmlFor="gst-certificate-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">GST Certificate*</div>
                  <div className="sub-text">Upload PDF, JPG, or PNG file</div>
                  {formData.gst_certificate && (
                    <div className="file-name">
                      {formData.gst_certificate.name}
                    </div>
                  )}
                </div>
              </label>
              <input
                id="gst-certificate-input"
                type="file"
                name="gst_certificate"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
            </div>
          </Grid>
          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData.incorporation_certificate ? "has-file" : ""
                }`}
                htmlFor="incorporation-certificate-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">Incorporation Certificate*</div>
                  <div className="sub-text">Upload PDF, JPG, or PNG file</div>
                  {formData.incorporation_certificate && (
                    <div className="file-name">
                      {formData.incorporation_certificate.name}
                    </div>
                  )}
                </div>
              </label>
              <input
                id="incorporation-certificate-input"
                type="file"
                name="incorporation_certificate"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
            </div>
          </Grid>
          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData.cancelled_cheque ? "has-file" : ""
                }`}
                htmlFor="cancelled-cheque-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">Cancelled Cheque*</div>
                  <div className="sub-text">Upload PDF, JPG, or PNG file</div>
                  {formData.cancelled_cheque && (
                    <div className="file-name">
                      {formData.cancelled_cheque.name}
                    </div>
                  )}
                </div>
              </label>
              <input
                id="cancelled-cheque-input"
                type="file"
                name="cancelled_cheque"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
            </div>
          </Grid>
          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData.tan_allotment_letter ? "has-file" : ""
                }`}
                htmlFor="tan-allotment-letter-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">TAN Allotment Letter*</div>
                  <div className="sub-text">Upload PDF, JPG, or PNG file</div>
                  {formData.tan_allotment_letter && (
                    <div className="file-name">
                      {formData.tan_allotment_letter.name}
                    </div>
                  )}
                </div>
              </label>
              <input
                id="tan-allotment-letter-input"
                type="file"
                name="tan_allotment_letter"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
            </div>
          </Grid>
          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData.udyam_certificate_msme ? "has-file" : ""
                }`}
                htmlFor="udyam-certificate-msme-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">UDYAM Certificate (MSME)</div>
                  <div className="sub-text">Upload PDF, JPG, or PNG file</div>
                  {formData.udyam_certificate_msme && (
                    <div className="file-name">
                      {formData.udyam_certificate_msme.name}
                    </div>
                  )}
                </div>
              </label>
              <input
                id="udyam-certificate-msme-input"
                type="file"
                name="udyam_certificate_msme"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
            </div>
          </Grid>
          <Grid item xs={12} md={6}>
            <div className="upload-container">
              <label
                className={`upload-button ${
                  formData.udyam_certificate_msme ? "has-file" : ""
                }`}
                htmlFor="registration-form-input"
              >
                <CloudUploadIcon className="upload-icon" />
                <div className="upload-text">
                  <div className="main-text">Vendor Registration Form*</div>
                  <div className="sub-text">Upload PDF, JPG, or PNG file</div>
                  {formData.vendor_reg_form && (
                    <div className="file-name">
                      {formData.vendor_reg_form.name}
                    </div>
                  )}
                </div>
              </label>
              <input
                id="registration-form-input"
                type="file"
                name="vendor_reg_form"
                className="file-input"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
            </div>
          </Grid>

          {/* <Grid item xs={12}>
            <Typography
              variant="h6"
              sx={{
                mb: 3,
                mt: 2,
                color: "#1a237e",
                fontWeight: "500",
                borderBottom: "2px solid #e0e6ff",
                paddingBottom: "8px",
              }}
            >
              Additional Information
            </Typography>
          </Grid> */}

          <Grid item xs={12}>
            <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
              <Button
                type="submit"
                variant="contained"
                size="large"
                sx={{
                  px: 6,
                  py: 1.5,
                  background:
                    "linear-gradient(45deg, #1a237e 30%, #3949ab 90%)",
                  color: "white",
                  borderRadius: "8px",
                  boxShadow: "0 4px 20px rgba(26, 35, 126, 0.25)",
                  "&:hover": {
                    background:
                      "linear-gradient(45deg, #0d1642 30%, #2c387e 90%)",
                    transform: "translateY(-2px)",
                    boxShadow: "0 6px 25px rgba(26, 35, 126, 0.35)",
                  },
                  transition: "all 0.3s ease",
                }}
              >
                Register Vendor
              </Button>
            </Box>
          </Grid>
        </Grid>
      </form>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "right" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default VendorRegistration;
