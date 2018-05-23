#!/bin/bash

docker rm -f nginx
docker run -d \
    --name nginx \
    --restart=always \
    -p 80:80 \
    -v src/:/usr/share/nginx/html:ro \
    nginx

    # -v /nginx.conf:/etc/nginx/nginx.conf:ro \