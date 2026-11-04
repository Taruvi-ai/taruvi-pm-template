import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from "@mui/material";

type DialogKind = "alert" | "confirm" | "prompt";

type DialogRequest = {
  kind: DialogKind;
  message: string;
  title?: string;
  defaultValue?: string;
};

type DialogResolver = (value: unknown) => void;

type PendingDialog = {
  request: DialogRequest;
  resolve: DialogResolver;
};

let presenter: ((request: DialogRequest) => Promise<unknown>) | null = null;

const enqueueDialog = (request: DialogRequest) => {
  if (presenter) {
    return presenter(request);
  }
  if (request.kind === "confirm") {
    return Promise.resolve(window.confirm(request.message));
  }
  if (request.kind === "prompt") {
    return Promise.resolve(window.prompt(request.message, request.defaultValue ?? "") ?? null);
  }
  window.alert(request.message);
  return Promise.resolve(undefined);
};

export const modalAlert = (message: string, title = "Information") =>
  enqueueDialog({ kind: "alert", message, title }).then(() => undefined);

export const modalConfirm = (message: string, title = "Please Confirm") =>
  enqueueDialog({ kind: "confirm", message, title }).then((value) => Boolean(value));

export const modalPrompt = (message: string, defaultValue = "", title = "Input Required") =>
  enqueueDialog({ kind: "prompt", message, defaultValue, title }).then((value) =>
    value === null || value === undefined ? null : String(value)
  );

export const GlobalDialogsHost = () => {
  const [queue, setQueue] = useState<PendingDialog[]>([]);
  const [promptValue, setPromptValue] = useState("");

  const activeDialog = queue[0] ?? null;

  useEffect(() => {
    presenter = (request: DialogRequest) =>
      new Promise((resolve) => {
        setQueue((prev) => [...prev, { request, resolve }]);
      });
    return () => {
      presenter = null;
    };
  }, []);

  useEffect(() => {
    if (activeDialog?.request.kind === "prompt") {
      setPromptValue(activeDialog.request.defaultValue ?? "");
      return;
    }
    setPromptValue("");
  }, [activeDialog]);

  const title = useMemo(() => {
    if (!activeDialog) return "";
    if (activeDialog.request.title) return activeDialog.request.title;
    if (activeDialog.request.kind === "confirm") return "Please Confirm";
    if (activeDialog.request.kind === "prompt") return "Input Required";
    return "Information";
  }, [activeDialog]);

  const closeWith = (value: unknown) => {
    if (!activeDialog) return;
    activeDialog.resolve(value);
    setQueue((prev) => prev.slice(1));
  };

  return (
    <Dialog
      open={!!activeDialog}
      onClose={() => {
        if (!activeDialog) return;
        if (activeDialog.request.kind === "confirm") {
          closeWith(false);
          return;
        }
        if (activeDialog.request.kind === "prompt") {
          closeWith(null);
          return;
        }
        closeWith(undefined);
      }}
      fullWidth
      maxWidth="xs"
    >
      {activeDialog && (
        <>
          <DialogTitle>{title}</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ whiteSpace: "pre-wrap" }}>
              {activeDialog.request.message}
            </DialogContentText>
            {activeDialog.request.kind === "prompt" && (
              <TextField
                autoFocus
                fullWidth
                margin="dense"
                value={promptValue}
                onChange={(event) => setPromptValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    closeWith(promptValue);
                  }
                }}
              />
            )}
          </DialogContent>
          <DialogActions>
            {activeDialog.request.kind === "confirm" && (
              <Button onClick={() => closeWith(false)}>Cancel</Button>
            )}
            {activeDialog.request.kind === "prompt" && (
              <Button onClick={() => closeWith(null)}>Cancel</Button>
            )}
            <Button
              variant="contained"
              onClick={() => {
                if (activeDialog.request.kind === "confirm") {
                  closeWith(true);
                  return;
                }
                if (activeDialog.request.kind === "prompt") {
                  closeWith(promptValue);
                  return;
                }
                closeWith(undefined);
              }}
            >
              {activeDialog.request.kind === "confirm" ? "Confirm" : "OK"}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
};
