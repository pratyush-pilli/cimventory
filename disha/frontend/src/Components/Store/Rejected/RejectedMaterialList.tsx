import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Button,
  Chip,
  IconButton,
  Tooltip,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
} from "@mui/material";
import { Link } from "react-router-dom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DownloadIcon from "@mui/icons-material/Download";
import axios from "axios";
import { format } from "date-fns";
import AssignmentReturnedIcon from "@mui/icons-material/AssignmentReturned";
import RefreshIcon from "@mui/icons-material/Refresh";
import configuration from "../../../configuration";

const RejectedMaterialList = ({
  returns = [],
  loading,
  onViewDetails,
  onRefresh,
  onSelect,
}) => {
  const [filter, setFilter] = useState({
    status: "",
    client: "",
  });

  // Safely filter returns (ensure it's an array first)
  const filteredReturns = Array.isArray(returns)
    ? returns.filter((item) => {
        const matchesClient =
          !filter.client ||
          item.client_name.toLowerCase().includes(filter.client.toLowerCase());
        const matchesStatus =
          !filter.status || item.action_taken === filter.status;
        return matchesClient && matchesStatus;
      })
    : [];

  const handleDownload = (returnId, event) => {
    event.stopPropagation(); // Prevent triggering row click
    window.open(
      `${configuration.api_url}/rejected-material/${returnId}/document/`,
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

  return (
    <Box>
      <Box mb={3} display="flex" gap={2}>
        <TextField
          label="Filter by Client"
          variant="outlined"
          size="small"
          value={filter.client}
          onChange={(e) => setFilter({ ...filter, client: e.target.value })}
          sx={{ width: 250 }}
        />

        <FormControl size="small" sx={{ width: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filter.status}
            label="Status"
            onChange={(e) => setFilter({ ...filter, status: e.target.value })}
          >
            <MenuItem value="">All Statuses</MenuItem>
            <MenuItem value="pending">Pending Processing</MenuItem>
            <MenuItem value="added_to_stock">Added to Stock</MenuItem>
            <MenuItem value="discarded">Discarded/Scrapped</MenuItem>
          </Select>
        </FormControl>

        <Button
          variant="outlined"
          onClick={onRefresh}
          startIcon={<RefreshIcon />}
        >
          Refresh
        </Button>
      </Box>

      {loading ? (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      ) : filteredReturns.length === 0 ? (
        <Box
          sx={{
            py: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            backgroundColor: "#f9f9f9",
            borderRadius: 2,
          }}
        >
          <AssignmentReturnedIcon
            sx={{ fontSize: 60, color: "text.secondary", mb: 2 }}
          />
          <Typography variant="h6" color="text.secondary">
            No rejected material returns found
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 1 }}>
            {filter.client || filter.status
              ? "Try changing your filters"
              : "Create a new return to get started"}
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: "calc(100vh - 280px)" }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell>Challan #</TableCell>
                <TableCell>Client</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Project</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredReturns.map((returnItem) => {
                const { color, label } = getStatusChipProps(
                  returnItem.action_taken
                );

                return (
                  <TableRow
                    key={returnItem.id}
                    hover
                    onClick={() => onSelect(returnItem)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>{returnItem.challan_number}</TableCell>
                    <TableCell>{returnItem.client_name}</TableCell>
                    <TableCell>
                      {format(new Date(returnItem.return_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>{returnItem.project_code || "N/A"}</TableCell>
                    <TableCell>{returnItem.item_count}</TableCell>
                    <TableCell>
                      <Chip label={label} color={color} size="small" />
                    </TableCell>
                    <TableCell>
                      <Box display="flex">
                        <Tooltip title="View Details">
                          <IconButton
                            size="small"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewDetails(returnItem);
                            }}
                          >
                            <VisibilityIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>

                        {returnItem.has_document && (
                          <Tooltip title="Download Document">
                            <IconButton
                              onClick={(e) => handleDownload(returnItem.id, e)}
                              size="small"
                            >
                              <DownloadIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
};

export default RejectedMaterialList;
