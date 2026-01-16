import React from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  TextField,
  Autocomplete,
  IconButton,
  Tooltip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";

interface FactoryItemFormProps {
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
  ratings: any[];
  handleOpenDialog: (type: string) => void;
}

const FactoryItemForm: React.FC<FactoryItemFormProps> = ({
  editedItem,
  handleTextChange,
  handleDropdownChange,
  handleCodeChange,
  products,
  makes,
  ratings,
  handleOpenDialog,
}) => {
  return (
    <Box sx={{ mt: 2 }}>
      <Grid container spacing={3}>
        {/* Product Name */}
        <Grid item xs={12}>
          <Box display="flex" alignItems="center" gap={1}>
            <Autocomplete
              fullWidth
              options={products}
              getOptionLabel={(option) => option.name}
              value={
                products.find((p) => p.name === editedItem.productName) || null
              }
              freeSolo
              forcePopupIcon={true}
              popupIcon={<ArrowDropDownIcon />}
              onChange={(_, newValue) => {
                if (typeof newValue === "string") {
                  handleOpenDialog("productName");
                } else {
                  handleDropdownChange("productName", "productCode", newValue);
                }
              }}
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
          {editedItem.productCode && (
            <Typography variant="caption" color="textSecondary" display="block">
              Product Code (Factory): {editedItem.productCode}
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
              value={makes.find((m) => m.name === editedItem.make) || null}
              freeSolo
              forcePopupIcon={true}
              popupIcon={<ArrowDropDownIcon />}
              onChange={(_, newValue) => {
                if (typeof newValue === "string") {
                  handleOpenDialog("make");
                } else {
                  handleDropdownChange("make", "makeCode", newValue);
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Make"
                  variant="outlined"
                  required
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
          {editedItem.makeCode && (
            <Typography variant="caption" color="textSecondary" display="block">
              Make Code (Factory): {editedItem.makeCode}
            </Typography>
          )}
        </Grid>

        {/* MFG Part Number */}
        <Grid item xs={12} md={6}>
          <Box display="flex" alignItems="center" gap={1}>
            <TextField
              label="Manufacturing Part Number"
              value={editedItem.mfgPartNo}
              onChange={(e) => handleTextChange("mfgPartNo", e.target.value)}
              variant="outlined"
              fullWidth
              required
              slotProps={{ input: { inputProps: { maxLength: 255 } } }}
            />
            <Tooltip title="Add New MPN">
              <IconButton onClick={() => handleOpenDialog("mpn")}> 
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>
          {editedItem.mfgPartCode && (
            <Typography variant="caption" color="textSecondary" display="block">
              MFG Code (Factory): {editedItem.mfgPartCode}
            </Typography>
          )}
        </Grid>

        {/* Material Rating */}
        <Grid item xs={12} md={6}>
          <Box display="flex" alignItems="center" gap={1}>
            <Autocomplete
              fullWidth
              options={ratings}
              getOptionLabel={(option) =>
                typeof option === "string" ? option : option.name
              }
              value={
                ratings.find((r) => r.name === editedItem.materialRating) ||
                null
              }
              forcePopupIcon={true}
              popupIcon={<ArrowDropDownIcon />}
              onChange={(_, newValue) => {
                if (typeof newValue === "string") {
                  handleOpenDialog("rating");
                } else {
                  handleDropdownChange(
                    "materialRating",
                    "materialRatingCode",
                    newValue
                  );
                }
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Material Rating"
                  variant="outlined"
                  required
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
          {editedItem.materialRatingCode && (
            <Typography variant="caption" color="textSecondary" display="block">
              Rating Code (Factory): {editedItem.materialRatingCode}
            </Typography>
          )}
        </Grid>

        {/* Package */}
        <Grid item xs={12} md={6}>
          <Box display="flex" alignItems="center" gap={1}>
            <TextField
              label="Package"
              value={editedItem.package || ""}
              onChange={(e) => handleTextChange("package", e.target.value)}
              variant="outlined"
              fullWidth
              required
              slotProps={{ input: { inputProps: { maxLength: 255 } } }}
            />
            <Tooltip title="Add New Package">
              <IconButton onClick={() => handleOpenDialog("package")}>
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Grid>

        {/* Item Description */}
        <Grid item xs={12} md={6}>
          <Box display="flex" alignItems="center" gap={1}>
            <TextField
              label="Item Description"
              value={editedItem.itemDescription}
              onChange={(e) =>
                handleTextChange("itemDescription", e.target.value)
              }
              variant="outlined"
              fullWidth
              required
              slotProps={{ input: { inputProps: { maxLength: 255 } } }}
            />
            <Tooltip title="Add New Item Description">
              <IconButton onClick={() => handleOpenDialog("itemDescription")}>
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>
          {editedItem.itemCode && (
            <Typography variant="caption" color="textSecondary" display="block">
              Item Code: {editedItem.itemCode}
            </Typography>
          )}
        </Grid>

        {/* Additional fields */}
        <Grid item xs={12} md={6}>
          <TextField
            label="UOM (Unit of Measure)"
            value={editedItem.uom || ""}
            onChange={(e) => handleTextChange("uom", e.target.value)}
            variant="outlined"
            fullWidth
            slotProps={{ input: { inputProps: { maxLength: 50 } } }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="MOQ (Minimum Order Quantity)"
            type="number"
            value={editedItem.moq || ""}
            onChange={(e) => {
              const value = Math.max(0, Number(e.target.value));
              handleTextChange("moq", String(value));
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
            value={editedItem.leadTime || ""}
            onChange={(e) => {
              const value = Math.max(0, Number(e.target.value));
              handleTextChange("leadTime", String(value));
            }}
            variant="outlined"
            fullWidth
            slotProps={{ input: { inputProps: { min: 0 } } }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="HSN Code"
            value={editedItem.hsnCode || ""}
            onChange={(e) => handleTextChange("hsnCode", e.target.value)}
            variant="outlined"
            fullWidth
            slotProps={{ input: { inputProps: { maxLength: 50 } } }}
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <TextField
            label="Bin Location"
            value={editedItem.bin || ""}
            onChange={(e) => handleTextChange("bin", e.target.value)}
            variant="outlined"
            fullWidth
            slotProps={{ input: { inputProps: { maxLength: 50 } } }}
          />
        </Grid>

        {/* Generated Part Number */}
        {editedItem.cimcon_part_no && (
          <Grid item xs={12}>
            <Paper elevation={1} sx={{ p: 2, bgcolor: "#f5f5f5" }}>
              <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                Generated CIMCON Part Number:
              </Typography>
              <Typography variant="body1">
                {editedItem.cimcon_part_no}
              </Typography>
            </Paper>
          </Grid>
        )}
      </Grid>
    </Box>
  );
};

export default FactoryItemForm;
