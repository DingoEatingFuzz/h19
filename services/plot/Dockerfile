FROM buildkite/puppeteer:v1.15.0

WORKDIR /usr/src/app

COPY package*.json ./
RUN npm ci --only=production
RUN npm install --global http-server
COPY dist dist
COPY art art

CMD [ "npm", "run prod" ]
