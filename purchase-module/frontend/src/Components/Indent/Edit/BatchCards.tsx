import React from "react";
import { Card, CardContent, Typography, Box, Paper } from "@mui/material";
import "./BatchCards.scss";

interface BatchItem {
  cimcon_part_number: string;
  material_description: string;
  req_qty: number;
}

interface Batch {
  batch_id: string;
  project_code: string;
  requisition_date: string;
  approved_status: boolean;
  status: string;
  rejection_remarks?: string;
  items: BatchItem[];
}

interface BatchCardsProps {
  batches: Batch[];
  onCardClick: (batch: Batch) => void;
}

const BatchCards: React.FC<BatchCardsProps> = ({ batches, onCardClick }) => {
  // Group items by batch_id
  const groupedBatches = batches.reduce((acc, curr) => {
    const existingBatch = acc.find((b) => b.batch_id === curr.batch_id);

    if (existingBatch) {
      // Add item to existing batch
      existingBatch.items.push({
        cimcon_part_number: curr.cimcon_part_number,
        material_description: curr.material_description,
        req_qty: curr.req_qty,
      });
    } else {
      // Create new batch with first item
      acc.push({
        ...curr,
        items: [
          {
            cimcon_part_number: curr.cimcon_part_number,
            material_description: curr.material_description,
            req_qty: curr.req_qty,
          },
        ],
      });
    }
    return acc;
  }, [] as Batch[]);

  return (
    <div className="batch-cards">
      {groupedBatches.map((batch) => {
        const isApproved = batch.approved_status || batch.status === "approved";

        return (
          <Paper
            key={batch.batch_id}
            className={`batch-card ${
              batch.status === "rejected"
                ? "rejected"
                : isApproved
                ? "approved"
                : "pending"
            } ${isApproved ? "no-edit" : ""}`}
            onClick={() => onCardClick(batch)}
            elevation={3}
          >
            <Box sx={{ p: 2 }}>
              <Typography variant="h6" component="div">
                Batch: {batch.batch_id}
              </Typography>

              {/* Status indicator */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mt: 1,
                  justifyContent: "space-between",
                }}
              >
                <Typography
                  variant="body2"
                  sx={{
                    color:
                      batch.status === "rejected"
                        ? "error.main"
                        : isApproved
                        ? "success.main"
                        : "warning.main",
                  }}
                >
                  {batch.status === "rejected"
                    ? "Rejected"
                    : isApproved
                    ? "Approved"
                    : "Pending"}
                </Typography>
                {isApproved && (
                  <Typography
                    variant="caption"
                    sx={{ color: "text.secondary", fontStyle: "italic" }}
                  >
                    (Not Editable)
                  </Typography>
                )}
              </Box>

              {/* Project details */}
              <Typography color="text.secondary" sx={{ mt: 1 }}>
                Project Code: {batch.project_code}
              </Typography>
              <Typography color="text.secondary">
                Requisition Date:{" "}
                {new Date(batch.requisition_date).toLocaleDateString()}
              </Typography>
              <Typography color="text.secondary">
                Total Items: {batch.items.length} item
                {batch.items.length !== 1 ? "s" : ""}
              </Typography>

              {/* Items List */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Items in this batch:
                </Typography>
                {batch.items.map((item, index) => (
                  <Box
                    key={index}
                    sx={{
                      mt: 1,
                      pl: 1,
                      borderLeft: "2px solid",
                      borderColor: "primary.main",
                    }}
                  >
                    <Typography variant="body2">
                      Part Number: {item.cimcon_part_number}
                    </Typography>
                    <Typography variant="body2">
                      Description: {item.material_description}
                    </Typography>
                    <Typography variant="body2">
                      Quantity: {item.req_qty}
                    </Typography>
                  </Box>
                ))}
              </Box>

              {/* Show rejection remarks if rejected */}
              {batch.status === "rejected" && batch.rejection_remarks && (
                <Box
                  sx={{
                    mt: 2,
                    p: 1.5,
                    bgcolor: "error.lighter",
                    borderRadius: 1,
                    border: "1px solid",
                    borderColor: "error.light",
                  }}
                >
                  <Typography
                    variant="subtitle2"
                    color="error.main"
                    sx={{ fontWeight: 600, mb: 0.5 }}
                  >
                    Rejection Reason:
                  </Typography>
                  <Typography variant="body2" color="error.dark">
                    {batch.rejection_remarks}
                  </Typography>
                </Box>
              )}
            </Box>
          </Paper>
        );
      })}
    </div>
  );
};

export default BatchCards;
