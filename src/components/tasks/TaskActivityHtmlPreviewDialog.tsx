import { Box, Dialog, DialogContent, DialogTitle, IconButton, Typography } from "@mui/material";
import { Close } from "@mui/icons-material";
import { sanitizeRichText } from "../../utils/sanitizeHtml";

interface TaskActivityHtmlPreviewDialogProps {
  html: string | null;
  onClose: () => void;
  open: boolean;
  title: string;
}

export const TaskActivityHtmlPreviewDialog = ({
  html,
  onClose,
  open,
  title,
}: TaskActivityHtmlPreviewDialogProps) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span>{title}</span>
        <IconButton size="small" aria-label="Close preview" onClick={onClose}>
          <Close fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>
        {html ? (
          <Box
            sx={{
              typography: "body2",
              "& a": { color: "primary.main", textDecoration: "underline" },
              "& pre": {
                bgcolor: "grey.50",
                borderRadius: 1,
                p: 1,
                overflowX: "auto",
              },
            }}
            dangerouslySetInnerHTML={{ __html: sanitizeRichText(html) }}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">
            No content
          </Typography>
        )}
      </DialogContent>
    </Dialog>
  );
};
