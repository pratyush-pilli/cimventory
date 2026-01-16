import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Grid,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Alert,
  CardActionArea,
  Chip,
  TextField,
  Autocomplete,
  Snackbar,
} from "@mui/material";
import configuration from "../../configuration";
import axios from "axios";
import AddIcon from "@mui/icons-material/Add";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import FactoryItemForm from "./FactoryItemForm";

const ItemSubmitter: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [requests, setRequests] = useState<any[]>([]);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [editedItem, setEditedItem] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Team filter for list rendering
  const [teamFilter, setTeamFilter] = useState<'all' | 'purchase' | 'factory'>('all');

  // Reference data for Purchase dropdowns
  const [products, setProducts] = useState<any[]>([]);
  const [makes, setMakes] = useState<any[]>([]);
  const [types, setTypes] = useState<any[]>([]);
  const [ratings, setRatings] = useState<any[]>([]);

  // Reference data for Factory dropdowns
  const [factoryProducts, setFactoryProducts] = useState<any[]>([]);
  const [factoryMakes, setFactoryMakes] = useState<any[]>([]);
  const [factoryRatings, setFactoryRatings] = useState<any[]>([]);

  const [dialog, setDialog] = useState({
    open: false,
    type: "",
    name: "",
  });

  const [dialogError, setDialogError] = useState("");
  const [dialogSuccess, setDialogSuccess] = useState("");

  const regenerateFactoryPartNumber = (item: any): string => {
    const product = (item.productCode || "").trim().toUpperCase();
    const make = (item.makeCode || "").trim().toUpperCase();
    const mpn = (item.mfgPartCode || "").trim().toUpperCase();
    const rating = (item.materialRating || "").trim().toUpperCase().substring(0, 5);
    const pkg = (item.package || "").trim().toUpperCase().substring(0, 4);
    return `${product}-${make}-${mpn}-${rating}-${pkg}`;
  };

  useEffect(() => {
    fetchItemRequests();
    fetchProducts();
    fetchFactoryData();
  }, []);

  useEffect(() => {
    if (selectedItem) {
      let itemToEdit = { ...selectedItem };
      // Preserve original request type separately to avoid clashing with item attribute 'type'
      itemToEdit.requestType = itemToEdit.type;
      if (itemToEdit.requestType === 'factory') {
        // Derive MFG code from part number if present
        if (itemToEdit.cimcon_part_no && !itemToEdit.mfgPartCode) {
          const parts = itemToEdit.cimcon_part_no.split('-');
          itemToEdit.mfgPartCode = parts.length > 2 ? parts[2] : itemToEdit.mfgPartCode;
        }
        // Map standard factory fields when missing
        itemToEdit.productName = itemToEdit.productName || itemToEdit.productname || '';
        itemToEdit.productCode = itemToEdit.productCode || itemToEdit.productcode || '';
        itemToEdit.make = itemToEdit.make || itemToEdit.makename || '';
        itemToEdit.makeCode = itemToEdit.makeCode || itemToEdit.makecode || '';
        // Ratings: description is full text; ratingvalue is code
        itemToEdit.materialRating = itemToEdit.materialRating || itemToEdit.description || itemToEdit.ratingvalue || '';
        itemToEdit.materialRatingCode = itemToEdit.materialRatingCode || itemToEdit.ratingvalue || '';
        // Package
        itemToEdit.package = itemToEdit.package || itemToEdit.packagedesc || '';
        itemToEdit.packageCode = itemToEdit.packageCode || itemToEdit.packagecode || '';
        // MPN fields
        itemToEdit.mfgPartNo = itemToEdit.mfgPartNo || itemToEdit.mpnfull || '';
        // Normalize various backend keys to mfgPartCode and mpncode
        const backendMpnCode =
          itemToEdit.mfgPartCode ||
          itemToEdit.mpncode ||
          itemToEdit.mpn_code ||
          itemToEdit.mfg_part_code ||
          '';
        itemToEdit.mfgPartCode = backendMpnCode;
        itemToEdit.mpncode = backendMpnCode;
        // Item description
        itemToEdit.itemDescription = itemToEdit.itemDescription || itemToEdit.itemdesc || '';
      }
      setEditedItem(itemToEdit);

      if (selectedItem.type !== 'factory' && selectedItem.productCode) {
        fetchRelatedItems(selectedItem.productCode);
      }
    } else {
      setEditedItem(null);
    }
  }, [selectedItem]);

  useEffect(() => {
    if (!editedItem) return;

    if (editedItem.requestType === 'factory') {
      const newPartNumber = regenerateFactoryPartNumber(editedItem);
      if (newPartNumber !== editedItem.cimcon_part_no) {
        setEditedItem(prev => ({ ...prev, cimcon_part_no: newPartNumber }));
      }
    } else {
      updateCimconPartNumber();
    }
  }, [
    editedItem?.productCode, editedItem?.makeCode, editedItem?.mfgPartCode, 
    editedItem?.materialRating, editedItem?.package, // factory
    editedItem?.typeCode, editedItem?.itemCode, editedItem?.materialRatingCode // purchase
  ]);

  // Ensure purchase dropdowns are populated when product is available
  useEffect(() => {
    if (!editedItem || editedItem.requestType === 'factory') return;
    const product = products.find(p => p.name === editedItem.productName || p.code === editedItem.productCode);
    if (product?.code) {
      fetchRelatedItems(product.code);
    }
  }, [editedItem?.requestType, editedItem?.productName, editedItem?.productCode, products]);

  const fetchItemRequests = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}factory/combined-item-requests/?status=draft,rejected`
      );
      setRequests(response.data);
    } catch (err) {
      setError("Failed to load item requests");
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const response = await axios.get(`${configuration.api_url}options/`);
      if (response.data && response.data.categories) {
        setProducts(response.data.categories);
      }
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  };

  const fetchFactoryData = async () => {
    try {
      const productsResponse = await axios.get(`${configuration.api_url}factory/products/`);
      if (productsResponse.data && productsResponse.data.products) {
        setFactoryProducts(productsResponse.data.products);
      }
      const relatedOptionsResponse = await axios.get(`${configuration.api_url}factory/related-options/`);
      if (relatedOptionsResponse.data) {
        setFactoryMakes(relatedOptionsResponse.data.makes || []);
        setFactoryRatings(relatedOptionsResponse.data.ratings || []);
      }
    } catch (err) {
      console.error("Error fetching factory data:", err);
      setError("Failed to load data for factory form.");
    }
  };

  const fetchRelatedItems = async (productCode: string) => {
    try {
      const product = products.find((p) => p.code === productCode);
      if (!product) return;

      const response = await axios.get(
        `${configuration.api_url}related-options/?main_category_id=${product.id}`
      );

      if (response.data) {
        const uniqueRatings = response.data.ratings?.reduce((acc: any[], current: any) => {
          if (!acc.some((item) => item.name === current.name)) acc.push(current);
          return acc;
        }, []) || [];
        setMakes(response.data.makes || []);
        setTypes(response.data.types || []);
        setRatings(uniqueRatings);
      }
    } catch (err) {
      console.error("Error fetching related items:", err);
    }
  };

  const handleItemClick = (item: any) => {
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setSelectedItem(null);
    setEditedItem(null);
    fetchItemRequests();
  };

  const handleTextChange = (field: string, value: string) => {
    if (!editedItem) return;
    const numericFields = ['moq', 'leadTime', 'lead_time'];
    let parsedValue: string | number | null = value;
    if (numericFields.includes(field)) {
      if (value === '') {
        parsedValue = null;
      } else {
        const num = parseFloat(value);
        parsedValue = isNaN(num) ? null : num;
      }
    }
    setEditedItem((prev) => ({ ...prev, [field]: parsedValue }));
  };

  const updateCimconPartNumber = () => {
    if (!editedItem || editedItem.requestType === 'factory') return;
    const ratingCode = editedItem.materialRatingCode || "000";
    const cimconPartNo = `${editedItem.productCode}${editedItem.typeCode}${editedItem.makeCode}${editedItem.mfgPartCode}${editedItem.itemCode}${ratingCode}`;
    setEditedItem((prev) => ({ ...prev, cimcon_part_no: cimconPartNo }));
  };

  const handleCodeChange = (field: string, value: string) => {
    if (!editedItem) return;
    setEditedItem((prev) => ({ ...prev, [field]: value }));
  };

  const handleDropdownChange = async (field: string, codeField: string, item: any | null) => {
    if (!editedItem) return;

    const newValues: any = {};

    if (item) {
      newValues[field] = item.name;
      if (codeField) newValues[codeField] = item.code;
    } else {
      newValues[field] = "";
      if (codeField) newValues[codeField] = "";
    }

    // Apply base changes immediately
    setEditedItem((prev) => ({ ...prev, ...newValues }));

    // Factory-specific reactions to selections
    if (editedItem.requestType === 'factory') {
      try {
        // When product changes, refresh factory makes/ratings and clear dependent fields
        if (field === 'productName') {
          if (item && item.id) {
            const resp = await axios.get(`${configuration.api_url}factory/related-options/?product_id=${item.id}`);
            setFactoryMakes(resp.data?.makes || []);
            setFactoryRatings(resp.data?.ratings || []);
          } else {
            setFactoryMakes([]);
            setFactoryRatings([]);
          }
          setEditedItem((prev) => prev ? {
            ...prev,
            make: "",
            makeCode: "",
            materialRating: "",
            materialRatingCode: "",
            mfgPartCode: "001",
          } : prev);
        }

        // When make changes, fetch next MPN code for that make
        if (field === 'make') {
          const makeId = item?.id;
          if (makeId) {
            const mpnResp = await axios.get(`${configuration.api_url}factory/next-mpn-code/?make_id=${makeId}`);
            const nextCode = mpnResp.data?.mpn_code || "001";
            setEditedItem((prev) => prev ? { ...prev, mfgPartCode: nextCode } : prev);
          } else {
            setEditedItem((prev) => prev ? { ...prev, mfgPartCode: "001" } : prev);
          }
        }
      } catch (e) {
        console.error('Factory selection handling error:', e);
      }
    }
  };

  const handleSaveChanges = async () => {
    if (!editedItem) return;
    // Compare without local-only fields
    const editedComparable: any = { ...editedItem };
    delete editedComparable.requestType;
    delete editedComparable.newDocumentFile;
    const hasChanges = JSON.stringify(selectedItem) !== JSON.stringify(editedComparable);
    if (!hasChanges && !editedItem.newDocumentFile) {
      setDialogError("No changes to save");
      setTimeout(() => setDialogError(""), 2000);
      return;
    }
    try {
      setLoading(true);
      const endpoint = editedItem.requestType === 'factory'
        ? `${configuration.api_url}factory/update-factory-item-request/${editedItem.id || editedItem.request_id}/`
        : `${configuration.api_url}/update-item-request/${editedItem.id}/`;
      let payload: any = { ...editedItem };
      delete payload.requestType; // Not expected by backend

      // Map frontend field names to backend expected keys for factory items
      if (editedItem.requestType === 'factory') {
        payload.mpncode = editedItem.mfgPartCode ?? editedItem.mpncode ?? '';
        payload.mpnfull = editedItem.mfgPartNo ?? editedItem.mpnfull ?? '';
        // Keep existing aliases too to be safe
        payload.makecode = editedItem.makeCode ?? editedItem.makecode ?? '';
        payload.makename = editedItem.make ?? editedItem.makename ?? '';
        payload.productcode = editedItem.productCode ?? editedItem.productcode ?? '';
        payload.productname = editedItem.productName ?? editedItem.productname ?? '';
        payload.ratingvalue = editedItem.materialRatingCode ?? editedItem.ratingvalue ?? '';
        payload.description = editedItem.materialRating ?? editedItem.description ?? '';
        payload.packagecode = editedItem.packageCode ?? editedItem.packagecode ?? '';
        payload.packagedesc = editedItem.package ?? editedItem.packagedesc ?? '';
        payload.itemdesc = editedItem.itemDescription ?? editedItem.itemdesc ?? '';
      }
      if (editedItem.newDocumentFile) {
        const formData = new FormData();
        Object.keys(payload).forEach((key) => {
          if (key !== "newDocumentFile" && key !== "document" && key !== "requestType" && payload[key] !== null) {
            formData.append(key, payload[key]);
          }
        });
        formData.append("document", editedItem.newDocumentFile);
        await axios.post(endpoint, formData, { headers: { "Content-Type": "multipart/form-data" } });
      } else {
        await axios.post(endpoint, payload);
      }
      setDialogSuccess("Changes saved successfully");
      setTimeout(() => {
        setDialogSuccess("");
        handleDialogClose();
      }, 2000);
    } catch (err) {
      const errorMessage = err.response?.data?.error || "There was a problem saving your changes. Please check your information and try again.";
      setDialogError(errorMessage);
      setTimeout(() => setDialogError(""), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForApproval = async (itemId: string) => {
    try {
      setLoading(true);
      const item = requests.find(req => req.id === itemId || req.request_id === itemId);
      const endpoint = item?.type === 'factory'
        ? `${configuration.api_url}factory/update-factory-item-request/${item.id}/`
        : `${configuration.api_url}/update-item-request/${item.id}/`;
      await axios.post(endpoint, { status: "pending" });
      if (dialogOpen) {
        setDialogSuccess("Item submitted for approval successfully");
        setTimeout(() => {
          setDialogSuccess("");
          handleDialogClose();
        }, 2000);
      } else {
        setSuccess("Item submitted for approval successfully");
        fetchItemRequests();
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || "We couldn't submit your item for approval. Please try again later.";
      if (dialogOpen) {
        setDialogError(errorMessage);
        setTimeout(() => setDialogError(""), 2000);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (type: string) => {
    let dialogType = type;
    if (type === "mfg_part") dialogType = "product_model";
    else if (type === "description") dialogType = "remarks";
    if (dialogType !== "productName" && !selectedProductId()) {
      setError("Please select a product first");
      return;
    }
    setDialog({ open: true, type: dialogType, name: "" });
  };

  const selectedProductId = (): string | undefined => {
    const product = products.find(p => p.name === (editedItem?.productName || ""));
    return product?.id;
  };

  const handleAddNewParameter = async () => {
    const { type, name } = dialog;
    if (!name.trim()) {
      setDialogError("Name is required");
      setTimeout(() => setDialogError(""), 2000);
      return;
    }
    try {
      setLoading(true);
      const productId = selectedProductId();
      if (type !== "productName" && !productId) {
        setError("Please select a product first");
        return;
      }
      const codeResponse = await axios.post(`${configuration.api_url}/generate-code/`, { type: type, name: name, main_category_id: productId });
      if (!codeResponse.data || !codeResponse.data.code) {
        setError(`Failed to generate code for ${type}`);
        return;
      }
      const generatedCode = codeResponse.data.code;
      const response = await axios.post(`${configuration.api_url}/create-parameter/`, { type: type, name: name, code: generatedCode, main_category_id: type !== "productName" ? productId : undefined });
      if (response.data) {
        const newItem = { id: response.data.id.toString(), name: type === "remarks" ? name : response.data.name, code: response.data.code };
        if (type === "productName") setProducts((prev) => [...prev, newItem]);
        else if (type === "make") setMakes((prev) => [...prev, newItem]);
        else if (type === "type") setTypes((prev) => [...prev, newItem]);
        else if (type === "rating") setRatings((prev) => [...prev, newItem]);
        setDialogSuccess(`New ${type} added successfully`);
      }
    } catch (err: any) {
      console.error(`Error creating ${type}:`, err);
      const errorMessage = err.response?.data?.error || `Failed to create ${type}`;
      setError(errorMessage);
    } finally {
      setLoading(false);
      setDialog({ open: false, type: "", name: "" });
    }
  };

  return (
    <Box sx={{ p: 3, maxWidth: 1200, margin: "auto" }}>
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError("")}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess("")}>{success}</Alert>}
      <Paper elevation={3} sx={{ p: 3 }}>
        <Typography variant="h5" gutterBottom>Review Items Before Approval</Typography>
        {/* Team filter controls */}
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Button variant={teamFilter === 'all' ? 'contained' : 'outlined'} size="small" onClick={() => setTeamFilter('all')}>All</Button>
          <Button variant={teamFilter === 'purchase' ? 'contained' : 'outlined'} size="small" onClick={() => setTeamFilter('purchase')}>Purchase</Button>
          <Button variant={teamFilter === 'factory' ? 'contained' : 'outlined'} size="small" onClick={() => setTeamFilter('factory')}>Factory</Button>
        </Box>
        {loading && <CircularProgress sx={{ display: "block", margin: "20px auto" }} />}
        {!loading && requests.length === 0 ? (
          <Typography>No items pending review</Typography>
        ) : (
          <Grid container spacing={3}>
            {requests
              .filter((item) => {
                const team = (item.requestType || item.type || '').toString().toLowerCase();
                if (teamFilter === 'all') return true;
                if (teamFilter === 'factory') return team === 'factory';
                return team !== 'factory';
              })
              .map((item) => (
              <Grid item xs={12} sm={6} md={4} key={item.id || item.request_id}>
                <Card variant="outlined">
                  <CardActionArea onClick={() => handleItemClick(item)}>
                    <CardContent>
                      <Box display="flex" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                        <Typography variant="h6" component="div">{item.productName}</Typography>
                        <Chip size="small" label={(item.requestType || item.type) === 'factory' ? 'Factory' : 'Purchase'} color={(item.requestType || item.type) === 'factory' ? 'secondary' : 'primary'} />
                      </Box>
                      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}>
                        <Typography variant="subtitle2" color="primary">Requested by: {item.requestor}</Typography>
                      </Box>
                      <Typography variant="body2" color="text.secondary">MFG Part: {item.mfgPartNo}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Make: {item.make}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Material Rating: {item.materialRating}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        CIMCON Part: {item.cimcon_part_no}
                      </Typography>
                      {(item.document || item.document_name) && (
                        <Box display="flex" alignItems="center" mt={1}>
                          <AttachFileIcon fontSize="small" color="primary" sx={{ mr: 0.5 }} />
                          <Typography variant="body2" color="primary">Document attached</Typography>
                        </Box>
                      )}
                      <Typography variant="caption" display="block" sx={{ mt: 1 }}>Created: {new Date(item.created_at).toLocaleDateString()}</Typography>
                      {item.status === "rejected" && (
                        <Typography variant="body2" color="error" sx={{ mt: 1 }}><strong>Rejected: </strong>{item.rejection_reason || "No reason provided"}</Typography>
                      )}
                      <Box sx={{ mt: 2, display: "flex", justifyContent: "flex-end" }}>
                        <Button size="small" variant="contained" color={item.status === "rejected" ? "warning" : "primary"} onClick={(e) => { e.stopPropagation(); handleSubmitForApproval(item.id || item.request_id); }}>
                          {item.status === "rejected" ? "Resubmit" : "Submit for Approval"}
                        </Button>
                      </Box>
                    </CardContent>
                  </CardActionArea>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Paper>

      <Dialog open={dialogOpen} onClose={handleDialogClose} maxWidth="lg" fullWidth>
        <DialogTitle>Edit Item Details</DialogTitle>
        <DialogContent>
          {editedItem &&
            (editedItem.requestType === 'factory' ? (
              <FactoryItemForm
                editedItem={editedItem}
                handleTextChange={handleTextChange}
                handleDropdownChange={handleDropdownChange}
                handleCodeChange={handleCodeChange}
                products={factoryProducts}
                makes={factoryMakes}
                ratings={factoryRatings}
                handleOpenDialog={handleOpenDialog}
              />
            ) : (
              <Box sx={{ mt: 2 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <TextField label="Product Name *" value={editedItem.productName} onChange={(e) => handleTextChange("productName", e.target.value)} variant="outlined" fullWidth required />
                      <IconButton onClick={() => handleOpenDialog("productName")} title="Add New Product"><AddIcon /></IconButton>
                    </Box>
                    <TextField label="Product Code" value={editedItem.productCode} onChange={(e) => handleCodeChange("productCode", e.target.value)} variant="outlined" size="small" margin="dense" fullWidth />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Manufacturing Part Number *" value={editedItem.mfgPartNo} onChange={(e) => handleTextChange("mfgPartNo", e.target.value)} variant="outlined" fullWidth required />
                    <TextField label="MFG Code" value={editedItem.mfgPartCode} onChange={(e) => handleCodeChange("mfgPartCode", e.target.value)} variant="outlined" size="small" margin="dense" fullWidth />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <TextField label="Item Description *" value={editedItem.itemDescription} onChange={(e) => handleTextChange("itemDescription", e.target.value)} variant="outlined" fullWidth required />
                    <TextField label="Item Code" value={editedItem.itemCode} onChange={(e) => handleCodeChange("itemCode", e.target.value)} variant="outlined" size="small" margin="dense" fullWidth />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Autocomplete
                        fullWidth
                        options={makes}
                        getOptionLabel={(option) => option.name}
                        isOptionEqualToValue={(opt, val) => opt.code === val.code || opt.name === val.name}
                        value={
                          makes.find((m) => m.name === editedItem.make || m.code === editedItem.makeCode) ||
                          (editedItem.make ? { name: editedItem.make, code: editedItem.makeCode || "" } : null)
                        }
                        onChange={(_, newValue) => handleDropdownChange("make", "makeCode", newValue)}
                        renderInput={(params) => <TextField {...params} label="Make *" variant="outlined" required />}
                        freeSolo
                        disableClearable
                      />
                      <IconButton onClick={() => handleOpenDialog("make")} title="Add New Make"><AddIcon /></IconButton>
                    </Box>
                    <TextField label="Make Code" value={editedItem.makeCode} onChange={(e) => handleCodeChange("makeCode", e.target.value)} variant="outlined" size="small" margin="dense" fullWidth />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Autocomplete
                        fullWidth
                        options={types}
                        getOptionLabel={(option) => option.name}
                        isOptionEqualToValue={(opt, val) => opt.code === val.code || opt.name === val.name}
                        value={
                          types.find((t) => (editedItem.type && t.name === editedItem.type) || (editedItem.typeCode && t.code === editedItem.typeCode)) ||
                          (editedItem.type || editedItem.typeCode ? { name: editedItem.type || "", code: editedItem.typeCode || "" } : null)
                        }
                        onChange={(_, newValue) => handleDropdownChange("type", "typeCode", newValue)}
                        renderInput={(params) => (
                          <TextField {...params} label="Type *" variant="outlined" required />
                        )}
                        freeSolo
                        disableClearable
                      />
                      <IconButton onClick={() => handleOpenDialog("type")} title="Add New Type">
                        <AddIcon />
                      </IconButton>
                    </Box>
                    <TextField
                      label="Type Code"
                      value={editedItem.typeCode}
                      onChange={(e) => handleCodeChange("typeCode", e.target.value)}
                      variant="outlined"
                      size="small"
                      margin="dense"
                      fullWidth
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Box display="flex" alignItems="center" gap={1}>
                      <Autocomplete
                        fullWidth
                        options={ratings}
                        getOptionLabel={(option) => option.name}
                        isOptionEqualToValue={(opt, val) => opt.code === val.code || opt.name === val.name}
                        value={
                          ratings.find((r) => r.name === editedItem.materialRating || r.code === editedItem.materialRatingCode) ||
                          (editedItem.materialRating || editedItem.materialRatingCode ? { name: editedItem.materialRating || "", code: editedItem.materialRatingCode || "" } : null)
                        }
                        onChange={(_, newValue) => handleDropdownChange("materialRating", "materialRatingCode", newValue)}
                        renderInput={(params) => <TextField {...params} label="Material Rating" variant="outlined" />}
                        freeSolo
                        disableClearable
                      />
                      <IconButton onClick={() => handleOpenDialog("rating")} title="Add New Rating"><AddIcon /></IconButton>
                    </Box>
                    <TextField label="Rating Code" value={editedItem.materialRatingCode} onChange={(e) => handleCodeChange("materialRatingCode", e.target.value)} variant="outlined" size="small" margin="dense" fullWidth />
                  </Grid>
                  <Grid item xs={12} md={6}><TextField label="Package" value={editedItem.package || ""} onChange={(e) => handleTextChange("package", e.target.value)} variant="outlined" fullWidth /></Grid>
                  <Grid item xs={12} md={6}><TextField label="UOM" value={editedItem.uom || ""} onChange={(e) => handleTextChange("uom", e.target.value)} variant="outlined" fullWidth /></Grid>
                  <Grid item xs={12} md={6}><TextField label="MOQ" type="number" value={editedItem.moq || ""} onChange={(e) => handleTextChange("moq", e.target.value)} variant="outlined" fullWidth /></Grid>
                  <Grid item xs={12} md={6}><TextField label="Lead Time (days)" type="number" value={editedItem.leadTime || ""} onChange={(e) => handleTextChange("leadTime", e.target.value)} variant="outlined" fullWidth /></Grid>
                  <Grid item xs={12} md={6}><TextField label="HSN Code" value={editedItem.hsnCode || ""} onChange={(e) => handleTextChange("hsnCode", e.target.value)} variant="outlined" fullWidth /></Grid>
                  <Grid item xs={12} md={6}><TextField label="Bin Location" value={editedItem.bin || ""} onChange={(e) => handleTextChange("bin", e.target.value)} variant="outlined" fullWidth /></Grid>
                  <Grid item xs={12}><Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: "#f5f5f5" }}><Typography variant="subtitle1" gutterBottom fontWeight="bold">Generated CIMCON Part Number:</Typography><Typography variant="body1">{editedItem.cimcon_part_no}</Typography></Paper></Grid>
                  {(editedItem.document_name || editedItem.document_url || editedItem.has_document === true) && (
                    <Grid item xs={12}><Paper elevation={1} sx={{ p: 2, mt: 2, bgcolor: "#f0f8ff" }}><Box display="flex" alignItems="center" justifyContent="space-between"><Box display="flex" alignItems="center"><AttachFileIcon sx={{ mr: 1 }} color="primary" /><Typography variant="body1">Document: {editedItem.document_name || "Attached file"}</Typography></Box><Box display="flex" gap={1}><Button size="small" startIcon={<FileDownloadIcon />} href={`${configuration.api_url}/item-document/request/${editedItem.id}/`} target="_blank" variant="outlined" color="primary">Download</Button></Box></Box></Paper></Grid>
                  )}
                  <Grid item xs={12} sx={{ mt: 2 }}>
                    <Typography variant="subtitle2" fontWeight="bold">{editedItem.document_name || editedItem.document_url || editedItem.has_document === true ? "Replace Existing Document" : "Add Document"}</Typography>
                    <Box sx={{ mt: 1 }}>
                      <input type="file" id="file-upload" style={{ display: "none" }} onChange={(e) => { if (e.target.files && e.target.files[0]) { const file = e.target.files[0]; setEditedItem({ ...editedItem, document_name: file.name, newDocumentFile: file }); } }} />
                      <label htmlFor="file-upload"><Button component="span" variant="contained" size="small" color={editedItem.document_name || editedItem.document_url || editedItem.has_document === true ? "warning" : "primary"}>{editedItem.document_name || editedItem.document_url || editedItem.has_document === true ? "Replace Document" : "Upload Document"}</Button></label>
                      {editedItem.newDocumentFile && <Typography variant="body2" sx={{ ml: 1, mt: 1, color: "text.secondary" }}>New file selected: <strong>{editedItem.newDocumentFile.name}</strong><br /><Typography variant="caption" color="warning.main">This will replace the existing document when saved.</Typography></Typography>}
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleDialogClose}>Cancel</Button>
          <Button onClick={handleSaveChanges} color="primary" variant="contained">Save Changes</Button>
          <Button onClick={() => handleSubmitForApproval(editedItem?.id || editedItem?.request_id)} color="success" variant="contained">Submit for Approval</Button>
        </DialogActions>

        {dialogError && <Snackbar open={!!dialogError} autoHideDuration={2000} onClose={() => setDialogError("")} anchorOrigin={{ vertical: "top", horizontal: "center" }} sx={{ zIndex: 9999 }}><Alert severity="error" sx={{ width: "100%", minWidth: "300px", boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.2)" }}>{dialogError}</Alert></Snackbar>}
        {dialogSuccess && <Snackbar open={!!dialogSuccess} autoHideDuration={2000} onClose={() => setDialogSuccess("")} anchorOrigin={{ vertical: "top", horizontal: "center" }} sx={{ zIndex: 9999 }}><Alert severity="success" sx={{ width: "100%", minWidth: "300px", boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.2)" }}>{dialogSuccess}</Alert></Snackbar>}
      </Dialog>

      <Dialog open={dialog.open} onClose={() => setDialog({ open: false, type: "", name: "" })}>
        <DialogTitle>Add New {dialog.type === "productName" ? "Product" : dialog.type === "make" ? "Make" : dialog.type === "type" ? "Type" : dialog.type === "rating" ? "Rating" : dialog.type === "product_model" ? "Manufacturing Part" : dialog.type === "remarks" ? "Item Description" : "Parameter"}</DialogTitle>
        <DialogContent>
          <TextField autoFocus margin="dense" label="Name" fullWidth value={dialog.name} onChange={(e) => setDialog((prev) => ({ ...prev, name: e.target.value }))} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialog({ open: false, type: "", name: "" })}>Cancel</Button>
          <Button onClick={handleAddNewParameter} color="primary" disabled={loading}>{loading ? <CircularProgress size={24} /> : "Add"}</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ItemSubmitter;
