```bash
# nextjs noroot 65532
sudo chown -R 65532:65532 ../notes
# mcp-server appuser 10001
sudo chown -R 10001:10001 ../notes/projects

# macos docker
sudo chmod -R 777 ../notes/projects

# run without compose
docker build -t nextjs-app .
docker run -p 3000:3000 nextjs-app

# build
docker build -t xlanchat . \
  --build-arg VERSION=$(git describe --tags --always) \
  --build-arg COMMIT_HASH=$(git rev-parse HEAD) \
  --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
```