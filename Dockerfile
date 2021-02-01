FROM node:10

WORKDIR /usr/sekai-event-predictor/

COPY package*.json ./
RUN npm install

COPY . .
CMD [ "ts-node", "predictForSekaiViewer.ts" ]