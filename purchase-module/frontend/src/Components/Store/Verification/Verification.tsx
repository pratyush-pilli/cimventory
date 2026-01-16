import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Autocomplete,
  Alert,
  Chip,
  Stepper,
  Step,
  StepLabel,
  Card,
  CardContent,
  Grid,
  Divider,
  IconButton,
  Tooltip,
  CircularProgress,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Snackbar,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Pagination,
  Backdrop,
} from "@mui/material";
import InfoIcon from "@mui/icons-material/Info";
import HistoryIcon from "@mui/icons-material/History";
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import RefreshIcon from "@mui/icons-material/Refresh";
import axios from "axios";
import configuration from "../../../configuration";
import WorkflowStepper from "../../Shared/WorkflowStepper";

interface RequisitionItem {
  id: number;
  indent_number: string;
  cimcon_part_number: string;
  material_description: string;
  material_group: string;
  make: string;
  req_qty: number;
  project_code: string;
  project_name: string;
  soh?: number;
  balance_quantity: number;
  ordering_status: string;
  unit: string;
  approval_date?: string;
  approved_by?: string;
  requisition_date?: string;
  batch_id: string;
  verification_status?: boolean;
  master_entry_exists: boolean;
  order_type?: string;
}

interface InventoryItem {
  item_no: string;
  total_stock: number;
  // ... other inventory fields
}

interface GroupedRequisitions {
  [batchId: string]: {
    verified: RequisitionItem[];
    unverified: RequisitionItem[];
  };
}

// Add this helper function to format location names
const formatLocationName = (location: string): string => {
  // Convert database field names to display names
  // e.g., "times_sq_stock" => "Times Square"
  return location
    .replace(/_stock$/, "") // Remove _stock suffix
    .split("_") // Split by underscore
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize first letter
    .join(" "); // Join with spaces
};

// Add this LoadingOverlay component at the top level, before the main component
const LoadingOverlay = ({ open, message = "Processing... Please wait" }) => (
  <Backdrop
    sx={{
      color: "#fff",
      zIndex: (theme) => theme.zIndex.drawer + 1,
      backgroundColor: "rgba(0, 0, 0, 0.7)",
    }}
    open={open}
  >
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 2,
      }}
    >
      <CircularProgress color="inherit" size={60} />
      <Typography variant="h6" color="inherit">
        {message}
      </Typography>
    </Box>
  </Backdrop>
);

const RequisitionVerification = () => {
  const [projectCodes, setProjectCodes] = useState<
    Array<{ project_code: string; client_project_name: string }>
  >([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [requisitionItems, setRequisitionItems] = useState<RequisitionItem[]>(
    []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requisitionDetails, setRequisitionDetails] = useState<any>(null);
  const [approvalHistory, setApprovalHistory] = useState<any>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [groupedRequisitions, setGroupedRequisitions] =
    useState<GroupedRequisitions>({});
  const [inventoryData, setInventoryData] = useState<{ [key: string]: number }>(
    {}
  );
  const [verificationDialog, setVerificationDialog] = useState(false);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);
  const [orderQuantities, setOrderQuantities] = useState<{
    [key: string]: number;
  }>({});
  const [selectedItems, setSelectedItems] = useState<RequisitionItem[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<{ [key: number]: boolean }>(
    {}
  );
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<{
    project_code: string;
    client_project_name: string;
  } | null>(null);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  const [locationStocks, setLocationStocks] = useState<{
    [key: string]: InventoryItem;
  }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error" | "warning" | "info";
  }>({
    open: false,
    message: "",
    severity: "info",
  });
  const [allocationHistory, setAllocationHistory] = useState([]);
  const [showAllocationHistory, setShowAllocationHistory] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [dashboardStats, setDashboardStats] = useState({
    totalPending: 0,
    totalVerified: 0,
    projectBreakdown: [],
    recentActivity: [],
  });
  const [projectPage, setProjectPage] = useState(1);
  const [projectsPerPage, setProjectsPerPage] = useState(5);
  const [totalProjectPages, setTotalProjectPages] = useState(1);
  const [apiLoading, setApiLoading] = useState<boolean>(false);
  const [verificationProgress, setVerificationProgress] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    content: React.ReactNode;
  }>({
    open: false,
    title: "",
    content: null,
  });

  // Add this computed value to combine all loading states
  const isProcessing = apiLoading || loading || isVerifying || isLoadingHistory;

  const steps = [
    "Requisition Created",
    "Pending Approval",
    "Approved",
    "Stock Verification",
  ];

  const getCurrentStep = () => {
    if (!requisitionDetails) return 0;
    if (requisitionDetails.approved_status) return 3;
    return 2;
  };

  useEffect(() => {
    fetchProjectCodes();
    fetchInventoryData();
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    if (selectedProject && Object.keys(inventoryData).length > 0) {
      fetchRequisitionDetails(selectedProject);
    }
  }, [selectedProject, inventoryData]);

  const fetchProjectCodes = async () => {
    setApiLoading(true);
    try {
      const response = await axios.get(`${configuration.api_url}projects/`);
      setProjectCodes(response.data);
    } catch (error) {
      setError("Error fetching project codes");
      console.error("Error fetching project codes:", error);
    } finally {
      setApiLoading(false);
    }
  };

  const fetchInventoryData = async () => {
    setApiLoading(true);
    try {
      const response = await axios.get(`${configuration.api_url}inventory/`);
      const inventoryMap = response.data.reduce(
        (acc: { [key: string]: number }, item: InventoryItem) => {
          acc[item.item_no] = item.total_stock;
          return acc;
        },
        {}
      );
      setInventoryData(inventoryMap);
    } catch (error) {
      console.error("Error fetching inventory data:", error);
      setError("Error fetching inventory data");
    } finally {
      setApiLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    setLoading(true);
    setApiLoading(true);
    try {
      // For now, we'll still fetch all data but add a comment about the future endpoint
      // TODO: Replace with optimized backend endpoint: `${configuration.api_url}dashboard/verification-stats/`

      // Get all project codes first
      const projectsResponse = await axios.get(
        `${configuration.api_url}projects/`
      );

      // Fetch requisition data for all projects
      const allProjectsData = await Promise.all(
        projectsResponse.data.map(async (project) => {
          try {
            const response = await axios.get(
              `${configuration.api_url}requisitions/?project_code=${project.project_code}`
            );
            return {
              project_code: project.project_code,
              project_name: project.client_project_name,
              requisitions: response.data,
            };
          } catch (error) {
            console.error(
              `Error fetching data for project ${project.project_code}:`,
              error
            );
            return {
              project_code: project.project_code,
              project_name: project.client_project_name,
              requisitions: [],
            };
          }
        })
      );

      // Process data for dashboard
      let totalPending = 0;
      let totalVerified = 0;
      const projectBreakdown = [];

      allProjectsData.forEach((project) => {
        // Filter to get only approved requisitions
        const approvedReqs = project.requisitions.filter(
          (req) => req.approved_status
        );

        // Count verified and unverified
        const verified = approvedReqs.filter(
          (req) => req.master_entry_exists
        ).length;
        const pending = approvedReqs.filter(
          (req) => !req.master_entry_exists
        ).length;

        totalVerified += verified;
        totalPending += pending;

        if (pending > 0 || verified > 0) {
          projectBreakdown.push({
            project_code: project.project_code,
            project_name: project.project_name,
            pending,
            verified,
          });
        }
      });

      // Sort by number of pending items (highest first)
      projectBreakdown.sort((a, b) => b.pending - a.pending);

      // Calculate pagination info
      const pendingProjects = projectBreakdown.filter((p) => p.pending > 0);
      setTotalProjectPages(Math.ceil(pendingProjects.length / projectsPerPage));

      // Get recent activity
      const recentActivity = allProjectsData
        .flatMap((project) =>
          project.requisitions
            .filter((req) => req.approved_status)
            .map((req) => ({
              project_code: project.project_code,
              project_name: project.project_name,
              date: req.approval_date || req.requisition_date,
              status: req.master_entry_exists
                ? "Verified"
                : "Pending Verification",
              batch_id: req.batch_id,
            }))
        )
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 5); // Show only last 5 activities

      setDashboardStats({
        totalPending,
        totalVerified,
        projectBreakdown,
        recentActivity,
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      setError("Error fetching dashboard data");
    } finally {
      setLoading(false);
      setApiLoading(false);
    }
  };

  const groupRequisitionsByVerificationStatus = (items: RequisitionItem[]) => {
    return items.reduce(
      (
        acc: {
          [key: string]: {
            verified: RequisitionItem[];
            unverified: RequisitionItem[];
          };
        },
        item
      ) => {
        if (!acc[item.batch_id]) {
          acc[item.batch_id] = { verified: [], unverified: [] };
        }

        if (item.master_entry_exists) {
          acc[item.batch_id].verified.push(item);
        } else {
          acc[item.batch_id].unverified.push(item);
        }

        return acc;
      },
      {}
    );
  };

  const fetchRequisitionDetails = async (projectCode: string) => {
    setLoading(true);
    setApiLoading(true);
    try {
      const [reqResponse, historyResponse] = await Promise.all([
        axios.get(
          `${configuration.api_url}requisitions/?project_code=${projectCode}`
        ),
        axios.get(
          `${configuration.api_url}requisition-history/?project_code=${projectCode}`
        ),
      ]);

      const requisitionsWithStock = reqResponse.data.map(
        (item: RequisitionItem) => ({
          ...item,
          soh: inventoryData[item.cimcon_part_number] || 0,
        })
      );

      // Group by both batch ID and verification status
      const grouped = groupRequisitionsByVerificationStatus(
        requisitionsWithStock.filter(
          (item: RequisitionItem) => item.approved_status
        )
      );

      setGroupedRequisitions(grouped);
      setRequisitionDetails({
        ...reqResponse.data[0],
        items: requisitionsWithStock,
      });
      setApprovalHistory(historyResponse.data);
      setError(null);
    } catch (error) {
      setError("Error fetching requisition details");
      console.error("Error:", error);
    } finally {
      setLoading(false);
      setApiLoading(false);
    }
  };

  const getStockStatus = (required: number, available?: number) => {
    if (available === undefined) return "No Stock Info";
    if (available >= required) return "Sufficient";
    if (available > 0) return "Partial";
    return "Out of Stock";
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Sufficient":
        return "success";
      case "Partial":
        return "warning";
      case "Out of Stock":
        return "error";
      default:
        return "default";
    }
  };

  const handleVerifyStock = async (batchId: string) => {
    setApiLoading(true);
    try {
      await axios.post(`${configuration.api_url}/verify-and-create-master/`, {
        batch_id: batchId,
        verified: true,
        verification_date: new Date().toISOString(),
      });

      if (selectedProject) {
        await fetchRequisitionDetails(selectedProject);
      }
    } catch (error) {
      console.error("Error verifying stock:", error);
      setError("Error updating verification status");
    } finally {
      setApiLoading(false);
    }
  };

  const handleVerifyClick = (batchId: string, items: RequisitionItem[]) => {
    setSelectedBatch(batchId);
    setSelectedItems(items);

    // Initialize all rows as selected
    const initialSelected = items.reduce(
      (acc: { [key: number]: boolean }, item) => {
        acc[item.id] = true;
        return acc;
      },
      {}
    );
    setSelectedRows(initialSelected);

    // Calculate initial order quantities and available stock
    const initialQuantities: { [key: string]: number } = {};
    items.forEach((item) => {
      const soh = item.soh || 0;
      const reqQty = item.req_qty;
      const toBeOrdered = Math.max(0, reqQty - soh);
      initialQuantities[item.id.toString()] = toBeOrdered;
    });
    setOrderQuantities(initialQuantities);

    // Fetch location stock details for allocation
    fetchLocationStockDetails(items[0].cimcon_part_number);

    setVerificationDialog(true);
  };

  const handleQuantityChange = React.useCallback((itemId: number, value: string) => {
    setOrderQuantities((prev) => {
      const nextVal = Number(value) || 0;
      if (prev[itemId] === nextVal) return prev;
      return { ...prev, [itemId]: nextVal };
    });
  }, []);

  // Memoized cell for 'To be Ordered' to prevent re-rendering all rows
  const ToBeOrderedCell = React.useMemo(() =>
    React.memo(({ id, value, max, disabled, onChange }: { id: number; value: number; max: number; disabled: boolean; onChange: (id: number, v: string) => void; }) => {
      const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = Number(e.target.value);
        const clamped = Math.max(0, Math.min(max ?? 0, isNaN(raw) ? 0 : raw));
        onChange(id, String(clamped));
      };
      return (
        <TextField
          type="number"
          size="small"
          value={value}
          onChange={handleLocalChange}
          InputProps={{ inputProps: { min: 0, max: max ?? 0 } }}
          sx={{ width: "100px" }}
          disabled={disabled}
        />
      );
    })
  , []);

  const handleVerifyConfirm = async () => {
    if (!selectedBatch || !selectedProjectDetails) return;
    setApiLoading(true);
    setVerificationProgress(0);
    setIsVerifying(true);

    try {
      const selectedItemsToVerify = selectedItems.filter(
        (item) => selectedRows[item.id]
      );

      const verificationData = {
        batch_id: selectedBatch,
        items: selectedItemsToVerify.map((item) => {
          const soh = item.soh || 0;
          const reqQty = item.req_qty;
          const balanceQty = reqQty - soh;
          const orderingQty = orderQuantities[item.id.toString()] || 0;

          return {
            id: item.id,
            project_code: selectedProjectDetails.project_code,
            project_name: selectedProjectDetails.client_project_name,
            cimcon_part_number: item.cimcon_part_number,
            material_description: item.material_description,
            material_group: item.material_group || "Default",
            make: item.make || "Default",
            required_quantity: reqQty,
            unit: item.unit || "Nos",
            indent_date:
              item.requisition_date || new Date().toISOString().split("T")[0],
            soh: soh,
            balance_quantity: balanceQty,
            ordering_qty: orderingQty > 0 ? orderingQty : 0,
            indent_number: item.indent_number || `IND-${item.id}`,
            ordering_status: "In Progress",
            order_type: item.order_type || "SUP",
            verification_status: true,
          };
        }),
        verified: true,
        verification_date: new Date().toISOString(),
      };

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setVerificationProgress((prev) => Math.min(prev + 10, 90));
      }, 500);

      const response = await axios.post(
        `${configuration.api_url}verify-and-create-master/`,
        verificationData,
        {
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      clearInterval(progressInterval);
      setVerificationProgress(100);

      // Update the status of items in the local state
      setGroupedRequisitions((prevGrouped) => {
        const updatedGrouped = { ...prevGrouped };
        if (updatedGrouped[selectedBatch]) {
          const verifiedItems = [...updatedGrouped[selectedBatch].verified];
          const remainingUnverified = updatedGrouped[
            selectedBatch
          ].unverified.filter(
            (item) =>
              !selectedItemsToVerify.some((selected) => selected.id === item.id)
          );

          selectedItemsToVerify.forEach((item) => {
            item.master_entry_exists = true;
            item.ordering_status = "Sent To Purchase";
            item.verification_status = true;
            verifiedItems.push(item);
          });

          updatedGrouped[selectedBatch] = {
            verified: verifiedItems,
            unverified: remainingUnverified,
          };
        }
        return updatedGrouped;
      });

      setSuccess(response.data.message);
      setVerificationDialog(false);
      setSnackbarOpen(true);

      if (selectedProject) {
        await fetchRequisitionDetails(selectedProject);
      }
    } catch (error) {
      console.error("Error during verification:", error);

      // Handle different types of errors
      let errorMessage = "Failed to verify stock";
      let errorDetails = [];

      if (error.response?.data?.errors) {
        // Handle validation errors from backend
        errorDetails = error.response.data.errors.map((err) => ({
          partNumber: err.part_number,
          message: err.error,
        }));
        errorMessage =
          error.response.data.message || "Verification failed for some items";
      } else if (error.response?.data?.error) {
        // Handle other backend errors
        errorMessage = error.response.data.error;
      } else {
        // Handle network or other errors
        errorMessage = error.message || "An unexpected error occurred";
      }

      // Show error in snackbar
      setSnackbar({
        open: true,
        message: errorMessage,
        severity: "error",
      });

      // If there are specific item errors, show them in a dialog
      if (errorDetails.length > 0) {
        setErrorDialog({
          open: true,
          title: "Verification Errors",
          content: (
            <Box>
              <Typography variant="subtitle1" gutterBottom>
                The following items could not be verified:
              </Typography>
              <List>
                {errorDetails.map((err, index) => (
                  <ListItem key={index}>
                    <ListItemText
                      primary={`Part Number: ${err.partNumber}`}
                      secondary={err.message}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          ),
        });
      }
    } finally {
      setIsVerifying(false);
      setApiLoading(false);
      setVerificationProgress(0);
    }
  };

  const handleProjectSelect = async (
    project: { project_code: string; client_project_name: string } | null
  ) => {
    setSelectedProject(project?.project_code || null);
    setSelectedProjectDetails(project);
    if (project) {
      await fetchRequisitionDetails(project.project_code);
    }
  };

  const fetchLocationStockDetails = async (partNumber: string) => {
    try {
      setIsLoading(true);
      // First get the inventory ID for this part number
      const inventoryResponse = await axios.get(
        `${configuration.api_url}inventory/`
      );

      const inventoryItem = inventoryResponse.data.find(
        (item: any) => item.item_no === partNumber
      );

      if (!inventoryItem) {
        // Gracefully handle no inventory: clear stocks and inform once
        setLocationStocks({} as any);
        setSnackbar({
          open: true,
          message: `No inventory found for part number: ${partNumber}`,
          severity: "info",
        });
        return;
      }

      // Now use the correct inventory ID
      const response = await axios.get(
        `${configuration.api_url}inventory/${inventoryItem.id}/location-stock/`
      );

      const stockData: LocationStockMap = response.data;
      setLocationStocks(stockData);
    } catch (error) {
      console.error("Error fetching location stock details:", error);
      setSnackbar({
        open: true,
        message: "Failed to fetch location stock details",
        severity: "error" as const,
      });
      setLocationStocks(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAllocate = React.useCallback(async (partNumber: string, allocationData) => {
    try {
      setIsLoading(true);

      // Get inventory data
      const inventoryResponse = await axios.get(
        `${configuration.api_url}inventory/`
      );
      const inventoryItem = inventoryResponse.data.find(
        (item) => item.item_no === partNumber
      );

      if (!inventoryItem) {
        throw new Error(
          `No inventory found for part number: ${items[0].cimcon_part_number}`
        );
      }

      // Send allocation request
      await axios.post(`${configuration.api_url}allocate/`, {
        inventory_id: inventoryItem.id,
        project_allocations: [
          {
            project_code: allocationData.project_code,
            location_allocations: [
              {
                location: allocationData.location,
                quantity: allocationData.quantity,
              },
            ],
          },
        ],
        remarks: allocationData.remarks,
      });

      // Show success message
      setSnackbar({
        open: true,
        message: `Successfully allocated ${
          allocationData.quantity
        } units from ${formatLocationName(
          allocationData.location
        )} to project ${allocationData.project_code}`,
        severity: "success",
      });

      // Refresh data
      await fetchLocationStockDetails(partNumber);
      await fetchAllocationHistory();
    } catch (error) {
      console.error("Allocation error:", error);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || "Error allocating stock",
        severity: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchAllocationHistory = async (inventoryId) => {
    try {
      const response = await axios.get(`${configuration.api_url}allocations/`, {
        params: {
          inventory_id: inventoryId,
        },
      });

      setAllocationHistory(response.data);

      if (response.data.length === 0) {
        setSnackbar({
          open: true,
          message: "No allocation history found for this item",
          severity: "info",
        });
      }
    } catch (error) {
      console.error("Error fetching allocation history:", error);
      setSnackbar({
        open: true,
        message: "Failed to fetch allocation history",
        severity: "error",
      });
    }
  };

  const AllocationSection = React.useMemo(() =>
    React.memo(({ item, locationStocks, onAllocate, onShowHistory }: any) => {
      const [allocationData, setAllocationData] = useState({
        project_code: item.project_code,
        location: "",
        quantity: 0,
        remarks: "",
      });

      return (
        <Box sx={{ mb: 2, p: 2, bgcolor: "#f5f5f5", borderRadius: 1 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Item: {item.cimcon_part_number}
            </Typography>
            <Typography variant="body2">{item.material_description}</Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="subtitle2" color="text.secondary">
              Required: {item.req_qty} {item.unit || "units"}
            </Typography>
            <Typography variant="body2">
              SOH: {item.soh || 0} | Balance: {item.balance_quantity}
            </Typography>
          </Grid>
        </Grid>
        <Box sx={{ mt: 2 }}>
          <Typography variant="subtitle2" color="text.secondary">
            Current Stock Status:
          </Typography>
          <Box sx={{ mt: 1, display: "flex", flexWrap: "wrap", gap: 1 }}>
            {locationStocks &&
              Object.entries(locationStocks).map(([location, stock]) => (
                <Chip
                  key={location}
                  label={`${formatLocationName(location)}: ${stock.available}/${
                    stock.total
                  } Available`}
                  size="small"
                  color={stock.available > 0 ? "success" : "default"}
                />
              ))}
          </Box>
        </Box>

        {/* Add allocation form controls */}
        <Box component="form" sx={{ mt: 3 }}>
          <Typography variant="subtitle2" gutterBottom>
            Allocate Stock
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Project Code"
                value={allocationData.project_code}
                onChange={(e) =>
                  setAllocationData((prev) => ({
                    ...prev,
                    project_code: e.target.value,
                  }))
                }
                fullWidth
                size="small"
                disabled // Project code is fixed to the item's project
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl fullWidth size="small">
                <InputLabel>Location</InputLabel>
                <Select
                  value={allocationData.location}
                  label="Location"
                  onChange={(e) =>
                    setAllocationData((prev) => ({
                      ...prev,
                      location: e.target.value,
                    }))
                  }
                >
                  {locationStocks &&
                    Object.entries(locationStocks).map(([location, stock]) => (
                      <MenuItem
                        key={location}
                        value={location}
                        disabled={stock.available <= 0}
                      >
                        {formatLocationName(location)} ({stock.available}{" "}
                        available)
                      </MenuItem>
                    ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Quantity"
                type="number"
                size="small"
                fullWidth
                value={allocationData.quantity}
                onChange={(e) =>
                  setAllocationData((prev) => ({
                    ...prev,
                    quantity: Number(e.target.value),
                  }))
                }
                InputProps={{
                  inputProps: {
                    min: 1,
                    max:
                      locationStocks &&
                      allocationData.location &&
                      locationStocks[allocationData.location]
                        ? locationStocks[allocationData.location].available
                        : 0,
                  },
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                label="Remarks"
                size="small"
                fullWidth
                value={allocationData.remarks}
                onChange={(e) =>
                  setAllocationData((prev) => ({
                    ...prev,
                    remarks: e.target.value,
                  }))
                }
                placeholder="Add any notes about this allocation"
              />
            </Grid>
            <Grid item xs={12}>
              <Box sx={{ display: "flex", gap: 2 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => onAllocate(item.cimcon_part_number, allocationData)}
                  disabled={
                    !allocationData.location ||
                    allocationData.quantity <= 0 ||
                    !locationStocks ||
                    !locationStocks[allocationData.location] ||
                    allocationData.quantity >
                      locationStocks[allocationData.location].available
                  }
                >
                  Allocate Stock
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  onClick={onShowHistory}
                  startIcon={<HistoryIcon />}
                >
                  Show Allocation History
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
      );
    })
  , []);

  const VerificationDialog = ({
    open,
    onClose,
    items,
    batchId,
    locationStocks,
  }) => {
    const handleShowHistory = React.useCallback(() => {
      // If already showing, just hide it immediately without triggering more fetches
      if (showAllocationHistory) {
        setShowAllocationHistory(false);
        return;
      }

      // Only fetch if we're showing it for the first time
      setIsLoadingHistory(true);
      setShowAllocationHistory(true); // Set to true immediately to prevent flickering

      // Then fetch data asynchronously
      fetchAllocationHistory().finally(() => {
        setIsLoadingHistory(false);
      });
    }, [showAllocationHistory]);

    const fetchAllocationHistory = async () => {
      if (!items || !items.length) return;

      try {
        const inventoryResponse = await axios.get(
          `${configuration.api_url}inventory/`
        );
        const inventoryItem = inventoryResponse.data.find(
          (item) => item.item_no === items[0].cimcon_part_number
        );

        if (!inventoryItem) {
          setSnackbar({
            open: true,
            message: `Could not find inventory for ${items[0].cimcon_part_number}`,
            severity: "error",
          });
          return;
        }

        const historyResponse = await axios.get(
          `${configuration.api_url}allocations/`,
          {
            params: {
              inventory_id: inventoryItem.id,
            },
          }
        );

        setAllocationHistory(historyResponse.data);

        if (historyResponse.data.length === 0) {
          setSnackbar({
            open: true,
            message: "No allocation history found for this item",
            severity: "info",
          });
        }
      } catch (error) {
        console.error("Error fetching allocation history:", error);
        setSnackbar({
          open: true,
          message: "Failed to fetch allocation history",
          severity: "error",
        });
      }
    };

    const handleAllocate = async (allocationData) => {
      try {
        setIsLoading(true);

        // Get inventory data
        const inventoryResponse = await axios.get(
          `${configuration.api_url}inventory/`
        );
        const inventoryItem = inventoryResponse.data.find(
          (item) => item.item_no === items[0].cimcon_part_number
        );

        if (!inventoryItem) {
          throw new Error(
            `No inventory found for part number: ${items[0].cimcon_part_number}`
          );
        }

        // Send allocation request
        await axios.post(`${configuration.api_url}allocate/`, {
          inventory_id: inventoryItem.id,
          project_allocations: [
            {
              project_code: allocationData.project_code,
              location_allocations: [
                {
                  location: allocationData.location,
                  quantity: allocationData.quantity,
                },
              ],
            },
          ],
          remarks: allocationData.remarks,
        });

        // Show success message
        setSnackbar({
          open: true,
          message: `Successfully allocated ${
            allocationData.quantity
          } units from ${formatLocationName(
            allocationData.location
          )} to project ${allocationData.project_code}`,
          severity: "success",
        });

        // Refresh data
        await fetchLocationStockDetails(items[0].cimcon_part_number);
        await fetchAllocationHistory();
      } catch (error) {
        console.error("Allocation error:", error);
        setSnackbar({
          open: true,
          message: error.response?.data?.message || "Error allocating stock",
          severity: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Verify and Allocate Stock
          {batchId && (
            <Typography variant="subtitle2" component="div" color="text.secondary">
              Batch ID: {batchId}
            </Typography>
          )}
        </DialogTitle>
        <DialogContent>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      checked={items.every((item) => selectedRows[item.id])}
                      indeterminate={
                        items.some((item) => selectedRows[item.id]) &&
                        !items.every((item) => selectedRows[item.id])
                      }
                      onChange={(event) => {
                        const newSelected = items.reduce(
                          (acc: { [key: number]: boolean }, item) => {
                            acc[item.id] = event.target.checked;
                            return acc;
                          },
                          {}
                        );
                        setSelectedRows(newSelected);
                      }}
                    />
                  </TableCell>
                  <TableCell>Part Number</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Material Group</TableCell>
                  <TableCell>Make</TableCell>
                  <TableCell align="right">Required Qty</TableCell>
                  <TableCell align="right">Stock on Hand</TableCell>
                  <TableCell align="right">To be Ordered</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedRows[item.id] || false}
                        onChange={(event) =>
                          setSelectedRows((prev) => ({
                            ...prev,
                            [item.id]: event.target.checked,
                          }))
                        }
                      />
                    </TableCell>
                    <TableCell>{item.cimcon_part_number}</TableCell>
                    <TableCell>{item.material_description}</TableCell>
                    <TableCell>{item.material_group}</TableCell>
                    <TableCell>{item.make}</TableCell>
                    <TableCell align="right">{item.req_qty}</TableCell>
                    <TableCell align="right">{item.soh || 0}</TableCell>
                    <TableCell>
                      <ToBeOrderedCell
                        id={item.id}
                        value={orderQuantities[item.id] || 0}
                        max={Math.max(0, (item.req_qty || 0) - (item.soh || 0))}
                        disabled={!selectedRows[item.id]}
                        onChange={handleQuantityChange}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>

          {/* Add Allocation Section for each item */}
          {items.map((item) => (
            <Box key={item.id} sx={{ mt: 3, mb: 3 }}>
              <Typography variant="h6" gutterBottom>
                Stock Allocation for {item.cimcon_part_number}
              </Typography>
              <AllocationSection
                item={item}
                locationStocks={locationStocks}
                onAllocate={handleAllocate}
                onShowHistory={handleShowHistory}
              />
            </Box>
          ))}

          {/* Show allocation history if enabled */}
          {showAllocationHistory && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="h6" gutterBottom>
                Allocation History
              </Typography>
              <AllocationHistorySection allocationHistory={allocationHistory} />
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleVerifyConfirm}
            variant="contained"
            color="primary"
            disabled={isVerifying}
          >
            {isVerifying ? "Verifying..." : "Verify and Complete"}
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const AllocationHistorySection = ({ allocationHistory }) => {
    if (!allocationHistory || allocationHistory.length === 0) {
      return (
        <Box sx={{ mt: 2, p: 2, bgcolor: "#f9f9f9", borderRadius: 1 }}>
          <Typography variant="body2" color="text.secondary">
            No allocation history found for this item.
          </Typography>
        </Box>
      );
    }

    return (
      <Box sx={{ mt: 2 }}>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Project</TableCell>
                <TableCell>Location</TableCell>
                <TableCell align="right">Quantity</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Remarks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {allocationHistory.map((allocation) => (
                <TableRow key={allocation.id}>
                  <TableCell>
                    {allocation.project_code?.code || "N/A"}
                  </TableCell>
                  <TableCell>
                    {allocation.location_allocations &&
                    allocation.location_allocations.length > 0
                      ? allocation.location_allocations
                          .map(
                            (loc) =>
                              `${formatLocationName(loc.location)}: ${
                                loc.quantity
                              }`
                          )
                          .join(", ")
                      : "N/A"}
                  </TableCell>
                  <TableCell align="right">
                    {allocation.allocated_quantity}
                  </TableCell>
                  <TableCell>
                    {new Date(allocation.allocation_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={allocation.status}
                      color={
                        allocation.status === "allocated"
                          ? "success"
                          : allocation.status === "partially_outward"
                          ? "warning"
                          : "default"
                      }
                    />
                  </TableCell>
                  <TableCell>{allocation.remarks}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    );
  };

  const DashboardSummary = () => {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="h5" gutterBottom>
          Requisition Verification Dashboard
        </Typography>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#e3f2fd", height: "100%" }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Total Pending Verifications
                </Typography>
                <Typography variant="h3" component="div">
                  {dashboardStats.totalPending}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Awaiting stock verification
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#e8f5e9", height: "100%" }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Verified Requisitions
                </Typography>
                <Typography variant="h3" component="div">
                  {dashboardStats.totalVerified}
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Successfully processed
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#fff8e1", height: "100%" }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Projects with Pending Items
                </Typography>
                <Typography variant="h3" component="div">
                  {
                    dashboardStats.projectBreakdown.filter((p) => p.pending > 0)
                      .length
                  }
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Projects needing attention
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={6} md={3}>
            <Card sx={{ bgcolor: "#f3e5f5", height: "100%" }}>
              <CardContent>
                <Typography color="textSecondary" gutterBottom>
                  Completion Rate
                </Typography>
                <Typography variant="h3" component="div">
                  {dashboardStats.totalPending + dashboardStats.totalVerified >
                  0
                    ? Math.round(
                        (dashboardStats.totalVerified /
                          (dashboardStats.totalPending +
                            dashboardStats.totalVerified)) *
                          100
                      )
                    : 0}
                  %
                </Typography>
                <Typography variant="body2" sx={{ mt: 1 }}>
                  Overall verification rate
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* Project Breakdown */}
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2,
              }}
            >
              <Typography variant="h6">
                Projects with Pending Verifications
              </Typography>
              <FormControl
                variant="outlined"
                size="small"
                sx={{ minWidth: 120 }}
              >
                <InputLabel id="rows-per-page-label">Rows</InputLabel>
                <Select
                  labelId="rows-per-page-label"
                  value={projectsPerPage}
                  onChange={(e) => {
                    setProjectsPerPage(Number(e.target.value));
                    setProjectPage(1); // Reset to first page when changing page size
                  }}
                  label="Rows"
                >
                  <MenuItem value={5}>5</MenuItem>
                  <MenuItem value={10}>10</MenuItem>
                  <MenuItem value={25}>25</MenuItem>
                  <MenuItem value={50}>50</MenuItem>
                </Select>
              </FormControl>
            </Box>

            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Project Code</TableCell>
                    <TableCell>Project Name</TableCell>
                    <TableCell align="right">Pending</TableCell>
                    <TableCell align="right">Verified</TableCell>
                    <TableCell align="right">Progress</TableCell>
                    <TableCell>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {dashboardStats.projectBreakdown
                    .filter((project) => project.pending > 0)
                    .slice(
                      (projectPage - 1) * projectsPerPage,
                      projectPage * projectsPerPage
                    )
                    .map((project) => (
                      <TableRow key={`${project.project_code}-${project.pending}-${project.verified}` }>
                        <TableCell>{project.project_code}</TableCell>
                        <TableCell>{project.project_name}</TableCell>
                        <TableCell align="right">
                          <Chip
                            label={project.pending}
                            color="warning"
                            size="small"
                            sx={{ fontWeight: "bold" }}
                          />
                        </TableCell>
                        <TableCell align="right">{project.verified}</TableCell>
                        <TableCell align="right">
                          <Box sx={{ display: "flex", alignItems: "center" }}>
                            <Box sx={{ width: "100%", mr: 1 }}>
                              <LinearProgress
                                variant="determinate"
                                value={Math.round(
                                  (project.verified /
                                    (project.pending + project.verified)) *
                                    100
                                )}
                                sx={{ height: 8, borderRadius: 5 }}
                              />
                            </Box>
                            <Box sx={{ minWidth: 35 }}>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                              >
                                {Math.round(
                                  (project.verified /
                                    (project.pending + project.verified)) *
                                    100
                                )}
                                %
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Button
                            size="small"
                            variant="outlined"
                            onClick={() => {
                              const project = projectCodes.find(
                                (p) => p.project_code === project.project_code
                              );
                              if (project) {
                                handleProjectSelect(project);
                              }
                            }}
                          >
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </TableContainer>

            {dashboardStats.projectBreakdown.filter((p) => p.pending > 0)
              .length === 0 && (
              <Box sx={{ p: 2, textAlign: "center" }}>
                <Typography color="textSecondary">
                  No pending verifications found
                </Typography>
              </Box>
            )}

            {/* Pagination controls */}
            {dashboardStats.projectBreakdown.filter((p) => p.pending > 0)
              .length > projectsPerPage && (
              <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
                <Pagination
                  count={totalProjectPages}
                  page={projectPage}
                  onChange={(event, newPage) => setProjectPage(newPage)}
                  color="primary"
                  size="small"
                />
              </Box>
            )}

            {/* Show stats about results */}
            <Box sx={{ mt: 1, display: "flex", justifyContent: "flex-end" }}>
              <Typography variant="caption" color="text.secondary">
                Showing{" "}
                {Math.min(
                  projectsPerPage,
                  dashboardStats.projectBreakdown.filter((p) => p.pending > 0)
                    .length
                )}{" "}
                of{" "}
                {
                  dashboardStats.projectBreakdown.filter((p) => p.pending > 0)
                    .length
                }{" "}
                projects
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Activity
            </Typography>

            <List>
              {dashboardStats.recentActivity.map((activity, index) => (
                <React.Fragment key={index}>
                  <ListItem alignItems="flex-start">
                    <ListItemIcon>
                      {activity.status === "Verified" ? (
                        <AssignmentTurnedInIcon color="success" />
                      ) : (
                        <InfoIcon color="warning" />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={`${activity.project_code} - Batch ID: ${activity.batch_id}`}
                      secondary={
                        <React.Fragment>
                          <Typography
                            sx={{ display: "inline" }}
                            component="span"
                            variant="body2"
                            color="text.primary"
                          >
                            {activity.project_name}
                          </Typography>
                          {` — ${activity.status} on ${new Date(
                            activity.date
                          ).toLocaleDateString()}`}
                        </React.Fragment>
                      }
                    />
                    <Button
                      size="small"
                      onClick={() => {
                        const project = projectCodes.find(
                          (p) => p.project_code === activity.project_code
                        );
                        if (project) {
                          handleProjectSelect(project);
                        }
                      }}
                    >
                      View
                    </Button>
                  </ListItem>
                  {index < dashboardStats.recentActivity.length - 1 && (
                    <Divider variant="inset" component="li" />
                  )}
                </React.Fragment>
              ))}

              {dashboardStats.recentActivity.length === 0 && (
                <Box sx={{ p: 2, textAlign: "center" }}>
                  <Typography color="textSecondary">
                    No recent activity found
                  </Typography>
                </Box>
              )}
            </List>
          </CardContent>
        </Card>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Replace the existing Backdrop with the new LoadingOverlay */}
      <LoadingOverlay
        open={isProcessing}
        message={
          isVerifying ? "Verifying items..." : "Processing... Please wait"
        }
      />

      <WorkflowStepper
        activeStep={getCurrentStep()}
        requisitionDate={requisitionDetails?.requisition_date}
        approvalDate={requisitionDetails?.approval_date}
        verificationDate={requisitionDetails?.verification_date}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Autocomplete
                options={projectCodes}
                getOptionLabel={(option) =>
                  `${option.project_code} - ${option.client_project_name}`
                }
                onChange={(_, newValue) => handleProjectSelect(newValue)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Search Project Code"
                    variant="outlined"
                    size="small"
                  />
                )}
              />
            </Grid>
            <Grid
              item
              xs={12}
              md={6}
              sx={{
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "center",
              }}
            >
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={fetchDashboardStats}
                disabled={loading}
              >
                Refresh Data
              </Button>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
          <CircularProgress />
        </Box>
      ) : selectedProject ? (
        Object.entries(groupedRequisitions).map(
          ([batchId, { verified, unverified }]) => (
            <React.Fragment key={batchId}>
              {/* Render unverified items card if any exist */}
              {unverified.length > 0 && (
                <Card sx={{ mb: 3 }}>
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        mb: 2,
                      }}
                    >
                      <Box>
                        <Typography variant="h6">
                          Batch ID: {batchId} (Pending Verification)
                        </Typography>
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                          <Grid item>
                            <Typography variant="body2" color="text.secondary">
                              Requisition Date
                            </Typography>
                            <Typography variant="body1">
                              {unverified[0]?.requisition_date || "N/A"}
                            </Typography>
                          </Grid>
                          <Grid item>
                            <Typography variant="body2" color="text.secondary">
                              Approval Date
                            </Typography>
                            <Typography variant="body1">
                              {unverified[0]?.approval_date || "N/A"}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                      <Button
                        variant="contained"
                        color="primary"
                        size="small"
                        onClick={() => handleVerifyClick(batchId, unverified)}
                        startIcon={<AssignmentTurnedInIcon />}
                        sx={{
                          minWidth: "120px",
                          height: "36px",
                          textTransform: "none",
                          borderRadius: "18px",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                        }}
                      >
                        Verify Stock
                      </Button>
                    </Box>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Order Type</TableCell>
                            <TableCell>Part Number</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Material Group</TableCell>
                            <TableCell>Make</TableCell>
                            <TableCell align="right">Required Qty</TableCell>
                            <TableCell align="right">Stock on Hand</TableCell>
                            <TableCell align="right">Balance Qty</TableCell>
                            <TableCell>Unit</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {unverified.map((item) => {
                            const stockStatus =
                              item.ordering_status === "Sent To Purchase"
                                ? "Sent To Purchase"
                                : getStockStatus(item.req_qty, item.soh);
                            const isExpanded = expandedRow === item.id;

                            return (
                              <React.Fragment key={item.id}>
                                <TableRow
                                  onClick={() =>
                                    setExpandedRow(isExpanded ? null : item.id)
                                  }
                                  sx={{ cursor: "pointer" }}
                                >
                                  <TableCell>{item.order_type}</TableCell>
                                  <TableCell>
                                    {item.cimcon_part_number}
                                  </TableCell>
                                  <TableCell>
                                    {item.material_description}
                                  </TableCell>
                                  <TableCell>{item.material_group}</TableCell>
                                  <TableCell>{item.make}</TableCell>
                                  <TableCell align="right">
                                    {item.req_qty}
                                  </TableCell>
                                  <TableCell align="right">
                                    {item.soh?.toLocaleString() || "N/A"}
                                  </TableCell>
                                  <TableCell align="right">
                                    {item.balance_quantity}
                                  </TableCell>
                                  <TableCell>{item.unit}</TableCell>
                                  <TableCell>
                                    <Chip
                                      label={stockStatus}
                                      color={getStatusColor(stockStatus) as any}
                                      size="small"
                                    />
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow>
                                    <TableCell
                                      colSpan={8}
                                      sx={{ backgroundColor: "#f9f9f9" }}
                                    >
                                      <Box sx={{ padding: 2 }}>
                                        <Typography
                                          variant="body2"
                                          fontWeight="bold"
                                        >
                                          Details:
                                        </Typography>
                                        <Typography variant="body2">
                                          Ordering Status:{" "}
                                          {item.ordering_status}
                                        </Typography>
                                        <Typography variant="body2">
                                          Required Quantity: {item.req_qty}
                                        </Typography>
                                        <Typography variant="body2">
                                          Stock on Hand: {item.soh}
                                        </Typography>
                                        {/* Add more details as needed */}
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}

              {/* Render verified items card if any exist */}
              {verified.length > 0 && (
                <Card sx={{ mb: 3, backgroundColor: "#f8f9fa" }}>
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        mb: 2,
                      }}
                    >
                      <Box>
                        <Typography variant="h6">
                          Batch ID: {batchId} (Verified)
                        </Typography>
                        <Grid container spacing={2} sx={{ mt: 1 }}>
                          <Grid item>
                            <Typography variant="body2" color="text.secondary">
                              Requisition Date
                            </Typography>
                            <Typography variant="body1">
                              {verified[0]?.requisition_date || "N/A"}
                            </Typography>
                          </Grid>
                          <Grid item>
                            <Typography variant="body2" color="text.secondary">
                              Approval Date
                            </Typography>
                            <Typography variant="body1">
                              {verified[0]?.approval_date || "N/A"}
                            </Typography>
                          </Grid>
                        </Grid>
                      </Box>
                      <Chip
                        label="Verified"
                        color="success"
                        icon={<AssignmentTurnedInIcon />}
                      />
                    </Box>
                    <TableContainer>
                      <Table>
                        <TableHead>
                          <TableRow>
                            <TableCell>Order Type</TableCell>
                            <TableCell>Part Number</TableCell>
                            <TableCell>Description</TableCell>
                            <TableCell>Material Group</TableCell>
                            <TableCell>Make</TableCell>
                            <TableCell align="right">Required Qty</TableCell>
                            <TableCell align="right">Stock on Hand</TableCell>
                            <TableCell align="right">Balance Qty</TableCell>
                            <TableCell>Unit</TableCell>
                            <TableCell>Status</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {verified.map((item) => {
                            const stockStatus =
                              item.ordering_status === "Sent To Purchase"
                                ? "Sent To Purchase"
                                : getStockStatus(item.req_qty, item.soh);
                            const isExpanded = expandedRow === item.id;

                            return (
                              <React.Fragment key={item.id}>
                                <TableRow
                                  onClick={() =>
                                    setExpandedRow(isExpanded ? null : item.id)
                                  }
                                  sx={{ cursor: "pointer" }}
                                >
                                  <TableCell>{item.order_type}</TableCell>
                                  <TableCell>
                                    {item.cimcon_part_number}
                                  </TableCell>
                                  <TableCell>
                                    {item.material_description}
                                  </TableCell>
                                  <TableCell>{item.material_group}</TableCell>
                                  <TableCell>{item.make}</TableCell>
                                  <TableCell align="right">
                                    {item.req_qty}
                                  </TableCell>
                                  <TableCell align="right">
                                    {item.soh?.toLocaleString() || "N/A"}
                                  </TableCell>
                                  <TableCell align="right">
                                    {item.balance_quantity}
                                  </TableCell>
                                  <TableCell>{item.unit}</TableCell>
                                  <TableCell>
                                    <Chip
                                      label={stockStatus}
                                      color={getStatusColor(stockStatus) as any}
                                      size="small"
                                    />
                                  </TableCell>
                                </TableRow>
                                {isExpanded && (
                                  <TableRow>
                                    <TableCell
                                      colSpan={8}
                                      sx={{ backgroundColor: "#f9f9f9" }}
                                    >
                                      <Box sx={{ padding: 2 }}>
                                        <Typography
                                          variant="body2"
                                          fontWeight="bold"
                                        >
                                          Details:
                                        </Typography>
                                        <Typography variant="body2">
                                          Ordering Status:{" "}
                                          {item.ordering_status}
                                        </Typography>
                                        <Typography variant="body2">
                                          Required Quantity: {item.req_qty}
                                        </Typography>
                                        <Typography variant="body2">
                                          Stock on Hand: {item.soh}
                                        </Typography>
                                        {/* Add more details as needed */}
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </CardContent>
                </Card>
              )}
            </React.Fragment>
          )
        )
      ) : (
        <DashboardSummary />
      )}

      {/* Verification Dialog */}
      <VerificationDialog
        open={verificationDialog}
        onClose={() => setVerificationDialog(false)}
        items={selectedItems}
        batchId={selectedBatch}
        locationStocks={locationStocks}
      />

      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
          severity={snackbar.severity}
          sx={{ width: "100%" }}
        >
          typeof snackbar.message === "string" ? snackbar.message : "An error
          occurred"
        </Alert>
      </Snackbar>

      <Dialog
        open={errorDialog.open}
        onClose={() => setErrorDialog((prev) => ({ ...prev, open: false }))}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>{errorDialog.title}</DialogTitle>
        <DialogContent>{errorDialog.content}</DialogContent>
        <DialogActions>
          <Button
            onClick={() => setErrorDialog((prev) => ({ ...prev, open: false }))}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default RequisitionVerification;
