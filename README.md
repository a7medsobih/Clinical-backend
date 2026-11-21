# CMS & CRUD Backend Template

A reusable Node.js and Express backend template for CMS and CRUD applications. It includes ready-to-use database, authentication, media upload, and security configuration. The `team` module is a practical CRUD example that can be copied and adapted for new resources.

## Tech Stack

- Node.js and Express 5
- MongoDB and Mongoose
- JWT and bcryptjs for administrator authentication
- Cloudinary and Multer for image and file uploads
- Zod for request validation
- Helmet, CORS, and express-rate-limit for baseline security

## Project Structure

```text
src/
  config/        Database, authentication, Cloudinary, and CORS configuration
  middlewares/   Authentication and error-handling middleware
  modules/       Independent modules: auth, media, and team (CRUD example)
  app.js         Express setup and route registration
  server.js      Application entry point
```

`ADMIN_EMAIL` and `ADMIN_PASSWORD` are only required when running the initial administrator seed command. Multiple allowed client origins can be separated with commas in `CLIENT_URL`.

## Running the Project

```bash
npm install
npm run seed:admin
npm run dev
```

Use `npm start` for normal production-style startup. The health check is available at `GET /api/v1/health`.

## Reuse in a New Project

Copy the `src/modules/team` structure to create a new resource, then register its router in `src/app.js`. Keep the `model`, `schema`, `service`, `controller`, and `routes` layers to make each module isolated and easy to reuse.
