This is a LLM chat client that stores the conversations as files/folders in a git-friendly format.

Other features:

- Allows switching between different LLM providers, including locally hosted
- Features MCP support

## Running the Application in Development Mode

1. Create a local environment file from the example:

```bash
cp src/chat/.env.example src/chat/.env
```

2. Update the values in `src/chat/.env` as required for your environment.

3. Start the development server:

```bash
npm run dev
```

4. Open ```http://localhost:3000```

---

## Running Unit Tests

Execute:

```bash
npm run test
```

---

## Running End-to-End (E2E) Tests

You can run E2E tests using one of the following approaches.

---

### Option 1 — Without Containers

This approach requires running the mock LLM API and the application server manually.

1. Start the mock LLM API (keep it running):

```bash
npm run start:mock-openai-api
```

2. Start the application server (keep it running):

```bash
npm run start:e2e
```

3. Run the E2E tests:

```bash
npm run test:e2e
```

---

### Option 2 — Using a Container

If you are developing inside a `devcontainer`, ensure that the **Docker-in-Docker** feature is enabled.

With this approach, the mock LLM API runs as a private service alongside the application server, so you do not need to start it manually.

1. Start the containerized environment:

```bash
npm run start:e2e:container
```

2. Run the E2E tests:

```bash
npm run test:e2e
```

---

### Option 3 — Running E2E Tests Against the Dev Server

E2E tests use an in-memory store, so they can run against the development server without interfering with your local development session.

**Important difference in LLM configuration:**

* When using `start:e2e` or `start:e2e:container`, the application uses a mock LLM API.
* When using the `dev` server, the application uses the LLM configuration defined in your `.env` file. This may cause some tests to fail depending on your configuration.

1. Start the development server:

```bash
npm run dev
```

2. Run the E2E tests:

```bash
npm run test:e2e
```

---

## Using the App to Develop Itself

The `./notes` directory contains prompts used during the research and development of the application.

To start the app configured to store prompts in the `./notes` directory:

```bash
cd deploy
docker compose up --build
```

The application will be available at:

```
http://localhost:4000
```
