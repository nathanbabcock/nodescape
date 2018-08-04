#!/bin/bash

sudo docker rm -f nodescape
sudo docker build -t nodescape .
sudo docker run -d \
    --name nodescape \
    --restart=always \
    -p 8081:8081 \
    nodescape

    # -v /nginx.conf:/etc/nginx/nginx.conf:ro \
