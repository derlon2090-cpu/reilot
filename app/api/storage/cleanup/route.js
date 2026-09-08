// The cleanup engine remains shared with account data, while its public UI and
// route now belong to Storage Center. Keep the former endpoint as a compatibility
// path for older clients, but new clients use /api/storage/cleanup.
export { GET, DELETE } from "../../settings/storage/cleanup/route.js";
