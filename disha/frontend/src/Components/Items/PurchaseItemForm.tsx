import React from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Autocomplete,
  IconButton,
  Button,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import configuration from "../../configuration";

interface PurchaseItemFormProps {
  editedItem: any;
  handleTextChange: (field: string, value: string) => void;
  handleDropdownChange: (
    field: string,
    codeField: string,
    item: any | null
  ) => void;
  handleCodeChange: (field: string, value: string) => void;
  products: any[];
  makes: any[];
  types: any[];
  ratings: any[];
  handleOpenDialog: (type: string) => void;
  setEditedItem: (item: any) => void;
}

const PurchaseItemForm: React.FC<PurchaseItemFormProps> = ({
  editedItem,
  handleTextChange,
  handleDropdownChange,
  handleCodeChange,
  products,
  makes,
  types,
  ratings,
  handleOpenDialog,
  setEditedItem,
}) => {
  // Debug logging
  React.useEffect(() => {
    console.log("PurchaseItemForm - editedItem:", editedItem);
    console.log("PurchaseItemForm - makes:", makes);
    console.log("PurchaseItemForm - types:", types);
    console.log("PurchaseItemForm - ratings:", ratings);
  }, [editedItem, makes, types, ratings]);

  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        {/* Product Name */}
        <Grid item xs={12}>
          <Box display="flex" alignItems="center" gap={1}>
            <TextField
              label="Product Name *"
              value={editedItem.productName || ""}
              onChange={(e) => handleTextChange("productName", e.target.value)}
              variant="outlined"
              fullWidth
              required
            />
            <IconButton
              onClick={() => handleOpenDialog("productName")}
              title="Add New Product"
            >
              <AddIcon />
            </IconButton>
          </Box>
          <TextField
            label="Product Code"
            value={editedItem.productCode || ""}
            onChange={(e) => handleCodeChange("productCode", e.target.value)}
            variant="outlined"
            size="small"
            margin="dense"
            fullWidth
          />
        </Grid>

        {/* Manufacturing Part Number */}
        <Grid item xs={12} md={6}>
          <TextField
            label="Manufacturing Part Number *"
            value={editedItem.mfgPartNo || ""}
            onChange={(e) => handleTextChange("mfgPartNo", e.target.value)}
            variant="outlined"
            fullWidth
            required
          />
          <TextField
            label="MFG Code"
            value={editedItem.mfgPartCode || ""}
            onChange={(e) => handleCodeChange("mfgPartCode", e.target.value)}
            variant="outlined"
            size="small"
            margin="dense"
            fullWidth
          />
        </Grid>

        {/* Item Description */}
        <Grid item xs={12} md={6}>
          <TextField
            label="Item Description *"
            value={editedItem.itemDescription || ""}
            onChange={(e) =>
              handleTextChange("itemDescription", e.target.value)
            }
            variant="outlined"
            fullWidth
            required
          />
          <TextField
            label="Item Code"
            value={editedItem.itemCode || ""}
            onChange={(e) => handleCodeChange("itemCode", e.target.value)}
            variant="outlined"
            size="small"
            margin="dense"
            fullWidth
          />
        </Grid>

        {/* Make */}
        <Grid item xs={12} md={6}>
          <Box display="flex" alignItems="center" gap={1}>
            <Autocomplete
              fullWidth
              options={makes || []}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option?.name || ""
              }
              value={makes?.find((m) => m.name === editedItem.make) || null}
              onChange={(_, newValue) =>
                handleDropdownChange("make", "makeCode", newValue)
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Make *"
                  variant="outlined"
                  required
                />
              )}
              freeSolo
              disableClearable
              forcePopupIcon={true}
              popupIcon={<ArrowDropDownIcon />}
            />
            <IconButton
              onClick={() => handleOpenDialog("make")}
              title="Add New Make"
            >
              <AddIcon />
            </IconButton>
          </Box>
          <TextField
            label="Make Code"
            value={editedItem.makeCode || ""}
            onChange={(e) => handleCodeChange("makeCode", e.target.value)}
            variant="outlined"
            size="small"
            margin="dense"
            fullWidth
          />
        </Grid>

        {/* Type */}
        <Grid item xs={12} md={6}>
          <Box display="flex" alignItems="center" gap={1}>
            <Autocomplete
              fullWidth
              options={types || []}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option?.name || ""
              }
              value={types?.find((t) => t.name === editedItem.type) || null}
              onChange={(_, newValue) =>
                handleDropdownChange("type", "typeCode", newValue)
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Type *"
                  variant="outlined"
                  required
                />
              )}
              freeSolo
              disableClearable
              forcePopupIcon={true}
              popupIcon={<ArrowDropDownIcon />}
            />
            <IconButton
              onClick={() => handleOpenDialog("type")}
              title="Add New Type"
            >
              <AddIcon />
            </IconButton>
          </Box>
          <TextField
            label="Type Code"
            value={editedItem.typeCode || ""}
            onChange={(e) => handleCodeChange("typeCode", e.target.value)}
            variant="outlined"
            size="small"
            margin="dense"
            fullWidth
          />
        </Grid>

        {/* Material Rating */}
        <Grid item xs={12} md={6}>
          <Box display="flex" alignItems="center" gap={1}>
            <Autocomplete
              fullWidth
              options={ratings || []}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option?.name || ""
              }
              value={
                ratings?.find((r) => r.code === editedItem.materialRatingCode) ||
                null
              }
              onChange={(_, newValue) =>
                handleDropdownChange(
                  "materialRating",
                  "materialRatingCode",
                  newValue
                )
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Material Rating"
                  variant="outlined"
                />
              )}
              freeSolo
              disableClearable
              forcePopupIcon={true}
              popupIcon={<ArrowDropDownIcon />}
            />
            <IconButton
              onClick={() => handleOpenDialog("rating")}
              title="Add New Rating"
            >
              <AddIcon />
            </IconButton>
          </Box>
          <TextField
            label="Rating Code"
            value={editedItem.materialRatingCode || ""}
            onChange={(e) =>
              handleCodeChange("materialRatingCode", e.target.value)
            }
            variant="outlined"
            size="small"
            margin="dense"
            fullWidth
          />
        </Grid>

        {/* Package */}
        <Grid item xs={12} md={6}>
          <TextField
            label="Package"
            value={editedItem.package || ""}
            onChange={(e) => handleTextChange("package", e.target.value)}
            variant="outlined"
            fullWidth
          />
        </Grid>

        {/* UOM */}
        <Grid item xs={12} md={6}>
          <TextField
            label="UOM"
            value={editedItem.uom || ""}
            onChange={(e) => handleTextChange("uom", e.target.value)}
            variant="outlined"
            fullWidth
          />
        </Grid>

        {/* MOQ */}
        <Grid item xs={12} md={6}>
          <TextField
            label="MOQ"
            type="number"
            value={editedItem.moq || ""}
            onChange={(e) => handleTextChange("moq", e.target.value)}
            variant="outlined"
            fullWidth
          />
        </Grid>

        {/* Lead Time */}
        <Grid item xs={12} md={6}>
          <TextField
            label="Lead Time (days)"
            type="number"
            value={editedItem.leadTime || ""}
            onChange={(e) => handleTextChange("leadTime", e.target.value)}
            variant="outlined"
            fullWidth
          />
        </Grid>

        {/* HSN Code */}
        <Grid item xs={12} md={6}>
          <TextField
            label="HSN Code"
            value={editedItem.hsnCode || ""}
            onChange={(e) => handleTextChange("hsnCode", e.target.value)}
            variant="outlined"
            fullWidth
          />
        </Grid>

        {/* Bin Location */}
        <Grid item xs={12} md={6}>
          <TextField
            label="Bin Location"
            value={editedItem.bin || ""}
            onChange={(e) => handleTextChange("bin", e.target.value)}
            variant="outlined"
            fullWidth
          />
        </Grid>

        {/* Generated Part Number */}
        <Grid item xs={12}>
          <Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: "#f5f5f5" }}>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              Generated CIMCON Part Number:
            </Typography>
            <Typography variant="body1">
              {editedItem.cimcon_part_no || "N/A"}
            </Typography>
          </Paper>
        </Grid>

        {/* Document Display */}
        {(editedItem.document_name ||
          editedItem.document_url ||
          editedItem.has_document === true) && (
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: "#f0f8ff" }}>
              <Box
                display="flex"
                alignItems="center"
                justifyContent="space-between"
              >
                <Box display="flex" alignItems="center">
                  <AttachFileIcon sx={{ mr: 1 }} color="primary" />
                  <Typography variant="body1">
                    Document: {editedItem.document_name || "Attached file"}
                  </Typography>
                </Box>
                <Box display="flex" gap={1}>
                  <Button
                    size="small"
                    startIcon={<FileDownloadIcon />}
                    href={`${configuration.api_url}/item-document/request/${editedItem.id}/`}
                    target="_blank"
                    variant="outlined"
                    color="primary"
                  >
                    Download
                  </Button>
                </Box>
              </Box>
            </Paper>
          </Grid>
        )}

        {/* Document Upload */}
        <Grid item xs={12} sx={{ mt: 2 }}>
          <Typography variant="subtitle2" fontWeight="bold">
            {editedItem.document_name ||
            editedItem.document_url ||
            editedItem.has_document === true
              ? "Replace Existing Document"
              : "Add Document"}
          </Typography>
          <Box sx={{ mt: 1 }}>
            <input
              type="file"
              id="file-upload"
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  const file = e.target.files[0];
                  setEditedItem({
                    ...editedItem,
                    document_name: file.name,
                    newDocumentFile: file,
                  });
                }
              }}
            />
            <label htmlFor="file-upload">
              <Button
                component="span"
                variant="contained"
                size="small"
                color={
                  editedItem.document_name ||
                  editedItem.document_url ||
                  editedItem.has_document === true
                    ? "warning"
                    : "primary"
                }
              >
                {editedItem.document_name ||
                editedItem.document_url ||
                editedItem.has_document === true
                  ? "Replace Document"
                  : "Upload Document"}
              </Button>
            </label>
            {editedItem.newDocumentFile && (
              <Typography
                variant="body2"
                sx={{ ml: 1, mt: 1, color: "text.secondary" }}
              >
                New file selected: <strong>{editedItem.newDocumentFile.name}</strong>
                <br />
                <Typography variant="caption" color="warning.main">
                  This will replace the existing document when saved.
                </Typography>
              </Typography>
            )}
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
};

export default PurchaseItemForm;
