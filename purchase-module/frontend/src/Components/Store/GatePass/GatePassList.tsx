import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Button,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Grid,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from "@mui/material";
import {
  Visibility as VisibilityIcon,
  GetApp as DownloadIcon,
  AssignmentReturn as ReturnIcon,
} from "@mui/icons-material";
import axios from "axios";
import { useSnackbar } from "notistack";
import { format } from "date-fns";
import configuration from "../../../configuration";
import GatePassDetails from "./GatePassDetails";
import GatePassReturn from "./GatePassReturn";

const GatePassList = ({ refreshTrigger }) => {
  const [gatePasses, setGatePasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const [selectedGatePass, setSelectedGatePass] = useState(null);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    fetchGatePasses();
  }, [filterType, filterStatus, refreshTrigger]);

  const fetchGatePasses = async () => {
    try {
      setLoading(true);
      let url = `${configuration.api_url}gate-passes/`;
      const params = [];

      if (filterType !== "all") {
        params.push(`type=${filterType}`);
      }

      if (filterStatus !== "all") {
        params.push(`status=${filterStatus}`);
      }

      if (params.length > 0) {
        url += `?${params.join("&")}`;
      }

      const response = await axios.get(url);
      console.log("Gate passes data received:", response.data);
      setGatePasses(response.data);
    } catch (error) {
      console.error("Error fetching gate passes:", error);
      enqueueSnackbar("Failed to fetch gate passes", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = (gatePass) => {
    setSelectedGatePass(gatePass);
    setDetailsOpen(true);
  };

  const handleDownloadDocument = async (id) => {
    try {
      console.log("Downloading document for gate pass ID:", id);

      // Use direct download approach for binary files
      window.location.href = `${configuration.api_url}gate-pass/${id}/document/`;
    } catch (error) {
      console.error("Error downloading document:", error);
      enqueueSnackbar("Failed to download document", { variant: "error" });
    }
  };

  const handleProcessReturn = (gatePass) => {
    if (gatePass.status === "fully_returned") {
      enqueueSnackbar("This gate pass is already fully returned", {
        variant: "warning",
      });
      return;
    }

    setSelectedGatePass(gatePass);
    setReturnDialogOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "issued":
        return "primary";
      case "partially_returned":
        return "warning";
      case "fully_returned":
        return "success";
      case "overdue":
        return "error";
      case "cancelled":
        return "default";
      default:
        return "default";
    }
  };

  return (
    <Box className="gate-pass-list">
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={6} lg={3}>
          <FormControl fullWidth>
            <InputLabel>Filter by Type</InputLabel>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              label="Filter by Type"
            >
              <MenuItem value="all">All Types</MenuItem>
              <MenuItem value="outward">Outward - External</MenuItem>
              <MenuItem value="internal">Internal Transfer</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid item xs={12} md={6} lg={3}>
          <FormControl fullWidth>
            <InputLabel>Filter by Status</InputLabel>
            <Select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              label="Filter by Status"
            >
              <MenuItem value="all">All Statuses</MenuItem>
              <MenuItem value="issued">Issued</MenuItem>
              <MenuItem value="partially_returned">Partially Returned</MenuItem>
              <MenuItem value="fully_returned">Fully Returned</MenuItem>
              <MenuItem value="overdue">Overdue</MenuItem>
              <MenuItem value="cancelled">Cancelled</MenuItem>
            </Select>
          </FormControl>
        </Grid>

        <Grid
          item
          xs={12}
          md={12}
          lg={6}
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
          }}
        >
          <Button
            variant="outlined"
            onClick={() => {
              console.log("Refreshing gate passes...");
              fetchGatePasses();
            }}
          >
            Refresh
          </Button>
        </Grid>
      </Grid>

      {loading ? (
        <Typography>Loading gate passes...</Typography>
      ) : gatePasses.length === 0 ? (
        <Typography>No gate passes found.</Typography>
      ) : (
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Gate Pass #</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Issue Date</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Items</TableCell>
              <TableCell>Source</TableCell>
              <TableCell>Destination</TableCell>
              <TableCell>Project</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {gatePasses.map((gatePass) => (
              <TableRow key={gatePass.id}>
                <TableCell>{gatePass.gate_pass_number || "N/A"}</TableCell>
                <TableCell>
                  {gatePass.type_display || gatePass.pass_type || "N/A"}
                </TableCell>
                <TableCell>
                  {gatePass.issue_date
                    ? (() => {
                        try {
                          return format(
                            new Date(gatePass.issue_date),
                            "dd/MM/yyyy"
                          );
                        } catch (err) {
                          console.error("Date format error:", err);
                          return gatePass.issue_date;
                        }
                      })()
                    : "N/A"}
                </TableCell>
                <TableCell>
                  <Chip
                    label={
                      gatePass.status_display || gatePass.status || "Unknown"
                    }
                    color={getStatusColor(gatePass.status)}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {gatePass.item_count || gatePass.items?.length || 0} items
                </TableCell>
                <TableCell>{gatePass.source_location || "N/A"}</TableCell>
                <TableCell>{gatePass.destination_location || "-"}</TableCell>
                <TableCell>{gatePass.project_code || "-"}</TableCell>
                <TableCell>
                  <IconButton
                    size="small"
                    title="View Details"
                    onClick={() => handleViewDetails(gatePass)}
                  >
                    <VisibilityIcon fontSize="small" />
                  </IconButton>

                  <IconButton
                    size="small"
                    title="Download Document"
                    onClick={() => handleDownloadDocument(gatePass.id)}
                  >
                    <DownloadIcon fontSize="small" />
                  </IconButton>

                  {(gatePass.pass_type === "outward" ||
                    gatePass.pass_type === "internal") &&
                    gatePass.status !== "fully_returned" && (
                      <IconButton
                        size="small"
                        title="Process Return"
                        onClick={() => handleProcessReturn(gatePass)}
                        color="primary"
                      >
                        <ReturnIcon fontSize="small" />
                      </IconButton>
                    )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {/* Gate Pass Details Dialog */}
      <GatePassDetails
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        gatePass={selectedGatePass}
        onProcessReturn={() => {
          setDetailsOpen(false);
          setReturnDialogOpen(true);
        }}
      />

      {/* Gate Pass Return Dialog */}
      <GatePassReturn
        open={returnDialogOpen}
        onClose={() => setReturnDialogOpen(false)}
        gatePass={selectedGatePass}
        onReturnProcessed={() => {
          setReturnDialogOpen(false);
          fetchGatePasses();
        }}
      />
    </Box>
  );
};

export default GatePassList;
