# Alfajr

Alfajr is a web platform for learning communities. It brings together conversations, classroom coordination, assignments, attendance, calls, and community administration.

## Product documentation

Read [PRD Overview](./PRD%20Overview.md) for product goals, current capabilities, workflows, and open decisions. The PRD is a product reference; this README is the developer setup guide.

## Repository layout

- `frontend/` — React and Vite web application
- `backend/` — Node.js and Express API with Socket.IO
- `backend/src/modules/` — backend domain modules
- `scripts/` — database backup utilities
- `docs/` — technical notes and feature guides
- `docker-compose.yml` — local development services
- `docker-compose.prod.yml` — production service definitions

## Requirements

- Node.js 18 or later
- npm
- Docker Compose, if using the containerized setup

## Local development

Install dependencies:

```bash
npm run install:all
```

Configure the environment variables required by the backend in the root `.env` file. Do not commit secrets. The backend also needs MongoDB and Redis; Docker Compose can provide the local services.

Start the development stack:

```bash
npm run docker:up
```

The frontend is served at `http://localhost:3002` and the API at `http://localhost:3001`. To stop the stack:

```bash
npm run docker:down
```

To run the frontend and backend directly, start the required MongoDB and Redis services separately, then use two terminals:

```bash
npm run dev:frontend
```

```bash
npm run dev:backend
```

## Useful commands

| Command | Purpose |
|---|---|
| `npm run build:frontend` | Build the web client |
| `npm run docker:logs` | Follow development container logs |
| `npm run backup` | Run the database backup utility; requires its database configuration |

## Technical overview

- **Frontend:** React 19, Vite, Redux Toolkit, React Router, Tailwind CSS
- **Backend:** Node.js, Express, MongoDB/Mongoose, Redis, Socket.IO
- **Calling:** LiveKit
- **Deployment:** Docker Compose and Nginx

## Documentation

- [Product requirements](./PRD%20Overview.md)
- [Technical guides](./docs/)

## License

UNLICENSED — proprietary.
