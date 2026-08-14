// The balance is a latency-sensitive, read-only projection. Serving it from
// the frontend runtime avoids depending on the public API hostname being
// correctly attached during a DNS or rolling-deployment transition.
export { GET } from "../../../api/ai/usage/route.js";
