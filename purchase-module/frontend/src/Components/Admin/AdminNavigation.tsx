import React from "react";
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Avatar,
  Chip,
} from "@mui/material";
import {
  Dashboard as DashboardIcon,
  Inventory as InventoryIcon,
  People as PeopleIcon,
  Business as BusinessIcon,
  Receipt as ReceiptIcon,
  Settings as SettingsIcon,
  Assessment as AssessmentIcon,
  Person as PersonIcon,
} from "@mui/icons-material";

interface AdminNavigationProps {
  currentUser?: {
    username: string;
    role: string;
    division_name: string;
  };
}

const AdminNavigation: React.FC<AdminNavigationProps> = ({ currentUser }) => {
  const menuItems = [
    { text: "Dashboard", icon: <DashboardIcon />, path: "/admin" },
    {
      text: "Inventory Management",
      icon: <InventoryIcon />,
      path: "/admin/inventory",
    },
    {
      text: "User Management",
      icon: <PeopleIcon />,
      path: "/admin/users",
    },
    {
      text: "Division Management",
      icon: <BusinessIcon />,
      path: "/admin/divisions",
    },
    { text: "Reports", icon: <AssessmentIcon />, path: "/admin/reports" },
    { text: "Settings", icon: <SettingsIcon />, path: "/admin/settings" },
  ];

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: 280,
        flexShrink: 0,
        "& .MuiDrawer-paper": {
          width: 280,
          boxSizing: "border-box",
          background: "linear-gradient(180deg, #1976d2 0%, #1565c0 100%)",
          color: "white",
        },
      }}
    >
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" fontWeight="bold" sx={{ color: "white" }}>
          Admin Panel
        </Typography>
        {currentUser && (
          <Box sx={{ mt: 2 }}>
            <Box display="flex" alignItems="center" gap={2}>
              <Avatar sx={{ bgcolor: "rgba(255,255,255,0.2)" }}>
                <PersonIcon />
              </Avatar>
              <Box>
                <Typography variant="body2" sx={{ color: "white" }}>
                  {currentUser.username}
                </Typography>
                <Chip
                  label={currentUser.role}
                  size="small"
                  sx={{
                    bgcolor: "rgba(255,255,255,0.2)",
                    color: "white",
                    fontSize: "0.7rem",
                  }}
                />
              </Box>
            </Box>
            <Typography
              variant="caption"
              sx={{ color: "rgba(255,255,255,0.7)", mt: 1, display: "block" }}
            >
              {currentUser.division_name}
            </Typography>
          </Box>
        )}
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.2)" }} />

      <List sx={{ mt: 2 }}>
        {menuItems.map((item) => (
          <ListItem
            button
            key={item.text}
            sx={{
              "&:hover": {
                bgcolor: "rgba(255,255,255,0.1)",
              },
              "&.Mui-selected": {
                bgcolor: "rgba(255,255,255,0.2)",
              },
            }}
          >
            <ListItemIcon sx={{ color: "white" }}>{item.icon}</ListItemIcon>
            <ListItemText
              primary={item.text}
              sx={{
                "& .MuiListItemText-primary": {
                  color: "white",
                  fontWeight: 500,
                },
              }}
            />
          </ListItem>
        ))}
      </List>
    </Drawer>
  );
};

export default AdminNavigation;
