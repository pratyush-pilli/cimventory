import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Autocomplete,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  ToggleButtonGroup,
  ToggleButton,
  Checkbox,
  Grid,
} from "@mui/material";
import { useSnackbar } from "notistack";
import axios from "axios";
import configuration from "../../../configuration";
import OutwardDialog from "./OutwardDialog";
import OutwardHistory from "./OutwardHistory";
import "./outward.scss";
import { ItemCard } from "./itemCard";
import { RequiredItem, LocationStock } from "./types";
import { OutwardCart } from "./OutwardCart";

interface SelectedRows {
  [key: string]: boolean;
}

interface OutwardCart {
  items: {
    [itemId: string]: {
      item: RequiredItem;
      locationQuantities: {
        [location: string]: number;
      };
      totalQuantity: number;
      remarks?: string;
    };
  };
  documentType: "challan" | "billing";
  documentNumber: string;
  generalRemarks: string;
}

const OutwardStock = () => {
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectCodes, setProjectCodes] = useState([]);
  const [requiredItems, setRequiredItems] = useState<RequiredItem[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedItem, setSelectedItem] = useState<RequiredItem | null>(null);
  const [outwardMode, setOutwardMode] = useState<"single" | "batch">("single");
  const [selectedRows, setSelectedRows] = useState<SelectedRows>({});
  const { enqueueSnackbar } = useSnackbar();
  const [locationStocks, setLocationStocks] = useState<{
    [itemId: string]: { [location: string]: LocationStock };
  }>({});
  const [outwardCart, setOutwardCart] = useState<OutwardCart>({
    items: {},
    documentType: "challan",
    documentNumber: "",
    generalRemarks: "",
  });
  const [outwardType, setOutwardType] = useState<"allocated" | "available">(
    "allocated"
  );

  // Fetch project codes on mount
  useEffect(() => {
    fetchProjectCodes();
  }, []);

  // Fetch required items when project is selected
  useEffect(() => {
    if (selectedProject) {
      fetchRequiredItems(selectedProject);
    }
  }, [selectedProject]);

  const fetchProjectCodes = async () => {
    try {
      const response = await axios.get(`${configuration.api_url}projects/`);
      setProjectCodes(response.data);
    } catch (error) {
      console.error("Error fetching project codes:", error);
      enqueueSnackbar("Failed to fetch project codes", { variant: "error" });
    }
  };

  const fetchRequiredItems = async (projectCode: string) => {
    try {
      const apiEndpoint = `${configuration.api_url}project-requirements/${projectCode}/`;
      const response = await axios.get(apiEndpoint);

      const itemsWithDetails = await Promise.all(
        response.data.map(async (item) => {
          try {
            // Get both stock details, location-wise allocations, and outward history
            const [stockResponse, locationResponse, outwardResponse] =
              await Promise.all([
                axios.get(
                  `${configuration.api_url}stock-details/${item.inventory_id}/${projectCode}/`
                ),
                axios.get(
                  `${configuration.api_url}inventory/${item.inventory_id}/location-stock/`
                ),
                axios.get(
                  `${configuration.api_url}outward-history/${item.inventory_id}/${projectCode}/`
                ),
              ]);

            // Calculate project-specific allocations
            const locationStocks = locationResponse.data;
            const projectAllocations = Object.values(locationStocks).reduce(
              (sum: number, location: LocationStock) => {
                const projectAlloc = location.allocations
                  .filter((alloc) => alloc.project_code === projectCode)
                  .reduce((total, alloc) => total + alloc.quantity, 0);
                return sum + projectAlloc;
              },
              0
            );

            // Extract outward data from response
            const outwarded_quantity =
              parseFloat(outwardResponse.data.total_outwarded) || 0;
            const recent_outwards = outwardResponse.data.recent_outwards || [];

            // Calculate remaining quantity to outward
            const remaining_quantity = Math.max(
              0,
              item.required_quantity - outwarded_quantity
            );

            // Store location stocks for this item
            setLocationStocks((prev) => ({
              ...prev,
              [item.inventory_id]: locationStocks,
            }));

            // Calculate the outward progress as a percentage
            const outward_progress =
              item.required_quantity > 0
                ? Math.min(
                    100,
                    (outwarded_quantity / item.required_quantity) * 100
                  )
                : 0;

            // Get location-wise outward data by summing up outwards for each location
            const locationOutwards = {};
            recent_outwards.forEach((outward) => {
              const location = outward.location;
              if (!locationOutwards[location]) {
                locationOutwards[location] = 0;
              }
              locationOutwards[location] += parseFloat(outward.quantity);
            });

            return {
              ...item,
              allocated_quantity: projectAllocations,
              available_stock: stockResponse.data.available_stock,
              pending_quantity:
                item.required_quantity - item.allocated_quantity,
              location_stocks: locationStocks,
              status: determineItemStatus(
                item,
                projectAllocations,
                locationStocks
              ),
              outwarded_quantity,
              remaining_quantity,
              outward_progress,
              recent_outwards,
              location_outwards: locationOutwards,
            };
          } catch (error) {
            console.error(
              `Error fetching details for item ${item.item_no}:`,
              error
            );
            return {
              ...item,
              outwarded_quantity: 0,
              remaining_quantity: item.required_quantity,
              outward_progress: 0,
              recent_outwards: [],
              location_outwards: {},
            };
          }
        })
      );

      setRequiredItems(itemsWithDetails);
    } catch (error) {
      console.error("Error fetching required items:", error);
      enqueueSnackbar("Failed to fetch required items", { variant: "error" });
      setRequiredItems([]);
    }
  };

  const determineItemStatus = (
    item: RequiredItem,
    projectAllocations: number,
    locationStocks: { [location: string]: LocationStock }
  ) => {
    if (projectAllocations >= item.required_quantity) {
      return "Ready for Outward";
    }

    // Check if there's enough available stock in any location
    const totalAvailable = Object.values(locationStocks).reduce(
      (sum, loc) => sum + loc.available,
      0
    );

    if (totalAvailable >= item.required_quantity - projectAllocations) {
      return "Available for Allocation";
    }

    return "Insufficient Stock";
  };

  const handleOutwardClick = (item: RequiredItem) => {
    if (!selectedProject) {
      enqueueSnackbar("Please select a project first", { variant: "warning" });
      return;
    }

    setSelectedItem({
      ...item,
      project_code: selectedProject,
    });
    setOpenDialog(true);
  };

  const handleOutwardSubmit = async (outwardData: any) => {
    try {
      console.log("Submitting outward data:", outwardData);

      // Show loading message
      enqueueSnackbar(
        "Processing outward transaction and generating document...",
        {
          variant: "info",
          autoHideDuration: 3000,
        }
      );

      // Use the atomic API that handles both outward and document generation
      const response = await axios.post(
        `${configuration.api_url}process-outward-and-document/`,
        {
          outward: {
            document_type: outwardData.document_type,
            document_number: outwardData.document_number,
            remarks: outwardData.remarks,
            outward_items: outwardData.outward_items.map((item) => ({
              inventory_id: item.inventory_id,
              project_code: selectedProject,
              location_quantities: item.location_quantities,
              outward_type: outwardType,
              item_no: item.item_no,
              description: item.description,
              make: item.make,
              material_group: item.material_group,
            })),
          },
          document: {
            document_number: outwardData.document_number,
            date: new Date().toISOString().split("T")[0],
            project_code: selectedProject,
            outward_items: outwardData.outward_items.map((item) => ({
              inventory_id: item.inventory_id,
              item_no: item.item_no,
              description: item.description,
              make: item.make || "",
              material_group: item.material_group || "",
              hsn_code: item.hsn_code || "",
              rate: parseFloat(item.rate || 0),
              quantity: Object.values(item.location_quantities || {}).reduce(
                (sum, qty) => sum + Number(qty),
                0
              ),
              location_quantities: item.location_quantities,
            })),
          },
        }
      );

      if (response.data.download_url) {
        const baseUrl = configuration.api_url;
        const downloadUrl = `${baseUrl}${response.data.download_url}`;
        window.open(downloadUrl, "_blank");

        // Show success message
        const documentType =
          outwardData.document_type === "challan"
            ? "Delivery Challan"
            : "Billing Instructions";
        enqueueSnackbar(
          `✅ ${documentType} generated successfully! Opening download...`,
          {
            variant: "success",
            autoHideDuration: 4000,
          }
        );
      } else {
        // Document generated but no download URL
        const documentType =
          outwardData.document_type === "challan"
            ? "Delivery Challan"
            : "Billing Instructions";
        enqueueSnackbar(
          `⚠️ ${documentType} generated but download link not available. Please contact support.`,
          {
            variant: "warning",
            autoHideDuration: 5000,
          }
        );
      }

      // Clear the cart
      setOutwardCart({
        items: {},
        documentType: "challan",
        documentNumber: "",
        generalRemarks: "",
      });

      // Refresh the required items to show updated quantities
      enqueueSnackbar("🔄 Refreshing item quantities...", {
        variant: "info",
        autoHideDuration: 2000,
      });

      await fetchRequiredItems(selectedProject);

      enqueueSnackbar("✅ Item quantities updated successfully!", {
        variant: "success",
        autoHideDuration: 3000,
      });
    } catch (error: any) {
      console.error("Error processing outward and document:", error);

      // Provide detailed error information in user-friendly terms
      let errorMessage =
        "Failed to process outward transaction and generate document. ";

      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;

        switch (status) {
          case 400:
            errorMessage +=
              "Invalid data provided. Please check your input and try again.";
            if (data?.error) {
              errorMessage += ` Details: ${data.error}`;
            }
            break;
          case 404:
            errorMessage +=
              "Project or items not found. Please refresh and try again.";
            break;
          case 409:
            errorMessage +=
              "Conflict detected. Some items may have been modified by another user. Please refresh and try again.";
            break;
          case 500:
            errorMessage += "Server error occurred. Please try again later.";
            if (data?.error) {
              // Parse the error message to provide user-friendly feedback
              const errorDetails = data.error;

              if (
                errorDetails.includes(
                  "duplicate key value violates unique constraint"
                )
              ) {
                if (errorDetails.includes("document_number")) {
                  errorMessage =
                    "❌ Document number already exists! Please use a different document number.";
                } else {
                  errorMessage =
                    "❌ Duplicate entry detected. Please check your data and try again.";
                }
              } else if (errorDetails.includes("Insufficient stock")) {
                errorMessage =
                  "❌ Insufficient stock available for some items. Please check quantities.";
              } else if (errorDetails.includes("not found")) {
                errorMessage =
                  "❌ Some items or project not found. Please refresh and try again.";
              } else if (errorDetails.includes("permission")) {
                errorMessage =
                  "❌ Permission denied. You don't have access to perform this action.";
              } else {
                // Show technical details for other errors
                errorMessage = `❌ Server error: ${errorDetails}`;
              }
            }
            break;
          default:
            errorMessage +=
              "An unexpected error occurred. Please try again or contact support.";
            if (data?.error) {
              errorMessage += ` Error: ${data.error}`;
            }
        }
      } else if (error.request) {
        errorMessage +=
          "Network error. Please check your internet connection and try again.";
      } else {
        errorMessage +=
          "An error occurred while processing the transaction. Please try again.";
      }

      enqueueSnackbar(errorMessage, {
        variant: "error",
        autoHideDuration: 8000,
        action: (key) => (
          <Button
            color="inherit"
            size="small"
            onClick={() => {
              // Retry the entire operation
              handleOutwardSubmit(outwardData);
            }}
          >
            Retry
          </Button>
        ),
      });
    }
  };

  const handleRowSelect = (itemId: string) => {
    setSelectedRows((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  };

  const handleSelectAll = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newSelected = {};
    if (event.target.checked) {
      requiredItems.forEach((item) => {
        if (
          determineItemStatus(
            item,
            item.allocated_quantity,
            locationStocks[item.inventory_id]
          ) === "Ready for Outward"
        ) {
          newSelected[item.id] = true;
        }
      });
    }
    setSelectedRows(newSelected);
  };

  const handleBatchOutward = () => {
    const selectedItems = requiredItems.filter((item) => selectedRows[item.id]);
    if (selectedItems.length === 0) {
      enqueueSnackbar("Please select items for batch outward", {
        variant: "warning",
      });
      return;
    }
    // Handle batch outward logic
    setSelectedItem(selectedItems[0]); // For now, just handle the first item
    setOpenDialog(true);
  };

  const formatLocationName = (location: string) => {
    return location
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
      .replace(" Stock", "");
  };

  const getStatusColor = (status: string): "success" | "warning" | "error" => {
    switch (status) {
      case "Ready for Outward":
        return "success";
      case "Available for Allocation":
        return "warning";
      default:
        return "error";
    }
  };

  const isEligibleForOutward = (item: RequiredItem) => {
    // Check if there's allocated stock in any location
    if (item.location_stocks) {
      const hasAllocatedStock = Object.values(item.location_stocks).some(
        (location) =>
          location.allocations.some(
            (alloc) =>
              alloc.project_code === selectedProject && alloc.quantity > 0
          )
      );
      return hasAllocatedStock;
    }
    return false;
  };

  const addToOutwardCart = (
    item: RequiredItem,
    location: string,
    quantity: number,
    outwardType: "allocated" | "available"
  ) => {
    setOutwardCart((prev) => {
      // Get current quantity in cart for this item across all locations
      const currentTotalInCart = Object.values(
        prev.items[item.inventory_id]?.locationQuantities || {}
      ).reduce((sum, qty) => sum + qty, 0);

      // Get remaining required quantity
      const remainingRequired = Math.max(
        0,
        item.remaining_quantity - currentTotalInCart
      );

      // Get max allowed quantity based on outward type
      const locationStock = item.location_stocks?.[location];
      const maxLocationQuantity =
        outwardType === "allocated"
          ? locationStock?.allocations
              .filter((alloc) => alloc.project_code === selectedProject)
              .reduce((sum, alloc) => sum + alloc.quantity, 0) || 0
          : locationStock?.available || 0;

      // Calculate the new quantity considering all constraints
      const newQuantity = Math.min(
        quantity, // Requested quantity
        maxLocationQuantity, // Available/Allocated in location
        remainingRequired // Remaining required quantity
      );

      // If no quantity can be added, show a message
      if (newQuantity <= 0) {
        enqueueSnackbar(
          `Cannot add more items. ${
            remainingRequired <= 0
              ? "Required quantity already in cart"
              : "Insufficient stock in location"
          }`,
          { variant: "warning" }
        );
        return prev;
      }

      // Update cart with validated quantity
      return {
        ...prev,
        items: {
          ...prev.items,
          [item.inventory_id]: {
            item,
            locationQuantities: {
              ...(prev.items[item.inventory_id]?.locationQuantities || {}),
              [location]: newQuantity,
            },
            totalQuantity:
              Object.values(
                prev.items[item.inventory_id]?.locationQuantities || {}
              ).reduce((sum, qty) => sum + qty, 0) -
              (prev.items[item.inventory_id]?.locationQuantities[location] ||
                0) +
              newQuantity,
            outwardType,
          },
        },
      };
    });
  };

  const handleProcessOutward = () => {
    // Implementation of handleProcessOutward
  };

  const handleGenerateDocument = () => {
    // Implementation of handleGenerateDocument
  };

  const removeFromOutwardCart = (inventoryId: number, location: string) => {
    setOutwardCart((prev) => {
      const currentItem = prev.items[inventoryId];
      if (!currentItem) return prev;

      const newLocationQuantities = { ...currentItem.locationQuantities };
      delete newLocationQuantities[location];

      // If no locations left, remove the entire item
      if (Object.keys(newLocationQuantities).length === 0) {
        const newItems = { ...prev.items };
        delete newItems[inventoryId];
        return { ...prev, items: newItems };
      }

      // Update the item with remaining locations
      return {
        ...prev,
        items: {
          ...prev.items,
          [inventoryId]: {
            ...currentItem,
            locationQuantities: newLocationQuantities,
            totalQuantity: Object.values(newLocationQuantities).reduce(
              (sum, qty) => sum + qty,
              0
            ),
          },
        },
      };
    });
  };

  const updateCartQuantity = (
    inventoryId: number,
    location: string,
    quantity: number,
    operation: "increment" | "decrement" | "set" = "set"
  ) => {
    setOutwardCart((prev) => {
      const currentItem = prev.items[inventoryId];
      if (!currentItem) return prev;

      const item = currentItem.item;
      const currentLocationQty = currentItem.locationQuantities[location] || 0;

      // Calculate current total in cart excluding current location
      const totalInOtherLocations = Object.entries(
        currentItem.locationQuantities
      ).reduce((sum, [loc, qty]) => (loc === location ? sum : sum + qty), 0);

      // Get max allowed quantity based on outward type
      const locationStock = item.location_stocks?.[location];
      const maxLocationQuantity =
        currentItem.outwardType === "allocated"
          ? locationStock?.allocations
              .filter((alloc) => alloc.project_code === selectedProject)
              .reduce((sum, alloc) => sum + alloc.quantity, 0) || 0
          : locationStock?.available || 0;

      // Calculate remaining required quantity
      const remainingRequired = Math.max(
        0,
        item.remaining_quantity - totalInOtherLocations
      );

      // Calculate new quantity based on operation
      let newQuantity: number;
      switch (operation) {
        case "increment":
          newQuantity = Math.min(
            currentLocationQty + 1,
            maxLocationQuantity,
            remainingRequired
          );
          break;
        case "decrement":
          newQuantity = Math.max(0, currentLocationQty - 1);
          break;
        case "set":
          newQuantity = Math.min(
            Math.max(0, quantity),
            maxLocationQuantity,
            remainingRequired
          );
          break;
        default:
          newQuantity = currentLocationQty;
      }

      // If quantity would exceed limits, show warning
      if (newQuantity === currentLocationQty && quantity > newQuantity) {
        enqueueSnackbar(
          `Cannot ${operation === "increment" ? "increase" : "set"} quantity. ${
            remainingRequired <= 0
              ? "Required quantity would be exceeded"
              : "Insufficient stock in location"
          }`,
          { variant: "warning" }
        );
      }

      // If quantity becomes 0, remove the location
      if (newQuantity === 0) {
        const newLocationQuantities = { ...currentItem.locationQuantities };
        delete newLocationQuantities[location];

        // If no locations left, remove the entire item
        if (Object.keys(newLocationQuantities).length === 0) {
          const newItems = { ...prev.items };
          delete newItems[inventoryId];
          return { ...prev, items: newItems };
        }

        return {
          ...prev,
          items: {
            ...prev.items,
            [inventoryId]: {
              ...currentItem,
              locationQuantities: newLocationQuantities,
              totalQuantity: Object.values(newLocationQuantities).reduce(
                (sum, qty) => sum + qty,
                0
              ),
            },
          },
        };
      }

      // Update quantity
      return {
        ...prev,
        items: {
          ...prev.items,
          [inventoryId]: {
            ...currentItem,
            locationQuantities: {
              ...currentItem.locationQuantities,
              [location]: newQuantity,
            },
            totalQuantity: totalInOtherLocations + newQuantity,
          },
        },
      };
    });
  };

  return (
    <Grid container spacing={2}>
      {/* Left side - Items List */}
      <Grid item xs={8}>
        <Paper sx={{ p: 2, height: "100vh", overflow: "auto" }}>
          {/* Project Selection and Toggle Buttons */}
          <Box sx={{ mb: 3 }}>
            <Grid container spacing={2}>
              <Grid item xs={8}>
                <Autocomplete
                  options={projectCodes}
                  getOptionLabel={(option) =>
                    `${option.project_code} - ${option.client_project_name}`
                  }
                  onChange={(_, value) =>
                    setSelectedProject(value?.project_code)
                  }
                  renderInput={(params) => (
                    <TextField {...params} label="Select Project" />
                  )}
                />
              </Grid>
              <Grid item xs={4}>
                <ToggleButtonGroup
                  value={outwardType}
                  exclusive
                  onChange={(_, newValue) => {
                    if (newValue !== null) {
                      setOutwardType(newValue);
                    }
                  }}
                  fullWidth
                  size="small"
                  sx={{
                    "& .MuiToggleButton-root": {
                      "&.Mui-selected": {
                        backgroundColor: "primary.main",
                        color: "white",
                        "&:hover": {
                          backgroundColor: "primary.dark",
                        },
                      },
                    },
                  }}
                >
                  <ToggleButton value="allocated">Allocated Stock</ToggleButton>
                  <ToggleButton value="available">Available Stock</ToggleButton>
                </ToggleButtonGroup>
              </Grid>
            </Grid>
          </Box>

          {/* Items Grid */}
          <Grid container spacing={2}>
            {requiredItems.map((item) => (
              <Grid item xs={12} key={item.id}>
                <Paper
                  elevation={3}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    transition: "all 0.3s ease",
                    "&:hover": {
                      transform: "translateY(-2px)",
                      boxShadow: 6,
                    },
                  }}
                >
                  <Grid container spacing={2}>
                    <Grid item xs={12}>
                      <Typography variant="h6" gutterBottom>
                        {item.item_no}
                      </Typography>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        gutterBottom
                      >
                        {item.description}
                      </Typography>
                      <Box display="flex" alignItems="center" mb={2} gap={2}>
                        <Chip
                          label={item.status}
                          color={getStatusColor(item.status)}
                          size="small"
                        />

                        {/* Add this new chip to show outward progress */}
                        <Chip
                          label={`Outwarded: ${item.outwarded_quantity || 0}/${
                            item.required_quantity
                          }`}
                          color={
                            item.outwarded_quantity >= item.required_quantity
                              ? "success"
                              : "warning"
                          }
                          size="small"
                          variant="outlined"
                        />

                        {/* Add this new chip to show remaining quantity */}
                        {item.remaining_quantity > 0 && (
                          <Chip
                            label={`Remaining: ${item.remaining_quantity}`}
                            color="info"
                            size="small"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    </Grid>
                    <Grid item xs={12}>
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>Location</TableCell>
                              <TableCell align="right">
                                {outwardType === "allocated"
                                  ? "Allocated Stock"
                                  : "Available Stock"}
                              </TableCell>
                              <TableCell align="right">Required</TableCell>
                              <TableCell align="right">Remaining</TableCell>
                              <TableCell align="right">Actions</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {Object.entries(item.location_stocks || {}).map(
                              ([location, stockInfo]) => {
                                const quantity =
                                  outwardType === "allocated"
                                    ? stockInfo.allocations
                                        .filter(
                                          (alloc) =>
                                            alloc.project_code ===
                                            selectedProject
                                        )
                                        .reduce(
                                          (sum, alloc) => sum + alloc.quantity,
                                          0
                                        )
                                    : stockInfo.available;

                                return (
                                  <TableRow key={location}>
                                    <TableCell>
                                      {formatLocationName(location)}
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography
                                        color={
                                          quantity > 0
                                            ? "success.main"
                                            : "error.main"
                                        }
                                        fontWeight="medium"
                                      >
                                        {quantity}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      {item.required_quantity}
                                    </TableCell>
                                    <TableCell align="right">
                                      <Typography
                                        color={
                                          item.remaining_quantity > 0
                                            ? "info.main"
                                            : "success.main"
                                        }
                                      >
                                        {item.remaining_quantity}
                                      </Typography>
                                    </TableCell>
                                    <TableCell align="right">
                                      {quantity > 0 &&
                                        item.remaining_quantity > 0 && (
                                          <Box>
                                            <Typography
                                              variant="caption"
                                              display="block"
                                              gutterBottom
                                            >
                                              {`Available: ${quantity}`}
                                            </Typography>
                                            <Button
                                              size="small"
                                              variant="contained"
                                              color="primary"
                                              sx={{
                                                borderRadius: 2,
                                                textTransform: "none",
                                                boxShadow: 2,
                                                "&:hover": {
                                                  boxShadow: 4,
                                                },
                                              }}
                                              onClick={() =>
                                                addToOutwardCart(
                                                  item,
                                                  location,
                                                  Math.min(
                                                    quantity,
                                                    item.remaining_quantity
                                                  ),
                                                  outwardType
                                                )
                                              }
                                            >
                                              Add to Cart
                                            </Button>
                                          </Box>
                                        )}
                                    </TableCell>
                                  </TableRow>
                                );
                              }
                            )}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </Grid>
                  </Grid>
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Grid>

      {/* Right side - Outward Cart */}
      <Grid item xs={4}>
        <OutwardCart
          items={outwardCart.items}
          projectCode={selectedProject!}
          onRemoveItem={removeFromOutwardCart}
          onUpdateQuantity={updateCartQuantity}
          onSubmit={handleOutwardSubmit}
          documentType={outwardCart.documentType}
          documentNumber={outwardCart.documentNumber}
          remarks={outwardCart.generalRemarks}
          outwardType={outwardType}
          onDocumentTypeChange={(value) =>
            setOutwardCart((prev) => ({ ...prev, documentType: value }))
          }
          onDocumentNumberChange={(value) =>
            setOutwardCart((prev) => ({ ...prev, documentNumber: value }))
          }
          onRemarksChange={(value) =>
            setOutwardCart((prev) => ({ ...prev, generalRemarks: value }))
          }
        />
      </Grid>
    </Grid>
  );
};

export default OutwardStock;
