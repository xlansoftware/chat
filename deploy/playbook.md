```bash
# linux
sudo chown -R 65532:65532 ../notes

# macos docker
sudo chmod -R 777 ../notes/projects

# build
docker build . \
  --build-arg VERSION=$(git describe --tags --always) \
  --build-arg COMMIT_HASH=$(git rev-parse HEAD) \
  --build-arg BUILD_DATE=$(date -u +%Y-%m-%dT%H:%M:%SZ)
```