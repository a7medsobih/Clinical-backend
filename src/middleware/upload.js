// multer setup: saves uploaded files in the /uploads folder.
// Only PDF, JPG and PNG files up to 10 MB are accepted.
import fs from "fs";
import path from "path";
import multer from "multer";

// Vercel Functions can only write temporary files under /tmp. Files uploaded
// there must still be copied to durable object storage before production use.
const uploadDirectory = process.env.VERCEL ? "/tmp/clinical-uploads" : "uploads";

if (!process.env.VERCEL) {
  fs.mkdirSync(uploadDirectory, { recursive: true });
}

const allowedTypes = [".pdf", ".jpg", ".jpeg", ".png"];

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    fs.mkdir(uploadDirectory, { recursive: true }, (error) => cb(error, uploadDirectory));
  },
  // A unique name, e.g. 1731660000000-482913.pdf
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
  },
});

function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedTypes.includes(ext)) return cb(null, true);

  const error = new Error("Only PDF, JPG or PNG files are allowed");
  error.status = 400;
  cb(error);
}

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 },
});

// multer reads file names as latin1; this fixes Arabic file names
export function originalName(file) {
  return Buffer.from(file.originalname, "latin1").toString("utf8");
}
