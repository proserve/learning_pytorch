# syntax=docker/dockerfile:experimental
FROM gcr.io/medable-ops/foundry-cortex-api:latest

# copy and build sandbox  ----------------------------------------------------------------------------------------------

WORKDIR /app/sandbox

COPY ./sandbox .

RUN npm ci --production && \
    node ./build -clean && \
    node ./build -release

# install app ----------------------------------------------------------------------------------------------------------

WORKDIR /app

COPY . .

RUN --mount=type=ssh,id=default,required=true \
    mkdir -p -m 0600 ~/.ssh && \
    ssh-keyscan github.com >> ~/.ssh/known_hosts && \
    ssh-keyscan gitlab.medable.com >> ~/.ssh/known_hosts && \
    npm ci --only=production

# build runtime sandbox scripts ----------------------------------------------------------------------------------------

WORKDIR /app/lib/modules/sandbox/scripts

RUN node ./build

# cleanup and run ------------------------------------------------------------------------------------------------------

WORKDIR /app

CMD ["node", "--max-old-space-size=4096", "./main.js"]
