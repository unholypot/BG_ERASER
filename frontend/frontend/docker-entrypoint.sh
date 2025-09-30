#!/bin/bash
if [ ! -z "$API_HOST" ]; then
    find /usr/share/nginx/html -name "*.js" -exec sed -i "s|http://localhost:3001|${API_HOST}|g" {} \;
fi
exec "$@"