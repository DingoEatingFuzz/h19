FROM node:10

WORKDIR /usr/src/app

COPY dist dist
RUN npm install --global http-server

EXPOSE 8080

CMD [ "http-server", "dist" ]
