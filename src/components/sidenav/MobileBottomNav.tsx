import React, { useState } from "react";
import Paper from "@mui/material/Paper";
import BottomNavigation from "@mui/material/BottomNavigation";
import BottomNavigationAction from "@mui/material/BottomNavigationAction";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Dashboard from "@mui/icons-material/Dashboard";
import MenuIcon from "@mui/icons-material/Menu";
import Logout from "@mui/icons-material/Logout";
import MenuBookOutlined from "@mui/icons-material/MenuBookOutlined";
import ListOutlined from "@mui/icons-material/ListOutlined";
import { useTranslate, type TreeMenuItem, CanAccess } from "@refinedev/core";

interface MobileBottomNavProps {
  menuItems: TreeMenuItem[];
  selectedKey: string;
  onNavigate: (route: string) => void;
  onLogout: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  menuItems,
  selectedKey,
  onNavigate,
  onLogout,
}) => {
  const t = useTranslate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  // Show first 3 items in bottom nav, rest in "More" menu
  const visibleItems = menuItems.slice(0, 3);
  const moreItems = menuItems.slice(3);
  const hasUtilityItems = true;
  const hasMoreItems = moreItems.length > 0 || hasUtilityItems;

  const handleChange = (_event: React.SyntheticEvent, newValue: string) => {
    if (newValue === "more") {
      return; // Handled by onClick
    }
    onNavigate(newValue);
  };

  const handleMoreClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMoreClose = () => {
    setAnchorEl(null);
  };

  const handleMoreItemClick = (route: string) => {
    onNavigate(route);
    handleMoreClose();
  };

  const handleLogoutClick = () => {
    onLogout();
    handleMoreClose();
  };

  const handleGuideClick = () => {
    window.open("/user-guide/index.html", "_blank", "noopener,noreferrer");
    handleMoreClose();
  };

  // Determine which value is selected
  const getSelectedValue = () => {
    if (selectedKey === "/" || selectedKey === "dashboard") return "/";
    const visibleItem = visibleItems.find(
      (item) => item.route === selectedKey || item.key === selectedKey
    );
    if (visibleItem) return visibleItem.route || visibleItem.key || "";
    return "";
  };

  return (
    <>
      <Paper
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          display: { xs: "block", md: "none" },
          zIndex: 1200,
          borderTop: 1,
          borderColor: "divider",
        }}
        elevation={3}
      >
        <BottomNavigation
          value={getSelectedValue()}
          onChange={handleChange}
          showLabels
        >
          {/* Dashboard */}
          <BottomNavigationAction
            label={t("dashboard.title", "Dashboard")}
            icon={<Dashboard />}
            value="/"
          />

          {/* Visible menu items */}
          {visibleItems.map((item) => (
            <CanAccess
              key={item.key || item.name}
              resource={item.name}
              action="list"
              params={{ resource: item }}
            >
              <BottomNavigationAction
                label={item.label || item.name}
                icon={item.icon || <ListOutlined />}
                value={item.route || item.key || ""}
              />
            </CanAccess>
          ))}

          {/* More menu */}
          {hasMoreItems && (
            <BottomNavigationAction
              label={t("buttons.more", "More")}
              icon={<MenuIcon />}
              value="more"
              onClick={handleMoreClick}
            />
          )}
        </BottomNavigation>
      </Paper>

      {/* More menu popup */}
      <Menu
        anchorEl={anchorEl}
        open={menuOpen}
        onClose={handleMoreClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "center",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "center",
        }}
      >
        {moreItems.map((item) => (
          <CanAccess
            key={item.key || item.name}
            resource={item.name}
            action="list"
            params={{ resource: item }}
          >
            <MenuItem
              onClick={() => handleMoreItemClick(item.route || "/")}
              selected={item.route === selectedKey || item.key === selectedKey}
            >
              <ListItemIcon>{item.icon || <ListOutlined />}</ListItemIcon>
              <ListItemText primary={item.label || item.name} />
            </MenuItem>
          </CanAccess>
        ))}
        <MenuItem onClick={handleGuideClick}>
          <ListItemIcon>
            <MenuBookOutlined fontSize="small" />
          </ListItemIcon>
          <ListItemText primary="User Guide" />
        </MenuItem>
        <MenuItem onClick={handleLogoutClick}>
          <ListItemIcon>
            <Logout fontSize="small" />
          </ListItemIcon>
          <ListItemText primary={t("buttons.logout", "Logout")} />
        </MenuItem>
      </Menu>
    </>
  );
};
