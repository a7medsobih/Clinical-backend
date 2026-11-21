import { getCloudinary } from "../../config/cloudinary.js";
import Media from "./media.model.js";

const rootFolder = () => (process.env.CLOUDINARY_FOLDER || "cms-crud-template").replace(/\/$/, "");

export const uploadBufferToCloudinary = (buffer, { type, folder }) => {
    const cloudinary = getCloudinary();
    const resourceType = type === "image" ? "image" : "raw";

    return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            { folder: `${rootFolder()}/${folder}`, resource_type: resourceType },
            (error, result) => (error ? reject(error) : resolve(result))
        );
        stream.end(buffer);
    });
};

export const deleteFromCloudinary = (media) =>
    getCloudinary().uploader.destroy(media.publicId, {
        resource_type: media.type === "image" ? "image" : "raw",
    });

export const createMedia = (input) => Media.create(input);

export const getMediaById = (id) => Media.findById(id);

export const deleteMediaById = (id) => Media.findByIdAndDelete(id);
