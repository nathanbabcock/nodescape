#!/bin/bash

docker rm -f nginx
docker run -d \
    --name nginx \
    --restart=always \
    -p 80:80 \
    -v /:/usr/share/nginx/html:ro \
    -v /nginx.conf:/etc/nginx/nginx.conf:ro \
    nginx