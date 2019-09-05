FROM buildkite/puppeteer:v1.15.0

WORKDIR /usr/src/app

COPY package*.json ./
COPY config.json ./
RUN npm ci --only=production
COPY dist dist

CMD [ "npm", "run", "prod" ]
