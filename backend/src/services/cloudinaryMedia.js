import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_VIDEO_BYTES = 25 * 1024 * 1024; // 25MB — enough for a short clip, not a movie
export const MAX_VIDEO_SECONDS = 45; // enforced client-side before upload even starts
export const MAX_MEDIA_PER_ROOM = 8;

/**
 * Uploads a buffer to Cloudinary. Images are auto-compressed and capped at
 * a sane display width; videos are transcoded down too — this is what
 * keeps "a bunch of hostel photos" from ever becoming a storage problem,
 * regardless of what a manager's phone camera originally produced.
 */
export function uploadRoomMedia(buffer, resourceType) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        resource_type: resourceType,
        folder: "brigab/rooms",
        // Images: resize down to a webpage-appropriate width, auto quality/format.
        ...(resourceType === "image" && {
          eager: [{ width: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }],
          eager_async: false,
        }),
        // Video: cap resolution and let Cloudinary pick an efficient codec/quality.
        ...(resourceType === "video" && {
          eager: [{ width: 720, crop: "limit", quality: "auto" }],
          eager_async: false,
        }),
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });
}

export function deleteRoomMedia(publicId, resourceType) {
  return cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
}
