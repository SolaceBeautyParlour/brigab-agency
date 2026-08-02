import MediaGallery from "./MediaGallery.jsx";
import { api } from "../api/client.js";

/**
 * Thin wrapper around MediaGallery for room-level photos — kept as its own
 * file so BedGrid.jsx's existing usage doesn't need to change.
 */
export default function RoomMedia({ room, managerMode, onChanged }) {
  return (
    <MediaGallery
      initialItems={room.media}
      managerMode={managerMode}
      uploadFn={(file) => api.uploadRoomMedia(room.id, file)}
      altLabel={`${room.room_code} photo`}
      onChanged={onChanged}
    />
  );
}
