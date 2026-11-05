# Moss & Marine

A full-stack **aquarium storefront portfolio demo** built using Node.js, Express, EJS, MongoDB/Mongoose and Bootstrap. Customers can explore aquatic livestock, plants and supplies; authenticated accounts can place **demo orders** (no payment processing). A Data Entry Clerk role can manage inventory.

## Features

- Server-rendered product catalog, search, category navigation and filtering
- Account creation, password hashing and session-based sign-in
- Role-checked inventory management, images stored in MongoDB GridFS
- Aquatic livestock Adult/Juvenile variations with distinct SKUs and stock
- Shopping cart, order history and optional Mailgun transactional messages
- Mobile-friendly EJS/Bootstrap templates and custom CSS

## Stack and architecture

| Layer | Technology |
|---|---|
| Web server | Node.js, Express |
| Templates | EJS, express-ejs-layouts |
| Styling | Bootstrap and custom CSS |
| Database | MongoDB, Mongoose, GridFS |
| Sessions | express-session, connect-mongo |
| Email (optional) | Mailgun |
| Deployment target | Vercel |

`server.js` defines middleware and routes; `controllers/` handles requests; `models/` defines documents; `modules/` contains reusable business logic; `views/` holds EJS templates; `public/` holds static styles, scripts and branding images. Uploaded inventory photos live in GridFS.

## Local setup

Requirements: Node.js 20+, npm and access to a MongoDB database.

1. `npm install`
2. Copy `config/.env.example` to `config/.env`. Add your own MongoDB connection string and a random, long `SESSION_SECRET`. Never commit the real file.
3. Run `npm start` and visit http://localhost:8080.
4. Run `npm run check` and `npm test` for syntax checks and dependency-free utility tests.

No database seed/migration command is included. **Do not run old migration scripts against populated data.**

## Environment variables

| Variable | Required? | Description |
|---|---|---|
| `MONGODB_URI` | Yes | MongoDB Atlas connection string, ideally a scoped application user |
| `SESSION_SECRET` | Yes in production | High-entropy secret for signed sessions |
| `NODE_ENV` | Production | Set `production` on deployed instances |
| `MAILGUN_API_KEY` | Optional | Mailgun sending credentials |
| `MAILGUN_DOMAIN` | Optional | Verified Mailgun sending domain |
| `MAILGUN_FROM` | Optional | Sender address |
| `MAILGUN_API_BASE_URL` | Optional | Region-specific Mailgun API endpoint |

Production credentials go in Vercel **Project → Settings → Environment Variables**, never in Git or the source zip. `config/db.js` is source code, not a credential: it belongs in Git.

## GitHub and Vercel

- `.gitignore` keeps `node_modules`, local `.env` files and `.vercel` out of Git. It **does not** protect a secret already committed to Git history: rotate any exposed credential.
- `public/` is important: Vercel's current native Express integration serves assets from `public/`, not Express's `express.static()` middleware. Local Express uses the same directory.
- Import the GitHub repository in Vercel. Use the project root and Express auto-detection; no legacy `vercel.json` builds configuration is needed. Deploy first to Preview, test static assets, GridFS photos, sessions, account permissions, variant checkout and email behavior.
- Add your own domain under **Project → Settings → Domains** after the deployment succeeds. Set up the verified Mailgun domain afterward.
- Review billing and spending limits in **Vercel team Billing → Spend Management** (Pro) and **Mailgun Custom Message Limits**. Warnings alone are not hard caps. See the providers' current documentation.

## Safety / production readiness

This project is a **portfolio demo**, not a production commerce system. No real payment or shipment is processed. Before exposing it to the public, review CSRF protection, login rate limiting, administrative account provisioning, spam/abuse controls, data retention and transactional inventory concurrency. Do not publish real customer data or place actual orders.

## License

The package metadata currently uses ISC, a permissive license. Confirm whether you want to publish under that license before making the repository public.
