import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Snackbar,
  Alert,
  Tooltip,
  Grid,
  Checkbox,
  Badge,
  Chip,
  CircularProgress,
  Divider,
  Stack,
  TablePagination,
  InputAdornment,
  FormHelperText,
} from "@mui/material";
import {
  Timeline,
  TimelineItem,
  TimelineContent,
  TimelineSeparator,
  TimelineDot,
} from "@mui/lab";
import axios from "axios";
import configuration from "../../../configuration";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import SearchIcon from "@mui/icons-material/Search";

interface LocationStock {
  total: number;
  allocated: number;
  available: number;
  allocations: Array<{
    project_code: string;
    quantity: number;
  }>;
}

interface LocationStockMap {
  times_square: LocationStock;
  i_square: LocationStock;
  sakar: LocationStock;
  pirana: LocationStock;
  other: LocationStock;
}

interface ProjectRequirement {
  project_code: string;
  client_project_name: string;
  client_name: string;
  required_quantity: number;
  allocated_quantity: number;
  pending_quantity: number;
  priority_level: "Critical" | "High" | "Medium" | "Low";
  priority_reason?: string;
  days_remaining: number;
  required_by_date: string;
  is_critical: boolean;
  project_status: "Active" | "Delayed" | "On Hold";
  allocation_history?: {
    date: string;
    quantity: number;
    location: string;
  }[];
}

interface AllocationHistory {
  date: string;
  from_location: string;
  to_project: string;
  quantity: number;
  // allocated_by: string;
  remarks: string;
  is_partial: boolean;
}

interface PartialAllocation {
  project_code: string;
  requested_quantity: number;
  allocated_quantity: number;
  remaining_quantity: number;
  partial_allocation_reason?: string;
}

interface ProjectAllocation {
  [location: string]: number;
}

interface AllocationData {
  projectAllocations: {
    [projectCode: string]: ProjectAllocation;
  };
  remarks: string;
}

interface AllocationRequest {
  inventory_id: number;
  project_code: string;
  location_allocations: {
    location: string;
    quantity: number;
  }[];
  remarks: string;
  is_partial: boolean;
}

interface ReallocationDetails {
  parent_allocation_id?: number;
  reallocation_date?: string;
  reallocation_reason?: string;
}

interface AllocationStatus extends ReallocationDetails {
  project_code: string;
  location: string;
  allocated_quantity: number;
  allocation_date: string;
  can_reallocate: boolean;
}

interface ReallocationData {
  from_project: string;
  to_project: string;
  quantity: number;
  location: string;
  remarks: string;
  reallocation_reason?: string;
}

const Allocate = () => {
  const [inventory, setInventory] = useState([]);
  const [allocations, setAllocations] = useState([]);
  const [projectCodes, setProjectCodes] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [allocationData, setAllocationData] = useState<AllocationData>({
    projectAllocations: {},
    remarks: "",
  });
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: "",
    severity: "success",
  });

  const [showReallocations, setShowReallocations] = useState(false);
  const [isReallocation, setIsReallocation] = useState(false);
  const [selectedAllocation, setSelectedAllocation] = useState(null);
  const [locationStocks, setLocationStocks] = useState<LocationStockMap | null>(
    null
  );
  const [locationQuantities, setLocationQuantities] = useState<{
    [key: string]: number;
  }>({});

  const [projectRequirements, setProjectRequirements] = useState<
    ProjectRequirement[]
  >([]);

  const [allocationHistory, setAllocationHistory] = useState<
    AllocationHistory[]
  >([]);

  const [partialAllocations, setPartialAllocations] = useState<
    PartialAllocation[]
  >([]);

  const [showAllocationHistory, setShowAllocationHistory] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredInventory, setFilteredInventory] = useState([]);

  const [showReallocationDialog, setShowReallocationDialog] = useState(false);
  const [
    selectedAllocationForReallocation,
    setSelectedAllocationForReallocation,
  ] = useState<AllocationStatus | null>(null);

  useEffect(() => {
    fetchInventory();
    fetchAllocations();
    fetchProjectCodes();
  }, []);

  useEffect(() => {
    if (inventory.length > 0) {
      const filtered = inventory.filter(
        (item) =>
          item.item_no.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.make.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredInventory(filtered);
    }
  }, [inventory, searchQuery]);

  const fetchInventory = async () => {
    try {
      const response = await axios.get(`${configuration.api_url}inventory/`);
      const inventoryData = response.data;

      // Fetch project requirements for each item
      const inventoryWithRequirements = await Promise.all(
        inventoryData.map(async (item) => {
          try {
            const reqResponse = await axios.get(
              `${configuration.api_url}project-requirements/item/${item.item_no}/`
            );
            return {
              ...item,
              project_requirements: reqResponse.data,
            };
          } catch (error) {
            console.error(
              `Error fetching requirements for ${item.item_no}:`,
              error
            );
            return {
              ...item,
              project_requirements: [],
            };
          }
        })
      );

      setInventory(inventoryWithRequirements);
    } catch (error) {
      console.error("Error fetching inventory:", error);
      setSnackbar({
        open: true,
        message: "Failed to fetch inventory data",
        severity: "error",
      });
    }
  };

  const fetchAllocations = async () => {
    try {
      const response = await axios.get(`${configuration.api_url}allocations/`);
      setAllocations(response.data);
      console.log("Fetch Allocations:", response.data);
    } catch (error) {
      console.error("Error fetching allocations:", error);
    }
  };

  const fetchProjectCodes = async () => {
    try {
      const response = await axios.get(`${configuration.api_url}projects/`);
      setProjectCodes(response.data);
    } catch (error) {
      console.error("Error fetching project codes:", error);
    }
  };

  const fetchLocationStockDetails = async (inventoryId: number) => {
    try {
      setIsLoading(true);
      const response = await axios.get(
        `${configuration.api_url}inventory/${inventoryId}/location-stock/`
      );

      // Ensure we're getting the correct data structure
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

  const fetchProjectRequirements = async (itemNo: string) => {
    try {
      const response = await axios.get(
        `${configuration.api_url}project-requirements/item/${itemNo}/`
      );
      setProjectRequirements(response.data);
      console.log("Fetch Project Requirements", response.data);
    } catch (error) {
      console.error("Error fetching project requirements:", error);
      setSnackbar({
        open: true,
        message: "Failed to fetch project requirements",
        severity: "error",
      });
    }
  };

  const fetchAllocationHistory = async (itemNo: string) => {
    try {
      const response = await axios.get(
        `${configuration.api_url}allocation-history/${itemNo}/`
      );
      setAllocationHistory(response.data);
    } catch (error) {
      console.error("Error fetching allocation history:", error);
    }
  };

  const validateAllocation = () => {
    if (!allocationData.remarks.trim()) {
      return {
        isValid: false,
        message: "Please add remarks for the allocation",
      };
    }

    let hasAnyAllocation = false;
    for (const [projectCode, allocations] of Object.entries(
      allocationData.projectAllocations
    )) {
      const projectTotal = Object.values(allocations).reduce(
        (sum, qty) => sum + Number(qty),
        0
      );

      if (projectTotal > 0) {
        hasAnyAllocation = true;
      }

      const requirement = projectRequirements.find(
        (req) => req.project_code === projectCode
      );
      if (requirement && projectTotal > requirement.pending_quantity) {
        return {
          isValid: false,
          message: `Allocation for project ${projectCode} exceeds pending quantity`,
        };
      }
    }

    return {
      isValid: hasAnyAllocation,
      message: hasAnyAllocation
        ? ""
        : "Please allocate quantity to at least one project",
    };
  };

  const handleAllocate = async () => {
    try {
      setIsLoading(true);

      const validation = validateAllocation();
      if (!validation.isValid) {
        setSnackbar({
          open: true,
          message: validation.message,
          severity: "error",
        });
        setIsLoading(false);
        return;
      }

      // Transform the allocation data into the correct structure
      const transformedAllocations = Object.entries(
        allocationData.projectAllocations
      )
        .map(([projectCode, locationAllocations]) => {
          // Convert the location allocations object into an array of location details
          const locationAllocs = Object.entries(locationAllocations)
            .filter(([_, quantity]) => quantity > 0)
            .map(([location, quantity]) => ({
              location: location,
              quantity: Number(quantity),
            }));

          return {
            project_code: projectCode,
            location_allocations: locationAllocs,
          };
        })
        .filter((item) => item.location_allocations.length > 0);

      const requestData = {
        inventory_id: Number(selectedItem.id),
        project_allocations: transformedAllocations,
        remarks: allocationData.remarks,
        allocation_date: new Date().toISOString(),
        // allocated_by: "current_user",
      };

      console.log("Sending allocation request:", requestData); // Debug log

      const response = await axios.post(
        `${configuration.api_url}allocate/`,
        requestData
      );

      setSnackbar({
        open: true,
        message: "Stock allocated successfully",
        severity: "success",
      });

      setOpenDialog(false);
      resetAllocationData();

      // Refresh the inventory data
      await fetchInventory();
    } catch (error) {
      console.error("Error allocating stock:", error);
      console.error("Server response:", error.response?.data);
      setSnackbar({
        open: true,
        message: error.response?.data?.message || "Error allocating stock",
        severity: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Add a utility function to convert display format back to backend format
  const formatLocationForBackend = (displayLocation: string): string => {
    // First convert to lowercase and remove any extra spaces
    const normalized = displayLocation.toLowerCase().trim();

    // Handle special cases first
    if (normalized === "pirana") return "pirana_stock";
    if (normalized === "times square") return "times_square_stock";
    if (normalized === "iSquare") return "i_square_stock";
    if (normalized === "sakar") return "sakar_stock";
    if (normalized === "other") return "other_stock";

    // If none of the special cases match, use the default formatting
    return normalized.replace(/\s+/g, "_") + "_stock";
  };

  const handleAllocateClick = async (item) => {
    try {
      setIsLoading(true);
      setSelectedItem(item);

      // Wait for all data to be fetched before opening dialog
      await Promise.all([
        fetchLocationStockDetails(item.id),
        fetchProjectRequirements(item.item_no),
        fetchAllocationHistory(item.item_no).catch(() => {
          // If allocation history fails, we can still continue
          console.warn("Failed to fetch allocation history");
          setAllocationHistory([]);
        }),
      ]);

      setOpenDialog(true);
    } catch (error) {
      console.error("Error preparing allocation dialog:", error);
      setSnackbar({
        open: true,
        message: "Failed to load item details",
        severity: "error" as const,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sortProjectRequirements = (requirements: ProjectRequirement[]) => {
    return requirements.sort((a, b) => {
      // First by critical status
      if (a.is_critical !== b.is_critical) {
        return a.is_critical ? -1 : 1;
      }
      // Then by priority level
      const priorityOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      if (a.priority_level !== b.priority_level) {
        return (
          priorityOrder[a.priority_level] - priorityOrder[b.priority_level]
        );
      }
      // Then by days remaining
      return a.days_remaining - b.days_remaining;
    });
  };

  const renderDialogContent = () => (
    <>
      {/* Item Details Section with Enhanced Information */}
      <Box sx={{ mb: 3, p: 2, bgcolor: "background.paper", borderRadius: 1 }}>
        <Typography variant="h6" gutterBottom>
          Item Details
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <Typography variant="body2">
              <strong>Item No:</strong> {selectedItem?.item_no}
            </Typography>
            <Typography variant="body2">
              <strong>Description:</strong> {selectedItem?.description}
            </Typography>
            <Typography variant="body2">
              <strong>Make:</strong> {selectedItem?.make}
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Typography variant="body2">
              <strong>Material Group:</strong> {selectedItem?.material_group}
            </Typography>
            <Typography variant="body2">
              <strong>Total Available:</strong> {selectedItem?.available_stock}
            </Typography>
            <Typography variant="body2">
              <strong>Total Allocated:</strong> {selectedItem?.allocated_stock}
            </Typography>
          </Grid>
        </Grid>
      </Box>

      {/* Location-wise Stock Summary */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Location Stock Details
        </Typography>
        <Grid container spacing={2}>
          {locationStocks &&
            Object.entries(locationStocks)
              .filter(([_, stock]) => stock.total > 0)
              .map(([location, stock]) => (
                <Grid item xs={12} sm={6} md={4} key={location}>
                  <Paper
                    sx={{
                      p: 2,
                      bgcolor:
                        stock.available > 0 ? "success.lighter" : "grey.100",
                    }}
                  >
                    <Typography variant="subtitle2">
                      {formatLocationName(location)}
                    </Typography>
                    <Typography variant="body2" color="success.main">
                      Available: {stock.available}
                    </Typography>
                    <Typography variant="body2" color="info.main">
                      Allocated: {stock.allocated}
                    </Typography>
                    <Typography variant="body2" fontWeight="bold">
                      Total: {stock.total}
                    </Typography>
                    {stock.allocations && stock.allocations.length > 0 && (
                      <Box mt={1}>
                        <Divider />
                        <Typography
                          variant="caption"
                          color="textSecondary"
                          sx={{ mt: 1, display: "block" }}
                        >
                          Current Allocations:
                        </Typography>
                        {stock.allocations.map((alloc, idx) => (
                          <Typography
                            key={idx}
                            variant="caption"
                            display="block"
                            color="text.secondary"
                          >
                            {alloc.project_code}: {alloc.quantity} units
                          </Typography>
                        ))}
                      </Box>
                    )}
                  </Paper>
                </Grid>
              ))}
          {(!locationStocks || Object.entries(locationStocks).length === 0) && (
            <Grid item xs={12}>
              <Typography color="text.secondary" align="center">
                No location stock data available
              </Typography>
            </Grid>
          )}
        </Grid>
      </Box>

      {/* Project Requirements Table with Enhanced Information */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Project Requirements
        </Typography>
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Project Details</TableCell>
                <TableCell align="right">Required Qty</TableCell>
                <TableCell align="right">Already Allocated</TableCell>
                <TableCell align="right">Pending Qty</TableCell>
                <TableCell align="right">Timeline</TableCell>
                <TableCell>Allocate From</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {projectRequirements.map((req) => (
                <TableRow
                  key={req.project_code}
                  sx={{
                    bgcolor: req.is_critical
                      ? "error.lighter"
                      : req.priority_level === "High"
                      ? "warning.lighter"
                      : "inherit",
                  }}
                >
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2">
                        {req.project_code}
                        {req.is_critical && (
                          <Chip
                            label="Critical"
                            color="error"
                            size="small"
                            sx={{ ml: 1 }}
                          />
                        )}
                      </Typography>
                      <Typography variant="caption" display="block">
                        {req.client_project_name}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Priority: {req.priority_level}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell align="right">{req.required_quantity}</TableCell>
                  <TableCell align="right">
                    <Tooltip
                      title={`${(
                        (req.allocated_quantity / req.required_quantity) *
                        100
                      ).toFixed(1)}%`}
                    >
                      <span>{req.allocated_quantity}</span>
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    <Typography
                      color={req.pending_quantity > 0 ? "error" : "success"}
                    >
                      {req.pending_quantity}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Box>
                      <Typography variant="caption" display="block">
                        Required by:{" "}
                        {new Date(req.required_by_date).toLocaleDateString()}
                      </Typography>
                      <Typography
                        variant="caption"
                        color={
                          req.days_remaining < 7 ? "error" : "textSecondary"
                        }
                      >
                        {req.days_remaining} days remaining
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Box
                      sx={{ display: "flex", flexDirection: "column", gap: 1 }}
                    >
                      {locationStocks &&
                        Object.entries(locationStocks)
                          .filter(([_, stock]) => stock.available > 0)
                          .map(([location, stock]) => (
                            <Box
                              key={location}
                              sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                              }}
                            >
                              <Typography
                                variant="caption"
                                sx={{ minWidth: 100 }}
                              >
                                {formatLocationName(location)} (
                                {stock.available})
                              </Typography>
                              <TextField
                                type="number"
                                size="small"
                                value={
                                  allocationData.projectAllocations[
                                    req.project_code
                                  ]?.[location] || 0
                                }
                                onChange={(e) =>
                                  handleAllocationChange(
                                    req.project_code,
                                    location,
                                    e.target.value,
                                    stock.available,
                                    req.pending_quantity
                                  )
                                }
                                inputProps={{
                                  min: 0,
                                  max: Math.min(
                                    stock.available,
                                    req.pending_quantity
                                  ),
                                  step: 1,
                                }}
                                sx={{ width: 100 }}
                              />
                            </Box>
                          ))}
                      <Typography variant="caption" color="primary">
                        Total Allocated:{" "}
                        {calculateProjectAllocation(req.project_code)}
                      </Typography>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      {/* Remarks Section with Character Count */}
      <TextField
        label="Remarks"
        fullWidth
        multiline
        rows={3}
        margin="normal"
        value={allocationData.remarks}
        onChange={(e) =>
          setAllocationData({
            ...allocationData,
            remarks: e.target.value,
          })
        }
        helperText={`${allocationData.remarks.length}/500 characters`}
        error={allocationData.remarks.length > 500}
      />
    </>
  );

  const renderAllocationHistory = () => (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h6" gutterBottom>
        Allocation History
      </Typography>
      <Timeline>
        {allocationHistory.map((history, index) => (
          <TimelineItem key={index}>
            <TimelineSeparator>
              <TimelineDot color={history.is_partial ? "warning" : "success"} />
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="body2">
                {new Date(history.date).toLocaleDateString()}
              </Typography>
              <Typography variant="body2" color="textSecondary">
                {history.quantity} units allocated from {history.from_location}
                to {history.to_project}
              </Typography>
              {history.remarks && (
                <Typography variant="caption" color="textSecondary">
                  Remarks: {history.remarks}
                </Typography>
              )}
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    </Box>
  );

  const resetAllocationData = () => {
    setLocationQuantities({});
    setLocationStocks(null);
    setAllocationData({
      projectAllocations: {},
      remarks: "",
    });
  };

  const formatLocationName = (location: string | undefined | null) => {
    if (!location) return "N/A";
    return location
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
      .replace(" Stock", "");
  };

  const handleAllocationChange = (
    projectCode: string,
    location: string,
    value: string,
    maxAvailable: number,
    pendingQuantity: number
  ) => {
    const numValue = Number(value);

    if (!validateAllocationAvailability(projectCode, location, numValue)) {
      return;
    }

    // Update allocation data
    setAllocationData((prev) => ({
      ...prev,
      projectAllocations: {
        ...prev.projectAllocations,
        [projectCode]: {
          ...prev.projectAllocations[projectCode],
          [location]: Math.min(numValue, maxAvailable, pendingQuantity),
        },
      },
    }));
  };

  const calculateProjectAllocation = (projectCode: string) => {
    const projectAllocations =
      allocationData.projectAllocations[projectCode] || {};
    return Object.values(projectAllocations).reduce(
      (sum, qty) => sum + (Number(qty) || 0),
      0
    );
  };

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const validateAllocationAvailability = (
    projectCode: string,
    location: string,
    requestedQuantity: number
  ): boolean => {
    if (!locationStocks) return false;

    const locationStock = locationStocks[location];
    if (!locationStock) return false;

    // Check if the stock is already allocated to another project
    const existingAllocation = locationStock.allocations.find(
      (alloc) => alloc.project_code !== projectCode && alloc.quantity > 0
    );

    if (existingAllocation) {
      setSnackbar({
        open: true,
        message: `This stock is already allocated to project ${existingAllocation.project_code}`,
        severity: "error",
      });
      return false;
    }

    if (requestedQuantity > locationStock.available) {
      setSnackbar({
        open: true,
        message: `Only ${locationStock.available} units available at this location`,
        severity: "warning",
      });
      return false;
    }

    return true;
  };

  const ReallocationDialog = ({
    open,
    onClose,
    onSubmit,
    item,
    locationStocks,
  }: {
    open: boolean;
    onClose: () => void;
    onSubmit: (data: any) => void;
    item: any;
    locationStocks: LocationStockMap | null;
  }) => {
    const [reallocationData, setReallocationData] = useState<{
      sourceProject: string;
      sourceLocation: string;
      targetProject: string;
      quantity: number;
      remarks: string;
    }>({
      sourceProject: "",
      sourceLocation: "",
      targetProject: "",
      quantity: 0,
      remarks: "",
    });

    const [availableAllocations, setAvailableAllocations] = useState<{
      [key: string]: {
        project: string;
        location: string;
        allocated: number;
        available: number;
        stock_allocation_id: number;
      }[];
    }>({});

    const [projectRequirements, setProjectRequirements] = useState<
      ProjectRequirement[]
    >([]);

    // Fetch current allocations and project requirements when dialog opens
    useEffect(() => {
      if (open && item) {
        fetchProjectRequirements(item.item_no);

        if (locationStocks) {
          const allocations = {};
          Object.entries(locationStocks).forEach(([location, data]) => {
            data.allocations.forEach((alloc) => {
              if (!allocations[alloc.project_code]) {
                allocations[alloc.project_code] = [];
              }

              // Ensure location is in backend format
              const backendLocation = location.endsWith("_stock")
                ? location
                : formatLocationForBackend(location);

              // Log the allocation data for debugging
              console.log("Processing allocation:", alloc);

              if (!alloc.stock_allocation_id) {
                console.warn(
                  "Missing stock_allocation_id for allocation:",
                  alloc
                );
              }

              allocations[alloc.project_code].push({
                project: alloc.project_code,
                location: backendLocation,
                allocated: alloc.quantity,
                available: alloc.quantity,
                stock_allocation_id: alloc.stock_allocation_id, // This should now be available
              });
            });
          });

          console.log(
            "Processed allocations with backend format:",
            allocations
          );
          setAvailableAllocations(allocations);
        }
      }
    }, [open, item, locationStocks]);

    // Function to fetch project requirements
    const fetchProjectRequirements = async (itemNo: string) => {
      try {
        const response = await axios.get(
          `${configuration.api_url}project-requirements/item/${itemNo}/`
        );
        setProjectRequirements(response.data);
      } catch (error) {
        console.error("Error fetching project requirements:", error);
        setSnackbar({
          open: true,
          message: "Error fetching project requirements",
          severity: "error",
        });
      }
    };

    // Filter projects to only show those with pending requirements
    const eligibleTargetProjects = projectRequirements
      .filter(
        (req) =>
          // Project has pending requirements
          req.pending_quantity > 0 &&
          // Not the source project
          req.project_code !== reallocationData.sourceProject
      )
      .sort((a, b) => {
        // Sort by priority and urgency
        if (a.is_critical !== b.is_critical) return a.is_critical ? -1 : 1;
        if (a.priority_level !== b.priority_level) {
          const priority = { Critical: 0, High: 1, Medium: 2, Low: 3 };
          return priority[a.priority_level] - priority[b.priority_level];
        }
        return a.days_remaining - b.days_remaining;
      });

    // Move handleReallocation inside the ReallocationDialog
    const handleReallocation = async (reallocationData) => {
      try {
        setIsLoading(true);

        // Debug log the available allocations and reallocation data
        console.log("Available allocations:", availableAllocations);
        console.log("Reallocation data:", reallocationData);

        // Get the allocation details for the selected source
        const sourceAllocation = availableAllocations[
          reallocationData.sourceProject
        ]?.find((a) => a.location === reallocationData.sourceLocation);

        // Debug log the found source allocation
        console.log("Found source allocation:", sourceAllocation);

        if (!sourceAllocation) {
          throw new Error("Source allocation not found");
        }

        if (!sourceAllocation.stock_allocation_id) {
          console.error(
            "Missing stock_allocation_id for source allocation:",
            sourceAllocation
          );
          throw new Error("Stock allocation ID is missing");
        }

        // Ensure the location is in the correct format
        const payload = {
          new_project_code: reallocationData.targetProject,
          quantity: reallocationData.quantity,
          location: reallocationData.sourceLocation, // This should already be in backend format (e.g., 'pirana_stock')
          remarks: reallocationData.remarks || "",
        };

        // Log the complete request details
        console.log("Making reallocation request:", {
          url: `${configuration.api_url}reallocate/${sourceAllocation.stock_allocation_id}/`,
          payload,
          sourceAllocation,
        });

        const response = await axios.post(
          `${configuration.api_url}reallocate/${sourceAllocation.stock_allocation_id}/`,
          payload
        );

        console.log("Reallocation response:", response.data);

        setSnackbar({
          open: true,
          message: "Stock reallocated successfully",
          severity: "success",
        });

        // Refresh data
        await Promise.all([
          fetchInventory(),
          fetchLocationStockDetails(item.id),
        ]);

        onClose();
      } catch (error) {
        console.error("Error reallocating stock:", {
          error,
          reallocationData,
          selectedItem: item,
          availableAllocations,
        });

        let errorMessage = "Error reallocating stock";
        if (error.response?.data?.error) {
          errorMessage = error.response.data.error;
        } else if (error.message) {
          errorMessage = error.message;
        }

        setSnackbar({
          open: true,
          message: errorMessage,
          severity: "error",
        });
      } finally {
        setIsLoading(false);
      }
    };

    // Update the Target Project Selection section in the dialog
    return (
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle>
          Reallocate Stock - {item?.item_no}
          <IconButton
            onClick={onClose}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={3}>
            {/* Current Allocations Section */}
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Current Allocations
              </Typography>
              <TableContainer component={Paper} sx={{ mb: 3 }}>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Project</TableCell>
                      <TableCell>Location</TableCell>
                      <TableCell align="right">Allocated Quantity</TableCell>
                      <TableCell>Select Source</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {Object.entries(availableAllocations).map(
                      ([project, allocations]) =>
                        allocations.map((alloc, idx) => (
                          <TableRow
                            key={`${project}-${alloc.location}-${idx}`}
                            selected={
                              reallocationData.sourceProject === project &&
                              reallocationData.sourceLocation === alloc.location
                            }
                          >
                            <TableCell>{project}</TableCell>
                            <TableCell>
                              {formatLocationName(alloc.location)}
                            </TableCell>
                            <TableCell align="right">
                              {alloc.allocated}
                            </TableCell>
                            <TableCell>
                              <Button
                                variant={
                                  reallocationData.sourceProject === project &&
                                  reallocationData.sourceLocation ===
                                    alloc.location
                                    ? "contained"
                                    : "outlined"
                                }
                                size="small"
                                onClick={() => {
                                  console.log("Setting reallocation source:", {
                                    project,
                                    location: alloc.location,
                                    backendLocation: alloc.location, // location is already in backend format
                                    alloc,
                                  });

                                  setReallocationData((prev) => ({
                                    ...prev,
                                    sourceProject: project,
                                    sourceLocation: alloc.location, // Use the backend format directly
                                    quantity: 0,
                                  }));
                                }}
                              >
                                Select
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            </Grid>

            {/* Reallocation Details Section */}
            {reallocationData.sourceProject && (
              <Grid item xs={12}>
                <Paper sx={{ p: 2 }}>
                  <Typography variant="h6" gutterBottom>
                    Reallocation Details
                  </Typography>
                  <Grid container spacing={2}>
                    {/* Source Information */}
                    <Grid item xs={12} md={6}>
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2">Source:</Typography>
                        <Typography>
                          Project: {reallocationData.sourceProject}
                        </Typography>
                        <Typography>
                          Location:{" "}
                          {formatLocationName(reallocationData.sourceLocation)}
                        </Typography>
                        <Typography>
                          Available for reallocation:{" "}
                          {availableAllocations[
                            reallocationData.sourceProject
                          ]?.find(
                            (a) =>
                              a.location === reallocationData.sourceLocation
                          )?.available || 0}
                        </Typography>
                      </Box>
                    </Grid>

                    {/* Target Project Selection */}
                    <Grid item xs={12} md={6}>
                      <FormControl fullWidth>
                        <InputLabel>Target Project</InputLabel>
                        <Select
                          value={reallocationData.targetProject}
                          onChange={(e) =>
                            setReallocationData((prev) => ({
                              ...prev,
                              targetProject: e.target.value,
                            }))
                          }
                        >
                          {eligibleTargetProjects.map((project) => (
                            <MenuItem
                              key={project.project_code}
                              value={project.project_code}
                            >
                              <Box>
                                <Typography variant="subtitle2">
                                  {project.project_code}
                                  {project.is_critical && (
                                    <Chip
                                      label="Critical"
                                      color="error"
                                      size="small"
                                      sx={{ ml: 1 }}
                                    />
                                  )}
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color="textSecondary"
                                  display="block"
                                >
                                  {project.client_project_name}
                                </Typography>
                                <Typography variant="caption" color="primary">
                                  Pending: {project.pending_quantity} units
                                </Typography>
                                <Typography
                                  variant="caption"
                                  color={
                                    project.days_remaining < 7
                                      ? "error"
                                      : "textSecondary"
                                  }
                                  sx={{ ml: 2 }}
                                >
                                  {project.days_remaining} days remaining
                                </Typography>
                              </Box>
                            </MenuItem>
                          ))}
                        </Select>
                        {eligibleTargetProjects.length === 0 && (
                          <FormHelperText error>
                            No projects with pending requirements for this item
                          </FormHelperText>
                        )}
                      </FormControl>
                    </Grid>

                    {/* Quantity Selection */}
                    <Grid item xs={12} md={6}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Quantity to Reallocate"
                        value={reallocationData.quantity}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          const maxAvailable =
                            availableAllocations[
                              reallocationData.sourceProject
                            ]?.find(
                              (a) =>
                                a.location === reallocationData.sourceLocation
                            )?.available || 0;

                          setReallocationData((prev) => ({
                            ...prev,
                            quantity: Math.min(
                              Math.max(0, value),
                              maxAvailable
                            ),
                          }));
                        }}
                        InputProps={{
                          inputProps: {
                            min: 0,
                            max:
                              availableAllocations[
                                reallocationData.sourceProject
                              ]?.find(
                                (a) =>
                                  a.location === reallocationData.sourceLocation
                              )?.available || 0,
                          },
                        }}
                      />
                    </Grid>

                    {/* Remarks */}
                    <Grid item xs={12}>
                      <TextField
                        fullWidth
                        multiline
                        rows={3}
                        label="Reallocation Remarks"
                        required
                        value={reallocationData.remarks}
                        onChange={(e) =>
                          setReallocationData((prev) => ({
                            ...prev,
                            remarks: e.target.value,
                          }))
                        }
                        helperText="Please provide a reason for reallocation"
                      />
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => handleReallocation(reallocationData)}
            disabled={
              !reallocationData.sourceProject ||
              !reallocationData.targetProject ||
              reallocationData.quantity <= 0 ||
              !reallocationData.remarks.trim()
            }
          >
            Reallocate
          </Button>
        </DialogActions>
      </Dialog>
    );
  };

  const handleShowReallocations = async (item) => {
    try {
      // First get the location stock details which includes allocation information
      const response = await axios.get(
        `${configuration.api_url}inventory/${item.id}/location-stock/`
      );

      // Get allocation history if needed
      const historyResponse = await axios.get(
        `${configuration.api_url}debug-location-allocations/${item.id}/`
      );

      console.log("Raw allocation history data:", historyResponse.data);

      // Transform the data to match what ReallocationSummary expects
      const formattedHistory = historyResponse.data.map((alloc) => ({
        date: new Date().toISOString(), // Since the API doesn't provide a date, use current date
        source_project: alloc.project_code,
        target_project: "N/A", // Not available in the current data
        source_location: alloc.location,
        quantity: alloc.quantity,
        remarks: `Allocation ID: ${alloc.stock_allocation_id}`,
      }));

      console.log("Formatted allocation history:", formattedHistory);

      setSelectedItem(item);
      setLocationStocks(response.data);
      setAllocationHistory(formattedHistory); // Use the formatted data
      setShowReallocationDialog(true);
    } catch (error) {
      console.error("Error fetching allocation details:", error);
      setSnackbar({
        open: true,
        message: "Error fetching allocation details",
        severity: "error",
      });
    }
  };

  const AllocationHistoryTimeline = ({ history }) => {
    return (
      <Timeline>
        {history.map((record, index) => (
          <TimelineItem key={index}>
            <TimelineSeparator>
              <TimelineDot
                color={record.is_reallocation ? "secondary" : "primary"}
              />
            </TimelineSeparator>
            <TimelineContent>
              <Typography variant="subtitle2">
                {new Date(record.date).toLocaleDateString()}
              </Typography>
              <Typography variant="body2">
                {record.is_reallocation ? "Reallocated" : "Allocated"}{" "}
                {record.quantity} units from {record.from_location}
              </Typography>
              {record.remarks && (
                <Typography variant="caption" color="textSecondary">
                  Remarks: {record.remarks}
                </Typography>
              )}
            </TimelineContent>
          </TimelineItem>
        ))}
      </Timeline>
    );
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Search and Filter Section */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              variant="outlined"
              placeholder="Search by Item No, Description, or Make"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          {/* <Grid item xs={12} md={6}>
            <Button
              variant="contained"
              color={showReallocations ? "secondary" : "primary"}
              onClick={() => setShowReallocations(!showReallocations)}
            >
              {showReallocations ? "Show All Stocks" : "Show Allocated Stocks"}
            </Button>
          </Grid> */}
        </Grid>
      </Box>

      {/* Table Section */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Item Details</TableCell>
              <TableCell>Stock Information</TableCell>
              <TableCell>Location-wise Stock</TableCell>
              <TableCell>Project Requirements</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredInventory
              .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
              .map((item) => (
                <TableRow key={item.id}>
                  {/* Item Details Column */}
                  <TableCell>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="bold">
                        {item.item_no}
                      </Typography>
                      <Tooltip title={item.description}>
                        <Typography
                          variant="body2"
                          noWrap
                          sx={{ maxWidth: 200 }}
                        >
                          {item.description}
                        </Typography>
                      </Tooltip>
                      <Typography variant="body2" color="textSecondary">
                        Make: {item.make}
                      </Typography>
                      <Typography variant="caption" color="textSecondary">
                        Material Group: {item.material_group}
                      </Typography>
                    </Box>
                  </TableCell>

                  {/* Stock Information Column */}
                  <TableCell>
                    <Box>
                      <Typography variant="body2">
                        <strong>Total Stock:</strong>{" "}
                        {item.total_stock ||
                          item.available_stock + item.allocated_stock}
                      </Typography>
                      <Typography
                        variant="body2"
                        color={
                          item.available_stock > 0
                            ? "success.main"
                            : "error.main"
                        }
                      >
                        <strong>Available:</strong> {item.available_stock}
                      </Typography>
                      <Typography variant="body2" color="info.main">
                        <strong>Allocated:</strong> {item.allocated_stock}
                      </Typography>
                      {item.pending_quantity > 0 && (
                        <Chip
                          label={`${item.pending_quantity} Pending`}
                          size="small"
                          color="warning"
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Box>
                  </TableCell>

                  {/* Location-wise Stock Column */}
                  <TableCell>
                    <Grid container spacing={1}>
                      {item.times_sq_stock > 0 && (
                        <Grid item>
                          <Chip
                            label={`Times Square: ${item.times_sq_stock}`}
                            size="small"
                            color="primary"
                          />
                        </Grid>
                      )}
                      {item.i_sq_stock > 0 && (
                        <Grid item>
                          <Chip
                            label={`iSquare: ${item.i_sq_stock}`}
                            size="small"
                            color="secondary"
                          />
                        </Grid>
                      )}
                      {item.sakar_stock > 0 && (
                        <Grid item>
                          <Chip
                            label={`Sakar: ${item.sakar_stock}`}
                            size="small"
                            color="info"
                          />
                        </Grid>
                      )}
                      {item.pirana_stock > 0 && (
                        <Grid item>
                          <Chip
                            label={`Pirana: ${item.pirana_stock}`}
                            size="small"
                            color="success"
                          />
                        </Grid>
                      )}
                      {item.other_stock > 0 && (
                        <Grid item>
                          <Chip
                            label={`Other: ${item.other_stock}`}
                            size="small"
                            color="default"
                          />
                        </Grid>
                      )}
                    </Grid>
                  </TableCell>

                  {/* Project Requirements Column */}
                  <TableCell>
                    <Box>
                      {item.project_requirements ? (
                        item.project_requirements
                          .slice(0, 2)
                          .map((req, index) => (
                            <Box key={index} sx={{ mb: 1 }}>
                              <Typography variant="caption" display="block">
                                {req.project_code}:{" "}
                                <span
                                  style={{
                                    color: req.is_critical
                                      ? "error.main"
                                      : "inherit",
                                  }}
                                >
                                  {req.pending_quantity} pending
                                </span>
                              </Typography>
                            </Box>
                          ))
                      ) : (
                        <Typography variant="caption" color="textSecondary">
                          No active requirements
                        </Typography>
                      )}
                      {item.project_requirements?.length > 2 && (
                        <Tooltip
                          title={item.project_requirements
                            .slice(2)
                            .map(
                              (req) =>
                                `${req.project_code}: ${req.pending_quantity} pending`
                            )
                            .join("\n")}
                        >
                          <Typography
                            variant="caption"
                            color="primary"
                            sx={{ cursor: "pointer" }}
                          >
                            +{item.project_requirements.length - 2} more
                          </Typography>
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>

                  {/* Actions Column */}
                  <TableCell>
                    <Stack direction="row" spacing={1}>
                      <Button
                        variant="contained"
                        onClick={() => handleAllocateClick(item)}
                        disabled={item.available_stock <= 0}
                        size="small"
                      >
                        Allocate
                      </Button>
                      {item.allocated_stock > 0 && (
                        <Button
                          variant="outlined"
                          size="small"
                          onClick={() => handleShowReallocations(item)}
                        >
                          Reallocate
                        </Button>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Pagination */}
      <TablePagination
        component="div"
        count={filteredInventory.length}
        page={page}
        onPageChange={handleChangePage}
        rowsPerPage={rowsPerPage}
        onRowsPerPageChange={handleChangeRowsPerPage}
        rowsPerPageOptions={[5, 10, 25, 50]}
      />

      {/* Allocation Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          Allocate Stock
          <IconButton
            onClick={() => setOpenDialog(false)}
            sx={{ position: "absolute", right: 8, top: 8 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {isLoading ? (
            <Box sx={{ display: "flex", justifyContent: "center", p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            renderDialogContent()
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
          <Button
            onClick={handleAllocate}
            variant="contained"
            disabled={isLoading || !validateAllocation().isValid}
          >
            {isLoading ? <CircularProgress size={24} /> : "Allocate"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={6000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Add Reallocation Dialog */}
      <ReallocationDialog
        open={showReallocationDialog}
        onClose={() => {
          setShowReallocationDialog(false);
          setSelectedAllocationForReallocation(null);
        }}
        onSubmit={() => {
          setShowReallocationDialog(false);
          fetchInventory();
        }}
        item={selectedItem}
        locationStocks={locationStocks}
      />

      {showAllocationHistory && selectedItem && (
        <Dialog
          open={showAllocationHistory}
          onClose={() => setShowAllocationHistory(false)}
          maxWidth="md"
          fullWidth
        >
          <DialogTitle>
            Allocation History
            <IconButton
              onClick={() => setShowAllocationHistory(false)}
              sx={{ position: "absolute", right: 8, top: 8 }}
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>
          <DialogContent>
            <Typography variant="subtitle1" gutterBottom>
              Item: {selectedItem.item_no} - {selectedItem.description}
            </Typography>
            <AllocationHistoryTimeline history={allocationHistory} />
          </DialogContent>
        </Dialog>
      )}
    </Box>
  );
};

export default Allocate;
