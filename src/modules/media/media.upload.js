import path from "node:path";

import multer from "multer";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".pdf", ".doc", ".docx"]);

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE, files: 1 },
    fileFilter: (req, file, callback) => {
        const extension = path.extname(file.originalname).toLowerCase();
        callback(extension && allowedExtensions.has(extension) ? null : new Error("Unsupported file extension"), true);
    },
});

export const uploadMedia = (req, res, next) => {
    upload.single("file")(req, res, (error) => {
        if (!error) return next();

        const message = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE"
            ? "File size must not exceed 5MB"
            : error.message || "Invalid upload";
        return res.status(400).json({ success: false, message });
    });
};

const startsWith = (buffer, bytes) =>
    buffer.length >= bytes.length && bytes.every((byte, index) => buffer[index] === byte);

const hasDocxStructure = (buffer) =>
    startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) &&
    buffer.includes(Buffer.from("[Content_Types].xml")) &&
    buffer.includes(Buffer.from("word/"));

const fileDefinitions = {
    ".jpg": { type: "image", mimeType: "image/jpeg", valid: (buffer) => startsWith(buffer, [0xff, 0xd8, 0xff]) },
    ".jpeg": { type: "image", mimeType: "image/jpeg", valid: (buffer) => startsWith(buffer, [0xff, 0xd8, 0xff]) },
    ".png": { type: "image", mimeType: "image/png", valid: (buffer) => startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
    ".webp": { type: "image", mimeType: "image/webp", valid: (buffer) => startsWith(buffer, [0x52, 0x49, 0x46, 0x46]) && buffer.subarray(8, 12).toString() === "WEBP" },
    ".pdf": { type: "file", mimeType: "application/pdf", valid: (buffer) => startsWith(buffer, [0x25, 0x50, 0x44, 0x46, 0x2d]) },
    ".doc": { type: "file", mimeType: "application/msword", valid: (buffer) => startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) },
    ".docx": { type: "file", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", valid: hasDocxStructure },
};

export const validateUploadedFile = (file) => {
    if (!file) {
        const error = new Error("A file is required");
        error.status = 400;
        throw error;
    }

    const extension = path.extname(file.originalname).toLowerCase();
    const definition = fileDefinitions[extension];
    if (!definition || file.size > MAX_FILE_SIZE || !definition.valid(file.buffer)) {
        const error = new Error("Unsupported or invalid file content");
        error.status = 400;
        throw error;
    }

    return {
        type: definition.type,
        mimeType: definition.mimeType,
        folder: definition.type === "image" ? "images" : "cv",
    };
};
