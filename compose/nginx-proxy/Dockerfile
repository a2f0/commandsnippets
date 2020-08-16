FROM jwilder/nginx-proxy
RUN mkdir -p /etc/nginx/vhost.d/
RUN { \
      echo 'try_files $uri /index.html;'; \
    } > /etc/nginx/vhost.d/default_location