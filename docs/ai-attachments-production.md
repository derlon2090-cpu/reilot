# AI attachments production setup

The AI chat attachment bucket must remain private. Do not enable `r2.dev`, a public custom domain, or anonymous object access. Use a Cloudflare R2 API token scoped only to the selected bucket with Object Read & Write permissions, and store its credentials only in Render's server-side secrets.

Required production variables are documented in `.env.production.example`. Use a separate production bucket (`renvix-production`) and staging bucket (`renvix-staging`). The application never returns credentials, stores presigned URLs, or proxies upload bodies through Render.

Configure R2 CORS for the exact deployed origins only. The browser needs `PUT` with `Content-Type`; normal app API calls remain same-origin. A minimal policy is:

```json
[
  {
    "AllowedOrigins": ["https://renvix.app", "https://www.renvix.app"],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 300
  }
]
```

CORS is not authorization. Authentication, tenant scoping, random server-generated object keys, and short-lived object-specific signatures provide authorization.

Before rollout:

1. Run migration `0078_private_ai_attachment_platform.sql`.
2. Configure R2, Speech, Vision, and both DeepSeek V4 model variables.
3. Run `npm run db:migrate`, `npm run typecheck`, the AI unit tests, and `npm run build`.
4. Run the authenticated readiness screen and confirm `objectStorage` is `healthy` without exposing bucket or endpoint details.
5. Verify a real JPEG and a short Arabic recording on desktop, mobile, and iPad. Confirm upload traffic goes from the browser directly to R2, `complete` performs HEAD/type/size/signature checks, private GET links expire, and another tenant cannot read the attachment.
6. Schedule the existing `cleanup` cron at least hourly. It expires uploads left in `pending`/`uploading` for more than one hour and deletes any corresponding object.

For lifecycle defense in depth, configure Cloudflare rules for future `temp/` objects (one day), `exports/` objects (seven days), and abandoned multipart uploads. Do not apply automatic deletion rules to the `chat/` prefix unless the product retention policy explicitly requires it.
