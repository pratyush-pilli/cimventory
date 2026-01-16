import React from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Avatar,
  Menu,
  MenuItem,
} from "@mui/material";
import { AccountCircle, Logout } from "@mui/icons-material";
import AdminNavigation from "./AdminNavigation";

interface AdminLayoutProps {
  children: React.ReactNode;
  currentUser?: {
    username: string;
    role: string;
    division_name: string;
  };
}

const AdminLayout: React.FC<AdminLayoutProps> = ({ children, currentUser }) => {
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    // Handle logout logic
    handleClose();
  };

  return (
    <Box sx={{ display: "flex" }}>
      <AdminNavigation currentUser={currentUser} />

      <Box sx={{ flexGrow: 1 }}>
        <AppBar
          position="static"
          sx={{ bgcolor: "white", color: "black", boxShadow: 1 }}
        >
          <Toolbar>
            <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
              CIMCON Purchase Module - Administration
            </Typography>

            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              onClick={handleMenu}
              color="inherit"
            >
              <AccountCircle />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorEl={anchorEl}
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleClose}>Profile</MenuItem>
              <MenuItem onClick={handleClose}>Settings</MenuItem>
              <MenuItem onClick={handleLogout}>
                <Logout sx={{ mr: 1 }} />
                Logout
              </MenuItem>
            </Menu>
          </Toolbar>
        </AppBar>

        <Box
          component="main"
          sx={{ flexGrow: 1, bgcolor: "#f5f5f5", minHeight: "100vh" }}
        >
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default AdminLayout;
