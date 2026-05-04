"use client";

import React, { useState } from "react";
import { Menu, MenuItem, Box, Divider } from "@mui/material";

interface DropdownMenuProps {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "left" | "right";
  width?: string;
  className?: string;
}

export function DropdownMenu({
  trigger,
  children,
  width = "240px",
}: DropdownMenuProps) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box sx={{ display: 'inline-block' }}>
      <Box onClick={handleClick} sx={{ cursor: 'pointer' }}>
        {trigger}
      </Box>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        PaperProps={{
          sx: {
            mt: 1.5,
            minWidth: width,
            bgcolor: 'rgba(10, 10, 10, 0.95)',
            backdropFilter: 'blur(25px) saturate(180%)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '20px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
            backgroundImage: 'none',
            color: 'white',
            overflow: 'visible',
            '&:before': {
              content: '""',
              display: 'block',
              position: 'absolute',
              top: 0,
              right: 14,
              width: 10,
              height: 10,
              bgcolor: 'rgba(10, 10, 10, 0.95)',
              transform: 'translateY(-50%) rotate(45deg)',
              zIndex: 0,
              borderLeft: '1px solid rgba(255, 255, 255, 0.1)',
              borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            },
          }
        }}
      >
        {children}
      </Menu>
    </Box>
  );
}

export function DropdownMenuItem({
  children,
  onClick,
  disabled = false,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <MenuItem 
      onClick={onClick} 
      disabled={disabled}
      sx={{
        px: 2.5,
        py: 1.5,
        fontSize: '0.875rem',
        fontWeight: 600,
        '&:hover': { bgcolor: 'rgba(255, 255, 255, 0.05)' },
        '&.Mui-disabled': { opacity: 0.5 }
      }}
    >
      {children}
    </MenuItem>
  );
}

export function DropdownMenuSeparator() {
  return <Divider sx={{ my: 1, borderColor: 'rgba(255, 255, 255, 0.05)' }} />;
}
