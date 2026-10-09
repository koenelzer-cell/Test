FROM node:20-alpine
WORKDIR /app
COPY package.json index.mjs ./
ENV PORT=8080
EXPOSE 8080
USER node
CMD ["node", "index.mjs"]
