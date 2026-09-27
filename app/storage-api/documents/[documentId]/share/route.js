// Keep storage sharing on the Next.js origin. The legacy /api rewrite points at
// api.renvix.app, which does not own the storage-center routes.
export { DELETE, GET, POST } from "../../../../api/storage/documents/[documentId]/share/route.js";
