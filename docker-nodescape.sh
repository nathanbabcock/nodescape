#!/bin/bash

sudo docker rm -f nodescape
sudo docker build -t nodescape .
sudo docker run -d \
    --name nodescape \
    --restart=always \
    -v ~/nodescape/client_cache.json:/usr/src/app/client_cache.json \
    -v ~/nodescape/gamestate.json:/usr/src/app/gamestate.json \
    -p 8081:8081 \
    nodescape; \
docker logs -f nodescape

    # -v /nginx.conf:/etc/nginx/nginx.conf:ro \
