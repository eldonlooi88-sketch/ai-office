FROM node:20-alpine
WORKDIR /app
COPY server.js package.json ./
COPY public ./public
COPY bin ./bin
ENV HOST=0.0.0.0 PORT=8787 TRUST_PROXY=1
# data/ 请以卷挂载：-v $PWD/data:/app/data
EXPOSE 8787
CMD ["node", "server.js"]
