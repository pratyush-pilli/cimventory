import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Tabs,
  Tab,
  Typography,
  Button,
  Divider,
  Dialog,
  DialogContent,
  IconButton,
  useTheme,
  Snackbar,
  Alert,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import ClientReturnForm from "./ClientReturnForm";
import RejectedMaterialList from "./RejectedMaterialList";
import RejectedMaterialDetail from "./RejectedMaterialDetail";
import axios from "axios";
import configuration from "../../../configuration";

// TabPanel component to handle tab content
function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`rejected-tabpanel-${index}`}
      aria-labelledby={`rejected-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 2 }}>{children}</Box>}
    </div>
  );
}

const RejectedMaterialManager = () => {
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [selectedReturn, setSelectedReturn] = useState(null);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "info",
  });

  // Fetch returns data
  const fetchReturns = () => {
    setLoading(true);
    axios
      .get(`${configuration.api_url}/rejected-materials/`)
      .then((response) => {
        // Make sure we handle both possible API response formats
        const returnsData = Array.isArray(response.data)
          ? response.data
          : response.data?.results || [];
        setReturns(returnsData);
      })
      .catch((error) => {
        console.error("Error fetching rejected returns:", error);
        setSnackbar({
          open: true,
          message: "Failed to load data. Please try again.",
          severity: "error",
        });
        // Set to empty array on error
        setReturns([]);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    fetchReturns();
  }, []);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
    // Reset detail view when switching tabs
    if (newValue === 0) {
      setSelectedReturn(null);
    }
  };

  const handleOpenForm = () => {
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
  };

  const handleSelect = (item) => {
    setSelectedReturn(item);
    setTabValue(1); // Switch to details tab when an item is selected
  };

  const handleFormSubmitSuccess = () => {
    setFormOpen(false);
    fetchReturns(); // Refresh the list
    setSnackbar({
      open: true,
      message: "Rejected material return created successfully",
      severity: "success",
    });
  };

  const handleBackToList = () => {
    setSelectedReturn(null);
  };

  return (
    <Box sx={{ width: "100%" }}>
      <Paper elevation={3} sx={{ borderRadius: 2, overflow: "hidden" }}>
        <Box
          sx={{
            p: 2,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: theme.palette.primary.main,
            color: "white",
          }}
        >
          <Typography variant="h5">
            Client Returns - Rejected Material
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<AddIcon />}
            onClick={handleOpenForm}
          >
            New Return
          </Button>
        </Box>

        <Tabs
          value={tabValue}
          onChange={handleTabChange}
          aria-label="rejected material tabs"
          sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
        >
          <Tab label="List View" />
          <Tab label="Details" disabled={!selectedReturn} />
        </Tabs>

        <TabPanel value={tabValue} index={0}>
          <RejectedMaterialList
            returns={returns}
            loading={loading}
            onSelect={handleSelect}
            onRefresh={fetchReturns}
            onViewDetails={undefined}
          />
        </TabPanel>

        <TabPanel value={tabValue} index={1}>
          {selectedReturn && (
            <Box>
              <Button
                onClick={handleBackToList}
                variant="outlined"
                sx={{ mb: 2 }}
              >
                Back to List
              </Button>
              <RejectedMaterialDetail id={selectedReturn.id} />
            </Box>
          )}
        </TabPanel>
      </Paper>

      {/* New Return Form Dialog */}
      <Dialog
        open={formOpen}
        onClose={handleCloseForm}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 2 },
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            p: 2,
            backgroundColor: theme.palette.primary.main,
            color: "white",
          }}
        >
          <Typography variant="h6">
            Create New Rejected Material Return
          </Typography>
          <IconButton
            aria-label="close"
            onClick={handleCloseForm}
            sx={{ color: "white" }}
          >
            <CloseIcon />
          </IconButton>
        </Box>
        <Divider />
        <DialogContent sx={{ p: 0 }}>
          <ClientReturnForm
            onSuccess={handleFormSubmitSuccess}
            onCancel={handleCloseForm}
          />
        </DialogContent>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
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
  );
};

export default RejectedMaterialManager;
