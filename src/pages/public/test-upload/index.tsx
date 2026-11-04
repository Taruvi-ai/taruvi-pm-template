import { useState } from "react";
import {
  Box,
  Container,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  Grid,
  TextField,
  Stack,
  Alert,
} from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import { uploadFile, getStorageUrl } from "../../../utils/storageHelpers";

export const TestUploadPage = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedPath, setUploadedPath] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string>("");
  const [title, setTitle] = useState<string>("");

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("Please select a file first");
      return;
    }

    setUploading(true);
    setError("");

    try {
      const path = await uploadFile("test-uploads", selectedFile, {
        prefix: "test",
      });
      setUploadedPath(path);
      console.log("Upload successful! Path:", path);
    } catch (err) {
      console.error("Upload failed:", err);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const imageUrl = uploadedPath ? getStorageUrl("test-uploads", uploadedPath) : null;

  return (
    <Box sx={{ bgcolor: "#F5F5F5", minHeight: "100vh", py: 6 }}>
      <Container maxWidth="md">
        {/* Header */}
        <Box sx={{ mb: 6, textAlign: "center" }}>
          <Typography
            variant="h1"
            sx={{
              fontSize: { xs: "2rem", md: "3rem" },
              fontWeight: 700,
              fontFamily: "Playfair Display, serif",
              color: "#8B1538",
              mb: 2,
            }}
          >
            File Upload Test
          </Typography>
          <Box
            sx={{
              width: "100px",
              height: "4px",
              bgcolor: "#D4AF37",
              mx: "auto",
              mb: 3,
            }}
          />
          <Typography variant="h6" color="text.secondary">
            Test the storage helper utilities
          </Typography>
        </Box>

        <Grid container spacing={4}>
          {/* Upload Form */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="h5" gutterBottom fontWeight={600}>
                  Upload Image
                </Typography>

                <Stack spacing={3} sx={{ mt: 3 }}>
                  {/* Title Input */}
                  <TextField
                    label="Image Title (optional)"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    fullWidth
                  />

                  {/* File Input */}
                  <Box>
                    <Button
                      component="label"
                      variant="outlined"
                      startIcon={<CloudUploadIcon />}
                      fullWidth
                      sx={{
                        py: 2,
                        borderStyle: "dashed",
                        borderWidth: 2,
                      }}
                    >
                      {selectedFile ? selectedFile.name : "Choose File"}
                      <input
                        type="file"
                        hidden
                        accept="image/*"
                        onChange={handleFileSelect}
                      />
                    </Button>

                    {selectedFile && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                        Size: {(selectedFile.size / 1024).toFixed(2)} KB
                      </Typography>
                    )}
                  </Box>

                  {/* Upload Button */}
                  <Button
                    variant="contained"
                    onClick={handleUpload}
                    disabled={!selectedFile || uploading}
                    fullWidth
                    sx={{
                      py: 1.5,
                      bgcolor: "#8B1538",
                      "&:hover": { bgcolor: "#6A0F2A" },
                    }}
                  >
                    {uploading ? "Uploading..." : "Upload File"}
                  </Button>

                  {/* Error Alert */}
                  {error && (
                    <Alert severity="error" onClose={() => setError("")}>
                      {error}
                    </Alert>
                  )}

                  {/* Success Alert */}
                  {uploadedPath && !uploading && (
                    <Alert severity="success">
                      Upload successful! Path: <code>{uploadedPath}</code>
                    </Alert>
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>

          {/* Preview */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ height: "100%" }}>
              <CardContent>
                <Typography variant="h5" gutterBottom fontWeight={600}>
                  Preview
                </Typography>

                {imageUrl ? (
                  <Box sx={{ mt: 3 }}>
                    <CardMedia
                      component="img"
                      image={imageUrl}
                      alt={title || "Uploaded image"}
                      sx={{
                        borderRadius: 2,
                        maxHeight: 400,
                        objectFit: "contain",
                        border: "2px solid #D4AF37",
                      }}
                    />

                    <Box sx={{ mt: 2, p: 2, bgcolor: "#F5F5F5", borderRadius: 1 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        <strong>File Path:</strong>
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "monospace",
                          wordBreak: "break-all",
                        }}
                      >
                        {uploadedPath}
                      </Typography>

                      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 2 }}>
                        <strong>Storage URL:</strong>
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{
                          fontFamily: "monospace",
                          wordBreak: "break-all",
                        }}
                      >
                        {imageUrl}
                      </Typography>
                    </Box>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      mt: 3,
                      p: 6,
                      textAlign: "center",
                      border: "2px dashed #DDD",
                      borderRadius: 2,
                      bgcolor: "#FAFAFA",
                    }}
                  >
                    <CloudUploadIcon sx={{ fontSize: 60, color: "#CCC", mb: 2 }} />
                    <Typography variant="body1" color="text.secondary">
                      No file uploaded yet
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Upload an image to see the preview
                    </Typography>
                  </Box>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Instructions */}
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom fontWeight={600}>
                  How it works
                </Typography>
                <Typography variant="body2" color="text.secondary" paragraph>
                  This page demonstrates the file upload helpers from{" "}
                  <code>/src/utils/storageHelpers.ts</code>:
                </Typography>

                <Box component="ol" sx={{ pl: 3 }}>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Select an image file
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Click "Upload File" - calls <code>uploadFile(bucket, file, options)</code>
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      File is uploaded to the <code>test-uploads</code> bucket
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Path is returned (e.g., <code>test-1234567890-image.jpg</code>)
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      URL is generated using <code>getStorageUrl(bucket, path)</code>
                    </Typography>
                  </li>
                  <li>
                    <Typography variant="body2" color="text.secondary">
                      Image is displayed in the preview
                    </Typography>
                  </li>
                </Box>

                <Alert severity="info" sx={{ mt: 3 }}>
                  <strong>Note:</strong> Make sure the <code>test-uploads</code> bucket exists. Create
                  it using: <code>{`mcp__taruvi__create_bucket({name: "test-uploads", visibility: "public"})`}</code>
                </Alert>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};
