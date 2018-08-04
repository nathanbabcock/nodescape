#!/bin/bash

sudo docker rm -f nginx
sudo docker run -d \
    --name nginx \
    --restart=always \
    -p 80:80 \
    -p 443:443 \
    -v ~/nodescape/cert/:/etc/ssl/cert/ \
    -v ~/nodescape/nginx-custom.conf:/etc/nginx/conf.d/nginx-custom.conf:ro \
    -v ~/nodescape/src/client/:/etc/nginx/html/:ro \
    nginx
sudo docker ps -a

    # -v /nginx.conf:/etc/nginx/nginx.conf:ro \
