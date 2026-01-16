import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Grid,
  Paper,
  Divider,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Box,
  Tabs,
  Tab,
} from "@mui/material";
import { format } from "date-fns";
import axios from "axios";
import configuration from "../../../configuration";

const GatePassDetails = ({ open, onClose, gatePass, onProcessReturn }) => {
  const [tabValue, setTabValue] = useState(0);
  const [detailedGatePass, setDetailedGatePass] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && gatePass) {
      fetchGatePassDetails(gatePass.id);
    }
  }, [open, gatePass]);

  const fetchGatePassDetails = async (id) => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}gate-pass/${id}/`
      );
      setDetailedGatePass(response.data);
    } catch (error) {
      console.error("Error fetching gate pass details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    return format(new Date(dateString), "dd/MM/yyyy");
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

  if (!detailedGatePass || loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogTitle>Gate Pass Details</DialogTitle>
        <DialogContent>
          <Typography>Loading details...</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        Gate Pass Details - {detailedGatePass.gate_pass_number}
      </DialogTitle>
      <DialogContent>
        <Paper elevation={0} sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2">Gate Pass Type</Typography>
              <Typography variant="body1">
                {detailedGatePass.type_display}
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2">Status</Typography>
              <Chip
                label={detailedGatePass.status_display}
                color={getStatusColor(detailedGatePass.status)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2">Issue Date</Typography>
              <Typography variant="body1">
                {formatDate(detailedGatePass.issue_date)}
              </Typography>
            </Grid>
            {detailedGatePass.pass_type === "outward" && (
              <>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">
                    Expected Return Date
                  </Typography>
                  <Typography variant="body1">
                    {formatDate(detailedGatePass.expected_return_date)}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Issued To</Typography>
                  <Typography variant="body1">
                    {detailedGatePass.issued_to}
                  </Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2">Contact</Typography>
                  <Typography variant="body1">
                    {detailedGatePass.issued_to_contact || "-"}
                  </Typography>
                </Grid>
              </>
            )}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2">Source Location</Typography>
              <Typography variant="body1">
                {detailedGatePass.source_location}
              </Typography>
            </Grid>
            {detailedGatePass.pass_type === "internal" && (
              <Grid item xs={12} md={6}>
                <Typography variant="subtitle2">
                  Destination Location
                </Typography>
                <Typography variant="body1">
                  {detailedGatePass.destination_location}
                </Typography>
              </Grid>
            )}
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2">Project Code</Typography>
              <Typography variant="body1">
                {detailedGatePass.project_code || "-"}
              </Typography>
            </Grid>
            <Grid item xs={12}>
              <Typography variant="subtitle2">Purpose</Typography>
              <Typography variant="body1">
                {detailedGatePass.purpose}
              </Typography>
            </Grid>
            {detailedGatePass.remarks && (
              <Grid item xs={12}>
                <Typography variant="subtitle2">Remarks</Typography>
                <Typography variant="body1">
                  {detailedGatePass.remarks}
                </Typography>
              </Grid>
            )}
          </Grid>
        </Paper>

        <Box sx={{ borderBottom: 1, borderColor: "divider", mb: 2 }}>
          <Tabs value={tabValue} onChange={handleTabChange}>
            <Tab label="Items" />
            {detailedGatePass.returns.length > 0 && (
              <Tab label="Return History" />
            )}
          </Tabs>
        </Box>

        {tabValue === 0 && (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Item Code</TableCell>
                <TableCell>Description</TableCell>
                <TableCell>Make</TableCell>
                <TableCell>Quantity</TableCell>
                <TableCell>Returned</TableCell>
                <TableCell>Pending</TableCell>
                <TableCell>Source Location</TableCell>
                {detailedGatePass.pass_type === "internal" && (
                  <TableCell>Destination</TableCell>
                )}
                <TableCell>Condition</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detailedGatePass.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell>{item.item_no}</TableCell>
                  <TableCell>{item.description}</TableCell>
                  <TableCell>{item.make}</TableCell>
                  <TableCell>{item.quantity}</TableCell>
                  <TableCell>{item.returned_quantity}</TableCell>
                  <TableCell>{item.pending_quantity}</TableCell>
                  <TableCell>
                    {item.source_location
                      .replace("_stock", "")
                      .replace("_", " ")
                      .trim()}
                  </TableCell>
                  {detailedGatePass.pass_type === "internal" && (
                    <TableCell>
                      {item.destination_location
                        ? item.destination_location
                            .replace("_stock", "")
                            .replace("_", " ")
                            .trim()
                        : "-"}
                    </TableCell>
                  )}
                  <TableCell>{item.condition_on_issue || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {tabValue === 1 && (
          <Box>
            {detailedGatePass.returns.map((returnEntry, index) => (
              <Paper key={returnEntry.id} elevation={1} sx={{ p: 2, mb: 2 }}>
                <Typography variant="subtitle1">
                  Return #{index + 1} - {formatDate(returnEntry.return_date)}
                </Typography>
                <Typography variant="caption">
                  Received by: {returnEntry.received_by}
                </Typography>
                {returnEntry.remarks && (
                  <Typography variant="body2" sx={{ mt: 1 }}>
                    Remarks: {returnEntry.remarks}
                  </Typography>
                )}
                <Table size="small" sx={{ mt: 2 }}>
                  <TableHead>
                    <TableRow>
                      <TableCell>Item</TableCell>
                      <TableCell>Quantity Returned</TableCell>
                      <TableCell>Condition</TableCell>
                      <TableCell>Remarks</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {returnEntry.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>{item.item_no}</TableCell>
                        <TableCell>{item.quantity}</TableCell>
                        <TableCell>{item.condition || "-"}</TableCell>
                        <TableCell>{item.remarks || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Paper>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        {detailedGatePass.pass_type === "outward" &&
          detailedGatePass.status !== "fully_returned" && (
            <Button
              onClick={onProcessReturn}
              variant="contained"
              color="primary"
            >
              Process Return
            </Button>
          )}
      </DialogActions>
    </Dialog>
  );
};

export default GatePassDetails;
