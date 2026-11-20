# Batloung Farm — Netflix-Inspired Fresh Produce Platform

A complete **Express + MySQL + HTML/CSS/JavaScript** project. The same Express server serves both the cinematic website and all `/api` routes. The UI is *not* React; it is the existing lightweight frontend, expanded without changing frameworks.

## Four access levels

| Visitor | How they enter | Access |
|---|---|---|
| **Guest** | No sign-in needed | Public fruit catalogue, prices/availability, owner WhatsApp enquiries |
| **Customer** | Register with their own name, email and private password | Public catalogue + saved profile, update profile/password, contact owner |
| **Employee** | Administrator creates a private employee account with a temporary password; employee changes it on first login | Staff workspace, sales, deliveries, vendor/supplier management, transaction records |
| **Administrator** | Created privately with the one-time command below; **there is no public administrator sign-up** | Entire system including dashboard, inventory prices, reports, deleting suppliers, and creating/disabling/resetting staff accounts |

**Customer registration cannot create an employee or administrator**, even if someone edits a browser request: the server assigns `CUSTOMER`. API endpoints check the user's session and role independently of the UI.

**Enquiry-only storefront:** The public website lets customers browse and contact you via WhatsApp. It does not take card payments or automatically create vendor sales. The existing vendor sales workflow is restricted to staff.

## 1. Setup on Windows — KEEP your existing farm data

1. Extract this ZIP; open the inner `batloung-farm` folder in VS Code.
2. Open the integrated terminal and navigate to `backend`.
3. If you kept a working `backend/.env` from your previous installation, **use that file**. Otherwise copy `.env.example` to `.env` and enter your existing MySQL credentials. Do not publish this file.
4. Install dependencies, add **only** the two extra authentication tables, create your sole administrator, and start:

```powershell
cd backend
npm install
npm run auth:setup
npm run auth:admin
npm start
```

5. `npm run auth:admin` asks for your full name, email and password in your terminal. The password input is hidden. **Choose your own strong password** (12–128 characters, at least one letter and number). No default username or administrator password is included in this ZIP.
6. Visit **http://localhost:5000** (the public catalogue is the starting page).
7. Select **Sign in → Administrator** using the email and password you just created. Then go to **Team** to create employee accounts.
8. For employees, provide a private temporary password. They sign in as **Employee** and are required to change it in **My Account** before using work screens.
9. Customers click **Join free**, choose their own password, and can log out and log back in later. Guests can browse at any time.

### Important: database changes are additive only

The original `backend/database/schema.sql` and `backend/database/reports.sql` have **not been changed**. None of the existing Suppliers, Fruits, Vendors, Purchases, Purchase_Details, Sales, Sales_Details, or Stock tables is modified. A NEW separate file `backend/database/auth.sql` creates:

- `app_users` — customer/admin/employee accounts, with randomly salted **scrypt password hashes** (never plaintext).
- `app_sessions` — hashed session tokens associated with accounts; `HttpOnly`, `SameSite=Lax` cookies (encrypted in transit when using HTTPS) with a 7-day maximum lifetime (`Secure` in production).

These are persistent MySQL tables. Customer accounts survive restarts and deployment as long as you use a persistent MySQL database. `npm run auth:setup` is safe to rerun because it uses `CREATE TABLE IF NOT EXISTS`.

**DO NOT run `npm run db:setup` on your existing database.** That is the original assignment's farm-initialization command and may recreate/reset farm records. You only need `npm run auth:setup` when updating an already working project.

## 2. Roles and server-enforced permissions

| Endpoint group | Guest/Customer | Employee | Admin |
|---|---|---|---|
| `/api/catalog` | Read | Read | Read |
| `/api/auth/register` | Customer registration only | — | — |
| `/api/suppliers` and `/api/vendors` | Blocked | Read, add, edit | Read, add, edit; supplier delete |
| `/api/fruits` and `/api/stock` | Blocked | Read | Read and change fruit details/prices |
| `/api/sales` and `/api/purchases` | Blocked | Read, create sales/deliveries, take payments | Same |
| `/api/reports` | Blocked | Blocked | Read |
| `/api/auth/staff` | Blocked | Blocked | Create, disable/reactivate and reset employee password |
| `/api/auth/profile`, `/api/auth/change-password` | Logged-in owner only | Logged-in owner only | Logged-in owner only |

Employees with an issued temporary password **must change it first** before business API endpoints become accessible. Employees cannot promote themselves or create administrators. Administrator creation is a one-time private CLI operation; that CLI refuses to create another admin after one exists.

## 3. Customize site and WhatsApp

Edit `frontend/site-config.js`:

```javascript
ownerWhatsApp: '266XXXXXXXX',  // digits only with international code, replace Xs
```

The WhatsApp number becomes visible on the public website, as expected for a business contact. The button and public fruit cards open a customer chat with a prefilled enquiry. Until configured, visitors see a helpful setup message instead of a broken link.

Supplier maps use Leaflet/OpenStreetMap and verified-address rules from the previous release. The old incorrect Maseru fallback is gone; exact pins need supplier-confirmed coordinates in `site-config.js`. Unverified map results are labelled approximate, not exact. The external Google Maps button searches the supplier address. This works without changing supplier SQL tables.

## 4. Deploy safely (GitHub + Render)

1. Push the project to GitHub. Do not commit `backend/.env`, database dumps with live personal records, or any employee passwords. A root `.gitignore` and `backend/.gitignore` are included.
2. Create a managed persistent **MySQL** database. Update its hostname, port, user, password, and database name. Do **not** use an ephemeral local DB for customer accounts.
3. Run **`npm run auth:setup`** with `.env` pointed at that remote database, then **`npm run auth:admin`** using the same database. Both commands can be run from your own Windows terminal before deployment. Do not run the old `db:setup` on existing data.
4. Deploy a **single Node web service** to Render (or an equivalent Node host): set the root directory to `batloung-farm-complete/batloung-farm`, build command `cd backend && npm install`, and start command `cd backend && npm start`. Keep the `frontend` folder beside `backend` in the deployed repository because Express serves it using `../frontend`.
5. In your hosting dashboard set `NODE_ENV=production` and all `DB_*` values as **environment variables**. Use HTTPS. The login cookie will be marked `Secure` in production.
6. Test Guest, Customer, Employee, and Administrator accounts on the deployed URL, followed by supplier maps, stock changes, sales, purchases and reporting.

> **Do not use GitHub Pages alone** to host this project. GitHub can hold the source code, but the Node server and MySQL database must run on backend/database hosting.

### Security and production notes

- Account passwords use Node.js built-in **scrypt** with per-password random salts. Passwords are never included in normal API responses.
- Sessions use random, hashed, server-side tokens, and cookies are `HttpOnly` + `SameSite=Lax`; cookies are `Secure` when `NODE_ENV=production`. Changing a password revokes other sessions. Deactivating an employee revokes their sessions.
- Unsafe API methods perform a browser same-origin check; cross-origin browser requests aren't opened with wildcard CORS. Simple login/registration rate limiting is included (in memory for a single server instance). A shared persistent rate-limit store is recommended if scaling to multiple servers.
- **Not yet implemented:** email ownership verification, emailed password recovery, order checkout, and payment processing. Add those and run a full security review before accepting sensitive public transactions. Do not promise customers online payment from this version.
- For public launch, use a properly configured HTTPS domain, stable managed MySQL, backups, and real business contact details.

## 5. Test plan

1. Open a private browser window: the catalogue is visible, but private API calls such as `/api/reports/summary` return **401**.
2. Create a new customer account, sign out, and sign back in as **Customer** using that password. It should still work after a backend restart.
3. Try to enter `#/reports` or `#/team` as a customer; these must be denied by both the UI and API.
4. Sign in as Administrator. Create a new employee in **Team**.
5. Sign in as that employee: they must change the temporary password before the staff workspace works. Their API attempts to change a stock price or access reports must be **403**.
6. Deactivate the employee as Admin. Verify that their existing session is revoked and they cannot sign in until reactivated.
7. Confirm sales, purchases, map lookups and payments work with an authorized account. Existing business database records must still be there.
8. Run `npm test` in `backend` for password-hashing and security utility tests.

## Original assignment

The original API controllers, models, SQL files, stock sizes, financial calculations, and purchase/sale transaction logic remain in place. The Netflix-inspired fruit visuals, unique section banners, WhatsApp control, and supplier map safeguards from the previous package have been retained.
