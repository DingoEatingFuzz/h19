FROM node:10

WORKDIR /usr/src/app

RUN npm install --global http-server

COPY art art

EXPOSE 8080

CMD [ "http-server", "art" ]
