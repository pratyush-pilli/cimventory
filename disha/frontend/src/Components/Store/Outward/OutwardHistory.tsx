import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Tooltip,
  IconButton,
} from "@mui/material";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { format } from "date-fns";
import axios from "axios";
import configuration from "../../../configuration";
import { useSnackbar } from "notistack";

interface OutwardHistoryItem {
  id: string;
  outward_date: string;
  inventory: {
    item_no: string;
    description: string;
  };
  quantity: number;
  outward_type: string;
  document_type: string;
  document_number: string;
  status: string;
  remarks: string;
}

interface OutwardHistoryProps {
  projectCode: string;
}

const OutwardHistory: React.FC<OutwardHistoryProps> = ({ projectCode }) => {
  const [history, setHistory] = useState<OutwardHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  useEffect(() => {
    if (projectCode) {
      fetchOutwardHistory();
    }
  }, [projectCode]);

  const fetchOutwardHistory = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${configuration.api_url}outward-history/${projectCode}`
      );
      setHistory(response.data);
    } catch (error) {
      console.error("Error fetching outward history:", error);
      enqueueSnackbar("Failed to fetch outward history", { variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "success";
      case "pending":
        return "warning";
      case "cancelled":
        return "error";
      default:
        return "default";
    }
  };

  return (
    <Box className="history-section" sx={{ mt: 4 }}>
      <Typography variant="h6" gutterBottom>
        Outward History
      </Typography>
      <Paper sx={{ p: 2 }}>
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Item No.</TableCell>
                <TableCell>Description</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell>Document</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Remarks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {history.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    {format(new Date(record.outward_date), "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>{record.inventory.item_no}</TableCell>
                  <TableCell>{record.inventory.description}</TableCell>
                  <TableCell align="right">{record.quantity}</TableCell>
                  <TableCell>
                    <Tooltip
                      title={`${record.document_type}: ${record.document_number}`}
                    >
                      <Chip
                        size="small"
                        label={record.document_type}
                        color="info"
                        variant="outlined"
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={record.outward_type}
                      color={
                        record.outward_type === "allocated"
                          ? "primary"
                          : "secondary"
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={record.status}
                      color={getStatusColor(record.status)}
                    />
                  </TableCell>
                  <TableCell>
                    <Tooltip title={record.remarks}>
                      <IconButton size="small">
                        <InfoOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default OutwardHistory;
