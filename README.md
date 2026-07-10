# Kalon Lab

Kalon Lab is a full-stack web application for creating and managing AI avatar profiles. It includes authenticated user accounts, avatar image storage, an administration dashboard, and a typed API client shared with the frontend.

The project began with the [Full Stack FastAPI Template](https://github.com/fastapi/full-stack-fastapi-template) and is now maintained as an independent application.

## Stack

- FastAPI and Python
- SQLModel, Alembic, and PostgreSQL
- React, TypeScript, and Vite
- TanStack Router and TanStack Query
- Tailwind CSS and shadcn/ui
- S3-compatible image storage
- Docker Compose
- Pytest and Playwright

## Local development

The recommended way to start the complete development stack is:

```bash
docker compose watch
```

Once the services are ready, the main local endpoints are:

- Frontend: <http://localhost:5173>
- Backend API: <http://localhost:8000>
- API documentation: <http://localhost:8000/docs>
- Adminer: <http://localhost:8080>
- Mailcatcher: <http://localhost:1080>

Before starting the application, review the configuration in `.env`. Never use the placeholder secrets in a deployed environment.

See [development.md](./development.md) for local services, environment configuration, testing, linting, and generated-client instructions.

## Project structure

```text
backend/     FastAPI application, database models, migrations, and tests
frontend/    React application, generated API client, and browser tests
scripts/     Repository development and test helpers
```

## Deployment

The application includes a Docker Compose and Traefik deployment configuration. See [deployment.md](./deployment.md) for environment and deployment requirements.

## License

This project includes work derived from the Full Stack FastAPI Template, originally released under the MIT License. See [LICENSE](./LICENSE).
