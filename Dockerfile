FROM node:22-alpine
RUN apk add --no-cache tzdata
ENV TZ=Asia/Seoul
WORKDIR /app
COPY package.json run.mjs dashboard.mjs entrypoint.sh ./
COPY src ./src
COPY public ./public
RUN chmod +x /app/entrypoint.sh && mkdir -p /data /var/log && printf '0 8 * * * cd /app && /usr/local/bin/node /app/run.mjs >> /var/log/digest.log 2>&1\n' > /etc/crontabs/root
EXPOSE 8080
CMD ["/app/entrypoint.sh"]
