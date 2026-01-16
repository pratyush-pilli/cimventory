import React from "react";
import {
  Paper,
  Grid,
  Typography,
  Box,
  Chip,
  TextField,
  Button,
  LinearProgress,
  Tooltip,
  Divider,
  List,
  ListItem,
  ListItemText,
} from "@mui/material";
import { RequiredItem, LocationStock } from "../types"; // Create this types file

interface ItemCardProps {
  item: RequiredItem;
  locationStocks: { [key: string]: LocationStock };
  onAddToCart: (item: RequiredItem, location: string, quantity: number) => void;
  cartQuantities?: { [location: string]: number };
  selectedProject: string;
}

const getStatusColor = (
  status: string
): "success" | "warning" | "error" | "default" => {
  switch (status) {
    case "Ready for Outward":
      return "success";
    case "Available for Allocation":
      return "warning";
    case "Insufficient Stock":
      return "error";
    default:
      return "default";
  }
};

const formatLocationName = (location: string): string => {
  return location
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
    .replace(" Stock", "");
};

// Format date for display
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const ItemCard: React.FC<ItemCardProps> = ({
  item,
  locationStocks,
  onAddToCart,
  cartQuantities,
  selectedProject,
}) => {
  // Determine the progress color based on percentage
  const getProgressColor = (progress: number) => {
    if (progress >= 100) return "success";
    if (progress >= 50) return "primary";
    if (progress >= 25) return "info";
    return "warning";
  };

  return (
    <Paper sx={{ p: 2, mb: 2 }}>
      <Grid container spacing={2}>
        {/* Item Details */}
        <Grid item xs={12}>
          <Box
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <Typography variant="subtitle1" fontWeight="bold">
              {item.item_no}
            </Typography>
            <Chip
              label={item.status}
              color={getStatusColor(item.status)}
              size="small"
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {item.description}
          </Typography>
          <Typography variant="caption" display="block">
            Make: {item.make} | Material Group: {item.material_group || "N/A"}
          </Typography>

          {/* Outward Progress */}
          {item.outward_progress !== undefined && (
            <Box mt={1}>
              <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
              >
                <Typography variant="body2">
                  <strong>Outward Progress:</strong>
                </Typography>
                <Typography variant="body2">
                  <strong>{item.outwarded_quantity || 0}</strong> of{" "}
                  {item.required_quantity} ({Math.round(item.outward_progress)}
                  %)
                </Typography>
              </Box>
              <Tooltip title={`${Math.round(item.outward_progress)}% complete`}>
                <LinearProgress
                  variant="determinate"
                  value={item.outward_progress}
                  color={getProgressColor(item.outward_progress)}
                  sx={{ mt: 0.5, mb: 1, height: 8, borderRadius: 1 }}
                />
              </Tooltip>
            </Box>
          )}

          {/* Outward Status Chips */}
          <Box display="flex" flexWrap="wrap" gap={1} mt={1}>
            {item.remaining_quantity !== undefined &&
              item.remaining_quantity > 0 && (
                <Chip
                  label={`Remaining: ${item.remaining_quantity}`}
                  color="info"
                  size="small"
                  variant="outlined"
                />
              )}

            {item.outwarded_quantity !== undefined &&
              item.outwarded_quantity > 0 && (
                <Chip
                  label={`Outwarded: ${item.outwarded_quantity}`}
                  color={
                    item.outwarded_quantity >= item.required_quantity
                      ? "success"
                      : "primary"
                  }
                  size="small"
                  variant="outlined"
                />
              )}
          </Box>
        </Grid>

        <Grid item xs={12}>
          <Divider sx={{ my: 1 }} />
        </Grid>

        {/* Stock Summary */}
        <Grid item xs={3}>
          <Box>
            <Typography variant="body2">
              <strong>Required:</strong> {item.required_quantity}
            </Typography>
            <Typography variant="body2" color="primary.main">
              <strong>Allocated:</strong> {item.allocated_quantity}
            </Typography>
            {item.outwarded_quantity !== undefined && (
              <Typography variant="body2" color="success.main">
                <strong>Outwarded:</strong> {item.outwarded_quantity}
              </Typography>
            )}
            {item.remaining_quantity !== undefined ? (
              <Typography
                variant="body2"
                color={
                  item.remaining_quantity > 0 ? "info.main" : "success.main"
                }
              >
                <strong>Remaining:</strong> {item.remaining_quantity}
              </Typography>
            ) : (
              <Typography
                variant="body2"
                color={
                  item.pending_quantity > 0 ? "error.main" : "success.main"
                }
              >
                <strong>Pending:</strong> {item.pending_quantity}
              </Typography>
            )}
          </Box>

          {/* Recent Outward History */}
          {item.recent_outwards && item.recent_outwards.length > 0 && (
            <Box mt={2}>
              <Typography variant="caption" fontWeight="bold">
                Recent Outwards:
              </Typography>
              <List dense>
                {item.recent_outwards.slice(0, 3).map((outward, index) => (
                  <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={`${outward.quantity} from ${formatLocationName(
                        outward.location
                      )}`}
                      secondary={`${formatDate(outward.created_at)} - ${
                        outward.document_type
                      } #${outward.document_number}`}
                      primaryTypographyProps={{ variant: "body2" }}
                      secondaryTypographyProps={{ variant: "caption" }}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </Grid>

        {/* Location-wise Stock Selection */}
        <Grid item xs={9}>
          <Typography variant="subtitle2" gutterBottom>
            Location-wise Stock:
          </Typography>
          <Box display="flex" flexWrap="wrap" gap={1}>
            {locationStocks &&
              Object.entries(locationStocks).map(([location, stock]) => {
                const locationOutwarded =
                  item.location_outwards?.[location] || 0;
                const stockQuantity =
                  item.outwardType === "allocated"
                    ? stock.allocations
                        .filter((a) => a.project_code === selectedProject)
                        .reduce((sum, a) => sum + a.quantity, 0)
                    : stock.available;

                // Only show locations with either allocated stock or available stock
                if (stockQuantity <= 0) return null;

                const currentCartQty = cartQuantities?.[location] || 0;

                // Use remaining quantity if available
                const maxNeeded =
                  item.remaining_quantity !== undefined
                    ? item.remaining_quantity
                    : item.required_quantity;

                const stockTypeLabel =
                  item.outwardType === "allocated" ? "allocated" : "available";

                return (
                  <Box
                    key={location}
                    sx={{
                      p: 1,
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                      minWidth: 180,
                      flexGrow: 1,
                      bgcolor:
                        locationOutwarded > 0
                          ? "rgba(76, 175, 80, 0.08)"
                          : "transparent",
                    }}
                  >
                    <Box
                      display="flex"
                      justifyContent="space-between"
                      alignItems="center"
                      mb={0.5}
                    >
                      <Typography variant="subtitle2">
                        {formatLocationName(location)}
                      </Typography>
                      {locationOutwarded > 0 && (
                        <Chip
                          label={`Outwarded: ${locationOutwarded}`}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </Box>

                    <Typography variant="body2">
                      {stockTypeLabel}: <strong>{stockQuantity}</strong>
                      {locationOutwarded > 0 &&
                        ` (${stockQuantity + locationOutwarded} originally)`}
                    </Typography>

                    {item.remaining_quantity && item.remaining_quantity > 0 && (
                      <Box
                        sx={{
                          mt: 1,
                          display: "flex",
                          alignItems: "flex-end",
                          gap: 1,
                        }}
                      >
                        <TextField
                          type="number"
                          size="small"
                          label="Quantity"
                          value={currentCartQty}
                          onChange={(e) => {
                            const value = Math.min(
                              Math.max(0, Number(e.target.value)),
                              Math.min(stockQuantity, maxNeeded)
                            );
                            onAddToCart(item, location, value);
                          }}
                          inputProps={{
                            min: 0,
                            max: Math.min(stockQuantity, maxNeeded),
                          }}
                          sx={{ flexGrow: 1 }}
                        />
                        <Button
                          size="small"
                          variant="contained"
                          disabled={stockQuantity === 0 || maxNeeded === 0}
                          onClick={() =>
                            onAddToCart(
                              item,
                              location,
                              Math.min(stockQuantity, maxNeeded)
                            )
                          }
                        >
                          Add
                        </Button>
                      </Box>
                    )}
                  </Box>
                );
              })}
          </Box>
        </Grid>
      </Grid>
    </Paper>
  );
};

export default ItemCard;
