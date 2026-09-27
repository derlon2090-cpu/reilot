// Public share links are intentionally passwordless; authorization is provided
// by the high-entropy bearer token and enforced by the canonical route below.
export { GET, PATCH } from "../../../../api/public/storage-documents/[token]/route.js";
