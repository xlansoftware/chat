# Install playwright

```sh
sudo npx playwright install-deps
npx playwright install
```

# Start mock openai compatible api

As a docker container

```sh
docker run --name mock-openai-api -e PORT=3030 -p 3030:3030 zerob13/mock-openai-api:latest
```

In the devcontainer

```sh
npx mock-openai-api -p 3030
```