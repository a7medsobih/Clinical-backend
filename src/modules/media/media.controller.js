import { mediaIdSchema } from "./media.schema.js";
import { validateUploadedFile } from "./media.upload.js";
import {
    createMedia,
    deleteFromCloudinary,
    deleteMediaById,
    getMediaById,
    uploadBufferToCloudinary,
} from "./media.service.js";

const parseParams = (params, res) => {
    const result = mediaIdSchema.safeParse(params);
    if (result.success) return result.data;

    res.status(400).json({ success: false, message: "Invalid media id" });
    return null;
};

const mediaResponse = (media) => ({
    id: media._id,
    url: media.url,
    type: media.type,
    folder: media.folder,
    size: media.size,
    mimeType: media.mimeType,
    createdAt: media.createdAt,
});

export const uploadMedia = async (req, res, next) => {
    let uploaded;

    try {
        const metadata = validateUploadedFile(req.file);
        uploaded = await uploadBufferToCloudinary(req.file.buffer, metadata);

        const media = await createMedia({
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            type: metadata.type,
            folder: metadata.folder,
            size: uploaded.bytes,
            mimeType: metadata.mimeType,
        });

        return res.status(201).json({ success: true, data: { media: mediaResponse(media) } });
    } catch (error) {
        if (uploaded?.public_id) {
            try {
                await deleteFromCloudinary({ publicId: uploaded.public_id, type: uploaded.resource_type === "image" ? "image" : "file" });
            } catch (cleanupError) {
                console.error("Could not clean up uploaded Cloudinary asset:", cleanupError.message);
            }
        }
        return next(error);
    }
};

export const deleteMedia = async (req, res, next) => {
    try {
        const params = parseParams(req.params, res);
        if (!params) return;

        const media = await getMediaById(params.id);
        if (!media) return res.status(404).json({ success: false, message: "Media not found" });

        const result = await deleteFromCloudinary(media);
        if (result.result !== "ok" && result.result !== "not found") {
            const error = new Error("Could not delete media from Cloudinary");
            error.status = 502;
            throw error;
        }

        await deleteMediaById(params.id);
        return res.status(200).json({ success: true, message: "Media deleted successfully" });
    } catch (error) {
        return next(error);
    }
};
