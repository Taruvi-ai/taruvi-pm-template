import { Box, Divider, IconButton, Stack, TextField, Tooltip } from "@mui/material";
import {
  BorderHorizontal,
  BorderVertical,
  DataObject,
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  FormatUnderlined,
  Link as LinkIcon,
  StrikethroughS,
  TableChart,
  TableRows,
  TextDecrease,
  TextIncrease,
  ViewColumn,
} from "@mui/icons-material";
import { useEffect, useRef, useState } from "react";
import { modalPrompt } from "../dialogs/globalDialogs";
import { sanitizeRichText } from "../../utils/sanitizeHtml";

export const RichTextEditor = ({
  value,
  onChange,
}: {
  value?: string;
  onChange: (value: string) => void;
}) => {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const isFocusedRef = useRef(false);
  const [isSourceMode, setIsSourceMode] = useState(false);

  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const nextValue = sanitizeRichText(value);
    if (isFocusedRef.current || isSourceMode) return;
    if (el.innerHTML !== nextValue) {
      el.innerHTML = nextValue;
      const anchors = el.querySelectorAll("a");
      anchors.forEach((anchor) => {
        anchor.setAttribute("target", "_blank");
        anchor.setAttribute("rel", "noopener noreferrer");
      });
    }
  }, [value, isSourceMode]);

  const escapeHtml = (input: string) =>
    input
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");

  const applyCommand = (command: string, commandValue?: string) => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    document.execCommand(command, false, commandValue);
    onChange(el.innerHTML);
  };

  const getFontSizeWrapper = (node: Node | null, root: HTMLElement) => {
    if (!node) return null;
    const element = node instanceof Element ? node : node.parentElement;
    if (!element) return null;
    const span = element.closest("span[data-rte-font-size='true'], span[style*='font-size']");
    if (!span || !root.contains(span)) return null;
    return span as HTMLSpanElement;
  };

  const handleAdjustFontSize = (deltaPx: number) => {
    const el = editorRef.current;
    if (!el || isSourceMode) return;

    el.focus();
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    const range = selection.getRangeAt(0);
    if (range.collapsed) return;

    const commonAncestor =
      range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;
    if (!commonAncestor || !el.contains(commonAncestor)) return;

    const startWrapper = getFontSizeWrapper(range.startContainer, el);
    const endWrapper = getFontSizeWrapper(range.endContainer, el);
    const wrapperToAdjust =
      startWrapper && endWrapper && startWrapper === endWrapper ? startWrapper : null;

    if (wrapperToAdjust) {
      const currentFontSize = Number.parseFloat(
        wrapperToAdjust.style.fontSize || window.getComputedStyle(wrapperToAdjust).fontSize
      ) || 14;
      const nextFontSize = Math.max(10, Math.min(72, currentFontSize + deltaPx));
      wrapperToAdjust.style.fontSize = `${nextFontSize}px`;
      wrapperToAdjust.setAttribute("data-rte-font-size", "true");
      onChange(el.innerHTML);
      return;
    }

    const startElement =
      range.startContainer instanceof Element
        ? range.startContainer
        : range.startContainer.parentElement;
    const currentFontSize = Number.parseFloat(
      startElement ? window.getComputedStyle(startElement).fontSize : "14px"
    ) || 14;
    const nextFontSize = Math.max(10, Math.min(72, currentFontSize + deltaPx));

    const extracted = range.extractContents();
    if (!extracted || extracted.childNodes.length === 0) return;

    const span = document.createElement("span");
    span.style.fontSize = `${nextFontSize}px`;
    span.setAttribute("data-rte-font-size", "true");
    span.appendChild(extracted);
    range.insertNode(span);

    const nextRange = document.createRange();
    nextRange.selectNodeContents(span);
    selection.removeAllRanges();
    selection.addRange(nextRange);

    onChange(el.innerHTML);
  };

  const handleLink = async () => {
    const el = editorRef.current;
    if (!el || isSourceMode) return;

    const selection = window.getSelection();
    const savedRange = selection && selection.rangeCount > 0 ? selection.getRangeAt(0).cloneRange() : null;
    const selectionNode = savedRange?.startContainer || selection?.anchorNode || null;
    const anchor =
      selectionNode instanceof Element
        ? selectionNode.closest("a")
        : selectionNode?.parentElement?.closest("a") || null;
    const currentUrl = anchor?.getAttribute("href") || "";
    const currentText = String(anchor?.textContent || savedRange?.toString() || "").trim();
    const url = await modalPrompt("Enter a URL", currentUrl, "Insert Link");
    if (!url) return;
    const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    const linkTextInput = await modalPrompt("Enter link text", currentText || normalizedUrl, "Link Text");
    if (linkTextInput === null) return;
    const linkText = String(linkTextInput || "").trim() || normalizedUrl;

    el.focus();
    const activeSelection = window.getSelection();
    if (savedRange && activeSelection) {
      activeSelection.removeAllRanges();
      activeSelection.addRange(savedRange);
    }

    if (anchor) {
      anchor.setAttribute("href", normalizedUrl);
      anchor.setAttribute("target", "_blank");
      anchor.setAttribute("rel", "noopener noreferrer");
      anchor.textContent = linkText;
      onChange(el.innerHTML);
      return;
    }

    if (savedRange?.collapsed) {
      const anchorHtml = `<a href="${escapeHtml(normalizedUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(linkText)}</a>`;
      applyCommand("insertHTML", anchorHtml);
      return;
    }

    applyCommand("createLink", normalizedUrl);
    const updatedSelection = window.getSelection();
    const createdAnchor =
      updatedSelection?.anchorNode instanceof Element
        ? updatedSelection.anchorNode.closest("a")
        : updatedSelection?.anchorNode?.parentElement?.closest("a") || null;
    if (!createdAnchor) return;
    createdAnchor.setAttribute("target", "_blank");
    createdAnchor.setAttribute("rel", "noopener noreferrer");
    createdAnchor.textContent = linkText;
    onChange(el.innerHTML);
  };

  const handleInsertTable = async () => {
    const rowsInput = await modalPrompt("Table rows", "2", "Insert Table");
    if (!rowsInput) return;
    const colsInput = await modalPrompt("Table columns", "2", "Insert Table");
    if (!colsInput) return;
    const rows = Math.max(1, Number.parseInt(rowsInput, 10) || 0);
    const cols = Math.max(1, Number.parseInt(colsInput, 10) || 0);
    const tableHtml =
      "<table style=\"width:100%; border-collapse: collapse;\">" +
      "<tbody>" +
      Array.from({ length: rows })
        .map(
          () =>
            "<tr>" +
            Array.from({ length: cols })
              .map(
                () =>
                  "<td style=\"border: 1px solid #ddd; padding: 6px;\">&nbsp;</td>"
              )
              .join("") +
            "</tr>"
        )
        .join("") +
      "</tbody></table>";
    applyCommand("insertHTML", tableHtml);
  };

  const getClosestCell = () => {
    const selection = window.getSelection();
    const node = selection?.anchorNode;
    if (!node) return null;
    if (node instanceof Element) return node.closest("td, th");
    return node.parentElement?.closest("td, th") || null;
  };

  const handleAddRow = () => {
    const cell = getClosestCell();
    if (!cell) return;
    const row = cell.closest("tr");
    if (!row || !row.parentElement) return;
    const colCount = row.children.length || 1;
    const newRow = document.createElement("tr");
    for (let i = 0; i < colCount; i += 1) {
      const td = document.createElement("td");
      td.setAttribute("style", "border: 1px solid #ddd; padding: 6px;");
      td.innerHTML = "&nbsp;";
      newRow.appendChild(td);
    }
    row.parentElement.insertBefore(newRow, row.nextSibling);
    onChange(editorRef.current?.innerHTML || "");
  };

  const handleAddColumn = () => {
    const cell = getClosestCell();
    if (!cell) return;
    const table = cell.closest("table");
    if (!table) return;
    const rows = Array.from(table.querySelectorAll("tr"));
    rows.forEach((row) => {
      const td = document.createElement("td");
      td.setAttribute("style", "border: 1px solid #ddd; padding: 6px;");
      td.innerHTML = "&nbsp;";
      row.appendChild(td);
    });
    onChange(editorRef.current?.innerHTML || "");
  };

  const handleRemoveRow = () => {
    const cell = getClosestCell();
    if (!cell) return;
    const row = cell.closest("tr");
    if (!row || !row.parentElement) return;
    const parent = row.parentElement;
    row.remove();
    if (parent.children.length === 0) {
      const table = parent.closest("table");
      table?.remove();
    }
    onChange(editorRef.current?.innerHTML || "");
  };

  const handleRemoveColumn = () => {
    const cell = getClosestCell();
    if (!cell) return;
    const table = cell.closest("table");
    if (!table) return;
    const rows = Array.from(table.querySelectorAll("tr"));
    const cellIndex = Array.from(cell.parentElement?.children || []).indexOf(cell);
    rows.forEach((row) => {
      const cells = Array.from(row.children);
      if (cellIndex >= 0 && cellIndex < cells.length) {
        cells[cellIndex].remove();
      }
    });
    const remainingCols = table.querySelectorAll("tr:first-child td, tr:first-child th").length;
    if (remainingCols === 0) {
      table.remove();
    }
    onChange(editorRef.current?.innerHTML || "");
  };

  return (
    <Box>
      <Stack direction="row" spacing={0.5} sx={{ mb: 1, flexWrap: "wrap" }}>
        <Tooltip title="Bold">
          <span>
            <IconButton size="small" onClick={() => applyCommand("bold")} aria-label="Bold" disabled={isSourceMode}>
              <FormatBold fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Italic">
          <span>
            <IconButton size="small" onClick={() => applyCommand("italic")} aria-label="Italic" disabled={isSourceMode}>
              <FormatItalic fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Underline">
          <span>
            <IconButton size="small" onClick={() => applyCommand("underline")} aria-label="Underline" disabled={isSourceMode}>
              <FormatUnderlined fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Strikethrough">
          <span>
            <IconButton size="small" onClick={() => applyCommand("strikeThrough")} aria-label="Strikethrough" disabled={isSourceMode}>
              <StrikethroughS fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Increase font size">
          <span>
            <IconButton size="small" onClick={() => handleAdjustFontSize(2)} aria-label="Increase font size" disabled={isSourceMode}>
              <TextIncrease fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Decrease font size">
          <span>
            <IconButton size="small" onClick={() => handleAdjustFontSize(-2)} aria-label="Decrease font size" disabled={isSourceMode}>
              <TextDecrease fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title="Bulleted list">
          <span>
            <IconButton size="small" onClick={() => applyCommand("insertUnorderedList")} aria-label="Bulleted list" disabled={isSourceMode}>
              <FormatListBulleted fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Numbered list">
          <span>
            <IconButton size="small" onClick={() => applyCommand("insertOrderedList")} aria-label="Numbered list" disabled={isSourceMode}>
              <FormatListNumbered fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title="Insert link">
          <span>
            <IconButton size="small" onClick={handleLink} aria-label="Insert link" disabled={isSourceMode}>
              <LinkIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Insert table">
          <span>
            <IconButton size="small" onClick={handleInsertTable} aria-label="Insert table" disabled={isSourceMode}>
              <TableChart fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Add table row">
          <span>
            <IconButton size="small" onClick={handleAddRow} aria-label="Add table row" disabled={isSourceMode}>
              <TableRows fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Add table column">
          <span>
            <IconButton size="small" onClick={handleAddColumn} aria-label="Add table column" disabled={isSourceMode}>
              <ViewColumn fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Delete table row">
          <span>
            <IconButton size="small" onClick={handleRemoveRow} aria-label="Remove table row" disabled={isSourceMode}>
              <BorderHorizontal fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Delete table column">
          <span>
            <IconButton size="small" onClick={handleRemoveColumn} aria-label="Remove table column" disabled={isSourceMode}>
              <BorderVertical fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />
        <Tooltip title={isSourceMode ? "Switch to visual editor" : "Switch to HTML source"}>
          <span>
            <IconButton
              size="small"
              onClick={() => {
                isFocusedRef.current = false;
                setIsSourceMode((prev) => !prev);
              }}
              aria-label="Toggle HTML source"
              color={isSourceMode ? "primary" : "default"}
            >
              <DataObject fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
      {isSourceMode ? (
        <TextField
          value={value || ""}
          onChange={(event) => onChange(event.target.value)}
          multiline
          minRows={8}
          fullWidth
          size="small"
          placeholder="Edit HTML source"
          sx={{
            "& .MuiInputBase-root": {
              fontFamily: "monospace",
              fontSize: "0.85rem",
            },
          }}
        />
      ) : (
        <Box
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onFocus={() => {
            isFocusedRef.current = true;
          }}
          onBlur={() => {
            isFocusedRef.current = false;
          }}
          onInput={(event) => {
            const target = event.currentTarget as HTMLDivElement;
            const anchors = target.querySelectorAll("a");
            anchors.forEach((anchor) => {
              anchor.setAttribute("target", "_blank");
              anchor.setAttribute("rel", "noopener noreferrer");
            });
            onChange(target.innerHTML);
          }}
          sx={{
            minHeight: 140,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            px: 1.5,
            py: 1,
            typography: "body2",
            bgcolor: "background.paper",
            "&:focus": {
              outline: "none",
              borderColor: "primary.main",
              boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}22`,
            },
            "& a": {
              color: "primary.main",
              textDecoration: "underline",
            },
          }}
        />
      )}
    </Box>
  );
};
