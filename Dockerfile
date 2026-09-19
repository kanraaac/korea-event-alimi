FROM node:22-alpine
RUN apk add --no-cache tzdata
ENV TZ=Asia/Seoul
WORKDIR /app
COPY package.json run.mjs ./
COPY src ./src
RUN printf '0 8 * * * cd /app && /usr/local/bin/node /app/run.mjs >> /var/log/digest.log 2>&1\n' > /etc/crontabs/root
CMD ["crond", "-f", "-d", "8"]
