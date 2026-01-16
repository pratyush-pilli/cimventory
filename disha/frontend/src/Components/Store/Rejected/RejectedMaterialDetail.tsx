import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Divider,
} from "@mui/material";
import { useParams, Link } from "react-router-dom";
import DownloadIcon from "@mui/icons-material/Download";
import axios from "axios";
import { format } from "date-fns";
import configuration from "../../../configuration";

const RejectedMaterialDetail = ({ id }) => {
  const [returnData, setReturnData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    axios
      .get(`${configuration.api_url}/rejected-material/${id}/`)
      .then((response) => {
        setReturnData(response.data);
      })
      .catch((error) => {
        console.error("Error fetching return details:", error);
        setError(
          error.response?.data?.error || "Failed to load return details"
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [id]);

  const handleDownloadDocument = () => {
    window.open(
      `${configuration.api_url}/rejected-material/${id}/document/`,
      "_blank"
    );
  };

  const getStatusChipProps = (status) => {
    const statusMap = {
      pending: { color: "warning", label: "Pending Processing" },
      added_to_stock: { color: "success", label: "Added to Stock" },
      discarded: { color: "error", label: "Discarded/Scrapped" },
    };

    return statusMap[status] || { color: "default", label: status };
  };

  if (loading) {
    return (
      <Box component={Paper} p={3} my={2} textAlign="center">
        <Typography>Loading return details...</Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box component={Paper} p={3} my={2} textAlign="center">
        <Typography color="error">{error}</Typography>
        <Button
          component={Link}
          to="/rejected-materials"
          variant="outlined"
          sx={{ mt: 2 }}
        >
          Back to List
        </Button>
      </Box>
    );
  }

  const { color, label } = getStatusChipProps(returnData.action_taken);

  return (
    <Box component={Paper} p={3} my={2}>
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={2}
      >
        <Typography variant="h5">Rejected Material Return Details</Typography>

        <Box>
          <Button
            component={Link}
            to="/rejected-materials"
            variant="outlined"
            sx={{ mr: 1 }}
          >
            Back to List
          </Button>

          {returnData.document_path && (
            <Button
              variant="outlined"
              startIcon={<DownloadIcon />}
              onClick={handleDownloadDocument}
            >
              Download Document
            </Button>
          )}
        </Box>
      </Box>

      <Divider sx={{ mb: 3 }} />

      <Grid container spacing={2} mb={4}>
        <Grid item xs={12} sm={6} md={3}>
          <Typography variant="body2" color="text.secondary">
            Challan Number
          </Typography>
          <Typography variant="body1" fontWeight="500">
            {returnData.challan_number}
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Typography variant="body2" color="text.secondary">
            Client Name
          </Typography>
          <Typography variant="body1">{returnData.client_name}</Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Typography variant="body2" color="text.secondary">
            Return Date
          </Typography>
          <Typography variant="body1">
            {format(new Date(returnData.return_date), "dd/MM/yyyy")}
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Typography variant="body2" color="text.secondary">
            Status
          </Typography>
          <Chip label={label} color={color} size="small" />
        </Grid>

        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">
            Project Code
          </Typography>
          <Typography variant="body1">
            {returnData.project_code || "N/A"}
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Typography variant="body2" color="text.secondary">
            Created By
          </Typography>
          <Typography variant="body1">{returnData.created_by}</Typography>
        </Grid>

        <Grid item xs={12}>
          <Typography variant="body2" color="text.secondary">
            Reason for Return
          </Typography>
          <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
            {returnData.reason_for_return}
          </Typography>
        </Grid>

        {returnData.remarks && (
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              Additional Remarks
            </Typography>
            <Typography variant="body1" sx={{ whiteSpace: "pre-wrap" }}>
              {returnData.remarks}
            </Typography>
          </Grid>
        )}
      </Grid>

      <Typography variant="h6" mb={2}>
        Items
      </Typography>

      <TableContainer>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Item No.</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Quantity</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Location</TableCell>
              <TableCell>Condition</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {returnData.items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.item_no}</TableCell>
                <TableCell>{item.description}</TableCell>
                <TableCell>{item.quantity}</TableCell>
                <TableCell>
                  <Chip
                    label={
                      item.action === "add_to_stock"
                        ? "Added to Stock"
                        : "Discarded"
                    }
                    color={item.action === "add_to_stock" ? "primary" : "error"}
                    size="small"
                  />
                </TableCell>
                <TableCell>
                  {item.location
                    ? item.location
                        .replace("_stock", "")
                        .split("_")
                        .map(
                          (word) => word.charAt(0).toUpperCase() + word.slice(1)
                        )
                        .join(" ")
                    : "N/A"}
                </TableCell>
                <TableCell>{item.condition}</TableCell>
                <TableCell>{item.reason_details || "N/A"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default RejectedMaterialDetail;
