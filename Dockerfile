FROM node:10

WORKDIR /usr/sekai-event-predict/

COPY package*.json ./
RUN npm install

COPY . .
CMD [ "ts-node", "predict.ts" ]