import React from "react";
import { Card, CardContent, Typography, Box, Paper } from "@mui/material";
import "./POCards.scss";

interface POLineItem {
  item_no: string;
  material_description: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  make: string;
  material_group: string;
}

interface PurchaseOrder {
  po_number: string;
  vendor_name: string;
  po_date: string;
  total_amount: number;
  project_code: string;
  status: string;
  rejection_remarks?: string;
  line_items: POLineItem[];
}

interface POCardsProps {
  purchaseOrders: PurchaseOrder[];
  onCardClick: (po: PurchaseOrder) => void;
}

const POCards: React.FC<POCardsProps> = ({ purchaseOrders, onCardClick }) => {
  return (
    <div className="po-cards">
      {purchaseOrders.map((po) => (
        <Paper
          key={po.po_number}
          className={`po-card ${po.status.toLowerCase()}`}
          onClick={() => onCardClick(po)}
          elevation={3}
        >
          <Box sx={{ p: 2 }}>
            <Typography variant="h6" component="div">
              PO Number: {po.po_number}
            </Typography>

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
                  color: "error.main",
                }}
              >
                {po.status}
              </Typography>
            </Box>

            <Typography color="text.secondary" sx={{ mt: 1 }}>
              Vendor: {po.vendor_name}
            </Typography>
            <Typography color="text.secondary">
              Project Code: {po.project_code}
            </Typography>
            <Typography color="text.secondary">
              PO Date: {new Date(po.po_date).toLocaleDateString()}
            </Typography>
            <Typography color="text.secondary">
              Total Amount: ₹{po.total_amount.toLocaleString()}
            </Typography>
            <Typography color="text.secondary">
              Total Items: {po.line_items.length}
            </Typography>

            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle2" gutterBottom>
                Items in this PO:
              </Typography>
              {po.line_items.map((item, index) => (
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
                    Item No: {item.item_no}
                  </Typography>
                  <Typography variant="body2">
                    Description: {item.material_description}
                  </Typography>
                  <Typography variant="body2">
                    Quantity: {item.quantity}
                  </Typography>
                  <Typography variant="body2">
                    Unit Price: ₹{item.unit_price}
                  </Typography>
                </Box>
              ))}
            </Box>

            {po.rejection_remarks && (
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
                  {po.rejection_remarks}
                </Typography>
              </Box>
            )}
          </Box>
        </Paper>
      ))}
    </div>
  );
};

export default POCards;
