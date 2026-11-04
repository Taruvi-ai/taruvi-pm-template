import React, { useState } from "react";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Collapse from "@mui/material/Collapse";
import List from "@mui/material/List";
import ExpandLess from "@mui/icons-material/ExpandLess";
import ExpandMore from "@mui/icons-material/ExpandMore";
import ListOutlined from "@mui/icons-material/ListOutlined";
import { CanAccess, type TreeMenuItem } from "@refinedev/core";

const MAX_LABEL_EXPANDED = 40;
const MAX_LABEL_COLLAPSED = 10;

const truncateLabel = (text: string, expanded: boolean) => {
  if (expanded) {
    return text.length > MAX_LABEL_EXPANDED ? text.slice(0, MAX_LABEL_EXPANDED) + "…" : text;
  }
  const spaceIdx = text.indexOf(" ");
  if (spaceIdx === -1) {
    return text.length > MAX_LABEL_COLLAPSED ? text.slice(0, MAX_LABEL_COLLAPSED) + "…" : text;
  }
  const line1 = text.slice(0, spaceIdx);
  const rest = text.slice(spaceIdx + 1);
  const line2 = rest.length > MAX_LABEL_COLLAPSED ? rest.slice(0, MAX_LABEL_COLLAPSED) + "…" : rest;
  return line1 + "\n" + line2;
};

interface MenuItemProps {
  item: TreeMenuItem;
  selectedKey: string;
  expanded: boolean;
  depth?: number;
  onNavigate: (route: string) => void;
}

export const MenuItem: React.FC<MenuItemProps> = ({
  item,
  selectedKey,
  expanded,
  depth = 0,
  onNavigate,
}) => {
  const [open, setOpen] = useState(false);

  const hasChildren = item.children && item.children.length > 0;
  const isSelected = item.key === selectedKey || item.route === selectedKey;
  const paddingLeft = expanded ? 2 + depth * 2 : 1;

  const handleClick = () => {
    if (hasChildren) {
      setOpen(!open);
    } else if (item.route) {
      onNavigate(item.route);
    }
  };

  const button = (
    <ListItemButton
      onClick={handleClick}
      selected={isSelected}
      sx={{
        pl: expanded ? paddingLeft : undefined,
        minHeight: 48,
        flexDirection: expanded ? "row" : "column",
        justifyContent: expanded ? "initial" : "center",
        alignItems: "center",
        borderRadius: expanded ? 1 : 0,
        mx: expanded ? 1 : 0,
        mb: 0.5,
        py: expanded ? 1 : 1.5,
      }}
    >
      <ListItemIcon
        sx={{
          minWidth: 0,
          mr: expanded ? 2 : 0,
          justifyContent: "center",
        }}
      >
        {item.icon || <ListOutlined />}
      </ListItemIcon>
      <ListItemText
        primary={truncateLabel(item.label || item.name, expanded)}
        sx={{
          m: 0,
          mt: expanded ? 0 : 0.5,
          textAlign: expanded ? "left" : "center",
        }}
        primaryTypographyProps={{
          fontSize: expanded ? 14 : 10,
          fontWeight: isSelected ? 600 : 500,
          noWrap: expanded,
          whiteSpace: expanded ? "nowrap" : "pre",
        }}
      />
      {hasChildren && expanded && (open ? <ExpandLess /> : <ExpandMore />)}
    </ListItemButton>
  );

  const wrappedButton = button;

  return (
    <CanAccess
      resource={item.name}
      action="list"
      params={{ resource: item }}
    >
      {wrappedButton}
      {hasChildren && (
        <Collapse in={open && expanded} timeout="auto" unmountOnExit>
          <List component="div" disablePadding>
            {item.children.map((child) => (
              <MenuItem
                key={child.key || child.name}
                item={child}
                selectedKey={selectedKey}
                expanded={expanded}
                depth={depth + 1}
                onNavigate={onNavigate}
              />
            ))}
          </List>
        </Collapse>
      )}
    </CanAccess>
  );
};
