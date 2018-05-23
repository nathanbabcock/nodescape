#!/bin/bash

sudo docker rm -f nginx
sudo docker run -d \
    --name nginx \
    --restart=always \
    -p 80:80 \
    -v ~/nodescape/nginx-custom.conf:/etc/nginx/conf.d/nginx-custom.conf:ro \
    -v ~/nodescape/src/:/etc/nginx/html/:ro \
    nginx

    # -v /nginx.conf:/etc/nginx/nginx.conf:ro \
